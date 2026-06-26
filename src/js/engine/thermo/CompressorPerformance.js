/**
 * CompressorPerformance.js
 *
 * Replicates the coefficient calculation of the VBA macro "Record2" and "JOTA"
 * for a reciprocating compressor performance model.
 *
 * The macro fits two polynomial models by ordinary least squares:
 *   1. Volumetric efficiency: ηv = A + B * (Pc / Pe) + C * Pc
 *   2. Input power (if data available): W = AW + BW*TE + CW*TC + DW*TC*TE + EW*TE^2
 *
 * Refrigerant properties are computed using the equations embedded in the
 * "JOTA" subroutine for R-134a (REI=1) and R-600a (REI=2).
 *
 * Original reference:
 *   - Record2 macro (VBA) – data reading, coefficient fitting, output
 *   - JOTA subroutine – refrigerant property calculations
 *   - MATX subroutine – Gauss-Jordan elimination solver
 *
 * Author: [Your Name]
 * Date:   2026-06-25
 */

// -----------------------------------------------------------------------------
// Constants (from macro)
// -----------------------------------------------------------------------------

/** Fixed suction gas temperature in °C (macro variable T) */
const SUCTION_TEMP_C = 32.2;
/** Offset to convert Celsius to Kelvin */
const KELVIN_OFFSET = 273.16;

// -----------------------------------------------------------------------------
// Refrigerant Property Functions
// These are direct translations of the "JOTA" subroutine cases.
// All pressure outputs are in bar; enthalpies are in (consistent units with Q).
// -----------------------------------------------------------------------------

/**
 * Compute saturation pressure for R-134a.
 * @param {number} T_Kelvin - Temperature in Kelvin
 * @returns {number} Saturation pressure in bar
 */
function r134a_satPressure(T_Kelvin) {
  return Math.exp(
    104.918 -
      5301.3 / T_Kelvin -
      16.2481 * Math.log(T_Kelvin) +
      0.0246593 * T_Kelvin
  );
}

/**
 * R-134a liquid enthalpy at temperature T (Celsius).
 * @param {number} T_C - Temperature in °C
 * @returns {number} Enthalpy (same energy unit as Q)
 */
function r134a_liquidEnthalpy(T_C) {
  return (
    100.019 +
    0.31763 * T_C +
    0.00033057 * T_C ** 2 +
    0.0000035281 * T_C ** 3
  );
}

/**
 * R-134a suction gas enthalpy.
 * @param {number} TA0_Kelvin - Suction temperature (Kelvin)
 * @param {number} Pe_bar - Evaporating pressure (bar)
 * @returns {number} Enthalpy (same unit as Q)
 */
function r134a_gasEnthalpy(TA0_Kelvin, Pe_bar) {
  return (
    119.36 +
    0.023174 * TA0_Kelvin +
    0.00031297 * TA0_Kelvin ** 2 -
    (138.07 * Pe_bar) / TA0_Kelvin
  );
}

/**
 * R-134a suction gas specific volume.
 * @param {number} TA0_Kelvin - Suction temperature (Kelvin)
 * @param {number} Pe_bar - Evaporating pressure (bar)
 * @returns {number} Specific volume in m³/kg (units consistent with macro)
 */
function r134a_specificVolume(TA0_Kelvin, Pe_bar) {
  return (
    0.01077 +
    (0.0008278 * TA0_Kelvin) / Pe_bar -
    4.511 / TA0_Kelvin -
    0.000118 * Pe_bar
  );
}

// -----------------------------------------------------------------------------
// R-600a (REI = 2)
// -----------------------------------------------------------------------------

/**
 * Compute saturation pressure for R-600a.
 * @param {number} T_Kelvin - Temperature in Kelvin
 * @returns {number} Saturation pressure in bar
 */
function r600a_satPressure(T_Kelvin) {
  return Math.exp(
    68.322 -
      4401 / T_Kelvin -
      9.8436 * Math.log(T_Kelvin) +
      0.0127711 * T_Kelvin
  );
}

/**
 * R-600a liquid enthalpy at temperature T (Celsius).
 * @param {number} T_C - Temperature in °C
 * @returns {number} Enthalpy
 */
function r600a_liquidEnthalpy(T_C) {
  return (
    75.545 +
    0.55731 * T_C +
    0.0007088 * T_C ** 2 +
    0.0000029408 * T_C ** 3
  );
}

/**
 * R-600a suction gas enthalpy.
 * @param {number} TA0_Kelvin - Suction temperature (Kelvin)
 * @param {number} Pe_bar - Evaporating pressure (bar)
 * @returns {number} Enthalpy
 */
