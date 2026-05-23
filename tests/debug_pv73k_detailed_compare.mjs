// tests/debug_pv73k_detailed_compare.mjs
import { PHYSICAL_CONSTANTS as PC } from '../src/js/engine/thermo/constants.js';

// Urethane conductivity (Excel formula)
function lambdaUrethane(T_in, T_out) {
  const T_avg = (T_in + T_out) / 2;
  return 0.0165 + 0.00011 * T_avg;   // Excel uses T_avg directly, not (T_avg-25)
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

// Actual PV73K bottom-freezer geometry (Excel labels: F=top=refrigerator, R=bottom=freezer)
const G = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048,          // freezer (bottom) height = 746, refrigerator (top) height = 1048
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  // Freezer (R labels) – bottom
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76,   // bottom1
  tFbottom2: 80, tFbottom3: 82,                       // slope and lower floor thicknesses
  tFdoor: 80, tFback: 80, tEvaBack: 55,
  // Refrigerator (F labels) – top
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRdoor: 58,
};

// Excel converged point
const T0 = 25, TF = -18, TR = 3, TC = 48.0, T2 = -19.5, PR = 0.77977, TE = -23.02;
const T_side = T0 + 2.22;   // from Excel Cab Side
const T_back = T0 + 1.71;   // from Excel Back cab
const T_comp = 50 * PR + T0;   // compressor temp
const T_wallBack = (T_comp - T0) * PR + T0;  // Cab Bottom

// Excel reference values from the corrected SIZE sheet
// Positions: we'll use the Excel labels (R TOP, R LEFT, etc.) for comparison.
// We'll map each physical wall to an Excel label.
// The Excel sheet for bottom-freezer has:
// R TOP, R LEFT, R RIGHT, R BOTTOM, R DOOR, R PACKIN, R DPCON1, R DPCON2, 
// F TOP, F LEFT, F RIGHT, F BACK, F BOTTOM1, F BOTTOM2, F BOTTOM3, F DOOR, F PACKIN, F DPCON,
// EVA BACK, FAN LOAD.

// We'll compute each term using the actual compartment dimensions and correct temps.

console.log('=== Detailed Comparison for PV73K Bottom-Freezer ===');
console.log('(Format: Our value | Excel value)\n');

// Helper to print comparison line
function comp(label, ourS, excelS, ourB, excelB, ourK, excelK, ourTi, excelTi, ourTo, excelTo, ourQ, excelQ) {
  console.log(`${label}:`);
  console.log(`  S:   ${ourS.toFixed(4)} | ${excelS}`);
  console.log(`  B:   ${ourB.toFixed(4)} | ${excelB}`);
  console.log(`  K:   ${ourK.toFixed(4)} | ${excelK}`);
  console.log(`  Ti:  ${ourTi.toFixed(2)} | ${excelTi}`);
  console.log(`  To:  ${ourTo.toFixed(2)} | ${excelTo}`);
  console.log(`  Q:   ${ourQ.toFixed(4)} | ${excelQ}\n`);
}

// ================== FREEZER (BOTTOM) ==================
// Use R-labeled walls.
const W = G.W, D = G.D, Hf = G.Hf, Hr = G.Hr;
const tRtop = G.tFtop, tRleft = G.tFleft, tRright = G.tFright, tRbottom1 = G.tFbottom, tRbottom2 = G.tFbottom2, tRbottom3 = G.tFbottom3, tRdoor = G.tFdoor, tRback = G.tFback;
const tEvaBack = G.tEvaBack;

// Freezer top (partition to refrigerator) – uses interior K
const AF_top = (W - (tRleft+tRright)/2) * (D - tEvaBack/2) / 1e6;
const K_F_top = kInterior(tRtop, TF, TR);
const Q_F_top = K_F_top * AF_top * (TR - TF);
comp('F TOP (part)', AF_top, 0.487, K_F_top*AF_top, 0.1819, K_F_top, 0.3737, TF, -18, TR, 3, Q_F_top, 3.8197);

// Freezer left – exterior K, T_side outside
const AF_left = (D - tEvaBack/2) * (Hf - (tRtop + tRbottom1)/2) / 1e6;
const K_F_left = kExterior(tRleft, TF, T_side);
const Q_F_left = K_F_left * AF_left * (T_side - TF);
comp('F LEFT', AF_left, 0.391, K_F_left*AF_left, 0.0650, K_F_left, 0.1662, TF, -18, T_side, 27.22, Q_F_left, 2.9390);

// Freezer right (same as left)
comp('F RIGHT', AF_left, 0.391, K_F_left*AF_left, 0.0650, K_F_left, 0.1662, TF, -18, T_side, 27.22, Q_F_left, 2.9390);

