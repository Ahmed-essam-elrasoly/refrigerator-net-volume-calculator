// tests/debug_solver_run.mjs
import { solveThermalSystem } from '../src/js/engine/thermo/solver.js';
import { DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

const geom = { ...DEFAULT_GEOMETRY };
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

const config = {
  geom,
  compParams: { ...SJ54H_COMPONENTS.compressor },
  condenserConfig,
  refrigerant: 'R-600a',
  subcool: SJ54H_COMPONENTS.subcool_K,
  dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
  fixedTemps: { T0: 30, TF: -18, TR: 3, TE: -23.3 },
  fan: { totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h, inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W },
  electrical: { ...SJ54H_COMPONENTS.electrical },
  // Solver settings – start with a close guess
  TC0: 45,               // initial condensing temp guess
  DH: 0.001,
  tolOuter: 0.001,
  maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
};

console.log('Starting full thermal solver...');
const result = solveThermalSystem(config);

if (result.converged) {
  console.log('✅ Converged!');
  console.log(`TC = ${result.TC.toFixed(2)} °C`);
  console.log(`T2 = ${result.T2.toFixed(2)} °C`);
  console.log(`PR = ${(result.PR * 100).toFixed(1)} %`);
  console.log(`QF = ${result.heatLoads.QF.toFixed(2)} kcal/h`);
  console.log(`QR = ${result.heatLoads.QR.toFixed(2)} kcal/h`);
  console.log(`QEV = ${result.heatLoads.QEV.toFixed(2)} kcal/h`);
  console.log(`Comp cooling = ${result.compressor.coolingCapacity.toFixed(2)} kcal/h`);
  console.log(`Input power = ${result.compressor.inputPower.toFixed(2)} W`);
  console.log(`Outer iterations: ${result.outerIterations}, inner total: ${result.innerTotalIterations}`);
} else {
  console.log('❌ Not converged:', result.error);
  console.log(`Last TC = ${result.TC?.toFixed(2)}, T2 = ${result.T2?.toFixed(2)}, PR = ${result.PR?.toFixed(4)}`);
}