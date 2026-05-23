// tests/validate_both.mjs – validates heat loads for SJ‑540 and PV73K
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';

// ────────────── SJ‑540 (top‑freezer) ──────────────
const geom54 = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130, Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40, tRfloor: 70,
};

const temps54 = { T0: 30, TF: -18, TR: 3, T2: -21.25, TC: 40.91, PR: 0.591, TE: -23.3 };
const elec54  = { defrostHeater_W: 140, defrostOn_min: 0 };
const fan54   = { totalAirflow: 59.5, inputPower_W: 2.1 };
const pipe54  = { side: 150, back: 200 };

// ────────────── PV73K (bottom‑freezer) ──────────────
const geom73 = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048, Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  // Freezer (bottom)
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76, tFdoor: 80, tFback: 55, tEvaBack: 55,
  tFfloor1: 76, tFfloor2: 80, tFfloor3: 82,
  // Refrigerator (top)
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80, tRdoor: 58,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRfloor: 32,
};

const temps73 = { T0: 25, TF: -18, TR: 3, T2: -19.5, TC: 48.0, PR: 0.77977, TE: -23.02 };
const elec73  = { defrostHeater_W: 112, defrostOn_min: 0 };
const fan73   = { totalAirflow: 146.4, inputPower_W: 2.4 };
const pipe73  = { side: 150, back: 200 };

// ────────────── Run both ──────────────
console.log('=== SJ‑540 (top‑freezer) ===');
const loads54 = calcHeatLoads(
  geom54, temps54, elec54, pipe54, 0.7,
  fan54.totalAirflow, geom54, fan54.inputPower_W, 'top'
);
console.log(`QF  = ${loads54.QF.toFixed(4)}   (Excel: 27.36)`);
console.log(`QR  = ${loads54.QR.toFixed(4)}   (Excel: 39.41)`);
console.log(`QEV = ${loads54.QEV.toFixed(4)}  (Excel: 5.43)`);

console.log('\n=== PV73K (bottom‑freezer) ===');
const loads73 = calcHeatLoads(
  geom73, temps73, elec73, pipe73, 0.7,
  fan73.totalAirflow, geom73, fan73.inputPower_W, 'bottom'
);
console.log(`QF  = ${loads73.QF.toFixed(4)}   (Excel: 26.52)`);
console.log(`QR  = ${loads73.QR.toFixed(4)}   (Excel: 26.62)`);
console.log(`QEV = ${loads73.QEV.toFixed(4)}  (Excel: 6.42)`);