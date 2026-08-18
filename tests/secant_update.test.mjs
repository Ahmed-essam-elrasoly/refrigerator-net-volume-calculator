import assert from 'node:assert/strict';
import { updateTEWithSecant } from '../src/js/engine/thermo/solver.js';

const case1 = updateTEWithSecant(10, 2, 8, 1);
assert.equal(case1.nextTE, 7);
assert.equal(case1.prevTE, 10);
assert.equal(case1.prevError, 2);

const fallback = updateTEWithSecant(10, 2, undefined, undefined);
assert.ok(Math.abs(fallback.nextTE - 11) < 1e-9);

console.log('secant update regression test passed');
