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
 *   GK   = (VC·N·60 / 1e6) / vGas                  [kg/h, theoretical mass flow]
 *   ηv   = G / GK
 *
 * @param {object} params
 * @param {number} params.cylinderVolumeCm3  - Swept volume (cm³)
 * @param {number} params.speedRpm           - Shaft speed (RPM)
 * @param {number} params.refrigerantIndex   - 1 = R-134a, 2 = R-600a
 * @param {Array<{TE: number, TC: number, Q: number, W: number}>} params.dataPoints - Test data
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
  //   temperature = SUCTION_TEMP_C (30 °C), pressure = Pe
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

/**
 * Fits inverter compressor models for Q and W, returns a compressorModel object.
 * Automatically selects the best global or piecewise model using Ridge‑CV.
 *
 * @param {Array} dataPoints - {RPM, TE, TC, Q, W}
 * @param {number} normalizeRPM - typical max RPM
 * @param {number} centerTE
 * @param {number} centerTC
 * @param {number} targetRMSE - desired accuracy threshold
 * @returns {Object} compressorModel ready for inverterCompressorPerformance
 */
export function fitInverterCoefficients(dataPoints, normalizeRPM, centerTE, centerTC, targetRMSE = 3.0) {
  const Qmodel = selectInverterModel(dataPoints, 'Q', targetRMSE, normalizeRPM, centerTE, centerTC);
  const Wmodel = selectInverterModel(dataPoints, 'W', targetRMSE, normalizeRPM, centerTE, centerTC);

  return {
    Q: Qmodel,
    W: Wmodel,
    normalizeRPM,
    centerTE,
    centerTC,
  };
}
// ========== Matrix utilities ==========
function matrixMultiply(A, B) {
  const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
  const C = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++)
    for (let k = 0; k < colsA; k++)
      for (let j = 0; j < colsB; j++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}
function transpose(A) {
  return A[0].map((_, c) => A.map(row => row[c]));
}
function identity(n) {
  const I = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}
function solveRidge(X, y, alpha) {
  const n = X.length;
  const p = X[0].length;

  // 1. Calculate means
  const xMeans = new Array(p).fill(0);
  let yMean = 0;
  for (let i = 0; i < n; i++) {
    yMean += y[i];
    for (let j = 0; j < p; j++) {
      xMeans[j] += X[i][j];
    }
  }
  yMean /= n;
  for (let j = 0; j < p; j++) xMeans[j] /= n;

  // 2. Calculate standard deviations (biased variance, matching Python's StandardScaler defaults)
  const xStds = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      xStds[j] += Math.pow(X[i][j] - xMeans[j], 2);
    }
  }
  for (let j = 0; j < p; j++) {
    xStds[j] = Math.sqrt(xStds[j] / n);
    if (xStds[j] === 0) xStds[j] = 1; // Prevent division by zero
  }

  // 3. Center and Scale X, Center y
  const X_scaled = Array.from({ length: n }, () => Array(p).fill(0));
  const y_centered = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    y_centered[i] = y[i] - yMean;
    for (let j = 0; j < p; j++) {
      X_scaled[i][j] = (X[i][j] - xMeans[j]) / xStds[j];
    }
  }

  // 4. Ridge Regression on Scaled Data: beta = (X^T X + alpha * I)^{-1} X^T y
  const Xt = transpose(X_scaled);
  const XtX = matrixMultiply(Xt, X_scaled);
  for (let j = 0; j < p; j++) XtX[j][j] += alpha; // Intercept is excluded, so penalize all p elements

  const Xty = Xt.map(row => row.reduce((sum, _, i) => sum + row[i] * y_centered[i], 0));
  const beta_scaled = gaussJordanSolve(XtX, Xty);

  // 5. Unscale coefficients to map back to raw X inputs
  const coefs_unscaled = new Array(p);
  let intercept_unscaled = yMean;

  for (let j = 0; j < p; j++) {
    coefs_unscaled[j] = beta_scaled[j] / xStds[j];
    intercept_unscaled -= coefs_unscaled[j] * xMeans[j];
  }

  // Return array: [intercept, feature_1, feature_2, ...]
  return [intercept_unscaled, ...coefs_unscaled];
}
// ========== Feature generation for inverter ==========
function makeFeatures(rpmForm, n, te, tc) {
  switch (rpmForm) {
    case 'n_lin':
      return [n, n*te, n*tc, n*tc*te, n*te**2];
    case 'n_quad':
      return [n, n**2, n*te, n*tc, n*tc*te, n*te**2];
    case 'ln_n_lin':
      const ln_n_lin = Math.log(Math.max(n, 1e-12));
      return [ln_n_lin, ln_n_lin*te, ln_n_lin*tc, ln_n_lin*tc*te, ln_n_lin*te**2];
    case 'ln_n_quad':
      const ln_n_quad = Math.log(Math.max(n, 1e-12));
      return [ln_n_quad, ln_n_quad**2, ln_n_quad*te, ln_n_quad*tc, ln_n_quad*tc*te, ln_n_quad*te**2];
    default:
      throw new Error(`Unknown rpmForm: ${rpmForm}`);
  }
}

