// compressorMap.js – bilinear interpolation on compressor performance maps
// Supports both cooling capacity (kcal/h) and input power (W).

/**
 * Bilinear interpolation on a regular grid.
 * @param {number} x  - variable 1 (e.g., TC)
 * @param {number} y  - variable 2 (e.g., TE)
 * @param {number[]} xGrid - ascending array of x values
 * @param {number[]} yGrid - ascending array of y values
 * @param {number[][]} zTable - 2D array, rows = yGrid, cols = xGrid
 * @returns {number} interpolated z value
 */
function bilinear(x, y, xGrid, yGrid, zTable) {
  // Clamp to the grid bounds
  const xc = Math.max(xGrid[0], Math.min(xGrid[xGrid.length - 1], x));
  const yc = Math.max(yGrid[0], Math.min(yGrid[yGrid.length - 1], y));

  // Find bracketing indices
  let i = 0;
  while (i < xGrid.length - 1 && xGrid[i + 1] < xc) i++;
  let j = 0;
  while (j < yGrid.length - 1 && yGrid[j + 1] < yc) j++;

  // Normalised coordinates (0..1)
  const tx = (xc - xGrid[i]) / (xGrid[i + 1] - xGrid[i]);
  const ty = (yc - yGrid[j]) / (yGrid[j + 1] - yGrid[j]);

  const z11 = zTable[j][i];
  const z12 = zTable[j][i + 1];
  const z21 = zTable[j + 1][i];
  const z22 = zTable[j + 1][i + 1];

  return (1 - ty) * ((1 - tx) * z11 + tx * z12) +
         ty * ((1 - tx) * z21 + tx * z22);
}

// --------------------------------------------------------------------------
// SQ47LAEG 220V 50Hz  (R‑600a)  –  from Excel DATA sheet
// TC grid: 35, 40, 45, 50, 55 °C
// TE grid: –32, –30, –28, –26, –24, –22, –20, –18 °C
// --------------------------------------------------------------------------
const SQ47LAEG_TC = [35, 40, 45, 50, 55];
const SQ47LAEG_TE = [-32, -30, -28, -26, -24, -22, -20, -18];

const SQ47LAEG_Q = [
  // TE = -32, -30, -28, -26, -24, -22, -20, -18  (kcal/h)
  [82.75, 92.40, 102.81, 114.01, 126.05, 138.98, 152.83, 167.66],  // TC=35
  [80.54, 90.17, 100.56, 111.75, 123.77, 136.67, 150.51, 165.31],  // TC=40
  [78.10, 87.72,  98.09, 109.26, 121.26, 134.14, 147.95, 162.73],  // TC=45
  [75.44, 85.04,  95.39, 106.53, 118.51, 131.36, 145.14, 159.89],  // TC=50
  [72.52, 82.10,  92.43, 103.55, 115.50, 128.33, 142.08, 156.80],  // TC=55
];

const SQ47LAEG_W = [
  // TE = -32, -30, -28, -26, -24, -22, -20, -18  (W)
  [43.40, 41.82, 40.54, 39.57, 38.89, 38.51, 38.43, 38.66],  // TC=35
  [52.98, 54.89, 57.10, 59.61, 62.42, 65.53, 68.94, 72.65],  // TC=40
  [62.56, 67.96, 73.65, 79.65, 85.95, 92.54, 99.44, 106.64], // TC=45
  [72.14, 81.03, 90.21, 99.69, 109.48, 119.56, 129.94, 140.62], // TC=50
  [81.72, 94.09, 106.76, 119.73, 133.00, 146.57, 160.44, 174.61], // TC=55
];

// --------------------------------------------------------------------------
// EGX80CLC (SJ‑540)  –  from Excel DATA sheet (volumetric + power polynomials)
// These are already handled by the existing compressor.js; we keep the
// polynomial approach for that model.
// --------------------------------------------------------------------------

/**
 * Returns compressor state using map interpolation.
 * @param {number} TC – condensing temperature (°C)
 * @param {number} TE – evaporating temperature (°C)
 * @param {object} mapConfig – { TC_grid, TE_grid, Q_table, W_table, Vc, rpm, T_suction, refrigerantName }
 * @param {object} rf – refrigerant functions
 * @param {number} subcool – subcooling (K)
 */
export function compressorStateMap(TC, TE, mapConfig, rf, subcool) {
  const { TC_grid, TE_grid, Q_table, W_table, Vc, rpm, T_suction } = mapConfig;

  const cooling = bilinear(TC, TE, TC_grid, TE_grid, Q_table);   // kcal/h
  const inputPower = bilinear(TC, TE, TC_grid, TE_grid, W_table); // W

  // Mass flow from cooling capacity (for completeness)
  const Pe = rf.satPressure(TE);
  const h_evap_out = rf.vaporEnthalpy(TE, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);
  const mdot = cooling / Math.max(0.01, h_evap_out - h_liquid);

  // Volumetric efficiency (from mass flow)
  const v_suc = rf.specificVolume(T_suction, Pe);
  const etaV = mdot / (rpm * Vc * 1e-6 * 60 / v_suc);

  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: cooling,
    inputPower,
    h_evap_out,
    h_liquid,
  };
}

// Pre‑built map configuration for SQ47LAEG
export const SQ47LAEG_MAP = {
  TC_grid: SQ47LAEG_TC,
  TE_grid: SQ47LAEG_TE,
  Q_table: SQ47LAEG_Q,
  W_table: SQ47LAEG_W,
  Vc: 10.17,
  rpm: 2220,
  T_suction: 32.2,
};