function r600a_gasEnthalpy(TA0_Kelvin, Pe_bar) {
  return (
    104.5 +
    0.049951 * TA0_Kelvin +
    0.00058822 * TA0_Kelvin ** 2 -
    (249.18 * Pe_bar) / TA0_Kelvin
  );
}

/**
 * R-600a suction gas specific volume.
 * @param {number} TA0_Kelvin - Suction temperature (Kelvin)
 * @param {number} Pe_bar - Evaporating pressure (bar)
 * @returns {number} Specific volume in m³/kg
 */
function r600a_specificVolume(TA0_Kelvin, Pe_bar) {
  return (
    0.015883 +
    (0.001455 * TA0_Kelvin) / Pe_bar -
    7.2936 / TA0_Kelvin -
    0.0004645 * Pe_bar
  );
}

// -----------------------------------------------------------------------------
// Refrigerant property selector (like "JOTA" subroutine)
// -----------------------------------------------------------------------------

/**
 * Returns an object with functions to compute refrigerant properties for a
 * given refrigerant index (REI). The macro uses REI:
 *   1 = R-134a
 *   2 = R-600a
 *
 * @param {number} REI - Refrigerant index
 * @returns {{satPressure: Function, liquidEnthalpy: Function, gasEnthalpy: Function, specificVolume: Function}}
 */
function getRefrigerantProperties(REI) {
  if (REI === 1) {
    return {
      satPressure: r134a_satPressure,
      liquidEnthalpy: r134a_liquidEnthalpy,
      gasEnthalpy: r134a_gasEnthalpy,
      specificVolume: r134a_specificVolume,
    };
  } else if (REI === 2) {
    return {
      satPressure: r600a_satPressure,
      liquidEnthalpy: r600a_liquidEnthalpy,
      gasEnthalpy: r600a_gasEnthalpy,
      specificVolume: r600a_specificVolume,
    };
  } else {
    throw new Error("Unsupported refrigerant index. Use 1 (R-134a) or 2 (R-600a).");
  }
}

// -----------------------------------------------------------------------------
// Gauss-Jordan elimination solver (MATX subroutine)
// -----------------------------------------------------------------------------

/**
 * Solves the linear system Ax = b using Gauss-Jordan elimination.
 * The input matrix A is assumed to be square and non-singular.
 * On return the solution vector is returned and matrix A is modified.
 *
 * @param {number[][]} A - Square matrix (n x n)
 * @param {number[]} b - Right-hand side vector (length n)
 * @returns {number[]} Solution vector x
 */
function gaussJordanSolve(A, b) {
  const n = b.length;
  // Create augmented matrix [A | b]
  const M = A.map((row, i) => [...row, b[i]]);

  for (let k = 0; k < n; k++) {
    // Pivot: divide row k by M[k][k]
    const pivot = M[k][k];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("Zero pivot encountered; matrix is singular.");
    }
    for (let j = k; j <= n; j++) {
      M[k][j] /= pivot;
    }
    // Eliminate all other rows
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const factor = M[i][k];
      for (let j = k; j <= n; j++) {
        M[i][j] -= factor * M[k][j];
      }
    }
  }
  // Extract solution (last column)
  return M.map((row) => row[n]);
}

// -----------------------------------------------------------------------------
// Normal equations builder (least squares)
// -----------------------------------------------------------------------------

/**
 * Builds the normal equation matrix A and vector b for ordinary least squares.
 * Each row of `features` is a feature vector for one data point.
 * `targets` are the corresponding observed values.
 *
 * @param {number[][]} features - Array of feature vectors (each length m)
 * @param {number[]} targets - Observed outputs
 * @returns {{A: number[][], b: number[]}} Normal equations: A x = b
 */
function buildNormalEquations(features, targets) {
  const m = features[0].length; // number of features (including constant term)
  const n = features.length;    // number of data points
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);

  for (let i = 0; i < n; i++) {
    const f = features[i];
    const y = targets[i];
    for (let j = 0; j < m; j++) {
      // A[j][k] = sum( f_j * f_k )
      for (let k = 0; k < m; k++) {
        A[j][k] += f[j] * f[k];
      }
      b[j] += f[j] * y;
    }
  }
  return { A, b };
}

// -----------------------------------------------------------------------------
// Main coefficient calculation (equivalent to macro Record2 logic)
// -----------------------------------------------------------------------------

