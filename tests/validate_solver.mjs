// tests/validate_solver.mjs – validates the universal solver against SJ‑540 and PV73K
import { solveThermalSystem, runThermalAnalysisDynamic } from '../src/js/engine/thermo/solver.js';

// ────────────── SJ‑540 (top‑freezer) ──────────────
const geom54 = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130, Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40, tRfloor: 70,
};

const compParams54 = {
  rpm: 2900, rpm0: 2900, Vc: 11.14, T_suction: 32.2,
  volEffCoeffs: { A: 0.9260142251566365, B: -0.01221312333322575, C: -0.0023789273042382304 },
  kEtaV: { a: 1, b: 0, c: 0 },
  powerCoeffs: { AW: 135.175, BW: 2.6366666666666667, CW: 0.975, DW: 0.02, EW: 0.016666666666666666 },
  powerKw: { a: 1, b: 0, c: 0 },
};

const condenserConfig54 = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

const config54 = {
  geom: geom54,
  compParams: compParams54,
  condenserConfig: condenserConfig54,
  refrigerant: 'R-600a',
  subcool: 10,
  dischargeTemp: 60,
  fixedTemps: { T0: 30, TF: -18, TR: 3 },
  fan: { totalAirflow: 59.5, inputPower_W: 2.1 },
  electrical: { defrostHeater_W: 140, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 },
  pipePitch: { side: 150, back: 200 },
  backEff: 0.7,
  freezerPosition: 'top',
  TC0: 41,                     // start near expected TC
  DH: 0.001,
  tolOuter: 0.001,
  maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100, initialT2: -21.25, initialPR: 0.59, debug: false },
};

// ────────────── PV73K (bottom‑freezer) ──────────────
const geom73 = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048, Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76, tFdoor: 80, tFback: 55, tEvaBack: 55,
  tFfloor1: 76, tFfloor2: 80, tFfloor3: 82,
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80, tRdoor: 58,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRfloor: 32,
};

const compParams73 = {
  rpm: 2220, rpm0: 2220, Vc: 10.17, T_suction: 32.2,
  volEffCoeffs: { A: 0.930258355959706, B: -0.0122944055653239, C: -0.00205320515178857 },
  kEtaV: { a: 1, b: 0, c: 0 },
  powerCoeffs: { AW: -403.45924099761, BW: -10.6694476143275, CW: 13.0743243243218, DW: 0.348692065559428, EW: 0.0374699023348273 },
  powerKw: { a: 1, b: 0, c: 0 },
};

const condenserConfig73 = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

const config73 = {
  geom: geom73,
  compParams: compParams73,
  condenserConfig: condenserConfig73,
  refrigerant: 'R-600a',
  subcool: 10,
  dischargeTemp: 60,
  fixedTemps: { T0: 25, TF: -18, TR: 3 },
  fan: { totalAirflow: 146.4, inputPower_W: 2.4 },
  electrical: { defrostHeater_W: 112, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 },
  pipePitch: { side: 150, back: 200 },
  backEff: 0.7,
  freezerPosition: 'bottom',
  TC0: 48,
  DH: 0.001,
  tolOuter: 0.001,
  maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100, initialT2: -19.5, initialPR: 0.78, debug: false },
};

// ── Run fixed‑TE validation ─────────────────────────────────────────
console.log('=== SJ‑540 Fixed‑TE Solver ===');
const res54 = solveThermalSystem(config54, -25.27);   // Excel TE
if (res54.converged) {
  console.log('✅ Converged:');
  console.log(`TC = ${res54.TC.toFixed(2)} °C  (Excel 40.91)`);
  console.log(`T2 = ${res54.T2.toFixed(2)} °C  (Excel -21.25)`);
  console.log(`PR = ${(res54.PR*100).toFixed(1)} %  (Excel 59.1%)`);
  console.log(`QF = ${res54.heatLoads.QF.toFixed(2)}  (Excel 27.36)`);
  console.log(`QR = ${res54.heatLoads.QR.toFixed(2)}  (Excel 39.41)`);
  console.log(`QEV = ${res54.heatLoads.QEV.toFixed(2)}  (Excel 5.43)`);
  console.log(`Comp cool = ${res54.compressor.coolingCapacity.toFixed(2)}  (Excel ?)`);
  console.log(`Input power = ${res54.compressor.inputPower.toFixed(2)} W`);
} else {
  console.log('❌ Failed:', res54.error);
}

console.log('\n=== PV73K Fixed‑TE Solver ===');
const res73 = solveThermalSystem(config73, -23.02);
if (res73.converged) {
  console.log('✅ Converged:');
  console.log(`TC = ${res73.TC.toFixed(2)} °C  (Excel 48.00)`);
  console.log(`T2 = ${res73.T2.toFixed(2)} °C  (Excel -19.50)`);
  console.log(`PR = ${(res73.PR*100).toFixed(1)} %  (Excel 78.0%)`);
  console.log(`QF = ${res73.heatLoads.QF.toFixed(2)}  (Excel 26.52)`);
  console.log(`QR = ${res73.heatLoads.QR.toFixed(2)}  (Excel 26.62)`);
  console.log(`QEV = ${res73.heatLoads.QEV.toFixed(2)}  (Excel 6.42)`);
  console.log(`Comp cool = ${res73.compressor.coolingCapacity.toFixed(2)}  (Excel 89.36)`);
  console.log(`Input power = ${res73.compressor.inputPower.toFixed(2)} W`);
} else {
  console.log('❌ Failed:', res73.error);
}

// ── Optional: dynamic TE test ───────────────────────────────────────
 console.log('\n=== SJ‑540 Dynamic TE ===');
 const dyn54 = runThermalAnalysisDynamic(config54);
 if (dyn54.converged) console.log(`TC=${dyn54.TC.toFixed(2)}, T2=${dyn54.T2.toFixed(2)}, TE=${dyn54.TE.toFixed(2)}`);
 else console.log('Failed:', dyn54.error);

 console.log('\n=== PV73K Dynamic TE ===');
 const dyn73 = runThermalAnalysisDynamic(config73);
 if (dyn73.converged) console.log(`TC=${dyn73.TC.toFixed(2)}, T2=${dyn73.T2.toFixed(2)}, TE=${dyn73.TE.toFixed(2)}`);
 else console.log('Failed:', dyn73.error);