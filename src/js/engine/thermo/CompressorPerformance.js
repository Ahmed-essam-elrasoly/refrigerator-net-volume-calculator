/**
 * CompressorPerformance.js
 *
 * Replicates the VBA macros "Record2" and "JOTA" for a reciprocating
 * compressor performance model.
 *
 * Two polynomial models are fitted by ordinary least squares:
 *   ηv  = A  + B·(Pc/Pe) + C·Pc
 *   W   = AW + BW·TE + CW·TC + DW·TC·TE + EW·TE²
 *
 * Refrigerant property correlations are from the JOTA subroutine:
 *   REI = 1 → R-134a
 *   REI = 2 → R-600a
 *
 * References:
 *   Record2 subroutine – data reading, coefficient fitting, output
 *   JOTA    subroutine – refrigerant property correlations
 *   MATX    subroutine – Gauss-Jordan elimination solver
 */

// =============================================================================
// Constants
// =============================================================================

/** Fixed suction gas temperature (°C) — macro variable T */
const SUCTION_TEMP_C = 30;

/** Celsius-to-Kelvin offset — macro uses 273.16 */
const KELVIN_OFFSET = 273.16;

// =============================================================================
// R-134a property correlations (JOTA, REI = 1)
// =============================================================================

/**
 * R-134a saturation pressure.
 * @param {number} T_K - Temperature in Kelvin
 * @returns {number} Pressure in bar
 */
function r134a_satPressure(T_K) {
  return Math.exp(
    104.918 -
      5301.3 / T_K -
      16.2481 * Math.log(T_K) +
      0.0246593 * T_K
  );
}

/**
 * R-134a saturated liquid enthalpy.
 * @param {number} T_C - Temperature in °C
 * @returns {number} Enthalpy in KJ/kg
 */
function r134a_liquidEnthalpy(T_C) {
  return (
    100.019 * 4.1868 +
    0.31763 * T_C * 4.1868 +
    0.00033057 * T_C ** 2 * 4.1868 +
    0.0000035281 * T_C ** 3 * 4.1868
  );
}

/**
 * R-134a superheated suction gas enthalpy.
 * @param {number} T_K - Suction temperature in Kelvin
 * @param {number} Pe  - Evaporating pressure in bar
 * @returns {number} Enthalpy in KJ/kg
 */
function r134a_gasEnthalpy(T_K, Pe) {
  return (
    119.36 * 4.1868 +
    0.023174 * T_K * 4.1868 +
    0.00031297 * 4.1868 * T_K ** 2 -
    (138.07 * 4.1868 * Pe) / T_K
  );
}

/**
 * R-134a suction gas specific volume.
 * @param {number} T_K - Suction temperature in Kelvin
 * @param {number} Pe  - Evaporating pressure in bar
 * @returns {number} Specific volume in m³/kg
 */
function r134a_specificVolume(T_K, Pe) {
  return (
    0.01077 +
    (0.0008278 * T_K) / Pe -
    4.511 / T_K -
    0.000118 * Pe
  );
}

// =============================================================================
// R-600a property correlations (JOTA, REI = 2)
// =============================================================================

/**
 * R-600a saturation pressure.
 * @param {number} T_K - Temperature in Kelvin
 * @returns {number} Pressure in bar
 */
function r600a_satPressure(T_K) {
  return Math.exp(
    68.322 -
      4401 / T_K -
      9.8436 * Math.log(T_K) +
      0.0127711 * T_K
  );
}

/**
 * R-600a saturated liquid enthalpy.
 * @param {number} T_C - Temperature in °C
 * @returns {number} Enthalpy in KJ/kg
 */
function r600a_liquidEnthalpy(T_C) {
  return (
    75.545 * 4.1868 +
    0.55731 * T_C * 4.1868 +
    0.0007088 * T_C ** 2 * 4.1868 +
    0.0000029408 * T_C ** 3 * 4.1868
  );
}

