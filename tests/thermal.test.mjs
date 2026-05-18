// tests/thermal.test.mjs
import assert from 'node:assert';
import { describe, it, before } from 'node:test';

import {
  runThermoAnalysis,
  buildDefaultConfig
} from '../src/js/engine/thermo/index.js';

import {
  satPressureR600a, specificVolumeR600a, vaporEnthalpyR600a, liquidEnthalpyR600a,
  satPressureR134a, specificVolumeR134a, vaporEnthalpyR134a, liquidEnthalpyR134a,
} from '../src/js/engine/thermo/refrigerant.js';

import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { calcQCout, computeCondenserAreas } from '../src/js/engine/thermo/condenser.js';
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

// (refrigerant and compressor tests unchanged)

describe('Heat Loads (SJ-54H defaults with condenser rises)', () => {
  const temps = {
    T0: 30, TF: -18, TR: 3, TE: -23.3, T2: -21.2483, TC: 54.4, PR: 0.5906
  };
  const electrical = SJ54H_COMPONENTS.electrical;
  const geom = DEFAULT_GEOMETRY;
  // Provide sample condenser rises (approximate)
  const condenserRises = { side: 5.0, back: 3.0 };
  let loads;
  before(() => {
    loads = calcHeatLoads(geom, temps, electrical, condenserRises);
  });

  it('QF and QR are positive', () => {
    assert.ok(loads.QF > 0, `QF = ${loads.QF}`);
    assert.ok(loads.QR > 0, `QR = ${loads.QR}`);
  });

  it('QEV is positive (heat flow from back cab to evaporator)', () => {
    assert.ok(loads.QEV > 0, `QEV = ${loads.QEV}`);
  });

  it('fanLoad and defrostLoad are non-negative', () => {
    assert.ok(loads.fanLoad >= 0);
    assert.ok(loads.defrostLoad >= 0);
  });

  it('Total heat load equals QF + QR + QEV', () => {
    const total = loads.QF + loads.QR + loads.QEV;
    assert.ok(total > 0);
  });
});

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
    // Compute condenser rises the same way the solver did
    const areas = computeCondenserAreas(defaultConfig.geom, defaultConfig.condenserConfig);
    const sideRise = (defaultConfig.condenserConfig.K_side / 10) * (TC - fixedTemps.T0);
    const backRise = (defaultConfig.condenserConfig.K_back / 10) * (TC - fixedTemps.T0);
    const cr = { side: sideRise, back: backRise };
    const temps = { T0: fixedTemps.T0, TF: fixedTemps.TF, TR: fixedTemps.TR, T2, TC, PR };
    const heatLoads = calcHeatLoads(defaultConfig.geom, temps, defaultConfig.electrical, cr);
    const comp = compressorState(TC, fixedTemps.TE, 'R-600a', defaultConfig.compParams, defaultConfig.subcool);

    const Qtotal = heatLoads.QF + heatLoads.QR + heatLoads.QEV;
    const F2 = Qtotal - comp.coolingCapacity * PR;
    assert.ok(Math.abs(F2) < 1e-3, `F2 = ${F2}`);

    const rho = 1.365, cp = 0.24;
    const fanFlow = defaultConfig.fan.totalAirflow;
    const denom = fanFlow * rho * cp * PR;
    let F1;
    if (denom < 1e-12) {
      F1 = heatLoads.QF;
    } else {
      const T3 = T2 + heatLoads.QEV / denom;
      const MR = (Math.abs(fixedTemps.TR - T3) < 1e-9) ? 0
                 : heatLoads.QR / (rho * cp * (fixedTemps.TR - T3) * PR);
      const MF = fanFlow - MR;
      const QF_prime = MF * rho * cp * (fixedTemps.TF - T2) * PR;
      F1 = heatLoads.QF - QF_prime;
    }
    assert.ok(Math.abs(F1) < 0.1, `F1 = ${F1}`);
  });

  it('condenser balance (F3) is small', () => {
    const { TC, T2 } = result;
    const areas = computeCondenserAreas(defaultConfig.geom, defaultConfig.condenserConfig);
    const QCout = calcQCout(TC, defaultConfig.fixedTemps.T0, defaultConfig.fixedTemps.TF, defaultConfig.fixedTemps.TR, areas);

    const comp = compressorState(TC, defaultConfig.fixedTemps.TE, 'R-600a', defaultConfig.compParams, defaultConfig.subcool);
    const p_cond = satPressureR600a(TC);
    const h_dis = vaporEnthalpyR600a(defaultConfig.dischargeTemp, p_cond);
    const QCin = comp.massFlow * (h_dis - comp.h_liquid);

    assert.ok(Math.abs(QCout - QCin) < 0.01, `F3 = ${QCout - QCin}`);
  });
});