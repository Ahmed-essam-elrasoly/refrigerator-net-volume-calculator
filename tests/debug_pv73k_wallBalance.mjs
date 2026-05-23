// tests/debug_pv73k_wallBalance.mjs
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { computeCondenserAreas } from '../src/js/engine/thermo/condenser.js';

// PV73K geometry (exact from Excel)
const geom = {
  H: 1794, W: 795, D: 687, Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
};

const condenserConfig = {
  K_side: 5.395,
  K_back: 4.17,
  backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

const areas = computeCondenserAreas(geom, condenserConfig);

const T0 = 25, TF = -18, TR = 3;
const TC = 48.0, PR = 0.77977;   // Excel converged
const TE = -23.02, T2 = -19.5;   // Excel TE, T2

// -------------------------------------------------------------------
// Helper: compute total side‑wall heat loss for a given T_side
// (with T_back = T0 to eliminate back contribution)
// -------------------------------------------------------------------
function sideWallLoss(T_side) {
  const loads = calcHeatLoads(
    geom,
    { T0, TF, TR, T2, TC, PR, TE },
    { defrostHeater_W: 0, defrostOn_min: 0 },   // zero fan/defrost
    { side: T_side - T0, back: 0 },            // back rise = 0 → T_back = T0
    146.4, geom, 0                              // fan power 0
  );
  return loads.QF + loads.QR;   // total heat loss from all walls
}

// Same for back wall
function backWallLoss(T_back) {
  const loads = calcHeatLoads(
    geom,
    { T0, TF, TR, T2, TC, PR, TE },
    { defrostHeater_W: 0, defrostOn_min: 0 },
    { side: 0, back: T_back - T0 },             // side rise = 0
    146.4, geom, 0
  );
  return loads.QF + loads.QR;
}

// -------------------------------------------------------------------
// Solve T_side from: K_side * A_side * (TC - T_side) * PR  =  Q_loss_side(T_side)
//   where Q_loss_side(T_side) = sideWallLoss(T_side)
// This is a single non‑linear equation (λ depends on T_side), so we iterate.
// -------------------------------------------------------------------
function solveSideWallTemp() {
  let T = T0 + 2;   // initial guess
  for (let i = 0; i < 30; i++) {
    const Q_cond = areas.sideKA * (TC - T) * PR;      // kcal/h
    const Q_loss = sideWallLoss(T);                   // kcal/h
    const err = Q_cond - Q_loss;
    // If converged
    if (Math.abs(err) < 0.001) return T;
    // Simple step: adjust T based on sign of error
    // Use a damped Newton: dT = err / (derivative approx)
    const Q_loss_pert = sideWallLoss(T + 0.1);
    const dQ_loss = (Q_loss_pert - Q_loss) / 0.1;
    const dQ_cond = -areas.sideKA * PR;   // derivative of Q_cond w.r.t T
    const totalDeriv = dQ_cond - dQ_loss;
    if (Math.abs(totalDeriv) < 1e-9) break;
    T -= err / totalDeriv;
    T = Math.max(T0, Math.min(TC, T));
  }
  return T;
}

function solveBackWallTemp() {
  let T = T0 + 1.7;
  for (let i = 0; i < 30; i++) {
    const Q_cond = areas.backKA * (TC - T) * PR;
    const Q_loss = backWallLoss(T);
    const err = Q_cond - Q_loss;
    if (Math.abs(err) < 0.001) return T;
    const Q_loss_pert = backWallLoss(T + 0.1);
    const dQ_loss = (Q_loss_pert - Q_loss) / 0.1;
    const dQ_cond = -areas.backKA * PR;
    const totalDeriv = dQ_cond - dQ_loss;
    if (Math.abs(totalDeriv) < 1e-9) break;
    T -= err / totalDeriv;
    T = Math.max(T0, Math.min(TC, T));
  }
  return T;
}

console.log('=== PV73K Wall Temperature Diagnostic ===');
const T_side = solveSideWallTemp();
const T_back = solveBackWallTemp();
console.log(`Condenser areas: side = ${areas.sideArea.toFixed(3)} m², back = ${areas.backArea.toFixed(3)} m²`);
console.log(`Side KA = ${areas.sideKA.toFixed(2)} kcal/h·°C, Back KA = ${areas.backKA.toFixed(2)} kcal/h·°C`);
console.log(`Solved T_side = ${T_side.toFixed(2)} °C  → rise = ${(T_side - T0).toFixed(2)} °C (Excel: 27.22 → 2.22 °C)`);
console.log(`Solved T_back = ${T_back.toFixed(2)} °C  → rise = ${(T_back - T0).toFixed(2)} °C (Excel: 26.71 → 1.71 °C)`);

// Verify the final heat balances
const sideBalance = areas.sideKA * (TC - T_side) * PR - sideWallLoss(T_side);
const backBalance = areas.backKA * (TC - T_back) * PR - backWallLoss(T_back);
console.log(`Residuals: side balance = ${sideBalance.toFixed(4)} kcal/h, back balance = ${backBalance.toFixed(4)} kcal/h`);