/**
 * R-600a superheated suction gas enthalpy.
 * @param {number} T_K - Suction temperature in Kelvin
 * @param {number} Pe  - Evaporating pressure in bar
 * @returns {number} Enthalpy in KJ/kg
 */
function r600a_gasEnthalpy(T_K, Pe) {
  return (
    104.5 * 4.1868 +
    0.049951 * T_K * 4.1868 +
    0.00058822 * 4.1868 * T_K ** 2 -
    (249.18 * 4.1868 * Pe) / T_K
  );
}

/**
 * R-600a suction gas specific volume.
 * @param {number} T_K - Suction temperature in Kelvin
 * @param {number} Pe  - Evaporating pressure in bar
 * @returns {number} Specific volume in m³/kg
 */
function r600a_specificVolume(T_K, Pe) {
  return (
    0.015883 +
    (0.001455 * T_K) / Pe -
    7.2936 / T_K -
    0.0004645 * Pe
  );
}

// =============================================================================
// Refrigerant selector — mirrors JOTA dispatch logic
// =============================================================================

/**
 * Returns the property function set for the given refrigerant index.
 *
 * @param {number} REI - 1 = R-134a, 2 = R-600a
 * @returns {{ satPressure: Function, liquidEnthalpy: Function,
 *             gasEnthalpy: Function, specificVolume: Function }}
 * @throws {Error} If REI is not 1 or 2
 */
export function getRefrigerantProperties(REI) {
  if (REI === 1) {
    return {
      satPressure:    r134a_satPressure,
      liquidEnthalpy: r134a_liquidEnthalpy,
      gasEnthalpy:    r134a_gasEnthalpy,
      specificVolume: r134a_specificVolume,
    };
  }
  if (REI === 2) {
    return {
      satPressure:    r600a_satPressure,
      liquidEnthalpy: r600a_liquidEnthalpy,
      gasEnthalpy:    r600a_gasEnthalpy,
      specificVolume: r600a_specificVolume,
    };
  }
  throw new Error(
    `Unsupported refrigerant index ${REI}. Use 1 (R-134a) or 2 (R-600a).`
  );
}
export function getRefrigerantFunctionsC(refrigerantIndex) {
  const prop = getRefrigerantProperties(refrigerantIndex);
  return {
    satPressure:     (t)    => prop.satPressure(t + 273.16),
    specificVolume:  (t, p) => prop.specificVolume(t + 273.16, p),
    vaporEnthalpy:   (t, p) => prop.gasEnthalpy(t + 273.16, p),
    liquidEnthalpy:  (t)    => prop.liquidEnthalpy(t),        // already °C
  };
}
// =============================================================================
// Gauss-Jordan solver with partial pivoting — mirrors MATX subroutine
// Partial pivoting was absent in the original; added for numerical stability.
// =============================================================================

/**
 * Solves Ax = b by Gauss-Jordan elimination with partial pivoting.
 * A working copy of the augmented matrix is used; A and b are not modified.
 *
 * @param {number[][]} A - Square n×n coefficient matrix
 * @param {number[]}   b - Right-hand side vector (length n)
 * @returns {number[]} Solution vector x (length n)
 * @throws {Error} If the matrix is singular or near-singular
 */
function gaussJordanSolve(A, b) {
  const n = b.length;
  // Augmented matrix [A | b]
  const M = A.map((row, i) => [...row, b[i]]);

  for (let k = 0; k < n; k++) {
    // Partial pivot: find row with largest |value| in column k at or below row k
    let maxRow = k;
    let maxAbs = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const abs = Math.abs(M[i][k]);
      if (abs > maxAbs) { maxAbs = abs; maxRow = i; }
    }
    if (maxRow !== k) {
      [M[k], M[maxRow]] = [M[maxRow], M[k]];
    }

    const pivot = M[k][k];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error(
        `Near-zero pivot at column ${k}. ` +
        `Normal equation matrix is singular — check for duplicate or linearly dependent data.`
      );
    }

    // Normalise pivot row
    for (let j = k; j <= n; j++) {
      M[k][j] /= pivot;
    }
    // Zero out column k in every other row
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const factor = M[i][k];
      for (let j = k; j <= n; j++) {
        M[i][j] -= factor * M[k][j];
      }
    }
  }

  // Solution is the last column of the reduced matrix
  return M.map((row) => row[n]);
}