/**
 * Computes the volumetric efficiency and input power coefficients from compressor test data.
 *
 * The algorithm mirrors the VBA macro "Record2":
 * 1. For each test point, compute Pe, Pc from TE and TC using the refrigerant equation.
 * 2. Compute liquid enthalpy at the fixed suction temperature (32.2°C) once.
 * 3. For each point, compute suction gas enthalpy and specific volume.
 * 4. Calculate actual mass flow from cooling capacity: G = Q / (h_gas - h_liquid).
 * 5. Calculate theoretical mass flow: GK = (VC * RPM * 60) / (VG * 1e6).
 * 6. Volumetric efficiency (used as observed) = G / GK.
 * 7. Build design matrices:
 *      ηv model: features = [1, Pc/Pe, Pc]
 *      W model : features = [1, TE, TC, TC*TE, TE^2]
 * 8. Solve normal equations via Gauss-Jordan.
 *
 * @param {Object} params - Compressor parameters and test data.
 * @param {number} params.cylinderVolumeCm3 - Cylinder volume (cm³), e.g., 10.17
 * @param {number} params.speedRpm - Rotational speed (RPM), e.g., 2220
 * @param {number} params.refrigerantIndex - 1 for R-134a, 2 for R-600a
 * @param {Array<{TE: number, TC: number, Q: number, W: number}>} params.dataPoints -
 *        Array of test points. TE: evaporating temperature (°C), TC: condensing temperature (°C),
 *        Q: cooling capacity (kcal/h), W:  input power (W).
 * @returns {Object} An object containing:
 *   - etaCoeffs: [A, B, C] for ηv = A + B*(Pc/Pe) + C*Pc
 *   - wCoeffs: [AW, BW, CW, DW, EW] 
 */
