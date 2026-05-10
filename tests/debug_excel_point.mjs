// tests/debug_excel_point.mjs
import { DEFAULT_GEOMETRY, calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas, calcQCout } from '../src/js/engine/thermo/condenser.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

const geom = DEFAULT_GEOMETRY;
const electrical = SJ54H_COMPONENTS.electrical;
const compParams = SJ54H_COMPONENTS.compressor;
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

// Excel converged point
const TC = 40.91;
const T2 = -21.25;
const PR = 0.591;
const T0 = 30, TF = -18, TR = 3, TE = -23.3;

// Compute condenser rises as Excel does: K/10 * (TC-T0) * PR
const sideRise = (condenserConfig.K_side / 10) * (TC - T0) * PR;
const backRise = (condenserConfig.K_back / 10) * (TC - T0) * PR;
const cr = { side: sideRise, back: backRise };

const loads = calcHeatLoads(geom, { T0, TF, TR, T2, TC, PR }, electrical, cr);
const comp = compressorState(TC, TE, 'R-600a', compParams, 10);

console.log('Excel point with JS formulas:');
console.log(`QF: ${loads.QF.toFixed(4)} (Excel: 27.36)`);
console.log(`QR: ${loads.QR.toFixed(4)} (Excel: 39.41)`);
console.log(`QEV: ${loads.QEV.toFixed(4)} (Excel: 5.43)`);
console.log(`Qtotal: ${(loads.QF+loads.QR+loads.QEV).toFixed(4)}`);
console.log(`comp.coolingCapacity: ${comp.coolingCapacity.toFixed(4)} (Excel: 170.78)`);
console.log(`comp.massFlow: ${comp.massFlow.toFixed(4)} (Excel: 2.14)`);
console.log(`comp.inputPower: ${comp.inputPower.toFixed(4)} (Excel: 110.5)`);
console.log(`comp.etaV: ${comp.etaV.toFixed(4)}`);

// Condenser check
const areas = computeCondenserAreas(geom, condenserConfig);
const QCout = calcQCout(TC, T0, TF, areas);
// QCin = mdot * (h_dis - h_liq)
const { satPressureR600a, vaporEnthalpyR600a } = await import('../src/js/engine/thermo/refrigerant.js');
const p_cond = satPressureR600a(TC);
const h_dis = vaporEnthalpyR600a(60, p_cond);
const QCin = comp.massFlow * (h_dis - comp.h_liquid);
console.log(`QCout: ${QCout.toFixed(4)}, QCin: ${QCin.toFixed(4)} (F3 = ${(QCout-QCin).toFixed(4)})`);