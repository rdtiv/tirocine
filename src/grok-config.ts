// Put the model ID in ONE constant so migrating is a one-line change.
//
// grok-index.ts and grok-chat.ts hardcode 'grok-4.6' on purpose — they exist
// to show one call. Everything from grok-parse.ts on imports MODEL from here.

export const MODEL = 'grok-4.6';
