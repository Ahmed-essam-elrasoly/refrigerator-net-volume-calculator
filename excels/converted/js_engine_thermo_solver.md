# solver.js

**Original file:** `solver.js`

**File type:** .JS

**Size:** 8,643 bytes

**Last modified:** 2026-05-26 05:11:17


---

## Content

```javascript
// solver.js – universal thermal solver (dynamic wall temperatures + dynamic TE wrapper)
import { calcHeatLoads } from './heatLoad.js';
import { computeCondenserAreas, calcQCout } from './condenser.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { compressorState, resolveCompressorState } from './compressor.js';
import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorStateMap, SQ47LAEG_MAP } from './compressorMap.js';

const RHO_AIR = 1.365;
const CP_AIR  = 0.24;

// 2×2 Newton with damping
function newton2(F, x0, dx, tol, maxIter, debug = false) {
  let x = [x0[0], x0[1]];
  let prevF = [Infinity, Infinity];
  let prevX = [...x];
  for (let i = 0; i < maxIter; i++) {
    const f = F(x);
    const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));
    if (debug) console.log(`  Newton ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)} F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)}`);
    if (maxAbsF <= tol) return { x, converged: true, iterations: i + 1 };
    if (maxAbsF > Math.max(Math.abs(prevF[0]), Math.abs(prevF[1])) && i > 0) {
      if (debug) console.log('  Damping');
      x[0] = (x[0] + prevX[0]) / 2;
      x[1] = (x[1] + prevX[1]) / 2;
      continue;
    }
    prevF = f; prevX = [...x];
    const J = [[0,0],[0,0]];
    for (let j = 0; j < 2; j++) {
      const xp = [x[0], x[1]]; xp[j] += dx;
      const fp = F(xp);
      J[0][j] = (fp[0] - f[0]) / dx;
      J[1][j] = (fp[1] - f[1]) / dx;
    }
    const det = J[0][0]*J[1][1] - J[0][1]*J[1][0];
    if (Math.abs(det) < 1e-12) return { x, converged: false, iterations: i+1, error: 'Singular' };
    x[0] = Math.max(-80, Math.min(20, x[0] + (-f[0]*J[1][1] + f[1]*J[0][1])/det));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + (J[0][0]*(-f[1]) + J[1][0]*f[0])/det));
  }
  return { x, converged: false, iterations: maxIter, error: 'Max iter' };
}

// Inner solver – uses dynamic wall temperatures from cabinet heat balance
function solveInner(TC, geom, compParams, refrigerant, subcool,
                    fixedTemps, fan, electrical, condenserConfig,
                    evapGeom, TE, freezerPos, innerOpts = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100, initialT2, initialPR, debug = false } = innerOpts;
  const { T0, TF, TR } = fixedTemps;
  const rho = RHO_AIR, cp = CP_AIR;
    const PIPEPITCH = {
    side: condenserConfig.sidePipePitch_mm,
    back: condenserConfig.backPipePitch_mm,
  };

  let currentMR = fan.totalAirflow * 0.1, currentMF = fan.totalAirflow * 0.9;

  const F = (x) => {
    const T2 = x[0], PR = x[1];

    const loads = calcHeatLoads(
      geom, { T0, TF, TR, T2, TC, PR, TE }, electrical,
      PIPEPITCH, 0.7, fan.totalAirflow, evapGeom, fan.inputPower_W, freezerPos
    );
    const comp = resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0);
    const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;
    const denom = fan.totalAirflow * rho * cp * PR;
    let F1;
    if (Math.abs(denom) < 1e-12) { F1 = loads.QF; }
    else {
      const T3 = T2 + loads.QEV / denom;
      const MR_raw = loads.QR / (rho * cp * Math.max(0.01, TR - T3) * PR);
      const MR = Math.min(fan.totalAirflow, Math.max(0, MR_raw));
      const MF = fan.totalAirflow - MR;
      currentMR = MR; currentMF = MF;
      F1 = loads.QF - MF * rho * cp * (TF - T3) * PR;
    }
    return [F1, F2];
  };

  let T2_guess = initialT2 ?? -21.25, PR_guess = initialPR ?? 0.59;
  let res = newton2(F, [T2_guess, PR_guess], dx, tol, maxIter, debug);
  if (!res.converged) {
    for (const [t2, pr] of [[T2_guess, 0.4], [T2_guess-2, 0.5], [-21, 0.3]]) {
      res = newton2(F, [t2, pr], dx, tol, maxIter, debug);
      if (res.converged) break;
    }
  }
  if (!res.converged) return { T2: res.x[0], PR: res.x[1], converged: false };

  const fT2 = res.x[0], fPR = res.x[1];
  const loads = calcHeatLoads(
    geom, { T0, TF, TR, T2: fT2, TC, PR: fPR, TE }, electrical,
    PIPEPITCH, 0.7, fan.totalAirflow, evapGeom, fan.inputPower_W, freezerPos
  );
  const comp = resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0);
  return { T2: fT2, PR: fPR, TE, converged: true, heatLoads: loads, compressor: comp, MR: currentMR, MF: currentMF };
}
// Outer solver – adjusts TC until QCout = QCin, uses dynamic wall temperatures
export function solveThermalSystem(config, TE_override = null) {
  const {
    geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp,
    fixedTemps, fan, electrical,
    freezerPosition = 'top',
    TC0 = 45, DH = 0.001, tolOuter = 0.001, maxIterOuter = 50,
    innerOptions = {},
  } = config;

  const areas = computeCondenserAreas(geom, condenserConfig, freezerPosition);
  const T0 = fixedTemps.T0;
  let TC = TC0, totalInner = 0;
  const evapGeom = geom;
  const debug = innerOptions.debug ?? false;
  const TE = TE_override ?? config.initialTE ?? -25.27;


  for (let iter = 0; iter < maxIterOuter; iter++) {
    if (debug) console.log(`\nOuter ${iter}, TC=${TC.toFixed(2)}`);
    const inner = solveInner(TC, geom, compParams, refrigerant, subcool,
                         fixedTemps, fan, electrical, condenserConfig,
                         evapGeom, TE, freezerPosition, innerOptions);
    if (!inner.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Inner loop failed' };
    totalInner += inner.iterations;

    const QCout = calcQCout(TC, T0, fixedTemps.TF, fixedTemps.TR, areas);
    const compOuter = resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0);
    const rf = getRefrigerantFunctions(refrigerant);
    const h_dis = rf.vaporEnthalpy(dischargeTemp, rf.satPressure(TC));
    const Tsub = TC - subcool;
    const h_liq = rf.liquidEnthalpy(Tsub);
    const QCin = compOuter.massFlow * (h_dis - h_liq);

    const F3 = QCout - QCin;
    if (debug) console.log(`  T2=${inner.T2.toFixed(3)} PR=${inner.PR.toFixed(4)} F3=${F3.toFixed(3)}`);

    if (Math.abs(F3) < tolOuter) {
      return { TC, T2: inner.T2, PR: inner.PR, TE, converged: true, outerIterations: iter+1, innerTotalIterations: totalInner, heatLoads: inner.heatLoads, compressor: inner.compressor, MR: inner.MR, MF: inner.MF };
    }

    const pertOpts = { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR };
    let innerPert = solveInner(TC+DH, geom, compParams, refrigerant, subcool,
                               fixedTemps, fan, electrical, condenserConfig,
                               evapGeom, TE, freezerPosition, pertOpts);
    if (!innerPert.converged) innerPert = solveInner(TC+DH, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, evapGeom, TE, freezerPosition, innerOptions);
    if (!innerPert.converged) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Perturbation inner loop failed' };
    totalInner += innerPert.iterations;

    const dF3dTC = ((calcQCout(TC+DH, T0, fixedTemps.TF, fixedTemps.TR, areas) - QCin) - F3) / DH;
    if (Math.abs(dF3dTC) < 1e-9) return { TC, T2: NaN, PR: NaN, converged: false, error: 'Zero derivative' };
    TC -= Math.max(-2, Math.min(2, F3 / dF3dTC));
  }
  return { TC, T2: NaN, PR: NaN, converged: false, error: 'Outer loop max iterations' };
}

// Dynamic TE wrapper – iterates TE using NTU model
export function runThermalAnalysisDynamic(config) {
  const { fixedTemps, fan, geom, freezerPosition } = config;
  const { TF, TR } = fixedTemps;
  let TE = -25.27;
  let result;
  for (let i = 0; i < 5; i++) {
    result = solveThermalSystem(config, TE);
    if (!result.converged) return result;
    const { MR, MF, T2, TC, PR } = result;
    const T1 = (MF * TF + MR * TR) / fan.totalAirflow;
    const evapWidth_m  = (config.evapGeom?.evapWidth_mm  ?? 460) / 1000;
    const evapDepth_m  = (config.evapGeom?.evapDepth_mm  ?? 60)  / 1000;
    const evapArea_m2  =  config.evapGeom?.evapArea_m2   ?? 1.754;
    const faceArea = evapWidth_m * evapDepth_m;
    const v_ms = fan.totalAirflow / faceArea / 3600;
    const alpha = 12.93 * Math.pow(v_ms, 0.415);
    const C_air = fan.totalAirflow * RHO_AIR * CP_AIR;
    const UA_eff = alpha * evapArea_m2 / Math.max(0.01, PR);
    const NTU = UA_eff / C_air;
    const eff = 1 - Math.exp(-NTU);
    const newTE = T1 - (T1 - T2) / Math.max(0.001, eff);
    if (Math.abs(newTE - TE) < 0.1) {
      result.TE = newTE;
      return result;
    }
    TE = newTE;
  }
  result.TE = TE;
  result.warning = 'TE iteration did not fully converge';
  return result;
}
```


---

*Converted from `solver.js` on 2026-05-27 14:13:10*
