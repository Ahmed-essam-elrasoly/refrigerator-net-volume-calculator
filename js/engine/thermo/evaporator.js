/**
 * @file evaporator.js
 * @description Exact physical model for calculating evaporator performance.
 * Converts physical dimensions into heat transfer surface area and calculates
 * the Log Mean Temperature Difference (LMTD) necessary for cooling.
 */

import { PHYSICAL_CONSTANTS as PC } from './constants.js';

/**
 * Computes the total effective heat transfer surface area of the evaporator (m²).
 * Accounts for fin area, exposed tube area, and side plate area.
 * @param {Object} evap - Evaporator geometric parameters.
 * @returns {number} Total area in m².
 */
export function computeEvaporatorArea(evap) {
  const { width_mm, height_mm, depth_mm, rows, layers, tubeOD_mm, 
          finHeight_mm, finLength_mm, numFins, sidePlateNo } = evap;

  // Fin area (both sides)
  const tubeCrossArea = Math.PI * (tubeOD_mm/2)**2;
  const finAreaPerFin = (finLength_mm * finHeight_mm - tubeCrossArea * layers)*2 / 1e6; // m²
  const totalFinArea = finAreaPerFin * numFins;

  // Tube outer area
  const tubeArea = (Math.PI * tubeOD_mm * width_mm) * rows * layers / 1e6;

  // Side plate area
  const sidePlateArea = (height_mm * depth_mm * sidePlateNo - tubeCrossArea * rows *layers ) * 2 / 1e6;

  return totalFinArea + tubeArea + sidePlateArea;
}

/**
 * Calculates the superficial air velocity (m/s) passing over the evaporator face.
 * @param {Object} fanParam - Fan physical parameters (diameter, RPM, thickness).
 * @param {Object} evap - Evaporator geometric parameters (width, depth).
 * @returns {number} Air speed in m/s.
 */
export function airSpeed(fanParam, evap) {
  const {tipDiam_mm, fanRPM} = fanParam
  
  if (!fanParam || typeof fanParam !== 'object') {
    throw new Error('fanParam is missing or invalid');
  }
  if ([tipDiam_mm, fanRPM].some(v => v == null || isNaN(v))) {
    throw new Error('fanParam missing required fields: tipDiam_mm, fanRPM');
  }

  const tipDiam_m = tipDiam_mm / 1000;
  const R = tipDiam_m / 2;

  // Axial fan flow rate: Q [m³/s] = π * n [rev/s] * (R² - r²) * tan(θ)
  const Q_m3s = 70*fanRPM/3000*((tipDiam_mm/100)**2)/3600;
  
  const fanAirflow_m3h = Q_m3s * 3600;   // convert to m³/h (used by the rest of the engine)
  const fanAirSpeed = fanAirflow_m3h/(Math.PI * R ** 2)/3600;
  const frontArea_m2 = (evap.width_mm * evap.depth_mm) / 1e6;
  if (frontArea_m2 <= 0) throw new Error('Evaporator face area is zero or negative');

  const v_ms = fanAirflow_m3h / frontArea_m2 / 3600;   // m/s
  const fanAirflow_cfm = fanAirflow_m3h * 0.588578;    // m³ -> CFM

  console.log(`[Fan param] tipDiam_mm=${tipDiam_mm} fanRPM=${fanRPM} | Q_m3s=${Q_m3s.toFixed(4)} m³/s, fanAirflow_m3h=${fanAirflow_m3h.toFixed(2)} m³/h, v_ms=${v_ms.toFixed(2)} m/s, fanAirflow_cfm=${fanAirflow_cfm.toFixed(2)} CFM`);
  
  return { v_ms, fanAirflow_m3h, fanAirflow_cfm, fanAirSpeed };
}

/**
 * Calculates the empirical convective heat transfer coefficient (α) for the evaporator.
 * @param {number} v_ms - Air speed in m/s.
 * @returns {number} Heat transfer coefficient in W/(m²·K).
 */
export function evaporatorAlpha(v_ms) {
  return 12.93 * Math.pow(v_ms, 0.415) * 1.16279; // convert to W/m²K
}

/**
 * Calculates the Log Mean Temperature Difference (LMTD) across the evaporator.
 * Used to determine the driving thermal force given inlet/outlet temperatures.
 * @param {number} T1 - Mixed air inlet temperature (C)
 * @param {number} T2 - Cold air supply/outlet temperature (C)
 * @param {number} TE - Refrigerant evaporating temperature (C)
 * @returns {number} LMTD in K.
 */
export function lmtd(T1, T2, TE) {
  const dT1 = T1 - TE;
  const dT2 = T2 - TE;

  // Strict physical boundary: Refrigerant must be colder than the air.
  if (dT1 <= 1e-4 || dT2 <= 1e-4) {
    throw new RangeError(`LMTD Undefined: TE (${TE.toFixed(2)}) >= Air Temps (T1:${T1.toFixed(2)}, T2:${T2.toFixed(2)})`);
  }

  const ratio = dT1 / dT2;

  // L'Hopital's limit for near-identical delta-Ts
  if (Math.abs(ratio - 1.0) < 1e-6) {
    return dT1;
  }

  return (dT1 - dT2) / Math.log(ratio);
}

/**
 * Calculates the final thermal cooling capacity of the evaporator.
 * 
 * @param {number} alpha - Heat transfer coefficient.
 * @param {number} area - Total surface area.
 * @param {number} LMTD - Log Mean Temperature Difference.
 * @returns {number} Capacity in Watts.
 */
export function evaporatorCapacity(alpha, area, LMTD) {
  return alpha * area * LMTD;
}