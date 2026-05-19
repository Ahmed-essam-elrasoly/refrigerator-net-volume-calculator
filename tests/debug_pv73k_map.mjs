// tests/debug_pv73k_map.mjs – PV73K with map‑based compressor
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { getRefrigerantFunctions } from '../src/js/engine/thermo/refrigerant.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';
import { compressorStateMap, SQ47LAEG_MAP } from '../src/js/engine/thermo/compressorMap.js';

// -------------------------------------------------------------------
// PV73K geometry
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

const condenserConfig = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

// Refrigerant functions for map lookup
const rf = getRefrigerantFunctions('R-600a');

// 2×2 Newton
function newton2(F, x0, dx, tol, maxIter) {
  let x = [x0[0], x0[1]];
  let prevF = [Infinity, Infinity], prevX = [...x];
  for (let i = 0; i < maxIter; i++) {
    const f = F(x);
    if (Math.max(Math.abs(f[0]), Math.abs(f[1])) <= tol) return { x, converged: true, iterations: i + 1 };
    if (Math.max(Math.abs(f[0]), Math.abs(f[1])) > Math.max(Math.abs(prevF[0]), Math.abs(prevF[1])) && i > 0) {
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
    if (Math.abs(det) < 1e-12) return { x, converged: false, iterations: i + 1, error: 'Singular' };
    x[0] = Math.max(-80, Math.min(20, x[0] + (-f[0]*J[1][1] + f[1]*J[0][1]) / det));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + (J[0][0]*(-f[1]) + J[1][0]*f[0]) / det));
  }
  return { x, converged: false, iterations: maxIter, error: 'Max iter' };
}

