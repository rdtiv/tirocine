// Repo infrastructure, not part of the tutorial.
//
// Run: npm run verify:docs
//
// The claim this script tests: a reader who types every code block in
// docs/typescript.md ends up with a project that compiles and matches src/.
// That is a mechanical claim, so it should be a mechanical test rather than
// something a human re-checks by eye and eventually stops re-checking.
//
// How it works:
//
//   1. Pull every fenced TypeScript block out of the document.
//   2. Classify it. Blocks carry a marker comment on their first line when
//      they are NOT a whole file; otherwise the filename is read from the
//      prose that introduces the block ("Create `src/usage.ts`:").
//   3. Rebuild src/ in a temp directory from the document's own blocks and
//      compile it — once with each file's final version, once with the early
//      version of any file the document builds in stages.
//   4. Diff each reconstructed file against the real one in src/.
//
// A block that cannot be classified is an ERROR, never a silent skip — a
// checker that quietly covers less than you think is worse than none.

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DOC = 'docs/typescript.md';

/** Fence languages that mean "this is TypeScript the reader might type". */
const TS_FENCES = new Set(['typescript', 'ts']);
/** Fence languages we knowingly ignore. Anything else is an error, so a new
 *  language cannot quietly appear and go unchecked. */
const IGNORED_FENCES = new Set(['json', 'powershell', 'bash', 'sh', 'python', 'markdown', '']);

interface Block {
  n: number;
  /** 1-based line of the block's first line of code. */
  line: number;
  code: string;
  kind: 'file' | 'edit' | 'locate' | 'illustrative' | 'demo';
  file?: string;
}

/**
 * Strip comments so the diff compares code, not prose — src/ carries teaching
 * headers the document expresses in its own text instead.
 *
 * This walks the source rather than running a regex, because `//` appears
 * inside string literals: a naive /\/\/.*$/ turns
 *   const url = `https://api.weatherapi.com/v1/current.json?${params}`;
 * into "const url = `https:" on BOTH sides, so the endpoint stops being
 * compared at all and the document could name any host it liked. Quote state
 * is tracked across lines, because template literals span them.
 */
function code(src: string): string {
  let out = '';
  let quote: string | null = null;
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];

    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }

  return out
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .join('\n');
}

function bail(line: number, message: string): never {
  console.error(`\n${DOC}:${line}  ${message}\n`);
  process.exit(1);
}

// --- 1. extract and classify ------------------------------------------------
const doc = readFileSync(DOC, 'utf8').split('\n');
const blocks: Block[] = [];

