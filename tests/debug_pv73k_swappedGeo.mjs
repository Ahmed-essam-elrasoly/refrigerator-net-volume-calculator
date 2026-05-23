// tests/debug_pv73k_swappedGeo.mjs
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';

// Actual bottom-freezer geometry (Excel labels)
const actual = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048,          // freezer (bottom) 746, refrigerator (top) 1048
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  // Freezer walls (from R‑labels)
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76,
  tFdoor: 80, tFback: 80, tEvaBack: 55,
  // Refrigerator walls (from F‑labels)
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRdoor: 58,
};

// Build swapped geometry: freezer on top (TF) / refrigerator on bottom (TR)
const swapped = {
  H: actual.H, W: actual.W, D: actual.D,
  Hf: actual.Hr,                 // top compartment = refrigerator, but we treat as freezer
  Hr: actual.Hf,                 // bottom compartment = freezer, but treat as refrigerator
  Hb: actual.Hb, Db1: actual.Db1, Db2: actual.Db2,
  doorGap: actual.doorGap, packingPos: actual.packingPos,
  // Top compartment (treated as freezer by calcHeatLoads) – actually the refrigerator
  tFtop: actual.tRtop,           // ambient top → 55
  tFleft: actual.tFleft,        // 82
  tFright: actual.tFright,      // 82
  tFbottom: actual.tRbottom1,   // partition → 32
  tFdoor: actual.tFdoor,        // 80
  tFback: actual.tFback,        // 80
  tEvaBack: actual.tEvaBack,    // 55
  // Bottom compartment (treated as refrigerator) – actually the freezer
  tRtop: actual.tFtop,          // partition → 32
  tRleft: actual.tRleft,        // 57
  tRright: actual.tRright,      // 57
  tRback: actual.tRback,        // 80? (refrigerator back)
  tRbottom1: actual.tFbottom,   // machine comp top → 76
  tRbottom2: actual.tFbottom2 || 80,   // slope → 80 (if not defined, use 80)
  tRbottom3: actual.tFbottom3 || 82,   // lower floor → 82
  tRdoor: actual.tRdoor,        // 58
};

// Excel converged point
const TC = 48.0, T2 = -19.5, PR = 0.77977, TE = -23.02, T0 = 25;
const TF = -18, TR = 3;
const wallRises = { side: 2.22, back: 1.71 };

const electrical = { defrostHeater_W: 112, defrostOn_min: 0 };
const fan = { totalAirflow: 146.4, inputPower_W: 2.4 };

const loads = calcHeatLoads(
  swapped,
  { T0, TF, TR, T2, TC, PR, TE },
  electrical,
  wallRises,
  fan.totalAirflow, swapped, fan.inputPower_W
);

console.log('=== PV73K with Swapped Geometry ===');
console.log(`QF = ${loads.QF.toFixed(2)}  (Excel: 31.30)`);
console.log(`QR = ${loads.QR.toFixed(2)}  (Excel: 23.54)`);
console.log(`QEV = ${loads.QEV.toFixed(2)}  (Excel: 9.86)`);