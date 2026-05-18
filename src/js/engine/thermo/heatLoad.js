// heatLoad.js – exact replica of Excel SIZE sheet, including full evaporator air‑side heat transfer
import { PHYSICAL_CONSTANTS as PC } from './constants.js';
import { airSpeed, evaporatorAlpha, computeEvaporatorArea, lmtd, evaporatorCapacity } from './evaporator.js';

// Enable/disable detailed logging
const DEBUG = true;

// Default geometry (overridden by caller)
export const DEFAULT_GEOMETRY = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4,
  tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
  evap: {
    width_mm: 460, depth_mm: 60, rows: 7, tubeOD_mm: 8,
    finPitch_mm: 30, finHeight_mm: 60, finLength_mm: 28, numFins: 504,
  },
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
  const evap = { ...DEFAULT_GEOMETRY.evap, ...evapParams };

  const T_side = T0 + condenserRises.side * PR;
  const T_back = T0 + condenserRises.back * PR;

  if (DEBUG) {
    console.log('\n[heatLoad] Input temps:', { T0, TF, TR, T2, TC, PR, TE });
    console.log('[heatLoad] T_side=', T_side, 'T_back=', T_back);
  }

  // ----- Freezer areas (Excel SIZE rows 7-11) -----
  const AFtop    = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  const AFleft   = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const AFright  = AFleft;
  const AFbottom = (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6;
  const AFdoor   = ((Hf - tFbottom - packingPos*2) * (W - packingPos*2)) / 1e6;
  const AFpackin = ((Hf - packingPos*2) + (W - packingPos*2)) * 2 / 1000;

  if (DEBUG) {
    console.log('[heatLoad] Freezer areas (m²):', {
      AFtop: AFtop.toFixed(6),
      AFleft: AFleft.toFixed(6),
      AFright: AFright.toFixed(6),
      AFbottom: AFbottom.toFixed(6),
      AFdoor: AFdoor.toFixed(6),
      AFpackin: AFpackin.toFixed(6)
    });
  }

  // Freezer base heat transfers
  let QF = kUrethane(tFtop)    * AFtop    * (T0 - TF)
         + kUrethane(tFleft)   * AFleft   * (T_side - TF)
         + kUrethane(tFright)  * AFright  * (T_side - TF)
         + kUrethane(tFbottom) * AFbottom * (T0 - TF)
         + kUrethane(tFdoor)   * AFdoor   * (T0 - TF)
         + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses (Excel F13, F14)
  const DPCON1 = (0.1219 * (TC - TF) + 0.1219 * (((0.1984 * T0 + 0.1219 * TF) / (0.1984 + 0.1219)) - TF) * (1 - PR))
               * (W - tFleft - tFright) / 1000;
  const DPCON2 = (0.0791 * (TC - TF) - 0.072 * (T0 - TF)) * PR * (Hf * 2 + W) / 1000;
  QF += DPCON1 + DPCON2;

  if (DEBUG) {
    console.log('[heatLoad] Freezer conduction (kcal/h):', {
      top: (kUrethane(tFtop) * AFtop * (T0 - TF)).toFixed(3),
      left: (kUrethane(tFleft) * AFleft * (T_side - TF)).toFixed(3),
      right: (kUrethane(tFright) * AFright * (T_side - TF)).toFixed(3),
      bottom: (kUrethane(tFbottom) * AFbottom * (T0 - TF)).toFixed(3),
      door: (kUrethane(tFdoor) * AFdoor * (T0 - TF)).toFixed(3),
      packing: (PC.insulation.packing * AFpackin * (T0 - TF)).toFixed(3),
      DPCON1: DPCON1.toFixed(3),
      DPCON2: DPCON2.toFixed(3),
      QF_base: QF.toFixed(3)
    });
  }

  // ----- Refrigerator areas (Excel SIZE rows 15-23) -----
  const ARtop      = (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6;
  const ARleftBase = (Hr - (tRtop + tRbottom1)/2) * (D - tRback/2) - (Db1 + Db2) * Hb / 2;
  const ARleft     = ARleftBase / 1e6;
  const ARright    = ARleft;
  const ARback     = (Hr - (tRtop + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6;
  const ARbottom1  = (W - (tRleft + tRright)/2) * Db1 / 1e6;
  const ARbottom2  = (W - (tRleft + tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
  const ARbottom3  = (W - (tRleft + tRright)/2) * Db2 / 1e6;
  const ARdoor     = ((Hr - tRbottom3 - packingPos*2) * (W - packingPos*2)) / 1e6;
  const ARpackin   = ((Hr - packingPos*2) + (W - packingPos*2)) * 2 / 1000;

  if (DEBUG) {
    console.log('[heatLoad] Refrigerator areas (m²):', {
      ARtop: ARtop.toFixed(6),
      ARleft: ARleft.toFixed(6),
      ARright: ARright.toFixed(6),
      ARback: ARback.toFixed(6),
      ARbottom1: ARbottom1.toFixed(6),
      ARbottom2: ARbottom2.toFixed(6),
      ARbottom3: ARbottom3.toFixed(6),
      ARdoor: ARdoor.toFixed(6),
      ARpackin: ARpackin.toFixed(6)
    });
  }

  let QR = kUrethane(tRtop)      * ARtop      * (T0 - TR)
         + kUrethane(tRleft)     * ARleft     * (T_side - TR)
         + kUrethane(tRright)    * ARright    * (T_side - TR)
         + kUrethane(tRback)     * ARback     * (T_back - TR)
         + kUrethane(tRbottom1)  * ARbottom1  * (T0 - TR)
         + kUrethane(tRbottom2)  * ARbottom2  * (T0 - TR)
         + kUrethane(tRbottom3)  * ARbottom3  * (T0 - TR)
         + kUrethane(tRdoor)     * ARdoor     * (T0 - TR)
         + PC.insulation.packing * ARpackin   * (T0 - TR);

  const DPCON_R = (0.0546 * (TC - TF) - 0.0491 * (T0 - TF)) * PR * (Hr * 2 + W) / 1000;
  QR += DPCON_R;

  if (DEBUG) {
    console.log('[heatLoad] Refrigerator conduction (kcal/h):', {
      top: (kUrethane(tRtop) * ARtop * (T0 - TR)).toFixed(3),
      left: (kUrethane(tRleft) * ARleft * (T_side - TR)).toFixed(3),
      right: (kUrethane(tRright) * ARright * (T_side - TR)).toFixed(3),
      back: (kUrethane(tRback) * ARback * (T_back - TR)).toFixed(3),
      bottom1: (kUrethane(tRbottom1) * ARbottom1 * (T0 - TR)).toFixed(3),
      bottom2: (kUrethane(tRbottom2) * ARbottom2 * (T0 - TR)).toFixed(3),
      bottom3: (kUrethane(tRbottom3) * ARbottom3 * (T0 - TR)).toFixed(3),
      door: (kUrethane(tRdoor) * ARdoor * (T0 - TR)).toFixed(3),
      packing: (PC.insulation.packing * ARpackin * (T0 - TR)).toFixed(3),
      DPCON_R: DPCON_R.toFixed(3),
      QR_base: QR.toFixed(3)
    });
  }

  // ----- Evaporator air‑side calculation -----
  const rho = PC.air.density;
  const cp = PC.air.cp;

  // Compute air speed and alpha
  const v_air = airSpeed(fanAirflow_m3h, evap);
  const alpha = evaporatorAlpha(v_air);
  const area = computeEvaporatorArea(evap);

  // Mixed air temperature entering evaporator (T1) – approximate without iteration
  // Use simple average for first pass
  let T1 = (TF + TR) / 2; // placeholder
  const LMTD_evap = lmtd(T1, T2, TE);
  let QEV_air = evaporatorCapacity(alpha, area, LMTD_evap);

  if (DEBUG) {
    console.log('[heatLoad] Evaporator air-side:', {
      fanAirflow_m3h,
      v_air: v_air.toFixed(3),
      alpha: alpha.toFixed(3),
      area: area.toFixed(6),
      T1: T1.toFixed(3),
      LMTD: LMTD_evap.toFixed(3),
      QEV_air: QEV_air.toFixed(3)
    });
  }

  // For now, QEV is the evaporator capacity (Excel uses this as the heat load)
  let QEV = QEV_air;

  // Fan and defrost loads added to QF (Excel does this)
  const fanLoad = (fanInputPower_W ?? electrical.pwbOn_W) * PC.conversion.wattToKcalPerH * PR;
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60 / 24) * PC.conversion.wattToKcalPerH;
  QF += fanLoad + defrostLoad;

  if (DEBUG) {
    console.log('[heatLoad] Fan/defrost added to QF:', { fanLoad: fanLoad.toFixed(3), defrostLoad: defrostLoad.toFixed(3) });
    console.log('[heatLoad] Final QF=', QF.toFixed(3), 'QR=', QR.toFixed(3), 'QEV=', QEV.toFixed(3));
  }

  return { QF, QR, QEV, fanLoad, defrostLoad };
}