// ========== Cross‑validation (Leave‑One‑Group‑Out by RPM) ==========
function cvInverter(dataPoints, targetCol, rpmForm, logTransform, alphas, normalizeRPM, centerTE, centerTC) {
  const groups = dataPoints.map(d => d.RPM);
  const uniqueGroups = [...new Set(groups)];
  if (uniqueGroups.length < 2) return { avgRMSE: Infinity };

  let bestAlpha = null, bestAvgRMSE = Infinity;
  for (const alpha of alphas) {
    let sumRMSE = 0, validFolds = 0;
    for (const g of uniqueGroups) {
      const trainIdx = [], testIdx = [];
      dataPoints.forEach((d, i) => {
        if (d.RPM === g) testIdx.push(i);
        else trainIdx.push(i);
      });
      if (trainIdx.length < 2 || testIdx.length === 0) continue;

      // Build training matrix
      const Xtrain = trainIdx.map(i => {
        const d = dataPoints[i];
        return makeFeatures(rpmForm, d.RPM / normalizeRPM, d.TE - centerTE, d.TC - centerTC);
      });
      const yTrain = trainIdx.map(i => {
        const v = dataPoints[i][targetCol];
        return logTransform ? Math.log(v) : v;
      });
      const coeffs = solveRidge(Xtrain, yTrain, alpha);

      // Evaluate on test
      const Xtest = testIdx.map(i => {
        const d = dataPoints[i];
        return makeFeatures(rpmForm, d.RPM / normalizeRPM, d.TE - centerTE, d.TC - centerTC);
      });
      // Shift indices to separate the intercept
      const preds = Xtest.map(xi => coeffs[0] + xi.reduce((s, x, j) => s + x * coeffs[j + 1], 0));      
      const actual = testIdx.map(i => dataPoints[i][targetCol]);
      const errs = actual.map((a, i) => {
        const p = logTransform ? Math.exp(preds[i]) : preds[i];
        return (p - a) ** 2;
      });
      const rmse = Math.sqrt(errs.reduce((s, e) => s + e, 0) / errs.length);
      sumRMSE += rmse;
      validFolds++;
    }
    const avgRMSE = validFolds > 0 ? sumRMSE / validFolds : Infinity;
    if (avgRMSE < bestAvgRMSE) {
      bestAvgRMSE = avgRMSE;
      bestAlpha = alpha;
    }
  }
  return { alpha: bestAlpha, avgRMSE: bestAvgRMSE };
}

