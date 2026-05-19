// tests/debug_pv73k_solve.mjs
import { runThermalAnalysisDynamic } from '../src/js/engine/thermo/solver.js';

const geom = { /* same as above */ };
const compParams = { /* same as above */ };
const condenserConfig = { /* same as above */ };

const config = {
  geom, compParams, condenserConfig,
  refrigerant: 'R-600a', subcool: 10, dischargeTemp: 60,
  fixedTemps: { T0: 25, TF: -18, TR: 3 },
  fan: { totalAirflow: 146.4, inputPower_W: 2.4 },
  electrical: { defrostHeater_W: 112, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 },
  TC0: 48,
  DH: 0.001, tolOuter: 0.001, maxIterOuter: 50,
  innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100, initialT2: -19.5, initialPR: 0.78, debug: true },
};

console.log('=== PV73K Dynamic TE Solver (fixed initial guess) ===');
const res = runThermalAnalysisDynamic(config);
if (res.converged) {
  console.log(`TC = ${res.TC.toFixed(2)} °C   (Excel 48.00)`);
  console.log(`T2 = ${res.T2.toFixed(2)} °C   (Excel -19.50)`);
  console.log(`TE = ${res.TE.toFixed(2)} °C   (Excel -23.02)`);
  console.log(`PR = ${(res.PR*100).toFixed(1)} %   (Excel 78.0%)`);
  console.log(`QF = ${res.heatLoads.QF.toFixed(2)} (Excel 45.44)`);
  console.log(`QR = ${res.heatLoads.QR.toFixed(2)} (Excel 14.39)`);
  console.log(`QEV = ${res.heatLoads.QEV.toFixed(2)} (Excel 9.86)`);
  console.log(`Comp cooling = ${res.compressor.coolingCapacity.toFixed(2)} (Excel 89.36)`);
  console.log(`Input power = ${res.compressor.inputPower.toFixed(2)} (Excel 104.27)`);
} else {
  console.log('❌ Failed:', res.error);
}