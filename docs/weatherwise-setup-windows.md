# Weatherwise Setup — Windows

> **The weatherwise series**
> 1. Setup — [Windows](weatherwise-setup-windows.md) · [macOS](weatherwise-setup-mac.md)
> 2. [The TypeScript build](weatherwise-typescript.md) — the assistant, start to finish
> 3. [The Python build](weatherwise-python.md) — the same program again, to see which ideas were real
> 4. [The app](weatherwise-app.md) — lifting it onto the web with Next.js, the AI SDK, and Vercel

**Who this is for:** your first real project as a developer. You're on Windows 10 or 11, you have Claude Code and Cursor, and you have not shipped code before.

**What this covers:** getting the machine ready — a terminal, Node, Git, GitHub, Claude Code, Cursor, and the two API keys. Nothing here is about Claude yet. Budget about 40 minutes.

**When you're done,** go to [the TypeScript build](weatherwise-typescript.md).

> **A note on the machine.** Everything in this guide works on Windows, and you should not wait for different hardware to start. But it's worth knowing the landscape: most AI development tooling ships on macOS several months before Windows, and nearly every tutorial and video you'll find was recorded on a Mac. You will occasionally hit a step where your screen doesn't match what you're watching. That's the environment, not you. If a Mac is ever an option, take it — but don't let its absence stop you today.

---

# Part 0 — Setting up Windows

## 0.1 Windows Terminal

Press the **Start** button and type "Terminal". On Windows 11 it's already installed. On Windows 10 you may need it from the Microsoft Store, or run this in PowerShell:

```powershell
winget install --id Microsoft.WindowsTerminal --exact
```

Open it. You get a **PowerShell** prompt — a text interface to your computer. You type a command, press Enter, it runs.

Four commands do 90% of the work:

```powershell
pwd        # print working directory — where am I?
ls         # list — what's in here?
cd folder  # change directory — go into "folder"
cd ..      # go up one level
```

Try them. Nothing here can break your PC. If you get lost, `cd ~` returns you to your user folder.

Two shortcuts you'll want immediately: `Ctrl+Shift+T` opens a new tab, and `Alt+Shift+Plus` splits the window. Pin Terminal to your taskbar — you'll open it constantly.

> **Why not Ghostty?** If you've seen Ghostty recommended, it's a very good terminal — but it only builds for macOS and Linux. There's no Windows version. Windows Terminal is the right answer here, and it's genuinely good. If you ever move to a Mac, install Ghostty then.

> On Windows, tutorials write `PS>` or `>` at the start of a command line. Don't type that part.

## 0.2 winget

`winget` is Windows' package manager — it installs developer tools from the command line instead of hunting for installers. It ships with Windows 11 and recent Windows 10. Check:

```powershell
winget --version
```

If that fails, install "App Installer" from the Microsoft Store, then reopen Terminal.

> **`PATH`** is the list of folders your terminal searches when you type a command. "The term ... is not recognized" almost always means something installed fine but isn't on your `PATH` yet. **Closing and reopening Terminal fixes this most of the time** — winget updates `PATH`, but only new windows pick up the change. Get in the habit: install something, close the window, open a new one.

## 0.3 Node, Git, jq, and the GitHub CLI

