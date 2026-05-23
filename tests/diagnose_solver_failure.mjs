// tests/diagnose_solver_failure.mjs – diagnostics for inner loop failure
import { calcHeatLoads, computeWallConductances } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas } from '../src/js/engine/thermo/condenser.js';

// ────────────── SJ‑540 (top‑freezer) ──────────────
const geom54 = {
  H: 1680, W: 800, D: 630, Hf: 550, Hr: 1130, Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40, tRfloor: 70,
};

const compParams54 = {
  rpm: 2900, rpm0: 2900, Vc: 11.14, T_suction: 32.2,
  volEffCoeffs: { A: 0.9260142251566365, B: -0.01221312333322575, C: -0.0023789273042382304 },
  kEtaV: { a: 1, b: 0, c: 0 },
  powerCoeffs: { AW: 135.175, BW: 2.6366666666666667, CW: 0.975, DW: 0.02, EW: 0.016666666666666666 },
  powerKw: { a: 1, b: 0, c: 0 },
};

const condenserConfig54 = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

// Excel converged point SJ‑540
const TC54 = 40.91, T254 = -21.25, PR54 = 0.591, TE54 = -23.3, T0_54 = 30, TF = -18, TR = 3;

// Test wall conductances
const wallCond54 = computeWallConductances(geom54, T0_54, TF, TR, 'top');
console.log('SJ‑540 wall conductances:');
console.log(' UA_side_total:', wallCond54.UA_side_total.toFixed(4), ' T_comp_side:', wallCond54.T_comp_side.toFixed(2));
console.log(' UA_back_total:', wallCond54.UA_back_total.toFixed(4), ' T_comp_back:', wallCond54.T_comp_back.toFixed(2));

// Compute wall temperatures dynamically at Excel point
const areas54 = computeCondenserAreas(geom54, condenserConfig54);
const KA_side = areas54.sideKA, KA_back = areas54.backKA;
const denom_side = KA_side * PR54 + wallCond54.UA_side_total;
const T_side_dyn = (KA_side * TC54 * PR54 + wallCond54.UA_side_total * wallCond54.T_comp_side) / denom_side;
const denom_back = KA_back * PR54 + wallCond54.UA_back_total;
const T_back_dyn = (KA_back * TC54 * PR54 + wallCond54.UA_back_total * wallCond54.T_comp_back) / denom_back;
console.log('Dynamic T_side:', T_side_dyn.toFixed(2), ' (Excel 33.47)');
console.log('Dynamic T_back:', T_back_dyn.toFixed(2), ' (Excel 32.69)');

// If they match, the dynamic wall model is correct. If not, we adjust the conductance calculation.

// Check heat loads with dynamic wall temps
const condenserRises_dyn = { side: T_side_dyn - T0_54, back: T_back_dyn - T0_54 };
const loads54_dyn = calcHeatLoads(
  geom54, { T0: T0_54, TF, TR, T2: T254, TC: TC54, PR: PR54, TE: TE54 },
  { defrostHeater_W: 140, defrostOn_min: 0 }, condenserRises_dyn, 0.7, 59.5, geom54, 2.1, 'top'
);
console.log('\nHeat loads with dynamic wall temps:');
console.log(' QF:', loads54_dyn.QF.toFixed(2), ' (Excel 27.36)');
console.log(' QR:', loads54_dyn.QR.toFixed(2), ' (Excel 39.41)');
console.log(' QEV:', loads54_dyn.QEV.toFixed(2), ' (Excel 5.43)');

// Check compressor
const comp54 = compressorState(TC54, TE54, 'R-600a', compParams54, 10);
console.log(' Comp cool:', comp54.coolingCapacity.toFixed(2));

// Inner solver residual at Excel point with dynamic wall temps
const rho = 1.365, cp = 0.24;
const denom = 59.5 * rho * cp * PR54;
const T3 = T254 + loads54_dyn.QEV / denom;
const MR = loads54_dyn.QR / (rho * cp * Math.max(0.01, TR - T3) * PR54);
const MF = 59.5 - MR;
const QF_prime = MF * rho * cp * (TF - T254) * PR54;
const F1 = loads54_dyn.QF - QF_prime;
const F2 = (loads54_dyn.QF + loads54_dyn.QR + loads54_dyn.QEV) - comp54.coolingCapacity * PR54;
console.log('\nInner residuals at Excel point:');
console.log(' F1:', F1.toFixed(4), ' (should be ~0)');
console.log(' F2:', F2.toFixed(4), ' (should be ~0)');