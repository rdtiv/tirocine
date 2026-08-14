// Repo infrastructure, not part of the tutorial.
//
// Run: npm run verify:docs
//
// The claim this script tests: a reader who types every code block in a
// tutorial document ends up with a project that compiles and matches the code
// checked in here. That is a mechanical claim, so it should be a mechanical
// test rather than something a human re-checks by eye and eventually stops
// re-checking.
//
// How it works, once per document that has companion code:
//
//   1. Pull every fenced code block in that document's language out of it.
//   2. Classify it. Blocks carry a marker comment on their first line when
//      they are NOT a whole file; otherwise the filename is read from the
//      prose that introduces the block ("Create `src/usage.ts`:").
//   3. Rebuild the source tree in a temp directory from the document's own
//      blocks and typecheck it — once with each file's final version, once
//      with the early version of any file the document builds in stages.
//   4. Diff each reconstructed file against the real one.
//   5. Check nothing in the source tree is left unexplained.
//
// Two documents have companion code today: docs/typescript.md builds src/,
// and docs/python.md builds pyweather/. Everything those two passes need that
// is language-specific — fence names, marker comment syntax, how to strip
// comments, how to typecheck, where the source lives — is isolated in the
// LANGUAGES table below. The gates themselves are shared.
//
// Before any of that, every Markdown file in the repo gets a structural check
// — balanced fences and resolving links — because those break in documents
// that will never have code to diff against, and a mangled code fence in a
// tutorial is worse than a wrong one: it renders as prose.
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
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

interface Block {
  n: number;
  /** 1-based line of the block's first line of code. */
  line: number;
  code: string;
  kind: 'file' | 'edit' | 'locate' | 'illustrative' | 'demo';
  file?: string;
}

/** One compiler complaint, already mapped back to the block that produced it. */
interface Diagnostic {
  /** Source file the compiler named, e.g. 'src/agent.ts'. */
  file: string;
  /** 1-based line WITHIN that file. */
  line: number;
  message: string;
}

interface Language {
  /** Display name, used in log lines. */
  name: string;
  /** The document that builds this language's source tree. */
  doc: string;
  /** Fence languages that mean "this is code the reader might type". */
  fences: Set<string>;
  /** Directory the document builds. */
  dir: string;
  /** Marker comment prefix — '// ' for TypeScript, '# ' for Python. */
  marker: string;
  /** Finds a filename named in the prose above an unmarked block. */
  implicit: RegExp;
  /** Files in `dir` the document is allowed not to build. */
  extras: Set<string>;
  /** Is this a source file the coverage gate should care about? */
  owns: (filename: string) => boolean;
  /** Remove comments so the diff compares code, not prose. */
  strip: (src: string) => string;
  /** Put everything the typechecker needs into the temp directory. */
  seed: (work: string) => void;
  /** Typecheck the temp directory. Returns [] when clean. */
  check: (work: string) => Diagnostic[];
}

// --- comment stripping ------------------------------------------------------
// Both documents express their teaching commentary in prose, while the files
// on disk carry it as comments. Stripping comments is what lets the two be
// compared at all.

/**
 * TypeScript. This walks the source rather than running a regex, because `//`
 * appears inside string literals: a naive /\/\/.*$/ turns
 *   const url = `https://api.weatherapi.com/v1/current.json?${params}`;
 * into "const url = `https:" on BOTH sides, so the endpoint stops being
 * compared at all and the document could name any host it liked. Quote state
 * is tracked across lines, because template literals span them.
 */
function stripTypeScript(src: string): string {
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

  return squash(out);
}

/**
 * Python. Same job, two extra wrinkles.
 *
 * First, `#` inside a string is not a comment — the query strings and format
 * specifiers in pyweather/ would be truncated by a naive regex exactly the way
 * `//` truncates a URL in TypeScript.
 *
 * Second, and this one has no TypeScript equivalent: Python's teaching headers
 * are DOCSTRINGS, which are ordinary string expressions rather than comments.
 * The TypeScript files put the same prose in line and block comments, which
 * this strips, so the document never has to reproduce them. To keep the two
 * languages symmetric, a triple-quoted string is dropped when it sits alone on
 * its own lines — nothing but whitespace before it, nothing but whitespace
 * after its closing quotes. That is a docstring.
 *
 * Two tests keep that safe. The string must sit alone on its line, which keeps
 * `POISON = """..."""`; and it must be at bracket depth zero, which keeps the
 * form where the quotes open on their own line inside an expression:
 *
 *   POISON = (
 *       """still a value, not a docstring"""
 *   )
 *
 * Without the depth test that string would vanish from both sides of the diff,
 * and the document could then disagree with the file about it and still pass —
 * a hole in the one gate whose job is to prevent exactly that.
 */
