// tests/integration_test.mjs
import { solveThermalSystem } from '../src/js/engine/thermo/solver.js';
import { DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

const geom = { ...DEFAULT_GEOMETRY };
const compParams = { ...SJ54H_COMPONENTS.compressor };
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
  fixedTemps: { T0: 30, TF: -18, TR: 3 },
  fan: { totalAirflow: 59.5, inputPower_W: 2.1 },
  electrical: { defrostHeater_W: 140, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 },
  TC0: 42,
  DH: 0.001,
  tolOuter: 0.001,
  maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100, debug: true },  // DEBUG ON
};

console.log('=== Integration test (SJ‑540) with debug ===');
const res = solveThermalSystem(config);
if (res.converged) {
  console.log('✅ Converged:');
  console.log(`TC = ${res.TC.toFixed(2)} °C`);
  console.log(`T2 = ${res.T2.toFixed(2)} °C`);
  console.log(`TE = ${res.TE.toFixed(2)} °C`);
  console.log(`PR = ${(res.PR * 100).toFixed(1)} %`);
  console.log(`QF = ${res.heatLoads.QF.toFixed(2)} kcal/h`);
  console.log(`QR = ${res.heatLoads.QR.toFixed(2)} kcal/h`);
  console.log(`QEV = ${res.heatLoads.QEV.toFixed(2)} kcal/h`);
  console.log(`Comp cooling = ${res.compressor.coolingCapacity.toFixed(2)} kcal/h`);
  console.log(`Input power = ${res.compressor.inputPower.toFixed(2)} W`);
} else {
  console.log('❌ Failed:', res.error);
}