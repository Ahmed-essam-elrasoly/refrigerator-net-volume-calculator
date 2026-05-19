// tests/debug_pv73k_final.mjs – PV73K validation (fixed input power)
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { getRefrigerantFunctions } from '../src/js/engine/thermo/refrigerant.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';

// -------------------------------------------------------------------
// PV73K geometry & component data (from Excel)
// -------------------------------------------------------------------
const geom = {
  H: 1794, W: 795, D: 687,
  Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
  evapWidth_m: 0.441, evapDepth_m: 0.058, evapArea_m2: 1.298,
};

const compParams = {
  rpm: 2220, rpm0: 2220, Vc: 10.17, T_suction: 32.2,
  volEffCoeffs: {
    A: 0.930258355959706,
    B: -0.0122944055653239,
    C: -0.00205320515178857
  },
  kEtaV: { a: 1, b: 0, c: 0 },
  // Power coefficients kept for reference, but not used below
  powerCoeffs: {
    AW: -403.45924099761,
    BW: -10.6694476143275,
    CW: 13.0743243243218,
    DW: 0.348692065559428,
    EW: 0.0374699023348273
  },
  powerKw: { a: 1, b: 0, c: 0 },
};

const condenserConfig = {
  K_side: 5.395,
  K_back: 4.17,
  backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

const FIXED_INPUT_POWER_W = 104.27;

// Compressor model with fixed power (mass flow / cooling are correct)
function compressorStateFixedPower(TC, TE, refrigerant, compParams, subcool) {
  const rf = getRefrigerantFunctions(refrigerant);
  const Pe = rf.satPressure(TE);
  const T_suc = compParams.T_suction;
  const v_suc = rf.specificVolume(T_suc, Pe);
  const Pc = rf.satPressure(TC);
  const { A, B, C } = compParams.volEffCoeffs;
  const etaBase = A + B * (Pc / Pe) + C * Pc;
  const kEtaV = compParams.kEtaV;
  const Kw = kEtaV.a + kEtaV.b * compParams.rpm + kEtaV.c * compParams.rpm * compParams.rpm;
  const etaV = etaBase * Kw;
  const mdot = etaV * compParams.rpm * compParams.Vc * 1e-6 * 60 / v_suc;
  const h_evap_out = rf.vaporEnthalpy(TE, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);
  const cooling = mdot * (h_evap_out - h_liquid);
  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: cooling,
    inputPower: FIXED_INPUT_POWER_W,
    h_evap_out,
    h_liquid,
  };
}

// 2x2 Newton solver (local copy, renamed)
function newton2Local(F, x0, dx, tol, maxIter, debug = false) {
  let x = [x0[0], x0[1]];
  let prevF = [Infinity, Infinity];
  let prevX = [...x];
  for (let i = 0; i < maxIter; i++) {
    const f = F(x);
    const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));
    if (debug) console.log(`  Newton iter ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)} F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)} max|F|=${maxAbsF.toExponential(2)}`);
    if (maxAbsF <= tol) return { x, converged: true, iterations: i + 1 };
    if (maxAbsF > Math.max(Math.abs(prevF[0]), Math.abs(prevF[1])) && i > 0) {
      if (debug) console.log('  Damping: residual increased, halving step');
      x[0] = (x[0] + prevX[0]) / 2;
      x[1] = (x[1] + prevX[1]) / 2;
      continue;
    }
    prevF = f;
    prevX = [...x];
    const J = [[0,0],[0,0]];
    for (let j = 0; j < 2; j++) {
      const xp = [x[0], x[1]]; xp[j] += dx;
      const fp = F(xp);
      J[0][j] = (fp[0] - f[0]) / dx;
      J[1][j] = (fp[1] - f[1]) / dx;
    }
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
    if (Math.abs(det) < 1e-12) {
      if (debug) console.log('  Singular Jacobian');
      return { x, converged: false, iterations: i + 1, error: 'Singular Jacobian' };
    }
    const dxT2 = (-f[0] * J[1][1] + f[1] * J[0][1]) / det;
    const dxPR = (J[0][0] * (-f[1]) + J[1][0] * f[0]) / det;
    x[0] = Math.max(-80, Math.min(20, x[0] + dxT2));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + dxPR));
  }
  if (debug) console.log('  Max iterations reached');
  return { x, converged: false, iterations: maxIter, error: 'Max iterations' };
}

