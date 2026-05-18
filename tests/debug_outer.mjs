// tests/debug_outer.mjs
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

// ------------------------------------------------------------------
// Exact replica of the inner 2×2 Newton solver, with iteration log
// ------------------------------------------------------------------
function newtonSolve2x2(F, x0, dx, tol, maxIter) {
  let x = [x0[0], x0[1]];
  for (let iter = 0; iter < maxIter; iter++) {
    const f = F(x);
    const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));
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
      return { x, converged: false, iterations: iter+1, error: 'Singular Jacobian' };
    }
    const dxT2 = (-f[0]*J[1][1] + f[1]*J[0][1]) / det;
    const dxPR = ( J[0][0]*(-f[1]) + J[1][0]*f[0]) / det;
    x[0] = Math.max(-80, Math.min(20, x[0] + dxT2));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + dxPR));
  }
  return { x, converged: false, iterations: maxIter, error: 'Max iterations' };
}

function solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserRises, innerOpts = {}) {
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
      throw new Error(`calcHeatLoads returned NaN at TC=${TC} T2=${T2} PR=${PR}`);
    }
    if (isNaN(comp.coolingCapacity)) {
      throw new Error(`compressorState returned NaN at TC=${TC} TE=${TE}`);
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
    console.log(`  Inner exception at TC=${TC}: ${err.message}`);
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

// ------------------------------------------------------------------
// Outer solver with logging
// ------------------------------------------------------------------
function solveThermalSystemLogged(config) {
  const {
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp,
    fixedTemps, fan, electrical,
    TC0 = 54.4, DH = 0.001, tolOuter = 0.0005, maxIterOuter = 100,
    innerOptions = {},
  } = config;

  const areas = computeCondenserAreas(geom, condenserConfig);
  const T0 = fixedTemps.T0;

  const sideRisePerK = condenserConfig.K_side / 10;
  const backRisePerK = condenserConfig.K_back / 10;

  let TC = TC0;
  let totalInnerIters = 0;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    console.log(`\nOuter iteration ${iter}, TC=${TC.toFixed(2)}`);
    const cr = {
      side: sideRisePerK * (TC - T0),
      back: backRisePerK * (TC - T0),
    };
    const inner = solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, cr, innerOptions);
    if (!inner.converged) {
      console.log(`  Inner failed: ${inner.error}`);
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Inner loop failed' };
    }
    totalInnerIters += inner.iterations;
    console.log(`  Inner converged in ${inner.iterations} iters → T2=${inner.T2.toFixed(3)}, PR=${(inner.PR*100).toFixed(1)}%`);

    const QCout = calcQCout(TC, T0, fixedTemps.TF, fixedTemps.TR, areas);
    const QCin = calcQCin(TC, fixedTemps.TE, refrigerant, compParams, subcool, dischargeTemp);
    const F3 = QCout - QCin;
    console.log(`  QCout=${QCout.toFixed(2)}, QCin=${QCin.toFixed(2)}, F3=${F3.toFixed(4)}`);

    if (Math.abs(F3) < tolOuter) {
      return {
        TC, T2: inner.T2, PR: inner.PR, converged: true,
        outerIterations: iter + 1, innerTotalIterations: totalInnerIters,
        heatLoads: inner.heatLoads, compressor: inner.compressor,
      };
    }

    // Perturb
    const crPert = {
      side: sideRisePerK * (TC + DH - T0),
      back: backRisePerK * (TC + DH - T0),
    };
    const innerPert = solveInner(TC + DH, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, crPert, innerOptions);
    if (!innerPert.converged) {
      console.log(`  Perturbation inner failed at TC=${(TC+DH).toFixed(3)}: ${innerPert.error}`);
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Perturbation inner loop failed' };
    }
    totalInnerIters += innerPert.iterations;

    const QCoutPert = calcQCout(TC + DH, T0, fixedTemps.TF, fixedTemps.TR, areas);
    const QCinPert = calcQCin(TC + DH, fixedTemps.TE, refrigerant, compParams, subcool, dischargeTemp);
    const dF3dTC = ((QCoutPert - QCinPert) - F3) / DH;
    if (Math.abs(dF3dTC) < 1e-9) {
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative' };
    }
    const dTC = F3 / dF3dTC;
    // Limit step to 2°C
    TC -= Math.max(-2, Math.min(2, dTC));
  }
  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations' };
}

// ------------------------------------------------------------------
// Main: run with your configuration
// ------------------------------------------------------------------
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

const config = {
  geom,
  compParams: { ...SJ54H_COMPONENTS.compressor },
  condenserConfig,
  refrigerant: 'R-600a',
  subcool: SJ54H_COMPONENTS.subcool_K,
  dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
  fixedTemps: { T0: 30, TF: -18, TR: 3, TE: -23.3 },
  fan: { totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h, inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W },
  electrical: { ...SJ54H_COMPONENTS.electrical },
  TC0: 45,
  DH: 0.001,
  tolOuter: 0.001,
  maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
};

console.log('=== Full outer solver with logging ===');
const result = solveThermalSystemLogged(config);

if (result.converged) {
  console.log('\n✅ Final converged solution:');
  console.log(`TC = ${result.TC.toFixed(2)} °C`);
  console.log(`T2 = ${result.T2.toFixed(2)} °C`);
  console.log(`PR = ${(result.PR * 100).toFixed(1)} %`);
  console.log(`Heat loads: QF=${result.heatLoads.QF.toFixed(2)}, QR=${result.heatLoads.QR.toFixed(2)}, QEV=${result.heatLoads.QEV.toFixed(2)} kcal/h`);
  console.log(`Comp cooling = ${result.compressor.coolingCapacity.toFixed(2)} kcal/h`);
} else {
  console.log(`\n❌ Failed: ${result.error}`);
  console.log(`Last TC = ${result.TC.toFixed(2)}`);
}