// tests/debug_inner.mjs
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

// Copy of the inner solver with logging
function newtonSolve2x2(F, x0, dx, tol, maxIter) {
  let x = [x0[0], x0[1]];
  for (let iter = 0; iter < maxIter; iter++) {
    const f = F(x);
    const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));
    console.log(`  Iter ${iter}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)}  F1=${f[0].toFixed(6)} F2=${f[1].toFixed(6)}  max|F|=${maxAbsF.toExponential(2)}`);
    if (maxAbsF <= tol) {
      return { x, converged: true, iterations: iter + 1 };
    }
    // Jacobian
    const J = [[0,0],[0,0]];
    for (let j = 0; j < 2; j++) {
      const xPert = [x[0], x[1]];
      xPert[j] += dx;
      const fPert = F(xPert);
      J[0][j] = (fPert[0] - f[0]) / dx;
      J[1][j] = (fPert[1] - f[1]) / dx;
    }
    const det = J[0][0]*J[1][1] - J[0][1]*J[1][0];
    if (Math.abs(det) < 1e-12) {
      console.log('  Singular Jacobian');
      return { x, converged: false, iterations: iter+1, error: 'Singular Jacobian' };
    }
    const dxT2 = (-f[0]*J[1][1] + f[1]*J[0][1]) / det;
    const dxPR = ( J[0][0]*(-f[1]) + J[1][0]*f[0]) / det;
    x[0] = Math.max(-80, Math.min(20, x[0] + dxT2));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + dxPR));
  }
  return { x, converged: false, iterations: maxIter, error: 'Max iterations' };
}

function solveInnerLogged(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserRises, innerOpts = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100 } = innerOpts;
  const { T0, TF, TR, TE } = fixedTemps;
  const rho = PHYSICAL_CONSTANTS.air.density;
  const cp = PHYSICAL_CONSTANTS.air.cp;

  let T2_guess = -21.2483;
  let PR_guess = 0.59056;

  const F = (x) => {
    const T2 = x[0];
    const PR = x[1];
    const temps = { T0, TF, TR, T2, TC, PR, TE };
    const heatLoads = calcHeatLoads(geom, temps, electrical, condenserRises, fan.totalAirflow, geom.evap, fan.inputPower_W);
    const comp = compressorState(TC, TE, refrigerant, compParams, subcool);

    if (isNaN(heatLoads.QF) || isNaN(heatLoads.QR) || isNaN(heatLoads.QEV)) {
      throw new Error(`calcHeatLoads returned NaN`);
    }
    if (isNaN(comp.coolingCapacity)) {
      throw new Error(`compressorState returned NaN coolingCapacity`);
    }

    const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;
    const F2 = Qtotal - comp.coolingCapacity * PR;

    const denom = fan.totalAirflow * rho * cp * PR;
    let F1;
    if (Math.abs(denom) < 1e-12) {
      F1 = heatLoads.QF;
    } else {
      const T3 = T2 + heatLoads.QEV / denom;
      const MR = heatLoads.QR / (rho * cp * (TR - T3) * PR);
      const MF = fan.totalAirflow - MR;
      const QF_prime = MF * rho * cp * (TF - T2) * PR;
      F1 = heatLoads.QF - QF_prime;
    }
    return [F1, F2];
  };

  let result;
  try {
    result = newtonSolve2x2(F, [T2_guess, PR_guess], dx, tol, maxIter);
  } catch (err) {
    console.log('  Exception:', err.message);
    return { T2: NaN, PR: NaN, converged: false, error: err.message };
  }
  if (!result.converged) {
    return { T2: result.x[0], PR: result.x[1], converged: false, error: result.error };
  }
  const finalT2 = result.x[0];
  const finalPR = result.x[1];
  const finalTemps = { T0, TF, TR, T2: finalT2, TC, PR: finalPR, TE };
  const finalHeatLoads = calcHeatLoads(geom, finalTemps, electrical, condenserRises, fan.totalAirflow, geom.evap, fan.inputPower_W);
  const finalComp = compressorState(TC, TE, refrigerant, compParams, subcool);
  return {
    T2: finalT2, PR: finalPR, converged: true,
    iterations: result.iterations,
    heatLoads: finalHeatLoads, compressor: finalComp,
  };
}

// ---- Run for TC=45 (the failing first outer iteration) ----
const geom = { ...DEFAULT_GEOMETRY };
const condenserConfig = {
  K_side: SJ54H_COMPONENTS.condenser.K_side_kcalhm2C,
  K_back: SJ54H_COMPONENTS.condenser.K_back_kcalhm2C,
  backCondenserEfficiency: SJ54H_COMPONENTS.condenser.backCondenserEfficiency,
  k_RFront1: SJ54H_COMPONENTS.condenser.k_RFront1,
  k_RFront2: SJ54H_COMPONENTS.condenser.k_RFront2,
  k_FRPartition1: SJ54H_COMPONENTS.condenser.k_FRPartition1,
  k_FRPartition2: SJ54H_COMPONENTS.condenser.k_FRPartition2,
  k_FFront1: SJ54H_COMPONENTS.condenser.k_FFront1,
  k_FFront2: SJ54H_COMPONENTS.condenser.k_FFront2,
};
const sideRisePerK = condenserConfig.K_side / 10;
const backRisePerK = condenserConfig.K_back / 10;
const T0 = 30;
const TC = 45;
const condenserRises = {
  side: sideRisePerK * (TC - T0),
  back: backRisePerK * (TC - T0),
};

console.log(`\n=== Inner solver debug at TC=${TC} ===`);
const result = solveInnerLogged(
  TC,
  geom,
  SJ54H_COMPONENTS.compressor,
  'R-600a',
  SJ54H_COMPONENTS.subcool_K,
  { T0: 30, TF: -18, TR: 3, TE: -23.3 },
  { totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h, inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W },
  SJ54H_COMPONENTS.electrical,
  condenserRises,
  { dx: 0.001, tol: 1e-4, maxIter: 100 }
);

if (result.converged) {
  console.log(`✅ Converged! T2=${result.T2.toFixed(2)}, PR=${(result.PR*100).toFixed(1)}%`);
} else {
  console.log(`❌ Failed: ${result.error}`);
}