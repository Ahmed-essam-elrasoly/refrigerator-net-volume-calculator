/**
 * @file solver.js
 * @description The core numerical physics solver.
 * Utilizes a nested combination of Secant (Outer), Newton-Raphson (Inner), 
 * and Brent's Method (Deep Inner) algorithms to find the thermodynamic 
 * balance point of the refrigeration cycle.
 */

import { calcHeatLoads } from './heatLoad.js';
import { calcQCout } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { compressorPower, getRefrigerantProperties, inverterCompressorPerformance } from './CompressorPerformance.js';
import { lmtd } from './evaporator.js';

const RHO_AIR       = PHYSICAL_CONSTANTS.air.density;   // kg/m³
const CP_AIR        = PHYSICAL_CONSTANTS.air.cp;        // kJ/(kg·K)
const KELVIN_OFFSET = 273.16;

// Volumetric heat capacity: W per (m³/h) per K. Must be scaled by 3600 to yield Watts (J/s)
const CV = (RHO_AIR * CP_AIR * 1000) / 3600;   

function getRefrigerantIndex(name) {
  if (name === 'R-134a') return 1;
  if (name === 'R-600a') return 2;
  throw new Error(`Unsupported refrigerant: ${name}`);
}

/**
 * Universal wrapper protecting against missing compressor data.
 */
function evaluateCompressorSafely(TE, TC, refIndex, compParams, RPM) {
  if (compParams.compressorModel && typeof compParams.compressorModel === 'object') {
    return inverterCompressorPerformance(TE, TC, RPM, refIndex, compParams.compressorModel);
  }
  if (compParams.isInverter) throw new Error('Inverter compressor selected but no fitted model.');

  return compressorPower(
    TE, TC, refIndex,
    compParams.wCoeffs, compParams.etaCoeffs,
    compParams.cylinderVolumeCm3 || compParams.Vc,
    compParams.speedRpm || compParams.rpm
  );
}

/**
 * 2-Dimensional Newton-Raphson Solver with Backtracking Line Search.
 * Solves the F1 (Freezer Mass Balance) and F2 (System Capacity Balance) functions.
 */
