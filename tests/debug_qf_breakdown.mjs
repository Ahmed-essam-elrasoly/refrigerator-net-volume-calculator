// save as tests/debug_qf_breakdown.mjs
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

const geom = { ...DEFAULT_GEOMETRY };
const condenserConfig = { K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322, k_FRPartition1: 0.1984,
  k_FRPartition2: 0.1219, k_FFront1: 0.3395, k_FFront2: 0.0344 };
const sideRisePerK = condenserConfig.K_side / 10;
const backRisePerK = condenserConfig.K_back / 10;
const TC=40.91, T0=30;
const condenserRises = { side: sideRisePerK*(TC-T0), back: backRisePerK*(TC-T0) };
const temps = { T0, TF:-18, TR:3, T2:-21.25, TC, PR:0.591, TE:-23.3 };
const electrical = { ...SJ54H_COMPONENTS.electrical };
const fan = { totalAirflow: 59.5, inputPower_W: 2.1 };

// Add logging to calcHeatLoads temporarily? Better: we can't easily without modifying the function.
// Instead, we'll just print the load totals.
const loads = calcHeatLoads(geom, temps, electrical, condenserRises, fan.totalAirflow, geom.evap, fan.inputPower_W);
console.log('QF:', loads.QF.toFixed(2));
console.log('QR:', loads.QR.toFixed(2));
console.log('QEV:', loads.QEV.toFixed(2));