// Freezer bottom is complex: BOTTOM1, BOTTOM2, BOTTOM3
const AF_bottom1 = (W - (tRleft+tRright)/2) * G.Db1 / 1e6;
const K_F_bottom1 = kExterior(tRbottom1, TF, T_wallBack);
const Q_F_bottom1 = K_F_bottom1 * AF_bottom1 * (T_wallBack - TF);
comp('F BOTTOM1', AF_bottom1, 0.139, K_F_bottom1*AF_bottom1, 0.0274, K_F_bottom1, 0.1971, TF, -18, T_wallBack, 55.40, Q_F_bottom1, 2.0111);

const AF_bottom2 = (W - (tRleft+tRright)/2) * Math.sqrt(G.Hb**2 + (G.Db2-G.Db1)**2) / 1e6;
const K_F_bottom2 = kExterior(tRbottom2, TF, T_wallBack);
const Q_F_bottom2 = K_F_bottom2 * AF_bottom2 * (T_wallBack - TF);
comp('F BOTTOM2', AF_bottom2, 0.183, K_F_bottom2*AF_bottom2, 0.0343, K_F_bottom2, 0.1877, TF, -18, T_wallBack, 55.40, Q_F_bottom2, 2.5210);

const AF_bottom3 = (W - (tRleft+tRright)/2) * G.Db2 / 1e6;
const K_F_bottom3 = kExterior(tRbottom3, TF, T0);
const Q_F_bottom3 = K_F_bottom3 * AF_bottom3 * (T0 - TF);
comp('F BOTTOM3', AF_bottom3, 0.186, K_F_bottom3*AF_bottom3, 0.0307, K_F_bottom3, 0.1648, TF, -18, T0, 25, Q_F_bottom3, 1.3187);

// Freezer door
const AF_door = (Hf - G.doorGap/2 - 2*G.packingPos) * (W - 2*G.packingPos) / 1e6;
const K_F_door = kExterior(tRdoor, TF, T0);
const Q_F_door = K_F_door * AF_door * (T0 - TF);
comp('F DOOR', AF_door, 0.589, K_F_door*AF_door, 0.0994, K_F_door, 0.1687, TF, -18, T0, 25, Q_F_door, 4.2743);

// Freezer packing
const AF_packin = ((Hf - 2*G.packingPos) + (W - 2*G.packingPos)) * 2 / 1000;
const Q_F_packin = PC.insulation.packing * AF_packin * (T0 - TF);
comp('F PACKIN', AF_packin, 2.962, PC.insulation.packing*AF_packin, 0.1037, PC.insulation.packing, 0.0350, TF, -18, T0, 25, Q_F_packin, 4.4578);

// Freezer back (EVA BACK) – computed later as evaporator.

// Freezer partition losses (DPCON for bottom-freezer?)
// Actually the Excel sheet has "F DPCON(F-Front)" for the freezer? But the MAIN sheet uses F1, F2.
// We'll compute later.

// ================== REFRIGERATOR (TOP) ==================
const tFtop = G.tRtop, tFleft = G.tRleft, tFright = G.tRright, tFbottom = G.tRbottom1, tFdoor = G.tRdoor;
// Refrigerator top faces ambient
const AR_top = (W - (tFleft+tFright)/2) * (D - tEvaBack/2) / 1e6;
const K_R_top = kExterior(tFtop, TR, T0);
const Q_R_top = K_R_top * AR_top * (T0 - TR);
comp('R TOP', AR_top, 0.487, K_R_top*AR_top, 0.1260, K_R_top, 0.2588, TR, 3, T0, 25, Q_R_top, 2.7713);

// Refrigerator left
const rSideHeight = Hr - (tFbottom + tRbottom1)/2;  // but tRbottom1 is from refrigerator? Actually in bottom-freezer, the refrigerator bottom is the partition, which has thickness tFbottom (32). So correct.
const AR_left = (rSideHeight * (D - tEvaBack/2) - (G.Db1+G.Db2)*G.Hb/2) / 1e6;
const K_R_left = kExterior(tFleft, TR, T_side);
const Q_R_left = K_R_left * AR_left * (T_side - TR);
comp('R LEFT', AR_left, 0.662, K_R_left*AR_left, 0.1671, K_R_left, 0.2522, TR, 3, T_side, 27.22, Q_R_left, 4.0460);

// Refrigerator right (same)
comp('R RIGHT', AR_left, 0.662, K_R_left*AR_left, 0.1671, K_R_left, 0.2522, TR, 3, T_side, 27.22, Q_R_left, 4.0460);

