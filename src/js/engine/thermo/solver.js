// solver.js – Universal thermal solver (Corrected & Finalized)
import { calcHeatLoads } from './heatLoad.js';
import { calcQCout } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { compressorPower, getRefrigerantProperties } from './CompressorPerformance.js';

const RHO_AIR       = PHYSICAL_CONSTANTS.air.density;
const CP_AIR        = PHYSICAL_CONSTANTS.air.cp;
const KELVIN_OFFSET = 273.16;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Safe Wrappers
// ─────────────────────────────────────────────────────────────────────────────

function getRefrigerantIndex(name) {
  if (name === 'R-134a') return 1;
  if (name === 'R-600a') return 2;
  throw new Error(`Unsupported refrigerant: ${name}`);
}

/**
 * Safe wrapper to execute compressor calculations.
 * Prevents destructuring crashes if a compressor map is configured but not supplied.
 */
function evaluateCompressorSafely(TE, TC, refIndex, compParams) {
  if (compParams.useMap) {
    throw new Error(
      "Compressor map logic is required but missing. Implement map interpolation or provide polynomial coefficients (wCoeffs, etaCoeffs)."
    );
  }
  
  if (!compParams.wCoeffs || !compParams.etaCoeffs) {
    throw new Error("Missing polynomial coefficients (wCoeffs, etaCoeffs) for compressor evaluation.");
  }

  return compressorPower(
    TE, TC, refIndex, 
    compParams.wCoeffs, compParams.etaCoeffs, 
    compParams.cylinderVolumeCm3 || compParams.Vc,
    compParams.speedRpm || compParams.rpm
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2×2 Newton-Raphson with damping & bounds checking
// ─────────────────────────────────────────────────────────────────────────────

function newton2(F, x0, dx, tol, maxIter, debug = false) {
  let x     = [x0[0], x0[1]];
  let prevF = [Infinity, Infinity];
  let prevX = [...x];

  for (let i = 0; i < maxIter; i++) {
    const f       = F(x);
    const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));

    if (debug) console.log(
      `  Newton ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)}` +
      ` F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)}`
    );

    if (maxAbsF <= tol) return { x, converged: true, iterations: i + 1 };

    // Damp if residual is growing
    if (maxAbsF > Math.max(Math.abs(prevF[0]), Math.abs(prevF[1])) && i > 0) {
      if (debug) console.log('  Damping');
      x[0] = (x[0] + prevX[0]) / 2;
      x[1] = (x[1] + prevX[1]) / 2;
      continue;
    }

    prevF = f;
    prevX = [...x];

    // Numerical Jacobian
    const J = [[0, 0], [0, 0]];
    for (let j = 0; j < 2; j++) {
      const xp = [x[0], x[1]];
      xp[j] += dx;
      const fp   = F(xp);
      J[0][j]    = (fp[0] - f[0]) / dx;
      J[1][j]    = (fp[1] - f[1]) / dx;
    }

    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (Math.abs(det) < 1e-12)
      return { x, converged: false, iterations: i + 1, error: 'Singular Jacobian' };

    // Update with hard bounds to prevent NaN poisoning in thermodynamic functions
    x[0] = Math.max(-80,    Math.min(20,    x[0] + (-f[0] * J[1][1] + f[1] * J[0][1]) / det));
    x[1] = Math.max(0.001,  Math.min(0.999, x[1] + ( J[0][0] * (-f[1]) + J[1][0] * f[0]) / det));
  }

  return { x, converged: false, iterations: maxIter, error: 'Max iterations reached' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner solver: (T2, PR) ← Newton-Raphson
// ─────────────────────────────────────────────────────────────────────────────

function solveInner(
  TC, geom, compParams, refrigerant, subcool,
  fixedTemps, fan, electrical, condenserConfig,
  TE, freezerPos, innerOpts = {}
) {
  const {
    dx       = 0.0001,
    tol      = 1e-4,
    maxIter  = 100,
    initialT2,
    initialPR,
    debug    = false,
  } = innerOpts;

  const { T0, TF, TR } = fixedTemps;
  const rho = RHO_AIR, cp = CP_AIR;
  
  const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };
  const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0;
  const backCondenser = condenserConfig.backCondenser ?? 'No';

  const refIndex = getRefrigerantIndex(refrigerant);
  let currentMR = fan.totalAirflow * 0.1;
  let currentMF = fan.totalAirflow * 0.9;

  // Residual vector F(T2, PR)
  const F = ([T2, PR]) => {
    const loads = calcHeatLoads(
      geom, { T0, TF, TR, T2, TC, PR, TE }, electrical,
      PIPEPITCH, backCondenserEfficiency, fan.inputPower_W, freezerPos, backCondenser
    );
    const comp = evaluateCompressorSafely(TE, TC, refIndex, compParams);

    // F2: heat balance — evaporator duty equals fraction of compressor capacity
    const F2 = (loads.QF + loads.QR + loads.QEV) - comp.QCompressor * PR;

    const denom = fan.totalAirflow * rho * cp * PR;
    let F1;
    if (Math.abs(denom) < 1e-12) {
      F1 = loads.QF;
    } else {
      const T3   = T2 + loads.QEV / denom;
      const MR   = Math.min(fan.totalAirflow, Math.max(0,
        loads.QR / (rho * cp * Math.max(0.01, TR - T3) * PR)
      ));
      const MF   = fan.totalAirflow - MR;
      currentMR  = MR;
      currentMF  = MF;
      F1 = loads.QF - MF * rho * cp * (TF - T3) * PR;
    }

    return [F1, F2];
  };

  // Solve — fall back through alternative guesses on failure
  let totalIter = 0;
  const T2_guess = initialT2 ?? -21.25;
  const PR_guess = initialPR ?? 0.59;
  let res = newton2(F, [T2_guess, PR_guess], dx, tol, maxIter, debug);
  totalIter += res.iterations;

  if (!res.converged) {
    for (const [t2, pr] of [[T2_guess, 0.4], [T2_guess - 2, 0.5], [-21, 0.3]]) {
      res        = newton2(F, [t2, pr], dx, tol, maxIter, debug);
      totalIter += res.iterations;
      if (res.converged) break;
    }
  }

  if (!res.converged)
    return { T2: res.x[0], PR: res.x[1], converged: false, iterations: totalIter, error: res.error };

  // Final evaluation at the converged point
  const fT2   = res.x[0], fPR = res.x[1];
  const loads = calcHeatLoads(
    geom, { T0, TF, TR, T2: fT2, TC, PR: fPR, TE }, electrical,
    PIPEPITCH, backCondenserEfficiency, fan.inputPower_W, freezerPos, backCondenser
  );
  const comp = evaluateCompressorSafely(TE, TC, refIndex, compParams);

  return {
    T2: fT2,
    PR: fPR,
    TE,
    converged:  true,
    iterations: totalIter,
    heatLoads:  loads,
    compressor: {
      etaV:            comp.VolumetricEfficiency,
      coolingCapacity: comp.QCompressor,
      inputPower:      comp.CompPower,
      massFlow:        comp.massFlow,
      Pe:              comp.Pe,
      Pc:              comp.Pc,
    },
    MR: currentMR,
    MF: currentMF,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer solver: TC ← secant on F3 = QCout − QCin
// ─────────────────────────────────────────────────────────────────────────────

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

  const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };
  const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0.7;

  const refIndex  = getRefrigerantIndex(refrigerant);
  const prop      = getRefrigerantProperties(refIndex);

  let TC         = TC0;
  let totalInner = 0;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    if (debug) console.log(`\nOuter ${iter}, TC=${TC.toFixed(2)}`);

    // Prevent TC from drifting into non-physical ranges
    if (TC < T0) TC = T0 + 2;
    if (TC > 90) TC = 90;

    // ── 1. Inner solve at current TC ─────────────────────────────────────────
    const inner = solveInner(
      TC, geom, compParams, refrigerant, subcool,
      fixedTemps, fan, electrical, condenserConfig,
      TE, freezerPosition, innerOptions
    );
    
    if (!inner.converged)
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Inner loop failed: ' + inner.error };
    
    totalInner += inner.iterations;

    // ── 2. Condenser heat balance at current TC (F3 = QCout − QCin) ──────────
    const QCout = calcQCout(
      geom, TC, T0, fixedTemps.TF, fixedTemps.TR, inner.PR, 
      PIPEPITCH, freezerPosition, backCondenserEfficiency
    );
    
    const compOuter = evaluateCompressorSafely(TE, TC, refIndex, compParams);
    const Pc = prop.satPressure(TC + KELVIN_OFFSET);
    const h_dis = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, Pc);
    const h_liq = prop.liquidEnthalpy(TC - subcool);
    const QCin = compOuter.massFlow * (h_dis - h_liq);

    const F3 = QCout.QCout - QCin; // Ensure extraction from the object
    
    if (debug) console.log(
      `  T2=${inner.T2.toFixed(3)} PR=${inner.PR.toFixed(4)} F3=${F3.toFixed(3)}`
    );

    if (Math.abs(F3) < tolOuter) {
      return {
        TC,
        T2:                   inner.T2,
        PR:                   inner.PR,
        TE,
        converged:            true,
        outerIterations:      iter + 1,
        innerTotalIterations: totalInner,
        heatLoads:            inner.heatLoads,
        compressor:           inner.compressor,
        MR:                   inner.MR,
        MF:                   inner.MF,
      };
    }

    // ── 3. Perturb TC for numerical derivative (Recalculating QCin) ──────────
    const pertOpts = { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR };
    let innerPert  = solveInner(
      TC + DH, geom, compParams, refrigerant, subcool,
      fixedTemps, fan, electrical, condenserConfig,
      TE, freezerPosition, pertOpts
    );
    
    if (!innerPert.converged) {
      innerPert = solveInner(
        TC + DH, geom, compParams, refrigerant, subcool,
        fixedTemps, fan, electrical, condenserConfig,
        TE, freezerPosition, innerOptions
      );
    }
    
    if (!innerPert.converged)
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Perturbation inner loop failed' };
      
    totalInner += innerPert.iterations;

    // Corrected physical derivative: QCin MUST change with TC
    const QCout_pert = calcQCout(
      geom, TC + DH, T0, fixedTemps.TF, fixedTemps.TR, innerPert.PR, 
      PIPEPITCH, freezerPosition, backCondenserEfficiency
    );
    
    const compOuter_pert = evaluateCompressorSafely(TE, TC + DH, refIndex, compParams);
    const Pc_pert = prop.satPressure(TC + DH + KELVIN_OFFSET);
    const h_dis_pert = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, Pc_pert);
    const h_liq_pert = prop.liquidEnthalpy(TC + DH - subcool);
    const QCin_pert = compOuter_pert.massFlow * (h_dis_pert - h_liq_pert);

    const F3_pert = QCout_pert.QCout - QCin_pert;
    const dF3dTC = (F3_pert - F3) / DH;

    if (Math.abs(dF3dTC) < 1e-9)
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative in outer loop' };

    const step = F3 / dF3dTC;
    const clampedStep = Math.max(-5, Math.min(5, step)); // Clamped step size for stability
    TC -= clampedStep;
  }

  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations reached' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic TE wrapper — iterates TE using NTU-effectiveness model