Node is the runtime that executes JavaScript and TypeScript outside a browser. Git tracks changes to your code. `jq` makes JSON readable — you'll want it in Part 7. `gh` is GitHub's command-line tool, used in §0.5.

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Git.Git --exact
winget install --id jqlang.jq --exact
winget install --id GitHub.cli --exact
```

**Close Terminal and open a new one**, then verify:

```powershell
node --version    # need v20.6 or later (that's when --env-file arrived); v22 is what this guide uses
npm --version
git --version
jq --version
gh --version
```

`npm` came with Node. It installs code libraries other people wrote.

Git for Windows also installs **Git Bash**, a second terminal that understands Mac and Linux commands. You don't need it for this project, but Claude Code uses it internally, which is why we installed Git before Claude Code rather than after.

## 0.4 Configure Git

Windows and Mac/Linux end lines of text differently — an invisible difference that makes Git report entire files as changed when nothing meaningful did. One command, once, forever:

```powershell
git config --global core.autocrlf true
```

Git also stamps your name and email on every change you save. Without these, your first commit fails with `Author identity unknown`:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

> That last line sets the default name of your main line of development to `main`. Older Git used `master`. You'll see both in the wild; `main` is the current convention.

## 0.5 GitHub

**Git** tracks changes to your code on your machine. **GitHub** stores a copy online. They're separate things that work together, and it's worth keeping that distinction straight from the start: Git is the tool, GitHub is the website.

### Create a GitHub account

Go to [github.com/signup](https://github.com/signup).

Two decisions worth thinking about for thirty seconds rather than zero:

- **Your username is public and semi-permanent.** It shows up on everything you ever build. Pick something you'd be comfortable putting on a résumé — some version of your actual name is the safest choice.
- **Use an email you'll keep.** Not a school or current-employer address.

Use the same email you just put in `git config`, so your commits link to your account.

GitHub requires **two-factor authentication** for accounts that contribute code, so you'll be prompted to set it up. Use an authenticator app on your phone rather than SMS. Save the recovery codes it gives you somewhere real — losing access to your own account is a genuinely miserable afternoon.

### Connect the CLI to your account

```powershell
gh auth login
```

Answer the prompts: **GitHub.com** → **HTTPS** → **Yes**, authenticate Git with your GitHub credentials → **Login with a web browser**. It shows you a one-time code, opens your browser, and you paste the code in.

Verify:

```powershell
gh auth status
```

You should see your username and a confirmation that Git operations are configured. That's it — no SSH keys, no personal access tokens, no Windows credential-manager popups on every push. `gh` handled all of it.

## 0.6 Claude Code

Claude Code is Anthropic's coding agent. It runs in your terminal, reads your whole project, and writes and edits files across it.

```powershell
irm https://claude.ai/install.ps1 | iex
```

**Close Terminal and open a new one**, then:

```powershell
claude --version
claude doctor      # diagnoses install, auth, and config problems
```

Claude Code needs a paid account (Pro, Max, Team, Enterprise, or a Console account). The free claude.ai tier doesn't include it. The first `claude` run opens a browser to log you in.

> If you see `'irm' is not recognized`, you're in Command Prompt rather than PowerShell. Your prompt shows `PS C:\` in PowerShell and `C:\` without the `PS` in Command Prompt. Open a PowerShell tab and try again.

> Run `claude doctor` first whenever something feels wrong — before you start searching error messages.

## 0.7 Cursor

Cursor is the editor where you'll read and write files.

```powershell
winget install --id Anysphere.Cursor --exact
```

Turn on two things day one:

- **Show whitespace / indent guides** — indentation carries meaning.
- **Format on save** — the editor fixes spacing so you never think about it.

**Cursor and Claude Code aren't competitors here.** Cursor is where you read, think, and make small edits. Claude Code is where you delegate larger multi-file work. You'll have both open: Cursor showing the project, a Terminal tab running `claude`.

## 0.8 Should you use WSL?

You'll see WSL — Windows Subsystem for Linux — recommended constantly. It runs a real Linux system inside Windows.

**Skip it for this project.** Here's the honest tradeoff.

WSL matters when you need Linux-only tooling, Docker, or an environment matching a Linux production server. This project needs none of that: Node, Git, Cursor, and Claude Code all run natively on Windows, and everything you write here behaves identically either way.

What WSL costs you is real, especially on day one. You end up with **two of everything** — two filesystems, two copies of Node, two places a file could be, two places your API key could be sitting. Files on the Windows side are slow to access from the Linux side. For someone with no software experience, that's a second hard problem stacked on top of the one you're actually trying to learn.

Learn Windows-native first. Add WSL later, deliberately, when you hit a specific thing that needs it. You'll understand what it's solving by then.

## 0.9 Create the project

Every project you ever build goes in one place: `C:\dev`, straight off the drive root. Three reasons, and all three will bite you otherwise:

- **Short paths.** Windows has a 260-character limit on file paths. `node_modules` nests deeply, and a project buried under `C:\Users\YourName\Documents\...` can blow past that limit and produce install errors that look like nothing else. `C:\dev\weatherwise` leaves you plenty of room.
- **No OneDrive.** Desktop and Documents are usually synced to OneDrive. A sync service reaching into a live `node_modules` folder or a `.git` directory causes strange, hard-to-diagnose breakage.
- **No spaces.** Usernames with spaces in them break a surprising number of command-line tools.

```powershell
mkdir C:\dev -Force
cd C:\dev
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

