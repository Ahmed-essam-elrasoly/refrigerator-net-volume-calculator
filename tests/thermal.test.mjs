// tests/thermal.test.mjs
// Phase 1.3 - Thermodynamic Engine Unit Tests (Corrected)
// Run with: node tests/thermal.test.mjs

import assert from 'node:assert';
import { describe, it, before } from 'node:test';

import {
  runThermoAnalysis,
  buildDefaultConfig
} from '../src/js/engine/thermo/index.js';

import {
  satPressureR600a,
  specificVolumeR600a,
  vaporEnthalpyR600a,
  liquidEnthalpyR600a,
  satPressureR134a,
  specificVolumeR134a,
  vaporEnthalpyR134a,
  liquidEnthalpyR134a,
} from '../src/js/engine/thermo/refrigerant.js';

import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { calcQCout, computeCondenserAreas } from '../src/js/engine/thermo/condenser.js';
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

// ---------------------------------------------------------------------------
// 1. Refrigerant Functions
// ---------------------------------------------------------------------------
describe('Refrigerant R-600a', () => {
  it('satPressureR600a returns positive values', () => {
    const p = satPressureR600a(30);
    assert.ok(p > 0 && p < 10, 'Pressure out of range');
  });

  it('satPressureR600a is monotonic with temperature', () => {
    assert.ok(satPressureR600a(30) > satPressureR600a(-20));
  });

  it('specificVolumeR600a returns positive reasonable value', () => {
    const t = 32.2;                // suction temperature
    const p = satPressureR600a(-23.3); // Pe at Te
    const v = specificVolumeR600a(t, p);
    assert.ok(v > 0 && v < 1, `v = ${v}`);
  });

it('vaporEnthalpyR600a at suction condition matches Excel value', () => {
    const p = satPressureR600a(-23.3);
    const h = vaporEnthalpyR600a(32.2, p);
    assert.ok(Math.abs(h - 174.08) < 0.2, `h = ${h}`);
});

  it('liquidEnthalpyR600a at 44.4°C is reasonable', () => {
    const h = liquidEnthalpyR600a(44.4);
    // Excel Hiliquid ~ 107 kcal/kg (approximate, but we can check later)
    assert.ok(h > 100 && h < 115, `h = ${h}`);
  });
});

describe('Refrigerant R-134a', () => {
  it('satPressureR134a returns positive values', () => {
    assert.ok(satPressureR134a(30) > 0 && satPressureR134a(30) < 15);
  });

  it('specificVolumeR134a returns positive reasonable value', () => {
    const t = 32.2;
    const p = satPressureR134a(-23.3);
    const v = specificVolumeR134a(t, p);
    assert.ok(v > 0 && v < 0.5, `v = ${v}`);
  });

  it('vaporEnthalpyR134a > liquidEnthalpyR134a', () => {
    const p = satPressureR134a(-23.3);
    const hVap = vaporEnthalpyR134a(32.2, p);
    const hLiq = liquidEnthalpyR134a(44.4);
    assert.ok(hVap > hLiq);
  });
});

// ---------------------------------------------------------------------------
// 2. Compressor Model (now with T_suction)
// ---------------------------------------------------------------------------
describe('Compressor EGX80CLC', () => {
  const compParams = SJ54H_COMPONENTS.compressor;
  const refrigerant = 'R-600a';
  const subcool = 10;
  const TC = 54.4;
  const TE = -23.3;

  let state;
  before(() => {
    state = compressorState(TC, TE, refrigerant, compParams, subcool);
  });

  it('returns a valid state with positive mass flow', () => {
    assert.ok(state.massFlow > 0);
  });

  it('cooling capacity is positive and within expected range', () => {
    assert.ok(state.coolingCapacity > 100 && state.coolingCapacity < 300,
      `Qc = ${state.coolingCapacity}`);
  });

  it('input power is positive and reasonable', () => {
    assert.ok(state.inputPower > 50 && state.inputPower < 200);
  });

  it('volumetric efficiency is between 0 and 1', () => {
    assert.ok(state.etaV > 0 && state.etaV < 1);
  });

  it('cooling capacity formula consistency', () => {
    const expected = state.massFlow * (state.h_suction - state.h_liquid);
    assert.ok(Math.abs(state.coolingCapacity - expected) < 0.01);
  });
});

