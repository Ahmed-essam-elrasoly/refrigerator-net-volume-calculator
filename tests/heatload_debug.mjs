/**
 * Debug heat load calculation against SJ-54H Excel.
 * Uses Excel's converged temperatures (TC, T2, PR) to compute QF, QR, QEV.
 * Run: node tests/heatload_debug.mjs
 */

import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

// Excel converged temperatures (from MAIN sheet)
const temps = {
  T0: 30,
  TF: -18,
  TR: 3,
  TE: -23.3,
  TC: 40.90551469703945,
  T2: -21.2483006297973,
  PR: 0.5905646101665666,
};

// Geometry from SJ-54H (SIZE sheet)
const geom = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4,
  tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  evap: {
    width_mm: 460, depth_mm: 60, rows: 7, tubeOD_mm: 8,
    finLength_mm: 28, finHeight_mm: 60, numFins: 504,
  },
};

// Electrical & fan parameters
const electrical = SJ54H_COMPONENTS.electrical;
const fanAirflow = SJ54H_COMPONENTS.fan.totalAirflow_m3h;
const fanPower = SJ54H_COMPONENTS.fan.inputPower_W;

// Condenser temperature rises (from Excel H50, H51) – compute from TC and T0
const condenserRises = {
  side: 13.1638,   // from K_side/10*(TC-T0) = 5.395/10*(40.9055-30) ≈ 0.5395*10.9055 ≈ 5.88? Wait, Excel H50 is 5.88? Let's compute exactly
  back: 10.1748,   // K_back/10*(TC-T0) = 4.17/10*10.9055 ≈ 4.55? Not matching. We'll read from Excel later.
};

// Expected outputs (from Excel)
const expected = {
  QF: 27.358180306372777,
  QR: 39.405076968696406,
  QEV: 5.433041824123792,
};

console.log('🔍 Computing heat loads with Excel converged temperatures...\n');

// Compute using our heatLoad.js
const loads = calcHeatLoads(geom, temps, electrical, condenserRises, fanAirflow, geom.evap, fanPower);

console.log('--- Results ---');
console.log(`QF:   computed=${loads.QF.toFixed(4)} expected=${expected.QF.toFixed(4)} diff=${(loads.QF - expected.QF).toFixed(4)}`);
console.log(`QR:   computed=${loads.QR.toFixed(4)} expected=${expected.QR.toFixed(4)} diff=${(loads.QR - expected.QR).toFixed(4)}`);
console.log(`QEV:  computed=${loads.QEV.toFixed(4)} expected=${expected.QEV.toFixed(4)} diff=${(loads.QEV - expected.QEV).toFixed(4)}`);
console.log(`fanLoad: ${loads.fanLoad.toFixed(4)} kcal/h`);
console.log(`defrostLoad: ${loads.defrostLoad.toFixed(4)} kcal/h`);
console.log('K values (kcal/h·m²·°C):');
console.log('tFtop K   :', kUrethane(tFtop));
console.log('tFleft K  :', kUrethane(tFleft));
console.log('tFdoor K  :', kUrethane(tFdoor));
// etc.
// To debug further, we can log intermediate values from heatLoad.js if we add more console logs there.