// tests/debug_pv73k_check.mjs – verify model at Excel point
import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';
import { compressorState } from '../src/js/engine/thermo/compressor.js';

const geom = {
  H: 1794, W: 795, D: 687, Hf: 1048, Hr: 746,
  Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  tFtop: 55, tFleft: 57, tFright: 57, tFbottom: 32, tFdoor: 58, tEvaBack: 55,
  tRtop: 32, tRleft: 82, tRright: 82, tRback: 80,
  tRbottom1: 76, tRbottom2: 80, tRbottom3: 82, tRdoor: 80,
  evapWidth_m: 0.441, evapDepth_m: 0.058, evapArea_m2: 1.298,
};

const compParams = {
  rpm: 2220, rpm0: 2220, Vc: 10.17, T_suction: 32.2,
  volEffCoeffs: { A: 0.930258355959706, B: -0.0122944055653239, C: -0.00205320515178857 },
  kEtaV: { a: 1, b: 0, c: 0 },
  powerCoeffs: { AW: -403.45924099761, BW: -10.6694476143275, CW: 13.0743243243218, DW: 0.348692065559428, EW: 0.0374699023348273 },
  powerKw: { a: 1, b: 0, c: 0 },
};

const condenserConfig = {
  K_side: 5.395, K_back: 4.17, backCondenserEfficiency: 0.7,
  k_RFront1: 0.3405, k_RFront2: 0.03322,
  k_FRPartition1: 0.1984, k_FRPartition2: 0.1219,
  k_FFront1: 0.3395, k_FFront2: 0.0344,
};

const fixedTemps = { T0: 25, TF: -18, TR: 3 };
const fan = { totalAirflow: 146.4, inputPower_W: 2.4 };
const electrical = { defrostHeater_W: 112, defrostOn_min: 0, pwbOn_W: 2, pwbOff_W: 1, timerPeriod_h: 10.5 };

// Excel converged point
const TC = 48.0, T2 = -19.5, PR = 0.77977, TE = -23.02;
const sideRise = PR * (condenserConfig.K_side/10) * (TC - fixedTemps.T0);
const backRise = PR * (condenserConfig.K_back/10) * (TC - fixedTemps.T0);
console.log(`Condenser rises: side=${sideRise.toFixed(2)} (Excel 2.84), back=${backRise.toFixed(2)} (Excel 2.20)`);

const heat = calcHeatLoads(
  geom, { ...fixedTemps, T2, TC, PR, TE },
  electrical, { side: sideRise, back: backRise }, fan.totalAirflow, geom, fan.inputPower_W
);
console.log(`QF = ${heat.QF.toFixed(2)} (Excel 45.44)`);
console.log(`QR = ${heat.QR.toFixed(2)} (Excel 14.39)`);
console.log(`QEV = ${heat.QEV.toFixed(2)} (Excel 9.86)`);

const comp = compressorState(TC, TE, 'R-600a', compParams, 10);
console.log(`ηv = ${comp.etaV.toFixed(3)} (Excel 0.789)`);
console.log(`Mass flow = ${comp.massFlow.toFixed(3)} (Excel 1.618)`);
console.log(`Cooling = ${comp.coolingCapacity.toFixed(2)} (Excel 89.36)`);
console.log(`Power = ${comp.inputPower.toFixed(2)} (Excel 104.27)`);