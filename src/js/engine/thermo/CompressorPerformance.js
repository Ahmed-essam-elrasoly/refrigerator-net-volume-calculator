/**
 * @file CompressorPerformance.js
 * @description Translates abstract test points (Excel Data) into fitted mathematical models 
 * representing compressor behavior across varying temperatures and RPMs.
 * Uses Ordinary Least Squares (OLS) for constant speed and Ridge Regression for Inverters.
 */

const SUCTION_TEMP_C = 30;
const KELVIN_OFFSET = 273.16;

function r134a_satPressure(T_K) { return Math.exp(104.918 - 5301.3 / T_K - 16.2481 * Math.log(T_K) + 0.0246593 * T_K); }
function r134a_liquidEnthalpy(T_C) { return (100.019 * 4.1868 + 0.31763 * T_C * 4.1868 + 0.00033057 * T_C ** 2 * 4.1868 + 0.0000035281 * T_C ** 3 * 4.1868); }
function r134a_gasEnthalpy(T_K, Pe) { return (119.36 * 4.1868 + 0.023174 * T_K * 4.1868 + 0.00031297 * 4.1868 * T_K ** 2 - (138.07 * 4.1868 * Pe) / T_K); }
function r134a_specificVolume(T_K, Pe) { return (0.01077 + (0.0008278 * T_K) / Pe - 4.511 / T_K - 0.000118 * Pe); }

function r600a_satPressure(T_K) { return Math.exp(68.322 - 4401 / T_K - 9.8436 * Math.log(T_K) + 0.0127711 * T_K); }
function r600a_liquidEnthalpy(T_C) { return (75.545 * 4.1868 + 0.55731 * T_C * 4.1868 + 0.0007088 * T_C ** 2 * 4.1868 + 0.0000029408 * T_C ** 3 * 4.1868); }
function r600a_gasEnthalpy(T_K, Pe) { return (104.5 * 4.1868 + 0.049951 * T_K * 4.1868 + 0.00058822 * 4.1868 * T_K ** 2 - (249.18 * 4.1868 * Pe) / T_K); }
function r600a_specificVolume(T_K, Pe) { return (0.015883 + (0.001455 * T_K) / Pe - 7.2936 / T_K - 0.0004645 * Pe); }

/**
 * Routes requests to the appropriate refrigerant physical property algorithms.
 */
export function getRefrigerantProperties(REI) {
  if (REI === 1) return { satPressure: r134a_satPressure, liquidEnthalpy: r134a_liquidEnthalpy, gasEnthalpy: r134a_gasEnthalpy, specificVolume: r134a_specificVolume };
  if (REI === 2) return { satPressure: r600a_satPressure, liquidEnthalpy: r600a_liquidEnthalpy, gasEnthalpy: r600a_gasEnthalpy, specificVolume: r600a_specificVolume };
  throw new Error(`Unsupported refrigerant index ${REI}.`);
}

export function getRefrigerantFunctionsC(refrigerantIndex) {
  const prop = getRefrigerantProperties(refrigerantIndex);
  return {
    satPressure:     (t)    => prop.satPressure(t + 273.16),
    specificVolume:  (t, p) => prop.specificVolume(t + 273.16, p),
    vaporEnthalpy:   (t, p) => prop.gasEnthalpy(t + 273.16, p),
    liquidEnthalpy:  (t)    => prop.liquidEnthalpy(t),
  };
}

/**
 * Solves Ax = b by Gauss-Jordan elimination with partial pivoting.
 */
function gaussJordanSolve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let k = 0; k < n; k++) {
    let maxRow = k;
    let maxAbs = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const abs = Math.abs(M[i][k]);
      if (abs > maxAbs) { maxAbs = abs; maxRow = i; }
    }
    if (maxRow !== k) [M[k], M[maxRow]] = [M[maxRow], M[k]];

    const pivot = M[k][k];
    if (Math.abs(pivot) < 1e-12) throw new Error(`Singular matrix at column ${k}.`);

    for (let j = k; j <= n; j++) M[k][j] /= pivot;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const factor = M[i][k];
      for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
    }
  }
  return M.map((row) => row[n]);
}

function buildNormalEquations(features, targets) {
  const n = features.length;
  const m = features[0].length;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);

  for (let i = 0; i < n; i++) {
    const f = features[i];
    const y = targets[i];
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < m; k++) A[j][k] += f[j] * f[k];
      b[j] += f[j] * y;
    }
  }
  return { A, b };
}

/**
 * Uses OLS to generate polynomial coefficients representing compressor performance.
 * 
 * @param {Object} params - Config including dataPoints and physical displacement.
 * @returns {Object} etaCoeffs (Efficiency) and wCoeffs (Power) arrays.
 */
