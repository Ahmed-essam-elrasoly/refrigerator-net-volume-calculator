/**
 * compressorMap.js
 * Bilinear-interpolation compressor performance map.
 *
 * ALL compressor data is supplied by the caller — this file has zero hardcoded models.
 * Use createMapConfig() to build and validate a config, then pass it to compressorStateMap().
 *
 * Unit contract (must be consistent across your refrigerant.js):
 *   Q_table  → kcal/h   (matches Excel rows 43–50)
 *   W_table  → W        (matches Excel rows 43–50)
 *   Enthalpy → kcal/kg  (must match your rf.vaporEnthalpy / rf.liquidEnthalpy)
 *   Pressure → kgf/cm²  (must match your rf.satPressure)
 *   Volume   → m³/kg    (must match your rf.specificVolume)
 *
 * If your refrigerant.js returns SI units (kJ/kg, Pa, etc.) change the unit
 * comments below and adjust the massFlow calc accordingly — do not silently mix units.
 *
 * Map config shape:
 * {
 *   TC_grid   : number[]    ascending condensing temps (°C)
 *   TE_grid   : number[]    ascending evaporating temps (°C)
 *   Q_table   : number[][]  cooling capacity, rows = TC index, cols = TE index
 *   W_table   : number[][]  input power (W),  rows = TC index, cols = TE index
 *   Vc        : number      cylinder volume (cc)
 *   rpm       : number      rated speed (rev/min)
 *   T_suction : number      suction line temperature (°C), typically 32.2
 * }
 *
 * Excel source:   DATA sheet, rows 43–50 (Q) and rows 43–50 col J–N (W)
 * VBA source:     Record2 → second loop: QS = GG * (IG - IL)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core interpolation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bilinear interpolation on a regular 2-D grid.
 * Values outside the grid are clamped to the nearest edge.
 *
 * @param {number}   x      query value along first axis  (e.g. TE)
 * @param {number}   y      query value along second axis (e.g. TC)
 * @param {number[]} xGrid  ascending array of x breakpoints
 * @param {number[]} yGrid  ascending array of y breakpoints
 * @param {number[][]} zTable  2-D array: zTable[yIndex][xIndex]
 * @returns {number}
 */