// ========== Piecewise model ==========
function fitPiecewiseInverter(dataPoints, targetCol, splitRPM, normalizeRPM, centerTE, centerTC) {
  const lowData = dataPoints.filter(d => d.RPM <= splitRPM);
  if (lowData.length < 6) throw new Error('Not enough low‑range points for piecewise fit.');
  const N_low = splitRPM;
  const X = lowData.map(d => makeFeatures('n_quad', d.RPM / N_low, d.TE - centerTE, d.TC - centerTC));
  const y = lowData.map(d => d[targetCol]);
  const coeffs = solveRidge(X, y, 1.0); // fixed alpha
  const maxRPM = Math.max(...dataPoints.map(d => d.RPM));
  const maxData = dataPoints.filter(d => d.RPM === maxRPM);
  const X_max = maxData.map(d => makeFeatures('n_quad', 1.0, d.TE - centerTE, d.TC - centerTC));
  const y_max = maxData.map(d => d[targetCol]);
  const coeffs_max = solveRidge(X_max, y_max, 1.0);
  const lookup = {};
  maxData.forEach(d => { lookup[`${d.TE},${d.TC}`] = d[targetCol]; });

  // Build predict function
  const predict = (RPM, TE, TC) => {
    if (RPM <= splitRPM) {
      const feat = makeFeatures('n_quad', RPM / N_low, TE - centerTE, TC - centerTC);
      // Shift indices to separate the intercept
      return coeffs[0] + feat.reduce((s, f, i) => s + f * coeffs[i + 1], 0);
    } else if (RPM === maxRPM) {
        const feat = makeFeatures('n_quad', 1.0, TE - centerTE, TC - centerTC);
        return coeffs_max[0] + feat.reduce((s, f, i) => s + f * coeffs_max[i + 1], 0);
    } else {
      const valLow = predict(splitRPM, TE, TC);
      const valMax = predict(maxRPM, TE, TC);
      const frac = (RPM - splitRPM) / (maxRPM - splitRPM);
      return valLow + (valMax - valLow) * frac;
    }
  };

  // Compute overall RMSE
  const preds = dataPoints.map(d => predict(d.RPM, d.TE, d.TC));
  const mse = preds.reduce((s, p, i) => s + (p - dataPoints[i][targetCol])**2, 0) / preds.length;
  return {
    type: 'piecewise',
    splitRPM, maxRPM,
    coeffs_low: coeffs,
    lookup,
    rmse: Math.sqrt(mse),
    predict,
  };
}

// ========== Auto‑split detection ==========
/**
 * Evaluate candidate split points and return the best model.
 * Returns an object: { type: 'global'|'piecewise', model: {...} }
 */
function selectBestInverterModel(dataPoints, targetCol, targetRMSE, normalizeRPM, centerTE, centerTC) {
    const uniqueRPMs = [...new Set(dataPoints.map(d => d.RPM))].sort((a,b)=>a-b);
    if (uniqueRPMs.length < 3) {
        // Not enough RPM levels for piecewise; use global
        return buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE);
    }

    // First, fit the best global model
    const globalBest = buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE);
    if (!globalBest) return null;

    // Evaluate piecewise models for each possible split (between the 2nd and second-last RPM)
    let bestPiecewise = null;
    let bestPiecewiseRMSE = Infinity;
    for (let idx = 1; idx < uniqueRPMs.length - 1; idx++) {
        const splitRPM = uniqueRPMs[idx];
        try {
            const pw = fitPiecewiseInverter(dataPoints, targetCol, splitRPM, normalizeRPM, centerTE, centerTC);
            if (pw.rmse < bestPiecewiseRMSE) {
                bestPiecewiseRMSE = pw.rmse;
                bestPiecewise = pw;
            }
        } catch (e) {
            // skip if fitting fails
        }
    }

    // Compare using a penalty for piecewise complexity (e.g., +0.5 to RMSE)
    const globalRMSE = globalBest.cvRMSE || globalBest.rmse;
    const piecewisePenalty = 0.5; // adjust based on desired complexity trade-off
    const adjustedPiecewiseRMSE = bestPiecewise ? bestPiecewise.rmse + piecewisePenalty : Infinity;

    if (bestPiecewise && adjustedPiecewiseRMSE < globalRMSE) {
        return { type: 'piecewise', model: bestPiecewise };
    } else {
        return { type: 'global', model: globalBest };
    }
}