export function computeCompressorCoefficients({ cylinderVolumeCm3, speedRpm, refrigerantIndex, dataPoints }) {
  if (!Array.isArray(dataPoints) || dataPoints.length < 5) throw new Error('At least 5 points required.');

  const prop = getRefrigerantProperties(refrigerantIndex);
  const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
  const hLiquid = prop.liquidEnthalpy(SUCTION_TEMP_C);

  const etaFeatures = [], etaTargets = [], wFeatures = [], wTargets = [];

  for (const { TE, TC, Q, W } of dataPoints) {
    const Pe = prop.satPressure(TE + KELVIN_OFFSET);
    const Pc = prop.satPressure(TC + KELVIN_OFFSET);
    const hGas = prop.gasEnthalpy(suctionTempK, Pe);
    const vGas = prop.specificVolume(suctionTempK, Pe);

    const G = Q * 3.6 / (hGas - hLiquid);
    const GK = (cylinderVolumeCm3 * speedRpm * 60) / 1e6 / vGas;

    etaFeatures.push([1, Pc / Pe, Pc]);
    etaTargets.push(G / GK);
    wFeatures.push([1, TE, TC, TC * TE, TE * TE]);
    wTargets.push(W);
  }

  return {
    etaCoeffs: gaussJordanSolve(buildNormalEquations(etaFeatures, etaTargets).A, buildNormalEquations(etaFeatures, etaTargets).b),
    wCoeffs: gaussJordanSolve(buildNormalEquations(wFeatures, wTargets).A, buildNormalEquations(wFeatures, wTargets).b)
  };
}

/**
 * Maps the solved polynomials back to physical outputs for a specific duty point.
 */
export function compressorPower(TE, TC, refrigerantIndex, wCoeffs, etaCoeffs, cylinderVolumeCm3, speedRpm) {
  const [AW, BW, CW, DW, EW] = wCoeffs;
  const CompPower = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;

  const prop = getRefrigerantProperties(refrigerantIndex);
  const Pe = prop.satPressure(TE + KELVIN_OFFSET);
  const Pc = prop.satPressure(TC + KELVIN_OFFSET);

  const [A, B, C] = etaCoeffs;
  const VolumetricEfficiency = A + B * (Pc / Pe) + C * Pc;

  const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
  const vGas = prop.specificVolume(suctionTempK, Pe);
  const hLiq = prop.liquidEnthalpy(SUCTION_TEMP_C);
  const hGas = prop.gasEnthalpy(suctionTempK, Pe);

  const G = VolumetricEfficiency * ((cylinderVolumeCm3 * speedRpm * 60) / 1e6) / vGas;
  
  return { Pe, Pc, VolumetricEfficiency, QCompressor: G * (hGas - hLiq)/3.6, CompPower, massFlow: G };
}

// Ridge Regression & Matrix utilities for Inverter modeling
function matrixMultiply(A, B) {
  const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
  const C = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) for (let k = 0; k < colsA; k++) for (let j = 0; j < colsB; j++) C[i][j] += A[i][k] * B[k][j];
  return C;
}
function transpose(A) { return A[0].map((_, c) => A.map(row => row[c])); }

function solveRidge(X, y, alpha) {
  const n = X.length, p = X[0].length;
  const xMeans = new Array(p).fill(0);
  let yMean = 0;
  for (let i = 0; i < n; i++) { yMean += y[i]; for (let j = 0; j < p; j++) xMeans[j] += X[i][j]; }
  yMean /= n; for (let j = 0; j < p; j++) xMeans[j] /= n;

  const xStds = new Array(p).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) xStds[j] += Math.pow(X[i][j] - xMeans[j], 2);
  for (let j = 0; j < p; j++) { xStds[j] = Math.sqrt(xStds[j] / n); if (xStds[j] === 0) xStds[j] = 1; }

  const X_scaled = Array.from({ length: n }, () => Array(p).fill(0)), y_centered = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { y_centered[i] = y[i] - yMean; for (let j = 0; j < p; j++) X_scaled[i][j] = (X[i][j] - xMeans[j]) / xStds[j]; }

  const Xt = transpose(X_scaled), XtX = matrixMultiply(Xt, X_scaled);
  for (let j = 0; j < p; j++) XtX[j][j] += alpha; 

  const Xty = Xt.map(row => row.reduce((sum, _, i) => sum + row[i] * y_centered[i], 0));
  const beta_scaled = gaussJordanSolve(XtX, Xty);

  const coefs_unscaled = new Array(p);
  let intercept_unscaled = yMean;
  for (let j = 0; j < p; j++) { coefs_unscaled[j] = beta_scaled[j] / xStds[j]; intercept_unscaled -= coefs_unscaled[j] * xMeans[j]; }

  return [intercept_unscaled, ...coefs_unscaled];
}

