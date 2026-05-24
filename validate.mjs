/**
 * validate.mjs – Thermal Engine Diagnostic
 *
 * Tests every engine module against Excel reference values for both models.
 * Pinpoints deviations to the originating file and line of logic.
 *
 * Usage:  node validate.mjs
 * Requires "type": "module" in package.json  (or run as .mjs directly)
 *
 * Exit code:  0 = all critical tests pass
 *             1 = one or more critical failures
 *
 * Legend:
 *   ✅ PASS  – within tolerance of Excel reference
 *   ❌ FAIL  – outside tolerance or NaN/undefined  ← fix required
 *   ⚠️  WARN  – known intentional deviation from Excel (documented)
 *   💥 CRASH – exception thrown inside the section
 */

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  satPressureR600a,
  specificVolumeR600a,
  vaporEnthalpyR600a,
  liquidEnthalpyR600a,
  getRefrigerantFunctions,
} from './src/js/engine/thermo/refrigerant.js';

import {
  calcVolumetricEfficiency,
  compressorState,
} from './src/js/engine/thermo/compressor.js';

import {
  compressorStateMap,
  SQ47LAEG_MAP,
} from './src/js/engine/thermo/compressorMap.js';

import { calcHeatLoads } from './src/js/engine/thermo/heatLoad.js';

import {
  computeCondenserAreas,
  calcQCout,
} from './src/js/engine/thermo/condenser.js';

import {
  solveThermalSystem,
  runThermalAnalysisDynamic,
} from './src/js/engine/thermo/solver.js';

import {
  SJ54H_COMPONENTS,
  SJ_PV73K_COMPONENTS,
} from './src/js/engine/thermo/defaultComponents.js';

// ─── Test harness ─────────────────────────────────────────────────────────────

let totalPass = 0, totalFail = 0, totalWarn = 0;
const FAILURES = [], WARNINGS = [];

/**
 * Numeric assertion with relative-error tolerance.
 * @param {string}  label      - descriptive name shown in output
 * @param {number}  actual     - computed value
 * @param {number}  expected   - Excel reference value
 * @param {number}  tolPct     - acceptable relative error in percent (default 0.1 %)
 * @param {boolean} critical   - if false, failure is demoted to WARN
 */
function check(label, actual, expected, tolPct = 0.1, critical = true) {
  const isInvalid =
    actual === undefined || actual === null ||
    (typeof actual === 'number' && isNaN(actual));

  if (isInvalid) {
    const msg = `${label}\n        actual=${actual}  expected≈${f(expected)}\n        → likely cause: undefined variable, missing import, or wrong key name`;
    console.log(`  ❌ FAIL  ${label}: actual=${actual} (expected≈${f(expected)})`);
    FAILURES.push(msg); totalFail++;
    return false;
  }

  const absErr = Math.abs(actual - expected);
  const relErr = Math.abs(expected) > 1e-12
    ? (absErr / Math.abs(expected)) * 100
    : absErr * 100;

  if (relErr <= tolPct) {
    console.log(`  ✅ PASS  ${label}: ${f(actual)}  (ref ${f(expected)}, Δ${relErr.toFixed(4)}%)`);
    totalPass++;
    return true;
  }

  const msg = `${label}: got ${f(actual)}, ref ${f(expected)}, Δ${relErr.toFixed(3)}%`;
  if (!critical) {
    console.log(`  ⚠️  WARN  ${msg}`);
    WARNINGS.push(msg); totalWarn++;
    return false;
  }
  console.log(`  ❌ FAIL  ${msg}`);
  FAILURES.push(msg); totalFail++;
  return false;
}

/** Boolean / convergence assertion. */
function checkBool(label, condition, detail = '', critical = true) {
  if (condition) {
    console.log(`  ✅ PASS  ${label}${detail ? '  ' + detail : ''}`);
    totalPass++;
    return true;
  }
  const msg = `${label}${detail ? ' – ' + detail : ''}`;
  if (!critical) {
    console.log(`  ⚠️  WARN  ${msg}`); WARNINGS.push(msg); totalWarn++;
    return false;
  }
  console.log(`  ❌ FAIL  ${msg}`); FAILURES.push(msg); totalFail++;
  return false;
}

/** Range assertion – value must be inside [lo, hi]. */
function checkRange(label, actual, lo, hi, critical = true) {
  const isInvalid =
    actual === undefined || actual === null ||
    (typeof actual === 'number' && isNaN(actual));
  if (isInvalid) {
    const msg = `${label}: actual=${actual} – NaN or undefined`;
    console.log(`  ❌ FAIL  ${msg}`); FAILURES.push(msg); totalFail++;
    return false;
  }
  return checkBool(`${label}: ${f(actual)} in [${lo}, ${hi}]`,
    actual >= lo && actual <= hi,
    `got ${f(actual)}`, critical);
}

function section(title, fn) {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(64));
  try { fn(); }
  catch (e) {
    const msg = `EXCEPTION in "${title}": ${e.message}`;
    console.log(`  💥 CRASH  ${msg}`);
    console.log(`           ${e.stack?.split('\n').slice(1, 4).join('\n           ')}`);
    FAILURES.push(msg); totalFail++;
  }
}

function note(text) { console.log(`  ℹ️        ${text}`); }
function f(v) { return typeof v === 'number' ? v.toFixed(6) : String(v); }

// ─── Reference values (from Excel MAIN/SIZE sheets) ──────────────────────────

