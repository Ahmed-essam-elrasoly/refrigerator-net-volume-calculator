import { compressorState } from './compressor.js';
import { calcHeatLoads } from './heatLoad.js';
import { calcQCout, calcQCin, computeCondenserAreas } from './condenser.js';

function newtonSolve(F, x0, dx, tol, maxIter) {
  const n = x0.length;
  let x = x0.slice();
  for (let iter = 0; iter < maxIter; iter++) {
    const f = F(x);
    if (Math.max(...f.map(Math.abs)) <= tol) return { x, converged: true, iterations: iter+1 };
    const J = Array.from({ length: n }, () => new Array(n));
    for (let j = 0; j < n; j++) {
      const xPert = x.slice(); xPert[j] += dx;
      const fPert = F(xPert);
      for (let i = 0; i < n; i++) J[i][j] = (fPert[i] - f[i]) / dx;
    }
    const A = J.map((row, i) => [...row, -f[i]]);
    for (let k = 0; k < n; k++) {
      if (Math.abs(A[k][k]) < 1e-12) return { x, converged: false, iterations: iter+1, error: 'Singular Jacobian' };
      for (let j = k; j <= n; j++) A[k][j] /= A[k][k];
      for (let i = 0; i < n; i++) {
        if (i === k) continue;
        const fac = A[i][k];
        for (let j = k; j <= n; j++) A[i][j] -= fac * A[k][j];
      }
    }
    for (let i = 0; i < n; i++) x[i] += A[i][n];
  }
  return { x, converged: false, iterations: maxIter, error: 'Max iterations' };
}

export function createInnerSolver(geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, innerOptions = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100 } = innerOptions;
  return function solveInner(TC, initialGuess = [-21.25, 0.59]) {
    const { T0, TF, TR } = fixedTemps;
    const F = (x) => {
      let [T2, PR] = x;
      PR = Math.max(0.001, Math.min(1, PR));
      const heatLoads = calcHeatLoads(geom, { T0, TF, TR, T2, TC, PR }, electrical);
      const TE = T2;
      const comp = compressorState(TC, TE, refrigerant, compParams, subcool);
      const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;
      const F2 = Qtotal - comp.coolingCapacity * PR;

      // Air distribution (as in Excel)
      const rho = 1.365;  // or from fan config
      const cp = 0.24;
      const T3 = T2 + heatLoads.QEV / (fan.totalAirflow * rho * cp * PR);
      const MR = TR !== T3 ? heatLoads.QR / (rho * cp * (TR - T3) * PR) : 0;
      const MF = fan.totalAirflow - Math.max(0, MR);
      const QF_prime = MF * rho * cp * (TF - T2) * PR;
      const F1 = heatLoads.QF - QF_prime;
      return [F1, F2];
    };

    const result = newtonSolve(F, initialGuess, dx, tol, maxIter);
    if (!result.converged) return { T2: result.x[0], PR: result.x[1], converged: false, error: result.error };
    const finalT2 = result.x[0], finalPR = Math.max(0.001, Math.min(1, result.x[1]));
    const finalHeatLoads = calcHeatLoads(geom, { T0: fixedTemps.T0, TF: fixedTemps.TF, TR: fixedTemps.TR, T2: finalT2, TC, PR: finalPR }, electrical);
    const finalComp = compressorState(TC, finalT2, refrigerant, compParams, subcool);
    return {
      T2: finalT2,
      PR: finalPR,
      converged: true,
      iterations: result.iterations,
      heatLoads: finalHeatLoads,
      compressor: finalComp,
    };
  };
}

export function solveThermalSystem(config) {
  const {
    geom,
    compParams,
    condenserConfig,
    refrigerant,
    subcool,
    dischargeTemp,
    fixedTemps,
    fan,
    electrical,
    TC0 = 54.4,
    DH = 0.001,
    tolOuter = 0.0005,
    maxIterOuter = 100,
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
        outerIterations: iter+1, innerTotalIterations: totalInnerIters,
        heatLoads: inner.heatLoads, compressor: inner.compressor,
      };
    }

    const innerPert = innerSolver(TC + DH, [inner.T2, inner.PR]);
    if (!innerPert.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Perturbation inner loop failed' };
    totalInnerIters += innerPert.iterations;
    const QCoutPert = calcQCout(TC + DH, fixedTemps.T0, fixedTemps.TF, condenserAreas);
    const QCinPert = calcQCin(TC + DH, innerPert.T2, refrigerant, compParams, subcool, dischargeTemp);
    const dF3dTC = ( (QCoutPert - QCinPert) - F3 ) / DH;
    if (Math.abs(dF3dTC) < 1e-9) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative' };
    TC -= F3 / dF3dTC;
  }
  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations' };
}