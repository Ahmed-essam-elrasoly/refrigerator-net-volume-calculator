// tests/debug_pv73k_swapped.mjs
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';

// Corrected geometry for PV73K (bottom freezer)
// F compartment = top (refrigerator), R compartment = bottom (freezer)
const geom = {
  H: 1794, W: 795, D: 687,
  Hf: 1048, Hr: 746,               // Hf = top (refrigerator) height, Hr = bottom (freezer) height
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  // Wall thicknesses – F = top (refrigerator), R = bottom (freezer)
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
};

// Condenser config (unchanged)
const condenserConfig = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

// Excel converged point for PV73K (from your corrected MAIN sheet)
const TC = 48.0, T2 = -19.5, PR = 0.77977, TE = -23.02, T0 = 25;
// IMPORTANT: TF = -18 (freezer), TR = 3 (refrigerator)
const TF = -18, TR = 3;

// Wall temperature rises from Excel (unchanged, because condenser is on the side/back)
const sideRise = 2.22, backRise = 1.71;

const electrical = { defrostHeater_W: 112, defrostOn_min: 0 };
const fan = { totalAirflow: 146.4, inputPower_W: 2.4 };

const loads = calcHeatLoads(
  geom,
  { T0, TF, TR, T2, TC, PR, TE },
  electrical,
  { side: sideRise, back: backRise },
  fan.totalAirflow, geom, fan.inputPower_W
);

console.log('=== PV73K Heat Loads with Corrected Compartment Assignment ===');
console.log(`QF (freezer) = ${loads.QF.toFixed(2)}  (Excel: 31.30)`);
console.log(`QR (refrig)  = ${loads.QR.toFixed(2)}  (Excel: 23.54)`);
console.log(`QEV          = ${loads.QEV.toFixed(2)} (Excel: 9.86)`);
console.log(`fanLoad = ${loads.fanLoad.toFixed(2)}, defrost = ${loads.defrostLoad.toFixed(2)}`);