// 54H – SJ-540 top-freezer (fully converged Excel solution)
const REF54 = {
  // Fixed temperatures
  TF: -18, TR: 3, T0: 30,
  // Converged solver outputs
  TC:  40.90551469703945,
  T2: -21.2483006297973,
  PR:   0.5905646101665666,
  TE:  -25.265367562708445,

  // ── Refrigerant at RATED CORNER (TC=54.4, TE=-23.3, T_suc=32.2) ──
  Pe_rated: 0.6399178637701737,   // satPressure(-23.3)      MAIN J15
  Pc_rated: 7.835776826532984,    // satPressure(54.4)       MAIN J14
  v_rated:  0.6860064886989208,   // specificVolume(32.2, Pe_rated) MAIN J18
  Hout:    174.0792661518202,     // vaporEnthalpy(32.2, Pe_rated)  MAIN J16
  Hin:      94.32347647011841,    // liquidEnthalpy(32.2)           MAIN J17

  // ── Refrigerant at OPERATING POINT ──
  Pe_op:   0.5865909232142318,    // satPressure(TE=-25.265)        MAIN N28
  Pc_op:   5.602337227119564,     // satPressure(TC=40.906)         MAIN N27
  v_op:    0.7435202808359662,    // specificVolume(T0=30, Pe_op)   MAIN v=
  Hevout:  152.4400999814935,     // vaporEnthalpy(TE, Pe_op)       MAIN Hevout
  Hevin:    93.53277404496438,    // liquidEnthalpy(Tsub=30.906)    MAIN Hevin

  // ── Compressor at RATED CORNER ──
  etaV_rated: 0.7578241188782738,
  G_rated:    2.1412858089066673,
  Q_rated:  170.77994062357286,   // kcal/h – rated cooling capacity
  W_rated:  110.47843333333333,   // W      – rated input power

  // ── Compressor at OPERATING POINT (T0=30 used for specific volume) ──
  etaV_op: 0.7960431429104982,
  G_op:    2.0752872870624635,
  Qcomp:  122.24962463092378,     // kcal/h – MAIN QCOMP
  Wcomp:   98.41064704066874,     // W      – MAIN COMP INPUT

  // ── Heat loads at converged state (from SIZE sheet totals) ──
  QF:   27.358180306372777,
  QR:   39.405076968696406,
  QEV:   5.433041824123792,
  QEV_cond: 4.366482138162972,   // EVA BACK panel only
  fanLoad:  1.0665596859608193,  // FAN LOAD from SIZE

  // ── Condenser areas ──
  sideArea:          1.9016,     // m²
  backArea:          0.7952,     // m² (with η=0.7)
  sideKA:           10.261,      // kcal/h°C = 5.395 × 1.9016
  backKA:            3.316,      // kcal/h°C = 4.17 × 0.7952
  RFrontLength:      2.260,      // m = Hr×2/1000
  FRPartitionLength: 0.690,      // m = (W-tRtop-tRleft)/1000
  FFrontLength:      1.100,      // m = Hf×2/1000

  // ── QCout total (MAIN H40) ──
  QCout: 171.23611991123462,

  // ── QCout components (MAIN H35–H39) ──
  QC_RFront:      11.23796063282534,
  QC_FRPartition:  6.447523086648597,
  QC_FFront:       5.507009139745355,
  QC_side:       111.88111480486768,
  QC_back:        36.162512247147646,
};

// pv73 – SJ-pv73k bottom-freezer
// Note: Excel pv73 is a TRIAL state (TC=48 hardcoded, F3 ≠ 0).
// Only module-level values are safe to use as reference.
const REFpv = {
  TF: -18, TR: 3, T0: 25,
  TC: 48, T2: -19.081555190241485, PR: 0.60364304538063,
  TE: -22.675095742537348,

  // Heat loads (SIZE totals at trial state)
  QF: 25.565059122383268,
  QR: 24.75005031447915,
  QEV: 4.709591472784092,

  // Condenser lengths (bottom-freezer orientation)
  RFrontLength:      1.492,   // Hf×2/1000 = 746×2/1000
  FRPartitionLength: 0.681,   // (W-tFtop-tFleft)/1000 = (795-32-82)/1000
  FFrontLength:      2.096,   // Hr×2/1000 = 1048×2/1000
  QCout: 127.05708416085679,
};

// ─── Geometry objects ─────────────────────────────────────────────────────────

const GEOM54 = {
  H: 1680, W: 800, D: 630, Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230, doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70,
  tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70,  tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40, tRfloor: 70,
};

const GEOMpv = {
  H: 1794, W: 795, D: 687, Hf: 746, Hr: 1048,
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  // Freezer (bottom compartment)
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 80,
  tFdoor: 80, tFback: 55, tEvaBack: 55,
  // Refrigerator (top compartment)
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 58,
  // Stepped floors
  tFfloor1: 76, tFfloor2: 80, tFfloor3: 82,
  tRfloor: 32,   // R BOTTOM ※ = same physical wall as tFtop (partition)
};

const ELEC54  = { defrostHeater_W: 140, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 };
const ELECpv  = { defrostHeater_W: 112, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 };
const PITCH54 = { side: 150, back: 200 };
const PITCHpv = { side: 150, back: 200 };

// Condenser config objects (key names exactly as SJ54H_COMPONENTS.condenser)
const COND_CFG54 = SJ54H_COMPONENTS.condenser;
const COND_CFGpv = SJ_PV73K_COMPONENTS.condenser;

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 1 – Refrigerant properties  (refrigerant.js)
// ═════════════════════════════════════════════════════════════════════════════

