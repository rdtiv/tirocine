// The response, and the array that trips everyone — Grok edition.
//
// `output` is an ARRAY, not a string. A text turn is [reasoning, message].
// A tool turn is [reasoning, function_call] — no message. Verified 2026-08-14
// against grok-4.6: `output_text` is set on a text turn and empty on a
// function_call turn. Indexing output[0] or trusting output_text both break
// the first time the model calls a tool.
//
// Walk the array. Write the helper once, use it everywhere.

import type { Response } from 'openai/resources/responses/responses';

export function textFrom(response: Response): string {
  const parts: string[] = [];
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type === 'output_text') parts.push(part.text);
    }
  }
  return parts.join('\n');
}