for (let i = 0; i < doc.length; i++) {
  const fence = doc[i]!.trim();
  if (!fence.startsWith('```')) continue;

  const lang = fence.slice(3).trim().toLowerCase();
  let end = i + 1;
  while (end < doc.length && doc[end]!.trim() !== '```') end++;

  if (!TS_FENCES.has(lang)) {
    if (!IGNORED_FENCES.has(lang)) {
      bail(
        i + 1,
        `unknown fence language \`${lang}\`.\n` +
          `  Add it to TS_FENCES if it is TypeScript the reader types, or to\n` +
          `  IGNORED_FENCES if it is not. Silently skipping it is not an option.`,
      );
    }
    i = end;
    continue;
  }

  const start = i + 1; // 0-based index of the first code line
  const src = doc.slice(start, end).join('\n');
  const n = blocks.length + 1;
  const first = src.split('\n')[0] ?? '';

  let kind: Block['kind'];
  let file: string | undefined;

  if (first.startsWith('// Illustrative —')) {
    kind = 'illustrative';
  } else if (first.startsWith('// Demo —')) {
    kind = 'demo';
  } else if (first.startsWith('// Edit — splice this into ')) {
    kind = 'edit';
    file = first.replace('// Edit — splice this into ', '').replace(/;.*$/, '').trim();
  } else if (first.startsWith('// Locate — find this in ')) {
    kind = 'locate';
    file = first.replace('// Locate — find this in ', '').replace(/;.*$/, '').trim();
  } else if (first.startsWith('// File — ')) {
    kind = 'file';
    file = first.replace('// File — ', '').replace(/\s*\(.*$/, '').trim();
  } else {
    const context = doc.slice(Math.max(0, start - 12), start - 1).join('\n');
    const named = [...context.matchAll(/`(src\/[a-z-]+\.ts)`/g)].pop();
    if (!named) {
      bail(
        start + 1,
        `block ${n} cannot be classified.\n` +
          `  No marker comment, and no \`src/*.ts\` filename in the prose above it.\n` +
          `  Add a marker as the block's first line, one of:\n` +
          `    // Illustrative — showing a shape, not a file to create.\n` +
          `    // Edit — splice this into src/<file>.ts; not a whole file.\n` +
          `    // Locate — find this in src/<file>.ts; you are not changing it yet.\n` +
          `    // File — src/<file>.ts\n` +
          `    // Demo — complete, but never saved to a file.\n` +
          `  ...or name the file in the sentence that introduces the block.`,
      );
    }
    kind = 'file';
    file = named[1];
  }

  blocks.push({ n, line: start + 1, code: src, kind, file });
  i = end;
}

const fileBlocks = blocks.filter((b) => b.kind === 'file');
const byFile = new Map<string, Block[]>();
for (const b of fileBlocks) byFile.set(b.file!, [...(byFile.get(b.file!) ?? []), b]);

/** The reader's end state for each file: the last block the document gives. */
const finalOf = new Map([...byFile].map(([f, bs]) => [f, bs[bs.length - 1]!]));
/** Earlier versions the document later edits — a real state the reader occupies. */
const earlyOf = new Map([...byFile].filter(([, bs]) => bs.length > 1).map(([f, bs]) => [f, bs[0]!]));

console.log(
  `${DOC}: ${blocks.length} TypeScript blocks — ${fileBlocks.length} file listings ` +
    `(${finalOf.size} distinct, ${earlyOf.size} with earlier versions), ` +
    `${blocks.filter((b) => b.kind === 'edit').length} edits, ` +
    `${blocks.filter((b) => b.kind === 'locate').length} locators, ` +
    `${blocks.filter((b) => b.kind === 'illustrative').length} illustrative, ` +
    `${blocks.filter((b) => b.kind === 'demo').length} demo`,
);

// Every file the document claims to build must actually exist, or the diff
// step below would crash with a bare ENOENT instead of saying what is wrong.
for (const [f, b] of finalOf) {
  if (!existsSync(f)) {
    bail(b.line, `the document builds ${f}, but that file does not exist in src/.`);
  }
}

let failures = 0;
const work = mkdtempSync(join(tmpdir(), 'weatherwise-docs-'));

try {
  // --- 2. rebuild src/ from the document, then compile ----------------------
  cpSync('src', join(work, 'src'), { recursive: true });
  cpSync('tsconfig.json', join(work, 'tsconfig.json'));
  // package.json matters: "type": "module" is what makes top-level await legal.
  // Without it every file compiles as CommonJS and you get a wall of TS1309.
  cpSync('package.json', join(work, 'package.json'));
  // Symlink rather than copy — the tree is hundreds of megabytes and tsc only
  // needs to resolve @anthropic-ai/sdk and zod out of it.
  symlinkSync(resolve('node_modules'), join(work, 'node_modules'), 'dir');

  const compile = (label: string, versions: Map<string, Block>): void => {
    for (const [f, b] of versions) writeFileSync(join(work, f), b.code + '\n');
    try {
      execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
        cwd: work,
        stdio: 'pipe',
        encoding: 'utf8',
      });
      console.log(`compile (${label}): typechecks`);
    } catch (err) {
      const out = (err as { stdout?: string }).stdout ?? String(err);
      console.error(`\ncompile FAILED (${label}) — code in the document does not build:\n`);
      for (const line of out.trim().split('\n')) {
        const m = line.match(/^src\/([a-z-]+\.ts)\((\d+),\d+\)/);
        const b = m ? versions.get(`src/${m[1]}`) : undefined;
        const at = b ? `${DOC}:${b.line + Number(m![2]) - 1}` : m ? `src/${m[1]}` : '';
        console.error(at ? `  ${at}  ${line.replace(/^\S+\s/, '')}` : `  ${line}`);
      }
      failures++;
    }
  };

  compile('final versions', finalOf);

  if (earlyOf.size) {
    // The reader spends real time in these intermediate states. If an early
    // listing does not compile, they hit it long before reaching the final one.
    const names = [...earlyOf.keys()].map((f) => f.replace('src/', '')).join(', ');
    compile(`earlier versions of ${names}`, earlyOf);
    for (const [f, b] of finalOf) writeFileSync(join(work, f), b.code + '\n'); // restore
  }

  // --- 3. an edit must actually change something ----------------------------
  const redundant: string[] = [];
  for (const b of blocks.filter((x) => x.kind === 'edit')) {
    const base = finalOf.get(b.file!);
    if (!base) continue;
    const baseLines = new Set(code(base.code).split('\n').map((l) => l.trim()));
    const adds = code(b.code)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !baseLines.has(l));
    if (adds.length === 0) {
      redundant.push(
        `  ${DOC}:${b.line} tells the reader to edit ${b.file},\n` +
          `    but every line it adds is already in that file's listing at ${DOC}:${base.line}.`,
      );
    }
  }
  if (redundant.length) {
    console.error(`\nordering FAILED — ${redundant.length} edit(s) instruct a change already made:\n`);
    console.error(redundant.join('\n\n') + '\n');
    failures++;
  } else {
    console.log('ordering: every edit block adds something its file does not already have');
  }

  // --- 4. diff the document's files against the real ones -------------------
  const editLines = new Map<string, Set<string>>();
  for (const b of blocks.filter((x) => x.kind === 'edit')) {
    const acc = editLines.get(b.file!) ?? new Set<string>();
    for (const l of code(b.code).split('\n')) acc.add(l.trim());
    editLines.set(b.file!, acc);
  }

  const drift: string[] = [];
  const staged: string[] = [];

  for (const [f, b] of finalOf) {
    const fromDoc = code(b.code);
    const fromSrc = code(readFileSync(f, 'utf8'));

    if (editLines.has(f)) {
      // Built in stages: this block is an early version the document later
      // edits, so check that every line src/ has beyond it was introduced by
      // one of those edits rather than appearing from nowhere.
      const base = new Set(fromDoc.split('\n').map((l) => l.trim()));
      const edits = editLines.get(f)!;
      const unexplained = fromSrc
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !base.has(l) && !edits.has(l));
      if (unexplained.length) {
        drift.push(
          `  ${f} (built in stages)\n` +
            `    in src/ but never introduced by the document:\n` +
            unexplained.map((l) => `      ${JSON.stringify(l)}`).join('\n'),
        );
      } else {
        staged.push(f);
      }
      continue;
    }

    if (fromDoc === fromSrc) continue;

    const a = fromDoc.split('\n');
    const c = fromSrc.split('\n');
    // Scan to the longer of the two, so "identical prefix, extra tail" names
    // the extra lines instead of reporting a pair of undefineds.
    let i = 0;
    while (i < Math.max(a.length, c.length) && a[i] === c[i]) i++;
    drift.push(
      `  ${f}\n` +
        `    ${DOC}:${b.line + i} has: ` +
        `${a[i] === undefined ? '(nothing — the block ends here)' : JSON.stringify(a[i])}\n` +
        `    ${f} has: ${c[i] === undefined ? '(nothing — the file ends here)' : JSON.stringify(c[i])}`,
    );
  }

  if (drift.length) {
    console.error(`\ndiff FAILED — ${drift.length} file(s) differ between the document and src/:\n`);
    console.error(drift.join('\n\n') + '\n');
    failures++;
  } else {
    console.log(`diff: ${finalOf.size - staged.length} file(s) match src/ exactly`);
    if (staged.length) {
      console.log(
        `      ${staged.length} built in stages, every later line accounted for: ` +
          staged.map((f) => f.replace('src/', '')).join(', '),
      );
    }
  }

  // --- 5. nothing in src/ is left unexplained -------------------------------
  const unbuilt = readdirSync('src')
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `src/${f}`)
    .filter((f) => !finalOf.has(f) && f !== 'src/models.ts');

  if (unbuilt.length) {
    console.error(`\ncoverage FAILED — in src/ but never built by the document:\n  ${unbuilt.join('\n  ')}\n`);
    failures++;
  } else {
    console.log(
      'coverage: every file in src/ is built by the document (except src/models.ts, a documented extra)',
    );
  }
} finally {
  // In a finally block: an early failure used to leak a temp directory holding
  // a full copy of node_modules.
  rmSync(work, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nall checks passed\n');