function makeFeatures(rpmForm, n, te, tc) {
  switch (rpmForm) {
    case 'n_lin': return [n, n*te, n*tc, n*tc*te, n*te**2];
    case 'n_quad': return [n, n**2, n*te, n*tc, n*tc*te, n*te**2];
    case 'ln_n_lin': const ln1 = Math.log(Math.max(n, 1e-12)); return [ln1, ln1*te, ln1*tc, ln1*tc*te, ln1*te**2];
    case 'ln_n_quad': const ln2 = Math.log(Math.max(n, 1e-12)); return [ln2, ln2**2, ln2*te, ln2*tc, ln2*tc*te, ln2*te**2];
    default: throw new Error(`Unknown rpmForm: ${rpmForm}`);
  }
}

function cvInverter(dataPoints, targetCol, rpmForm, logTransform, alphas, normalizeRPM, centerTE, centerTC) {
  const groups = dataPoints.map(d => d.RPM), uniqueGroups = [...new Set(groups)];
  if (uniqueGroups.length < 2) return { avgRMSE: Infinity };

  let bestAlpha = null, bestAvgRMSE = Infinity;
  for (const alpha of alphas) {
    let sumRMSE = 0, validFolds = 0;
    for (const g of uniqueGroups) {
      const trainIdx = [], testIdx = [];
      dataPoints.forEach((d, i) => { d.RPM === g ? testIdx.push(i) : trainIdx.push(i); });
      if (trainIdx.length < 2 || testIdx.length === 0) continue;

      const Xtrain = trainIdx.map(i => makeFeatures(rpmForm, dataPoints[i].RPM / normalizeRPM, dataPoints[i].TE - centerTE, dataPoints[i].TC - centerTC));
      const yTrain = trainIdx.map(i => logTransform ? Math.log(dataPoints[i][targetCol]) : dataPoints[i][targetCol]);
      const coeffs = solveRidge(Xtrain, yTrain, alpha);

      const Xtest = testIdx.map(i => makeFeatures(rpmForm, dataPoints[i].RPM / normalizeRPM, dataPoints[i].TE - centerTE, dataPoints[i].TC - centerTC));
      const preds = Xtest.map(xi => coeffs[0] + xi.reduce((s, x, j) => s + x * coeffs[j + 1], 0));      
      const errs = testIdx.map((id, i) => ( (logTransform ? Math.exp(preds[i]) : preds[i]) - dataPoints[id][targetCol] ) ** 2);
      
      sumRMSE += Math.sqrt(errs.reduce((s, e) => s + e, 0) / errs.length);
      validFolds++;
    }
    const avgRMSE = validFolds > 0 ? sumRMSE / validFolds : Infinity;
    if (avgRMSE < bestAvgRMSE) { bestAvgRMSE = avgRMSE; bestAlpha = alpha; }
  }
  return { alpha: bestAlpha, avgRMSE: bestAvgRMSE };
}

function fitPiecewiseInverter(dataPoints, targetCol, splitRPM, normalizeRPM, centerTE, centerTC) {
  const lowData = dataPoints.filter(d => d.RPM <= splitRPM);
  if (lowData.length < 6) throw new Error('Not enough low‑range points.');
  
  const coeffs = solveRidge(lowData.map(d => makeFeatures('n_quad', d.RPM / splitRPM, d.TE - centerTE, d.TC - centerTC)), lowData.map(d => d[targetCol]), 1.0);
  
  const maxRPM = Math.max(...dataPoints.map(d => d.RPM));
  const maxData = dataPoints.filter(d => d.RPM === maxRPM);
  const coeffs_max = solveRidge(maxData.map(d => makeFeatures('n_quad', 1.0, d.TE - centerTE, d.TC - centerTC)), maxData.map(d => d[targetCol]), 1.0);

  const predict = (RPM, TE, TC) => {
    if (RPM <= splitRPM) return coeffs[0] + makeFeatures('n_quad', RPM / splitRPM, TE - centerTE, TC - centerTC).reduce((s, f, i) => s + f * coeffs[i + 1], 0);
    if (RPM === maxRPM) return coeffs_max[0] + makeFeatures('n_quad', 1.0, TE - centerTE, TC - centerTC).reduce((s, f, i) => s + f * coeffs_max[i + 1], 0);
    
    const valLow = predict(splitRPM, TE, TC), valMax = predict(maxRPM, TE, TC);
    return valLow + (valMax - valLow) * ((RPM - splitRPM) / (maxRPM - splitRPM));
  };

  const preds = dataPoints.map(d => predict(d.RPM, d.TE, d.TC));
  return { type: 'piecewise', splitRPM, maxRPM, coeffs_low: coeffs, rmse: Math.sqrt(preds.reduce((s, p, i) => s + (p - dataPoints[i][targetCol])**2, 0) / preds.length), predict };
}

function buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE) {
  let best = null, bestRMSE = Infinity;
  for (const rpmForm of ['n_lin', 'n_quad', 'ln_n_lin', 'ln_n_quad']) {
    for (const logTrans of [false, true]) {
      const cv = cvInverter(dataPoints, targetCol, rpmForm, logTrans, [0.001, 0.01, 0.1, 1, 10, 100], normalizeRPM, centerTE, centerTC);
      if (cv.avgRMSE < bestRMSE) { bestRMSE = cv.avgRMSE; best = { type: 'global', rpmForm, logTransform: logTrans, alpha: cv.alpha, cvRMSE: cv.avgRMSE }; }
    }
  }
  if (!best) return null;
  const X = dataPoints.map(d => makeFeatures(best.rpmForm, d.RPM / normalizeRPM, d.TE - centerTE, d.TC - centerTC));
  const y = best.logTransform ? dataPoints.map(d => Math.log(d[targetCol])) : dataPoints.map(d => d[targetCol]);
  return { ...best, coeffs: solveRidge(X, y, best.alpha), rmse: bestRMSE };
}

function selectInverterModel(dataPoints, targetCol, targetRMSE, normalizeRPM, centerTE, centerTC) {
  const uniqueRPMs = [...new Set(dataPoints.map(d => d.RPM))].sort((a,b)=>a-b);
  const globalBest = buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE);
  
  if (uniqueRPMs.length < 3) return globalBest;

  let bestPiecewise = null, bestPiecewiseRMSE = Infinity;
  for (let idx = 1; idx < uniqueRPMs.length - 1; idx++) {
    try {
      const pw = fitPiecewiseInverter(dataPoints, targetCol, uniqueRPMs[idx], normalizeRPM, centerTE, centerTC);
      if (pw.rmse < bestPiecewiseRMSE) { bestPiecewiseRMSE = pw.rmse; bestPiecewise = pw; }
    } catch (e) { }
  }

  if (bestPiecewise && (bestPiecewise.rmse + 0.5) < (globalBest.cvRMSE || globalBest.rmse)) return bestPiecewise;
  return globalBest;
}

/**
 * Orchestrates the full Ridge CV fitting routine for inverters.
 */
export function fitInverterCoefficients(dataPoints, normalizeRPM, centerTE, centerTC, targetRMSE = 3.0) {
  return {
    Q: selectInverterModel(dataPoints, 'Q', targetRMSE, normalizeRPM, centerTE, centerTC),
    W: selectInverterModel(dataPoints, 'W', targetRMSE, normalizeRPM, centerTE, centerTC),
    normalizeRPM, centerTE, centerTC,
  };
}

/**
 * Predicts inverter compressor capacity and power draw at specific RPM.
 */
export function inverterCompressorPerformance(TE, TC, RPM, refrigerantIndex, compressorModel) {
  const { Q, W, normalizeRPM, centerTE, centerTC } = compressorModel;

  const predict = (model, TE, TC, RPM) => {
    if (model.type === 'global') {
      const feat = makeFeatures(model.rpmForm, RPM / normalizeRPM, TE - centerTE, TC - centerTC);
      const y = model.coeffs[0] + feat.reduce((s, f, i) => s + f * model.coeffs[i + 1], 0);
      return model.logTransform ? Math.exp(y) : y;
    } else return model.predict(RPM, TE, TC);
  };

  const QCompressor = predict(Q, TE, TC, RPM);
  const CompPower    = predict(W, TE, TC, RPM);

  const prop = getRefrigerantProperties(refrigerantIndex);
  const Pe = prop.satPressure(TE + KELVIN_OFFSET);
  
  return {
    QCompressor, CompPower,
    massFlow: QCompressor * 3.6 / (prop.gasEnthalpy(SUCTION_TEMP_C + KELVIN_OFFSET, Pe) - prop.liquidEnthalpy(SUCTION_TEMP_C)),
    Pe, Pc: prop.satPressure(TC + KELVIN_OFFSET), VolumetricEfficiency: null,
  };
}