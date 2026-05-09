// tests/debug_step.mjs
import { buildDefaultConfig } from '../src/js/engine/thermo/index.js';
import { createInnerSolver } from '../src/js/engine/thermo/solver.js';
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

const cfg = buildDefaultConfig();
const { T0, TF, TR, TE } = cfg.fixedTemps;
const rho = PHYSICAL_CONSTANTS.air.density;
const cp = PHYSICAL_CONSTANTS.air.cp;
const fanFlow = cfg.fan.totalAirflow;
const TC = 54.4;

function computeF(x) {
  let [T2, PR] = x;
  PR = Math.max(0.001, Math.min(0.999, PR));
  const temps = { T0, TF, TR, T2, TC, PR };
  const loads = calcHeatLoads(cfg.geom, temps, cfg.electrical);
  const comp = compressorState(TC, TE, cfg.refrigerant, cfg.compParams, cfg.subcool);
  const Qtotal = loads.QF + loads.QR + loads.QEV;
  const F2 = Qtotal - comp.coolingCapacity * PR;

  const denom = fanFlow * rho * cp * PR;
  let F1;
  if (denom < 1e-12) {
    F1 = loads.QF;
  } else {
    const T3 = T2 + loads.QEV / denom;
    const MR = (Math.abs(TR - T3) < 1e-9) ? 0 : loads.QR / (rho * cp * (TR - T3) * PR);
    const MF = fanFlow - MR;
    const QF_prime = MF * rho * cp * (TF - T2) * PR;
    F1 = loads.QF - QF_prime;
  }
  return { F1, F2, loads, comp };
}

const x0 = [-21.2483006297973, 0.5905646101665666];
console.log('Base point:');
const base = computeF(x0);
console.log('F1:', base.F1, 'F2:', base.F2);
console.log('QF:', base.loads.QF, 'QR:', base.loads.QR, 'QEV:', base.loads.QEV, 'Qcomp:', base.comp.coolingCapacity);

const dx = 0.001;
for (let j = 0; j < 2; j++) {
  const xPert = x0.slice();
  xPert[j] += dx;
  console.log(`\nPerturb x[${j}] +${dx}:`, xPert);
  const pert = computeF(xPert);
  console.log('F1:', pert.F1, 'F2:', pert.F2);
}