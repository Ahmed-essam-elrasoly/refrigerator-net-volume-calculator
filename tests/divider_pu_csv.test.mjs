import assert from 'node:assert/strict';
import { resultToCSV } from '../src/js/io/io.js';

const cachedState = {
  config: {
    cabinet: {
      geometry: {
        H: 500,
        W: 600,
        D: 600,
        Hb: 0,
        Db1: 0,
        Db2: 0,
        dividerThickness: 50,
        dividerHasPU: true,
        dividerPUPct: 85,
        _compartments: [
          { type: 'freezer', height: 250, left: 20, right: 20, rear: 30, door: 40, top: 0, shelfCount: 0 },
          { type: 'fresh', height: 250, left: 20, right: 20, rear: 30, door: 35, top: 250, shelfCount: 0 }
        ],
        obstacles: {},
        walls: {
          freezer: { left: 40, right: 40, rear: 40, bottom1: 40, bottom2: 40, bottom3: 40 },
          refrigerator: { left: 40, right: 40, rear: 40, bottom1: 40, bottom2: 40, bottom3: 40 }
        }
      }
    }
  },
  volumes: {
    leaves: [
      { id: 'f1', gross: 10 },
      { id: 'r1', gross: 20 }
    ]
  },
  thermal: { results: {}, energy: {} }
};

const csv = resultToCSV(cachedState, 'dividerPU');
assert.match(csv, /Estimated Cabinet PU Volume,163\.57/);
console.log('dividerPU CSV regression test passed');
