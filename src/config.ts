// Part 6 — Put the model ID in ONE constant so migrating is a one-line change.
//
// Model IDs are pinned snapshots, even the dateless ones. They don't silently
// upgrade under you.
//
// The earlier files (index.ts, chat.ts, truncate.ts) hardcode 'claude-sonnet-5'
// on purpose — they exist to show one call. Everything from Part 8 on imports
// MODEL from here instead.

export const MODEL = 'claude-sonnet-5';
