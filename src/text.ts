// Part 3 — The response, and the array that trips everyone.
//
// `content` is an ARRAY, not a string. One response can hold a text block,
// several tool-use blocks, and thinking blocks. `message.content[0].text`
// works fine today and throws the first time Claude calls a tool.
//
// Write the helper once, use it everywhere.

import type Anthropic from '@anthropic-ai/sdk';

export function textFrom(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