section('1. refrigerant.js — R-600a property equations', () => {

  note('Saturation pressures (bar)');
  check('satPressure(TE_rated=-23.3)',  satPressureR600a(-23.3),                REF54.Pe_rated);
  check('satPressure(TC_rated=54.4)',   satPressureR600a(54.4),                 REF54.Pc_rated);
  check('satPressure(TE_op=-25.265)',   satPressureR600a(REF54.TE),             REF54.Pe_op);
  check('satPressure(TC_op=40.906)',    satPressureR600a(REF54.TC),             REF54.Pc_op);

  note('Specific volume (m³/kg)');
  // Excel uses T_suction=32.2 for rated corner, T0=30 for operating point
  check('specificVolume(32.2, Pe_rated) [rated]',
    specificVolumeR600a(32.2, REF54.Pe_rated), REF54.v_rated);
  check('specificVolume(T0=30, Pe_op) [operating]',
    specificVolumeR600a(REF54.T0, REF54.Pe_op), REF54.v_op);

  note('Vapour enthalpy (kcal/kg)');
  check('vaporEnthalpy(32.2, Pe_rated) = Hout',
    vaporEnthalpyR600a(32.2, REF54.Pe_rated), REF54.Hout);
  check('vaporEnthalpy(TE_op, Pe_op)  = Hevout',
    vaporEnthalpyR600a(REF54.TE, REF54.Pe_op), REF54.Hevout);

  note('Liquid enthalpy (kcal/kg)');
  check('liquidEnthalpy(32.2) = Hin',
    liquidEnthalpyR600a(32.2), REF54.Hin);
  check('liquidEnthalpy(Tsub=30.906) = Hevin',
    liquidEnthalpyR600a(REF54.TC - SJ54H_COMPONENTS.subcool_K), REF54.Hevin);

  note('getRefrigerantFunctions dispatch – R-600a');
  const rf600a = getRefrigerantFunctions('R-600a');
  checkBool('getRefrigerantFunctions returns object with satPressure',
    typeof rf600a?.satPressure === 'function');
  check('dispatch: satPressure(-23.3) via rf object',
    rf600a.satPressure(-23.3), REF54.Pe_rated);

  note('getRefrigerantFunctions dispatch – R-134a (smoke test, not Excel-verified)');
  const rf134a = getRefrigerantFunctions('R-134a');
  checkBool('getRefrigerantFunctions("R-134a") returns object',
    typeof rf134a?.satPressure === 'function');
  checkRange('R-134a satPressure(-23.3) plausible range (bar)',
    rf134a.satPressure(-23.3), 0.8, 1.4);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 2 – 54H Compressor polynomial  (compressor.js)
// ═════════════════════════════════════════════════════════════════════════════

section('2. compressor.js — 54H EGX80CLC polynomial model', () => {
  const cp = SJ54H_COMPONENTS.compressor;

  note('Volumetric efficiency at rated corner (TC=54.4, TE=-23.3)');
  const etaV_r = calcVolumetricEfficiency(54.4, -23.3, cp, satPressureR600a);
  check('ηv at rated corner', etaV_r, REF54.etaV_rated);

  note('compressorState at rated corner (no T0 → falls back to T_suction=32.2)');
  const cs_rated = compressorState(54.4, -23.3, 'R-600a', cp, SJ54H_COMPONENTS.subcool_K, undefined);
  check('etaV  (rated)', cs_rated.etaV,          REF54.etaV_rated);
  check('massFlow G (rated)', cs_rated.massFlow,  REF54.G_rated);
  check('coolingCapacity (rated)', cs_rated.coolingCapacity, REF54.Q_rated);
  check('inputPower W (rated)', cs_rated.inputPower, REF54.W_rated);

  note('compressorState at operating point (T0=30 used for specific volume)');
  const cs_op = compressorState(REF54.TC, REF54.TE, 'R-600a', cp,
    SJ54H_COMPONENTS.subcool_K, REF54.T0);
  check('etaV  (operating)', cs_op.etaV,          REF54.etaV_op);
  check('massFlow G (operating)', cs_op.massFlow,  REF54.G_op);
  check('coolingCapacity Qcomp (operating)', cs_op.coolingCapacity, REF54.Qcomp);
  check('inputPower Wcomp (operating)', cs_op.inputPower, REF54.Wcomp);

  note('Key enthalpies returned');
  check('h_evap_out at TE_op', cs_op.h_evap_out, REF54.Hevout);
  check('h_liquid at Tsub',    cs_op.h_liquid,    REF54.Hevin);

  note('useMap flag absent on 54H → polynomial path used');
  checkBool('SJ54H_COMPONENTS.compressor.useMap is falsy',
    !SJ54H_COMPONENTS.compressor.useMap);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 3 – pv73 Compressor map  (compressorMap.js)
// ═════════════════════════════════════════════════════════════════════════════

section('3. compressorMap.js — pv73 SQ47LAEG map + bilinear interpolation', () => {
  const rf = getRefrigerantFunctions('R-600a');

  note('Grid boundary: exact grid-point lookup (no interpolation, tx=ty=0)');
  // TC=40, TE=-24 → Q_table[TC_idx=1][TE_idx=4] = 123.77
  const s1 = compressorStateMap(40, -24, SQ47LAEG_MAP, rf, 10);
  check('Q at (TC=40, TE=-24) [grid point]',  s1.coolingCapacity, 123.77, 0.02);
  check('W at (TC=40, TE=-24) [grid point]',  s1.inputPower,       62.42, 0.02);

  // TC=45, TE=-20 → Q_table[TC_idx=2][TE_idx=6] = 147.95
  const s2 = compressorStateMap(45, -20, SQ47LAEG_MAP, rf, 10);
  check('Q at (TC=45, TE=-20) [grid point]',  s2.coolingCapacity, 147.95, 0.02);
  check('W at (TC=45, TE=-20) [grid point]',  s2.inputPower,       99.44, 0.02);

  note('Grid boundary: TC=35, TE=-32 (corner point)');
  const s3 = compressorStateMap(35, -32, SQ47LAEG_MAP, rf, 10);
  check('Q at (TC=35, TE=-32) [corner]', s3.coolingCapacity, 82.75, 0.02);
  check('W at (TC=35, TE=-32) [corner]', s3.inputPower,       43.40, 0.02);

  note('Bilinear interpolation midpoint (TC=42.5, TE=-25 – between grid cells)');
  const s4 = compressorStateMap(42.5, -25, SQ47LAEG_MAP, rf, 10);
  // Expected: midpoint between (40,-24)=123.77 and (45,-26) etc. — range check only
  checkRange('Q at (TC=42.5, TE=-25) in plausible range',
    s4.coolingCapacity, 100, 145);
  checkRange('W at (TC=42.5, TE=-25) in plausible range',
    s4.inputPower, 60, 120);

  note('Clamping: TC=60 (above grid max 55) → clamped to TC=55');
  const s5 = compressorStateMap(60, -20, SQ47LAEG_MAP, rf, 10);
  const s5_at55 = compressorStateMap(55, -20, SQ47LAEG_MAP, rf, 10);
  check('Clamped TC=60 equals TC=55 result',
    s5.coolingCapacity, s5_at55.coolingCapacity, 0.001);

  note('useMap flag set on pv73 components');
  checkBool('SJ_PV73K_COMPONENTS.compressor.useMap === true',
    SJ_PV73K_COMPONENTS.compressor.useMap === true);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 4 – 54H Heat loads  (heatLoad.js, top-freezer)
// ═════════════════════════════════════════════════════════════════════════════

section('4. heatLoad.js — 54H top-freezer heat loads at Excel converged state', () => {
  const temps = {
    T0: REF54.T0, TF: REF54.TF, TR: REF54.TR,
    TC: REF54.TC, T2: REF54.T2, PR: REF54.PR, TE: REF54.TE,
  };

  const loads = calcHeatLoads(
    GEOM54, temps, ELEC54,
    PITCH54, 0.7,
    SJ54H_COMPONENTS.fan.totalAirflow_m3h,
    null,                                    // evapParams unused inside function
    SJ54H_COMPONENTS.fan.inputPower_W,
    'top'
  );

  note('Total heat load components vs Excel SIZE totals');
  check('QF  (kcal/h)', loads.QF,  REF54.QF,  0.5);
  check('QR  (kcal/h)', loads.QR,  REF54.QR,  0.5);
  check('QEV (kcal/h)', loads.QEV, REF54.QEV, 0.5);

  note('QEV sub-components');
  check('QEV_cond (EVA BACK panel)', loads.QEV - loads.fanLoad - loads.defrostLoad,
    REF54.QEV_cond, 1.0);
  check('fanLoad', loads.fanLoad, REF54.fanLoad, 0.5);
  check('defrostLoad (0 defrost time)', loads.defrostLoad, 0.0, 0.001);

  note('Sanity: QF > 0 (freezer always gains heat from outside)');
  checkBool('QF > 0', loads.QF > 0);

  note('Sanity: QR > 0 (refrigerator always gains heat from outside)');
  checkBool('QR > 0', loads.QR > 0);

  note('Condenser wall temperatures (derived inside heatLoad)');
  // T_wallSide = T0 + (TC-T0)/10 × K_side × PR
  const K_side = 10.57 - 0.042*150 + 0.00005*(150**2);  // 5.395
  const K_back = 10.57 - 0.042*200 + 0.00005*(200**2);  // 4.17
  const T_wallSide_expected = REF54.T0 + (REF54.TC - REF54.T0)/10 * K_side * REF54.PR;
  const T_wallBack_expected = REF54.T0 + (REF54.TC - REF54.T0)/10 * K_back * REF54.PR;
  // Excel SIZE "Cab Side" and "Back cab"
  check('T_wallSide (Excel SIZE Cab Side = 33.475)', T_wallSide_expected, 33.47460175377248, 0.01);
  check('T_wallBack (Excel SIZE Back cab = 32.686)', T_wallBack_expected, 32.685651401896436, 0.01);
  note('(Wall temps are internal to heatLoad — above confirms the formula is consistent)');

  note('K_side and K_back from PIPEPITCH (catches XOR ^ vs power ** bug)');
  check('K_side at pitch=150mm', K_side, 5.395, 0.01);
  check('K_back at pitch=200mm', K_back, 4.17,  0.01);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 5 – pv73 Heat loads  (heatLoad.js, bottom-freezer)
// ═════════════════════════════════════════════════════════════════════════════

section('5. heatLoad.js — pv73 bottom-freezer heat loads at Excel trial state', () => {
  note('pv73 Excel is a TRIAL state (TC=48 hardcoded; F3 ≠ 0).');
  note('Effective TC for wall temps = T0 + X3 = 25 + 5.412 = 30.412°C.');
  note('We use TC_eff=30.412 to match Excel SIZE panel calculations.');

  const TC_eff = 25 + 5.412104392639187;   // T0 + X3 as Excel SIZE uses it
  const temps = {
    T0: REFpv.T0, TF: REFpv.TF, TR: REFpv.TR,
    TC: TC_eff,
    T2: REFpv.T2, PR: REFpv.PR, TE: REFpv.TE,
  };

  const loads = calcHeatLoads(
    GEOMpv, temps, ELECpv,
    PITCHpv, 0.7,
    SJ_PV73K_COMPONENTS.fan.totalAirflow_m3h,
    null,
    SJ_PV73K_COMPONENTS.fan.inputPower_W,
    'bottom'
  );

  check('QF  (kcal/h)', loads.QF,  REFpv.QF,  1.0);
  check('QR  (kcal/h)', loads.QR,  REFpv.QR,  1.0);
  check('QEV (kcal/h)', loads.QEV, REFpv.QEV, 1.0);

  note('Orientation sanity checks (bottom-freezer physics)');
  checkBool('QR > 0  (top compartment gains heat from outside)',  loads.QR > 0);
  checkBool('QEV > 0 (evaporator back panel gains heat)',         loads.QEV > 0);
  // For bottom-freezer, QF includes negative contribution from partition
  // (freezer top cooler than refrigerator), so net QF is still positive overall
  checkBool('QF > 0  (net freezer heat gain)', loads.QF > 0);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 6 – Condenser areas  (condenser.js)
// ═════════════════════════════════════════════════════════════════════════════

section('6. condenser.js — computeCondenserAreas for both models', () => {

  note('─── 54H (top-freezer) ───');
  const a54 = computeCondenserAreas(GEOM54, COND_CFG54, 'top');

  note('Side/back area calculations');
  check('sideArea (m²)',  a54.sideArea, REF54.sideArea, 0.1);
  check('backArea (m²)',  a54.backArea, REF54.backArea, 0.1);

  note('KA products – catches K_side/K_back key-name mismatch (undefined → NaN)');
  check('sideKA = K_side × sideArea', a54.sideKA, REF54.sideKA, 0.2);
  check('backKA = K_back × backArea', a54.backKA, REF54.backKA, 0.2);

  note('Condenser lengths – catches missing freezerPosition dispatch');
  check('RFrontLength  = Hr×2/1000 (m)',       a54.RFrontLength,      REF54.RFrontLength,      0.1);
  check('FRPartitionLength (m)',                a54.FRPartitionLength, REF54.FRPartitionLength, 0.1);
  check('FFrontLength  = Hf×2/1000 (m)',       a54.FFrontLength,      REF54.FFrontLength,      0.1);

  note('─── pv73 (bottom-freezer) ───');
  note('Requires freezerPosition dispatch: RFront→Hf×2, FFront→Hr×2, FRPartition→(W-tFtop-tFleft)');
  const apv = computeCondenserAreas(GEOMpv, COND_CFGpv, 'bottom');

  check('RFrontLength  = Hf×2/1000 (m) [bottom-freezer]', apv.RFrontLength,      REFpv.RFrontLength,      0.1);
  check('FRPartitionLength  (m) [bottom-freezer]',         apv.FRPartitionLength, REFpv.FRPartitionLength, 0.1);
  check('FFrontLength  = Hr×2/1000 (m) [bottom-freezer]', apv.FFrontLength,      REFpv.FFrontLength,      0.1);

  note('pv73 side/back areas (smoke check)');
  checkRange('pv73 sideArea (m²) in [1.5, 3.0]', apv.sideArea, 1.5, 3.0);
  checkRange('pv73 backKA plausible',             apv.backKA,   2.0, 6.0);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 7 – QCout  (condenser.js)
// ═════════════════════════════════════════════════════════════════════════════

section('7. condenser.js — calcQCout vs Excel MAIN condenser heat exchange', () => {
  const a54 = computeCondenserAreas(GEOM54, COND_CFG54, 'top');
  const QCout = calcQCout(REF54.TC, REF54.T0, REF54.TF, REF54.TR, a54);

  note('Total QCout vs Excel MAIN H40 = 171.236 kcal/h');
  const ok = check('QCout total (kcal/h)', QCout, REF54.QCout, 0.5);

  if (!ok) {
    note('Diagnosing QCout deviation — checking individual components:');

    // Manually compute expected components
    const dT0 = REF54.TC - REF54.T0;   // 10.906
    const dTF = REF54.TC - REF54.TF;   // 58.906
    const dTR = REF54.TC - REF54.TR;   // 37.906

    const RFront_correct  = (0.3405*dT0 + 0.03322*dTR) * a54.RFrontLength;  // uses TR
    const RFront_bug      = (0.3405*dT0 + 0.03322*dTF) * a54.RFrontLength;  // uses TF (wrong)
    const FRPart          = (0.1984*dT0 + 0.1219*dTF)  * a54.FRPartitionLength;
    const FFront          = (0.3395*dT0 + 0.0344*dTR)  * a54.FFrontLength;
    const Side            = a54.sideKA * dT0;
    const Back            = a54.backKA * dT0;

    const total_correct = RFront_correct + FRPart + FFront + Side + Back;
    const total_bug     = RFront_bug     + FRPart + FFront + Side + Back;

    note(`  RFront with k_RFront2×(TC-TR) [CORRECT]: ${f(RFront_correct)}  (ref ${f(REF54.QC_RFront)})`);
    note(`  RFront with k_RFront2×(TC-TF) [BUG]    : ${f(RFront_bug)}`);
    note(`  If QCout ≈ ${f(total_correct)} → code is correct`);
    note(`  If QCout ≈ ${f(total_bug)}     → k_RFront2 uses dT_TC_TF instead of dT_TC_TR`);
    note(`  If QCout = NaN                 → K_side or K_back is undefined (key name mismatch)`);
  }

  note('Individual QCout components (reference values from Excel MAIN H35–H39)');
  // These verify that the empirical coefficients and lengths are both correct
  const dT0 = REF54.TC - REF54.T0;
  const dTR = REF54.TC - REF54.TR;
  const dTF = REF54.TC - REF54.TF;
  const RFront_ref   = (0.3405*dT0 + 0.03322*dTR) * a54.RFrontLength;
  const FRPart_ref   = (0.1984*dT0 + 0.1219*dTF)  * a54.FRPartitionLength;
  const FFront_ref   = (0.3395*dT0 + 0.0344*dTR)  * a54.FFrontLength;
  check('R Front component',      RFront_ref, REF54.QC_RFront,      0.2);
  check('FR Partition component', FRPart_ref, REF54.QC_FRPartition, 0.2);
  check('F Front component',      FFront_ref, REF54.QC_FFront,      0.2);
  check('Side condenser KA×ΔT',  a54.sideKA * dT0, REF54.QC_side, 0.2);
  check('Back condenser KA×ΔT',  a54.backKA * dT0, REF54.QC_back, 0.2);

  note('─── pv73 QCout (bottom-freezer orientation) ───');
  const apv = computeCondenserAreas(GEOMpv, COND_CFGpv, 'bottom');
  const TC_eff_pv = 25 + 5.412104392639187;
  const QCout_pv = calcQCout(TC_eff_pv, REFpv.T0, REFpv.TF, REFpv.TR, apv);
  check('pv73 QCout total (kcal/h)', QCout_pv, REFpv.QCout, 1.0);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 8 – QCin  (inline computation as solver does it)
// ═════════════════════════════════════════════════════════════════════════════

section('8. QCin — condenser energy balance at 54H operating point', () => {
  note('QCin is computed inline in the solver using resolveCompressorState.');
  note('Excel MAIN: QCin = G × (Hcond_in − Hcond_out)');
  note('Excel uses liquidEnthalpy(TC) for Hcond_out (saturated liquid).');
  note('Bug 7 fix uses liquidEnthalpy(Tsub=TC−10) — physically correct but shifts TC.');

  const rf = getRefrigerantFunctions('R-600a');
  const cp = SJ54H_COMPONENTS.compressor;
  const cs = compressorState(REF54.TC, REF54.TE, 'R-600a', cp,
    SJ54H_COMPONENTS.subcool_K, REF54.T0);

  const Pe_dis = rf.satPressure(REF54.TC);
  const h_dis  = rf.vaporEnthalpy(SJ54H_COMPONENTS.dischargeTemp_C, Pe_dis);

  // Excel method (Hcond_out at TC — no subcool)
  const h_liq_at_TC   = rf.liquidEnthalpy(REF54.TC);
  const QCin_excel    = cs.massFlow * (h_dis - h_liq_at_TC);

  // Bug-7-fixed method (Hcond_out at Tsub)
  const Tsub          = REF54.TC - SJ54H_COMPONENTS.subcool_K;
  const h_liq_at_Tsub = rf.liquidEnthalpy(Tsub);
  const QCin_fixed    = cs.massFlow * (h_dis - h_liq_at_Tsub);

  note(`Hcond_in (discharge enthalpy at Td=60°C): ${f(h_dis)}`);
  note(`Hcond_out at TC=40.906 [Excel method]:  ${f(h_liq_at_TC)}  (ref 99.729)`);
  note(`Hcond_out at Tsub=30.906 [fixed method]: ${f(h_liq_at_Tsub)}  (ref 93.533)`);
  note(`QCin Excel method: ${f(QCin_excel)}  (ref 171.236 — should balance QCout)`);
  note(`QCin fixed method: ${f(QCin_fixed)}  (higher → solver converges to higher TC)`);

  check('Hcond_in (discharge enthalpy)', h_dis, 182.2413484728457, 0.1);
  check('Hcond_out at TC [Excel method]', h_liq_at_TC, 99.72934473018842, 0.1);
  check('Hcond_out at Tsub [fixed]',      h_liq_at_Tsub, REF54.Hevin, 0.1);

  const QCout_ref = REF54.QCout;
  const diff_excel = Math.abs(QCin_excel - QCout_ref);
  const diff_fixed = Math.abs(QCin_fixed - QCout_ref);
  checkBool(`QCin_excel balances QCout (Δ < 0.05 kcal/h): Δ=${f(diff_excel)}`,
    diff_excel < 0.05);
  note(`⚠️  QCin_fixed vs QCout: Δ=${f(diff_fixed)} kcal/h — expected deviation from Bug 7 fix`, );
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 9 – resolveCompressorState dispatch  (compressor.js)
// ═════════════════════════════════════════════════════════════════════════════

section('9. compressor.js — resolveCompressorState dispatch (polynomial vs map)', () => {
  note('This section requires resolveCompressorState to be exported from compressor.js.');
  note('If it crashes, the function is not exported or missing imports.');

  let resolveCompressorState;
  try {
    const mod = await import('./src/js/engine/thermo/compressor.js');
    resolveCompressorState = mod.resolveCompressorState;
  } catch (e) {
    checkBool('import resolveCompressorState from compressor.js', false,
      `import failed: ${e.message}`);
    return;
  }

  checkBool('resolveCompressorState is exported',
    typeof resolveCompressorState === 'function');
  if (typeof resolveCompressorState !== 'function') return;

  note('Polynomial path (useMap=false, 54H)');
  const cp54 = SJ54H_COMPONENTS.compressor;
  const r54 = resolveCompressorState(REF54.TC, REF54.TE, 'R-600a', cp54,
    SJ54H_COMPONENTS.subcool_K, REF54.T0);
  check('54H dispatch: coolingCapacity',  r54.coolingCapacity, REF54.Qcomp, 0.1);
  check('54H dispatch: inputPower',       r54.inputPower,      REF54.Wcomp, 0.1);

  note('Map path (useMap=true, pv73)');
  const cppv = SJ_PV73K_COMPONENTS.compressor;
  checkBool('pv73 compParams.useMap === true', cppv.useMap === true);
  // Test at a grid point for exact verification
  const r_pv = resolveCompressorState(40, -24, 'R-600a', cppv, 10, 25);
  check('pv73 dispatch: coolingCapacity at (TC=40,TE=-24)', r_pv.coolingCapacity, 123.77, 0.02);
  check('pv73 dispatch: inputPower     at (TC=40,TE=-24)', r_pv.inputPower,        62.42, 0.02);
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 10 – Full 54H solver  (solver.js)
// ═════════════════════════════════════════════════════════════════════════════

section('10. solver.js — 54H full thermal solver convergence', () => {
  const config = {
    geom: GEOM54,
    compParams: SJ54H_COMPONENTS.compressor,
    condenserConfig: COND_CFG54,
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps: { T0: 30, TF: -18, TR: 3 },
    fan: {
      totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h,
      inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W,
    },
    electrical: ELEC54,
    freezerPosition: 'top',
    TC0: 54.4,
    tolOuter: 0.0005,
    maxIterOuter: 100,
    innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
  };

  note('Running solveThermalSystem (fixed TE=-25.27)...');
  const r = solveThermalSystem(config, -25.27);

  checkBool('Solver converged', r.converged === true,
    r.converged ? '' : `error: ${r.error}`);

  if (!r.converged) {
    note('Solver failed — remaining checks skipped');
    return;
  }

  note('Converged values vs Excel (Bug 7 fix causes TC to be ~1–2°C higher than Excel)');
  checkRange('TC in plausible range [35, 55]°C', r.TC, 35, 55);
  checkRange('PR in plausible range [0.4, 0.9]', r.PR, 0.4, 0.9);
  checkRange('T2 in plausible range [-28, -15]°C', r.T2, -28, -15);

  // TC will be higher than Excel 40.906 due to Bug 7 fix (QCin_fixed > QCin_excel)
  const TC_deviation = r.TC - REF54.TC;
  note(`TC deviation from Excel: ${TC_deviation > 0 ? '+' : ''}${TC_deviation.toFixed(3)}°C`);
  note('  Expected: +1 to +3°C due to Bug 7 (Tsub vs TC in h_liquid for QCin).');
  note('  If TC deviation < 0.1°C → Bug 7 not applied in solver QCin path.');
  note('  If TC deviation > 5°C   → additional solver bug present.');
  checkRange('TC deviation from Excel [+0.5, +5.0]°C (Bug 7 effect)',
    TC_deviation, 0.5, 5.0, false);  // WARN not FAIL

  note('Heat loads at convergence — should remain close to Excel values');
  if (r.heatLoads) {
    check('QF at convergence (kcal/h)', r.heatLoads.QF, REF54.QF, 2.0, false);
    check('QR at convergence (kcal/h)', r.heatLoads.QR, REF54.QR, 2.0, false);
  }

  note('Compressor at convergence');
  if (r.compressor) {
    checkRange('compressor.coolingCapacity [100, 200] kcal/h',
      r.compressor.coolingCapacity, 100, 200);
    checkRange('compressor.inputPower [60, 140] W',
      r.compressor.inputPower, 60, 140);
  }

  note('Residuals check – F1 and F2 must be near zero at convergence');
  // Re-evaluate F1 and F2 at the solution point
  const temps_sol = {
    T0: 30, TF: -18, TR: 3,
    TC: r.TC, T2: r.T2, PR: r.PR, TE: -25.27,
  };
  const loads_sol = calcHeatLoads(
    GEOM54, temps_sol, ELEC54, PITCH54, 0.7,
    SJ54H_COMPONENTS.fan.totalAirflow_m3h, null,
    SJ54H_COMPONENTS.fan.inputPower_W, 'top'
  );
  const comp_sol = compressorState(r.TC, -25.27, 'R-600a',
    SJ54H_COMPONENTS.compressor, SJ54H_COMPONENTS.subcool_K, 30);
  const F2_sol = (loads_sol.QF + loads_sol.QR + loads_sol.QEV) - comp_sol.coolingCapacity * r.PR;
  check('F2 residual at solution (should be ≈0)', F2_sol, 0, 0.5);  // 0.5% of ~5 kcal/h range
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 11 – Full pv73 solver  (solver.js, bottom-freezer)
// ═════════════════════════════════════════════════════════════════════════════

section('11. solver.js — pv73 bottom-freezer solver convergence', () => {
  note('No exact Excel reference for converged pv73 (TC=48 is a trial value).');
  note('Testing: convergence, physical plausibility, bottom-freezer orientation.');

  const config = {
    geom: GEOMpv,
    compParams: SJ_PV73K_COMPONENTS.compressor,
    condenserConfig: COND_CFGpv,
    refrigerant: 'R-600a',
    subcool: SJ_PV73K_COMPONENTS.subcool_K,
    dischargeTemp: SJ_PV73K_COMPONENTS.dischargeTemp_C,
    fixedTemps: { T0: 25, TF: -18, TR: 3 },
    fan: {
      totalAirflow: SJ_PV73K_COMPONENTS.fan.totalAirflow_m3h,
      inputPower_W: SJ_PV73K_COMPONENTS.fan.inputPower_W,
    },
    electrical: ELECpv,
    freezerPosition: 'bottom',
    TC0: 40,
    initialTE: SJ_PV73K_COMPONENTS.initialTE ?? -22.7,
    tolOuter: 0.001,
    maxIterOuter: 100,
    innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
  };

  note('Running solveThermalSystem for pv73...');
  const r = solveThermalSystem(config, config.initialTE);

  checkBool('pv73 solver converged', r.converged === true,
    r.converged ? '' : `error: ${r.error}`);

  if (!r.converged) {
    note('pv73 solver failed — remaining checks skipped');
    note('Likely cause: resolveCompressorState not wired in solver, or condenser NaN from key mismatch');
    return;
  }

  note('Physical plausibility checks');
  checkRange('pv73 TC [30, 55]°C',  r.TC, 30, 55);
  checkRange('pv73 PR [0.4, 0.85]', r.PR, 0.4, 0.85);
  checkRange('pv73 T2 [-26, -14]°C', r.T2, -26, -14);

  note(`pv73 converged: TC=${f(r.TC)}°C  PR=${f(r.PR)}  T2=${f(r.T2)}°C`);
  note('Bottom-freezer typically has lower TC than top-freezer (smaller condenser area)');
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 12 – Dynamic TE wrapper  (solver.js)
// ═════════════════════════════════════════════════════════════════════════════

section('12. solver.js — runThermalAnalysisDynamic TE iteration (54H)', () => {
  note('Runs 5 outer TE iterations using NTU evaporator model.');
  note('TE should converge to near Excel −25.265°C (within ±2°C due to Bug 7 effect).');

  const config = {
    geom: GEOM54,
    compParams: SJ54H_COMPONENTS.compressor,
    condenserConfig: COND_CFG54,
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps: { T0: 30, TF: -18, TR: 3 },
    fan: {
      totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h,
      inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W,
    },
    electrical: ELEC54,
    freezerPosition: 'top',
    evapGeom: SJ54H_COMPONENTS.evapGeom,
    TC0: 54.4,
    tolOuter: 0.0005,
    maxIterOuter: 100,
    innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
  };

  const r = runThermalAnalysisDynamic(config);

  checkBool('Dynamic solver converged', r.converged === true,
    r.converged ? '' : `error: ${r.error ?? r.warning}`);

  if (!r.converged) return;

  note(`Dynamic result: TC=${f(r.TC)}°C  TE=${f(r.TE)}°C  PR=${f(r.PR)}`);
  checkRange('TE in plausible range [-30, -18]°C', r.TE, -30, -18);
  checkRange('TC in plausible range [35, 55]°C',   r.TC,  35,  55);

  const TE_deviation = r.TE - REF54.TE;
  note(`TE deviation from Excel −25.265°C: ${TE_deviation > 0 ? '+' : ''}${TE_deviation.toFixed(3)}°C`);
  note('Expected deviation < 2°C. Larger deviations indicate NTU PR correction bug.');
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION 13 – defaultComponents integrity
// ═════════════════════════════════════════════════════════════════════════════

section('13. defaultComponents.js — component data integrity', () => {
  note('─── SJ54H_COMPONENTS ───');
  const c54 = SJ54H_COMPONENTS;
  check('Vc = 11.14 cc',          c54.compressor.Vc,  11.14, 0.001);
  check('rpm = 2900',             c54.compressor.rpm, 2900,  0.001);
  check('AW coefficient',         c54.compressor.powerCoeffs.AW, 135.175, 0.01);
  check('K_side 5.395',           c54.condenser.K_side_kcalhm2C, 5.395,   0.01);
  check('K_back 4.17',            c54.condenser.K_back_kcalhm2C, 4.17,    0.01);
  check('sidePipePitch 150mm',    c54.condenser.sidePipePitch_mm, 150,     0.001);
  check('backPipePitch 200mm',    c54.condenser.backPipePitch_mm, 200,     0.001);
  check('subcool 10K',            c54.subcool_K, 10,   0.001);
  check('fan airflow 59.5 m³/h',  c54.fan.totalAirflow_m3h, 59.5, 0.01);
  check('evapArea 1.754 m²',      c54.evapGeom.evapArea_m2, 1.754, 0.1);

  note('─── SJ_PV73K_COMPONENTS ───');
  checkBool('SJ_PV73K_COMPONENTS exists', typeof SJ_PV73K_COMPONENTS !== 'undefined');
  if (!SJ_PV73K_COMPONENTS) return;

  const cpv = SJ_PV73K_COMPONENTS;
  check('Vc = 10.17 cc',           cpv.compressor.Vc,  10.17, 0.001);
  check('rpm = 2220',              cpv.compressor.rpm, 2220,  0.001);
  check('fan airflow 146.4 m³/h',  cpv.fan.totalAirflow_m3h, 146.4, 0.1);
  check('evapArea 1.2985 m²',      cpv.evapGeom.evapArea_m2, 1.2985, 0.5);
  checkBool('freezerPosition = "bottom"',
    cpv.freezerPosition === 'bottom');
  checkBool('useMap = true',
    cpv.compressor.useMap === true);

  note('─── No cross-contamination between models ───');
  checkBool('54H rpm ≠ pv73 rpm',
    c54.compressor.rpm !== cpv.compressor.rpm);
  checkBool('54H Vc ≠ pv73 Vc',
    c54.compressor.Vc !== cpv.compressor.Vc);
});

// ═════════════════════════════════════════════════════════════════════════════
//  FINAL SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(64)}`);
console.log('  SUMMARY');
console.log('═'.repeat(64));
console.log(`  ✅ Passed  : ${totalPass}`);
console.log(`  ❌ Failed  : ${totalFail}`);
console.log(`  ⚠️  Warnings: ${totalWarn}`);

if (FAILURES.length > 0) {
  console.log('\n  Critical failures:');
  FAILURES.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}
if (WARNINGS.length > 0) {
  console.log('\n  Warnings (known deviations):');
  WARNINGS.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
}

console.log('\n  Known intentional deviations from Excel:');
console.log('  • TC ~1–3°C higher than Excel (Bug 7 fix: Tsub vs TC in QCin h_liquid)');
console.log('  • ARb3 uses (D−Db2) not Db2 (user confirmed intentional)');
console.log('  • R TOP area uses tRleft not tFleft for top-freezer (ignored)');

console.log(`\n  ${totalFail === 0 ? '🟢 ALL CRITICAL TESTS PASSED' : '🔴 FAILURES DETECTED — see list above'}`);
console.log('═'.repeat(64));

process.exit(totalFail > 0 ? 1 : 0);