function computeCompressorCoefficients({
  cylinderVolumeCm3,
  speedRpm,
  refrigerantIndex,
  dataPoints,
}) {
  // Select refrigerant property functions (like JOTA)
  const prop = getRefrigerantProperties(refrigerantIndex);

  // ---------------------------------------------------------------------------
  // Step 1: Compute constant liquid enthalpy at fixed suction temperature (IIN)
  // In the macro, this is done once with T = 32.2 °C (and TD=32.2).
  // ---------------------------------------------------------------------------
  const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
  const hLiquidFixed = prop.liquidEnthalpy(SUCTION_TEMP_C);

  // Prepare arrays for regression features and targets
  const etaFeatures = [];   // each entry: [1, Pc/Pe, Pc]
  const etaTargets = [];

  const wFeatures = [];    // [1, TE, TC, TC*TE, TE^2]
  const wTargets = [];


  // ---------------------------------------------------------------------------
  // Step 2: Loop over all data points (NN = dataPoints.length)
  // ---------------------------------------------------------------------------
  for (let i = 0; i < dataPoints.length; i++) {
    const { TE, TC, Q, W } = dataPoints[i];

    // Convert temperatures to Kelvin (TAE, TAC, TA0)
    const TAE = TE + KELVIN_OFFSET;
    const TAC = TC + KELVIN_OFFSET;
    // TA0 is suction temperature in Kelvin (constant)

    // Compute saturation pressures (Pe, Pc)
    const Pe_bar = prop.satPressure(TAE);
    const Pc_bar = prop.satPressure(TAC);

    // Compute gas enthalpy at suction temperature and Pe
    const hGas = prop.gasEnthalpy(suctionTempK, Pe_bar);

    // Specific volume of suction gas
    const vGas_m3perkg = prop.specificVolume(suctionTempK, Pe_bar);

    // Actual mass flow rate: G = Q / (hGas - hLiquidFixed)   [kg/h]
    const actualMassFlow = Q / (hGas - hLiquidFixed);

    // Theoretical mass flow based on displacement:
    // Displacement volume per hour = (VC * RPM * 60) / 1e6  [m³/h]
    // GK = displacement / specific volume  [kg/h]
    const displacement_m3h = (cylinderVolumeCm3 * speedRpm * 60) / 1e6;
    const theoreticalMassFlow = displacement_m3h / vGas_m3perkg;

    // Volumetric efficiency (computed from measurements)
    const etaV = actualMassFlow / theoreticalMassFlow;

    // Store for ηv regression
    const pressureRatio = Pc_bar / Pe_bar;
    etaFeatures.push([1, pressureRatio, Pc_bar]);
    etaTargets.push(etaV);
      wFeatures.push([1, TE, TC, TC * TE, TE * TE]);
      wTargets.push(W);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Build and solve normal equations for ηv coefficients
  // ---------------------------------------------------------------------------
  const { A: A_eta, b: b_eta } = buildNormalEquations(etaFeatures, etaTargets);
  const etaCoeffs = gaussJordanSolve(A_eta, b_eta);   // [A, B, C]

  // ---------------------------------------------------------------------------
  // Step 4:  build and solve normal equations for W coefficients
  // ---------------------------------------------------------------------------
  let wCoeffs = null;
    const { A: A_w, b: b_w } = buildNormalEquations(wFeatures, wTargets);
    wCoeffs = gaussJordanSolve(A_w, b_w);   // [AW, BW, CW, DW, EW]
  

  return {
    etaCoeffs,   // [A, B, C]
    wCoeffs,     // [AW, BW, CW, DW, EW] 
  };
}
export function compressorPower(TE, TC,refrigerantIndex ,wCoeffs, etaCoeffs, cylinderVolumeCm3, speedRpm) {
  const [AW, BW, CW, DW, EW] = wCoeffs;
  const [A, B, C] = etaCoeffs;
  const CompPower = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;
  const correctionFactor = A + B * speedRpm + C * speedRpm * speedRpm;
  let Pe, Pc, specificVolume, liquidEnthalpy, gasEnthalpy;
  if (refrigerantIndex === 1) {
    Pe = r134a_satPressure(TE + 273.16);
    Pc = r134a_satPressure(TC + 273.16);
    specificVolume = r134a_specificVolume(TE + 273.16, Pe);
    liquidEnthalpy = r134a_liquidEnthalpy(SUCTION_TEMP_C);
    gasEnthalpy = r134a_gasEnthalpy(SUCTION_TEMP_C + 273.16, Pe);
  } else if (refrigerantIndex === 2) {
    Pe = r600a_satPressure(TE + 273.16);
    Pc = r600a_satPressure(TC + 273.16);
    specificVolume = r600a_specificVolume(TE + 273.16, Pe);
    liquidEnthalpy = r600a_liquidEnthalpy(SUCTION_TEMP_C);
    gasEnthalpy = r600a_gasEnthalpy(SUCTION_TEMP_C + 273.16, Pe);
  }
  const VolumetricEfficiency = correctionFactor * ( A + B * Pc / Pe + C * Pc);
  const G = VolumetricEfficiency * (cylinderVolumeCm3 * speedRpm * 60* 1e6) / (specificVolume );
  const QCompressor = G * (gasEnthalpy - liquidEnthalpy);
  return {
    QCompressor,
    CompPower,
    VolumetricEfficiency
  };
}
/***
// -----------------------------------------------------------------------------
// Example usage with sample data from the original Excel sheet (R-600a)
// -----------------------------------------------------------------------------
if (typeof window === 'undefined') { // Node.js environment test
  const testData = {
    cylinderVolumeCm3: 10.17,
    speedRpm: 2220,          // 37 rps * 60
    refrigerantIndex: 2,     // R-600a
    dataPoints: [
      { TE: -34.4, TC: 37.8, Q: 70.554507, W: 49.7 },
      { TE: -34.4, TC: 46.1, Q: 67.112824, W: 51.3 },
      { TE: -34.4, TC: 54.4, Q: 61.950299, W: 72 },
      { TE: -23.3, TC: 37.8, Q: 129.063122, W: 67.6 },
      { TE: -23.3, TC: 46.1, Q: 126.48186, W: 72.4 },
      { TE: -23.3, TC: 54.4, Q: 121.319335, W: 141 },
      { TE: -12.2, TC: 37.8, Q: 215.105204, W: 86.2 },
      { TE: -12.2, TC: 46.1, Q: 210.8031, W: 93.5 },
      { TE: -12.2, TC: 54.4, Q: 203.919733, W: 237 },
    ],
  };

  const result = computeCompressorCoefficients(testData);

  console.log("=== Volumetric Efficiency Coefficients ===");
  console.log(`A = ${result.etaCoeffs[0]}`);
  console.log(`B = ${result.etaCoeffs[1]}`);
  console.log(`C = ${result.etaCoeffs[2]}`);
  console.log("ηv = A + B * (Pc/Pe) + C * Pc");

  if (result.wCoeffs) {
    console.log("\n=== Input Power Coefficients ===");
    console.log(`AW = ${result.wCoeffs[0]}`);
    console.log(`BW = ${result.wCoeffs[1]}`);
    console.log(`CW = ${result.wCoeffs[2]}`);
    console.log(`DW = ${result.wCoeffs[3]}`);
    console.log(`EW = ${result.wCoeffs[4]}`);
    console.log("W = AW + BW*TE + CW*TC + DW*TC*TE + EW*TE^2");
  } else {
    console.log("\nNo input power data provided.");
  }

  // Expected values from macro:
  // A = 0.9302583559597055
  // B = -0.012294405565323853
  // C = -0.0020532051517885733
  // AW = -403.45924099760987
  // BW = -10.669447614327456
  // CW = 13.074324324321825
  // DW = 0.34869206555942833
  // EW = 0.037469902334827346
}*/