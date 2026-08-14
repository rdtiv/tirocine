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
//   1. Pull every ```typescript block out of the document.
//   2. Classify it. Blocks carry a marker comment on their first line when
//      they are NOT a whole file; otherwise the filename is read from the
//      prose that introduces the block ("Create `src/usage.ts`:").
//   3. Rebuild src/ in a temp directory using ONLY the document's version of
//      each file, then compile it with the project's own tsconfig.
//   4. Diff each reconstructed file against the real one in src/.
//
// A block that cannot be classified is an ERROR, never a silent skip — a
// checker that quietly covers less than you think is worse than none.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DOC = 'docs/typescript.md';

interface Block {
  n: number;
  line: number;
  code: string;
  kind: 'file' | 'edit' | 'locate' | 'illustrative' | 'demo';
  file?: string;
}

// --- 1. extract ------------------------------------------------------------
const doc = readFileSync(DOC, 'utf8').split('\n');
const blocks: Block[] = [];

for (let i = 0; i < doc.length; i++) {
  if (doc[i]!.trim() !== '```typescript') continue;
  const start = i + 1;
  let end = start;
  while (end < doc.length && doc[end]!.trim() !== '```') end++;
  const code = doc.slice(start, end).join('\n');
  const n = blocks.length + 1;

  // --- 2. classify ---------------------------------------------------------
  const first = code.split('\n')[0] ?? '';
  let kind: Block['kind'];
  let file: string | undefined;

  if (first.startsWith('// Illustrative —')) {
    kind = 'illustrative';
  } else if (first.startsWith('// Edit — splice this into ')) {
    kind = 'edit';
    file = first.replace('// Edit — splice this into ', '').replace(/;.*$/, '').trim();
  } else if (first.startsWith('// Locate — find this in ')) {
    kind = 'locate';
    file = first.replace('// Locate — find this in ', '').replace(/;.*$/, '').trim();
  } else if (first.startsWith('// File — ')) {
    kind = 'file';
    file = first.replace('// File — ', '').replace(/\s*\(.*$/, '').trim();
  } else if (first.startsWith('// Demo —')) {
    kind = 'demo';
  } else {
    // Read the filename out of the prose just above the block.
    const context = doc.slice(Math.max(0, start - 12), start - 1).join('\n');
    const named = [...context.matchAll(/`(src\/[a-z-]+\.ts)`/g)].pop();
    if (!named) {
      console.error(
        `\n${DOC}:${start}  block ${n} cannot be classified.\n` +
          `  No marker comment, and no \`src/*.ts\` filename in the prose above it.\n` +
          `  Add a marker as the block's first line, one of:\n` +
          `    ${'// Illustrative — showing a shape, not a file to create.'}\n` +
          `    // Edit — splice this into src/<file>.ts; not a whole file.\n` +
          `  ...or name the file in the sentence that introduces the block.\n`,
      );
      process.exit(1);
    }
    kind = 'file';
    file = named[1];
  }

  blocks.push({ n, line: start, code, kind, file });
  i = end;
}

const files = blocks.filter((b) => b.kind === 'file');
console.log(
  `${DOC}: ${blocks.length} blocks — ${files.length} files, ` +
    `${blocks.filter((b) => b.kind === 'edit').length} edits, ` +
    `${blocks.filter((b) => b.kind === 'illustrative').length} illustrative, ` +
    `${blocks.filter((b) => b.kind === 'demo').length} demo`,
);

// --- 3. rebuild src/ from the document, then compile -----------------------
// Seed from the real src/ so imports resolve, then overwrite every file the
// document builds. Where a file is written more than once (an early version
// superseded later), the LAST block wins — that's the reader's end state.
const work = mkdtempSync(join(tmpdir(), 'weatherwise-docs-'));
const workSrc = join(work, 'src');
cpSync('src', workSrc, { recursive: true });

const fromDoc = new Map<string, Block>();
for (const b of files) fromDoc.set(b.file!, b);
for (const [f, b] of fromDoc) writeFileSync(join(work, f), b.code + '\n');

cpSync('tsconfig.json', join(work, 'tsconfig.json'));
// package.json matters: "type": "module" is what makes top-level await legal.
// Without it every file compiles as CommonJS and you get a wall of TS1309.
cpSync('package.json', join(work, 'package.json'));
cpSync('node_modules', join(work, 'node_modules'), { recursive: true, dereference: false });

let failures = 0;

try {
  execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
    cwd: work,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  console.log('compile: the document\'s own version of src/ typechecks');
} catch (err) {
  const out = (err as { stdout?: string }).stdout ?? String(err);
  console.error('\ncompile FAILED — the code in the document does not build:\n');
  for (const line of out.trim().split('\n')) {
    const m = line.match(/^src\/([a-z-]+\.ts)\((\d+),\d+\)/);
    if (m) {
      const b = fromDoc.get(`src/${m[1]}`);
      const at = b ? `${DOC}:${b.line + Number(m[2]) - 1}` : `src/${m[1]}`;
      console.error(`  ${at}  ${line.replace(/^\S+\s/, '')}`);
    } else {
      console.error(`  ${line}`);
    }
  }
  failures++;
}

// --- 4. diff the document's files against the real ones --------------------
/** Comments and blank lines are noise here: src/ carries teaching headers the
 *  document expresses in prose. What must match is the code. */
function code(src: string): string {
  return src
    .split('\n')
    .map((l) => l.replace(/\s*\/\/.*$/, '').trimEnd())
    .filter((l) => l.trim() && !/^\s*(\/\*|\*|\*\/)/.test(l))
    .join('\n');
}

// A file with edit blocks is COMPOSED: the whole-file block is an early
// version the document later modifies. Diffing it against src/ would always
// fail, so instead check that every line src/ has and the base block lacks is
// accounted for by one of those edit blocks. That still catches the drift
// that matters — src/ growing something the document never tells you to add.
const editedFiles = new Set(blocks.filter((b) => b.kind === 'edit').map((b) => b.file!));
const editLines = new Map<string, string[]>();
for (const b of blocks.filter((b) => b.kind === 'edit')) {
  const acc = editLines.get(b.file!) ?? [];
  acc.push(...code(b.code).split('\n'));
  editLines.set(b.file!, acc);
}

const redundant: string[] = [];
for (const b of blocks.filter((x) => x.kind === 'edit')) {
  const base = fromDoc.get(b.file!);
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

const drift: string[] = [];
const composed: string[] = [];

for (const [f, b] of fromDoc) {
  const a = code(b.code);
  const c = code(readFileSync(f, 'utf8'));

  if (editedFiles.has(f)) {
    const base = new Set(a.split('\n').map((l) => l.trim()));
    const edits = new Set((editLines.get(f) ?? []).map((l) => l.trim()));
    const unexplained = c
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
      composed.push(f);
    }
    continue;
  }

  if (a === c) continue;

  const al = a.split('\n');
  const cl = c.split('\n');
  const i = al.findIndex((l, k) => l !== cl[k]);
  drift.push(
    `  ${f}\n` +
      `    ${DOC}:${b.line} has: ${JSON.stringify(al[i] ?? '(end of block)')}\n` +
      `    ${f} has: ${JSON.stringify(cl[i] ?? '(end of file)')}`,
  );
}

if (drift.length) {
  console.error(`\ndiff FAILED — ${drift.length} file(s) differ between the document and src/:\n`);
  console.error(drift.join('\n\n') + '\n');
  failures++;
} else {
  const exact = fromDoc.size - composed.length;
  console.log(`diff: ${exact} file(s) match src/ exactly`);
  if (composed.length) {
    console.log(
      `      ${composed.length} built in stages, every later line accounted for: ` +
        composed.map((f) => f.replace('src/', '')).join(', '),
    );
  }
}

// Every runnable script in src/ should be built somewhere in the document.
const unbuilt = readdirSync('src')
  .filter((f) => f.endsWith('.ts'))
  .map((f) => `src/${f}`)
  .filter((f) => !fromDoc.has(f) && f !== 'src/models.ts');

if (unbuilt.length) {
  console.error(`\ncoverage FAILED — in src/ but never built by the document:\n  ${unbuilt.join('\n  ')}\n`);
  failures++;
} else {
  console.log('coverage: every file in src/ is built by the document (except src/models.ts, a documented extra)');
}

rmSync(work, { recursive: true, force: true });

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nall checks passed\n');