function stripPython(src: string): string {
  let out = '';
  let i = 0;
  let depth = 0;

  /** Is everything emitted since the last newline just whitespace? */
  const atLineStart = (): boolean => {
    const line = out.slice(out.lastIndexOf('\n') + 1);
    return line.trim() === '';
  };

  while (i < src.length) {
    const c = src[i]!;
    const triple = src.slice(i, i + 3);

    if (triple === '"""' || triple === "'''") {
      const alone = atLineStart() && depth === 0;
      let body = triple;
      let j = i + 3;
      while (j < src.length && src.slice(j, j + 3) !== triple) {
        if (src[j] === '\\') {
          body += src[j]! + (src[j + 1] ?? '');
          j += 2;
          continue;
        }
        body += src[j]!;
        j++;
      }
      body += triple;
      j += 3;

      // Trailing whitespace on the closing line decides docstring vs value.
      let k = j;
      while (k < src.length && (src[k] === ' ' || src[k] === '\t')) k++;
      const endsLine = k >= src.length || src[k] === '\n' || src[k] === '\r';

      if (alone && endsLine) {
        i = k; // drop the docstring entirely; squash() removes the blank line
        continue;
      }
      out += body;
      i = j;
      continue;
    }

    if (c === '"' || c === "'") {
      const q = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== q && src[i] !== '\n') {
        if (src[i] === '\\') {
          out += src[i]! + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i]!;
        i++;
      }
      if (src[i] === q) {
        out += q;
        i++;
      }
      continue;
    }

    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // Bracket depth, counted outside strings and comments, so the docstring
    // test above can tell a statement from the middle of an expression.
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;

    out += c;
    i++;
  }

  return squash(out);
}

/** Drop trailing whitespace and blank lines, so only real code is compared. */
function squash(src: string): string {
  return src
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .join('\n');
}

// --- typechecking -----------------------------------------------------------

/** Symlink rather than copy — the tree is hundreds of megabytes, and both
 *  typecheckers only need to resolve a handful of packages out of it. `npx`
 *  also looks here for the pyright binary. */
function linkNodeModules(work: string): void {
  symlinkSync(resolve('node_modules'), join(work, 'node_modules'), 'dir');
}

