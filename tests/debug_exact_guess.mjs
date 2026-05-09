// tests/debug_exact_guess.mjs
import { buildDefaultConfig } from '../src/js/engine/thermo/index.js';
import { createInnerSolver } from '../src/js/engine/thermo/solver.js';

const cfg = buildDefaultConfig();
const innerSolver = createInnerSolver(
  cfg.geom, cfg.compParams, cfg.refrigerant, cfg.subcool,
  cfg.fixedTemps, cfg.fan, cfg.electrical, { dx: 0.001, tol: 1e-4, maxIter: 100 }
);

const TC = 54.4;
const result = innerSolver(TC, [-21.2483006297973, 0.5905646101665666]);

console.log('Converged:', result.converged);
console.log('Iterations:', result.iterations);
console.log('T2:', result.T2, 'PR:', result.PR);
if (!result.converged) console.log('Error:', result.error);