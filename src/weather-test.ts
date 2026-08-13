// Part 7 — Try the weather client.
//
// Run: npm run weather
//
// Then change 'New York' to a location that doesn't exist — 'Xyzzyville' —
// and watch your error message fire. Good code fails clearly.

import { getWeather } from './weather.js';

const weather = await getWeather('New York');

// A sentence, not a data dump.
console.log(`${weather.location}: ${weather.temp_f}°F, ${weather.condition}`);

// Print raw objects while you're figuring out what's in them; print formatted
// strings once you know. The `2` means "indent each level by two spaces."
console.log(JSON.stringify(weather, null, 2));
