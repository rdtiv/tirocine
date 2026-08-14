# Weatherwise Setup — macOS

> **The weatherwise series**
> 1. Setup — [Windows](setup-windows.md) · **macOS** *(you are here)*
> 2. [The TypeScript build](typescript.md) — the assistant, start to finish
> 3. [The Grok transfer](grok.md) — the same assistant against xAI
> 4. [The Python build](python.md) — the same program again, to see which ideas were real
> 5. [The app](app.md) — lifting it onto the web with Next.js, the AI SDK, and Vercel

**Who this is for:** your first real project as a developer. You're on a Mac, you have Claude Code and Cursor, and you have not shipped code before.

**What this covers:** getting the machine ready — a terminal, Node, Git, GitHub, Claude Code, Cursor, and your API key. Nothing here is about Claude yet. Budget about 40 minutes.

**When you're done,** go to [the TypeScript build](typescript.md). That document is the tutorial; this one just gets you to the starting line.

---

# Part 0 — Setting up your Mac

## 0.1 The Terminal

Open **Terminal** (`Cmd+Space`, type "Terminal", Enter). This is a text interface to your computer. You type a command, press Enter, it runs. You'll replace it with a better one in §0.3, but it's what every Mac ships with, so start here.

Four commands do 90% of the work:

```bash
pwd        # print working directory — where am I?
ls         # list — what's in here?
cd folder  # change directory — go into "folder"
cd ..      # go up one level
```

Try them. Nothing you type here can break your Mac. If you get lost, `cd ~` returns you home.

> The `$` at the start of a line in a tutorial means "this is a terminal command" — don't type that character.

## 0.2 Homebrew

macOS doesn't ship with developer tools. **Homebrew** installs them.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It asks for your Mac password (nothing appears as you type — that's normal) and may print one or two extra commands to run at the end so Homebrew lands on your `PATH`. Do exactly what it says. Then:

```bash
brew --version
```

> **`PATH`** is the list of folders your terminal searches when you type a command. "command not found" almost always means something installed fine but isn't on your `PATH` yet. Closing and reopening the terminal fixes it about half the time.

## 0.3 Ghostty

Apple's Terminal works, but you're going to live in this window for years. Ghostty is a modern terminal — GPU-accelerated, so scrolling through long output stays smooth, with native tabs and split panes.

```bash
brew install --cask ghostty
```

Open it from Applications (or `Cmd+Space` → "Ghostty"). **Do the rest of this guide in Ghostty, not Terminal.** Then drag it to your Dock, because you'll open it constantly.

Three things worth knowing on day one:

- `Cmd+T` new tab, `Cmd+D` split right, `Cmd+Shift+D` split down
- `Cmd+F` searches your scrollback — you will want this the first time an error scrolls past
- Configuration is a plain text file at `~/.config/ghostty/config`. It won't exist until you create it.

Make one small change now, so you know how:

```bash
mkdir -p ~/.config/ghostty
echo "font-size = 15" >> ~/.config/ghostty/config
```

Reload with `Cmd+Shift+,`. If the text got bigger, you just configured a program by editing a text file — which is how most developer tools are configured.

> Ghostty runs on macOS and Linux only. There's no Windows build, which is why the Windows edition of this setup uses Windows Terminal instead.

## 0.4 Node.js, jq, and the GitHub CLI

Node is the runtime that executes JavaScript and TypeScript outside a browser. `jq` is a small tool that makes JSON readable — you'll want it in Part 7. `gh` is GitHub's command-line tool, which you'll use in §0.5.

```bash
brew install node jq gh
node --version    # first number must be 22 or higher
npm --version
git --version
```

`npm` came with Node. It installs code libraries other people wrote. Git is already on your Mac.

> **Why 22.** One Node on this machine runs every script in the project — Claude and Grok. `--env-file` arrived in 20.6, but the `openai` package the Grok chapter uses requires 22, so 22 is the floor. If `node --version` prints `v20` or older, run `brew upgrade node`, open a new terminal, and check again.

## 0.5 Git and GitHub

**Git** tracks changes to your code on your machine. **GitHub** stores a copy online. They're separate things that work together, and it's worth keeping that distinction straight from the start: Git is the tool, GitHub is the website.

### Create a GitHub account