// =============================================================================
// Normal equations builder (OLS: Φᵀ Φ · x = Φᵀ y)
// =============================================================================

/**
 * Assembles the normal equation system for ordinary least squares.
 *
 * @param {number[][]} features - Design matrix (n rows × m columns)
 * @param {number[]}   targets  - Observed outputs (length n)
 * @returns {{ A: number[][], b: number[] }}
 */
function buildNormalEquations(features, targets) {
  const n = features.length;
  const m = features[0].length;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);

  for (let i = 0; i < n; i++) {
    const f = features[i];
    const y = targets[i];
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < m; k++) {
        A[j][k] += f[j] * f[k];
      }
      b[j] += f[j] * y;
    }
  }
  return { A, b };
}

// =============================================================================
// Coefficient fitting — mirrors macro Record2
// =============================================================================

/**
 * Fits volumetric efficiency and input power polynomial coefficients
 * to compressor test data using ordinary least squares.
 *
 * Models:
 *   ηv = A  + B·(Pc/Pe) + C·Pc
 *   W  = AW + BW·TE + CW·TC + DW·TC·TE + EW·TE²
 *
 * Algorithm (per test point):
 *   Pe   = satPressure(TE)                              [bar]
 *   Pc   = satPressure(TC)                              [bar]
 *   hGas = gasEnthalpy(T_suction, Pe)                  [kW/kg]
 *   hLiq = liquidEnthalpy(T_suction)                   [kW/kg]
 *   G    = Q / (hGas − hLiq)                           [kg/h, actual mass flow]
 *   GK   = (VC·N·60 / 1×10⁶) / vGas                  [kg/h, theoretical mass flow]
 *   ηv   = G / GK
 *
 * @param {object} params
 * @param {number} params.cylinderVolumeCm3  - Swept volume (cm³)
 * @param {number} params.speedRpm           - Shaft speed (RPM)
 * @param {number} params.refrigerantIndex   - 1 = R-134a, 2 = R-600a
 * @param {Array<{TE: number, TC: number, Q: number, W: number}>} params.dataPoints
 *   TE: evaporating temperature (°C)
 *   TC: condensing temperature  (°C)
 *   Q:  cooling capacity        (W)
 *   W:  compressor input power  (W)
 *
 * @returns {{ etaCoeffs: number[], wCoeffs: number[] }}
 *   etaCoeffs = [A, B, C]
 *   wCoeffs   = [AW, BW, CW, DW, EW]
 *
 * @throws {Error} If fewer than 5 data points are provided
 * @throws {Error} If the refrigerant index is invalid
 */
