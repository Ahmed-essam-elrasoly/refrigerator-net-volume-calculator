// tests/debug_pv73k_terms.mjs
import { PHYSICAL_CONSTANTS as PC } from '../src/js/engine/thermo/constants.js';

// Urethane conductivity and K-value (same as heatLoad.js)
function lambdaUrethane(T_in, T_out) {
  return 0.0165 + 0.00011 * ((T_in + T_out) / 2);
}
function kExterior(thk_mm, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  const m = thk_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + m/lam);
}
function kInterior(thk_mm, T1, T2) {
  const lam = lambdaUrethane(T1, T2);
  const m = thk_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.inside + 1/PC.surfaceCoefficients.inside + m/lam);
}

// Actual bottom-freezer geometry (Excel labels, as given)
const G = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048,                // freezer=746 (bottom), refrigerator=1048 (top)
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  // Freezer (bottom) – from R‑labelled rows
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76,
  tFdoor: 80, tFback: 80, tEvaBack: 55,
  // Refrigerator (top) – from F‑labelled rows
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRdoor: 58,
};

// We'll use the swapped geometry that matches calcHeatLoads assumptions:
// top compartment = freezer, bottom = refrigerator
const SW = {
  H: G.H, W: G.W, D: G.D,
  Hf: G.Hr,             // 1048 (refrigerator becomes "top freezer" height)
  Hr: G.Hf,             // 746  (freezer becomes "bottom refrigerator" height)
  Hb: G.Hb, Db1: G.Db1, Db2: G.Db2,
  doorGap: G.doorGap, packingPos: G.packingPos,
  // Top ("freezer"): actually refrigerator
  tFtop: G.tRtop,       // 55
  tFleft: G.tFleft,     // 82
  tFright: G.tFright,   // 82
  tFbottom: G.tRbottom1,// 32 (partition)
  tFdoor: G.tFdoor,     // 80
  tFback: G.tFback,     // 80
  tEvaBack: G.tEvaBack, // 55
  // Bottom ("refrigerator"): actually freezer
  tRtop: G.tFtop,       // 32 (partition)
  tRleft: G.tRleft,     // 57
  tRright: G.tRright,   // 57
  tRback: G.tRback,     // 80 (refrigerator back)
  tRbottom1: G.tFbottom,// 76 (freezer bottom / machine comp top)
  tRbottom2: 80,        // slope thickness (R BOTTOM 2 = 80)
  tRbottom3: 82,        // lower floor thickness (R BOTTOM 3 = 82)
  tRdoor: G.tRdoor,     // 58
};

const T0 = 25, TF = -18, TR = 3, TC = 48, T2 = -19.5, PR = 0.77977, TE = -23.02;
const T_side = T0 + 2.22, T_back = T0 + 1.71;  // Excel rises

console.log('=== Term-by-term contributions (swapped geometry) ===\n');

// ---- Freezer (top) ----
const Hf = SW.Hf, Hr = SW.Hr, W = SW.W, D = SW.D;
const AFtop    = (W - (SW.tFleft+SW.tFright)/2) * (D - SW.tEvaBack/2) / 1e6;
const AFleft   = (D - SW.tEvaBack/2) * (Hf - (SW.tFtop+SW.tFbottom)/2) / 1e6;
const AFbottom = (D - SW.tEvaBack/2) * (W - (SW.tFleft+SW.tFright)/2) / 1e6;
const AFdoor   = (Hf - SW.doorGap/2 - 2*SW.packingPos) * (W - 2*SW.packingPos) / 1e6;
const AFpackin = ((Hf - 2*SW.packingPos) + (W - 2*SW.packingPos)) * 2 / 1000;

console.log('Freezer (top compartment) contributions:');
let QF = 0;
const q = (label, val, excel) => { QF += val; console.log(`  ${label}: ${val.toFixed(2)}  (Excel: ${excel})`); };

