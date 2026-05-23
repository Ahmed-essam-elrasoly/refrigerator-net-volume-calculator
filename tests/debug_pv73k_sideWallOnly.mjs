// tests/debug_pv73k_sideWallOnly.mjs
import { PHYSICAL_CONSTANTS as PC } from '../src/js/engine/thermo/constants.js';
import { computeCondenserAreas } from '../src/js/engine/thermo/condenser.js';

// --- Urethane lambda and K-value (same as heatLoad.js) ---
function lambdaUrethane(T_in, T_out) {
  return 0.0165 + 0.00011 * (T_in + T_out) / 2;   // Excel formula
}
function kExterior(thk_mm, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  const m = thk_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + m/lam);
}

// PV73K geometry
const geom = {
  H: 1794, W: 795, D: 687, Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
};
const condenserConfig = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};
const areas = computeCondenserAreas(geom, condenserConfig);

const T0 = 25, TF = -18, TR = 3, TC = 48.0, PR = 0.77977;

// --- Side‑wall areas (same as in calcHeatLoads) ---
const { tFleft, tFright, tFtop, tFbottom, tEvaBack, tRleft, tRright, tRback, tRtop, tRbottom1, tRbottom3,
        Hf, Hr, W, D, Hb, Db1, Db2 } = geom;

const AFleft   = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;  // 0.6625 m²
const rSideHeight = Hr - (tFbottom + tRbottom1)/2;                       // 746 - (32+76)/2 = 692 mm
const ARleft   = (rSideHeight * (D - tRback/2) - (Db1 + Db2) * Hb / 2) / 1e6; // 0.3912 m²

// --- Side‑wall heat loss as a function of T_side ---
function sideWallHeatLoss(T_side) {
  const QFleft  = kExterior(tFleft, TF, T_side) * AFleft * (T_side - TF);
  const QFright = kExterior(tFright, TF, T_side) * AFleft * (T_side - TF);
  const QRleft  = kExterior(tRleft, TR, T_side) * ARleft * (T_side - TR);
  const QRright = kExterior(tRright, TR, T_side) * ARleft * (T_side - TR);
  return QFleft + QFright + QRleft + QRright;
}

// --- Solve T_side from: K_side * area_side * (TC - T_side) * PR = sideWallHeatLoss(T_side) ---
function solveSideTemp() {
  let T = T0 + 2;   // initial
  for (let i = 0; i < 30; i++) {
    const Q_cond = areas.sideKA * (TC - T) * PR;
    const Q_loss = sideWallHeatLoss(T);
    const err = Q_cond - Q_loss;
    if (Math.abs(err) < 0.001) return T;

    // numerical derivative
    const Q_loss_pert = sideWallHeatLoss(T + 0.1);
    const dQ_loss = (Q_loss_pert - Q_loss) / 0.1;
    const dQ_cond = -areas.sideKA * PR;
    const deriv = dQ_cond - dQ_loss;
    if (Math.abs(deriv) < 1e-9) break;
    T -= err / deriv;
    T = Math.max(T0, Math.min(TC, T));
  }
  return T;
}

// --- Back‑wall heat loss (R BACK + EVA BACK) ---
const ARback = (Hr - (tFbottom + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6; // 0.3166
const AEvaBack = (W - (tFleft + tFright)/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;        // ~0.741

function backWallHeatLoss(T_back) {
  // R BACK uses T_back as outside, inside TR
  const QRback = kExterior(geom.tRback, TR, T_back) * ARback * (T_back - TR);
  // EVA BACK uses T_back as outside, inside T2 (we'll use Excel T2 = -19.5)
  const QEvaBack = kExterior(geom.tEvaBack, -19.5, T_back) * AEvaBack * (T_back - (-19.5));
  return QRback + QEvaBack;
}

function solveBackTemp() {
  let T = T0 + 1.7;
  for (let i = 0; i < 30; i++) {
    const Q_cond = areas.backKA * (TC - T) * PR;
    const Q_loss = backWallHeatLoss(T);
    const err = Q_cond - Q_loss;
    if (Math.abs(err) < 0.001) return T;
    const Q_loss_pert = backWallHeatLoss(T + 0.1);
    const dQ_loss = (Q_loss_pert - Q_loss) / 0.1;
    const dQ_cond = -areas.backKA * PR;
    const deriv = dQ_cond - dQ_loss;
    if (Math.abs(deriv) < 1e-9) break;
    T -= err / deriv;
    T = Math.max(T0, Math.min(TC, T));
  }
  return T;
}

console.log('=== PV73K Wall Temperature (isolated side/back) ===');
const T_side = solveSideTemp();
const T_back = solveBackTemp();
console.log(`Side wall area: freezer ${AFleft.toFixed(3)} ×2, refrigerator ${ARleft.toFixed(3)} ×2`);
console.log(`Side KA = ${areas.sideKA.toFixed(2)}, Back KA = ${areas.backKA.toFixed(2)}`);
console.log(`Solved T_side = ${T_side.toFixed(2)} °C  → rise = ${(T_side - T0).toFixed(2)} °C (Excel 2.22)`);
console.log(`Solved T_back = ${T_back.toFixed(2)} °C  → rise = ${(T_back - T0).toFixed(2)} °C (Excel 1.71)`);
console.log(`Side balance residual: ${(areas.sideKA*(TC - T_side)*PR - sideWallHeatLoss(T_side)).toFixed(4)} kcal/h`);
console.log(`Back balance residual: ${(areas.backKA*(TC - T_back)*PR - backWallHeatLoss(T_back)).toFixed(4)} kcal/h`);