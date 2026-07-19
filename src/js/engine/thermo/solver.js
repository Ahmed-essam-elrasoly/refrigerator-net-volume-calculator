// solver.js – Universal thermal solver (SI units, corrected)

import { calcHeatLoads } from './heatLoad.js';
import { calcQCout } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { compressorPower, getRefrigerantProperties, inverterCompressorPerformance } from './CompressorPerformance.js';

const RHO_AIR       = PHYSICAL_CONSTANTS.air.density;   // kg/m³
const CP_AIR        = PHYSICAL_CONSTANTS.air.cp;        // kJ/(kg·K)
const KELVIN_OFFSET = 273.16;

// Helper constants for air-side calculations
// Volumetric heat capacity: W per (m³/h) per K
const CV = RHO_AIR * CP_AIR * 1000 / 3600;   // (J/(m³·K)) / 3600 = W/(m³/h·K)

// Helpers & Safe Wrappers
function getRefrigerantIndex(name) {
  if (name === 'R-134a') return 1;
  if (name === 'R-600a') return 2;
  throw new Error(`Unsupported refrigerant: ${name}`);
}

/**
 * Unified compressor evaluation. If the compressor has inverter coefficients
 * and an RPM is provided, the inverter model is used; otherwise the
 * constant speed polynomial model is used.
 * @param {number} TE
 * @param {number} TC
 * @param {number} refIndex
 * @param {object} compParams
 * @param {number} [RPM] - Speed for inverter compressors (optional)
 * @returns {object}
 */
function evaluateCompressorSafely(TE, TC, refIndex, compParams, RPM) {
  if (compParams.compressorModel && typeof compParams.compressorModel === 'object') {
    if (!compParams.isInverter) {
      console.warn('compParams.isInverter is false but compressorModel exists — forcing inverter mode.');
    }
    return inverterCompressorPerformance(TE, TC, RPM, refIndex, compParams.compressorModel);
  }

  if (compParams.isInverter) {
    throw new Error('Inverter compressor selected but no fitted model. Re-load performance data in Advanced Settings.');
  }

  if (compParams.compressorModel && RPM !== undefined) {
    return inverterCompressorPerformance(TE, TC, RPM, refIndex, compParams.compressorModel);
  }

  if (compParams.useMap) {
    throw new Error('Compressor map logic is required but missing.');
  }
  if (!compParams.wCoeffs || !compParams.etaCoeffs) {
    throw new Error('Missing polynomial coefficients for constant speed compressor.');
  }

  return compressorPower(
    TE, TC, refIndex,
    compParams.wCoeffs, compParams.etaCoeffs,
    compParams.cylinderVolumeCm3 || compParams.Vc,
    compParams.speedRpm || compParams.rpm
  );
}

