import { calcHeatLoads } from '../src/js/engine/thermo/heatLoad.js';

const geom = {
  H: 1794, W: 795, D: 687,
  Hf: 746, Hr: 1048, Hb: 248, Db1: 195, Db2: 261, doorGap: 10, packingPos: 15,
  // Freezer (bottom)
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76, // tFbottom not used in bottom-freezer
  tFdoor: 80, tFback: 55, tEvaBack: 55,
  tFfloor1: 76, tFfloor2: 80, tFfloor3: 82,
  // Refrigerator (top)
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80, tRdoor: 58,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32,  // not used in bottom-freezer
  tRfloor: 32,  // refrigerator partition thickness
};

const temps = { T0: 25, TF: -18, TR: 3, T2: -19.5, TC: 48, PR: 0.77977, TE: -23.02 };
const electrical = { defrostHeater_W: 112, defrostOn_min: 0 };
const fan = { totalAirflow: 146.4, inputPower_W: 2.4 };

const loads = calcHeatLoads(geom, temps, electrical, { side: 2.22, back: 1.71 }, fan.totalAirflow, geom, fan.inputPower_W, 'bottom');

console.log('QF =', loads.QF.toFixed(4), '  (Excel: 25.4143)');
console.log('QR =', loads.QR.toFixed(4), '  (Excel: 26.6194)');
console.log('QEV =', loads.QEV.toFixed(4), ' (Excel: 9.8557)');