function newton2(F, x0, dx, tol, maxIter, bounds, debug = false) {
  const logger = { 
    log: (...args) => debug && console.log(...args),
    table: (data) => debug && console.table(data)
  };
  let x = [...x0], f, normF;
  
  logger.log(`\n--- Starting Newton2 --- Initial Guess: [${x[0].toFixed(3)}, ${x[1].toFixed(3)}]`);
  
  try {
    f = F(x);
    if (f.error) return { x, f: [NaN, NaN], normF: NaN, converged: false, iterations: 0, error: f.error };
    normF = Math.sqrt(f[0] * f[0] + f[1] * f[1]);
  } catch (e) { 
    logger.log(`Initial F(x) failed: ${e.message}`);
    return { x, f: [NaN, NaN], normF: NaN, converged: false, iterations: 0, error: `Initial F(x) failed: ${e.message}` };
  }

  for (let i = 0; i < maxIter; i++) {
    logger.log(`[Iter ${i}] x=[${x[0].toFixed(3)}, ${x[1].toFixed(3)}], f=[${f[0].toFixed(2)}, ${f[1].toFixed(2)}], norm=${normF.toFixed(4)}`);
    if (normF <= tol) {
      logger.log(`-> Converged in ${i+1} iterations.`);
      return { x, f, normF, converged: true, iterations: i + 1 };
    }

    const J = [[0, 0], [0, 0]];
    try {
      for (let j = 0; j < 2; j++) {
        const h = Math.max(1e-7, Math.abs(x[j]) * 1e-6);
        const xp = [...x]; 
        
        if (xp[j] + h > bounds[j][1]) {
          xp[j] -= h;
          const fp = F(xp);
          if (fp.error) throw new Error(fp.error);
          J[0][j] = (f[0] - fp[0]) / h;
          J[1][j] = (f[1] - fp[1]) / h;
        } else {
          xp[j] += h;
          const fp = F(xp);
          if (fp.error) throw new Error(fp.error);
          J[0][j] = (fp[0] - f[0]) / h;
          J[1][j] = (fp[1] - f[1]) / h;
        }
      }
      logger.log(`[Iter ${i}] J = [[${J[0][0].toFixed(4)}, ${J[0][1].toFixed(4)}], [${J[1][0].toFixed(4)}, ${J[1][1].toFixed(4)}]]`);
    } catch (e) {
      logger.log(`Jacobian failed: ${e.message}`);
      return { x, f, normF, converged: false, iterations: i + 1, error: `Jacobian failed: ${e.message}` };
    }

    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    let direction;
    
    if (Math.abs(det) > 1e-12) {
      const invDet = 1.0 / det;
      direction = [ 
        -invDet * (J[1][1] * f[0] - J[0][1] * f[1]), 
        -invDet * (-J[1][0] * f[0] + J[0][0] * f[1]) 
      ];
      logger.log(`[Iter ${i}] det=${det.toFixed(4)}, raw_dir=[${direction[0].toFixed(4)}, ${direction[1].toFixed(4)}]`);
    } else {
      logger.log(`[Iter ${i}] Warning: Matrix singular or saddle point (det=${det}). Using gradient descent.`);
      direction = [ -(J[0][0] * f[0] + J[1][0] * f[1]), -(J[0][1] * f[0] + J[1][1] * f[1]) ];
      const dirNorm = Math.sqrt(direction[0]**2 + direction[1]**2);
      if (dirNorm < 1e-12) return { x, f, normF, converged: false, iterations: i+1, error: 'Saddle point.' };
    }

    // Proportional vector scaling
    const maxStepT2 = 5.0; 
    const domainSpanVar2 = bounds[1][1] - bounds[1][0];
    const maxStepVar2 = domainSpanVar2 > 2 ? 500 : 0.15; 

    let scale = 1.0;
    if (Math.abs(direction[0]) > maxStepT2) {
      scale = Math.min(scale, maxStepT2 / Math.abs(direction[0]));
    }
    if (Math.abs(direction[1]) > maxStepVar2) {
      scale = Math.min(scale, maxStepVar2 / Math.abs(direction[1]));
    }

    direction[0] *= scale;
    direction[1] *= scale;
    logger.log(`[Iter ${i}] clamped_dir=[${direction[0].toFixed(4)}, ${direction[1].toFixed(4)}]`);

    let alpha = 1.0, accept = false, newX, newF, newNorm;
    const armijoC = 1e-4; 
    logger.log(`[Iter ${i}] Starting line search, initial alpha=1.0`);

    for (let bt = 0; bt < 15; bt++) {
      newX = [
        Math.max(bounds[0][0], Math.min(bounds[0][1], x[0] + alpha * direction[0])),
        Math.max(bounds[1][0], Math.min(bounds[1][1], x[1] + alpha * direction[1]))
      ];
      try { 
        newF = F(newX); 
        if (newF.error) throw new Error(newF.error);
        newNorm = Math.sqrt(newF[0] * newF[0] + newF[1] * newF[1]); 
      } catch (e) { 
        logger.log(`  [bt=${bt}] F(x+αd) failed at α=${alpha.toFixed(4)}: ${e.message}`);
        alpha *= 0.5; 
        continue; 
      }
      
      const enoughDecrease = newNorm < normF * (1.0 - armijoC * alpha);
      logger.log(`  [bt=${bt}] α=${alpha.toFixed(4)}, newNorm=${newNorm.toFixed(4)}, enoughDecrease=${enoughDecrease}`);
      
      if (enoughDecrease) { 
        accept = true; 
        logger.log(`  -> accepted α=${alpha.toFixed(4)}`);
        break; 
      }
      alpha *= 0.5;
    }

    if (!accept) {
      logger.log(`[Iter ${i}] Line search failed! Alpha hit bottom.`);
      if (Math.abs(x[1] - bounds[1][0]) < 1e-4 && direction[1] < 0) return { x, f, normF, converged: true, iterations: i+1, warning: 'Compressor oversized limit.' };
      if (Math.abs(x[1] - bounds[1][1]) < 1e-4 && direction[1] > 0) return { x, f, normF, converged: true, iterations: i+1, warning: 'Compressor undersized limit.' };
      return { x, f, normF, converged: false, iterations: i+1, error: 'Line search failed.' };
    }
    x = newX; f = newF; normF = newNorm;
  }
  
  logger.log(`Max iterations reached without convergence.`);
  return { x, f, normF, converged: false, iterations: maxIter, error: 'Max iterations reached' };
}