// 2x2 Newton-Raphson with damping & bounds checking
function newton2(F, x0, dx, tol, maxIter, bounds, debug = false) {
  const logger = {
    log: (...args) => debug && console.log(...args),
    table: (data) => debug && console.table(data),
  };

  let x = [...x0];
  let f, normF;

  try {
    f = F(x);
    normF = Math.sqrt(f[0] * f[0] + f[1] * f[1]);
  } catch (e) {
    logger.log('ERROR: Initial function evaluation failed.', e);
    return { x, f: [NaN, NaN], normF: NaN, converged: false, iterations: 0, error: `Initial F(x) failed: ${e.message}` };
  }

  for (let i = 0; i < maxIter; i++) {
    logger.log(
      `\n  Newton ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)}` +
      ` F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)} norm=${normF.toExponential(2)}`
    );

    if (normF <= tol) {
      logger.log(`  Convergence met: normF (${normF.toExponential(2)}) <= tol (${tol.toExponential(2)})`);
      return { x, f, normF, converged: true, iterations: i + 1 };
    }

    const J = [[0, 0], [0, 0]];
    try {
      for (let j = 0; j < 2; j++) {
        const h = Math.max(1e-7, Math.abs(x[j]) * 1e-6);
        const xp = [...x];
        xp[j] += h;
        const fp = F(xp);
        J[0][j] = (fp[0] - f[0]) / h;
        J[1][j] = (fp[1] - f[1]) / h;
      }
    } catch (e) {
      logger.log('ERROR: Jacobian evaluation failed.', e);
      return { x, f, normF, converged: false, iterations: i + 1, error: `Jacobian evaluation failed: ${e.message}` };
    }

    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (debug) {
      logger.log('    Jacobian:');
      logger.table(J.map(row => row.map(v => v.toExponential(3))));
      logger.log(`    det(J) = ${det.toExponential(3)}`);
    }

    let direction;
    if (Math.abs(det) > 1e-12) {
      const invDet = 1.0 / det;
      direction = [
        -invDet * (J[1][1] * f[0] - J[0][1] * f[1]),
        -invDet * (-J[1][0] * f[0] + J[0][0] * f[1])
      ];
      logger.log(`    Newton direction: [${direction[0].toExponential(3)}, ${direction[1].toExponential(3)}]`);
    } else {
      direction = [
        -(J[0][0] * f[0] + J[1][0] * f[1]),
        -(J[0][1] * f[0] + J[1][1] * f[1])
      ];
      logger.log(`    Singular Jacobian. Using Gradient Descent direction: [${direction[0].toExponential(3)}, ${direction[1].toExponential(3)}]`);
      const normGrad = Math.sqrt(direction[0]**2 + direction[1]**2);
      if (normGrad < 1e-12) {
        return { x, f, normF, converged: false, iterations: i + 1, error: 'Gradient is zero at a non-solution point (saddle or local minimum).' };
      }
    }

    let alpha = 1.0;
    const maxBacktracks = 15;
    let accept = false;
    let newX, newF, newNorm;

    for (let bt = 0; bt < maxBacktracks; bt++) {
      newX = [
        Math.max(bounds[0][0], Math.min(bounds[0][1], x[0] + alpha * direction[0])),
        Math.max(bounds[1][0], Math.min(bounds[1][1], x[1] + alpha * direction[1]))
      ];
      try {
        newF = F(newX);
        newNorm = Math.sqrt(newF[0] * newF[0] + newF[1] * newF[1]);
      } catch (e) {
        logger.log(`    Line search F(x) failed at α=${alpha.toExponential(2)}`, e);
        alpha *= 0.5;
        continue;
      }

      const sufficientDecrease = normF - 1e-4 * alpha * normF;
      logger.log(`      bt=${bt}, α=${alpha.toExponential(2)}, newNorm=${newNorm.toExponential(2)}, required < ${sufficientDecrease.toExponential(2)}`);
      if (newNorm < sufficientDecrease) {
        accept = true;
        break;
      }
      alpha *= 0.5;
    }

if (!accept) {
      // Check if we are mathematically pinned against a boundary
      const atLowerBound = Math.abs(x[1] - bounds[1][0]) < 1e-4;
      const atUpperBound = Math.abs(x[1] - bounds[1][1]) < 1e-4;

      if (atLowerBound && direction[1] < 0) {
        return { x, f, normF, converged: true, iterations: i + 1, warning: `Physical limit reached: Compressor oversized. The minimum limit produces too much capacity.` };
      }
      if (atUpperBound && direction[1] > 0) {
        return { x, f, normF, converged: true, iterations: i + 1, warning: `Physical limit reached: Compressor undersized. Required capacity exceeds maximum bounds.` };
      }

      return { x, f, normF, converged: false, iterations: i + 1, error: 'Line search failed - cannot find step size to reduce residual.' };
    }

    x = newX;
    f = newF;
    normF = newNorm;
    logger.log(`    Step accepted with α=${alpha.toExponential(2)}. New norm=${normF.toExponential(2)}`);
/** 
    const isClamped = (x[1] <= bounds[1][0] || x[1] >= bounds[1][1]);
    if (isClamped && i > 5 && normF > tol * 100) {
      const clampedAt = x[1] <= bounds[1][0] ? 'lower' : 'upper';
      const errorMsg = `PR clamped at ${clampedAt} bound (${x[1].toFixed(4)}) — compressor may be undersized or oversized.`;
      logger.log(`    WARNING: ${errorMsg}`);
      return { x, f, normF, converged: false, iterations: i + 1, error: errorMsg };
    }*/
  }

  return { x, f, normF, converged: false, iterations: maxIter, error: 'Max iterations reached' };
}