const LANGUAGES: Language[] = [
  {
    name: 'TypeScript',
    doc: 'docs/typescript.md',
    fences: new Set(['typescript', 'ts']),
    dir: 'src',
    marker: '// ',
    implicit: /`(src\/[a-z-]+\.ts)`/g,
    extras: new Set(['src/models.ts']),
    owns: (f) => f.endsWith('.ts'),
    strip: stripTypeScript,
    seed(work) {
      cpSync('src', join(work, 'src'), { recursive: true });
      cpSync('tsconfig.json', join(work, 'tsconfig.json'));
      // package.json matters: "type": "module" is what makes top-level await
      // legal. Without it every file compiles as CommonJS and you get a wall
      // of TS1309.
      cpSync('package.json', join(work, 'package.json'));
      linkNodeModules(work);
    },
    check(work) {
      try {
        execFileSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
          cwd: work,
          stdio: 'pipe',
          encoding: 'utf8',
        });
        return [];
      } catch (err) {
        const out = (err as { stdout?: string }).stdout ?? String(err);
        return out
          .trim()
          .split('\n')
          .map((line) => {
            const m = line.match(/^(src\/[a-z-]+\.ts)\((\d+),\d+\)/);
            return {
              file: m ? m[1]! : '',
              line: m ? Number(m[2]) : 0,
              message: m ? line.replace(/^\S+\s/, '') : line,
            };
          });
      }
    },
  },
  {
    name: 'Python',
    doc: 'docs/python.md',
    fences: new Set(['python', 'py']),
    dir: 'pyweather',
    marker: '# ',
    implicit: /`(pyweather\/[a-z_]+\.py)`/g,
    // Nothing exempt: docs/python.md builds every file in pyweather/,
    // models.py included.
    extras: new Set<string>(),
    owns: (f) => f.endsWith('.py'),
    strip: stripPython,
    seed(work) {
      cpSync('pyweather', join(work, 'pyweather'), { recursive: true });
      // pyproject.toml carries [tool.pyright], including venvPath/venv, so
      // pyright resolves the SDK's type stubs out of the linked virtualenv.
      cpSync('pyproject.toml', join(work, 'pyproject.toml'));
      symlinkSync(resolve('.venv'), join(work, '.venv'), 'dir');
      linkNodeModules(work);
    },
    check(work) {
      let out: string;
      try {
        execFileSync('npx', ['pyright', '--outputjson'], {
          cwd: work,
          stdio: 'pipe',
          encoding: 'utf8',
        });
        return [];
      } catch (err) {
        out = (err as { stdout?: string }).stdout ?? String(err);
      }
      // --outputjson beats scraping the text output: pyright hands back exact
      // line numbers instead of a format we would have to re-parse whenever it
      // changes. Note the lines are 0-based here and 1-based in tsc.
      let parsed: {
        generalDiagnostics?: {
          file: string;
          severity: string;
          message: string;
          range?: { start: { line: number } };
        }[];
      };
      try {
        parsed = JSON.parse(out) as typeof parsed;
      } catch {
        return [{ file: '', line: 0, message: out.trim() }];
      }
      // realpathSync matters: on macOS mkdtempSync hands back /var/folders/...
      // while pyright reports the resolved /private/var/folders/... . Without
      // it, relative() produces a ../../.. path, the lookup into `versions`
      // misses, and a failing block reports a temp directory instead of the
      // document line — exactly when naming the line matters most.
      const root = realpathSync(work);
      return (parsed.generalDiagnostics ?? [])
        .filter((d) => d.severity === 'error')
        .map((d) => ({
          file: relative(root, d.file),
          line: (d.range?.start.line ?? 0) + 1,
          message: d.message.split('\n')[0]!,
        }));
    },
  },
];

/** Fence languages we knowingly ignore. Anything else is an error, so a new
 *  language cannot quietly appear and go unchecked. */
const IGNORED_FENCES = new Set(['json', 'powershell', 'bash', 'sh', 'toml', 'markdown', '']);

/** Fences belonging to a language that some OTHER document builds. These are
 *  quotations — docs/python.md shows the TypeScript it is comparing itself
 *  against — and they are checked where they are built, not here. Counted in
 *  the summary rather than silently dropped. */
const QUOTED_FENCES = new Set(LANGUAGES.flatMap((l) => [...l.fences]));

function bail(doc: string, line: number, message: string): never {
  console.error(`\n${doc}:${line}  ${message}\n`);
  process.exit(1);
}

// --- 0. structure: every Markdown file in the repo --------------------------
// Runs first and exits on failure. There is no point checking whether a
// document agrees with the code if the document itself is malformed — and a
// broken fence would make the block extraction below produce nonsense.
const MARKDOWN = [
  'README.md',
  'CLAUDE.md',
  ...readdirSync('docs')
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`),
];

const structural: string[] = [];

for (const file of MARKDOWN) {
  const lines = readFileSync(file, 'utf8').split('\n');

  // Fences must pair up. An odd count means the rest of the document is
  // rendering as code, or as prose, depending which way it fell.
  const fences = lines.filter((l) => l.trim().startsWith('```')).length;
  if (fences % 2 !== 0) {
    structural.push(`  ${file}: ${fences} code fences — an odd number, so one is unterminated.`);
  }

  lines.forEach((l, i) => {
    // Exactly two backticks at the start of a line is the signature of a
    // fence damaged by a careless find-and-replace. It is never valid here.
    if (/^``(?!`)/.test(l.trim())) {
      structural.push(`  ${file}:${i + 1}: line starts with two backticks — a broken \`\`\` fence.`);
    }
  });

  // Every relative link must resolve. Renaming a document is the common way
  // these break, and nothing else notices until a reader clicks.
  const dir = dirname(file);
  for (const m of readFileSync(file, 'utf8').matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1]!;
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = join(dir, target.split('#')[0]!);
    if (!existsSync(path)) {
      structural.push(`  ${file}: link to ${target} does not resolve (${path} is missing).`);
    }
  }
}

if (structural.length) {
  console.error(`\nstructure FAILED — ${structural.length} problem(s):\n`);
  console.error(structural.join('\n') + '\n');
  process.exit(1);
}
console.log(`structure: ${MARKDOWN.length} Markdown files — fences balanced, links resolve`);