// Custom inner solver using fixed‑power compressor
function solveInnerPV73K(TC, geom, compParams, refrigerant, subcool,
                         fixedTemps, fan, electrical, condenserConfig,
                         evapGeom, TE, innerOpts = {}) {
  const { dx = 0.001, tol = 1e-4, maxIter = 100, initialT2, initialPR, debug = false } = innerOpts;
  const { T0, TF, TR } = fixedTemps;
  const rho = 1.365, cp = 0.24;
  let currentMR = fan.totalAirflow * 0.1;
  let currentMF = fan.totalAirflow * 0.9;

  const F = (x) => {
    const T2 = x[0], PR = x[1];
    const sideRise = PR * (condenserConfig.K_side / 10) * (TC - T0);
    const backRise = PR * (condenserConfig.K_back / 10) * (TC - T0);
    const cr = { side: sideRise, back: backRise };

    const loads = calcHeatLoads(
      geom, { T0, TF, TR, T2, TC, PR, TE }, electrical,
      cr, fan.totalAirflow, evapGeom, fan.inputPower_W
    );
    const comp = compressorStateFixedPower(TC, TE, refrigerant, compParams, subcool);

    if (debug) {
      console.log(`    F call: T2=${T2.toFixed(4)} PR=${PR.toFixed(4)} TE=${TE.toFixed(3)}`);
      console.log(`      Loads: QF=${loads.QF.toFixed(3)} QR=${loads.QR.toFixed(3)} QEV=${loads.QEV.toFixed(3)} CompCool=${comp.coolingCapacity.toFixed(3)}`);
    }

    const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;

    const denom = fan.totalAirflow * rho * cp * PR;
    let F1;
    if (Math.abs(denom) < 1e-12) {
      F1 = loads.QF;
    } else {
      const T3 = T2 + loads.QEV / denom;
      const MR_raw = loads.QR / (rho * cp * Math.max(0.01, TR - T3) * PR);
      const MR = Math.min(fan.totalAirflow, Math.max(0, MR_raw));
      const MF = fan.totalAirflow - MR;
      currentMR = MR;
      currentMF = MF;
      F1 = loads.QF - MF * rho * cp * (TF - T2) * PR;
    }
    return [F1, F2];
  };

  let T2_guess = initialT2 ?? -19.5;
  let PR_guess = initialPR ?? 0.78;
  let res = newton2Local(F, [T2_guess, PR_guess], dx, tol, maxIter, debug);
  if (!res.converged) {
    const altGuesses = [[-19.5, 0.5], [-18, 0.7], [-21, 0.9]];
    for (const [t2, pr] of altGuesses) {
      if (debug) console.log(`  Retrying with T2=${t2}, PR=${pr}`);
      res = newton2Local(F, [t2, pr], dx, tol, maxIter, debug);
      if (res.converged) break;
    }
  }
  if (!res.converged) return { T2: res.x[0], PR: res.x[1], TE, converged: false, error: res.error };

  const finalT2 = res.x[0], finalPR = res.x[1];
  const sr = finalPR * (condenserConfig.K_side / 10) * (TC - T0);
  const br = finalPR * (condenserConfig.K_back / 10) * (TC - T0);
  const loads = calcHeatLoads(
    geom, { T0, TF, TR, T2: finalT2, TC, PR: finalPR, TE }, electrical,
    { side: sr, back: br }, fan.totalAirflow, evapGeom, fan.inputPower_W
  );
  const comp = compressorStateFixedPower(TC, TE, refrigerant, compParams, subcool);
  return {
    T2: finalT2, PR: finalPR, TE,
    converged: true, iterations: res.iterations,
    heatLoads: loads, compressor: comp,
    MR: currentMR, MF: currentMF
  };
}