/**
 * Executes the Newton-Raphson loop to find the equilibrium variables.
 */
function solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPos, innerOpts = {}, fixedPR, evapGeom) {
  const { tol = 1e-4, maxIter = 100, dx = 1e-3 } = innerOpts;
  const { Damp = 1.0 } = electrical;
  const PIPEPITCH = { side: condenserConfig.sidePipePitch_mm, back: condenserConfig.backPipePitch_mm };
  const refIndex = getRefrigerantIndex(refrigerant);
  const isInverterMode = compParams.isInverter && fixedPR !== undefined;

  let bounds, initialGuess;
  if (isInverterMode) {
    bounds = [[-80, 20], [compParams.rpmMin || 1000, compParams.rpmMax || 6000]];
    initialGuess = [innerOpts.initialT2 ?? -21.25, innerOpts.initialRPM ?? 3000];
  } else {
    bounds = [[-80, 20], [0.001, 0.999]];
    if (innerOpts.forcePR !== undefined) bounds[1] = [innerOpts.forcePR, innerOpts.forcePR];
    initialGuess = [innerOpts.initialT2 ?? -21.25, innerOpts.forcePR ?? innerOpts.initialPR ?? 0.59];
  }
  let convergedTE = TE; 

  const F = (vars) => {
    const T2 = vars[0], secondVar = vars[1];
    const PR = isInverterMode ? fixedPR : secondVar, RPM = isInverterMode ? secondVar : undefined;
    
    const loads = calcHeatLoads(geom, { ...fixedTemps, T2, TC, PR, TE: -25 }, electrical, PIPEPITCH, condenserConfig.backCondenserEfficiency, fan.inputPower_W, freezerPos, condenserConfig.backCondenser);
    
    const Flow_m3h = fan.fanAirflow_m3h;
    const faceArea_m2 = (evapGeom.width_mm / 1000) * (evapGeom.depth_mm / 1000);
    // Explicit conversion to m/s
    const v_ms = (Flow_m3h / 3600) / faceArea_m2;
    const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
    const UA = alpha * evapGeom.evapArea_m2;
    
    const totalHeat_W = loads.QF + loads.QR + loads.QEV;
    const LMTD_req = totalHeat_W / PR / UA;
    
    const T3 = T2 + loads.QEV / (Flow_m3h * CV * PR);
    const denomR = CV * Math.max(0.01, fixedTemps.TR - T3) * PR * Damp;
    const MR = denomR > 0 ? Math.min(Flow_m3h, Math.max(0, loads.QR / denomR)) : 0;
    const MF = Flow_m3h - MR;
    const T1 = (MF * fixedTemps.TF + MR * fixedTemps.TR) / Flow_m3h;

    if (isInverterMode && (RPM < bounds[1][0] || RPM > bounds[1][1])) { 
      return { error: `RPM ${RPM} out of bounds [${bounds[1][0]}, ${bounds[1][1]}]` };
    }
    if (!isInverterMode && (PR < bounds[1][0] || PR > bounds[1][1])) {
      return { error: `PR ${PR} out of bounds [${bounds[1][0]}, ${bounds[1][1]}]` };
    }
    
    if (innerOpts.debug) console.log(`[BALANCE-CHECK] QF=${loads.QF.toFixed(2)} MF*CV*(TF-T3)*PR=${(MF*CV*(fixedTemps.TF-T3)*PR).toFixed(2)} T3=${T3.toFixed(2)} MF=${MF.toFixed(2)} MR=${MR.toFixed(2)} T1=${T1.toFixed(2)} PR=${PR}`);
    if (innerOpts.debug) console.log(`[LOADS-CHECK] QF=${loads.QF} QR=${loads.QR} QEV=${loads.QEV} LMTD_req=${LMTD_req.toFixed(2)} UA=${UA.toFixed(2)} v_ms=${v_ms.toFixed(2)}`);
    
    const calculated_TE = solveTE_Brent(T1, T2, LMTD_req);
    
    if (!isFinite(calculated_TE)) {
      if (innerOpts.debug) console.warn(`[Physics Error] TE search failed. LMTD_req: ${LMTD_req.toFixed(2)}, T1: ${T1.toFixed(2)}, T2: ${T2.toFixed(2)}`);
      return { error: 'TE search failed: LMTD impossible' };
    }
    
    convergedTE = calculated_TE;
    const comp = evaluateCompressorSafely(calculated_TE, TC, refIndex, compParams, RPM);
    
    const f1 = loads.QF - MF * CV * (fixedTemps.TF - T3) * PR;
    const f2 = totalHeat_W - comp.QCompressor * PR;

    return [f1, f2];
  };

  let res = newton2(F, initialGuess, [dx, dx], tol, maxIter, bounds, innerOpts.debug || true);
  
  if (!res.converged) {
    if (!res.error || (!res.error.includes('undersized') && !res.error.includes('oversized'))) {
      let fallbackGuesses;
      if (isInverterMode) {
        const rpmMin = compParams.rpmMin || 1000;
        const rpmMax = compParams.rpmMax || 6000;
        const midRPM = (rpmMin + rpmMax) / 2;
        fallbackGuesses = [
          [initialGuess[0], midRPM],
          [initialGuess[0]-2, rpmMin],
          [initialGuess[0]+2, rpmMax],
          [-21, midRPM]
        ];
      } else {
        fallbackGuesses = [
          [initialGuess[0], 0.4],
          [initialGuess[0]-2, 0.5],
          [-21, 0.3]
        ];
      }
      for (const guess of fallbackGuesses) {
        res = newton2(F, guess, [dx, dx], tol, maxIter, bounds, innerOpts.debug || true);
        if (res.converged) break;
      }
    }
  }

  if (!res.converged) return { ...res, T2: res.x[0], PR: isInverterMode ? fixedPR : res.x[1], RPM: isInverterMode ? res.x[1] : undefined };

  const fT2 = res.x[0], fPR = isInverterMode ? fixedPR : res.x[1], fRPM = isInverterMode ? res.x[1] : undefined;
  const Flow_m3h = fan.fanAirflow_m3h;
  
  const loads = calcHeatLoads(geom, { ...fixedTemps, T2: fT2, TC, PR: fPR, TE: convergedTE },  electrical, PIPEPITCH, condenserConfig.backCondenserEfficiency, fan.inputPower_W, freezerPos, condenserConfig.backCondenser);
  const comp = evaluateCompressorSafely(convergedTE, TC, refIndex, compParams, fRPM);

  const fT3 = fT2 + loads.QEV / (Flow_m3h * CV * fPR);
  const fDenomR = CV * Math.max(0.01, fixedTemps.TR - fT3) * fPR * Damp;
  const fMR = fDenomR > 0 ? Math.min(Flow_m3h, Math.max(0, loads.QR / fDenomR)) : 0;
  const fMF = Flow_m3h - fMR;

  return {
    T2: fT2, PR: fPR, RPM: fRPM, TE: convergedTE, converged: true, iterations: res.iterations, warning: res.warning,
    heatLoads: loads,
    compressor: { etaV: comp.VolumetricEfficiency, coolingCapacity: comp.QCompressor, inputPower: comp.CompPower, COP: comp.QCompressor / comp.CompPower, massFlow: comp.massFlow, Pe: comp.Pe, Pc: comp.Pc },
    MR: fMR,
    MF: fMF,
    T3: fT3,
  };
}