```powershell
cursor .
```

(If `cursor` isn't found: close and reopen Terminal. Still not found — open Cursor from Start, press `Ctrl+Shift+P`, run "Install 'cursor' command".)

> **Windows paths use backslashes** — `C:\dev\weatherwise`. Your *code* will use forward slashes anyway (`./text.js`), because that's what JavaScript uses on every platform. Node translates. Don't try to make code paths match what File Explorer shows you.

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
```

> **Creating a dotfile on Windows.** Files starting with a dot confuse File Explorer, and Notepad will silently save `.gitignore` as `.gitignore.txt`. Create these **inside Cursor** (right-click the project → New File), which handles them correctly. If you must use the terminal: `New-Item .gitignore`.

## 0.10 Your Claude API key

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

**An API key is a password that spends money.** Three rules, and rule 3 is the one people break:

1. Never paste it into a chat, a screenshot, or a Slack message.
2. Never put it directly in a code file.
3. Never let it reach GitHub. Bots scrape public repos for keys within minutes.

That's what `.gitignore` is for. Verify it worked:

```powershell
git init
git add .
git status
```

**Read that output. This is the most important thirty seconds of the setup.** Everything listed there is about to be uploaded to GitHub. If `.env` appears, your `.gitignore` is wrong — check it isn't actually named `.gitignore.txt`, which is the usual cause on Windows. If it doesn't appear:

```powershell
git commit -m "Project setup"
```

### Put it on GitHub — privately

```powershell
gh repo create weatherwise --private --source=. --remote=origin --push
```

One command does four things: creates the repository on GitHub, marks it **private**, points your local folder at it, and uploads what you've committed. Open it:

```powershell
gh repo view --web
```

You should see your project — and no `.env` file. If you do see one, stop and come back to `.gitignore`.

> **Why private.** A public repo means anyone can read every file and every past version. Private is the right default for anything you're learning on, and always the right default for anything touching an API key. You can flip a repo to public later; you cannot un-publish something a scraper already copied.
>
> **Why "committed" and "pushed" are different.** `git commit` saves a snapshot on your machine. `git push` uploads it. Work isn't backed up until you push — a committed-but-unpushed project dies with your PC. From here on, the rhythm is: `git add .` → `git commit -m "..."` → `git push`.

> **Debugging tip for later:** `.env` is read at runtime by **Node**, because of the `--env-file` flag in your npm script — `tsx` just passes the flag along. It is not loaded into your PowerShell session, so `$env:ANTHROPIC_API_KEY` will normally return **nothing** — that's expected and does not mean anything is broken. Use `$env:ANTHROPIC_API_KEY` only to check for a shell- or system-level export (`setx` or the Windows env-var UI). To verify what your script sees, add a temporary `console.log(process.env.ANTHROPIC_API_KEY?.slice(0, 8))` inside the script itself.

## 0.11 Point Claude Code at the project

From the project folder:

```powershell
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
- Windows / PowerShell — use curl.exe, not curl
- Never log or print API keys
- Every Claude API call must log token usage
```

That second line will save you real time. Claude Code defaults to Mac and Linux habits unless you tell it otherwise.

---