export function computeCompressorCoefficients({
  cylinderVolumeCm3,
  speedRpm,
  refrigerantIndex,
  dataPoints,
}) {
  // W model has 5 coefficients — that is the hard minimum.
  if (!Array.isArray(dataPoints) || dataPoints.length < 5) {
    throw new Error(
      `At least 5 data points required (W model needs 5 coefficients). ` +
      `Got ${dataPoints?.length ?? 0}.`
    );
  }

  const prop         = getRefrigerantProperties(refrigerantIndex);
  const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
  const hLiquid      = prop.liquidEnthalpy(SUCTION_TEMP_C);

  const etaFeatures = [];
  const etaTargets  = [];
  const wFeatures   = [];
  const wTargets    = [];

  for (const { TE, TC, Q, W } of dataPoints) {
    const Pe = prop.satPressure(TE + KELVIN_OFFSET);
    const Pc = prop.satPressure(TC + KELVIN_OFFSET);

    const hGas = prop.gasEnthalpy(suctionTempK, Pe);
    const vGas = prop.specificVolume(suctionTempK, Pe);

    // Actual mass flow from measured cooling capacity
    const G = Q * 3.6 / (hGas - hLiquid);

    // Theoretical (displacement) mass flow
    const displacement_m3h = (cylinderVolumeCm3 * speedRpm * 60) / 1e6;
    const GK = displacement_m3h / vGas;

    const etaV = G / GK;

    etaFeatures.push([1, Pc / Pe, Pc]);
    etaTargets.push(etaV);

    wFeatures.push([1, TE, TC, TC * TE, TE * TE]);
    wTargets.push(W);
  }

  const { A: A_eta, b: b_eta } = buildNormalEquations(etaFeatures, etaTargets);
  const etaCoeffs = gaussJordanSolve(A_eta, b_eta);

  const { A: A_w, b: b_w } = buildNormalEquations(wFeatures, wTargets);
  const wCoeffs = gaussJordanSolve(A_w, b_w);

  return { etaCoeffs, wCoeffs };
}

// =============================================================================
// Performance evaluation at a duty point
// =============================================================================

/**
 * Evaluates compressor performance at a given (TE, TC) operating point
 * using previously fitted polynomial coefficients.
 *
 * All thermodynamic properties at the suction plane use the fixed suction
 * temperature (32.2 °C) and the evaporating pressure Pe — identical to the
 * convention used during coefficient fitting in computeCompressorCoefficients.
 *
 * @param {number}   TE               - Evaporating temperature (°C)
 * @param {number}   TC               - Condensing temperature (°C)
 * @param {number}   refrigerantIndex - 1 = R-134a, 2 = R-600a
 * @param {number[]} wCoeffs          - [AW, BW, CW, DW, EW]
 * @param {number[]} etaCoeffs        - [A, B, C]
 * @param {number}   cylinderVolumeCm3 - Swept volume (cm³)
 * @param {number}   speedRpm          - Shaft speed (RPM)
 *
 * @returns {{
 *   Pe:                   number,  // Evaporating pressure (bar)
 *   Pc:                   number,  // Condensing pressure (bar)
 *   VolumetricEfficiency: number,  // ηv = A + B·(Pc/Pe) + C·Pc  (dimensionless)
 *   QCompressor:          number,  // Cooling capacity (W)
 *   CompPower:            number   // Electrical input power (W)
 * }}
 *
 * @throws {Error} If the refrigerant index is invalid
 */
export function compressorPower(
  TE,
  TC,
  refrigerantIndex,
  wCoeffs,
  etaCoeffs,
  cylinderVolumeCm3,
  speedRpm
) {
  // ── 1. Input power from W polynomial ──────────────────────────────────────
  const [AW, BW, CW, DW, EW] = wCoeffs;
  const CompPower = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;

  // ── 2. Saturation pressures ────────────────────────────────────────────────
  const prop = getRefrigerantProperties(refrigerantIndex);

  const Pe = prop.satPressure(TE + KELVIN_OFFSET);
  const Pc = prop.satPressure(TC + KELVIN_OFFSET);

  // ── 3. Volumetric efficiency from ηv polynomial ───────────────────────────
  const [A, B, C] = etaCoeffs;
  const VolumetricEfficiency = A + B * (Pc / Pe) + C * Pc;

  // ── 4. Thermodynamic state at the fixed suction plane ─────────────────────
  // Must match the convention in computeCompressorCoefficients:
  //   temperature = SUCTION_TEMP_C (32.2 °C), pressure = Pe
  const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
  const vGas = prop.specificVolume(suctionTempK, Pe);
  const hLiq = prop.liquidEnthalpy(SUCTION_TEMP_C);
  const hGas = prop.gasEnthalpy(suctionTempK, Pe);

  // ── 5. Actual mass flow and cooling capacity ──────────────────────────────
  //   displacement [m³/h] = VC [cm³] × N [rpm] × 60 / 1×10⁶
  //   G [kg/h]            = ηv × displacement / v_gas
  //   Q [W]          = G × (h_gas − h_liq)
  const displacement_m3h = (cylinderVolumeCm3 * speedRpm * 60) / 1e6;
  const G           = VolumetricEfficiency * displacement_m3h / vGas;
  const QCompressor = G * (hGas - hLiq)/3.6;

  return {
    Pe,
    Pc,
    VolumetricEfficiency,
    QCompressor,
    CompPower,
    massFlow: G
  };
}

