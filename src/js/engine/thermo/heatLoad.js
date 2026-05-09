import { PHYSICAL_CONSTANTS as PC } from './constants.js';

export const DEFAULT_GEOMETRY = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4,
  tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  packingPos: 15,
};

function calcK(thickness, lambda) {
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + thickness/1000/lambda);
}

function kUrethane(t) { return calcK(t, PC.insulation.urethane); }

/**
 * @param {object} geom
 * @param {object} temps - { T0, TF, TR, T2, TC, PR }
 * @param {object} electrical - { defrostHeater_W, defrostOn_min, pwbOn_W, pwbOff_W, timerPeriod_h }
 * @returns {{ QF, QR, QEV, fanLoad, defrostLoad }}
 */
export function calcHeatLoads(geom, temps, electrical) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRbottom1, tRbottom2, tRbottom3, tRdoor,
    packingPos
  } = geom;
  const { T0, TF, TR, T2, TC, PR } = temps;

  // Freezer areas
  const AFtop = (W - (tFleft+tFright)/2) * (D - tEvaBack/2) / 1e6;
  const AFleft = (D - tEvaBack/2) * (Hf - (tFtop+tFbottom)/2) / 1e6;
  const AFright = AFleft;
  const AFbottom = (D - tEvaBack/2) * (W - (tFleft+tFright)/2) / 1e6;
  const AFdoor = ((Hf - tFbottom - packingPos*2) * (W - packingPos*2)) / 1e6;
  const AFpackin = ((Hf - packingPos*2) + (W - packingPos*2)) * 2 / 1000;

  // Freezer base heat transfers
  let QF = kUrethane(tFtop) * AFtop * (T0 - TF)
         + kUrethane(tFleft) * AFleft * (T0 - TF)
         + kUrethane(tFright) * AFright * (T0 - TF)
         + kUrethane(tFbottom) * AFbottom * (T0 - TF)
         + kUrethane(tFdoor) * AFdoor * (T0 - TF)
         + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses (from DP CON in MAIN)
  const DPCON1 = (0.1219*(TC - TF) + 0.1219*((0.1984*T0 + 0.1219*TF)/(0.1984+0.1219) - TF)*(1-PR)) * (W - tFleft - tFright) / 1000;
  const DPCON2 = (0.0791*(TC - TF) - 0.072*(T0 - TF)) * PR * (Hf*2 + W) / 1000;
  QF += DPCON1 + DPCON2;

  // Refrigerator areas
  const ARtop = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
  const ARleftBase = ((Hr - (tRtop+tRbottom1)/2) * (D - tRback/2) - (Db1+Db2)*Hb/2);
  const ARleft = ARleftBase / 1e6;
  const ARright = ARleft;
  const ARback = (Hr - (tRtop+tRbottom1)/2 - Hb) * (W - (tRleft+tRright)/2) / 1e6;
  const ARbottom1 = (W - (tRleft+tRright)/2) * Db1 / 1e6;
  const ARbottom2 = (W - (tRleft+tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)*(Db2-Db1)) / 1e6;
  const ARbottom3 = (W - (tRleft+tRright)/2) * Db2 / 1e6;
  const ARdoor = ((Hr - tRbottom3 - packingPos*2) * (W - packingPos*2)) / 1e6;
  const ARpackin = ((Hr - packingPos*2) + (W - packingPos*2)) * 2 / 1000;

  let QR = kUrethane(tRtop) * ARtop * (T0 - TR)
         + kUrethane(tRleft) * ARleft * (T0 - TR)
         + kUrethane(tRright) * ARright * (T0 - TR)
         + kUrethane(tRback) * ARback * ((T0 - TR)*PR + (T0 - TF)*(1-PR))
         + kUrethane(tRbottom1) * ARbottom1 * (T0 - TR)
         + kUrethane(tRbottom2) * ARbottom2 * (T0 - TR)
         + kUrethane(tRbottom3) * ARbottom3 * (T0 - TR)
         + kUrethane(tRdoor) * ARdoor * (T0 - TR)
         + PC.insulation.packing * ARpackin * (T0 - TR);

  const DPCON_R = (0.0546*(TC - TF) - 0.0491*(T0 - TF)) * PR * (Hr*2 + W) / 1000;
  QR += DPCON_R;

  // Evaporator back
  const A_evaBack = (W - (tFleft+tFright)/2) * (Hf - (tFtop+tFbottom)/2) / 1e6;
  const QEV = kUrethane(tEvaBack) * A_evaBack * (T2 - TR);

  // Fan / defrost loads (constant)
  const fanLoad = electrical.pwbOn_W * PC.conversion.wattToKcalPerH;   // permanent ON
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60 / 24) * PC.conversion.wattToKcalPerH;

  return { QF: QF + fanLoad + defrostLoad, QR, QEV, fanLoad, defrostLoad };
}