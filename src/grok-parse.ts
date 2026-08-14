// Structured output: the same Zod schema, a different helper.
//
// Run: npm run grok:parse
//
// The schema is identical to src/parse-request.ts on purpose. The decision
// (location / units / intent) is not a Claude idea and not a Grok idea.
// What changes is the call: responses.parse() + zodTextFormat(), and the
// field is `output_parsed` rather than `parsed_output`.

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { MODEL } from './grok-config.js';
import { logGrokCall } from './grok-usage.js';
import { textFrom } from './grok-text.js';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

const WeatherRequest = z.object({
  location: z.string(),
  units: z.enum(['fahrenheit', 'celsius']),
  intent: z.enum(['current_conditions', 'forecast', 'clothing_advice', 'other']),
});

export type WeatherRequest = z.infer<typeof WeatherRequest>;

const question = 'do I need a jacket in Chicago this evening?';

const response = await client.responses.parse({
  model: MODEL,
  input: question,
  store: false,
  instructions:
    'Extract the structured weather request. The location must be a plain ' +
    'city name suitable for a weather API lookup.',
  text: { format: zodTextFormat(WeatherRequest, 'weather_request') },
});

if (!response.usage) throw new Error('No usage on response');
logGrokCall('grok-parse', MODEL, question, {
  id: response.id,
  usage: response.usage,
  status: response.status,
  reply: textFrom(response),
});

// Refusals and incomplete turns still break the shape. That's what this guards.
if (response.output_parsed === null) {
  throw new Error(`No structured output (status: ${response.status})`);
}

const request: WeatherRequest = response.output_parsed;
console.log(JSON.stringify(request, null, 2));
// { "location": "Chicago", "units": "fahrenheit", "intent": "clothing_advice" }