// -------------------------------------------------------------------
// Full PV73K solver using custom inner loop and fixed‑TE
// -------------------------------------------------------------------
function solvePV73K() {
  const areas = computeCondenserAreas(geom, condenserConfig);
  const T0 = 25;
  const TE = -23.02;   // Excel converged TE
  let TC = 48.0;       // start at Excel TC
  const DH = 0.001, tolOuter = 0.001, maxIterOuter = 50;
  const innerOptions = {
    dx: 0.001, tol: 1e-4, maxIter: 100,
    initialT2: -19.5, initialPR: 0.78,
    debug: true
  };

  for (let iter = 0; iter < maxIterOuter; iter++) {
    console.log(`\nOuter iteration ${iter}, TC=${TC.toFixed(2)}`);
    const inner = solveInnerPV73K(TC, geom, compParams, 'R-600a', 10,
                                  { T0, TF: -18, TR: 3 },
                                  { totalAirflow: 146.4, inputPower_W: 2.4 },
                                  { defrostHeater_W: 112, defrostOn_min: 0 },
                                  condenserConfig, geom, TE, innerOptions);
    if (!inner.converged) {
      console.log(`Inner loop failed at TC=${TC.toFixed(2)}`);
      break;
    }
    const QCout = calcQCout(TC, T0, -18, 3, areas);
    const QCin = calcQCin(TC, TE, 'R-600a', compParams, 10, 60);
    const F3 = QCout - QCin;
    console.log(`  Inner converged: T2=${inner.T2.toFixed(3)} PR=${(inner.PR*100).toFixed(1)}%  F3=${F3.toFixed(2)}`);
    if (Math.abs(F3) < tolOuter) {
      console.log(`\n✅ Converged at TC=${TC.toFixed(2)}`);
      console.log(`T2 = ${inner.T2.toFixed(2)} °C (Excel -19.50)`);
      console.log(`PR = ${(inner.PR*100).toFixed(1)} %   (Excel 78.0%)`);
      console.log(`QF = ${inner.heatLoads.QF.toFixed(2)} kcal/h   (Excel 45.44)`);
      console.log(`QR = ${inner.heatLoads.QR.toFixed(2)} kcal/h   (Excel 14.39)`);
      console.log(`QEV = ${inner.heatLoads.QEV.toFixed(2)} kcal/h   (Excel 9.86)`);
      console.log(`Comp cooling = ${inner.compressor.coolingCapacity.toFixed(2)} kcal/h   (Excel 89.36)`);
      console.log(`Input power (fixed) = ${inner.compressor.inputPower.toFixed(2)} W   (Excel 104.27)`);
      // Compute dynamic TE
      const { MR, MF, T2 } = inner;
      const T1 = (MF * (-18) + MR * 3) / 146.4;
      const faceArea = 0.441 * 0.058;
      const v_ms = 146.4 / faceArea / 3600;
      const alpha = 12.93 * Math.pow(v_ms, 0.415);
      const C_air = 146.4 * 1.365 * 0.24;
      const UA = alpha * 1.298;
      const NTU = UA / Math.max(1e-6, C_air);
      const eff = 1 - Math.exp(-NTU);
      const TE_new = T1 - (T1 - T2) / Math.max(0.001, eff);
      console.log(`📐 Dynamic TE from NTU model = ${TE_new.toFixed(2)} °C (Excel -23.02)`);
      return;
    }
    // Perturb TC to compute derivative
    const innerPert = solveInnerPV73K(TC + DH, geom, compParams, 'R-600a', 10,
                                      { T0, TF: -18, TR: 3 },
                                      { totalAirflow: 146.4, inputPower_W: 2.4 },
                                      { defrostHeater_W: 112, defrostOn_min: 0 },
                                      condenserConfig, geom, TE, innerOptions);
    if (!innerPert.converged) {
      console.log('Perturbation failed');
      break;
    }
    const dF3dTC = ((calcQCout(TC + DH, T0, -18, 3, areas) - calcQCin(TC + DH, TE, 'R-600a', compParams, 10, 60)) - F3) / DH;
    if (Math.abs(dF3dTC) < 1e-9) break;
    TC -= Math.max(-2, Math.min(2, F3 / dF3dTC));
  }
}

solvePV73K();