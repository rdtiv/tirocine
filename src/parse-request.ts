// Part 8 — Structured output: stop parsing prose.
//
// Run: npm run parse
//
// getWeather() takes a clean location string, but users type things like
// "do I need a jacket in Chicago this evening?". Something has to turn one
// into the other.
//
// messages.parse() + zodOutputFormat() gives you parsed_output that is already
// validated AND fully typed. No JSON.parse. No retry loop. No pleading with the
// prompt to "respond with valid JSON only."
//
// The rule: if you're about to write a regex to pull a decision out of model
// output, that decision should have been a schema.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { MODEL } from './config.js';

const client = new Anthropic();

const WeatherRequest = z.object({
  location: z.string(),
  units: z.enum(['fahrenheit', 'celsius']),
  intent: z.enum(['current_conditions', 'forecast', 'clothing_advice', 'other']),
});

export type WeatherRequest = z.infer<typeof WeatherRequest>;

const question = 'do I need a jacket in Chicago this evening?';

const message = await client.messages.parse({
  model: MODEL,
  max_tokens: 1024,
  system:
    'Extract the structured weather request. The location must be a plain ' +
    'city name suitable for a weather API lookup.',
  messages: [{ role: 'user', content: question }],
  output_config: { format: zodOutputFormat(WeatherRequest) },
});

// Refusals and truncation still break the shape. stop_reason of `refusal` or
// `max_tokens` returns something that won't match. That's what this guards.
if (message.parsed_output === null) {
  throw new Error(`No structured output (stop_reason: ${message.stop_reason})`);
}

const request: WeatherRequest = message.parsed_output;
console.log(JSON.stringify(request, null, 2));
// { "location": "Chicago", "units": "fahrenheit", "intent": "clothing_advice" }