/**
 * Brent's Method root finder. Resolves Evaporator Temp (TE) to match the required LMTD.
 */
function solveTE_Brent(T1, T2, LMTD_req, tol = 1e-4) {
  const f = (TE) => {
    try {
      return lmtd(T1, T2, TE) - LMTD_req;
    } catch (e) {
      return Infinity; // Instantly flag invalid domains to Brent's method
    }
  };

  const ABSOLUTE_MIN_TE = -65.0; 
  const ABSOLUTE_MAX_TE = Math.min(T1, T2) - 0.1;

  let a = -40.0; 
  let b = ABSOLUTE_MAX_TE;

  while (f(a) * f(b) > 0 && a > ABSOLUTE_MIN_TE) {
    a -= 10;
  }

  if (f(a) * f(b) > 0) return NaN; 

  let fa = f(a), fb = f(b);
  if (fa > 0) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
  
  let c = a, fc = fa, mflag = true, s = 0, d = 0;
  
  for (let iter = 0; iter < 100; iter++) {
    if (fa !== fc && fb !== fc) {
        s = a*fb*fc/((fa-fb)*(fa-fc)) + b*fa*fc/((fb-fa)*(fb-fc)) + c*fa*fb/((fc-fa)*(fc-fb));
    } else {
        s = b - fb*(b-a)/(fb-fa);
    }
    
    if ((s < (3*a+b)/4 || s > b) || 
        (mflag && Math.abs(s-b) >= Math.abs(b-c)/2) || 
        (!mflag && Math.abs(s-b) >= Math.abs(c-d)/2) || 
        (mflag && Math.abs(b-c) < tol) || 
        (!mflag && Math.abs(c-d) < tol)) {
      s = (a+b)/2; 
      mflag = true;
    } else {
      mflag = false;
    }
    
    const fs = f(s); 
    d = c; 
    c = b; 
    fc = fb;
    
    if (fa * fs < 0) { b = s; fb = fs; } else { a = s; fa = fs; }
    if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }
    if (Math.abs(b - a) < tol || fb === 0) return b;
  }
  
  return b;
}