// ─────────────────────────────────────────────────────────────────────────────

export function runThermalAnalysisDynamic(config) {
  const { fixedTemps, fan, evapGeom } = config;
  const { TF, TR } = fixedTemps;

  const evapWidth_m = (evapGeom?.evapWidth_mm ?? 460) / 1000;
  const evapDepth_m = (evapGeom?.evapDepth_mm ?? 60)  / 1000;
  const evapArea_m2 =  evapGeom?.evapArea_m2  ?? 1.754;

  let TE = config.initialTE ?? -25.27;
  let result;

  for (let i = 0; i < 15; i++) { // Increased iterations to allow damping to settle
    result = solveThermalSystem(config, TE);
    if (!result.converged) return result;

    const { MR, MF, T2, PR } = result;

    // Mixed inlet temperature to evaporator
    const T1 = (MF * TF + MR * TR) / fan.totalAirflow;

    // Face velocity (m/s)
    const faceArea = evapWidth_m * evapDepth_m;
    const v_ms     = fan.totalAirflow / faceArea / 3600;

    // Heat transfer coefficient correlation
    const alpha = 12.93 * Math.pow(v_ms, 0.415);

    // NTU-effectiveness
    const C_air  = fan.totalAirflow * RHO_AIR * CP_AIR;
    const UA_eff = alpha * evapArea_m2 / Math.max(0.01, PR);
    const NTU    = UA_eff / C_air;
    const eff    = 1 - Math.exp(-NTU);

    // Updated TE from effectiveness definition
    const newTE = T1 - (T1 - T2) / Math.max(0.001, eff);

    if (Math.abs(newTE - TE) < 0.1) {
      result.TE = newTE;
      return result;
    }

    // Damping: Prevent diverging oscillation by stepping halfway
    TE = TE + 0.5 * (newTE - TE);
  }

  result.TE      = TE;
  result.warning = 'TE iteration did not fully converge within tolerance';
  return result;
}
export function EnergyConsumption(result) {
  if (!result.converged) return NaN;
  const { compressor, fan, electrical } = result;
  const OnPower_W = (compressor.inputPower ?? 0) + (fan.inputPower_W ?? 0) + (electrical.pwbOn_W ?? 0);
  const EnergyConsumption_W = (OnPower_W * PR + electrical.pwboff_W * (1-PR)) * 24/1000 + electrical.defrostOn_min* electrical.defrostOn_W * (24/(10.5/PR)) / 60 / 1000;
  const EnergyConsumption_kWhMonth = EnergyConsumption_W * 30; // kWh/month
  return {EnergyConsumption_W, EnergyConsumption_kWhMonth}; // kWh/day and kWh/month
}