export function bilinear(x, y, xGrid, yGrid, zTable) {
  if (xGrid.length < 2) throw new Error('bilinear: xGrid must have at least 2 points');
  if (yGrid.length < 2) throw new Error('bilinear: yGrid must have at least 2 points');

  // Clamp to grid bounds
  const xc = Math.max(xGrid[0], Math.min(xGrid[xGrid.length - 1], x));
  const yc = Math.max(yGrid[0], Math.min(yGrid[yGrid.length - 1], y));

  // Find lower-bracket indices.
  // Stop at length-2 so i+1 is always a valid index.
  let i = 0;
  while (i < xGrid.length - 2 && xGrid[i + 1] <= xc) i++;

  let j = 0;
  while (j < yGrid.length - 2 && yGrid[j + 1] <= yc) j++;

  // Normalised fractional positions in [0, 1]
  const tx = (xc - xGrid[i]) / (xGrid[i + 1] - xGrid[i]);
  const ty = (yc - yGrid[j]) / (yGrid[j + 1] - yGrid[j]);

  // Corner values: zTable[y_index][x_index]
  const z11 = zTable[j    ][i    ];
  const z12 = zTable[j    ][i + 1];
  const z21 = zTable[j + 1][i    ];
  const z22 = zTable[j + 1][i + 1];

  return (1 - ty) * ((1 - tx) * z11 + tx * z12)
       +      ty  * ((1 - tx) * z21 + tx * z22);
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory / validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds and validates a map config object.
 * Throws with an actionable message on any shape mismatch.
 *
 * @param {object}   opts
 * @param {number[]} opts.TC_grid    condensing temperature breakpoints (°C), ascending
 * @param {number[]} opts.TE_grid    evaporating temperature breakpoints (°C), ascending
 * @param {number[][]} opts.Q_table  cooling capacity (kcal/h): Q_table[TC_idx][TE_idx]
 * @param {number[][]} opts.W_table  input power (W):          W_table[TC_idx][TE_idx]
 * @param {number}   opts.Vc         cylinder volume (cc)
 * @param {number}   opts.rpm        rated speed (rev/min)
 * @param {number}   [opts.T_suction=32.2]  suction temperature (°C)
 * @returns {object} validated map config
 */
export function createMapConfig({
  TC_grid,
  TE_grid,
  Q_table,
  W_table,
  Vc,
  rpm,
  T_suction = 32.2,
}) {
  if (!Array.isArray(TC_grid) || TC_grid.length < 2)
    throw new Error('createMapConfig: TC_grid must be an array with ≥2 entries');
  if (!Array.isArray(TE_grid) || TE_grid.length < 2)
    throw new Error('createMapConfig: TE_grid must be an array with ≥2 entries');

  const nTC = TC_grid.length;
  const nTE = TE_grid.length;

  for (const [name, table] of [['Q_table', Q_table], ['W_table', W_table]]) {
    if (!Array.isArray(table) || table.length !== nTC)
      throw new Error(`createMapConfig: ${name} must have ${nTC} rows (one per TC breakpoint)`);
    table.forEach((row, r) => {
      if (!Array.isArray(row) || row.length !== nTE)
        throw new Error(`createMapConfig: ${name}[${r}] must have ${nTE} columns (one per TE breakpoint)`);
      row.forEach((v, c) => {
        if (!Number.isFinite(v))
          throw new Error(`createMapConfig: ${name}[${r}][${c}] is not a finite number`);
      });
    });
  }

  if (!Number.isFinite(Vc) || Vc <= 0)
    throw new Error('createMapConfig: Vc must be a positive number (cc)');
  if (!Number.isFinite(rpm) || rpm <= 0)
    throw new Error('createMapConfig: rpm must be a positive number (rev/min)');
  if (!Number.isFinite(T_suction))
    throw new Error('createMapConfig: T_suction must be a finite number (°C)');

  return { TC_grid, TE_grid, Q_table, W_table, Vc, rpm, T_suction };
}

// ─────────────────────────────────────────────────────────────────────────────
// Map-based state calculator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compressor state from a performance map.
 *
 * Returns TWO cooling capacity values (matching the Excel's two tables):
 *
 *   coolingCapacity   Q_total   = map lookup (kcal/h)
 *                                 = mdot × (h_suction_T0 − h_liquid_T0)
 *                                 matches Excel rows 43–50, VBA: G*(IG−IIN)
 *
 *   effectiveCooling  Q_eff     = mdot × (h_sat_vap_TE − h_liquid_TC)
 *                                 matches Excel rows 60–67, VBA: G*(IGL−ITC)
 *                                 → use this for cabinet energy balance
 *
 * Mass flow is back-calculated from Q_total using the correct enthalpy
 * difference (h_suction_T0 − h_liquid_T0), so mdot and etaV are
 * internally consistent with the map data.
 *
 * @param {number} TC       condensing temperature (°C)
 * @param {number} TE       evaporating temperature (°C)
 * @param {object} mapConfig  from createMapConfig()
 * @param {object} rf         refrigerant functions  { satPressure, vaporEnthalpy,
 *                                                     liquidEnthalpy, specificVolume }
 * @param {number} [subcool=0]  condenser subcooling (K)
 * @returns {{
 *   etaV, massFlow,
 *   coolingCapacity, effectiveCooling,
 *   inputPower,
 *   Pe, Pc,
 *   h_suction, h_ref, h_sat_vap, h_liquid
 * }}
 */
export function compressorStateMap(TC, TE, mapConfig, rf, subcool = 0) {
  const { TC_grid, TE_grid, Q_table, W_table, Vc, rpm, T_suction } = mapConfig;

  // Interpolated values from map
  // bilinear(x=TE, y=TC, xGrid=TE_grid, yGrid=TC_grid, zTable=Q_table)
  // → zTable[TC_idx][TE_idx] which matches Q_table[TC_idx][TE_idx] definition ✓
  const coolingCapacity = bilinear(TE, TC, TE_grid, TC_grid, Q_table); // kcal/h
  const inputPower      = bilinear(TE, TC, TE_grid, TC_grid, W_table); // W

  const Pe = rf.satPressure(TE);
  const Pc = rf.satPressure(TC);

  // Enthalpy values matching Excel's IG and IIN at T_suction:
  //   h_suction → superheated vapour at T_suction and Pe  (Excel: IG)
  //   h_ref     → saturated liquid enthalpy at T_suction  (Excel: IIN = IL at 32.2°C)
  const h_suction = rf.vaporEnthalpy(T_suction, Pe);
  const h_ref     = rf.liquidEnthalpy(T_suction);

  // Back-calculate mass flow from Q_total using the same dH the Excel used.
  // Do NOT use (h_sat_vap − h_liquid_TC) here — that is the QU definition, not Q.
  const dH_total = h_suction - h_ref;
  if (dH_total <= 0)
    throw new Error(`compressorStateMap: h_suction − h_ref = ${dH_total} ≤ 0. Check refrigerant functions and T_suction.`);

  const massFlow = coolingCapacity / dH_total; // kg/h

  // Effective cooling capacity (VBA: QU = G*(IGL−ITC))
  const h_sat_vap = rf.vaporEnthalpy(TE, Pe);           // IGL: sat. vapour at TE
  const h_liquid  = rf.liquidEnthalpy(TC - subcool);     // ITC: liquid at condenser exit
  const effectiveCooling = massFlow * (h_sat_vap - h_liquid); // kcal/h

  // Volumetric efficiency back-calculated from mass flow:
  //   GK = etaV * rpm * 60 * Vc * 1e-6 / v_suc  (kg/h)
  const v_suc = rf.specificVolume(T_suction, Pe);
  const GK_theoretical = rpm * 60 * Vc * 1e-6 / v_suc; // kg/h at etaV=1
  const etaV = massFlow / GK_theoretical;

  return {
    etaV,
    massFlow,          // kg/h
    coolingCapacity,   // kcal/h — Q_total, matches Excel rows 43–50
    effectiveCooling,  // kcal/h — Q_eff,   matches Excel rows 60–67
    inputPower,        // W
    Pe,
    Pc,
    h_suction,
    h_ref,
    h_sat_vap,
    h_liquid,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference config: SQ47LAEG 220V 50Hz (R-600a)
// Source: Excel DATA sheet rows 43–50
// This is a usage example — import createMapConfig in your own code to add more.
// ─────────────────────────────────────────────────────────────────────────────

const _SQ47LAEG_TC = [35, 40, 45, 50, 55]; // °C (5 points)
const _SQ47LAEG_TE = [-32, -30, -28, -26, -24, -22, -20, -18]; // °C (8 points)

// Q_table[TC_idx][TE_idx]  kcal/h
// Rows → TC = 35, 40, 45, 50, 55
// Cols → TE = -32, -30, -28, -26, -24, -22, -20, -18
const _SQ47LAEG_Q = [
  [82.75,  92.40, 102.81, 114.01, 126.05, 138.98, 152.83, 167.66], // TC=35
  [80.54,  90.17, 100.56, 111.75, 123.77, 136.67, 150.51, 165.31], // TC=40
  [78.10,  87.72,  98.09, 109.26, 121.26, 134.14, 147.95, 162.73], // TC=45
  [75.44,  85.04,  95.39, 106.53, 118.51, 131.36, 145.14, 159.89], // TC=50
  [72.52,  82.10,  92.43, 103.55, 115.50, 128.33, 142.08, 156.80], // TC=55
];

// W_table[TC_idx][TE_idx]  W
const _SQ47LAEG_W = [
  [43.40, 41.82, 40.54, 39.57,  38.89,  38.51,  38.43,  38.66], // TC=35
  [52.98, 54.89, 57.10, 59.61,  62.42,  65.53,  68.94,  72.65], // TC=40
  [62.56, 67.96, 73.65, 79.65,  85.95,  92.54,  99.44, 106.64], // TC=45
  [72.14, 81.03, 90.21, 99.69, 109.48, 119.56, 129.94, 140.62], // TC=50
  [81.72, 94.09,106.76,119.73, 133.00, 146.57, 160.44, 174.61], // TC=55
];

export const SQ47LAEG_MAP = createMapConfig({
  TC_grid:   _SQ47LAEG_TC,
  TE_grid:   _SQ47LAEG_TE,
  Q_table:   _SQ47LAEG_Q,
  W_table:   _SQ47LAEG_W,
  Vc:        10.17,   // cc
  rpm:       2220,    // rev/min  (37 Hz × 60)
  T_suction: 32.2,    // °C
});