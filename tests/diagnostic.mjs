// tests/diagnostic.mjs
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

const PC = PHYSICAL_CONSTANTS;

// Exact Excel formulas
function lambdaUrethane(T_in, T_out) {
  return 0.0165 + 0.00011 * ((T_in + T_out)/2 - 25);
}
function kExterior(thk, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  return 1 / (1/6 + 1/10 + (thk/1000)/lam);
}
function kInterior(thk, T1, T2) {
  const lam = lambdaUrethane(T1, T2);
  return 1 / (1/10 + 1/10 + (thk/1000)/lam);
}

// SJ-540 geometry
const G = {
  H:1680, W:800, D:630, Hf:550, Hr:1130, Hb:260, Db1:210, Db2:230,
  doorGap:10, packingPos:15,
  tFtop:59.4, tFleft:59.4, tFright:59.4, tFbottom:70, tFdoor:59.4, tEvaBack:60,
  tRtop:70, tRleft:40, tRright:40, tRback:60, tRbottom1:40, tRbottom2:40, tRbottom3:40, tRdoor:40
};

// Excel converged point
const T0=30, TF=-18, TR=3, TC=40.91, T2=-21.25, PR=0.591;
const T_side = 33.47, T_back = 32.69;   // from Excel

// Areas (from Excel SIZE formulas)
const AFtop    = (G.W-(G.tFleft+G.tFright)/2)*(G.D-G.tEvaBack/2)/1e6;
const AFleft   = (G.D-G.tEvaBack/2)*(G.Hf-(G.tFtop+G.tFbottom)/2)/1e6;
const AFbottom = (G.D-G.tEvaBack/2)*(G.W-(G.tFleft+G.tFright)/2)/1e6;
const AFdoor   = (G.Hf-G.doorGap/2-2*G.packingPos)*(G.W-2*G.packingPos)/1e6;
const AFpackin = ((G.Hf-2*G.packingPos)+(G.W-2*G.packingPos))*2/1000;

const ARtop     = (G.W-(G.tRleft+G.tRright)/2)*(G.D-G.tRback/2)/1e6;
const ARleft    = ((G.Hr-(G.tRbottom1+G.tRbottom3)/2)*(G.D-G.tRback/2)-(G.Db1+G.Db2)*G.Hb/2)/1e6;
const ARback    = (G.Hr-(G.tRbottom1+G.tRbottom3)/2-G.Hb)*(G.W-(G.tRleft+G.tRright)/2)/1e6;
const ARbottom1 = (G.W-(G.tRleft+G.tRright)/2)*G.Db1/1e6;
const ARbottom2 = (G.W-(G.tRleft+G.tRright)/2)*Math.sqrt(G.Hb**2+(G.Db2-G.Db1)**2)/1e6;
const ARbottom3 = (G.W-(G.tRleft+G.tRright)/2)*G.Db2/1e6;
const ARdoor    = (G.Hr-G.doorGap/2-2*G.packingPos)*(G.W-2*G.packingPos)/1e6;
const ARpackin  = ((G.Hr-2*G.packingPos)+(G.W-2*G.packingPos))*2/1000;

const A_evaBack = (G.W-(G.tFleft+G.tFright)/2)*(G.Hf-(G.tFtop+G.tFbottom)/2)/1e6;

function printQ(label, Q, excelQ) {
  console.log(`${label}: ${Q.toFixed(2)} kcal/h (Excel ${excelQ})`);
}

console.log('=== Heat load breakdown at Excel converged point ===\n');

// Freezer
console.log('Freezer:');
let QF = 0;
const QFtop = kExterior(G.tFtop,TF,T0)*AFtop*(T0-TF);
QF += QFtop; printQ('  F TOP', QFtop, 4.86);
const QFleft = kExterior(G.tFleft,TF,T_side)*AFleft*(T_side-TF);
QF += QFleft; printQ('  F LEFT', QFleft, 3.46);
const QFright = kExterior(G.tFright,TF,T_side)*AFleft*(T_side-TF);
QF += QFright; printQ('  F RIGHT', QFright, 3.46);
const QFbottom = kInterior(G.tFbottom,TF,TR)*AFbottom*(TR-TF);
QF += QFbottom; printQ('  F BOTTOM', QFbottom, 1.66);
const QFdoor = kExterior(G.tFdoor,TF,T0)*AFdoor*(T0-TF);
QF += QFdoor; printQ('  F DOOR', QFdoor, 4.34);
const QFpackin = PC.insulation.packing*AFpackin*(T0-TF);
QF += QFpackin; printQ('  F PACKIN', QFpackin, 4.33);
const DPCON1 = (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR))*(G.W-G.tFleft-G.tFright)/1000;
QF += DPCON1; printQ('  F DPCON1', DPCON1, 3.90);
const DPCON2 = (0.0791*(TC-TF)-0.072*(T0-TF))*PR*(G.Hf*2+G.W)/1000;
QF += DPCON2; printQ('  F DPCON2', DPCON2, 1.35);
console.log(`  TOTAL QF = ${QF.toFixed(2)} (Excel 27.36)\n`);

// Refrigerator
console.log('Refrigerator:');
let QR = 0;
const QRtop = kInterior(G.tRtop,TF,TR)*ARtop*(TF-TR);
QR += QRtop; printQ('  R TOP', QRtop, -1.66);
const QRleft = kExterior(G.tRleft,TR,T_side)*ARleft*(T_side-TR);
QR += QRleft; printQ('  R LEFT', QRleft, 6.39);
const QRright = kExterior(G.tRright,TR,T_side)*ARleft*(T_side-TR);
QR += QRright; printQ('  R RIGHT', QRright, 6.39);
const QRback = kExterior(G.tRback,TR,T_back)*ARback*(T_back-TR);
QR += QRback; printQ('  R BACK', QRback, 7.06);
const QRbottom1 = kExterior(G.tRbottom1,TR,T_back)*ARbottom1*(T_back-TR);
QR += QRbottom1; printQ('  R BOTTOM1', QRbottom1, 2.64);
const QRbottom2 = kExterior(G.tRbottom2,TR,T_back)*ARbottom2*(T_back-TR);
QR += QRbottom2; printQ('  R BOTTOM2', QRbottom2, 3.28);
const QRbottom3 = kExterior(G.tRbottom3,TR,T0)*ARbottom3*(T0-TR);
QR += QRbottom3; printQ('  R BOTTOM3', QRbottom3, 1.66);
const QRdoor = kExterior(G.tRdoor,TR,T0)*ARdoor*(T0-TR);
QR += QRdoor; printQ('  R DOOR', QRdoor, 8.57);
const QRpackin = PC.insulation.packing*ARpackin*(T0-TR);
QR += QRpackin; printQ('  R PACKIN', QRpackin, 3.53);
const DPCON_R = (0.0546*(TC-TF)-0.0491*(T0-TF))*PR*(G.Hr*2+G.W)/1000;
QR += DPCON_R; printQ('  R DPCON', DPCON_R, 1.55);
console.log(`  TOTAL QR = ${QR.toFixed(2)} (Excel 39.41)\n`);

// Evaporator
console.log('Evaporator:');
const QEV_cond = kExterior(G.tEvaBack,T2,T_back)*A_evaBack*(T_back-T2);
const fanLoad = 2.1*0.86*PR;
const defLoad = 0;
const QEV = QEV_cond + fanLoad + defLoad;
printQ('  EVA BACK', QEV_cond, 4.37);
printQ('  FAN LOAD', fanLoad, 1.07);
printQ('  TOTAL QEV', QEV, 5.43);