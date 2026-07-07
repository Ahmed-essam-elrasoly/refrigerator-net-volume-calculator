// solver.js – Universal thermal solver (SI units, corrected)
import { calcHeatLoads } from './heatLoad.js';
import { calcQCout } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { compressorPower, getRefrigerantProperties } from './CompressorPerformance.js';

const RHO_AIR       = PHYSICAL_CONSTANTS.air.density;   // kg/m³
const CP_AIR        = PHYSICAL_CONSTANTS.air.cp;        // kJ/(kg·K)
const KELVIN_OFFSET = 273.16;

// ─────────────────────────────────────────────────────────────────────────────
// Helper constants for air‑side calculations
// ─────────────────────────────────────────────────────────────────────────────
// Volumetric heat capacity: W per (m³/h) per K
const CV = RHO_AIR * CP_AIR * 1000 / 3600;   // (J/(m³·K)) / 3600 = W/(m³/h·K)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & Safe Wrappers
// ─────────────────────────────────────────────────────────────────────────────

function getRefrigerantIndex(name) {
  if (name === 'R-134a') return 1;
  if (name === 'R-600a') return 2;
  throw new Error(`Unsupported refrigerant: ${name}`);
}

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
  let f     = F(x);
  let normF = Math.sqrt(f[0]*f[0] + f[1]*f[1]);

  for (let i = 0; i < maxIter; i++) {
    if (debug) console.log(
      `  Newton ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)}` +
      ` F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)} norm=${normF.toExponential(2)}`
    );

    if (normF <= tol) return { x, converged: true, iterations: i + 1 };

    // Numerical Jacobian
    const J = [[0, 0], [0, 0]];
    for (let j = 0; j < 2; j++) {
      const xp = [x[0], x[1]];
      xp[j] += dx;
      const fp = F(xp);
      J[0][j] = (fp[0] - f[0]) / dx;
      J[1][j] = (fp[1] - f[1]) / dx;
    }

    // ─── 1. Try Newton step ──────────────────────────────────────────
    let direction = null;
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (Math.abs(det) > 1e-12) {
      const invDet = 1.0 / det;
      const dNewton = [
        -invDet * ( J[1][1] * f[0] - J[0][1] * f[1] ),
        -invDet * (-J[1][0] * f[0] + J[0][0] * f[1] )
      ];
      // Test full step with bounds
      const xFull = [
        Math.max(-80, Math.min(20, x[0] + dNewton[0])),
        Math.max(0.001, Math.min(0.999, x[1] + dNewton[1]))
      ];
      const fFull = F(xFull);
      if (fFull && Math.sqrt(fFull[0]*fFull[0]+fFull[1]*fFull[1]) < normF - 1e-4 * normF) {
        direction = dNewton;
      }
    }

    // ─── 2. Fallback to gradient descent if Newton fails ─────────────
    if (!direction) {
      const grad0 = J[0][0] * f[0] + J[1][0] * f[1];
      const grad1 = J[0][1] * f[0] + J[1][1] * f[1];
      const normGrad = Math.sqrt(grad0*grad0 + grad1*grad1);
      if (normGrad < 1e-12) {
        return { x, converged: false, iterations: i + 1,
                 error: 'Gradient zero, stationary point' };
      }
      direction = [ -grad0 / normGrad * 0.1, -grad1 / normGrad * 0.1 ];
      if (debug) console.log('    Using gradient descent direction');
    }

    // ─── 3. Backtracking line search along chosen direction ──────────
    let alpha = 1.0;
    const maxBacktracks = 15;
    let accept = false;
    let newX, newF, newNorm;

    for (let bt = 0; bt < maxBacktracks; bt++) {
      newX = [
        Math.max(-80, Math.min(20, x[0] + alpha * direction[0])),
        Math.max(0.001, Math.min(0.999, x[1] + alpha * direction[1]))
      ];
      newF   = F(newX);
      newNorm = Math.sqrt(newF[0]*newF[0] + newF[1]*newF[1]);
      if (newNorm < normF - 1e-4 * alpha * normF) {
        accept = true;
        break;
      }
      alpha *= 0.5;
    }

    if (!accept) {
      return { x, converged: false, iterations: i + 1,
               error: 'Line search failed – cannot reduce residual' };
    }

    // ─── 4. Handle PR clamped at physical bound ──────────────────────
    if ((newX[1] <= 0.001 || newX[1] >= 0.999) && i > 10 && newNorm > 1e-2) {
      return {
        x: newX, converged: false, iterations: i + 1,
        error: `PR clamped at ${newX[1].toFixed(4)} – compressor undersized or oversized`
      };
    }
    // Update for next iteration
    x = newX;
    f = newF;
    normF = newNorm;
    if (debug) console.log(`    α=${alpha.toExponential(2)} → norm=${newNorm.toExponential(2)}`);
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

  const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };
  const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0;
  const backCondenser = condenserConfig.backCondenser ?? 'No';

  const refIndex = getRefrigerantIndex(refrigerant);
  let currentMR = fan.totalAirflow * 0.1;   // m³/h
  let currentMF = fan.totalAirflow * 0.9;   // m³/h

  // Residual vector F(T2, PR)
  const F = ([T2, PR]) => {
    if (debug) console.log(`    F call: T2=${T2.toFixed(4)}, PR=${PR.toFixed(6)}`);

    let loads;
    try {
      loads = calcHeatLoads(
        geom,
        { T0, TF, TR, T2, TC, PR, TE },
        electrical,
        PIPEPITCH,
        backCondenserEfficiency,
        fan.inputPower_W ?? 2.1,
        freezerPos,
        backCondenser
      );
    } catch (e) {
      console.error('calcHeatLoads threw:', e.message, e.stack);
      throw e;
    }

    let comp;
    try {
      comp = evaluateCompressorSafely(TE, TC, refIndex, compParams);
    } catch (e) {
      console.error('evaluateCompressorSafely threw:', e.message, 'at TE=', TE, 'TC=', TC);
      throw e;
    }

    if (debug) {
      console.log(`    loads: QF=${loads.QF}, QR=${loads.QR}, QEV=${loads.QEV}`);
      console.log(`    comp: QComp=${comp.QCompressor}, Power=${comp.CompPower}, Pe=${comp.Pe}, Pc=${comp.Pc}`);
    }

    // Air side calculations using volumetric heat capacity CV (W per m³/h per K)
    const C_tot = fan.totalAirflow * CV;               // W/K (total airflow heat capacity rate)
    const T3 = T2 + loads.QEV / (C_tot * PR);         // °C   (PR may be small; check denom)
    const denomR = CV * Math.max(0.01, TR - T3) * PR; // W/(m³/h)  (for MR calculation)
    const MR = denomR > 0 ? Math.min(fan.totalAirflow, Math.max(0, loads.QR / denomR)) : 0;
    const MF = fan.totalAirflow - MR;                  // m³/h
    currentMR = MR;
    currentMF = MF;

    // F1 = QF - MF * CV * (TF - T3) * PR   (W)
    const F1 = loads.QF - MF * CV * (TF - T3) * PR;
    // F2 = total heat load - cooling capacity * PR  (W)
    const F2 = (loads.QF + loads.QR + loads.QEV) - comp.QCompressor * PR;

    if (debug) console.log(`    F1=${F1.toFixed(4)}, F2=${F2.toFixed(4)}`);
    return [F1, F2];
  };

  // Solve — fall back through alternative guesses on failure
  let totalIter = 0;
  const T2_guess = initialT2 ?? -21.25;
  const PR_guess = initialPR ?? 0.59;
  let res = newton2(F, [T2_guess, PR_guess], dx, tol, maxIter, debug);
  totalIter += res.iterations;

  if (!res.converged && res.error && res.error.includes('compressor undersized')) {
    return { T2: res.x[0], PR: res.x[1], converged: false, iterations: totalIter, error: res.error };
  }

  if (!res.converged) {
    for (const [t2, pr] of [[T2_guess, 0.4], [T2_guess - 2, 0.5], [-21, 0.3]]) {
      res = newton2(F, [t2, pr], dx, tol, maxIter, debug);
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
      coolingCapacity: comp.QCompressor,      // W
      inputPower:      comp.CompPower,        // W
      COP:             comp.QCompressor / comp.CompPower,   // dimensionless (W/W)
      massFlow:        comp.massFlow,         // kg/h
      Pe:              comp.Pe,               // bar
      Pc:              comp.Pc,               // bar
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
  let prevF3, prevTC;
  let prevInner  = null;

  for (let iter = 0; iter < maxIterOuter; iter++) {
    if (debug) console.log(`\nOuter ${iter}, TC=${TC.toFixed(2)}`);

    if (TC < T0) TC = T0 + 2;
    if (TC > 90) TC = 90;

    const baseOpts = prevInner
      ? { ...innerOptions, initialT2: prevInner.T2, initialPR: prevInner.PR }
      : innerOptions;

    let inner = solveInner(
      TC, geom, compParams, refrigerant, subcool,
      fixedTemps, fan, electrical, condenserConfig,
      TE, freezerPosition, baseOpts
    );
    console.log('inner.compressor:', inner.compressor);
    console.log('inner.converged:', inner.converged, inner.error || '');
    if (!inner.converged) {
      if (inner.error && inner.error.includes('undersized')) {
        return { 
          TC, T2: inner.T2, PR: inner.PR, converged: false, 
          error: `Physical limit reached: Compressor undersized at TC=${TC.toFixed(2)}. Required PR > 1.` 
        };
      }
      if (iter > 0 && typeof prevTC !== 'undefined') {
        const MAX_BACKTRACK = 3;
        let success = false;
        for (let bt = 0; bt < MAX_BACKTRACK; bt++) {
          const step = (TC - prevTC) * 0.5;
          const backtrackTC = prevTC + step;
          if (debug) console.log(`  Backtrack TC=${backtrackTC.toFixed(3)}`);
          const opts = { ...innerOptions, initialT2: prevInner.T2, initialPR: prevInner.PR };
          const innerRetry = solveInner(
            backtrackTC, geom, compParams, refrigerant, subcool,
            fixedTemps, fan, electrical, condenserConfig,
            TE, freezerPosition, opts
          );
          if (innerRetry.converged) {
            TC = backtrackTC;
            inner = innerRetry;
            totalInner += innerRetry.iterations;
            prevInner = { T2: inner.T2, PR: inner.PR };
            success = true;
            break;
          }
        }
        if (!success) {
          return { TC, T2: NaN, PR: NaN, converged: false,
                   error: 'Inner loop failed after backtracking' };
        }
      } else {
        return { TC, T2: NaN, PR: NaN, converged: false,
                 error: 'Inner loop failed: ' + inner.error };
      }
    } else {
      totalInner += inner.iterations;
      prevInner = { T2: inner.T2, PR: inner.PR };
    }

    // Condenser heat balance
    const QCout = calcQCout(
      geom, TC, T0, fixedTemps.TF, fixedTemps.TR, inner.PR,
      PIPEPITCH, freezerPosition, backCondenserEfficiency
    );  // returns object, QCout.QCout in W

    const compOuter = evaluateCompressorSafely(TE, TC, refIndex, compParams);
    const Pc = prop.satPressure(TC + KELVIN_OFFSET);
    const h_dis = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, Pc);   // kJ/kg
    const h_liq = prop.liquidEnthalpy(TC - subcool);                      // kJ/kg
    const QCin_W = compOuter.massFlow * (h_dis - h_liq) / 3.6;           // kg/h * kJ/kg = kJ/h → /3.6 → W

    const F3 = QCout.QCout - QCin_W;

    if (debug) console.log(
      `  T2=${inner.T2.toFixed(3)} PR=${inner.PR.toFixed(4)} F3=${F3.toFixed(3)}`
    );

    if (Math.abs(F3) < tolOuter) {
      return {
        TC,
        T2: inner.T2,
        PR: inner.PR,
        TE,
        Pe: inner.compressor.Pe,
        Pc: inner.compressor.Pc,
        converged: true,
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

    // Numerical derivative
    let innerPert = null;
    let appliedDH = DH;
    const pertOpts = { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR };

    try {
      innerPert = solveInner(
        TC + appliedDH, geom, compParams, refrigerant, subcool,
        fixedTemps, fan, electrical, condenserConfig,
        TE, freezerPosition, pertOpts
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
          TE, freezerPosition, pertOpts
        );
      } catch (e) {
        console.warn('Backward perturbation failed:', e.message);
        innerPert = null;
      }
    }

    let F3_pert, QCin_pert, dF3dTC;

    if (innerPert && innerPert.converged) {
      const QCout_pert = calcQCout(
        geom, TC + appliedDH, T0, fixedTemps.TF, fixedTemps.TR, innerPert.PR,
        PIPEPITCH, freezerPosition, backCondenserEfficiency
      );
      const compOuter_pert = evaluateCompressorSafely(TE, TC + appliedDH, refIndex, compParams);
      const Pc_pert = prop.satPressure(TC + appliedDH + KELVIN_OFFSET);
      const h_dis_pert = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET, Pc_pert);
      const h_liq_pert = prop.liquidEnthalpy(TC + appliedDH - subcool);
      QCin_pert = compOuter_pert.massFlow * (h_dis_pert - h_liq_pert) / 3.6;  // W
      F3_pert = QCout_pert.QCout - QCin_pert;
      dF3dTC = (F3_pert - F3) / appliedDH;
    } else {
      if (typeof prevF3 !== 'undefined' && typeof prevTC !== 'undefined') {
        const deltaTC = TC - prevTC;
        const safeDeltaTC = Math.abs(deltaTC) < 1e-6 ? 1e-6 * Math.sign(deltaTC || 1) : deltaTC;
        dF3dTC = (F3 - prevF3) / safeDeltaTC;
        if (Math.abs(dF3dTC) < 1e-6) dF3dTC = 1e-6;
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
      return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative in outer loop' };
    }

    const step = F3 / dF3dTC;
    TC -= Math.max(-5, Math.min(5, step));
  }

  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations reached' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic TE wrapper
// ─────────────────────────────────────────────────────────────────────────────

export function runThermalAnalysisDynamic(config) {
  const { fixedTemps, fan, evapGeom } = config;
  const { TF, TR } = fixedTemps;

  const evapWidth_m = (evapGeom?.evapWidth_mm ?? 460) / 1000;
  const evapDepth_m = (evapGeom?.evapDepth_mm ?? 60)  / 1000;
  const evapArea_m2 =  evapGeom?.evapArea_m2  ?? 1.754;

  let TE = config.initialTE ?? -25.27;
  let result;

  for (let i = 0; i < 15; i++) {
    result = solveThermalSystem(config, TE);
    if (!result.converged) return result;

    const { MR, MF, T2, PR } = result;
    const T1 = (MF * TF + MR * TR) / fan.totalAirflow;
    const faceArea = evapWidth_m * evapDepth_m;
    const v_ms     = fan.totalAirflow / faceArea / 3600;
    const alpha    = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;   // W/(m²·K) (converted from kcal/(h·m²·°C))
    const C_air    = fan.totalAirflow / 3600 * RHO_AIR * CP_AIR * 1000;  // W/K
    const UA_on    = alpha * evapArea_m2;                       // W/K
    const NTU      = UA_on / C_air;
    const ε        = 1 - Math.exp(-NTU);
    const newTE    = T1 - (T1 - T2) / ε;

    if (Math.abs(newTE - TE) < 0.1) {
      result.TE = newTE;
      return result;
    }
    TE = TE + 0.5 * (newTE - TE);
  }

  result.TE      = TE;
  result.warning = 'TE iteration did not fully converge within tolerance';
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
  const pwbOff_W = electrical.pwboff_W ?? 0;
  const defrostOn_W    = electrical.defrostOn_W    ?? electrical.defrostHeater_W ?? 0;
  const defrostOn_min  = electrical.defrostOn_min  ?? 0;
  const timerPeriod_h  = electrical.timerPeriod_h ?? 10.5;
  const fanPower       = fan.inputPower_W ?? 0;

  const OnPower_W = (compressor.inputPower ?? 0) + fanPower + pwbOn_W;

  const energy_W =
    (OnPower_W * PR + pwbOff_W * (1 - PR)) * 24 / 1000 +
    defrostOn_min * defrostOn_W * (24 / (timerPeriod_h / PR)) / 60 / 1000;

  return {
    EnergyConsumption_W: energy_W,
    EnergyConsumption_kWhMonth: energy_W * 30
  };
}