// Inner solver: (T2, PR) — Newton-Raphson
function solveInner(
  TC, geom, compParams, refrigerant, subcool,
  fixedTemps, fan, electrical, condenserConfig,
  TE, freezerPos, innerOpts = {},
  fixedPR, evapGeom
) {
  const {
    tol      = 1e-4,
    maxIter  = 100,
    initialT2,
    initialPR,
    debug= true,
    debugHeatLoads= true,
    dx = 1e-3,
  } = innerOpts;

  const dx_steps = [dx, dx];
  const logger = { log: (...args) => debug && console.log(...args) };

  const { T0, TF, TR } = fixedTemps;
  const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };
  const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0;
  const backCondenser = condenserConfig.backCondenser ?? 'No';
  const refIndex = getRefrigerantIndex(refrigerant);

  if (compParams.isInverter && fixedPR === undefined) {
    throw new Error(
      'Inverter compressor selected but no fixed PR provided. ' +
      'Pass `inverterPR` in the configuration.'
    );
  }

  const isInverterMode = compParams.isInverter && fixedPR !== undefined;

  let bounds, initialGuess, variableNames;
  if (isInverterMode) {
    bounds = [
      [-80, 20],
      [compParams.rpmMin || 1000, compParams.rpmMax || 6000]
    ];
    initialGuess = [
      innerOpts.initialT2 ?? -21.25,
      innerOpts.initialRPM ?? (compParams.rpmMax ? (compParams.rpmMin + compParams.rpmMax) / 2 : 3000)
    ];
    variableNames = ['T2', 'RPM'];
  } else {
    bounds = [
      [-80, 20],
      [0.001, 0.999]
    ];
    
    // Explicitly enforce Option B (Bounds overriding) if forcePR is provided for constant speed
    if (innerOpts.forcePR !== undefined) {
      bounds[1] = [innerOpts.forcePR, innerOpts.forcePR];
    }
    
    initialGuess = [
      innerOpts.initialT2 ?? -21.25,
      innerOpts.forcePR ?? innerOpts.initialPR ?? 0.59
    ];
    variableNames = ['T2', 'PR'];
  }

  const F = (vars) => {
    const T2 = vars[0];
    const secondVar = vars[1];
    const PR = isInverterMode ? fixedPR : secondVar;
    const RPM = isInverterMode ? secondVar : undefined;
    
    // 1. Calculate loads using a placeholder TE (loads function shouldn't depend heavily on TE directly for sensible calculations)
    let loads = calcHeatLoads(
        geom, 
        { T0, TF, TR, T2, TC, PR, TE: -25 }, // TE here only affects minor parasitic logic if any
        electrical, 
        PIPEPITCH, 
        backCondenserEfficiency, 
        fan.inputPower_W ?? 2.1, 
        freezerPos, 
        backCondenser
    );

// 2. Determine Required LMTD
    const total_load = loads.QF + loads.QR + loads.QEV;
    const evapWidth_m = (evapGeom?.evapWidth_mm ?? 460) / 1000;
    const evapDepth_m = (evapGeom?.evapDepth_mm ?? 60) / 1000;
    const evapArea_m2 = evapGeom?.evapArea_m2 ?? 1.754;
    
    const faceArea = evapWidth_m * evapDepth_m;
    const v_ms = fan.totalAirflow / faceArea / 3600;
    const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
    const LMTD_req = (total_load / PR) / (alpha * evapArea_m2);

    // 3. Calculate Mixed Return Air (T1)
    const C_tot = fan.totalAirflow * CV;
    const T3 = T2 + loads.QEV / (C_tot * PR);
    const denomR = CV * Math.max(0.01, TR - T3) * PR;
    const MR = denomR > 0 ? Math.min(fan.totalAirflow, Math.max(0, loads.QR / denomR)) : 0;
    const MF = fan.totalAirflow - MR;
    const T1 = (MF * TF + MR * TR) / fan.totalAirflow;

    // 4. Deterministically Find TE
    const calculated_TE = solveTE_Brent(T1, T2, LMTD_req);
    if (!isFinite(calculated_TE)) {
        // TE search failed – abort this inner iteration
        return { ...res, error: 'TE search failed: LMTD impossible' };
    }
    // 5. Evaluate Compressor using the exact TE
    let comp = evaluateCompressorSafely(calculated_TE, TC, refIndex, compParams, RPM);

    // 6. Calculate Residuals
    const F1 = loads.QF - MF * CV * (TF - T3) * PR;
    const F2 = total_load - comp.QCompressor * PR;

    return [F1, F2];
};

  let totalIter = 0;
  const T2_guess = initialT2 ?? -21.25;
  const PR_guess = initialPR ?? 0.59;
  let res = newton2(F, initialGuess, dx_steps, tol, maxIter, bounds, debug);
    totalIter += res.iterations;

    // Update this IF statement to include 'oversized'
    if (!res.converged && res.error && (res.error.includes('compressor undersized') || res.error.includes('compressor oversized'))) {
      return {
        T2: res.x[0],
        PR: isInverterMode ? fixedPR : res.x[1],
        RPM: isInverterMode ? res.x[1] : undefined,
        converged: false,
        iterations: totalIter,
        error: res.error
      };
    }  

  if (!res.converged && res.error && res.error.includes('compressor undersized')) {
    return {
      T2: res.x[0],
      PR: res.x[1],
      RPM: res.x[1],
      converged: false,
      iterations: totalIter,
      error: res.error
    };
  }

  if (!res.converged) {
    logger.log('Initial guess failed.');
    if (isInverterMode || innerOpts.forcePR !== undefined) {
      return {
        T2: res.x[0],
        PR: isInverterMode ? fixedPR : res.x[1],
        RPM: isInverterMode ? res.x[1] : undefined,
        converged: false,
        iterations: totalIter,
        error: res.error
      };
    }

    logger.log('Initial guess failed. Trying fallback guesses...');
    for (const [t2, pr] of [[T2_guess, 0.4], [T2_guess - 2, 0.5], [-21, 0.3]]) {
      logger.log(`  Fallback guess: T2=${t2}, PR=${pr}`);
      res = newton2(F, [t2, pr], dx_steps, tol, maxIter, bounds, debug);
      totalIter += res.iterations;
      if (res.converged) break;
    }
  }

  if (!res.converged) {
    return {
      T2: res.x[0],
      PR: res.x[1],
      RPM: res.x[1],
      converged: false,
      iterations: totalIter,
      error: res.error
    };
  }

  const [fT2, second] = res.x;
  const fPR = isInverterMode ? fixedPR : second;
  const fRPM = isInverterMode ? second : undefined;

  const loads = calcHeatLoads(
    geom, { T0, TF, TR, T2: fT2, TC, PR: fPR, TE }, electrical,
    PIPEPITCH, backCondenserEfficiency, fan.inputPower_W, freezerPos, backCondenser
  );

  const comp = evaluateCompressorSafely(TE, TC, refIndex, compParams, fRPM);

  const C_tot = fan.totalAirflow * CV;
  const finalT3 = fT2 + loads.QEV / (C_tot * fPR);
  const denomR = CV * Math.max(0.01, TR - finalT3) * fPR;
  const finalMR = denomR > 0 ? Math.min(fan.totalAirflow, Math.max(0, loads.QR / denomR)) : 0;
  const finalMF = fan.totalAirflow - finalMR;

  return {
    T2: fT2,
    PR: fPR,
    RPM: fRPM,
    TE,
    converged: true,
    iterations: totalIter,
    warning: res.warning,  // <-- ADD THIS LINE
    heatLoads: loads,
    compressor: {
      etaV: comp.VolumetricEfficiency,
      coolingCapacity: comp.QCompressor,
      inputPower: comp.CompPower,
      COP: comp.QCompressor / comp.CompPower,
      massFlow: comp.massFlow,
      Pe: comp.Pe,
      Pc: comp.Pc,
    },
    MR: finalMR,
    MF: finalMF,
  };
}