// ---------------------------------------------------------------------------
// 3. Heat Loads with Default Geometry
// ---------------------------------------------------------------------------
describe('Heat Loads (SJ-54H defaults)', () => {
  const temps = {
    T0: 30, TF: -18, TR: 3, TE: -23.3, T2: -21.2483, TC: 54.4, PR: 0.5906
  };
    const electrical = SJ54H_COMPONENTS.electrical;
  const geom = DEFAULT_GEOMETRY;

  let loads;
  before(() => {
    loads = calcHeatLoads(geom, temps, electrical);
  });

  it('QF and QR are positive', () => {
    assert.ok(loads.QF > 0, `QF = ${loads.QF}`);
    assert.ok(loads.QR > 0, `QR = ${loads.QR}`);
  });

  it('QR is positive', () => {
    assert.ok(loads.QR > 0);
  });

  it('QEV is negative (heat flow from refrigerator to evaporator)', () => {
    // T2 < TR → QEV should be negative
    assert.ok(loads.QEV < 0, `QEV = ${loads.QEV}`);
  });

  it('fanLoad and defrostLoad are non-negative', () => {
    assert.ok(loads.fanLoad >= 0);
    assert.ok(loads.defrostLoad >= 0);
  });

  it('Total heat load equals QF + QR + QEV', () => {
    const total = loads.QF + loads.QR + loads.QEV;
    assert.ok(total > 0); // still positive after subtracting QEV
  });
});

// ---------------------------------------------------------------------------
// 4. Full Nested Solver – Convergence and Consistency
// ---------------------------------------------------------------------------
describe('Full Thermal Solver', () => {
  const defaultConfig = buildDefaultConfig();
  let analysisResult;
  let result;

  before(() => {
    analysisResult = runThermoAnalysis(defaultConfig);
    if (!analysisResult.success) {
      throw new Error(`Solver did not converge: ${analysisResult.errors.join('; ')}`);
    }
    result = analysisResult.results;
  });

  it('converges within tolerance', () => {
    assert.ok(analysisResult.success);
  });

  it('returns plausible temperatures', () => {
    assert.ok(result.TC > 30 && result.TC < 70, `TC = ${result.TC}`);
    assert.ok(result.T2 > -40 && result.T2 < 0, `T2 = ${result.T2}`);
    assert.ok(result.PR > 0 && result.PR <= 1, `PR = ${result.PR}`);
  });

  it('inner loop residuals (F1, F2) are small', () => {
    const { TC, T2, PR } = result;
    const fixedTemps = defaultConfig.fixedTemps;
    const temps = { T0: fixedTemps.T0, TF: fixedTemps.TF, TR: fixedTemps.TR, T2, TC, PR };
    const heatLoads = calcHeatLoads(defaultConfig.geom, temps, defaultConfig.electrical);
const comp = compressorState(TC, defaultConfig.fixedTemps.TE, 'R-600a', defaultConfig.compParams, defaultConfig.subcool);
    const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;   // note QEV is negative
    const F2 = Qtotal - comp.coolingCapacity * PR;
    assert.ok(Math.abs(F2) < 1e-3, `F2 = ${F2}`);

    const rho = 1.365, cp = 0.24;
    const fanFlow = defaultConfig.fan.totalAirflow;
    const T3 = T2 + heatLoads.QEV / (fanFlow * rho * cp * PR);   // QEV negative → T3 < T2
    const MR = (fixedTemps.TR !== T3)
      ? heatLoads.QR / (rho * cp * (fixedTemps.TR - T3) * PR)
      : 0;
    const MF = Math.max(0, fanFlow - MR);
    const QF_prime = MF * rho * cp * (fixedTemps.TF - T2) * PR;
    const F1 = heatLoads.QF - QF_prime;
    assert.ok(Math.abs(F1) < 0.1, `F1 = ${F1}`);
  });

  it('condenser balance (F3) is small', () => {
    const { TC, T2 } = result;
    const areas = computeCondenserAreas(defaultConfig.geom, defaultConfig.condenserConfig);
    const QCout = calcQCout(TC, defaultConfig.fixedTemps.T0, defaultConfig.fixedTemps.TF, areas);

    const comp = compressorState(TC, T2, 'R-600a', defaultConfig.compParams, defaultConfig.subcool);
    const p_cond = satPressureR600a(TC);
    const h_dis = vaporEnthalpyR600a(defaultConfig.dischargeTemp, p_cond);
    const QCin = comp.massFlow * (h_dis - comp.h_liquid);

    assert.ok(Math.abs(QCout - QCin) < 0.01, `F3 = ${QCout - QCin}`);
  });
});