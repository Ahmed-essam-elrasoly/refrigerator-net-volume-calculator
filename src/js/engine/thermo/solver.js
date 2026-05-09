// src/js/engine/thermo/solver.js
import { compressorState } from './compressor.js';
import { calcHeatLoads } from './heatLoad.js';
import { calcQCout, calcQCin, computeCondenserAreas } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';

// ---------------------------------------------------------------------------
// Newton solver for 2‑variable system (T2, PR) – Cramer’s rule
// ---------------------------------------------------------------------------
function newtonSolve(F, x0, dx, tol, maxIter) {
  let x = [x0[0], x0[1]];

  for (let iter = 0; iter < maxIter; iter++) {
    const f = F(x);
    const res = Math.max(...f.map(Math.abs));

    if (res <= tol) {
      console.log(`Converged in ${iter+1} iterations.`);
      return { x, converged: true, iterations: iter + 1 };
    }

    // Build Jacobian by finite differences
    const J = [[0, 0], [0, 0]];
    for (let j = 0; j < 2; j++) {
      const xPert = [x[0], x[1]];
      xPert[j] += dx;
      const fPert = F(xPert);
      for (let i = 0; i < 2; i++) {
        J[i][j] = (fPert[i] - f[i]) / dx;
      }
    }

// For n=2, Cramer’s rule is simpler and faster than LU/Gaussian elimination.
// If the system ever expands to more unknowns, switch to LU with partial pivoting.
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];    if (Math.abs(det) < 1e-12) {
      return { x, converged: false, iterations: iter + 1, error: 'Singular Jacobian' };
    }

    const stepT2 = (-f[0] * J[1][1] + f[1] * J[0][1]) / det;
    const stepPR = ( J[0][0] * (-f[1]) + J[1][0] * f[0]) / det;   // correct formula


    // Apply step with hard physical bounds
    x[0] = Math.max(-80, Math.min(20, x[0] + stepT2));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + stepPR));

  }

  return { x, converged: false, iterations: maxIter, error: 'Max iterations' };
}

// ---------------------------------------------------------------------------
// Inner solver (unchanged, except F is unclamped)
// ---------------------------------------------------------------------------
export function createInnerSolver(geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, innerOptions = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100 } = innerOptions;
  const { T0, TF, TR, TE } = fixedTemps;
  const rho = PHYSICAL_CONSTANTS.air.density;
  const cp = PHYSICAL_CONSTANTS.air.cp;

  return function solveInner(TC, initialGuess = null) {
    const T2_guess = initialGuess ? initialGuess[0] : -21.2483006297973;
    const PR_guess = initialGuess ? initialGuess[1] : 0.5905646101665666;

    const F = (x) => {
      const T2 = x[0];
      const PR = x[1];
      const temps = { T0, TF, TR, T2, TC, PR };
      const heatLoads = calcHeatLoads(geom, temps, electrical);
      const comp = compressorState(TC, TE, refrigerant, compParams, subcool);
      const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;
      const F2 = Qtotal - comp.coolingCapacity * PR;

      const denom = fan.totalAirflow * rho * cp * PR;
      let F1;
      if (denom < 1e-12) {
        F1 = heatLoads.QF;
      } else {
        const T3 = T2 + heatLoads.QEV / denom;
        const MR = (Math.abs(TR - T3) < 1e-9) ? 0
                   : heatLoads.QR / (rho * cp * (TR - T3) * PR);
        const MF = fan.totalAirflow - MR;
        const QF_prime = MF * rho * cp * (TF - T2) * PR;
        F1 = heatLoads.QF - QF_prime;
      }
      return [F1, F2];
    };

    const result = newtonSolve(F, [T2_guess, PR_guess], dx, tol, maxIter);
    if (!result.converged) {
      return { T2: result.x[0], PR: result.x[1], converged: false, error: result.error };
    }

    const finalT2 = result.x[0];
    const finalPR = result.x[1];
    const temps = { T0, TF, TR, T2: finalT2, TC, PR: finalPR };
    const finalHeatLoads = calcHeatLoads(geom, temps, electrical);
    const finalComp = compressorState(TC, TE, refrigerant, compParams, subcool);
    return {
      T2: finalT2, PR: finalPR, converged: true, iterations: result.iterations,
      heatLoads: finalHeatLoads, compressor: finalComp,
    };
  };
}
// ---------------------------------------------------------------------------
// Outer solver (unchanged)
// ---------------------------------------------------------------------------
export function solveThermalSystem(config) {
  const {
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp,
    fixedTemps, fan, electrical,
    TC0 = 54.4, DH = 0.001, tolOuter = 0.0005, maxIterOuter = 100,
    innerOptions = {},
  } = config;

  const innerSolver = createInnerSolver(geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, innerOptions);
  const condenserAreas = computeCondenserAreas(geom, condenserConfig);
  let TC = TC0;
  let totalInnerIters = 0;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    const inner = innerSolver(TC);
    if (!inner.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Inner loop failed' };
    totalInnerIters += inner.iterations;

    const QCout = calcQCout(TC, fixedTemps.T0, fixedTemps.TF, condenserAreas);
    const QCin = calcQCin(TC, inner.T2, refrigerant, compParams, subcool, dischargeTemp);
    const F3 = QCout - QCin;
    if (Math.abs(F3) < tolOuter) {
      return {
        TC, T2: inner.T2, PR: inner.PR, converged: true,
        outerIterations: iter + 1, innerTotalIterations: totalInnerIters,
        heatLoads: inner.heatLoads, compressor: inner.compressor,
      };
    }

    const innerPert = innerSolver(TC + DH);
    if (!innerPert.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Perturbation inner loop failed' };
    totalInnerIters += innerPert.iterations;
    const QCoutPert = calcQCout(TC + DH, fixedTemps.T0, fixedTemps.TF, condenserAreas);
    const QCinPert = calcQCin(TC + DH, innerPert.T2, refrigerant, compParams, subcool, dischargeTemp);
    const dF3dTC = ((QCoutPert - QCinPert) - F3) / DH;
    if (Math.abs(dF3dTC) < 1e-9) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative' };
    TC -= F3 / dF3dTC;
  }
  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations' };
}