function createFailure(TC, errorMsg, inner = {}) {
  return {
    converged: false,
    TC: TC,
    T2: inner.T2 ?? NaN,
    PR: inner.PR ?? NaN,
    RPM: inner.RPM ?? undefined,
    TE: NaN, 
    error: errorMsg,
    outerIterations: 0,
    innerTotalIterations: 0,
  };
}

// Outer solver: TC — secant on F3 = QCout - QCin
export function solveThermalSystem(config, TE_override = null) {
  const {
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp,
    fixedTemps, fan, electrical,
    freezerPosition = 'top',
    TC0          = 45,
    DH           = 0.001,
    tolOuter     = 0.001,
    maxIterOuter = 50,
    innerOptions = {},
  } = config;

  const T0      = fixedTemps.T0;
  const debug   = innerOptions.debug ?? false;
  const TE      = TE_override ?? config.initialTE ?? -25.27;
  const fixedPR = config.inverterPR; 

  const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };
  const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0.7;

  const refIndex  = getRefrigerantIndex(refrigerant);
  const prop      = getRefrigerantProperties(refIndex);

  let TC         = TC0;
  let totalInner = 0;
  let prevF3, prevTC;
  let prevInner  = null;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    if (debug) console.log(`\nOuter ${iter}, TC=${TC.toFixed(2)}`);

    if (TC < T0) TC = T0 + 2;
    if (TC > 90) TC = 90;

    const baseOpts = prevInner
      ? { ...innerOptions, initialT2: prevInner.T2, initialPR: prevInner.PR, initialRPM: prevInner.RPM }
      : innerOptions;

    let inner = solveInner(
      TC, geom, compParams, refrigerant, subcool,
      fixedTemps, fan, electrical, condenserConfig,
      TE, freezerPosition, baseOpts,
      fixedPR, config.evapGeom
    );

    if (debug) {
      console.log('inner.compressor:', inner.compressor);
      console.log('inner.converged:', inner.converged, inner.error || '');
    }

  if (!inner.converged) {
      if (inner.error && inner.error.includes('undersized')) {
        return createFailure(TC, `Physical limit reached: Compressor undersized at TC=${TC.toFixed(2)}. Required RPM > Max.`, inner);
      }
      // Add this new block:
      if (inner.error && inner.error.includes('oversized')) {
        return createFailure(TC, `Physical limit reached: Compressor oversized. The minimum RPM limit produces too much capacity for a Running Ratio of ${fixedPR}.`, inner);
      }
      
      if (iter > 0 && typeof prevTC !== 'undefined') {
        const MAX_BACKTRACK = 3;
        let success = false;
        for (let bt = 0; bt < MAX_BACKTRACK; bt++) {
          const step = (TC - prevTC) * 0.5;
          const backtrackTC = prevTC + step;
          if (debug) console.log(`  Backtrack TC=${backtrackTC.toFixed(3)}`);

          const opts = { ...innerOptions, initialT2: prevInner.T2, initialPR: prevInner.PR, initialRPM: prevInner.RPM };
          const innerRetry = solveInner(
            backtrackTC, geom, compParams, refrigerant, subcool,
            fixedTemps, fan, electrical, condenserConfig,
            TE, freezerPosition, opts, fixedPR, config.evapGeom
          );

          if (innerRetry.converged) {
            TC = backtrackTC;
            inner = innerRetry;
            totalInner += innerRetry.iterations;
            prevInner = { T2: inner.T2, PR: inner.PR, RPM: inner.RPM };
            success = true;
            break;
          }
        }
        if (!success) {
          return createFailure(TC, 'Inner loop failed after backtracking', { T2: NaN, PR: NaN, RPM: NaN });
        }
      } else {
        return createFailure(TC, 'Inner loop failed: ' + inner.error, { T2: NaN, PR: NaN, RPM: NaN });
      }
    } else {
      totalInner += inner.iterations;
      prevInner = { T2: inner.T2, PR: inner.PR, RPM: inner.RPM };
    }

    const QCout = calcQCout(
      geom, TC, T0, fixedTemps.TF, fixedTemps.TR, inner.PR,
      PIPEPITCH, freezerPosition, backCondenserEfficiency
    ); 

    let compOuter;
    if (fixedPR !== undefined && inner.RPM !== undefined) {
      compOuter = evaluateCompressorSafely(TE, TC, refIndex, compParams, inner.RPM);
    } else {
      compOuter = evaluateCompressorSafely(TE, TC, refIndex, compParams);
    }

    const Pc = prop.satPressure(TC + KELVIN_OFFSET);
    const h_dis = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, Pc);
    const h_liq = prop.liquidEnthalpy(TC - subcool);
    const QCin_W = compOuter.massFlow * (h_dis - h_liq) / 3.6;

    const F3 = QCout.QCout - QCin_W;
    if (debug) console.log(
      `  T2=${inner.T2.toFixed(3)} PR=${inner.PR.toFixed(4)} F3=${F3.toFixed(3)}`
    );

    if (Math.abs(F3) < tolOuter) {
      // -----------------------------------------------------------------------
      // PART 1: Validation Checkpoint 1 (Compressor Sizing Verification)
      // -----------------------------------------------------------------------
      console.log(`[Validation Checkpoint 1] Verifying compressor sizing at TC=${TC.toFixed(2)}`);
      const isInverterMode = compParams.isInverter && fixedPR !== undefined;
      let compWarnings = [];
      if (inner.warning) {
              compWarnings.push(inner.warning);
            }
      if (isInverterMode) {
        const rpmMax = compParams.rpmMax || 4500;
        if (inner.RPM > rpmMax) {
          compWarnings.push(`Compressor undersized: Required RPM (${inner.RPM.toFixed(0)}) exceeds maximum (${rpmMax}).`);
        }
      } else {
        if (inner.PR > 1.0) {
          compWarnings.push(`Compressor undersized: Required PR (${inner.PR.toFixed(4)}) exceeds 1.0.`);
        }
      }

      return {
        TC,
        T2: inner.T2,
        PR: inner.PR,
        RPM: inner.RPM,
        TE,
        Pe: inner.compressor.Pe,
        Pc: inner.compressor.Pc,
        converged: true,
        warnings: compWarnings, // Pass warnings up the chain
        outerIterations:      iter + 1,
        innerTotalIterations: totalInner,
        heatLoads:            inner.heatLoads,
        compressor:           { ...inner.compressor },
        MR:                   inner.MR,
        MF:                   inner.MF,
        fan:                  fan,
        electrical:           electrical,
      };
    }

    let innerPert = null;
    let appliedDH = DH;
    const pertOpts = {
      ...innerOptions,
      initialT2: inner.T2,
      initialPR: inner.PR,
      initialRPM: inner.RPM,
    };

    try {
      innerPert = solveInner(
        TC + appliedDH, geom, compParams, refrigerant, subcool,
        fixedTemps, fan, electrical, condenserConfig,
        TE, freezerPosition, pertOpts,
        fixedPR, config.evapGeom
      );
    } catch (e) {
      console.warn('Forward perturbation failed:', e.message);
      innerPert = null;
    }

    if (!innerPert || !innerPert.converged) {
      appliedDH = -DH;
      try {
        innerPert = solveInner(
          TC + appliedDH, geom, compParams, refrigerant, subcool,
          fixedTemps, fan, electrical, condenserConfig,
          TE, freezerPosition, pertOpts,
          fixedPR, config.evapGeom
        );
      } catch (e) {
        console.warn('Backward perturbation failed:', e.message);
        innerPert = null;
      }
    }

    let F3_pert, QCin_pert, dF3dTC;
    if (innerPert && innerPert.converged) {
      const pertRPM = (fixedPR !== undefined) ? innerPert.RPM : undefined;
      const compOuter_pert = evaluateCompressorSafely(
        TE, TC + appliedDH, refIndex, compParams, pertRPM
      );
      const QCout_pert = calcQCout(
        geom, TC + appliedDH, T0, fixedTemps.TF, fixedTemps.TR, innerPert.PR,
        PIPEPITCH, freezerPosition, backCondenserEfficiency
      );
      const Pc_pert = prop.satPressure(TC + appliedDH + KELVIN_OFFSET);
      const h_dis_pert = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, Pc_pert);
      const h_liq_pert = prop.liquidEnthalpy(TC + appliedDH - subcool);

      QCin_pert = compOuter_pert.massFlow * (h_dis_pert - h_liq_pert) / 3.6;
      F3_pert = QCout_pert.QCout - QCin_pert;
      dF3dTC = (F3_pert - F3) / appliedDH;

    } else {
      if (typeof prevF3 !== 'undefined' && typeof prevTC !== 'undefined') {
        const deltaTC = TC - prevTC;
        const safeDeltaTC = Math.abs(deltaTC) < 1e-6 ? 1e-6 * Math.sign(deltaTC || 1) : deltaTC;
        dF3dTC = (F3 - prevF3) / safeDeltaTC;
        if (Math.abs(dF3dTC) < 1e-6) dF3dTC = 1e-6 * Math.sign(dF3dTC || 1);
        const step = F3 / dF3dTC;
        TC -= Math.max(-5, Math.min(5, step));
      } else {
        TC += (F3 > 0 ? -0.5 : 0.5);
      }
      prevF3 = F3;
      prevTC = TC;
      continue;
    }

    prevF3 = F3;
    prevTC = TC;

    if (Math.abs(dF3dTC) < 1e-9) {
      return createFailure(TC, 'Zero derivative in outer loop', { T2: inner.T2, PR: inner.PR, RPM: inner.RPM });
    }

    const step = F3 / dF3dTC;
    TC -= Math.max(-5, Math.min(5, step));
  }

  return createFailure(TC, 'Outer loop max iterations reached', { T2: inner.T2, PR: inner.PR, RPM: inner.RPM });
}


