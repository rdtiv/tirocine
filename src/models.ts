// Bonus — not in the tutorial, but useful on day one.
//
// Run: npm run models
//
// Prints every model ID your API key can actually use, newest first. Use this
// to verify the IDs hardcoded in src/config.ts and src/bench.ts before you
// trust them.
//
// This is Part 6's lesson made executable: any document that hardcodes a value
// from a live service will eventually be wrong, including the tutorial and
// including this repo. Check the source, not the tutorial.

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

console.log('Model IDs available to your API key (newest first):\n');

for await (const model of client.models.list()) {
  console.log(`  ${model.id.padEnd(34)} ${model.display_name}`);
}

console.log(
  '\nIf an ID used in src/config.ts or src/bench.ts is missing from this list,\n' +
    'update it there — a wrong model ID fails with a 404 not_found_error.',
);