Go to [github.com/signup](https://github.com/signup).

Two decisions worth thinking about for thirty seconds rather than zero:

- **Your username is public and semi-permanent.** It shows up on everything you ever build. Pick something you'd be comfortable putting on a résumé — some version of your actual name is the safest choice.
- **Use an email you'll keep.** Not a school or current-employer address.

GitHub requires **two-factor authentication** for accounts that contribute code, so you'll be prompted to set it up. Use an authenticator app on your phone rather than SMS. Save the recovery codes it gives you somewhere real — losing access to your own account is a genuinely miserable afternoon.

### Tell Git who you are

Git stamps your name and email on every commit. Without this, your first commit fails with `Author identity unknown`:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

Use the same email as your GitHub account so your commits are linked to it.

> That third line sets the default name of your main line of development to `main`. Older Git used `master`. You'll see both in the wild; `main` is the current convention.

### Connect the CLI to your account

```bash
gh auth login
```

Answer the prompts: **GitHub.com** → **HTTPS** → **Yes**, authenticate Git with your GitHub credentials → **Login with a web browser**. It shows you a one-time code, opens your browser, and you paste the code in.

Verify:

```bash
gh auth status
```

You should see your username and a confirmation that Git operations are configured. That's it — no SSH keys, no personal access tokens, no password prompts on every push. `gh` handled all of it.

## 0.6 Claude Code

Claude Code is Anthropic's coding agent. It runs in your terminal, reads your whole project, and writes and edits files across it.

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Restart your terminal, then:

```bash
claude --version
claude doctor      # diagnoses install, auth, and config problems
```

Claude Code needs a paid account (Pro, Max, Team, Enterprise, or a Console account). The free claude.ai tier doesn't include it. The first `claude` run opens a browser to log you in.

> Requires macOS 13.0 or later. Run `claude doctor` first whenever something feels wrong — before you start searching error messages.

## 0.7 Cursor

Cursor is the editor where you'll read and write files. Download from [cursor.com](https://cursor.com) and drag it to Applications.

Turn on two things day one:

- **Show whitespace / indent guides** — indentation carries meaning.
- **Format on save** — the editor fixes spacing so you never think about it.

**Claude Code and Cursor aren't competitors here.** Cursor is where you read, think, and make small edits. Claude Code is where you delegate larger multi-file work. You'll have both open: Cursor showing the project, a terminal running `claude`.

## 0.8 Create the project

> **You're going to build this yourself, file by file — and that's deliberate.**
> Part 1 of the walkthrough explains why typing beats pasting, and it is the
> single most important habit in this whole guide.
>
> The finished version of everything you're about to write lives at
> [github.com/rdtiv/tirocine](https://github.com/rdtiv/tirocine). It's there for
> two things: to compare against when something won't work, and to read
> afterwards. **Don't clone it into the folder you're about to create** — if you
> want a copy to look at, put it somewhere separate, like `~/dev/tirocine` next to your
> own `~/dev/weatherwise`.


Every project you ever build goes in one place: `~/dev`. Not Desktop, not Documents — both of those are usually synced to iCloud, and a sync service reaching into a live `node_modules` folder or a `.git` directory causes strange, hard-to-diagnose breakage. `~/dev` is short to type, out of the way of sync, and means you always know where your code is.

```bash
mkdir -p ~/dev
cd ~/dev
mkdir weatherwise
cd weatherwise

npm init -y
npm install @anthropic-ai/sdk zod
npm install -D typescript tsx @types/node
```

| Package | What it does |
|---|---|
| `@anthropic-ai/sdk` | Talks to the Claude API |
| `zod` | Describes and validates data shapes |
| `typescript` | Adds types to JavaScript |
| `tsx` | Runs TypeScript files directly |
| `@types/node` | Type definitions for Node's built-ins |

`-D` means "development only" — needed to build, not to run in production.

> **Zod must be version 4.** The command above installs the current version, so a fresh folder is fine. But if you're adding this to an existing project that already has Zod 3, Part 8 will fail with `Cannot find module 'zod'` — because the SDK's schema helper imports from `zod/v4` internally. Check with `npm ls zod`; if it says 3.x, run `npm install zod@4`.

Open it in Cursor:

```bash
cursor .
```

(If `cursor` isn't found: open Cursor, press `Cmd+Shift+P`, run "Install 'cursor' command".)

### Config files

**Type these; don't paste.** Muscle memory matters more than you'd think right now.

Edit `package.json` so it includes `"type": "module"` and two scripts:

```json
{
  "name": "weatherwise",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx --env-file=.env src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

> `"type": "module"` opts into modern JavaScript modules. Without it, `import` fails and top-level `await` doesn't work. It's the most common first-day error.

> **`typecheck` is the one you'll forget, and it's the one that matters.** `tsx` doesn't check types — it strips them out and runs the JavaScript underneath. So a file with a genuine type error still runs, and Cursor's red squiggle is the *only* warning you get. `npm run typecheck` runs the real TypeScript compiler over every file in `src/` and prints nothing when all is well. Run it after any edit. It needs no API key and costs nothing.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

> `"strict": true` makes TypeScript nag you more. Keep it on. Every complaint now is a crash prevented later.
>
> `"include": ["src"]` says your code lives in a folder called `src`. Create it now — right-click the project in Cursor → New Folder → `src`. Every file you write from Part 2 onward goes in there.

`.gitignore`:

```
node_modules/
.env
.DS_Store
```

> **Seeing dotfiles on a Mac.** Files starting with a dot are hidden in Finder. Press `Cmd+Shift+.` to toggle them on and off. Cursor shows them regardless, which is the easier place to work.
>
> `.DS_Store` is a file macOS silently drops into every folder you open in Finder. It has no business in a repository, and it's in the list above so it never reaches one.

## 0.9 Your Claude API key

Claude Code's subscription is separate from **API** access. Your program needs its own key.

1. Go to [platform.claude.com](https://platform.claude.com) and sign in.
2. **Settings → API Keys → Create Key.**
3. Copy it. You won't be shown it again.
4. Add about $5 of credit. Far more than this tutorial costs.
5. **Set a spend limit.** In the Console, under billing, cap your monthly usage — $10 is plenty. Do this before you write a line of code.

That last step matters more than it sounds. A loop with a mistake in it can call the API thousands of times in a minute, and you will write a loop with a mistake in it, because everyone does. A spend limit turns "expensive lesson" into "the program stopped." It is the cheapest insurance in software.

Create `.env` in Cursor:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

`XAI_API_KEY` is optional. You only need it later, for [the Grok transfer](grok.md). Get one at [console.x.ai](https://console.x.ai) and add `XAI_API_KEY=...` to `.env` when you get there.

**An API key is a password that spends money.** Three rules, and rule 3 is the one people break:

1. Never paste it into a chat, a screenshot, or a Slack message.
2. Never put it directly in a code file.
3. Never let it reach GitHub. Bots scrape public repos for keys within minutes.

That's what `.gitignore` is for. Verify it worked:

```bash
git init
git add .
git status
```

**Read that output. This is the most important thirty seconds of the setup.** Everything listed there is about to be uploaded to GitHub. If `.env` appears, your `.gitignore` is wrong — fix it before going a single step further. If it doesn't:

```bash
git commit -m "Project setup"
```

### Put it on GitHub — privately

```bash
gh repo create weatherwise --private --source=. --remote=origin --push
```

One command does four things: creates the repository on GitHub, marks it **private**, points your local folder at it, and uploads what you've committed. Open it:

```bash
gh repo view --web
```

You should see your project — and no `.env` file. If you do see one, stop and come back to `.gitignore`.

> **Why private.** A public repo means anyone can read every file and every past version. Private is the right default for anything you're learning on, and always the right default for anything touching an API key. You can flip a repo to public later; you cannot un-publish something a scraper already copied.
>
> **Why "committed" and "pushed" are different.** `git commit` saves a snapshot on your machine. `git push` uploads it. Work isn't backed up until you push — a committed-but-unpushed project dies with your laptop. From here on, the rhythm is: `git add .` → `git commit -m "..."` → `git push`.

> **Debugging tip for later:** `.env` is read at runtime by Node, because of the `--env-file` flag in your npm scripts. It is *not* loaded into your shell, so `echo $ANTHROPIC_API_KEY` will normally print **nothing** — that's expected and does not mean anything is broken. Use it only to check for a shell-level `export`. To see what your script sees, add a temporary `console.log(process.env.ANTHROPIC_API_KEY?.slice(0, 8))` inside the script itself.

## 0.10 Point Claude Code at the project

From the project folder:

```bash
claude
```

Then inside the session:

```
/init
```

That writes `CLAUDE.md`, which Claude Code reads at the start of every future session so it knows your conventions without being told. Open it in Cursor and add a few lines of your own:

```markdown
## Conventions
- TypeScript, ESM, strict mode
- Never log or print API keys
- Every Claude API call must log token usage
```

---

Setup done. Everything from here is the same on every platform — go to **[the TypeScript build](typescript.md)** and start with Part 1.