/**
 * Brent's method to find TE given T1, T2, and the required LMTD.
 * f(TE) = LMTD_actual(TE) - LMTD_req = 0
 */
function solveTE_Brent(T1, T2, LMTD_req, tol = 1e-4) {
    const f = (TE) => {
        const dT1 = T1 - TE;
        const dT2 = T2 - TE;
        if (dT1 <= 0 || dT2 <= 0) return Infinity;
        const ratio = dT1 / dT2;
        const actual_LMTD = Math.abs(ratio - 1.0) < 1e-6 ? dT1 : (dT1 - dT2) / Math.log(ratio);
        return actual_LMTD - LMTD_req;
    };

    // Try to find a bracket by expanding the lower bound
    let a = -80.0;
    let b = T2 - 0.01;
    let fa = f(a);
    let fb = f(b);
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    while (fa * fb > 0 && attempts < MAX_ATTEMPTS) {
        // Expand the interval downward
        a -= 10; // expand by 10°C each time
        fa = f(a);
        attempts++;
    }
    if (fa * fb > 0) {
        // Still no bracket – this means LMTD_req is impossible
        // Return a NaN to signal failure, and let the caller handle it.
        console.warn(`solveTE_Brent: Cannot find bracket for T1=${T1}, T2=${T2}, LMTD_req=${LMTD_req}. Returning NaN.`);
        return NaN;
    }

    // Ensure fa is negative and fb positive (typical for LMTD)
    if (fa > 0) {
        [a, b] = [b, a];
        [fa, fb] = [fb, fa];
    }

    // Brent's method (standard implementation)
    let c = a;
    let fc = fa;
    let mflag = true;
    let s = 0;
    let d = 0;

    for (let iter = 0; iter < 100; iter++) {
        if (fa !== fc && fb !== fc) {
            s = a * fb * fc / ((fa - fb) * (fa - fc)) +
                b * fa * fc / ((fb - fa) * (fb - fc)) +
                c * fa * fb / ((fc - fa) * (fc - fb));
        } else {
            s = b - fb * (b - a) / (fb - fa);
        }

        const condition1 = (s < (3 * a + b) / 4 || s > b);
        const condition2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
        const condition3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
        const condition4 = mflag && Math.abs(b - c) < tol;
        const condition5 = !mflag && Math.abs(c - d) < tol;

        if (condition1 || condition2 || condition3 || condition4 || condition5) {
            s = (a + b) / 2;
            mflag = true;
        } else {
            mflag = false;
        }

        const fs = f(s);
        d = c;
        c = b;
        fc = fb;

        if (fa * fs < 0) {
            b = s;
            fb = fs;
        } else {
            a = s;
            fa = fs;
        }

        if (Math.abs(fa) < Math.abs(fb)) {
            [a, b] = [b, a];
            [fa, fb] = [fb, fa];
        }

        if (Math.abs(b - a) < tol || fb === 0) {
            return b;
        }
    }
    // If we exit without convergence, return b (closest we got)
    return b;
}