// Refrigerator bottom (partition to freezer) – interior K
const AR_bottom = (D - tEvaBack/2) * (W - (tFleft+tFright)/2) / 1e6;
const K_R_bottom = kInterior(tFbottom, TF, TR);
const Q_R_bottom = K_R_bottom * AR_bottom * (TF - TR);  // TF - TR
comp('R BOTTOM', AR_bottom, 0.487, K_R_bottom*AR_bottom, 0.1819, K_R_bottom, 0.3737, TR, 3, TF, -18, Q_R_bottom, -3.8197);

// Refrigerator door
const AR_door = (Hr - G.doorGap/2 - 2*G.packingPos) * (W - 2*G.packingPos) / 1e6;
const K_R_door = kExterior(tFdoor, TR, T0);
const Q_R_door = K_R_door * AR_door * (T0 - TR);
comp('R DOOR', AR_door, 0.775, K_R_door*AR_door, 0.1909, K_R_door, 0.2463, TR, 3, T0, 25, Q_R_door, 4.1992);

// Refrigerator packing
const AR_packin = ((Hr - 2*G.packingPos) + (W - 2*G.packingPos)) * 2 / 1000;
const Q_R_packin = PC.insulation.packing * AR_packin * (T0 - TR);
comp('R PACKIN', AR_packin, 3.566, PC.insulation.packing*AR_packin, 0.1248, PC.insulation.packing, 0.0350, TR, 3, T0, 25, Q_R_packin, 2.7458);

// Refrigerator back (faces T_wallBack) – wait, in the bottom-freezer, the refrigerator is on top, its back might be exposed to ambient or machine? The Excel shows "R BACK" with outside temp 55.40 (Cab Bottom). So we use T_wallBack.
const AR_back = (Hr - (tFbottom + tRbottom1)/2 - G.Hb) * (W - (tFleft+tFright)/2) / 1e6;
const K_R_back = kExterior(tRback, TR, T_wallBack);  // tRback is the refrigerator back thickness (80)
const Q_R_back = K_R_back * AR_back * (T_wallBack - TR);
comp('R BACK', AR_back, 0.317, K_R_back*AR_back, 0.0594, K_R_back, 0.1877, TR, 3, T_wallBack, 55.40, Q_R_back, 4.3616);  // Excel shows 4.3616 for F BACK? Wait, the Excel labels are confusing. In the SIZE sheet you provided, "F BACK" is listed under the freezer section, with Q=4.3616. That's actually the freezer back. The refrigerator back is not explicitly listed? Let's check: in the SIZE sheet you gave, under "R BACK" there is no entry because the refrigerator back is perhaps the same as the freezer back? Actually the original sheet had both F BACK and R BACK, but in the bottom-freezer they swapped labels. We'll use the value from the sheet: there is "F BACK" with Q=4.3616, which corresponds to the freezer back (bottom). So for the refrigerator (top), the back might be different. I need to re-examine the corrected SIZE sheet you provided earlier. It shows:
// R BACK (under R section) with Q=7.0618? No, that was the SJ-540. For PV73K, the "F BACK" in the freezer section is 4.3616. The refrigerator back might be the same wall? Given the confusion, let's rely on the original Excel labels: In the bottom-freezer SIZE sheet, the rows are labeled with R and F according to the original (top-freezer) convention, so R BACK is the freezer back. So the refrigerator back does not have a separate entry; it's probably lumped with something else. I'll note this discrepancy and move on.

// Evaporator back (freezer back)
const A_evaBack = (W - (tRleft+tRright)/2) * (Hf - (tRtop + tRbottom1)/2) / 1e6;
const K_evaBack = kExterior(tEvaBack, T2, T_back);
const Q_evaBack = K_evaBack * A_evaBack * (T_back - T2);
comp('EVA BACK', A_evaBack, 0.741, K_evaBack*A_evaBack, 0.1784, K_evaBack, 0.2407, T2, -19.5, T_back, 26.71, Q_evaBack, 8.2462);

// Fan load
const fanLoad = 2.4 * 0.86 * PR;
console.log(`FAN LOAD: ${fanLoad.toFixed(4)} | 1.6095`);

// Partition losses (DPCON1, DPCON2) for freezer (bottom)
const DPCON1_F = (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR)) * (W - tRleft - tRright) / 1000;
console.log(`F DPCON1: ${DPCON1_F.toFixed(4)} | 4.7592`);

const DPCON2_F = (0.0791*(TC-TF)-0.072*(T0-TF)) * PR * (Hf*2 + W) / 1000;
console.log(`F DPCON2: ${DPCON2_F.toFixed(4)} | 4.7895`);

// Refrigerator partition loss (DPCON R)
const DPCON_R = (0.0546*(TC-TF)-0.0491*(T0-TF)) * PR * (Hr*2 + W) / 1000;
console.log(`R DPCON: ${DPCON_R.toFixed(4)} | 2.6613`);