function calculateNewTE(result, fan, evapGeom, TF, TR) {
  const { MR, MF, T2 } = result;
  const Flow_m3h = fan.fanAirflow_m3h;
  const T1 = (MF * TF + MR * TR) / Flow_m3h;
  const faceArea_m2 = (evapGeom.width_mm / 1000) * (evapGeom.depth_mm / 1000);
  
  const v_ms = (Flow_m3h / 3600) / faceArea_m2;
  const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
  
  const NTU = (alpha * evapGeom.evapArea_m2) / (Flow_m3h * CV);
  const effectiveness = 1 - Math.exp(-NTU);
  
  return effectiveness < 1e-6 ? T1 : T1 - (T1 - T2) / effectiveness;
}

function createFailure(TC, errorMsg, inner = {}) {
  return { converged: false, TC, T2: inner.T2 ?? NaN, PR: inner.PR ?? NaN, RPM: inner.RPM, TE: NaN, error: errorMsg, outerIterations: 0, innerTotalIterations: 0 };
}

/**
 * Outer Secant Solver. Modifies Condensing Temp (TC) until Condenser Heat Rejection (QC_out)
 * perfectly balances Compressor Output (QC_in).
 */
export function solveThermalSystem(config, TE_override = null) {
  const { 
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp, 
    fixedTemps, fan, electrical, evapGeom, freezerPosition = 'top', 
    TC0 = 45, tolOuter = 0.001, maxIterOuter = 50, innerOptions = {} 
  } = config;

  if (!evapGeom) {
    throw new Error("FATAL: evapGeom is missing from the configuration payload.");
  }

  const TE = TE_override ?? config.initialTE;
  const fixedPR = config.inverterPR;
  const prop = getRefrigerantProperties(getRefrigerantIndex(refrigerant));

  let TC = TC0, totalInner = 0, prevF3, prevTC, prevInner = null;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    if (TC < fixedTemps.T0) TC = fixedTemps.T0 + 2;
    if (TC > 90) TC = 90;

    let inner = solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPosition, prevInner ? { ...innerOptions, initialT2: prevInner.T2, initialPR: prevInner.PR, initialRPM: prevInner.RPM } : innerOptions, fixedPR, evapGeom);

    if (!inner.converged) {
      if (inner.error?.includes('undersized')) return createFailure(TC, 'Compressor undersized.', inner);
      if (inner.error?.includes('oversized')) return createFailure(TC, 'Compressor oversized.', inner);
      return createFailure(TC, 'Inner loop failed.', inner);
    }
    totalInner += inner.iterations;
    prevInner = { T2: inner.T2, PR: inner.PR, RPM: inner.RPM };

    const QCout = calcQCout(geom, TC, fixedTemps.T0, fixedTemps.TF, fixedTemps.TR, inner.PR, { side: condenserConfig.sidePipePitch_mm, back: condenserConfig.backPipePitch_mm }, freezerPosition, condenserConfig.backCondenserEfficiency);
    const compOuter = evaluateCompressorSafely(TE, TC, getRefrigerantIndex(refrigerant), compParams, inner.RPM);
    
    const F3 = QCout.QCout - (compOuter.massFlow * (prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, prop.satPressure(TC + KELVIN_OFFSET)) - prop.liquidEnthalpy(TC - subcool)) / 3.6);

    if (Math.abs(F3) < tolOuter) return { TC, T2: inner.T2, PR: inner.PR, T3: inner.T3, RPM: inner.RPM, TE, Pe: inner.compressor.Pe, Pc: inner.compressor.Pc, converged: true, warnings: inner.warning ? [inner.warning] : [], outerIterations: iter + 1, innerTotalIterations: totalInner, heatLoads: inner.heatLoads, compressor: { ...inner.compressor }, MR: inner.MR, MF: inner.MF, fan, electrical };

    let innerPert = null;
    try { innerPert = solveInner(TC + 0.001, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPosition, { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR, initialRPM: inner.RPM }, fixedPR, evapGeom); } catch (e) {}

    if (innerPert?.converged) {
      const compOuter_pert = evaluateCompressorSafely(TE, TC + 0.001, getRefrigerantIndex(refrigerant), compParams, (fixedPR !== undefined) ? innerPert.RPM : undefined);
      const QCout_pert = calcQCout(geom, TC + 0.001, fixedTemps.T0, fixedTemps.TF, fixedTemps.TR, innerPert.PR, { side: condenserConfig.sidePipePitch_mm, back: condenserConfig.backPipePitch_mm }, freezerPosition, condenserConfig.backCondenserEfficiency);
      const F3_pert = QCout_pert.QCout - (compOuter_pert.massFlow * (prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, prop.satPressure(TC + 0.001 + KELVIN_OFFSET)) - prop.liquidEnthalpy(TC + 0.001 - subcool)) / 3.6);
      TC -= Math.max(-5, Math.min(5, F3 / ((F3_pert - F3) / 0.001)));
    } else {
      if (prevF3 !== undefined && prevTC !== undefined) TC -= Math.max(-5, Math.min(5, F3 / ((F3 - prevF3) / (Math.abs(TC - prevTC) < 1e-6 ? 1e-6 : TC - prevTC))));
      else TC += (F3 > 0 ? -0.5 : 0.5);
    }
    prevF3 = F3; prevTC = TC;
  }
  return createFailure(TC, 'Outer loop max iterations reached', prevInner);
}