let failures = 0;

for (const lang of LANGUAGES) {
  console.log(`\n--- ${lang.doc} → ${lang.dir}/ ---`);
  failures += verify(lang);
}

/** The four code-coupling gates, for one document and its source tree. */
function verify(lang: Language): number {
  const { doc: DOC, marker: M } = lang;

  // --- 1. extract and classify ----------------------------------------------
  const doc = readFileSync(DOC, 'utf8').split('\n');
  const blocks: Block[] = [];
  let quoted = 0;

  for (let i = 0; i < doc.length; i++) {
    const fence = doc[i]!.trim();
    if (!fence.startsWith('```')) continue;

    const lang_ = fence.slice(3).trim().toLowerCase();
    let end = i + 1;
    while (end < doc.length && doc[end]!.trim() !== '```') end++;

    if (!lang.fences.has(lang_)) {
      if (QUOTED_FENCES.has(lang_)) {
        quoted++;
      } else if (!IGNORED_FENCES.has(lang_)) {
        bail(
          DOC,
          i + 1,
          `unknown fence language \`${lang_}\`.\n` +
            `  Add it to this language's fences if it is code the reader types, or to\n` +
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

    if (first.startsWith(`${M}Illustrative —`)) {
      kind = 'illustrative';
    } else if (first.startsWith(`${M}Demo —`)) {
      kind = 'demo';
    } else if (first.startsWith(`${M}Edit — splice this into `)) {
      kind = 'edit';
      file = first.replace(`${M}Edit — splice this into `, '').replace(/;.*$/, '').trim();
    } else if (first.startsWith(`${M}Locate — find this in `)) {
      kind = 'locate';
      file = first.replace(`${M}Locate — find this in `, '').replace(/;.*$/, '').trim();
    } else if (first.startsWith(`${M}File — `)) {
      kind = 'file';
      file = first.replace(`${M}File — `, '').replace(/\s*\(.*$/, '').trim();
    } else {
      const context = doc.slice(Math.max(0, start - 12), start - 1).join('\n');
      const named = [...context.matchAll(lang.implicit)].pop();
      if (!named) {
        bail(
          DOC,
          start + 1,
          `block ${n} cannot be classified.\n` +
            `  No marker comment, and no \`${lang.dir}/\` filename in the prose above it.\n` +
            `  Add a marker as the block's first line, one of:\n` +
            `    ${M}Illustrative — showing a shape, not a file to create.\n` +
            `    ${M}Edit — splice this into ${lang.dir}/<file>; not a whole file.\n` +
            `    ${M}Locate — find this in ${lang.dir}/<file>; you are not changing it yet.\n` +
            `    ${M}File — ${lang.dir}/<file>\n` +
            `    ${M}Demo — complete, but never saved to a file.\n` +
            `  ...or name the file in the sentence that introduces the block.\n` +
            `  (The separator is an em dash, not a hyphen.)`,
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
  const earlyOf = new Map(
    [...byFile].filter(([, bs]) => bs.length > 1).map(([f, bs]) => [f, bs[0]!]),
  );

  console.log(
    `${DOC}: ${blocks.length} ${lang.name} blocks — ${fileBlocks.length} file listings ` +
      `(${finalOf.size} distinct, ${earlyOf.size} with earlier versions), ` +
      `${blocks.filter((b) => b.kind === 'edit').length} edits, ` +
      `${blocks.filter((b) => b.kind === 'locate').length} locators, ` +
      `${blocks.filter((b) => b.kind === 'illustrative').length} illustrative, ` +
      `${blocks.filter((b) => b.kind === 'demo').length} demo` +
      (quoted ? `, ${quoted} quoted from the other language (checked in its own document)` : ''),
  );

  // Every file the document claims to build must actually exist, or the diff
  // step below would crash with a bare ENOENT instead of saying what is wrong.
  for (const [f, b] of finalOf) {
    if (!existsSync(f)) {
      bail(DOC, b.line, `the document builds ${f}, but that file does not exist in ${lang.dir}/.`);
    }
  }

  let bad = 0;
  const work = mkdtempSync(join(tmpdir(), 'weatherwise-docs-'));

  try {
    // --- 2. rebuild the source tree from the document, then typecheck -------
    lang.seed(work);

    const compile = (label: string, versions: Map<string, Block>): void => {
      for (const [f, b] of versions) writeFileSync(join(work, f), b.code + '\n');
      const diagnostics = lang.check(work);
      if (diagnostics.length === 0) {
        console.log(`compile (${label}): typechecks`);
        return;
      }
      console.error(`\ncompile FAILED (${label}) — code in the document does not build:\n`);
      for (const d of diagnostics) {
        const b = versions.get(d.file);
        const at = b ? `${DOC}:${b.line + d.line - 1}` : d.file;
        console.error(at ? `  ${at}  ${d.message}` : `  ${d.message}`);
      }
      bad++;
    };

    compile('final versions', finalOf);

    if (earlyOf.size) {
      // The reader spends real time in these intermediate states. If an early
      // listing does not compile, they hit it long before the final one.
      const names = [...earlyOf.keys()].map((f) => f.replace(`${lang.dir}/`, '')).join(', ');
      compile(`earlier versions of ${names}`, earlyOf);
      for (const [f, b] of finalOf) writeFileSync(join(work, f), b.code + '\n'); // restore
    }

    // --- 3. an edit must actually change something --------------------------
    const redundant: string[] = [];
    for (const b of blocks.filter((x) => x.kind === 'edit')) {
      const base = finalOf.get(b.file!);
      if (!base) continue;
      const baseLines = new Set(lang.strip(base.code).split('\n').map((l) => l.trim()));
      const adds = lang
        .strip(b.code)
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
      console.error(
        `\nordering FAILED — ${redundant.length} edit(s) instruct a change already made:\n`,
      );
      console.error(redundant.join('\n\n') + '\n');
      bad++;
    } else {
      console.log('ordering: every edit block adds something its file does not already have');
    }

    // --- 4. diff the document's files against the real ones -----------------
    const editLines = new Map<string, Set<string>>();
    for (const b of blocks.filter((x) => x.kind === 'edit')) {
      const acc = editLines.get(b.file!) ?? new Set<string>();
      for (const l of lang.strip(b.code).split('\n')) acc.add(l.trim());
      editLines.set(b.file!, acc);
    }

    const drift: string[] = [];
    const staged: string[] = [];

    for (const [f, b] of finalOf) {
      const fromDoc = lang.strip(b.code);
      const fromSrc = lang.strip(readFileSync(f, 'utf8'));

      if (editLines.has(f)) {
        // Built in stages: this block is an early version the document later
        // edits, so check that every line the file has beyond it was
        // introduced by one of those edits rather than appearing from nowhere.
        const base = new Set(fromDoc.split('\n').map((l) => l.trim()));
        const edits = editLines.get(f)!;
        const unexplained = fromSrc
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !base.has(l) && !edits.has(l));
        if (unexplained.length) {
          drift.push(
            `  ${f} (built in stages)\n` +
              `    in ${lang.dir}/ but never introduced by the document:\n` +
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
      console.error(
        `\ndiff FAILED — ${drift.length} file(s) differ between the document and ${lang.dir}/:\n`,
      );
      console.error(drift.join('\n\n') + '\n');
      bad++;
    } else {
      console.log(`diff: ${finalOf.size - staged.length} file(s) match ${lang.dir}/ exactly`);
      if (staged.length) {
        console.log(
          `      ${staged.length} built in stages, every later line accounted for: ` +
            staged.map((f) => f.replace(`${lang.dir}/`, '')).join(', '),
        );
      }
    }

    // --- 5. nothing in the source tree is left unexplained ------------------
    const unbuilt = readdirSync(lang.dir)
      .filter(lang.owns)
      .map((f) => `${lang.dir}/${f}`)
      .filter((f) => !finalOf.has(f) && !lang.extras.has(f));

    if (unbuilt.length) {
      console.error(
        `\ncoverage FAILED — in ${lang.dir}/ but never built by the document:\n  ${unbuilt.join('\n  ')}\n`,
      );
      bad++;
    } else {
      console.log(
        `coverage: every file in ${lang.dir}/ is built by the document` +
          (lang.extras.size ? ` (except ${[...lang.extras].join(', ')}, a documented extra)` : ''),
      );
    }
  } finally {
    // In a finally block: an early failure used to leak a temp directory
    // holding a full copy of node_modules.
    rmSync(work, { recursive: true, force: true });
  }

  return bad;
}

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nall checks passed\n');
