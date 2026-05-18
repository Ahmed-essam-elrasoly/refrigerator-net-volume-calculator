/**
 * Detailed comparison between JS thermal solver and SJ-54H Excel baseline.
 * Reads actual Excel file and validates every intermediate calculation.
 * Run: npm run compare:excel
 */

import XLSX from 'xlsx';
import { runThermoAnalysis } from '../src/js/engine/thermo/index.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';
import { DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { toThermalFormat } from '../src/js/engine/geometry.js';

// -------------------------------------------------------------------------
// 1. Read Excel file and extract input parameters
// -------------------------------------------------------------------------
function loadExcelData(filePath) {
  const workbook = XLSX.readFile(filePath);
  const mainSheet = workbook.Sheets['MAIN'];
  const sizeSheet = workbook.Sheets['SIZE'];
  
  // Helper to get cell value (by Excel reference, e.g., 'B5')
  const getCell = (sheet, ref) => {
    const cell = sheet[ref];
    return cell ? cell.v : undefined;
  };
  
  // Extract geometry (SIZE sheet rows 5-13)
  const geom = {
    H: getCell(sizeSheet, 'B6'),      // TOTAL HIGHT
    Hf: getCell(sizeSheet, 'B7'),     // F HIGHT
    Hr: getCell(sizeSheet, 'B8'),     // R HIGHT
    W: getCell(sizeSheet, 'B9'),      // WIDTH
    D: getCell(sizeSheet, 'B10'),     // DEPTH
    Hb: getCell(sizeSheet, 'B11'),    // BOTOM HIGHT
    Db1: getCell(sizeSheet, 'B12'),   // BOTTOM DEPTH Db1
    Db2: getCell(sizeSheet, 'B13'),   // BOTTOM DEPTH Db2
    doorGap: getCell(sizeSheet, 'B14'), // Door gap
    packingPos: getCell(sizeSheet, 'B36'), // Packing position (from bottom)
    // Wall thicknesses (SIZE rows 17-31)
    tFtop: getCell(sizeSheet, 'B17'),
    tFleft: getCell(sizeSheet, 'B18'),
    tFright: getCell(sizeSheet, 'B19'),
    tFbottom: getCell(sizeSheet, 'B20'),
    tFdoor: getCell(sizeSheet, 'B21'),
    tEvaBack: getCell(sizeSheet, 'B22'),
    tRtop: getCell(sizeSheet, 'B23'),
    tRleft: getCell(sizeSheet, 'B24'),
    tRright: getCell(sizeSheet, 'B25'),
    tRback: getCell(sizeSheet, 'B26'),
    tRbottom1: getCell(sizeSheet, 'B27'),
    tRbottom2: getCell(sizeSheet, 'B28'),
    tRbottom3: getCell(sizeSheet, 'B29'),
    tRdoor: getCell(sizeSheet, 'B30'),
  };
  
  // Evaporator geometry (MAIN sheet rows 24-29)
  const evap = {
    width_mm: getCell(mainSheet, 'B24'),   // EV WIDTH (mm)
    depth_mm: getCell(mainSheet, 'B25'),   // EV DEPTH (mm)
    rows: getCell(mainSheet, 'B26'),       // EV Tire (pitch)
    tubeOD_mm: getCell(mainSheet, 'B27'),  // Pipe Diameter φ mm
    finLength_mm: 28, // from "Fin Surface 30*60mm/pc" → fin length = 28mm
    finHeight_mm: 60,
    numFins: getCell(mainSheet, 'B45'),    // Total fin quantity
  };
  
  // Fixed temperatures (MAIN sheet)
  const fixedTemps = {
    T0: getCell(mainSheet, 'B8'),   // OUTSIDE
    TF: getCell(mainSheet, 'B5'),   // F ROOM TF
    TR: getCell(mainSheet, 'B6'),   // R ROOM TR
    TE: -23.3,                      // from compressor data (constant)
  };
  
  // Fan and electrical (MAIN sheet)
  const fan = {
    totalAirflow: getCell(mainSheet, 'B11'),
    inputPower_W: getCell(mainSheet, 'B14'),
  };
  const electrical = {
    pwbOn_W: getCell(mainSheet, 'B16'),
    pwbOff_W: getCell(mainSheet, 'B17'),
    defrostHeater_W: getCell(mainSheet, 'B15'),
    timerPeriod_h: getCell(mainSheet, 'B18'),
    defrostOn_min: getCell(mainSheet, 'B19'),
  };
  
  // Compressor parameters (from MAIN sheet, but defaultComponents already has them)
  // We'll use SJ54H_COMPONENTS as it matches the Excel.
  
  // Condenser configuration (from MAIN sheet)
  const condenserConfig = {
    K_side: getCell(mainSheet, 'J38'),    // Side Cond K value (from table)
    K_back: getCell(mainSheet, 'J39'),    // Back Cond K value
    backCondenserEfficiency: 0.7,         // from cell K40
    k_RFront1: 0.3405,
    k_RFront2: 0.03322,
    k_FRPartition1: 0.1984,
    k_FRPartition2: 0.1219,
    k_FFront1: 0.3395,
    k_FFront2: 0.0344,
  };
  
  return { geom, evap, fixedTemps, fan, electrical, condenserConfig };
}

// -------------------------------------------------------------------------
// 2. Extract expected converged values from Excel (after macro)
// -------------------------------------------------------------------------
function extractExpectedOutputs(filePath) {
  const workbook = XLSX.readFile(filePath);
  const mainSheet = workbook.Sheets['MAIN'];
  const sizeSheet = workbook.Sheets['SIZE'];
  
  const getCell = (sheet, ref) => {
    const cell = sheet[ref];
    return cell ? cell.v : undefined;
  };
  
  // These are the values after the macro converges (from MAIN sheet)
  const expected = {
    TC: getCell(mainSheet, 'B7'),          // DP CON. TC
    T2: getCell(mainSheet, 'E37'),         // X1 (EV OUT Temp)
    PR: getCell(mainSheet, 'E38'),         // X2 (RUNNING RATIO)
    QF: getCell(sizeSheet, 'E32'),         // QF TOTAL (inlet)
    QR: getCell(sizeSheet, 'E33'),         // QR TOTAL (inlet)
    QEV: getCell(sizeSheet, 'E34'),        // QEV TOTAL (inlet)
    coolingCapacity: getCell(mainSheet, 'K31'), // Qcomp (Ability of Compressor)
    inputPower: getCell(mainSheet, 'K32'), // COMP INPUT (W)
  };
  return expected;
}

// -------------------------------------------------------------------------
// 3. Run JS solver and compare
// -------------------------------------------------------------------------
async function compare() {
  console.log('🔍 Reading SJ-54H Excel file...');
  const excelPath = 'Copy of Refrigerator freezer SJ-54H.xlsx';
  
  const { geom, evap, fixedTemps, fan, electrical, condenserConfig } = loadExcelData(excelPath);
  const expected = extractExpectedOutputs(excelPath);
  
  console.log('📊 Input geometry:', geom);
  console.log('📊 Evaporator:', evap);
  console.log('📊 Fixed temps:', fixedTemps);
  console.log('📊 Expected outputs:', expected);
  
  // Build JS config
  const jsConfig = {
    geom: { ...geom, evap },   // Add evaporator to geometry
    compParams: SJ54H_COMPONENTS.compressor,
    condenserConfig,
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps,
    fan,
    electrical,
    solverOptions: {
      TC0: 54.4,
      DH: 0.001,
      tolOuter: 0.0005,
      maxIterOuter: 100,
      innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
    },
  };
  
  console.log('\n🚀 Running JS thermal solver...');
  const result = runThermoAnalysis(jsConfig);
  
  if (!result.success) {
    console.error('❌ JS solver failed:', result.errors);
    process.exit(1);
  }
  
  const r = result.results;
  
  // Compare
  const TOL_TC = 0.05;
  const TOL_T2 = 0.05;
  const TOL_PR = 0.001;
  const TOL_Q = 2.0;
  const TOL_POWER = 2.0;
  const TOL_CAP = 2.0;
  
  let allOk = true;
  function compareValue(name, actual, expected, tol) {
    const diff = Math.abs(actual - expected);
    const ok = diff <= tol;
    if (!ok) allOk = false;
    console.log(`${ok ? '✅' : '❌'} ${name}: actual=${actual.toFixed(4)} expected=${expected.toFixed(4)} diff=${diff.toFixed(6)}`);
    return ok;
  }
  
  console.log('\n--- Primary solver outputs ---');
  compareValue('TC (°C)', r.TC, expected.TC, TOL_TC);
  compareValue('T2 (°C)', r.T2, expected.T2, TOL_T2);
  compareValue('PR', r.PR, expected.PR, TOL_PR);
  
  console.log('\n--- Heat loads (kcal/h) ---');
  compareValue('QF', r.heatLoads.QF, expected.QF, TOL_Q);
  compareValue('QR', r.heatLoads.QR, expected.QR, TOL_Q);
  compareValue('QEV', r.heatLoads.QEV, expected.QEV, TOL_Q);
  
  console.log('\n--- Compressor ---');
  compareValue('Cooling capacity (kcal/h)', r.compressor.coolingCapacity, expected.coolingCapacity, TOL_CAP);
  compareValue('Input power (W)', r.compressor.inputPower, expected.inputPower, TOL_POWER);
  
  console.log(`\nIterations: outer=${r.iterations.outer}, inner total=${r.iterations.innerTotal}`);
  
  if (allOk) {
    console.log('\n🎉 JS solver matches SJ-54H Excel within tolerances.');
    process.exit(0);
  } else {
    console.error('\n⚠️ Discrepancies found. Debug the differences using the output above.');
    process.exit(1);
  }
}

compare().catch(err => {
  console.error('Comparison error:', err);
  process.exit(1);
});