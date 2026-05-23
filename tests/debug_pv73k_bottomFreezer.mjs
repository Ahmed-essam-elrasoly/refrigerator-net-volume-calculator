// tests/debug_pv73k_bottomFreezer.mjs
import { PHYSICAL_CONSTANTS as PC } from '../src/js/engine/thermo/constants.js';

// Urethane conductivity (Excel formula)
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

// Actual PV73K geometry (bottom freezer)
const G = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048,          // freezer bottom (Hf), refrigerator top (Hr)
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  // Wall thicknesses – using original Excel labels (F=refrig, R=freezer)
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
};

const T0 = 25, TF = -18, TR = 3, TC = 48, T2 = -19.5, PR = 0.77977, TE = -23.02;
const T_side = T0 + 2.22, T_back = T0 + 1.71;
const T_comp = 50 * PR + T0;
const T_wallBack = (T_comp - T0) * PR + T0;   // Cab Bottom temperature

console.log('=== PV73K Bottom-Freezer Exact Replica ===\n');

// ---- FREEZER (bottom compartment, height = Hf = 746) ----
const Hf = G.Hf;
const AF_top    = (G.W - (G.tRleft+G.tRright)/2) * (G.D - G.tEvaBack/2) / 1e6;   // freezer top = partition
const AF_left   = (G.D - G.tEvaBack/2) * (Hf - (G.tRtop+G.tRbottom1)/2) / 1e6;
const AF_right  = AF_left;
const AF_bottom = (G.D - G.tEvaBack/2) * (G.W - (G.tRleft+G.tRright)/2) / 1e6;   // bottom = machine comp
const AF_door   = (Hf - G.doorGap/2 - 2*G.packingPos) * (G.W - 2*G.packingPos) / 1e6;
const AF_packin = ((Hf - 2*G.packingPos) + (G.W - 2*G.packingPos)) * 2 / 1000;

let QF = 0;
const qf = (label, val, excel) => { QF += val; console.log(`  ${label}: ${val.toFixed(2)}  (Excel: ${excel})`); };

qf('F TOP (partition)', kInterior(G.tRtop, TF, TR) * AF_top * (TR - TF), 3.82);  // actually Excel shows 3.82 for F BOTTOM? Wait, the Excel SIZE sheet shows "F BOTTOM" = 3.8197 with inside TF, outside TR. That's the partition. In the bottom-freezer, freezer top is partition -> interior K, ΔT = TR - TF.
qf('F LEFT',            kExterior(G.tRleft, TF, T_side) * AF_left * (T_side - TF), 7.02);
qf('F RIGHT',           kExterior(G.tRright, TF, T_side) * AF_right * (T_side - TF), 7.02);
qf('F BOTTOM (machine)',kExterior(G.tRbottom1, TF, T_wallBack) * AF_bottom * (T_wallBack - TF), 2.64); // Excel R BOTTOM1 = 2.64 for freezer? Actually in the original sheet, R BOTTOM1 is freezer bottom1, value 2.6391. But note: the freezer bottom is actually composed of bottom1, bottom2, bottom3 (the stepped floor). We'll sum them later.
// For now we'll use the combined heat flow. The Excel sheet has separate terms for R BOTTOM1, R BOTTOM2, R BOTTOM3. We'll compute them individually.

// Freezer door
qf('F DOOR',            kExterior(G.tRdoor, TF, T0) * AF_door * (T0 - TF), 7.63);
qf('F PACKIN',          PC.insulation.packing * AF_packin * (T0 - TF), 5.37);

// Partition losses (these are based on TC and pipe lengths, independent of orientation)
const DPCON1 = (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR)) * (G.W - G.tRleft - G.tRright) / 1000;
const DPCON2 = (0.0791*(TC-TF)-0.072*(T0-TF)) * PR * (Hf*2+G.W) / 1000;
qf('F DPCON1',          DPCON1, 4.76);
qf('F DPCON2',          DPCON2, 4.79);

