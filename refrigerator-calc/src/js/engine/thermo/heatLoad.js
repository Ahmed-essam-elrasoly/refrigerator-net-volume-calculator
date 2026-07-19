// heatLoad.js – universal top- / bottom-freezer heat load model (physically correct)
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

function lambdaUrethane(T_in, T_out) {
  const T_avg = (T_in + T_out) / 2;
  return (0.0165 + 0.00011 * (T_avg-25)) * 1.16279;   // Excel formula, shifted to be 0.0165 at 25°C
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
  geom, temps, electrical, PIPEPITCH, BackcondenserEfficiency=0,
  fanInputPower_W,
  freezerPosition = 'top', backCondenser = 'No'
) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tFback, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRdoor,
    tRbottom1, tRbottom2, tRbottom3,
    tFfloor1, tFfloor2, tFfloor3, tRfloor
  } = geom;
  const { T0, TF, TR, T2, TC, PR, TE } = temps;

  const K_side = 1.0738-0.004152*PIPEPITCH.side+0.00000482*PIPEPITCH.side**2;
  const K_back = 1.0738-0.004152*PIPEPITCH.back+0.00000482*PIPEPITCH.back**2;
  const T_compZone = T0 + (TC - T0) * PR;
  const TRise_side = (TC - T0)  * K_side;
  const TRise_back = (TC - T0)  * K_back;
  const T_wallSide = T0 + TRise_side * PR;
  const T_wallBack = T0 + TRise_back * PR;

  const isTopFreezer = (freezerPosition === 'top');
  const isBackCondenserAbsent = (backCondenser !== 'Yes');
  const hasFreezer = Hf > 0;
  const hasFresh   = Hr > 0;

  // ── Freezer ───────────────────────────────────────────────────
  let QF = 0;

  if (hasFreezer) {
    const AFtop    = (W - (tFleft + tFright)/2) * (D - tFback/2) / 1e6;
    const AFdoor   = (Hf - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
    const AFpackin = ((Hf - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

    let AFleft1, AFleft2, AFright1, AFright2;
    if (isTopFreezer) {
      AFleft1  = (D - tEvaBack) * (Hf - (tFtop + tFbottom)/2) / 1e6;
      AFleft2 = (tEvaBack) * (Hf - (tFtop + tFbottom)/2) / 1e6;
      AFright1 = AFleft1;
      AFright2 = AFleft2;
    } else {
      const fSideHeight = Hf - (tFtop + tFfloor1)/2;
      AFleft1  = (fSideHeight * (D - tFback/2) - (Db1 + Db2) * Hb / 2 - tEvaBack*(fSideHeight-Hb)) / 1e6;
      AFleft2 = (tEvaBack) * (fSideHeight - Hb) / 1e6;
      AFright1 = AFleft1;
      AFright2 = AFleft2;
    }

    // Freezer top
    QF += (isTopFreezer
      ? kExterior(tFtop, TF, T0) * AFtop * (T0 - TF)
      : kInterior(tFtop, TF, TR) * AFtop * (TR - TF));

    // Freezer sides
    QF += kExterior(tFleft, TF, T_wallSide) * AFleft1 * (T_wallSide - TF)
        + kExterior(tFright, TF, T_wallSide) * AFright1 * (T_wallSide - TF)
        + kExterior(tFleft, T2, T_wallSide) * AFleft2 * (T_wallSide - T2)
        + kExterior(tFright, T2, T_wallSide) * AFright2 * (T_wallSide - T2);

    // Freezer bottom
    if (!hasFresh) {
      // single freezer – bottom is exterior stepped floor
      const AFb1 = (W - (tFleft+tFright)/2) * Db1 / 1e6;
      const AFb2 = (W - (tFleft+tFright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
      const AFb3 = (W - (tFleft+tFright)/2) * (D-Db2) / 1e6;
      QF += kExterior(tFfloor1, TF, T_compZone) * AFb1 * (T_compZone - TF)
          + kExterior(tFfloor2, TF, T_compZone) * AFb2 * (T_compZone - TF)
          + kExterior(tFfloor3, TF, T0)          * AFb3 * (T0 - TF);
    } else if (isTopFreezer) {
      const AFbottom = (D - tFback/2) * (W - (tFleft + tFright)/2) / 1e6;
      QF += kInterior(tFbottom, TF, TR) * AFbottom * (TR - TF);
    } else {
      const AFbottom1 = (W - (tFleft + tFright)/2) * Db1 / 1e6;
      const AFbottom2 = (W - (tFleft + tFright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
      const AFbottom3 = (W - (tFleft + tFright)/2) * (D-Db2) / 1e6;
      QF += kExterior(tFfloor1, TF, T_compZone) * AFbottom1 * (T_compZone - TF)
          + kExterior(tFfloor2, TF, T_compZone) * AFbottom2 * (T_compZone - TF)
          + kExterior(tFfloor3, TF, T0)        * AFbottom3 * (T0 - TF);
    }

    // Freezer door + packing
    QF += kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF)
        + PC.insulation.packing * AFpackin * (T0 - TF);

    // Partition losses
    QF += ((0.1219*(TC-TF)*PR + 0.07551*(T0-TF)*(1-PR)) * (W - tFleft - tFright) / 1000) * 1.16279;
    QF += ((0.0344*(TC-TF) - 0.031235*(T0-TF)) * PR * (Hf*2 + W) / 1000) * 1.16279;
  }

  // ── Refrigerator ───────────────────────────────────────────────
  let QR = 0;

  if (hasFresh) {
    const ARdoor   = (Hr - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
    const ARpackin = ((Hr - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

    let ARtop, ARleft, ARback;
    if (isTopFreezer) {
      ARtop  = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
      const rH = Hr - (tRtop + tRbottom1)/2;
      ARleft = (rH * (D - tRback/2) - (Db1+Db2)*Hb/2) / 1e6;
      ARback = (Hr - (tRtop+tRbottom1)/2 - Hb) * (W - (tRleft+tRright)/2) / 1e6;
    } else {
      ARtop  = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
      const rH = Hr - (tRtop + tRfloor)/2;
      ARleft = (rH * (D - tRback/2)) / 1e6;
      ARback = (Hr - (tRtop + tRfloor)/2) * (W - (tRleft+tRright)/2) / 1e6;
    }

    // Refrigerator top
    QR += (isTopFreezer
      ? kInterior(tRtop, TF, TR) * ARtop * (TF - TR)
      : kExterior(tRtop, TR, T0) * ARtop * (T0 - TR));

    // Refrigerator sides
    QR += kExterior(tRleft, TR, T_wallSide) * ARleft * (T_wallSide - TR)
        + kExterior(tRright, TR, T_wallSide) * ARleft * (T_wallSide - TR);

    // Refrigerator back
    if (isBackCondenserAbsent) {
      QR += kExterior(tRback, TR, T0) * ARback * (T0 - TR);
    } else {
      QR += kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR);
    }

    // Refrigerator bottom
    if (!hasFreezer) {
      // single fresh – bottom is exterior stepped floor
      const ARb1 = (W - (tRleft+tRright)/2) * Db1 / 1e6;
      const ARb2 = (W - (tRleft+tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
      const ARb3 = (W - (tRleft+tRright)/2) * (D-Db2) / 1e6;
      QR += kExterior(tRbottom1, TR, T_compZone) * ARb1 * (T_compZone - TR)
          + kExterior(tRbottom2, TR, T_compZone) * ARb2 * (T_compZone - TR)
          + kExterior(tRbottom3, TR, T0)        * ARb3 * (T0 - TR);
    } else if (isTopFreezer) {
      const ARb1 = (W - (tRleft+tRright)/2) * Db1 / 1e6;
      const ARb2 = (W - (tRleft+tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
      const ARb3 = (W - (tRleft+tRright)/2) * (D-Db2) / 1e6;
      QR += kExterior(tRbottom1, TR, T_compZone) * ARb1 * (T_compZone - TR)
          + kExterior(tRbottom2, TR, T_compZone) * ARb2 * (T_compZone - TR)
          + kExterior(tRbottom3, TR, T0)        * ARb3 * (T0 - TR);
    } else {
      // bottom‑freezer (partition to freezer)
      const ARbottom = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
      QR += kInterior(tRfloor, TF, TR) * ARbottom * (TF - TR);
    }

    // Refrigerator door + packing
    QR += kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR)
        + PC.insulation.packing * ARpackin * (T0 - TR);

    // DP condenser
    QR += ((0.03322*(TC-TR)-0.030267*(T0-TR))* PR * (Hr*2 ) / 1000) * 1.16279;
  }

  // ── Evaporator back (always on the "freezer" side) ─────────────────
  const H_evap      = hasFreezer ? Hf : Hr;
  const tTop_evap   = hasFreezer ? tFtop : tRtop;
  const tLeft_evap  = hasFreezer ? tFleft : tRleft;
  const tRight_evap = hasFreezer ? tFright : tRright;
  const tBack_evap  = hasFreezer ? tFback : tRback;
  let tBottom_evap;
  if (hasFreezer) {
    tBottom_evap = (freezerPosition === 'top') ? tFbottom : tFfloor1;
  } else {
    tBottom_evap = (isTopFreezer || freezerPosition === 'top') ? tRfloor : tRbottom1;
  }

  let A_evaBack;
  if (isTopFreezer || !hasFreezer) {
    A_evaBack = (W - (tLeft_evap + tRight_evap)/2) * 
                (H_evap - (tTop_evap + tBottom_evap)/2) / 1e6;
  } else {
    A_evaBack = (W - (tLeft_evap + tRight_evap)/2) * 
                (H_evap - Hb - (tTop_evap + tBottom_evap)/2) / 1e6;
  }

  let QEV_cond = 0;
  if (A_evaBack > 0) {
    if (isBackCondenserAbsent) {
      QEV_cond = kExterior(tEvaBack, T2, T0) * A_evaBack * (T0 - T2);
    } else {
      QEV_cond = kExterior(tEvaBack, T2, T_wallBack) * A_evaBack * (T_wallBack - T2);
    }
  }

  const fanLoad = (fanInputPower_W ?? 2.1) * PR;
  const defrostEventsPerDay = 24 / (electrical.timerPeriod_h / PR); // 10.5 is the timer period in h
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60) * (defrostEventsPerDay / 24); 
  return { QF, QR, QEV: QEV_cond + fanLoad + defrostLoad, fanLoad, defrostLoad, totalLoad: QF + QR + QEV_cond + fanLoad + defrostLoad };
}
