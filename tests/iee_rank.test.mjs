import assert from 'node:assert/strict';
import { getIEERank } from '../src/js/engine/thermo/ieeRank.js';

assert.equal(getIEERank(0.45), 'A');
assert.equal(getIEERank(0.55), 'B');
assert.equal(getIEERank(0.65), 'C');
assert.equal(getIEERank(0.75), 'D');
assert.equal(getIEERank(0.76), 'OUT OF RANKING');
assert.equal(getIEERank(0.85), 'OUT OF RANKING');
assert.equal(getIEERank(undefined), 'OUT OF RANKING');

console.log('IEE rank regression test passed');
