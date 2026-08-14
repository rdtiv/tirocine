// Bonus — not in the transfer document, but useful on day one.
//
// Run: npm run grok:models
//
// Prints every model ID your xAI key can actually use. Use this to verify
// the ID hardcoded in src/grok-config.ts before you trust it.
//
// Same lesson as src/models.ts: any document that hardcodes a value from a
// live service will eventually be wrong. Check the source, not the tutorial.

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

console.log('Model IDs available to your xAI key:\n');

for await (const model of client.models.list()) {
  console.log(`  ${model.id}`);
}

console.log(
  '\nIf grok-4.6 is missing from this list, update src/grok-config.ts —\n' +
    'a wrong model ID fails with a 404, same as on the Claude side.',
);