q('F TOP     ', kExterior(SW.tFtop, TF, T0) * AFtop * (T0 - TF), 5.03);
q('F LEFT    ', kExterior(SW.tFleft, TF, T_side) * AFleft * (T_side - TF), 7.02);
q('F RIGHT   ', kExterior(SW.tFright, TF, T_side) * AFleft * (T_side - TF), 7.02);
q('F BOTTOM  ', kInterior(SW.tFbottom, TF, TR) * AFbottom * (TR - TF), 3.82);
q('F DOOR    ', kExterior(SW.tFdoor, TF, T0) * AFdoor * (T0 - TF), 7.63);
q('F PACKIN  ', PC.insulation.packing * AFpackin * (T0 - TF), 5.37);
const DPCON1 = (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR)) * (W - SW.tFleft - SW.tFright) / 1000;
q('F DPCON1  ', DPCON1, 4.76);
const DPCON2 = (0.0791*(TC-TF)-0.072*(T0-TF)) * PR * (Hf*2+W) / 1000;
q('F DPCON2  ', DPCON2, 4.79);
console.log(`  TOTAL QF: ${QF.toFixed(2)}  (Excel: 31.30)\n`);

// ---- Refrigerator (bottom) ----
const ARtop    = (W - (SW.tRleft+SW.tRright)/2) * (D - SW.tRback/2) / 1e6;
const rSideHeight = Hr - (SW.tFbottom + SW.tRbottom1)/2;
const ARleft   = (rSideHeight * (D - SW.tRback/2) - (SW.Db1+SW.Db2)*SW.Hb/2) / 1e6;
const ARback   = (Hr - (SW.tFbottom + SW.tRbottom1)/2 - SW.Hb) * (W - (SW.tRleft+SW.tRright)/2) / 1e6;
const ARbottom1 = (W - (SW.tRleft+SW.tRright)/2) * SW.Db1 / 1e6;
const ARbottom2 = (W - (SW.tRleft+SW.tRright)/2) * Math.sqrt(SW.Hb**2 + (SW.Db2-SW.Db1)**2) / 1e6;
const ARbottom3 = (W - (SW.tRleft+SW.tRright)/2) * SW.Db2 / 1e6;
const ARdoor    = (Hr - SW.doorGap/2 - 2*SW.packingPos) * (W - 2*SW.packingPos) / 1e6;
const ARpackin  = ((Hr - 2*SW.packingPos) + (W - 2*SW.packingPos)) * 2 / 1000;

console.log('Refrigerator (bottom compartment) contributions:');
let QR = 0;
const qr = (label, val, excel) => { QR += val; console.log(`  ${label}: ${val.toFixed(2)}  (Excel: ${excel})`); };

qr('R TOP     ', kInterior(SW.tRtop, TF, TR) * ARtop * (TF - TR), -3.82);
qr('R LEFT    ', kExterior(SW.tRleft, TR, T_side) * ARleft * (T_side - TR), 1.70);
qr('R RIGHT   ', kExterior(SW.tRright, TR, T_side) * ARleft * (T_side - TR), 1.70);
qr('R BACK    ', kExterior(SW.tRback, TR, T_back) * ARback * (T_back - TR), 3.33);
qr('R BOTTOM1 ', kExterior(SW.tRbottom1, TR, T_back) * ARbottom1 * (T_back - TR), 1.53);
qr('R BOTTOM2 ', kExterior(SW.tRbottom2, TR, T_back) * ARbottom2 * (T_back - TR), 1.92);
qr('R BOTTOM3 ', kExterior(SW.tRbottom3, TR, T0) * ARbottom3 * (T0 - TR), 0.73);
qr('R DOOR    ', kExterior(SW.tRdoor, TR, T0) * ARdoor * (T0 - TR), 2.36);
qr('R PACKIN  ', PC.insulation.packing * ARpackin * (T0 - TR), 2.28);
const DPCON_R = (0.0546*(TC-TF)-0.0491*(T0-TF)) * PR * (Hr*2+W) / 1000;
qr('R DPCON   ', DPCON_R, 2.66);
console.log(`  TOTAL QR: ${QR.toFixed(2)}  (Excel: 23.54)\n`);

// Evaporator
const A_evaBack = (W - (SW.tFleft+SW.tFright)/2) * (Hf - (SW.tFtop+SW.tFbottom)/2) / 1e6;
const QEV_cond = kExterior(SW.tEvaBack, T2, T_back) * A_evaBack * (T_back - T2);
const fanLoad = 2.4 * 0.86 * PR;
console.log('Evaporator:');
console.log(`  EVA BACK: ${QEV_cond.toFixed(2)}  (Excel: 8.25)`);
console.log(`  FAN LOAD: ${fanLoad.toFixed(2)}  (Excel: 1.61)`);
console.log(`  TOTAL QEV: ${(QEV_cond+fanLoad).toFixed(2)}  (Excel: 9.86)`);