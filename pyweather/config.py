"""Part 6 — Put the model ID in ONE constant so migrating is a one-line change.

Model IDs are pinned snapshots, even the dateless ones. They don't silently
upgrade under you.

The earlier files (main.py, chat.py, truncate.py) hardcode 'claude-sonnet-5'
on purpose — they exist to show one call. Everything from Part 8 on imports
MODEL from here instead.

Compare src/config.ts. That file is `export const MODEL = ...`; this one is a
bare module-level assignment. Python has no `export` keyword: every name in a
module is importable unless you prefix it with an underscore. Same outcome,
one less keyword.
"""

MODEL = "claude-sonnet-5"