/**
 * Handles the absolute outermost iteration ensuring Evaporator Temperature (TE) 
 * balances perfectly against capacity.
 */
export function runThermalAnalysisDynamic(config) {
  let TE = config.initialTE, result, prevTE, prevError;
  for (let i = 0; i < 15; i++) {
    if (!(result = solveThermalSystem(config, TE)).converged) return result;
    const error = calculateNewTE(result, config.fan, config.evapGeom, config.fixedTemps.TF, config.fixedTemps.TR) - TE;
    console.log(`[TE-UPDATE] i=${i} TE=${TE} result.MR=${result.MR} result.MF=${result.MF} result.T2=${result.T2} newTE_raw=${error+TE} error=${error}`);
    if (Math.abs(error) < 0.1) { result.TE = TE + error; return evaluateSafetyCheckpoints(result, config, TE + error); }
    
    if (i > 0 && prevError !== undefined) TE += Math.max(-3.0, Math.min(3.0, -error * (TE - prevTE) / (error - prevError)));
    else TE += 0.5 * error;
    
    prevTE = TE - (i > 0 ? TE - prevTE : 0.5*error); prevError = error;
  }
  return { converged: false, error: 'Thermodynamic imbalance: TE loop failed.' };
}

function evaluateSafetyCheckpoints(result, config, TE_conv) {
  result.warnings = result.warnings || [];
  if (TE_conv > result.T2) result.warnings.push(`Approach constraint flagged: TE > T2.`);
  else if ((result.T2 - TE_conv) > 2) result.warnings.push(`Approach constraint flagged: T2 - TE > 2 °C.`);

  const peakConfig = { ...config, fixedTemps: { ...config.fixedTemps, T0: 43 }, solverOptions: { ...config.solverOptions, innerOptions: { ...(config.solverOptions?.innerOptions || {}) } } };
  if (config.compParams.isInverter) { peakConfig.solverOptions.innerOptions.initialRPM = config.compParams.rpmMax; peakConfig.inverterPR = 1.0; } 
  else peakConfig.solverOptions.innerOptions.initialPR = 0.95;

  const peakResult = solveThermalSystem(peakConfig, TE_conv);
  if (!peakResult.converged) result.warnings.push("Peak heat load evaluation flagged: System cannot physically balance at 43 °C.");
  else {
    const Flow_m3h = config.fan.fanAirflow_m3h;
    const faceArea_m2 = (config.evapGeom.width_mm / 1000) * (config.evapGeom.depth_mm / 1000);
    const v_ms = (Flow_m3h / 3600) / faceArea_m2;
    const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
    const UA = alpha * config.evapGeom.evapArea_m2;
    const LMTD_val = lmtd((result.MF * config.fixedTemps.TF + result.MR * config.fixedTemps.TR) / Flow_m3h, result.T2, result.T2 - 2);
    
    if ((UA * LMTD_val) < 1.15 * (peakResult.heatLoads.totalLoad)) {
      result.warnings.push(`Evaporator lacks 15% physical safety margin at 43°C ambient.`);
    }
  }
  return result;
}