// Now the freezer bottom complex (machine compartment floor)
const AR_bottom1 = (G.W - (G.tRleft+G.tRright)/2) * G.Db1 / 1e6;
const AR_bottom2 = (G.W - (G.tRleft+G.tRright)/2) * Math.sqrt(G.Hb**2 + (G.Db2-G.Db1)**2) / 1e6;
const AR_bottom3 = (G.W - (G.tRleft+G.tRright)/2) * G.Db2 / 1e6;
// Excel assigns T_wallBack (Cab Bottom) to bottom1 and bottom2, and T0 to bottom3.
// Also note: the K-values for bottom1 use thickness 76, bottom2 80, bottom3 82.
qf('F BOTTOM1',         kExterior(G.tRbottom1, TF, T_wallBack) * AR_bottom1 * (T_wallBack - TF), 2.64);
qf('F BOTTOM2',         kExterior(G.tRbottom2, TF, T_wallBack) * AR_bottom2 * (T_wallBack - TF), 3.28);
qf('F BOTTOM3',         kExterior(G.tRbottom3, TF, T0) * AR_bottom3 * (T0 - TF), 1.66);
// Actually the Excel values: R BOTTOM1=2.6391, R BOTTOM2=3.2772, R BOTTOM3=1.6639. These match.

console.log(`  TOTAL QF: ${QF.toFixed(2)}  (Excel: 31.30)\n`);

// ---- REFRIGERATOR (top compartment, height = Hr = 1048) ----
const Hr = G.Hr;
const AR_top     = (G.W - (G.tFleft+G.tFright)/2) * (G.D - G.tEvaBack/2) / 1e6;   // top faces ambient
const AR_left    = ((Hr - (G.tFbottom+G.tRbottom1)/2) * (G.D - G.tEvaBack/2) - (G.Db1+G.Db2)*G.Hb/2) / 1e6;
const AR_right   = AR_left;
const AR_back    = (Hr - (G.tFbottom+G.tRbottom1)/2 - G.Hb) * (G.W - (G.tFleft+G.tFright)/2) / 1e6;
const AR_bottom  = (G.D - G.tEvaBack/2) * (G.W - (G.tFleft+G.tFright)/2) / 1e6;   // bottom = partition to freezer
const AR_door    = (Hr - G.doorGap/2 - 2*G.packingPos) * (G.W - 2*G.packingPos) / 1e6;
const AR_packin  = ((Hr - 2*G.packingPos) + (G.W - 2*G.packingPos)) * 2 / 1000;

let QR = 0;
const qr = (label, val, excel) => { QR += val; console.log(`  ${label}: ${val.toFixed(2)}  (Excel: ${excel})`); };

qr('R TOP (ambient)',    kExterior(G.tFtop, TR, T0) * AR_top * (T0 - TR), 2.77);    // Excel: R TOP = 2.7713
qr('R LEFT',             kExterior(G.tFleft, TR, T_side) * AR_left * (T_side - TR), 4.05); // Excel: R LEFT = 4.0460
qr('R RIGHT',            kExterior(G.tFright, TR, T_side) * AR_right * (T_side - TR), 4.05);
qr('R BOTTOM (partition)', kInterior(G.tFbottom, TF, TR) * AR_bottom * (TF - TR), -3.82); // Excel: R BOTTOM = -3.8197
qr('R DOOR',             kExterior(G.tFdoor, TR, T0) * AR_door * (T0 - TR), 4.20);   // Excel: R DOOR = 4.1992
qr('R PACKIN',           PC.insulation.packing * AR_packin * (T0 - TR), 2.75);        // Excel: R PACKIN = 2.7458
qr('R DPCON (R-Front)',  (0.0546*(TC-TF)-0.0491*(T0-TF)) * PR * (Hr*2+G.W) / 1000, 2.66);

// Refrigerator back wall (faces T_wallBack? Actually in top-freezer, refrigerator back faces machine comp. But for bottom-freezer, the refrigerator is on top, its back might just be ambient or condenser back? The Excel sheet shows "R BACK" with outside temp 55.40 (T_wallBack). We'll use T_wallBack.
qr('R BACK',             kExterior(G.tRback, TR, T_wallBack) * AR_back * (T_wallBack - TR), 3.33);

console.log(`  TOTAL QR: ${QR.toFixed(2)}  (Excel: 23.54)\n`);

// Evaporator (always on freezer back)
const A_evaBack = (G.W - (G.tRleft+G.tRright)/2) * (Hf - (G.tRtop+G.tRbottom1)/2) / 1e6;
const QEV_cond = kExterior(G.tEvaBack, T2, T_back) * A_evaBack * (T_back - T2);
const fanLoad = 2.4 * 0.86 * PR;
console.log(`EVA BACK: ${QEV_cond.toFixed(2)} (Excel 8.25)`);
console.log(`FAN LOAD: ${fanLoad.toFixed(2)} (Excel 1.61)`);
console.log(`TOTAL QEV: ${(QEV_cond+fanLoad).toFixed(2)} (Excel 9.86)`);