// heatLoad.js – universal top- / bottom-freezer heat load model (physically correct)
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

function lambdaUrethane(T_in, T_out) {
  const T_avg = (T_in + T_out) / 2;
  return 0.0165 + 0.00011 * (T_avg-25);   // Excel formula, shifted to be 0.0165 at 25°C
}
function kExterior(thk, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + (thk/1000)/lam);
}
function kInterior(thk, T1, T2) {
  const lam = lambdaUrethane(T1, T2);
  return 1 / (1/PC.surfaceCoefficients.inside + 1/PC.surfaceCoefficients.inside + (thk/1000)/lam);
}

export const DEFAULT_GEOMETRY = {
  H: 1680, W: 800, D: 630, Hf: 550, Hr: 1130, Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tFback: 60, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  tFfloor1: 40, tFfloor2: 40, tFfloor3: 40,
  tRfloor: 70,
};

export function calcHeatLoads(
  geom, temps, electrical, PIPEPITCH, BackcondenserEfficiency=0.7,
  fanAirflow_m3h, evapParams, fanInputPower_W,
  freezerPosition = 'top'
) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tFback, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRdoor,
    tRbottom1, tRbottom2, tRbottom3,
    tFfloor1, tFfloor2, tFfloor3, tRfloor
  } = geom;
  const { T0, TF, TR, T2, TC, PR, TE } = temps;
  const K_side = 10.57-0.042*PIPEPITCH.side+0.00005*PIPEPITCH.side^2;
  const K_back = 10.57-0.042*PIPEPITCH.back+0.00005*PIPEPITCH.back^2;
  const S_side = (H*(D-30)-(Db2+Db1)*Hb/2)*2/1e6;
  const S_back =W*(H-Hb)/1e6*BackcondenserEfficiency;
  const T_comp = 50 * PR + T0;
  const T_CompWall = T0 + (TC - T0) * PR;  // Excel formula for condenser wall temp rise
  const TRise_side = (TC - T0) / 10 * K_side;
  const TRise_back = (TC - T0) / 10 * K_back;
  const T_wallSide = T0 + TRise_side * PR;
  const T_wallBack = T0 + TRise_back * PR;

  const isTopFreezer = (freezerPosition === 'top');

  // ── Freezer ───────────────────────────────────────────────────
  const AFtop    = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  const AFdoor   = (Hf - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  const AFpackin = ((Hf - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  // Freezer left/right area depends on orientation
  let AFleft, AFright;
  if (isTopFreezer) {
    // top‑freezer: freezer has no machine‑compartment cut‑out
    AFleft  = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
    AFright = AFleft;
  } else {
    // bottom‑freezer: freezer has the machine‑compartment cut‑out
    const fSideHeight = Hf - (tFtop + tFfloor1)/2;
    AFleft  = (fSideHeight * (D - tEvaBack/2) - (Db1 + Db2) * Hb / 2) / 1e6;
    AFright = AFleft;
  }

  let QF = 0;

  // Freezer top
  QF += (isTopFreezer
    ? kExterior(tFtop, TF, T0) * AFtop * (T0 - TF)
    : kInterior(tFtop, TF, TR) * AFtop * (TR - TF));

  // Freezer sides
  QF += kExterior(tFleft, TF, T_wallSide) * AFleft * (T_wallSide - TF)
      + kExterior(tFright, TF, T_wallSide) * AFright * (T_wallSide - TF);

  // Freezer bottom
  if (isTopFreezer) {
    const AFbottom = (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6;
    QF += kInterior(tFbottom, TF, TR) * AFbottom * (TR - TF);
  } else {
    const AFbottom1 = (W - (tFleft + tFright)/2) * Db1 / 1e6;
    const AFbottom2 = (W - (tFleft + tFright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
    const AFbottom3 = (W - (tFleft + tFright)/2) * (D-Db2) / 1e6;
    QF += kExterior(tFfloor1, TF, T_CompWall) * AFbottom1 * (T_CompWall - TF)
        + kExterior(tFfloor2, TF, T_CompWall) * AFbottom2 * (T_CompWall - TF)
        + kExterior(tFfloor3, TF, T0)       * AFbottom3 * (T0 - TF);
  }

  // Freezer door + packing
  QF += kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF)
      + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses
  QF += (0.1219*(TC-TF)*PR + 0.1219*((0.1984*T0+0.1219*TF)/(0.1984+0.1219)-TF)*(1-PR))
        * (W - tFleft - tFright) / 1000;
  QF += (0.0791*(TC-TF) - 0.072*(T0-TF)) * PR * (Hf*2 + W) / 1000;

  // ── Refrigerator ───────────────────────────────────────────────
  let ARtop, ARleft, ARback;
  const ARdoor   = (Hr - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  const ARpackin = ((Hr - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  if (isTopFreezer) {
    ARtop  = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
    const rH = Hr - (tRtop + tRbottom1)/2;
    ARleft = (rH * (D - tRback/2) - (Db1+Db2)*Hb/2) / 1e6;
    ARback = (Hr - (tRtop+tRbottom1)/2 - Hb) * (W - (tRleft+tRright)/2) / 1e6;
  } else {
    // bottom‑freezer: refrigerator has NO machine‑compartment cut‑out
    ARtop  = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
    const rH = Hr - (tRtop + tRfloor)/2;
    ARleft = (rH * (D - tRback/2)) / 1e6;
    ARback = (Hr - (tRtop + tRfloor)/2) * (W - (tRleft+tRright)/2) / 1e6;
  }

  let QR = 0;

  // Refrigerator top
  QR += (isTopFreezer
    ? kInterior(tRtop, TF, TR) * ARtop * (TF - TR)
    : kExterior(tRtop, TR, T0) * ARtop * (T0 - TR));

  // Refrigerator sides
  QR += kExterior(tRleft, TR, T_wallSide) * ARleft * (T_wallSide - TR)
      + kExterior(tRright, TR, T_wallSide) * ARleft * (T_wallSide - TR);

  // Refrigerator back
  QR += kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR);

  // Refrigerator bottom
  if (isTopFreezer) {
    const ARb1 = (W - (tRleft+tRright)/2) * Db1 / 1e6;
    const ARb2 = (W - (tRleft+tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
    const ARb3 = (W - (tRleft+tRright)/2) * (D-Db2) / 1e6;
    QR += kExterior(tRbottom1, TR, T_CompWall) * ARb1 * (T_CompWall - TR)
        + kExterior(tRbottom2, TR, T_CompWall) * ARb2 * (T_CompWall - TR)
        + kExterior(tRbottom3, TR, T0)       * ARb3 * (T0 - TR);
  } else {
    const ARbottom = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
    QR += kInterior(tRfloor, TF, TR) * ARbottom * (TF - TR);
  }

  // Refrigerator door + packing
  QR += kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR)
      + PC.insulation.packing * ARpackin * (T0 - TR);
    QR += (0.0546*(TC-TF) - 0.0491*(T0-TF)) * PR * (Hr*2 + W) / 1000;
// ── Evaporator back (always on freezer back) ─────────────────
  let A_evaBack;
  if (isTopFreezer) {
    A_evaBack = (W - (tFleft+tFright)/2) * (Hf - (tFtop+tFbottom)/2) / 1e6;
  } else {
    // bottom‑freezer: freezer back above the machine compartment
    A_evaBack = (W - (tFleft+tFright)/2) * (Hf - Hb - (tFtop+tFfloor1)/2) / 1e6;
  }
  const QEV_cond = kExterior(tEvaBack, T2, T_wallBack) * A_evaBack * (T_wallBack - T2);
  const fanLoad = (fanInputPower_W ?? 2.1) * PC.conversion.wattToKcalPerH * PR;
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min/60/24) * PC.conversion.wattToKcalPerH;

  return { QF, QR, QEV: QEV_cond + fanLoad + defrostLoad, fanLoad, defrostLoad };
}