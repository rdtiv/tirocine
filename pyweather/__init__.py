"""Part 1 — The package file TypeScript doesn't have.

`src/` is a folder. `pyweather/` is a *package*, and this file is what makes it
one. Python runs `__init__.py` once, before any module inside the package is
imported. That gives us exactly one place to do setup that every lesson needs.

There is one such thing: loading `.env`.

The TypeScript side does this in package.json, per script:

    "agent": "tsx --env-file=.env src/agent.ts"

Thirteen scripts, twelve copies of `--env-file=.env` — `usage` is the one
exception, since it only reads a CSV and never calls Claude, so it has
nothing to load a key for. Python does it once, here, and every lesson
inherits it. Neither is better; they're the same idea (read the keys before
the program starts) placed at different layers.

`find_dotenv()` walks up from this file until it finds a `.env`, so it locates
the repo root's `.env` no matter which directory you run from.
"""

from dotenv import load_dotenv

load_dotenv()
