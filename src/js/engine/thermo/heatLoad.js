// heatLoad.js – exact replica of Excel SIZE sheet (SJ‑540)
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

// Temperature‑dependent urethane conductivity
function lambdaUrethane(T_in, T_out) {
  const T_avg = (T_in + T_out) / 2;
  return 0.0165 + 0.00011 * (T_avg - 25);
}

function kExterior(thk_mm, T_in, T_out) {
  const lam = lambdaUrethane(T_in, T_out);
  const m = thk_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + m/lam);
}

function kInterior(thk_mm, T1, T2) {
  const lam = lambdaUrethane(T1, T2);
  const m = thk_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.inside + 1/PC.surfaceCoefficients.inside + m/lam);
}

export const DEFAULT_GEOMETRY = {
  H: 1680, W: 800, D: 630, Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230, doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
};

export function calcHeatLoads(
  geom,
  temps,         // { T0, TF, TR, T2, TC, PR, TE }
  electrical,    // { defrostHeater_W, defrostOn_min, timerPeriod_h }
  condenserRises,// { side, back }
  fanAirflow_m3h,
  evapParams,    // not used here
  fanInputPower_W
) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRbottom1, tRbottom2, tRbottom3, tRdoor,
  } = geom;
  const { T0, TF, TR, T2, TC, PR } = temps;

  // Average wall temperatures
  const T_side = T0 + condenserRises.side;
  const T_back = T0 + condenserRises.back;            // condenser back
  const T_comp = 50 * PR + T0;                        // compressor
  const T_wallBack = (T_comp - T0) * PR + T0;         // Cab Bottom = R BACK / BOTTOM1/2 outside

  // ── Freezer areas & loads ──────────────────────────────────────
  const AFtop    = (W - (tFleft + tFright) / 2) * (D - tEvaBack / 2) / 1e6;
  const AFleft   = (D - tEvaBack / 2) * (Hf - (tFtop + tFbottom) / 2) / 1e6;
  const AFbottom = (D - tEvaBack / 2) * (W - (tFleft + tFright) / 2) / 1e6;
  const AFdoor   = (Hf - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6;
  const AFpackin = ((Hf - 2 * packingPos) + (W - 2 * packingPos)) * 2 / 1000;

  let QF = kExterior(tFtop, TF, T0) * AFtop * (T0 - TF)
         + kExterior(tFleft, TF, T_side) * AFleft * (T_side - TF)
         + kExterior(tFright, TF, T_side) * AFleft * (T_side - TF)
         + kInterior(tFbottom, TF, TR) * AFbottom * (TR - TF)
         + kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF)
         + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses (DPCON1, DPCON2)
  QF += (0.1219 * (TC - TF) * PR
         + 0.1219 * ((0.1984 * T0 + 0.1219 * TF) / (0.1984 + 0.1219) - TF) * (1 - PR))
         * (W - tFleft - tFright) / 1000;
  QF += (0.0791 * (TC - TF) - 0.072 * (T0 - TF)) * PR * (Hf * 2 + W) / 1000;

  // ── Refrigerator areas (EXACT Excel formulas) ──────────────────
  const ARtop    = (W - (tRleft + tRright) / 2) * (D - tRback / 2) / 1e6;

  // R LEFT / RIGHT height = Hr - (tFbottom + tRbottom1)/2
  const rSideHeight = Hr - (tFbottom + tRbottom1) / 2;
  const ARleft = (rSideHeight * (D - tRback / 2) - (Db1 + Db2) * Hb / 2) / 1e6;

  // R BACK height = Hr - (tFbottom + tRbottom1)/2 - Hb
  const ARback = (Hr - (tFbottom + tRbottom1) / 2 - Hb) * (W - (tRleft + tRright) / 2) / 1e6;

  const ARbottom1 = (W - (tRleft + tRright) / 2) * Db1 / 1e6;
  const ARbottom2 = (W - (tRleft + tRright) / 2) * Math.sqrt(Hb * Hb + (Db2 - Db1) ** 2) / 1e6;
  const ARbottom3 = (W - (tRleft + tRright) / 2) * Db2 / 1e6;
  const ARdoor    = (Hr - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6;
  const ARpackin  = ((Hr - 2 * packingPos) + (W - 2 * packingPos)) * 2 / 1000;

  let QR = kInterior(tRtop, TF, TR) * ARtop * (TF - TR)
         + kExterior(tRleft, TR, T_side) * ARleft * (T_side - TR)
         + kExterior(tRright, TR, T_side) * ARleft * (T_side - TR)
         + kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR)
         + kExterior(tRbottom1, TR, T_wallBack) * ARbottom1 * (T_wallBack - TR)
         + kExterior(tRbottom2, TR, T_wallBack) * ARbottom2 * (T_wallBack - TR)
         + kExterior(tRbottom3, TR, T0) * ARbottom3 * (T0 - TR)
         + kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR)
         + PC.insulation.packing * ARpackin * (T0 - TR);
  QR += (0.0546 * (TC - TF) - 0.0491 * (T0 - TF)) * PR * (Hr * 2 + W) / 1000;

  // ── Evaporator back + fan + defrost ────────────────────────────
  const A_evaBack = (W - (tFleft + tFright) / 2) * (Hf - (tFtop + tFbottom) / 2) / 1e6;
  const QEV_cond = kExterior(tEvaBack, T2, T_back) * A_evaBack * (T_back - T2);
  const fanLoad = (fanInputPower_W ?? 2.1) * PC.conversion.wattToKcalPerH * PR;
  const defrostLoad = electrical.defrostHeater_W
    * (electrical.defrostOn_min / 60 / 24)
    * PC.conversion.wattToKcalPerH;

  return {
    QF,
    QR,
    QEV: QEV_cond + fanLoad + defrostLoad,
    fanLoad,
    defrostLoad: defrostLoad,
  };
}