// Dynamic TE wrapper
// Dynamic TE wrapper
function calculateNewTE(result, fan, evapGeom, TF, TR) {
  const { MR, MF, T2 } = result;
  const evapWidth_m = (evapGeom?.evapWidth_mm ?? 460) / 1000;
  const evapDepth_m = (evapGeom?.evapDepth_mm ?? 60) / 1000;
  const evapArea_m2 = evapGeom?.evapArea_m2 ?? 1.754;
  const ALPHA_COEFF = 12.93 * 1.16279;
  const ALPHA_EXP = 0.415;

  const T1 = (MF * TF + MR * TR) / fan.totalAirflow;
  const faceArea = evapWidth_m * evapDepth_m;
  const v_ms = fan.totalAirflow / faceArea / 3600;
  const alpha = ALPHA_COEFF * Math.pow(v_ms, ALPHA_EXP);

  // Calculate heat capacity rate of air
  const C_air = (fan.totalAirflow / 3600) * RHO_AIR * CP_AIR * 1000; 

  const UA_on = alpha * evapArea_m2;
  const NTU = UA_on / C_air; // Use C_air instead of the undefined C_tot

  // Calculate effectiveness: ε = 1 - e^(-NTU)
  const effectiveness = 1 - Math.exp(-NTU);

  // Prevent division by zero if NTU is virtually 0 (no heat transfer)
  if (effectiveness < 1e-6) {
    return T1;
  }

  // Calculate required TE to satisfy the heat load
  const newTE = T1 - (T1 - T2) / effectiveness;
  return newTE;
}

