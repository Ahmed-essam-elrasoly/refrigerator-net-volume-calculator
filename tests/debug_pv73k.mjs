// tests/debug_pv73k.mjs – validate against PV73K Excel model
import { runThermalAnalysisDynamic } from '../src/js/engine/thermo/solver.js';

// --- Geometry from PV73K SIZE sheet ---
const geom = {
  H: 1794, W: 795, D: 687,
  Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,

  // Freezer wall thicknesses (mm)
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  // Refrigerator wall thicknesses
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,

  // Evaporator geometry (for dynamic TE)
  evapWidth_m: 0.441,    // 441 mm
  evapDepth_m: 0.058,    // 58 mm
  evapArea_m2: 1.298,    // total surface area from SIZE
};

// --- Compressor data from PV73K DATA sheet ---
const compParams = {
  name: 'SQ47LAEG 220V 50Hz',
  rpm: 2220,
  rpm0: 2220,
  Vc: 10.17,               // cc
  T_suction: 32.2,          // °C
  volEffCoeffs: {
    A: 0.930258355959706,
    B: -0.0122944055653239,
    C: -0.00205320515178857,
  },
  kEtaV: { a: 1, b: 0, c: 0 },
  powerCoeffs: {
    AW: -403.45924099761,
    BW: -10.6694476143275,
    CW: 13.0743243243218,
    DW: 0.348692065559428,
    EW: 0.0374699023348273,
  },
  powerKw: { a: 1, b: 0, c: 0 },
};

// --- Condenser configuration (same as PV73K MAIN formulas) ---
const condenserConfig = {
  K_side: 5.395,
  K_back: 4.17,
  backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405,
  k_RFront2: 0.03322,
  k_FRPartition1: 0.1984,
  k_FRPartition2: 0.1219,
  k_FFront1: 0.3395,
  k_FFront2: 0.0344,
};

const config = {
  geom,
  compParams,
  condenserConfig,
  refrigerant: 'R-600a',
  subcool: 10,
  dischargeTemp: 60,
  fixedTemps: { T0: 25, TF: -18, TR: 3 },
  fan: { totalAirflow: 146.4, inputPower_W: 2.4 },
  electrical: {
    defrostHeater_W: 112,
    defrostOn_min: 0,
    pwbOn_W: 2,
    pwbOff_W: 1,
    timerPeriod_h: 10.5,
  },
  TC0: 48,                    // start near expected TC
  DH: 0.001,
  tolOuter: 0.001,
  maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
};

console.log('=== PV73K Dynamic TE Solver ===');
const res = runThermalAnalysisDynamic(config);

if (res.converged) {
  console.log('✅ Converged:');
  console.log(`TC = ${res.TC.toFixed(2)} °C   (Excel 48.00)`);
  console.log(`T2 = ${res.T2.toFixed(2)} °C   (Excel -19.50)`);
  console.log(`TE = ${res.TE.toFixed(2)} °C   (Excel -23.02)`);
  console.log(`PR = ${(res.PR * 100).toFixed(1)} %   (Excel 78.0%)`);
  console.log(`QF = ${res.heatLoads.QF.toFixed(2)} kcal/h   (Excel 45.44)`);
  console.log(`QR = ${res.heatLoads.QR.toFixed(2)} kcal/h   (Excel 14.39)`);
  console.log(`QEV = ${res.heatLoads.QEV.toFixed(2)} kcal/h   (Excel 9.86)`);
  console.log(`Comp cooling = ${res.compressor.coolingCapacity.toFixed(2)} kcal/h   (Excel 89.36)`);
  console.log(`Input power = ${res.compressor.inputPower.toFixed(2)} W   (Excel 104.27)`);
  if (res.warning) console.log('⚠️', res.warning);
} else {
  console.log('❌ Failed:', res.error);
}