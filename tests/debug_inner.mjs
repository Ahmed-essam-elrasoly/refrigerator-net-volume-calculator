// tests/debug_inner.mjs
import { buildDefaultConfig } from '../src/js/engine/thermo/index.js';
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';

const cfg = buildDefaultConfig();
const { geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical } = cfg;
const { T0, TF, TR } = fixedTemps;

// Initial guess (same as inner solver start)
const TC = 54.4;
const T2 = -21.25;
let PR = 0.59;
PR = Math.max(0.001, Math.min(1, PR));

// Compute
const temps = { T0, TF, TR, T2, TC, PR };
const heatLoads = calcHeatLoads(geom, temps, electrical);
const TE = T2;
const comp = compressorState(TC, TE, refrigerant, compParams, subcool);
const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;
const F2 = Qtotal - comp.coolingCapacity * PR;

// Air distribution
const rho = 1.365, cp = 0.24;
const fanFlow = fan.totalAirflow;
const T3 = T2 + heatLoads.QEV / (fanFlow * rho * cp * PR);
const MR = (TR !== T3) ? heatLoads.QR / (rho * cp * (TR - T3) * PR) : 0;
const MF = Math.max(0, fanFlow - MR);
const QF_prime = MF * rho * cp * (TF - T2) * PR;
const F1 = heatLoads.QF - QF_prime;

console.log('Initial guess: T2=', T2, 'PR=', PR);
console.log('heatLoads:', heatLoads);
console.log('comp.coolingCapacity:', comp.coolingCapacity);
console.log('Qtotal:', Qtotal, 'F2:', F2);
console.log('T3:', T3, 'MR:', MR, 'MF:', MF);
console.log('QF_prime:', QF_prime, 'F1:', F1);