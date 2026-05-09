// tests/debug_root.mjs
import { buildDefaultConfig } from '../src/js/engine/thermo/index.js';
import { createInnerSolver } from '../src/js/engine/thermo/solver.js';

const cfg = buildDefaultConfig();
const innerSolver = createInnerSolver(
  cfg.geom, cfg.compParams, cfg.refrigerant, cfg.subcool,
  cfg.fixedTemps, cfg.fan, cfg.electrical, { dx: 0.001, tol: 1e-15, maxIter: 1 }
);

const TC = 54.4;
// Trick: run a single iteration and capture the initial function values
// We'll manually compute F1, F2 using the inner function's code snippet:
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

const { T0, TF, TR } = cfg.fixedTemps;
const T2 = -21.2483006297973;
const PR = 0.5905646101665666;
const rho = PHYSICAL_CONSTANTS.air.density;
const cp = PHYSICAL_CONSTANTS.air.cp;

const temps = { T0, TF, TR, T2, TC, PR };
const loads = calcHeatLoads(cfg.geom, temps, cfg.electrical);
const comp = compressorState(TC, T2, cfg.refrigerant, cfg.compParams, cfg.subcool);
const Qtotal = loads.QF + loads.QR + loads.QEV;
const F2 = Qtotal - comp.coolingCapacity * PR;

const denom = cfg.fan.totalAirflow * rho * cp * PR;
let F1;
if (denom < 1e-9) {
  F1 = loads.QF;
} else {
  const T3 = T2 + loads.QEV / denom;
  const MR = (Math.abs(TR - T3) < 1e-9) ? 0 : loads.QR / (rho * cp * (TR - T3) * PR);
  const MF = cfg.fan.totalAirflow - MR;
  const QF_prime = MF * rho * cp * (TF - T2) * PR;
  F1 = loads.QF - QF_prime;
}

console.log('At Excel guess:');
console.log('QF:', loads.QF.toFixed(6), 'QR:', loads.QR.toFixed(6), 'QEV:', loads.QEV.toFixed(6));
console.log('comp.coolingCapacity:', comp.coolingCapacity.toFixed(6));
console.log('Qtotal:', Qtotal.toFixed(6));
console.log('F2:', F2.toFixed(8));
console.log('F1:', F1.toFixed(8));
