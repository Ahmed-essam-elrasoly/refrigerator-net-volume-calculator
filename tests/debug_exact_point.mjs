// tests/debug_exact_point.mjs
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

// Use the complete geometry (all thicknesses and dimensions)
const geom = { ...DEFAULT_GEOMETRY };

// Fixed operating point
const fixedTemps = {
  T0: 30,
  TF: -18,
  TR: 3,
  TE: -23.3,
  T2: -21.25,
  TC: 40.91,
  PR: 0.591
};

const electrical = { ...SJ54H_COMPONENTS.electrical };

// Condenser configuration
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

const areas = computeCondenserAreas(geom, condenserConfig);
const sideRisePerK = condenserConfig.K_side / 10;
const backRisePerK = condenserConfig.K_back / 10;
const condenserRises = {
  side: sideRisePerK * (fixedTemps.TC - fixedTemps.T0),
  back: backRisePerK * (fixedTemps.TC - fixedTemps.T0)
};

const fan = {
  totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h,
  inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W
};

// --------- Heat Loads ---------
const loads = calcHeatLoads(
  geom, fixedTemps, electrical, condenserRises,
  fan.totalAirflow, geom.evap || {}, fan.inputPower_W
);
console.log('=== HEAT LOADS ===');
console.log('QF (kcal/h):', loads.QF.toFixed(2));
console.log('QR (kcal/h):', loads.QR.toFixed(2));
console.log('QEV (kcal/h):', loads.QEV.toFixed(2));
console.log('fanLoad:', loads.fanLoad.toFixed(2), 'defrostLoad:', loads.defrostLoad.toFixed(2));
console.log('Qtotal:', (loads.QF + loads.QR + loads.QEV).toFixed(2));

// --------- Compressor ---------
const refrigerant = 'R-600a';
const subcool = SJ54H_COMPONENTS.subcool_K;
const comp = compressorState(fixedTemps.TC, fixedTemps.TE, refrigerant, SJ54H_COMPONENTS.compressor, subcool);
console.log('\n=== COMPRESSOR ===');
console.log('Volumetric eff. ηv:', comp.etaV.toFixed(4));
console.log('Mass flow (kg/h):', comp.massFlow.toFixed(3));
console.log('Cooling cap (kcal/h):', comp.coolingCapacity.toFixed(2));
console.log('Input power (W):', comp.inputPower.toFixed(2));
console.log('h_suction (kcal/kg):', comp.h_suction.toFixed(2));
console.log('h_liquid (kcal/kg):', comp.h_liquid.toFixed(2));

// --------- Condenser balance ---------
const QCout = calcQCout(fixedTemps.TC, fixedTemps.T0, fixedTemps.TF, fixedTemps.TR, areas);
const QCin = calcQCin(fixedTemps.TC, fixedTemps.TE, refrigerant, SJ54H_COMPONENTS.compressor, subcool, SJ54H_COMPONENTS.dischargeTemp_C);
console.log('\n=== CONDENSER ===');
console.log('QCout (kcal/h):', QCout.toFixed(2));
console.log('QCin (kcal/h):', QCin.toFixed(2));
console.log('Balance:', (QCout - QCin).toFixed(4));

// --------- Inner solver functions F1 & F2 ---------
const rho = 1.365, cp = 0.24;
const denom = fan.totalAirflow * rho * cp * fixedTemps.PR;
const T3 = fixedTemps.T2 + loads.QEV / denom;
const MR = loads.QR / (rho * cp * (fixedTemps.TR - T3) * fixedTemps.PR);
const MF = fan.totalAirflow - MR;
const QF_prime = MF * rho * cp * (fixedTemps.TF - fixedTemps.T2) * fixedTemps.PR;
const F1 = loads.QF - QF_prime;
const F2 = (loads.QF + loads.QR + loads.QEV) - comp.coolingCapacity * fixedTemps.PR;
console.log('\n=== SOLVER FUNCTIONS ===');
console.log('T3 (fan outlet):', T3.toFixed(2));
console.log('MR (refrig airflow):', MR.toFixed(2));
console.log('MF (freezer airflow):', MF.toFixed(2));
console.log("QF' (air cooling):", QF_prime.toFixed(2));
console.log('F1 (should ≈ 0):', F1.toFixed(4));
console.log('F2 (should ≈ 0):', F2.toFixed(4));