/**
 * Fit the best global model (choose among forms and log transforms)
 */
function buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE) {
    const globalCandidates = ['n_lin', 'n_quad', 'ln_n_lin', 'ln_n_quad'];
    const logOptions = [false, true];
    const alphas = [0.001, 0.01, 0.1, 1, 10, 100];

    let best = null;
    let bestRMSE = Infinity;

    for (const rpmForm of globalCandidates) {
        for (const logTrans of logOptions) {
            const cv = cvInverter(dataPoints, targetCol, rpmForm, logTrans, alphas, normalizeRPM, centerTE, centerTC);
            if (cv.avgRMSE < bestRMSE) {
                bestRMSE = cv.avgRMSE;
                best = { type: 'global', rpmForm, logTransform: logTrans, alpha: cv.alpha, cvRMSE: cv.avgRMSE };
            }
        }
    }

    if (!best) return null;

    // Refit on all data with best parameters
    const X = dataPoints.map(d => makeFeatures(best.rpmForm, d.RPM / normalizeRPM, d.TE - centerTE, d.TC - centerTC));
    const y = best.logTransform ? dataPoints.map(d => Math.log(d[targetCol])) : dataPoints.map(d => d[targetCol]);
    const coeffs = solveRidge(X, y, best.alpha);
    return { ...best, coeffs, rmse: bestRMSE };
}
// ========== Main selector ==========
function selectInverterModel(dataPoints, targetCol, targetRMSE, normalizeRPM, centerTE, centerTC) {
    const best = selectBestInverterModel(dataPoints, targetCol, targetRMSE, normalizeRPM, centerTE, centerTC);
    if (!best) {
        // Fallback: simplest global model
        const fallback = buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE);
        if (!fallback) throw new Error(`Could not fit model for ${targetCol}`);
        return fallback;
    }
    if (best.type === 'global') return best.model;
    else return best.model; // piecewise model already returned as an object
}
// ========== Public API ==========

/**
 * Evaluates inverter compressor performance using a pre‑fitted compressorModel.
 */
export function inverterCompressorPerformance(TE, TC, RPM, refrigerantIndex, compressorModel) {
  const { Q, W, normalizeRPM, centerTE, centerTC } = compressorModel;

  const predict = (model, TE, TC, RPM) => {
    if (model.type === 'global') {
      const feat = makeFeatures(model.rpmForm, RPM / normalizeRPM, TE - centerTE, TC - centerTC);
      // Shift indices to separate the intercept
      const y = model.coeffs[0] + feat.reduce((s, f, i) => s + f * model.coeffs[i + 1], 0);
      return model.logTransform ? Math.exp(y) : y;
    } else if (model.type === 'piecewise') {
      return model.predict(RPM, TE, TC);
    }
    return NaN;
  };

  const QCompressor = predict(Q, TE, TC, RPM);
  const CompPower    = predict(W, TE, TC, RPM);

  // Refrigerant properties for mass flow, Pe, Pc (same as old code)
  const prop         = getRefrigerantProperties(refrigerantIndex);
  const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
  const Pe           = prop.satPressure(TE + KELVIN_OFFSET);
  const Pc           = prop.satPressure(TC + KELVIN_OFFSET);
  const hGas         = prop.gasEnthalpy(suctionTempK, Pe);
  const hLiquid      = prop.liquidEnthalpy(SUCTION_TEMP_C);
  const massFlow     = QCompressor * 3.6 / (hGas - hLiquid);

  return {
    QCompressor,
    CompPower,
    massFlow,
    Pe,
    Pc,
    VolumetricEfficiency: null,   // not available for inverter
  };
}