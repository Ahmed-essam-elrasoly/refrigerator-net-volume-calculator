// tests/debug_pv73k_dynamicWall.mjs – test if dynamic wall formula works for bottom-freezer
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';

// PV73K geometry
const geom = {
  H: 1794, W: 795, D: 687, Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
  evapWidth_m: 0.441, evapDepth_m: 0.058, evapArea_m2: 1.298,
};

const compParams = {
  rpm: 2220, rpm0: 2220, Vc: 10.17, T_suction: 32.2,
  volEffCoeffs: { A: 0.930258355959706, B: -0.0122944055653239, C: -0.00205320515178857 },
  kEtaV: { a: 1, b: 0, c: 0 },
  powerCoeffs: { AW: -403.45924099761, BW: -10.6694476143275, CW: 13.0743243243218, DW: 0.348692065559428, EW: 0.0374699023348273 },
  powerKw: { a: 1, b: 0, c: 0 },
};

const condenserConfig = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

// Newton
function newton2(F, x0, dx, tol, maxI) {
  let x = [x0[0], x0[1]];
  for (let i = 0; i < maxI; i++) {
    const f = F(x);
    if (Math.max(Math.abs(f[0]), Math.abs(f[1])) <= tol) return { x, converged: true, iterations: i + 1 };
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
  return { x, converged: false, iterations: maxI, error: 'Max iter' };
}

// Outer solver using the SJ-540 dynamic wall formula: sideRise = PR * (K_side/10) * (TC - T0)
function solveWithDynamicFormula() {
  const areas = computeCondenserAreas(geom, condenserConfig);
  const T0 = 25, TF = -18, TR = 3;
  const TE = -23.02;   // Excel TE
  let TC = 48.0;
  const DH = 0.001, tolOuter = 0.001, maxOuter = 50;

  for (let iter = 0; iter < maxOuter; iter++) {
    // Compute wall rises using the same dynamic formula as SJ-540
    const sideRise = 0.78 * (condenserConfig.K_side/10) * (TC - T0); // initial guess with PR=0.78
    const backRise = 0.78 * (condenserConfig.K_back/10) * (TC - T0);
    const cr = { side: sideRise, back: backRise };

    let MR = 146.4 * 0.02, MF = 146.4 * 0.98;

    const F = (x) => {
      const T2 = x[0], PR = x[1];
      const sr = PR * (condenserConfig.K_side/10) * (TC - T0);
      const br = PR * (condenserConfig.K_back/10) * (TC - T0);
      const cr2 = { side: sr, back: br };
      const loads = calcHeatLoads(geom, { T0, TF, TR, T2, TC, PR, TE },
        { defrostHeater_W: 112, defrostOn_min: 0 }, cr2, 146.4, geom, 2.4);
      const comp = compressorState(TC, TE, 'R-600a', compParams, 10);
      const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;
      const denomF = 146.4 * 1.365 * 0.24 * PR;
      let F1;
      if (Math.abs(denomF) < 1e-12) { F1 = loads.QF; }
      else {
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
      for (const [t2, pr] of [[-19.5, 0.5], [-18, 0.7], [-21, 0.9]]) {
        res = newton2(F, [t2, pr], 0.001, 1e-4, 100);
        if (res.converged) break;
      }
    }
    if (!res.converged) { console.log('Inner loop failed'); return; }

    const T2_f = res.x[0], PR_f = res.x[1];
    const sr = PR_f * (condenserConfig.K_side/10) * (TC - T0);
    const br = PR_f * (condenserConfig.K_back/10) * (TC - T0);
    console.log(`\nTC=${TC.toFixed(2)}  T2=${T2_f.toFixed(2)}  PR=${(PR_f*100).toFixed(1)}%`);
    console.log(`Dynamic wall rises: side=${sr.toFixed(2)} °C (Excel 2.22), back=${br.toFixed(2)} °C (Excel 1.71)`);
    console.log(`Expected T_side = ${(T0+sr).toFixed(2)} °C (Excel 27.22), T_back = ${(T0+br).toFixed(2)} °C (Excel 26.71)`);

    // Now check the heat loads that result from these wall rises
    const loads_check = calcHeatLoads(geom, { T0, TF, TR, T2: T2_f, TC, PR: PR_f, TE },
      { defrostHeater_W: 112, defrostOn_min: 0 }, { side: sr, back: br }, 146.4, geom, 2.4);
    console.log(`QF=${loads_check.QF.toFixed(2)} (Excel 45.44)  QR=${loads_check.QR.toFixed(2)} (Excel 14.39)`);

    // Condenser balance with these wall temperatures
    const QCout = calcQCout(TC, T0, TF, TR, PR_f, areas);
    const QCin = calcQCin(TC, TE, 'R-600a', compParams, 10, 60);
    const F3 = QCout - QCin;
    console.log(`F3 = ${F3.toFixed(2)}`);

    // Update TC
    if (Math.abs(F3) < tolOuter) {
      console.log(`\n✅ Converged with dynamic wall formula.`);
      console.log(`Final TC = ${TC.toFixed(2)} °C (Excel 48.00)`);
      return;
    }

    // Perturbation...
    const resPert = newton2((x) => {
      const T2 = x[0], PR = x[1];
      const sr = PR * (condenserConfig.K_side/10) * (TC+DH - T0);
      const br = PR * (condenserConfig.K_back/10) * (TC+DH - T0);
      const loads = calcHeatLoads(geom, { T0, TF, TR, T2, TC: TC+DH, PR, TE },
        { defrostHeater_W: 112, defrostOn_min: 0 }, { side: sr, back: br }, 146.4, geom, 2.4);
      const comp = compressorState(TC+DH, TE, 'R-600a', compParams, 10);
      const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * PR;
      const denomF = 146.4 * 1.365 * 0.24 * PR;
      let F1;
      if (Math.abs(denomF) < 1e-12) { F1 = loads.QF; }
      else {
        const T3 = T2 + loads.QEV / denomF;
        F1 = loads.QF - (146.4 - loads.QR / (1.365 * 0.24 * Math.max(0.01, TR - T3) * PR)) * 1.365 * 0.24 * (TF - T2) * PR;
      }
      return [F1, F2];
    }, [T2_f, PR_f], 0.001, 1e-4, 100);
    if (!resPert.converged) { console.log('Perturbation failed'); return; }
    const PR_p = resPert.x[1];
    const comp_p = compressorState(TC+DH, TE, 'R-600a', compParams, 10);
    const QCout_p = calcQCout(TC+DH, T0, TF, TR, PR_p, areas);
    const QCin_p = calcQCin(TC+DH, TE, 'R-600a', compParams, 10, 60);
    const dF3 = ((QCout_p - QCin_p) - F3) / DH;
    if (Math.abs(dF3) < 1e-9) break;
    TC -= Math.max(-2, Math.min(2, F3 / dF3));
  }
}

solveWithDynamicFormula();