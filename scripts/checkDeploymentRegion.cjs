const assert = require('node:assert/strict');
assert.ok(process.env.GAME_FUNCTION_REGION, 'Set GAME_FUNCTION_REGION to the deployment region');
const functions = require('../functions/lib/index.cjs');
const endpoints = Object.values(functions).filter(fn => fn.__endpoint);
assert.equal(endpoints.length, 11);
for (const fn of endpoints) {
  assert.equal(fn.__endpoint.region.name, 'GAME_FUNCTION_REGION');
  assert.equal(fn.__endpoint.region.value(), process.env.GAME_FUNCTION_REGION);
}
console.log(`PASS eleven deployment regions: ${process.env.GAME_FUNCTION_REGION}`);
