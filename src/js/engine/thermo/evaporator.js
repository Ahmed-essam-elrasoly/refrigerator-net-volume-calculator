// evaporator.js – exact Excel evaporator model
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

/**
 * Compute evaporator total surface area (m²)
 * Excel SIZE B29-B33: Fin area + Tube area + Side plate area
 */
export function computeEvaporatorArea(evap) {
  const { width_mm, height_mm, depth_mm, rows, tubeOD_mm,  finHeight_mm, finLength_mm, numFins, sidePlateNo } = evap;
  // Fin area (both sides) – Excel: (28*60 - π*(4^2))*2 / 1e6 per fin
  const tubeCrossArea = Math.PI * (tubeOD_mm/2)**2;
  const finAreaPerFin = (finLength_mm * finHeight_mm - tubeCrossArea) * 2 / 1e6; // m²
  const totalFinArea = finAreaPerFin * numFins;
  // Tube outer area – Excel: (π * tubeOD * width) * rows * 2 / 1e6
  const tubeArea = (Math.PI * tubeOD_mm * width_mm) * rows * 2 / 1e6;
  // Side plate area (Excel B32) – usually zero
  const sidePlateArea = (height_mm * depth_mm * sidePlateNo - tubeCrossArea * rows *2 ) * 2 / 1e6;
  return totalFinArea + tubeArea + sidePlateArea;
}

/**
 * Air speed over evaporator (m/s) – Excel MAIN E19
 * v = fanAirflow_m3h / (width_m * depth_m) / 3600
 */
export function airSpeed(fanParam, evap) {
  const {fanDiam, fanRPM, fanThick} = fanParam
  const fanAirflow_CFM = (Math.PI * (fanDiam/2)**2 * fanThick) * fanRPM / 28_316_846.6; // CFM
  const fanAirflow_m3h = fanAirflow_CFM * 1.699; // convert CFM to m³/h
  const frontArea_m2 = (evap.width_mm * evap.depth_mm) / 1e6;
  return fanAirflow_m3h / frontArea_m2 / 3600; // m/s
}

/**
 * Evaporator heat transfer coefficient (W/m²·°C) – Excel MAIN E21
 * α = 12.93 * v^0.415
 */
export function evaporatorAlpha(v_ms) {
  return 12.93 * Math.pow(v_ms, 0.415) * 1.16279; // convert to W/m²·°C
}

/**
 * Log mean temperature difference – Excel MAIN E20
 * LMTD = (T1 - T2) / ln((T1 - TE) / (T2 - TE))
 */
export function lmtd(T1, T2, TE) {
  const dT1 = T1 - TE;
  const dT2 = T2 - TE;

  // Physical check: if TE is not lower than both inlet/outlet, heat transfer is impossible.
  if (dT1 <= 0 || dT2 <= 0) {
    // Return arithmetic mean as a best-effort fallback, and log a warning.
    console.warn('LMTD: Invalid delta-T (TE >= T1 or TE >= T2). Returning arithmetic mean.');
    return (dT1 + dT2) / 2;
  }

  const ratio = dT1 / dT2;
  // If the temperatures are practically equal, LMTD = dT1 = dT2
  if (Math.abs(ratio - 1.0) < 1e-6) {
    return dT1;
  }

  return (dT1 - dT2) / Math.log(ratio);
}
/**
 * Evaporator capacity (kcal/h) – Excel MAIN E23
 * Qevap = α * area * LMTD
 */
export function evaporatorCapacity(alpha, area, LMTD) {
  return alpha * area * LMTD;
}