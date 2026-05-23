// tests/diagnostic_full.mjs – complete term‑by‑term comparison, SJ‑540 & PV73K
import { writeFileSync } from 'fs';
import { PHYSICAL_CONSTANTS as PC } from '../src/js/engine/thermo/constants.js';

// ── Urethane conductivity and K‑value functions (same as heatLoad.js) ──
function lambdaUrethane(T_in, T_out) {
  return 0.0165 + 0.00011 * (T_in + T_out) / 2;
}
function kExterior(thk, T_in, T_out) {
  //const lam = lambdaUrethane(T_in, T_out);
  return 1/(1/PC.surfaceCoefficients.outside+1/PC.surfaceCoefficients.inside+thk/1000/((0.0165-0.00011*25)+0.00011*(T_in+T_out)/2));
}
function kInterior(thk, T1, T2) {
  //const lam = lambdaUrethane(T1, T2);
  return 1/(1/PC.surfaceCoefficients.inside+1/PC.surfaceCoefficients.inside+thk/1000/((0.0165-0.00011*25)+0.00011*(T1+T2)/2));
}

// ── SJ‑540 (top‑freezer) ──
const geom54 = {
  H: 1680, W: 800, D: 630, Hf: 550, Hr: 1130, Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40, tRfloor: 70,
};
const op54 = { T0: 30, TF: -18, TR: 3, T2: -21.25, TC: 40.91, PR: 0.591, TE: -23.3 };
const fan54 = { totalAirflow: 59.5, inputPower_W: 2.1 };
// Excel wall temperatures for SJ‑540
const wt54 = { T_side: 33.47, T_back: 32.69, T_wallBack_comp: 36.44, T_comp: 59.53 };

const excel54 = {
  freezer: {
    top: 4.86, left: 3.46, right: 3.46, bottom: 1.66, door: 4.34, packin: 4.33,
    dpcon1: 3.90, dpcon2: 1.35,
  },
  refrigerator: {
    top: -1.66, left: 6.39, right: 6.39, back: 7.06,
    bottom1: 2.64, bottom2: 3.28, bottom3: 1.66, door: 8.57, packin: 3.53,
    dpcon: 1.55,
  },
  evaporator: { back: 4.37, fan: 1.07 },
};

// ── PV73K (bottom‑freezer) ──
const geom73 = {
  H: 1794, W: 795, D: 687, Hf: 746, Hr: 1048, Hb: 248, Db1: 195, Db2: 261,
  doorGap: 10, packingPos: 15,
  tFtop: 32, tFleft: 82, tFright: 82, tFbottom: 76, tFdoor: 80, tFback: 55, tEvaBack: 55,
  tFfloor1: 76, tFfloor2: 80, tFfloor3: 82,
  tRtop: 55, tRleft: 57, tRright: 57, tRback: 80, tRdoor: 58,
  tRbottom1: 32, tRbottom2: 32, tRbottom3: 32, tRfloor: 32,
};
const op73 = { T0: 25, TF: -18, TR: 3, T2: -19.5, TC: 48.0, PR: 0.77977, TE: -23.02 };
const fan73 = { totalAirflow: 146.4, inputPower_W: 2.4 };
// Excel wall temperatures for PV73K
const wt73 = { T_side: 27.22, T_back: 26.71, T_wallBack_comp: 42.93, T_comp: 63.99 };

const excel73 = {
  refrigerator: {
    top: 2.7188, left: 3.9693, right: 3.9693, bottom: -3.7473, back: 3.2156,
    door: 4.1992, packin: 2.7458, dpcon1: 4.7592, dpcon2: 4.7895,
  },
  freezer: {
    top: 3.6903, left: 3.0040, right: 3.0040,
    bottom1: 1.6007, bottom2: 2.0064, bottom3: 2.1524,
    door: 3.9465, packin: 4.4578, dpcon: 2.6613,
  },
  evaporator: { back: 4.8063, fan: 1.6095 },
};

