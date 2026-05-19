// tests/debug_pv73k_diag.mjs – full diagnostic for PV73K model
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';
import { runThermalAnalysisDynamic } from '../src/js/engine/thermo/solver.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

// ---------------------------------------------------------------------------
// 1. PV73K geometry & compressor (from Excel DATA & SIZE)
// ---------------------------------------------------------------------------
const geom = {
  H: 1794, W: 795, D: 687,
  Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
  evapWidth_m: 0.441,
  evapDepth_m: 0.058,
  evapArea_m2: 1.298,
};

const compParams = {
  name: 'SQ47LAEG 220V 50Hz',
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

const fixedTemps = { T0: 25, TF: -18, TR: 3 };
const fan = { totalAirflow: 146.4, inputPower_W: 2.4 };
const electrical = { defrostHeater_W: 112, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 };

// ---------------------------------------------------------------------------
// 2. Check the model at the Excel converged point
// ---------------------------------------------------------------------------
console.log('=== PV73K Model Verification at Excel Converged Point ===');
const excelTC = 48.0;
const excelT2 = -19.5;
const excelPR = 0.77977;
const excelTE = -23.02;       // from Excel EV TEMPERATURE (Te)

// Compute condenser rises at this point (same as Excel H50/H51)
const areas = computeCondenserAreas(geom, condenserConfig);
// F,R Cab rise = IF(K38=0,0,J38/10*E39) – J38 is side condenser Q per unit area?
// In PV73K, side condenser area = 2.24 m², K_side = 5.395, back area = 0.86 m² * 0.7 efficiency
// Actually Excel uses:
// F,R Cab = IF(K38=0,0,J38/10*E39) where J38 is the side condenser heat rejection rate per unit area (kcal/h·m²)
// But we can compute them dynamically using our condenser model: sideRise = PR * (K_side/10) * (TC - T0)
// That matches Excel's F,R Cab = 2.84, Back Cab = 2.20 at TC=48, T0=25, PR=0.78
const sideRise = excelPR * (condenserConfig.K_side / 10) * (excelTC - fixedTemps.T0);
const backRise = excelPR * (condenserConfig.K_back / 10) * (excelTC - fixedTemps.T0);
console.log(`  Condenser rises: side=${sideRise.toFixed(2)} (Excel 2.84), back=${backRise.toFixed(2)} (Excel 2.20)`);

// Compute heat loads
const heat = calcHeatLoads(
  geom, { ...fixedTemps, T2: excelT2, TC: excelTC, PR: excelPR, TE: excelTE },
  electrical, { side: sideRise, back: backRise }, fan.totalAirflow, geom, fan.inputPower_W
);
console.log('\n  Heat Loads:');
console.log(`  QF = ${heat.QF.toFixed(2)} kcal/h  (Excel 45.44)`);
console.log(`  QR = ${heat.QR.toFixed(2)} kcal/h  (Excel 14.39)`);
console.log(`  QEV = ${heat.QEV.toFixed(2)} kcal/h  (Excel 9.86)`);
console.log(`  Qtotal = ${(heat.QF + heat.QR + heat.QEV).toFixed(2)} kcal/h  (Excel 69.68)`);

// Compressor at Excel point
const comp = compressorState(excelTC, excelTE, 'R-600a', compParams, 10);
console.log('\n  Compressor:');
console.log(`  ηv = ${comp.etaV.toFixed(3)}  (Excel 0.789)`);
console.log(`  Mass flow = ${comp.massFlow.toFixed(3)} kg/h  (Excel 1.618)`);
console.log(`  Cooling capacity = ${comp.coolingCapacity.toFixed(2)} kcal/h  (Excel 89.36)`);
console.log(`  Input power = ${comp.inputPower.toFixed(2)} W  (Excel 104.27)`);

// Check F1 and F2 at Excel point
const rho = 1.365, cp = 0.24;
const denom = fan.totalAirflow * rho * cp * excelPR;
const T3 = excelT2 + heat.QEV / denom;
const MR = heat.QR / (rho * cp * (fixedTemps.TR - T3) * excelPR);
const MF = fan.totalAirflow - MR;
const QF_prime = MF * rho * cp * (fixedTemps.TF - excelT2) * excelPR;
const F1 = heat.QF - QF_prime;
const F2 = (heat.QF + heat.QR + heat.QEV) - comp.coolingCapacity * excelPR;
console.log('\n  Solver functions at Excel point:');
console.log(`  F1 = ${F1.toFixed(4)}  (should be near 0)`);
console.log(`  F2 = ${F2.toFixed(4)}  (should be near 0)`);

// ---------------------------------------------------------------------------
// 3. Test the inner solver with fixed TE and Excel initial guesses
// ---------------------------------------------------------------------------
console.log('\n=== Inner Solver Test (fixed TE) ===');
// We'll manually call the inner solver logic (same as inside solveThermalSystem)
// Since solveInner is not exported, we can replicate it here or just call runThermalAnalysisDynamic with initial options.
// Easiest: create a configuration that starts near the Excel point.
const config = {
  geom, compParams, condenserConfig,
  refrigerant: 'R-600a', subcool: 10, dischargeTemp: 60,
  fixedTemps, fan, electrical,
  TC0: excelTC,       // start exactly at TC=48
  DH: 0.001, tolOuter: 0.001, maxIterOuter: 50,
  innerOptions: {
    dx: 0.001, tol: 1e-4, maxIter: 100,
    initialT2: excelT2,
    initialPR: excelPR,
    debug: true,          // enable iteration logging
  },
};

// Run with a fixed TE (excelTE) to see if the inner solver converges
import { solveThermalSystem } from '../src/js/engine/thermo/solver.js';
const resultFixedTE = solveThermalSystem(config, excelTE);

if (resultFixedTE.converged) {
  console.log('✅ Fixed‑TE solver converged:');
  console.log(`  TC = ${resultFixedTE.TC.toFixed(2)}`);
  console.log(`  T2 = ${resultFixedTE.T2.toFixed(2)}`);
  console.log(`  PR = ${(resultFixedTE.PR*100).toFixed(1)}%`);
} else {
  console.log(`❌ Fixed‑TE solver failed: ${resultFixedTE.error}`);
}

// ---------------------------------------------------------------------------
// 4. Run the full dynamic TE solver with better initial conditions
// ---------------------------------------------------------------------------
console.log('\n=== Dynamic TE Solver (with better initial guess) ===');
const dynConfig = {
  ...config,
  TC0: excelTC,   // start at Excel TC for stability
  innerOptions: {
    ...config.innerOptions,
    initialT2: excelT2,
    initialPR: excelPR,
  },
};

const dynResult = runThermalAnalysisDynamic(dynConfig);
if (dynResult.converged) {
  console.log('✅ Dynamic TE solver converged:');
  console.log(`  TC = ${dynResult.TC.toFixed(2)} °C`);
  console.log(`  T2 = ${dynResult.T2.toFixed(2)} °C`);
  console.log(`  TE = ${dynResult.TE.toFixed(2)} °C`);
  console.log(`  PR = ${(dynResult.PR*100).toFixed(1)} %`);
  console.log(`  QF = ${dynResult.heatLoads.QF.toFixed(2)} kcal/h`);
  console.log(`  QR = ${dynResult.heatLoads.QR.toFixed(2)} kcal/h`);
  console.log(`  QEV = ${dynResult.heatLoads.QEV.toFixed(2)} kcal/h`);
  console.log(`  Comp cooling = ${dynResult.compressor.coolingCapacity.toFixed(2)} kcal/h`);
  console.log(`  Input power = ${dynResult.compressor.inputPower.toFixed(2)} W`);
} else {
  console.log(`❌ Dynamic TE solver failed: ${dynResult.error}`);
}