export function runThermalAnalysisDynamic(config) {
  const { fixedTemps, fan, evapGeom, solverOptions } = config;
  const { TF, TR } = fixedTemps;

  const debug = solverOptions?.innerOptions?.debug ?? false;
  const logger = { log: (...args) => debug && console.log(...args) };

  let TE = config.initialTE ?? -25.27;
  let result;
  let prevTE, prevError;

  const MAX_ITER = 15;
  const TOL = 0.1;
  let isTEConverged = false;

  logger.log('\n===== Starting Dynamic TE Iteration =====');

  for (let i = 0; i < MAX_ITER; i++) {
    logger.log(`TE Iteration ${i}: Trying TE = ${TE.toFixed(4)} °C`);

    result = solveThermalSystem(config, TE);

    if (!result.converged) {
      logger.log(`  ERROR: Inner solver failed for TE=${TE.toFixed(4)}. Aborting TE loop.`);
      return result;
    }

    const newTE = calculateNewTE(result, fan, evapGeom, TF, TR);
    const error = newTE - TE;

    logger.log(`  Result: T2=${result.T2.toFixed(3)}, PR=${result.PR.toFixed(4)}. New TE = ${newTE.toFixed(4)} (error = ${error.toFixed(4)})`);

    if (Math.abs(error) < TOL) {
      result.TE = newTE; 
      logger.log(`  TE converged in ${i + 1} iterations.`);
      isTEConverged = true;
      break; 
    }

    const currentTE = TE;
    const currentError = error;

    if (i > 0 && prevError !== undefined) {
      const te_diff = currentTE - prevTE;
      const error_diff = currentError - prevError;
      if (Math.abs(error_diff) > 1e-4) {
        const step = -currentError * te_diff / error_diff;
        const boundedStep = Math.max(-3.0, Math.min(3.0, step));
        TE = currentTE + boundedStep;
        logger.log(`  Secant step: dTE = ${boundedStep.toFixed(4)}`);
      } else {
        TE = currentTE + 0.5 * currentError;
        logger.log(`  Secant derivative too small. Falling back to relaxation step.`);
      }
    } else {
      TE = currentTE + 0.5 * currentError;
      logger.log(`  First iteration: using relaxation step.`);
    }

    prevTE = currentTE;
    prevError = currentError;
  }

  // Hard fail if thermodynamic balance is impossible
  if (!isTEConverged) {
    result.converged = false;
    result.error = `Thermodynamic imbalance: TE iteration failed to converge within ${MAX_ITER} iterations (Gap: ${prevError?.toFixed(4)} °C). Evaporator capacity cannot meet heat load.`;
    return result;
  }

// -----------------------------------------------------------------------
  // PART 2: Validation Checkpoints 2, 3, and 4
  // -----------------------------------------------------------------------
  result.warnings = result.warnings || [];

  // Checkpoint 2: Evaporator Approach Validity
  console.log(`[Validation Checkpoint 2] Evaporator Approach Validity`);
  const TE_conv = result.TE;
  const T2_conv = result.T2;

  if (TE_conv > T2_conv) {
    result.warnings.push(`Approach constraint flagged: TE (${TE_conv.toFixed(2)} °C) > T2 (${T2_conv.toFixed(2)} °C) (reverse heat transfer).`);
  } else if ((T2_conv - TE_conv) > 2) {
    result.warnings.push(`Approach constraint flagged: T2 - TE (${(T2_conv - TE_conv).toFixed(2)} °C) > 2 °C.`);
  }

  // Checkpoint 3: Peak Heat Load Evaluation (43 C Ambient)
  console.log(`[Validation Checkpoint 3] Peak Heat Load Evaluation (43 C Ambient)`);
  const peakConfig = { 
     ...config, 
     fixedTemps: { ...config.fixedTemps },
     solverOptions: { 
       ...config.solverOptions, 
       innerOptions: { ...(config.solverOptions?.innerOptions || {}) } 
     },
     compParams: { ...config.compParams }
  };
  peakConfig.fixedTemps.T0 = 43;

if (peakConfig.compParams.isInverter) {
    // DO NOT force rpmMin = rpmMax. Let the solver breathe.
    peakConfig.solverOptions.innerOptions.initialRPM = peakConfig.compParams.rpmMax;
    peakConfig.inverterPR = 1.0;
  } else {
    peakConfig.solverOptions.innerOptions.initialPR = 0.95; 
  }
  const peakResult = solveThermalSystem(peakConfig, TE_conv);

  if (!peakResult.converged) {
    result.warnings.push("Peak heat load evaluation flagged: System cannot physically balance at 43 °C.");
  } else {
    const Q_Total_43 = peakResult.heatLoads.QF + peakResult.heatLoads.QR + peakResult.heatLoads.QEV;
    console.log(`[Validation Checkpoint 3] Q_Total_43 = ${Q_Total_43.toFixed(2)} W`);

    // Checkpoint 4: Evaporator Capacity Safety Margin (15% Required)
    console.log(`[Validation Checkpoint 4] Evaporator Capacity Safety Margin (15% Required)`);
    if (!fan.totalAirflow || fan.totalAirflow <= 0) {
      result.warnings.push('Fan total airflow is zero or invalid. Cannot compute evaporator safety margin.');
    } else {
      const evapWidth_m = (evapGeom?.evapWidth_mm ?? 460) / 1000;
      const evapDepth_m = (evapGeom?.evapDepth_mm ?? 60) / 1000;
      const evapArea_m2 = evapGeom?.evapArea_m2 ?? 1.754;

      const faceArea = evapWidth_m * evapDepth_m;
      const v_ms = fan.totalAirflow / faceArea / 3600;
      const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;

      const TE_limit = T2_conv - 2;
      const T1 = (result.MF * TF + result.MR * TR) / fan.totalAirflow;
      const dT1 = T1 - TE_limit;
      const dT2 = T2_conv - TE_limit;

      if (dT1 <= 0 || dT2 <= 0) {
        result.warnings.push('Invalid approach temperatures for peak LMTD limit calculation.');
      } else {
        const ratio = dT1 / dT2;
        let LMTD_limit;
        if (Math.abs(ratio - 1.0) < 1e-6) {
          LMTD_limit = dT1;
        } else {
          LMTD_limit = (dT1 - dT2) / Math.log(ratio);
        }

        const Q_Evap_Max = alpha * evapArea_m2 * LMTD_limit;
        console.log(`[Validation Checkpoint 4] Q_Evap_Max = ${Q_Evap_Max.toFixed(2)} W (Required: ${(1.15 * Q_Total_43).toFixed(2)} W)`);

        if (Q_Evap_Max < 1.15 * Q_Total_43) {
          result.warnings.push(`Evaporator lacks the 15% physical safety margin at a 43 °C ambient. Max capacity: ${Q_Evap_Max.toFixed(2)} W.`);
        }
      }
    }
  }

  return result;

  const ratio = dT1 / dT2;
  let LMTD_limit;
  if (Math.abs(ratio - 1.0) < 1e-6) {
    LMTD_limit = dT1;
  } else {
    LMTD_limit = (dT1 - dT2) / Math.log(ratio);
  }

  const Q_Evap_Max = alpha * evapArea_m2 * LMTD_limit;

  console.log(`[Validation Checkpoint 4] Q_Evap_Max = ${Q_Evap_Max.toFixed(2)} W (Required: ${(1.15 * Q_Total_43).toFixed(2)} W)`);

  if (Q_Evap_Max < 1.15 * Q_Total_43) {
    result.converged = false;
    result.error = `Evaporator lacks the 15% physical safety margin at a 43°C ambient. Max capacity: ${Q_Evap_Max.toFixed(2)} W.`;
    return result;
  }

  return result;
}

export function EnergyConsumption(result) {
  if (result.converged === false) {
    console.log('EnergyConsumption: converged === false, returning NaN');
    return NaN;
  }

  const PR = result.PR;
  const compressor = result.compressor || {};
  const fan = result.fan || {};
  const electrical = result.electrical || {};

  const pwbOn_W  = electrical.pwbOn_W  ?? 0;
  const pwbOff_W = electrical.pwbOff_W ?? 0;
  const defrostOn_W    = electrical.defrostOn_W    ?? electrical.defrostHeater_W ?? 0;
  const defrostOn_min  = electrical.defrostOn_min  ?? 0;
  const timerPeriod_h  = electrical.timerPeriod_h ?? 10.5;
  const fanPower       = fan.inputPower_W ?? 0;

  const OnPower_W = (compressor.inputPower ?? 0) + fanPower + pwbOn_W;

  const energy_W =
    (OnPower_W * PR + pwbOff_W * (1 - PR)) * 24 / 1000 +
    defrostOn_min * defrostOn_W * (24 / (timerPeriod_h / PR)) / 60 / 1000;

  return {
    EnergyConsumption_kWhDay: energy_W,
    EnergyConsumption_kWhMonth: energy_W * 30
  };
}