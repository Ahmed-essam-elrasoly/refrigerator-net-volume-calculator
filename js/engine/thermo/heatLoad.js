/**
 * @file heatLoad.js
 * @description Universal top/bottom-freezer heat load model.
 * Calculates total system heat ingress through conduction (walls) and parasitic 
 * loads (defrost, fan, partition heating).
 */

import { PHYSICAL_CONSTANTS as PC } from './constants.js';

/**
 * Calculates the thermal conductivity (λ) of Polyurethane Foam based on temperature.
 * λ worsens (increases) at higher average temperatures.
 */
function lambdaUrethane(T_in, T_out) {
  const T_avg = (T_in + T_out) / 2;
  return (0.0165 + 0.00011 * (T_avg-25)) * 1.16279; // Convert to W/(m·°C)
}

/**
 * Overall Heat Transfer Coefficient (U-value) for an exterior wall.
 * Incorporates internal and external air film resistance.
 */
function kExterior(thk, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + (thk/1000)/lam);
}

/**
 * Overall Heat Transfer Coefficient (U-value) for an internal dividing partition.
 */
function kInterior(thk, T1, T2) {
  const lam = lambdaUrethane(T1, T2);
  return 1 / (1/PC.surfaceCoefficients.inside + 1/PC.surfaceCoefficients.inside + (thk/1000)/lam);
}

/**
 * Computes all heat loads (Freezer, Refrigerator, Evaporator) by evaluating
 * every 3D boundary surface.
 * 
 * @param {Object} geom - Flat geometric schema.
 * @param {Object} temps - Current temperature state.
 * @param {Object} electrical - Parasitic load definitions.
 * @param {Object} PIPEPITCH - Condenser piping layout.
 * @param {number} BackcondenserEfficiency - Efficiency of back panel (0 if absent).
 * @param {number} fanInputPower_W - Wattage of evaporator fan.
 * @param {string} freezerPosition - 'top' or 'bottom'.
 * @param {string} backCondenser - 'Yes' or 'No'.
 * @returns {Object} Computed thermal loads in Watts.
 */
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

  // Condenser skin temperature rise impacts side-wall insulation gradients
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

  // ── 1. Freezer Compartment Load ────────────────────────────────
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
      // Bottom freezer accounts for compressor step intrusion
      const fSideHeight = Hf - (tFtop + tFfloor1)/2;
      AFleft1  = (fSideHeight * (D - tFback/2) - (Db1 + Db2) * Hb / 2 - tEvaBack*(fSideHeight-Hb)) / 1e6;
      AFleft2 = (tEvaBack) * (fSideHeight - Hb) / 1e6;
      AFright1 = AFleft1;
      AFright2 = AFleft2;
    }

    // Freezer Top Conduction
    QF += (isTopFreezer
      ? kExterior(tFtop, TF, T0) * AFtop * (T0 - TF)
      : kInterior(tFtop, TF, TR) * AFtop * (TR - TF));

    // Freezer Sides Conduction (accounts for hot skin condenser)
    QF += kExterior(tFleft, TF, T_wallSide) * AFleft1 * (T_wallSide - TF)
        + kExterior(tFright, TF, T_wallSide) * AFright1 * (T_wallSide - TF)
        + kExterior(tFleft, T2, T_wallSide) * AFleft2 * (T_wallSide - T2)
        + kExterior(tFright, T2, T_wallSide) * AFright2 * (T_wallSide - T2);

    // Freezer Bottom
    if (!hasFresh) {
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

    // Door + Packing leak
    QF += kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF)
        + PC.insulation.packing * AFpackin * (T0 - TF);

    // Dew Point (DP) Pipe Partition losses
    QF += ((0.1219*(TC-TF)*PR + 0.07551*(T0-TF)*(1-PR)) * (W - tFleft - tFright) / 1000) * 1.16279;
    QF += ((0.0344*(TC-TF) - 0.031235*(T0-TF)) * PR * (Hf*2 + W) / 1000) * 1.16279;
  }

  // ── 2. Refrigerator Compartment Load ───────────────────────────
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

    // Top
    QR += (isTopFreezer
      ? kInterior(tRtop, TF, TR) * ARtop * (TF - TR)
      : kExterior(tRtop, TR, T0) * ARtop * (T0 - TR));

    // Sides
    QR += kExterior(tRleft, TR, T_wallSide) * ARleft * (T_wallSide - TR)
        + kExterior(tRright, TR, T_wallSide) * ARleft * (T_wallSide - TR);

    // Back
    if (isBackCondenserAbsent) {
      QR += kExterior(tRback, TR, T0) * ARback * (T0 - TR);
    } else {
      QR += kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR);
    }

    // Bottom
    if (!hasFreezer || isTopFreezer) {
      const ARb1 = (W - (tRleft+tRright)/2) * Db1 / 1e6;
      const ARb2 = (W - (tRleft+tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
      const ARb3 = (W - (tRleft+tRright)/2) * (D-Db2) / 1e6;
      QR += kExterior(tRbottom1, TR, T_compZone) * ARb1 * (T_compZone - TR)
          + kExterior(tRbottom2, TR, T_compZone) * ARb2 * (T_compZone - TR)
          + kExterior(tRbottom3, TR, T0)        * ARb3 * (T0 - TR);
    } else {
      const ARbottom = (W - (tRleft+tRright)/2) * (D - tRback/2) / 1e6;
      QR += kInterior(tRfloor, TF, TR) * ARbottom * (TF - TR);
    }

    // Door + Packing
    QR += kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR)
        + PC.insulation.packing * ARpackin * (T0 - TR);

    // DP condenser
    QR += ((0.03322*(TC-TR)-0.030267*(T0-TR))* PR * (Hr*2 ) / 1000) * 1.16279;
  }

  // ── 3. Evaporator Area & Parasitic Loads ──────────────────────
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

  // Fan runs synchronously with compressor
  const fanLoad = (fanInputPower_W ?? 2.1) * PR;
  const defrostEventsPerDay = 24 / (electrical.timerPeriod_h / PR); 
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60) * (defrostEventsPerDay / 24); 

  return { 
    QF, 
    QR, 
    QEV: QEV_cond + fanLoad + defrostLoad, 
    fanLoad, 
    defrostLoad, 
    totalLoad: QF + QR + QEV_cond + fanLoad + defrostLoad 
  };
}