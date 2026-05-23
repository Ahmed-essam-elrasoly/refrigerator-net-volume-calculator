// tests/debug_pv73k_exactMapping.mjs
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';

const geom = {
  H: 1794, W: 795, D: 687,
  Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  // Freezer (bottom)
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76,
  tFdoor: 80, tFback: 80, tEvaBack: 55,
  // Refrigerator (top)
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRdoor: 58,
};

const TC = 48.0, T2 = -19.5, PR = 0.77977, TE = -23.02, T0 = 25;
const TF = -18, TR = 3;
const wallRises = { side: 2.22, back: 1.71 };

const loads = calcHeatLoads(
  geom,
  { T0, TF, TR, T2, TC, PR, TE },
  { defrostHeater_W: 112, defrostOn_min: 0 },
  wallRises,
  146.4, geom, 2.4
);

console.log('=== PV73K Exact Mapping ===');
console.log(`QF = ${loads.QF.toFixed(2)}  (Excel: 31.30)`);
console.log(`QR = ${loads.QR.toFixed(2)}  (Excel: 23.54)`);
console.log(`QEV = ${loads.QEV.toFixed(2)}  (Excel: 9.86)`);