// -------------------------------------------------------------------
// Outer solver with map‑based compressor and fixed TE
// -------------------------------------------------------------------
function solvePV73K_map() {
  const areas = computeCondenserAreas(geom, condenserConfig);
  const T0 = 25, TF = -18, TR = 3;
  const TE = -23.02;        // Excel converged TE
  let TC = 48.0;
  const DH = 0.001, tolOuter = 0.001, maxOuter = 50;

  for (let iter = 0; iter < maxOuter; iter++) {
    console.log(`\nOuter iteration ${iter}, TC=${TC.toFixed(2)}`);

    // Inner solve for T2, PR with fixed TC and TE
    const sideRise0 = 0.78 * (condenserConfig.K_side/10) * (TC - T0);
    const backRise0 = 0.78 * (condenserConfig.K_back/10) * (TC - T0);
    const approxLoads = calcHeatLoads(geom, { T0, TF, TR, T2: -19.5, TC, PR: 0.78, TE },
      { defrostHeater_W: 112, defrostOn_min: 0 }, { side: sideRise0, back: backRise0 }, 146.4, geom, 2.4);
    const denom0 = 146.4 * 1.365 * 0.24 * 0.78;
    const T3_0 = -19.5 + approxLoads.QEV / denom0;
    let MR = approxLoads.QR / (1.365 * 0.24 * Math.max(0.01, TR - T3_0) * 0.78);
    MR = Math.min(146.4, Math.max(0, MR));
    let MF = 146.4 - MR;

    const F = (x) => {
      const T2 = x[0], PR = x[1];
      const sr = PR * (condenserConfig.K_side/10) * (TC - T0);
      const br = PR * (condenserConfig.K_back/10) * (TC - T0);
      const cr = { side: sr, back: br };
      const loads = calcHeatLoads(geom, { T0, TF, TR, T2, TC, PR, TE },
        { defrostHeater_W: 112, defrostOn_min: 0 }, cr, 146.4, geom, 2.4);
      const comp = compressorStateMap(TC, TE, SQ47LAEG_MAP, rf, 10);

      const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;
      const denomF = 146.4 * 1.365 * 0.24 * PR;
      let F1;
      if (Math.abs(denomF) < 1e-12) {
        F1 = loads.QF;
      } else {
        const T3 = T2 + loads.QEV / denomF;
        const mr = Math.min(146.4, Math.max(0, loads.QR / (1.365 * 0.24 * Math.max(0.01, TR - T3) * PR)));
        const mf = 146.4 - mr;
        MR = mr; MF = mf;
        F1 = loads.QF - mf * 1.365 * 0.24 * (TF - T2) * PR;
      }
      return [F1, F2];
    };

    let res = newton2(F, [-19.5, 0.78], 0.001, 1e-4, 100);
    if (!res.converged) {
      // try alternative guesses
      for (const [t2, pr] of [[-19.5, 0.5], [-18, 0.7], [-21, 0.9]]) {
        res = newton2(F, [t2, pr], 0.001, 1e-4, 100);
        if (res.converged) break;
      }
    }
    if (!res.converged) { console.log('Inner loop failed'); return; }

    const T2_f = res.x[0], PR_f = res.x[1];
    const sr_f = PR_f * (condenserConfig.K_side/10) * (TC - T0);
    const br_f = PR_f * (condenserConfig.K_back/10) * (TC - T0);
    const loads_f = calcHeatLoads(geom, { T0, TF, TR, T2: T2_f, TC, PR: PR_f, TE },
      { defrostHeater_W: 112, defrostOn_min: 0 }, { side: sr_f, back: br_f }, 146.4, geom, 2.4);
    const comp_f = compressorStateMap(TC, TE, SQ47LAEG_MAP, rf, 10);

    const QCout = calcQCout(TC, T0, TF, TR, areas);
    const QCin = calcQCin(TC, TE, 'R-600a', null, 10, 60);  // note: calcQCin uses compressor model internally, we'll override
    // But calcQCin calls compressorState – we need to use map values instead.
    // For QCin we just need the enthalpy drop and mass flow:
    const Pe = rf.satPressure(TE);
    const h_dis = rf.vaporEnthalpy(60, rf.satPressure(TC));  // discharge temp 60°C
    const h_liq_sat = rf.liquidEnthalpy(TC);
    const QCin_map = comp_f.massFlow * (h_dis - h_liq_sat);

    const F3 = QCout - QCin_map;
    console.log(`  T2=${T2_f.toFixed(2)} PR=${(PR_f*100).toFixed(1)}%  QF=${loads_f.QF.toFixed(2)} QR=${loads_f.QR.toFixed(2)} QEV=${loads_f.QEV.toFixed(2)}`);
    console.log(`  Comp cool=${comp_f.coolingCapacity.toFixed(2)} Power=${comp_f.inputPower.toFixed(2)}  F3=${F3.toFixed(2)}`);

    if (Math.abs(F3) < tolOuter) {
      console.log(`\n✅ Converged:`);
      console.log(`TC = ${TC.toFixed(2)} °C (Excel 48.00)`);
      console.log(`T2 = ${T2_f.toFixed(2)} °C (Excel -19.50)`);
      console.log(`PR = ${(PR_f*100).toFixed(1)} % (Excel 78.0%)`);
      console.log(`QF = ${loads_f.QF.toFixed(2)} (Excel 45.44)`);
      console.log(`QR = ${loads_f.QR.toFixed(2)} (Excel 14.39)`);
      console.log(`QEV = ${loads_f.QEV.toFixed(2)} (Excel 9.86)`);
      console.log(`Comp cooling = ${comp_f.coolingCapacity.toFixed(2)} (Excel 89.36)`);
      console.log(`Input power = ${comp_f.inputPower.toFixed(2)} (Excel 104.27)`);
      // Dynamic TE
      const T1 = (MF * TF + MR * TR) / 146.4;
      const faceArea = 0.441 * 0.058;
      const v_ms = 146.4 / faceArea / 3600;
      const alpha = 12.93 * Math.pow(v_ms, 0.415);
      const C_air = 146.4 * 1.365 * 0.24;
      const UA = alpha * 1.298;
      const NTU = UA / Math.max(1e-6, C_air);
      const eff = 1 - Math.exp(-NTU);
      const TE_new = T1 - (T1 - T2_f) / Math.max(0.001, eff);
      console.log(`📐 Dynamic TE = ${TE_new.toFixed(2)} °C (Excel -23.02)`);
      return;
    }

    // Perturbation
    const resPert = newton2((x) => {
      const T2 = x[0], PR = x[1];
      const sr = PR * (condenserConfig.K_side/10) * (TC + DH - T0);
      const br = PR * (condenserConfig.K_back/10) * (TC + DH - T0);
      const loads = calcHeatLoads(geom, { T0, TF, TR, T2, TC: TC + DH, PR, TE },
        { defrostHeater_W: 112, defrostOn_min: 0 }, { side: sr, back: br }, 146.4, geom, 2.4);
      const comp = compressorStateMap(TC + DH, TE, SQ47LAEG_MAP, rf, 10);
      const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;
      const denomF = 146.4 * 1.365 * 0.24 * PR;
      let F1;
      if (Math.abs(denomF) < 1e-12) { F1 = loads.QF; }
      else {
        const T3 = T2 + loads.QEV / denomF;
        const mr = Math.min(146.4, Math.max(0, loads.QR / (1.365 * 0.24 * Math.max(0.01, TR - T3) * PR)));
        const mf = 146.4 - mr;
        F1 = loads.QF - mf * 1.365 * 0.24 * (TF - T2) * PR;
      }
      return [F1, F2];
    }, [T2_f, PR_f], 0.001, 1e-4, 100);

    if (!resPert.converged) { console.log('Perturbation failed'); return; }
    const T2_p = resPert.x[0], PR_p = resPert.x[1];
    const comp_p = compressorStateMap(TC + DH, TE, SQ47LAEG_MAP, rf, 10);
    const h_dis_p = rf.vaporEnthalpy(60, rf.satPressure(TC + DH));
    const h_liq_p = rf.liquidEnthalpy(TC + DH);
    const QCin_p = comp_p.massFlow * (h_dis_p - h_liq_p);
    const QCout_p = calcQCout(TC + DH, T0, TF, TR, areas);
    const dF3 = ((QCout_p - QCin_p) - F3) / DH;
    if (Math.abs(dF3) < 1e-9) break;
    TC -= Math.max(-2, Math.min(2, F3 / dF3));
  }
}

solvePV73K_map();