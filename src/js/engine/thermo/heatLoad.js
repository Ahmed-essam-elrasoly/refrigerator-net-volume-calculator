// heatLoad.js – exact replica of Excel SIZE sheet (SJ-54H)
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

export const DEFAULT_GEOMETRY = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4,
  tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
};

function calcK(thickness_mm, lambda) {
  const thk_m = thickness_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + thk_m / lambda);
}

const kUrethaneCache = new Map();
function kUrethane(t_mm) {
  if (!kUrethaneCache.has(t_mm))
    kUrethaneCache.set(t_mm, calcK(t_mm, PC.insulation.urethane));
  return kUrethaneCache.get(t_mm);
}

export function calcHeatLoads(geom, temps, electrical, condenserRises, fanAirflow_m3h, evapParams, fanInputPower_W) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRbottom1, tRbottom2, tRbottom3, tRdoor,
  } = { ...DEFAULT_GEOMETRY, ...geom };

  const { T0, TF, TR, T2, TC, PR, TE } = temps;
  const T_side = T0 + condenserRises.side * PR;
  const T_back = T0 + condenserRises.back * PR;

  // ----- Freezer areas (Excel SIZE rows 7-12) -----
  // F TOP:    (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6
  const AFtop = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  // F LEFT:   (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6
  const AFleft = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const AFright = AFleft;
  // F BOTTOM: (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6
  const AFbottom = (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6;
  // F DOOR:   (Hf - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6
  const AFdoor = (Hf - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  // F PACKIN: ((Hf - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000
  const AFpackin = ((Hf - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  // Freezer base heat transfers (Excel F7-F11)
  let QF = kUrethane(tFtop)    * AFtop    * (T0 - TF)
         + kUrethane(tFleft)   * AFleft   * (T_side - TF)
         + kUrethane(tFright)  * AFright  * (T_side - TF)
         + kUrethane(tFbottom) * AFbottom * (TR - TF)
         + kUrethane(tFdoor)   * AFdoor   * (T0 - TF)
         + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses (Excel F13, F14)
  const DPCON1 = (0.1219 * (TC - TF) + 0.1219 * (((0.1984 * T0 + 0.1219 * TF) / (0.1984 + 0.1219)) - TF) * (1 - PR))
               * (W - tFleft - tFright) / 1000;
  const DPCON2 = (0.0791 * (TC - TF) - 0.072 * (T0 - TF)) * PR * (Hf * 2 + W) / 1000;
  QF += DPCON1 + DPCON2;

  // ----- Refrigerator areas (Excel SIZE rows 15-23) -----
  // R TOP: (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6
  const ARtop = (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6;
  // R LEFT: ((Hr - (tRtop + tRbottom1)/2) * (D - tRback/2) - (Db1 + Db2) * Hb / 2) / 1e6
  const ARleftBase = (Hr - (tRtop + tRbottom1)/2) * (D - tRback/2) - (Db1 + Db2) * Hb / 2;
  const ARleft = ARleftBase / 1e6;
  const ARright = ARleft;
  // R BACK: (Hr - (tRtop + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6
  const ARback = (Hr - (tRtop + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6;
  // R BOTTOM1: (W - (tRleft + tRright)/2) * Db1 / 1e6
  const ARbottom1 = (W - (tRleft + tRright)/2) * Db1 / 1e6;
  // R BOTTOM2: (W - (tRleft + tRright)/2) * sqrt(Hb^2 + (Db2-Db1)^2) / 1e6
  const ARbottom2 = (W - (tRleft + tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
  // R BOTTOM3: (W - (tRleft + tRright)/2) * Db2 / 1e6
  const ARbottom3 = (W - (tRleft + tRright)/2) * Db2 / 1e6;
  // R DOOR: (Hr - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6
  const ARdoor = (Hr - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  // R PACKIN: ((Hr - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000
  const ARpackin = ((Hr - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  let QR = kUrethane(tRtop)      * ARtop      * (TF - TR)
         + kUrethane(tRleft)     * ARleft     * (T_side - TR)
         + kUrethane(tRright)    * ARright    * (T_side - TR)
         + kUrethane(tRback)     * ARback     * (T_back - TR)
         + kUrethane(tRbottom1)  * ARbottom1  * (T_back  - TR)
         + kUrethane(tRbottom2)  * ARbottom2  * (T_back  - TR)
         + kUrethane(tRbottom3)  * ARbottom3  * (T0 - TR)
         + kUrethane(tRdoor)     * ARdoor     * (T0 - TR)
         + PC.insulation.packing * ARpackin   * (T0 - TR);

  const DPCON_R = (0.0546 * (TC - TF) - 0.0491 * (T0 - TF)) * PR * (Hr * 2 + W) / 1000;
  QR += DPCON_R;

  // ----- Evaporator: conduction only (fan/defrost added to QF in Excel? Actually they are separate) -----
  const A_evaBack = (W - (tFleft + tFright)/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const QEV_conduction = kUrethane(tEvaBack) * A_evaBack * (T_back - T2);
  const fanLoad = (fanInputPower_W ?? electrical.pwbOn_W) * PC.conversion.wattToKcalPerH * PR;
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60 / 24) * PC.conversion.wattToKcalPerH;
  // In Excel, QEV = conduction + fanLoad + defrostLoad
  const QEV = QEV_conduction + fanLoad + defrostLoad;
  // Fan and defrost are also added to QF? No, in Excel they are part of QEV, not QF.

  return { QF, QR, QEV, fanLoad, defrostLoad };
}