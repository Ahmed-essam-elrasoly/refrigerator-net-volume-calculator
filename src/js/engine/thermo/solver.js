import { compressorState } from './compressor.js';
import { calcHeatLoads } from './heatLoad.js';
import { calcQCout, calcQCin, computeCondenserAreas } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';

// ---- Helper: 2×2 Newton solver (Cramer's rule) ----
function newtonSolve2x2(F, x0, dx, tol, maxIter) {
  let x = [x0[0], x0[1]];
  for (let iter = 0; iter < maxIter; iter++) {
    const f = F(x);
    if (Math.max(Math.abs(f[0]), Math.abs(f[1])) <= tol) {
      return { x, converged: true, iterations: iter + 1 };
    }
    // Compute Jacobian
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

/**
 * Inner solver – exact Excel MAIN sheet F1,F2 equations.
 * Returns { T2, PR, heatLoads, compressor, converged, iterations }
 */
function solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserRises, innerOpts = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100 } = innerOpts;
  const { T0, TF, TR, TE } = fixedTemps;
  const rho = PHYSICAL_CONSTANTS.air.density;
  const cp = PHYSICAL_CONSTANTS.air.cp;

  // Initial guess (from Excel converged values, but can be anything)
  let T2_guess = -21.2483;
  let PR_guess = 0.59056;

const F = (x) => {
  const T2 = x[0];
  const PR = x[1];
  
  // Dynamic condenser temperature rises (average over cycle)
  const sideRise = PR * (condenserConfig.K_side / 10) * (TC - T0);
  const backRise = PR * (condenserConfig.K_back / 10) * (TC - T0);
  const condenserRises = { side: sideRise, back: backRise };
  
  const temps = { T0, TF, TR, T2, TC, PR, TE };
  const heatLoads = calcHeatLoads(geom, temps, electrical, condenserRises, fan.totalAirflow, geom.evap, fan.inputPower_W);
  const comp = compressorState(TC, TE, refrigerant, compParams, subcool);// In solver.js, inside solveInner, right after calcHeatLoads:
    const loads = calcHeatLoads(geom, temps, electrical, condenserRises, fan.totalAirflow, geom.evap, fan.inputPower_W);
    console.log({
      QF: loads.QF, QR: loads.QR, QEV: loads.QEV,
      fanLoad: loads.fanLoad, defrostLoad: loads.defrostLoad,
      // Add all area terms & k-values
      AFtop, AFleft, AFright, AFbottom, AFdoor, AFpackin,
      k_top: kUrethane(tFtop),
      // ...
    });
    // ── NaN guard: catch bad inputs before they silently poison the Jacobian ──
    if (isNaN(heatLoads.QF) || isNaN(heatLoads.QR) || isNaN(heatLoads.QEV)) {
      const bad = { QF: heatLoads.QF, QR: heatLoads.QR, QEV: heatLoads.QEV };
      throw new Error(
        `calcHeatLoads returned NaN at TC=${TC.toFixed(3)} T2=${T2.toFixed(3)} PR=${PR.toFixed(4)}\n` +
        `  loads: ${JSON.stringify(bad)}\n` +
        `  temps keys: ${Object.keys(temps).join(', ')}\n` +
        `  fanAirflow: ${fan.totalAirflow}, geom.evap defined: ${!!geom.evap}`
      );
    }
    if (isNaN(comp.coolingCapacity)) {
      throw new Error(`compressorState returned NaN coolingCapacity at TC=${TC}, TE=${TE}`);
    }    const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;
    const F2 = Qtotal - comp.coolingCapacity * PR;

    // Air volume split (Excel E14, E15)
    const denom = fan.totalAirflow * rho * cp * PR;
    let F1;
    if (Math.abs(denom) < 1e-12) {
      F1 = heatLoads.QF;
    } else {
      const T3 = T2 + heatLoads.QEV / denom;
      const MR = (Math.abs(TR - T3) < 1e-9) ? 0 : heatLoads.QR / (rho * cp * (TR - T3) * PR);
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
      return { T2: NaN, PR: NaN, converged: false, error: err.message };
    }
  if (!result.converged) {
    return { T2: result.x[0], PR: result.x[1], converged: false, error: result.error };
  }
  const finalT2 = result.x[0];
  const finalPR = result.x[1];
  const finalTemps = { T0, TF, TR, T2: finalT2, TC, PR: finalPR, TE };
  const finalHeatLoads = calcHeatLoads(geom, finalTemps, electrical, condenserRises, fan.totalAirflow, geom.evap);
  const finalComp = compressorState(TC, TE, refrigerant, compParams, subcool);
  return {
    T2: finalT2, PR: finalPR, converged: true,
    iterations: result.iterations,
    heatLoads: finalHeatLoads, compressor: finalComp,
  };
}

/**
 * Outer solver – adjusts TC until QCout = QCin (Excel Macro1)
 */
export function solveThermalSystem(config) {
  const {
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp,
    fixedTemps, fan, electrical,
    TC0 = 54.4, DH = 0.001, tolOuter = 0.0005, maxIterOuter = 100,
    innerOptions = {},
  } = config;

  const areas = computeCondenserAreas(geom, condenserConfig);
  const T0 = fixedTemps.T0;

  // Pre‑compute the temperature rise factors (same as Excel H50, H51)
  const sideRisePerK = condenserConfig.K_side / 10;   // K_side in kcal/h·m²·°C
  const backRisePerK = condenserConfig.K_back / 10;

  let TC = TC0;
  let totalInnerIters = 0;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    const cr = {
      side: sideRisePerK * (TC - T0),
      back: backRisePerK * (TC - T0),
    };
    const inner = solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, cr, innerOptions);
    if (!inner.converged) {
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Inner loop failed' };
    }
    totalInnerIters += inner.iterations;

    const QCout = calcQCout(TC, T0, fixedTemps.TF, fixedTemps.TR, areas);
    const QCin = calcQCin(TC, fixedTemps.TE, refrigerant, compParams, subcool, dischargeTemp);
    const F3 = QCout - QCin;
    if (Math.abs(F3) < tolOuter) {
      return {
        TC, T2: inner.T2, PR: inner.PR, converged: true,
        outerIterations: iter + 1, innerTotalIterations: totalInnerIters,
        heatLoads: inner.heatLoads, compressor: inner.compressor,
      };
    }

    // Perturbation for derivative
    const crPert = {
      side: sideRisePerK * (TC + DH - T0),
      back: backRisePerK * (TC + DH - T0),
    };
    const innerPert = solveInner(TC + DH, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, crPert, innerOptions);
    if (!innerPert.converged) {
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
    TC -= Math.max(-2, Math.min(2, dTC));   // cap at ±2 °C
  }
  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations' };
}