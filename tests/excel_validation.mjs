/**
 * Validation script: Compare JS thermal solver against SJ-54H Excel baseline.
 * Run with: npm run validate:excel
 */

import { runThermoAnalysis } from '../src/js/engine/thermo/index.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

// -------------------------------------------------------------------------
// 1. Geometry object – matches SJ-54H Excel
// -------------------------------------------------------------------------
const geom = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
    evap: {
    width_mm: 460,
    depth_mm: 60,
    rows: 7,
    tubeOD_mm: 8,
    finPitch_mm: 30,
    finHeight_mm: 60,
    finLength_mm: 28,
    numFins: 504,
  },

};

// -------------------------------------------------------------------------
// 2. Expected converged outputs (from MAIN sheet after macro run)
// -------------------------------------------------------------------------
const expected = {
  TC:              40.9055,   // MAIN: TC
  T2:             -21.2483,   // MAIN: X1 = EV OUT Temp T2
  PR:               0.5905646, // MAIN: X2 = RUNNING RATIO PR
  QF:              27.358,    // MAIN: QF TOTAL(kcal/h)
  QR:              39.405,    // MAIN: QR TOTAL(kcal/h)
  QEV:              5.433,    // MAIN: QEV TOTAL(kcal/h)
  coolingCapacity: 122.250,   // MAIN: Qcomp(Ability of Compressor) ← NOT the nameplate 181.6
  inputPower:      98.411,    // MAIN: COMP INPUT (W)
};

const TOL_TC = 0.05;
const TOL_T2 = 0.05;
const TOL_PR = 0.001;
const TOL_Q = 2.0;
const TOL_POWER = 2.0;
const TOL_CAP = 2.0;

// -------------------------------------------------------------------------
// 3. Build configuration manually (mapping property names correctly)
// -------------------------------------------------------------------------
function buildSJ54HConfig() {
  const compParams = { ...SJ54H_COMPONENTS.compressor };
  
  // Fix: map K_side_kcalhm2C -> K_side, etc.
  const condenserConfig = {
    K_side: SJ54H_COMPONENTS.condenser.K_side_kcalhm2C,
    K_back: SJ54H_COMPONENTS.condenser.K_back_kcalhm2C,
    backCondenserEfficiency: SJ54H_COMPONENTS.condenser.backCondenserEfficiency,
    k_RFront1: SJ54H_COMPONENTS.condenser.k_RFront1,
    k_RFront2: SJ54H_COMPONENTS.condenser.k_RFront2,
    k_FRPartition1: SJ54H_COMPONENTS.condenser.k_FRPartition1,
    k_FRPartition2: SJ54H_COMPONENTS.condenser.k_FRPartition2,
    k_FFront1: SJ54H_COMPONENTS.condenser.k_FFront1,
    k_FFront2: SJ54H_COMPONENTS.condenser.k_FFront2,
  };
  
  const electrical = { ...SJ54H_COMPONENTS.electrical };
  
  return {
    geom,
    compParams,
    condenserConfig,
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps: {
      T0: 30,
      TF: -18,
      TR: 3,
      TE: -23.3,
    },
fan: {
      totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h,
      inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W,   // add this
    },
    electrical,
    solverOptions: {
      TC0: 43.0, // Adjusted initial guess to help convergence
      DH: 0.001,
      tolOuter: 0.0005,
      maxIterOuter: 100,
      innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
    },
  };
}

// -------------------------------------------------------------------------
// 4. Run validation
// -------------------------------------------------------------------------
async function validate() {
  console.log('🔍 Validating thermal solver against SJ-54H Excel baseline...\n');
  
  const config = buildSJ54HConfig();
  const result = runThermoAnalysis(config);
  
  if (!result.success) {
    console.error('❌ Thermal analysis failed:', result.errors);
    process.exit(1);
  }
  
  const r = result.results;
  
  let allOk = true;
  
  function compare(name, actual, expected, tol) {
    const diff = Math.abs(actual - expected);
    const ok = diff <= tol;
    if (!ok) allOk = false;
    console.log(`${ok ? '✅' : '❌'} ${name}: actual=${actual.toFixed(4)} expected=${expected.toFixed(4)} diff=${diff.toFixed(6)}`);
    return ok;
  }
  
  console.log('--- Primary solver outputs ---');
  compare('TC (°C)', r.TC, expected.TC, TOL_TC);
  compare('T2 (°C)', r.T2, expected.T2, TOL_T2);
  compare('PR', r.PR, expected.PR, TOL_PR);
  
  console.log('\n--- Heat loads (kcal/h) ---');
  compare('QF', r.heatLoads.QF, expected.QF, TOL_Q);
  compare('QR', r.heatLoads.QR, expected.QR, TOL_Q);
  compare('QEV', r.heatLoads.QEV, expected.QEV, TOL_Q);
  
  console.log('\n--- Compressor ---');
  compare('Cooling capacity (kcal/h)', r.compressor.coolingCapacity, expected.coolingCapacity, TOL_CAP);
  compare('Input power (W)', r.compressor.inputPower, expected.inputPower, TOL_POWER);
  
  console.log(`\nIterations: outer=${r.iterations.outer}, inner total=${r.iterations.innerTotal}`);
  
  if (allOk) {
    console.log('\n🎉 All values match within tolerances. Solver validated against SJ-54H.');
    process.exit(0);
  } else {
    console.error('\n⚠️ Some discrepancies found. See differences above.');
    process.exit(1);
  }
}

validate().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});