// =============================================================================
// Example usage (Node.js — remove comment delimiters to run)
// =============================================================================
/*
if (typeof window === 'undefined') {
  const testData = {
    cylinderVolumeCm3: 10.17,
    speedRpm: 2220,
    refrigerantIndex: 2,   // R-600a
    dataPoints: [
      { TE: -34.4, TC: 37.8, Q:  70.554507,  W:  49.7 },
      { TE: -34.4, TC: 46.1, Q:  67.112824,  W:  51.3 },
      { TE: -34.4, TC: 54.4, Q:  61.950299,  W:  72.0 },
      { TE: -23.3, TC: 37.8, Q: 129.063122,  W:  67.6 },
      { TE: -23.3, TC: 46.1, Q: 126.481860,  W:  72.4 },
      { TE: -23.3, TC: 54.4, Q: 121.319335,  W: 141.0 },
      { TE: -12.2, TC: 37.8, Q: 215.105204,  W:  86.2 },
      { TE: -12.2, TC: 46.1, Q: 210.803100,  W:  93.5 },
      { TE: -12.2, TC: 54.4, Q: 203.919733,  W: 237.0 },
    ],
  };

  const { etaCoeffs, wCoeffs } = computeCompressorCoefficients(testData);

  console.log('=== Volumetric Efficiency Coefficients ===');
  console.log(`A  = ${etaCoeffs[0]}`);
  console.log(`B  = ${etaCoeffs[1]}`);
  console.log(`C  = ${etaCoeffs[2]}`);
  console.log('ηv = A + B·(Pc/Pe) + C·Pc');

  console.log('\n=== Input Power Coefficients ===');
  console.log(`AW = ${wCoeffs[0]}`);
  console.log(`BW = ${wCoeffs[1]}`);
  console.log(`CW = ${wCoeffs[2]}`);
  console.log(`DW = ${wCoeffs[3]}`);
  console.log(`EW = ${wCoeffs[4]}`);
  console.log('W  = AW + BW·TE + CW·TC + DW·TC·TE + EW·TE²');

  // Expected (from original VBA macro):
  // A  =  0.9302583559597055
  // B  = -0.012294405565323853
  // C  = -0.0020532051517885733
  // AW = -403.45924099760987
  // BW =  -10.669447614327456
  // CW =   13.074324324321825
  // DW =    0.34869206555942833
  // EW =    0.037469902334827346

  const point = compressorPower(
    -23.3, 46.1, 2,
    wCoeffs, etaCoeffs,
    testData.cylinderVolumeCm3,
    testData.speedRpm
  );
  console.log('\n=== Duty Point: TE = -23.3 °C, TC = 46.1 °C ===');
  console.log(`Pe                   = ${point.Pe.toFixed(4)} bar`);
  console.log(`Pc                   = ${point.Pc.toFixed(4)} bar`);
  console.log(`Volumetric efficiency = ${point.VolumetricEfficiency.toFixed(4)}`);
  console.log(`Cooling capacity      = ${point.QCompressor.toFixed(2)} W`);
  console.log(`Input power           = ${point.CompPower.toFixed(2)} W`);
}
*/