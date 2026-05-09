// tests/debug_solver.mjs
import { buildDefaultConfig } from '../src/js/engine/thermo/index.js';
import { createInnerSolver } from '../src/js/engine/thermo/solver.js';
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';

const defaultConfig = buildDefaultConfig();
const innerOptions = { dx: 0.001, tol: 1e-4, maxIter: 100 };
const innerSolver = createInnerSolver(
  defaultConfig.geom,
  defaultConfig.compParams,
  defaultConfig.refrigerant,
  defaultConfig.subcool,
  defaultConfig.fixedTemps,
  defaultConfig.fan,
  defaultConfig.electrical,
  innerOptions
);

// Try solving the inner loop for the initial TC guess (54.4)
console.log('TC initial:', 54.4);
const result = innerSolver(54.4);
console.log('Converged:', result.converged);
console.log('Iterations:', result.iterations);
console.log('T2:', result.T2, 'PR:', result.PR);
if (!result.converged) {
  console.log('Error:', result.error);
}