// ── Top‑freezer diagnostic ──
function diagTopFreezer(geom, op, fan, wt, excel) {
  const { T0, TF, TR, T2, TC, PR } = op;
  const T_side = wt.T_side, T_back = wt.T_back, T_wallBack_comp = wt.T_wallBack_comp;
  let out = '';
  const W = geom.W, D = geom.D, Hf = geom.Hf, Hr = geom.Hr;
  const { tFtop, tFleft, tFright, tFbottom, tFdoor, tEvaBack } = geom;
  const { tRtop, tRleft, tRright, tRback, tRbottom1, tRbottom2, tRbottom3, tRdoor } = geom;
  const Hb = geom.Hb, Db1 = geom.Db1, Db2 = geom.Db2;

  // ── Freezer ──
  out += '--- Freezer ---\n';
  const AFtop = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  const K_Ftop = kExterior(tFtop, TF, T0);
  const Q_Ftop = K_Ftop * AFtop * (T0 - TF);
  out += `F TOP       S=${AFtop.toFixed(4)}  B=${(K_Ftop*AFtop).toFixed(4)}  K=${K_Ftop.toFixed(4)}  Ti=${TF} To=${T0}  Q=${Q_Ftop.toFixed(4)}  (Excel ${excel.freezer.top})\n`;

  const AFleft = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const K_Fleft = kExterior(tFleft, TF, T_side);
  const Q_Fleft = K_Fleft * AFleft * (T_side - TF);
  const Q_Fright = Q_Fleft;
  out += `F LEFT      S=${AFleft.toFixed(4)}  B=${(K_Fleft*AFleft).toFixed(4)}  K=${K_Fleft.toFixed(4)}  Ti=${TF} To=${T_side.toFixed(2)}  Q=${Q_Fleft.toFixed(4)}  (Excel ${excel.freezer.left})\n`;
  out += `F RIGHT     S=${AFleft.toFixed(4)}  B=${(K_Fleft*AFleft).toFixed(4)}  K=${K_Fleft.toFixed(4)}  Ti=${TF} To=${T_side.toFixed(2)}  Q=${Q_Fright.toFixed(4)}  (Excel ${excel.freezer.right})\n`;

  const AFbottom = (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6;
  const K_Fbottom = kInterior(tFbottom, TF, TR);
  const Q_Fbottom = K_Fbottom * AFbottom * (TR - TF);
  out += `F BOTTOM    S=${AFbottom.toFixed(4)}  B=${(K_Fbottom*AFbottom).toFixed(4)}  K=${K_Fbottom.toFixed(4)}  Ti=${TF} To=${TR}  Q=${Q_Fbottom.toFixed(4)}  (Excel ${excel.freezer.bottom})\n`;

  const AFdoor = (Hf - geom.doorGap/2 - 2*geom.packingPos) * (W - 2*geom.packingPos) / 1e6;
  const K_Fdoor = kExterior(tFdoor, TF, T0);
  const Q_Fdoor = K_Fdoor * AFdoor * (T0 - TF);
  out += `F DOOR      S=${AFdoor.toFixed(4)}  B=${(K_Fdoor*AFdoor).toFixed(4)}  K=${K_Fdoor.toFixed(4)}  Ti=${TF} To=${T0}  Q=${Q_Fdoor.toFixed(4)}  (Excel ${excel.freezer.door})\n`;

  const AFpackin = ((Hf - 2*geom.packingPos) + (W - 2*geom.packingPos)) * 2 / 1000;
  const Q_Fpackin = PC.insulation.packing * AFpackin * (T0 - TF);
  out += `F PACKIN    S=${AFpackin.toFixed(4)}  B=${(PC.insulation.packing*AFpackin).toFixed(4)}  K=${PC.insulation.packing.toFixed(4)}  Ti=${TF} To=${T0}  Q=${Q_Fpackin.toFixed(4)}  (Excel ${excel.freezer.packin})\n`;

  const DPCON1 = (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR)) * (W - tFleft - tFright) / 1000;
  const DPCON2 = (0.0791*(TC-TF) - 0.072*(T0-TF)) * PR * (Hf*2 + W) / 1000;
  out += `F DPCON1    Q=${DPCON1.toFixed(4)}  (Excel ${excel.freezer.dpcon1})\n`;
  out += `F DPCON2    Q=${DPCON2.toFixed(4)}  (Excel ${excel.freezer.dpcon2})\n`;

  const QF = Q_Ftop + Q_Fleft + Q_Fright + Q_Fbottom + Q_Fdoor + Q_Fpackin + DPCON1 + DPCON2;
  out += `TOTAL QF = ${QF.toFixed(4)}  (Excel ${Object.values(excel.freezer).reduce((a,b)=>a+b,0).toFixed(4)})\n\n`;

  // ── Refrigerator ──
  out += '--- Refrigerator ---\n';
  const ARtop = (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6;
  const K_Rtop = kInterior(tRtop, TF, TR);
  const Q_Rtop = K_Rtop * ARtop * (TF - TR);
  out += `R TOP       S=${ARtop.toFixed(4)}  B=${(K_Rtop*ARtop).toFixed(4)}  K=${K_Rtop.toFixed(4)}  Ti=${TR} To=${TF}  Q=${Q_Rtop.toFixed(4)}  (Excel ${excel.refrigerator.top})\n`;

  const rSideHeight = Hr - (tRtop + tRbottom1)/2;
  const ARleft = (rSideHeight * (D - tRback/2) - (Db1 + Db2) * Hb / 2) / 1e6;
  const K_Rleft = kExterior(tRleft, TR, T_side);
  const Q_Rleft = K_Rleft * ARleft * (T_side - TR);
  const Q_Rright = Q_Rleft;
  out += `R LEFT      S=${ARleft.toFixed(4)}  B=${(K_Rleft*ARleft).toFixed(4)}  K=${K_Rleft.toFixed(4)}  Ti=${TR} To=${T_side.toFixed(2)}  Q=${Q_Rleft.toFixed(4)}  (Excel ${excel.refrigerator.left})\n`;
  out += `R RIGHT     S=${ARleft.toFixed(4)}  B=${(K_Rleft*ARleft).toFixed(4)}  K=${K_Rleft.toFixed(4)}  Ti=${TR} To=${T_side.toFixed(2)}  Q=${Q_Rright.toFixed(4)}  (Excel ${excel.refrigerator.right})\n`;

  const ARback = (Hr - (tRtop + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6;
  const K_Rback = kExterior(tRback, TR, T_wallBack_comp);
  const Q_Rback = K_Rback * ARback * (T_wallBack_comp - TR);
  out += `R BACK      S=${ARback.toFixed(4)}  B=${(K_Rback*ARback).toFixed(4)}  K=${K_Rback.toFixed(4)}  Ti=${TR} To=${T_wallBack_comp.toFixed(2)}  Q=${Q_Rback.toFixed(4)}  (Excel ${excel.refrigerator.back})\n`;

  const ARb1 = (W - (tRleft + tRright)/2) * Db1 / 1e6;
  const K_Rb1 = kExterior(tRbottom1, TR, T_wallBack_comp);
  const Q_Rb1 = K_Rb1 * ARb1 * (T_wallBack_comp - TR);
  out += `R BOTTOM1   S=${ARb1.toFixed(4)}  B=${(K_Rb1*ARb1).toFixed(4)}  K=${K_Rb1.toFixed(4)}  Ti=${TR} To=${T_wallBack_comp.toFixed(2)}  Q=${Q_Rb1.toFixed(4)}  (Excel ${excel.refrigerator.bottom1})\n`;

  const ARb2 = (W - (tRleft + tRright)/2) * Math.sqrt(Hb*Hb + (Db2 - Db1)**2) / 1e6;
  const K_Rb2 = kExterior(tRbottom2, TR, T_wallBack_comp);
  const Q_Rb2 = K_Rb2 * ARb2 * (T_wallBack_comp - TR);
  out += `R BOTTOM2   S=${ARb2.toFixed(4)}  B=${(K_Rb2*ARb2).toFixed(4)}  K=${K_Rb2.toFixed(4)}  Ti=${TR} To=${T_wallBack_comp.toFixed(2)}  Q=${Q_Rb2.toFixed(4)}  (Excel ${excel.refrigerator.bottom2})\n`;

  const ARb3 = (W - (tRleft + tRright)/2) * Db2 / 1e6;
  const K_Rb3 = kExterior(tRbottom3, TR, T0);
  const Q_Rb3 = K_Rb3 * ARb3 * (T0 - TR);
  out += `R BOTTOM3   S=${ARb3.toFixed(4)}  B=${(K_Rb3*ARb3).toFixed(4)}  K=${K_Rb3.toFixed(4)}  Ti=${TR} To=${T0}  Q=${Q_Rb3.toFixed(4)}  (Excel ${excel.refrigerator.bottom3})\n`;

  const ARdoor = (Hr - geom.doorGap/2 - 2*geom.packingPos) * (W - 2*geom.packingPos) / 1e6;
  const K_Rdoor = kExterior(tRdoor, TR, T0);
  const Q_Rdoor = K_Rdoor * ARdoor * (T0 - TR);
  out += `R DOOR      S=${ARdoor.toFixed(4)}  B=${(K_Rdoor*ARdoor).toFixed(4)}  K=${K_Rdoor.toFixed(4)}  Ti=${TR} To=${T0}  Q=${Q_Rdoor.toFixed(4)}  (Excel ${excel.refrigerator.door})\n`;

  const ARpackin = ((Hr - 2*geom.packingPos) + (W - 2*geom.packingPos)) * 2 / 1000;
  const Q_Rpackin = PC.insulation.packing * ARpackin * (T0 - TR);
  out += `R PACKIN    S=${ARpackin.toFixed(4)}  B=${(PC.insulation.packing*ARpackin).toFixed(4)}  K=${PC.insulation.packing.toFixed(4)}  Ti=${TR} To=${T0}  Q=${Q_Rpackin.toFixed(4)}  (Excel ${excel.refrigerator.packin})\n`;

  const DPCON_R = (0.0546*(TC-TF) - 0.0491*(T0-TF)) * PR * (Hr*2 + W) / 1000;
  out += `R DPCON     Q=${DPCON_R.toFixed(4)}  (Excel ${excel.refrigerator.dpcon})\n`;

  const QR = Q_Rtop + Q_Rleft + Q_Rright + Q_Rback + Q_Rb1 + Q_Rb2 + Q_Rb3 + Q_Rdoor + Q_Rpackin + DPCON_R;
  out += `TOTAL QR = ${QR.toFixed(4)}  (Excel ${Object.values(excel.refrigerator).reduce((a,b)=>a+b,0).toFixed(4)})\n\n`;

  // ── Evaporator ──
  out += '--- Evaporator ---\n';
  const A_evaBack = (W - (tFleft + tFright)/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const K_evaBack = kExterior(geom.tEvaBack, T2, T_back);
  const Q_evaBack = K_evaBack * A_evaBack * (T_back - T2);
  const fanLoad = fan.inputPower_W * PC.conversion.wattToKcalPerH * PR;
  out += `EVA BACK    S=${A_evaBack.toFixed(4)}  B=${(K_evaBack*A_evaBack).toFixed(4)}  K=${K_evaBack.toFixed(4)}  Ti=${T2} To=${T_back.toFixed(2)}  Q=${Q_evaBack.toFixed(4)}  (Excel ${excel.evaporator.back})\n`;
  out += `FAN LOAD    Q=${fanLoad.toFixed(4)}  (Excel ${excel.evaporator.fan})\n`;

  return out;
}

// ── Bottom‑freezer diagnostic ──
function diagBottomFreezer(geom, op, fan, wt, excel) {
  const { T0, TF, TR, T2, TC, PR } = op;
  const T_side = wt.T_side, T_back = wt.T_back, T_comp = wt.T_comp, T_wallBack_comp = wt.T_wallBack_comp;
  let out = '';
  const W = geom.W, D = geom.D, Hf = geom.Hf, Hr = geom.Hr, Hb = geom.Hb, Db1 = geom.Db1, Db2 = geom.Db2;
  const { tRtop, tRleft, tRright, tRback, tRdoor, tRfloor } = geom;
  const { tFtop, tFleft, tFright, tFdoor, tFfloor1, tFfloor2, tFfloor3, tEvaBack } = geom;

  // ── Refrigerator (top) ──
  out += '--- Refrigerator (top) ---\n';
  const ARtop = (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6;
  const K_Rtop = kExterior(tRtop, TR, T0);
  const Q_Rtop = K_Rtop * ARtop * (T0 - TR);
  out += `R TOP       S=${ARtop.toFixed(4)}  B=${(K_Rtop*ARtop).toFixed(4)}  K=${K_Rtop.toFixed(4)}  Ti=${TR} To=${T0}  Q=${Q_Rtop.toFixed(4)}  (Excel ${excel.refrigerator.top})\n`;

  const rSideHeight = Hr - (tRtop + tRfloor)/2;
  const ARleft = (rSideHeight * (D - tRback/2)) / 1e6;
  const K_Rleft = kExterior(tRleft, TR, T_side);
  const Q_Rleft = K_Rleft * ARleft * (T_side - TR);
  const Q_Rright = Q_Rleft;
  out += `R LEFT      S=${ARleft.toFixed(4)}  B=${(K_Rleft*ARleft).toFixed(4)}  K=${K_Rleft.toFixed(4)}  Ti=${TR} To=${T_side.toFixed(2)}  Q=${Q_Rleft.toFixed(4)}  (Excel ${excel.refrigerator.left})\n`;
  out += `R RIGHT     S=${ARleft.toFixed(4)}  B=${(K_Rleft*ARleft).toFixed(4)}  K=${K_Rleft.toFixed(4)}  Ti=${TR} To=${T_side.toFixed(2)}  Q=${Q_Rright.toFixed(4)}  (Excel ${excel.refrigerator.right})\n`;

  const ARbottom = (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6;
  const K_Rbottom = kInterior(tRfloor, TF, TR);
  const Q_Rbottom = K_Rbottom * ARbottom * (TF - TR);
  out += `R BOTTOM    S=${ARbottom.toFixed(4)}  B=${(K_Rbottom*ARbottom).toFixed(4)}  K=${K_Rbottom.toFixed(4)}  Ti=${TR} To=${TF}  Q=${Q_Rbottom.toFixed(4)}  (Excel ${excel.refrigerator.bottom})\n`;

  const ARback = (Hr - (tRtop + tRfloor)/2) * (W - (tRleft + tRright)/2) / 1e6;
  const K_Rback = kExterior(tRback, TR, T_back);
  const Q_Rback = K_Rback * ARback * (T_back - TR);
  out += `R BACK      S=${ARback.toFixed(4)}  B=${(K_Rback*ARback).toFixed(4)}  K=${K_Rback.toFixed(4)}  Ti=${TR} To=${T_back.toFixed(2)}  Q=${Q_Rback.toFixed(4)}  (Excel ${excel.refrigerator.back})\n`;

  const ARdoor = (Hr - geom.doorGap/2 - 2*geom.packingPos) * (W - 2*geom.packingPos) / 1e6;
  const K_Rdoor = kExterior(tRdoor, TR, T0);
  const Q_Rdoor = K_Rdoor * ARdoor * (T0 - TR);
  out += `R DOOR      S=${ARdoor.toFixed(4)}  B=${(K_Rdoor*ARdoor).toFixed(4)}  K=${K_Rdoor.toFixed(4)}  Ti=${TR} To=${T0}  Q=${Q_Rdoor.toFixed(4)}  (Excel ${excel.refrigerator.door})\n`;

  const ARpackin = ((Hr - 2*geom.packingPos) + (W - 2*geom.packingPos)) * 2 / 1000;
  const Q_Rpackin = PC.insulation.packing * ARpackin * (T0 - TR);
  out += `R PACKIN    S=${ARpackin.toFixed(4)}  B=${(PC.insulation.packing*ARpackin).toFixed(4)}  K=${PC.insulation.packing.toFixed(4)}  Ti=${TR} To=${T0}  Q=${Q_Rpackin.toFixed(4)}  (Excel ${excel.refrigerator.packin})\n`;

  const DPCON1_R = (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR)) * (W - tRleft - tRright) / 1000;
  const DPCON2_R = (0.0791*(TC-TF) - 0.072*(T0-TF)) * PR * (Hr*2 + W) / 1000;
  out += `R DPCON1    Q=${DPCON1_R.toFixed(4)}  (Excel ${excel.refrigerator.dpcon1})\n`;
  out += `R DPCON2    Q=${DPCON2_R.toFixed(4)}  (Excel ${excel.refrigerator.dpcon2})\n`;

  const QR = Q_Rtop + Q_Rleft + Q_Rright + Q_Rbottom + Q_Rback + Q_Rdoor + Q_Rpackin + DPCON1_R + DPCON2_R;
  out += `TOTAL QR = ${QR.toFixed(4)}  (Excel ${Object.values(excel.refrigerator).reduce((a,b)=>a+b,0).toFixed(4)})\n\n`;

  // ── Freezer (bottom) ──
  out += '--- Freezer (bottom) ---\n';
  const AFtop = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  const K_Ftop = kInterior(tFtop, TF, TR);
  const Q_Ftop = K_Ftop * AFtop * (TR - TF);
  out += `F TOP       S=${AFtop.toFixed(4)}  B=${(K_Ftop*AFtop).toFixed(4)}  K=${K_Ftop.toFixed(4)}  Ti=${TF} To=${TR}  Q=${Q_Ftop.toFixed(4)}  (Excel ${excel.freezer.top})\n`;

  const fSideHeight = Hf - (tFtop + tFfloor1)/2;
  const AFleft = (fSideHeight * (D - tEvaBack/2) - (Db1 + Db2) * Hb / 2) / 1e6;
  const K_Fleft = kExterior(tFleft, TF, T_side);
  const Q_Fleft = K_Fleft * AFleft * (T_side - TF);
  const Q_Fright = Q_Fleft;
  out += `F LEFT      S=${AFleft.toFixed(4)}  B=${(K_Fleft*AFleft).toFixed(4)}  K=${K_Fleft.toFixed(4)}  Ti=${TF} To=${T_side.toFixed(2)}  Q=${Q_Fleft.toFixed(4)}  (Excel ${excel.freezer.left})\n`;
  out += `F RIGHT     S=${AFleft.toFixed(4)}  B=${(K_Fleft*AFleft).toFixed(4)}  K=${K_Fleft.toFixed(4)}  Ti=${TF} To=${T_side.toFixed(2)}  Q=${Q_Fright.toFixed(4)}  (Excel ${excel.freezer.right})\n`;

  const AFbottom1 = (W - (tFleft + tFright)/2) * Db1 / 1e6;
  const K_Fb1 = kExterior(tFfloor1, TF, T_wallBack_comp);
  const Q_Fb1 = K_Fb1 * AFbottom1 * (T_wallBack_comp - TF);
  out += `F BOTTOM1   S=${AFbottom1.toFixed(4)}  B=${(K_Fb1*AFbottom1).toFixed(4)}  K=${K_Fb1.toFixed(4)}  Ti=${TF} To=${T_wallBack_comp.toFixed(2)}  Q=${Q_Fb1.toFixed(4)}  (Excel ${excel.freezer.bottom1})\n`;

  const AFbottom2 = (W - (tFleft + tFright)/2) * Math.sqrt(Hb*Hb + (Db2 - Db1)**2) / 1e6;
  const K_Fb2 = kExterior(tFfloor2, TF, T_wallBack_comp);
  const Q_Fb2 = K_Fb2 * AFbottom2 * (T_wallBack_comp - TF);
  out += `F BOTTOM2   S=${AFbottom2.toFixed(4)}  B=${(K_Fb2*AFbottom2).toFixed(4)}  K=${K_Fb2.toFixed(4)}  Ti=${TF} To=${T_wallBack_comp.toFixed(2)}  Q=${Q_Fb2.toFixed(4)}  (Excel ${excel.freezer.bottom2})\n`;

  const AFbottom3 = (W - (tFleft + tFright)/2) * (D-Db2)/ 1e6;
  const K_Fb3 = kExterior(tFfloor3, TF, T0);
  const Q_Fb3 = K_Fb3 * AFbottom3 * (T0 - TF);
  out += `F BOTTOM3   S=${AFbottom3.toFixed(4)}  B=${(K_Fb3*AFbottom3).toFixed(4)}  K=${K_Fb3.toFixed(4)}  Ti=${TF} To=${T0}  Q=${Q_Fb3.toFixed(4)}  (Excel ${excel.freezer.bottom3})\n`;

  const AFdoor = (Hf - geom.doorGap/2 - 2*geom.packingPos) * (W - 2*geom.packingPos) / 1e6;
  const K_Fdoor = kExterior(tFdoor, TF, T0);
  const Q_Fdoor = K_Fdoor * AFdoor * (T0 - TF);
  out += `F DOOR      S=${AFdoor.toFixed(4)}  B=${(K_Fdoor*AFdoor).toFixed(4)}  K=${K_Fdoor.toFixed(4)}  Ti=${TF} To=${T0}  Q=${Q_Fdoor.toFixed(4)}  (Excel ${excel.freezer.door})\n`;

  const AFpackinF = ((Hf - 2*geom.packingPos) + (W - 2*geom.packingPos)) * 2 / 1000;
  const Q_Fpackin = PC.insulation.packing * AFpackinF * (T0 - TF);
  out += `F PACKIN    S=${AFpackinF.toFixed(4)}  B=${(PC.insulation.packing*AFpackinF).toFixed(4)}  K=${PC.insulation.packing.toFixed(4)}  Ti=${TF} To=${T0}  Q=${Q_Fpackin.toFixed(4)}  (Excel ${excel.freezer.packin})\n`;

  const DPCON_F = (0.0546*(TC-TF) - 0.0491*(T0-TF)) * PR * (Hf*2 + W) / 1000;
  out += `F DPCON     Q=${DPCON_F.toFixed(4)}  (Excel ${excel.freezer.dpcon})\n`;

  const QF = Q_Ftop + Q_Fleft + Q_Fright + Q_Fb1 + Q_Fb2 + Q_Fb3 + Q_Fdoor + Q_Fpackin + DPCON_F;
  out += `TOTAL QF = ${QF.toFixed(4)}  (Excel ${Object.values(excel.freezer).reduce((a,b)=>a+b,0).toFixed(4)})\n\n`;

  // ── Evaporator ──
  out += '--- Evaporator ---\n';
  const A_evaBack = (W - (tFleft + tFright)/2) * (Hf - Hb - (tFtop + tFfloor1)/2) / 1e6;
  const K_evaBack = kExterior(tEvaBack, T2, T_back);
  const Q_evaBack = K_evaBack * A_evaBack * (T_back - T2);
  const fanLoad = fan.inputPower_W * PC.conversion.wattToKcalPerH * PR;
  out += `EVA BACK    S=${A_evaBack.toFixed(4)}  B=${(K_evaBack*A_evaBack).toFixed(4)}  K=${K_evaBack.toFixed(4)}  Ti=${T2} To=${T_back.toFixed(2)}  Q=${Q_evaBack.toFixed(4)}  (Excel ${excel.evaporator.back})\n`;
  out += `FAN LOAD    Q=${fanLoad.toFixed(4)}  (Excel ${excel.evaporator.fan})\n`;

  return out;
}

// ── Main ──
const out = [];
out.push('============ SJ‑540 Top‑Freezer ============');
out.push(diagTopFreezer(geom54, op54, fan54, wt54, excel54));
out.push('============ PV73K Bottom‑Freezer ============');
out.push(diagBottomFreezer(geom73, op73, fan73, wt73, excel73));

writeFileSync('diagnostic_comparison.txt', out.join('\n'));
console.log('✅ Diagnostic written to diagnostic_comparison.txt');