/**
 * Calculates theoretical electrical consumption (kWh/day & kWh/month).
 */
export function EnergyConsumption(result) {
  if (result.converged === false) return NaN;

  // 1. Extract base variables
  const compPower = result.compressor.inputPower;
  const fanPower = result.fan.inputPower_W;
  const pwbOn = result.electrical.pwbOn_W;
  const pwbOff = result.electrical.pwbOff_W;
  const PR = result.PR;
  
  // 2. Extract defrost variables
  const defHeater = result.electrical.defrostHeater_W;
  const defOnMin = result.electrical.defrostOn_min;
  const defTimerPeriodH = result.electrical.timerPeriod_h;

  // --- DEBUG TRACE START ---
  console.log("\n=== ENERGY CALCULATION DEBUG TRACE ===");
  console.table({
    "Compressor Power (W)": compPower,
    "Fan Input Power (W)": fanPower,
    "PWB On Power (W)": pwbOn,
    "PWB Off Power (W)": pwbOff,
    "Running Ratio (PR)": PR,
    "Defrost Heater (W)": defHeater,
    "Defrost On Time (min)": defOnMin,
    "Timer Period (h)": defTimerPeriodH
  });

  // 3. Component Math Breakdown
  // Active cycle includes compressor, fan, and active PCB, weighted by running ratio
  const activeCyclePower_W = (compPower + fanPower + pwbOn) * PR;
  
  // Off cycle includes only standby PCB, weighted by inverse of running ratio
  const offCyclePower_W = pwbOff * (1 - PR);
  
  // Base daily energy (kWh)
  const dailyBaseEnergy_kWh = (activeCyclePower_W + offCyclePower_W) * 24 / 1000;

  // Defrost math: Timer period is extended by the inverse of PR
  const actualDefrostInterval_h = defTimerPeriodH / PR; 
  const defrostEventsPerDay = 24 / actualDefrostInterval_h;
  const dailyDefrostEnergy_kWh = (defOnMin / 60) * defHeater * defrostEventsPerDay / 1000;

  // Total
  const totalDaily_kWh = dailyBaseEnergy_kWh + dailyDefrostEnergy_kWh;

  console.log(`[Component] Active Cycle Power:   ${activeCyclePower_W.toFixed(3)} W`);
  console.log(`[Component] Off Cycle Power:      ${offCyclePower_W.toFixed(3)} W`);
  console.log(`[Component] Actual Defrost Interval: ${actualDefrostInterval_h.toFixed(3)} h`);
  console.log(`[Component] Defrost Events/Day:   ${defrostEventsPerDay.toFixed(3)}`);
  console.log(`[Integration] Daily Base Energy:    ${dailyBaseEnergy_kWh.toFixed(4)} kWh`);
  console.log(`[Integration] Daily Defrost Energy: ${dailyDefrostEnergy_kWh.toFixed(4)} kWh`);
  console.log(`[Integration] TOTAL DAILY ENERGY:   ${totalDaily_kWh.toFixed(4)} kWh`);
  console.log("======================================\n");
  // --- DEBUG TRACE END ---

  return { 
    EnergyConsumption_kWhDay: totalDaily_kWh, 
    EnergyConsumption_kWhMonth: totalDaily_kWh * 30 
  };
}