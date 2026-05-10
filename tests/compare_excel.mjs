// tests/compare_excel.mjs
import { buildDefaultConfig } from '../src/js/engine/thermo/index.js';
import { solveThermalSystem } from '../src/js/engine/thermo/solver.js';

const cfg = buildDefaultConfig();
const result = solveThermalSystem(cfg);

if (!result.converged) {
  console.error('Solver did not converge:', result.error);
  process.exit(1);
}

console.log('=== JavaScript Solver Results ===');
console.log(`TC:    ${result.TC.toFixed(4)} °C`);
console.log(`T2:    ${result.T2.toFixed(4)} °C`);
console.log(`PR:    ${result.PR.toFixed(6)}`);
console.log(`QF:    ${result.heatLoads.QF.toFixed(4)} kcal/h`);
console.log(`QR:    ${result.heatLoads.QR.toFixed(4)} kcal/h`);
console.log(`QEV:   ${result.heatLoads.QEV.toFixed(4)} kcal/h`);
console.log(`Qcomp: ${result.compressor.coolingCapacity.toFixed(4)} kcal/h`);
console.log(`W_in:  ${result.compressor.inputPower.toFixed(4)} W`);