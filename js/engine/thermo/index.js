/**
 * @file index.js
 * @description Thermo analysis entry point – orchestrates the nested Newton‑Raphson solver
 * and formats the result object into a clean payload for the UI.
 */

import { solveThermalSystem, runThermalAnalysisDynamic } from './solver.js';
import { SJ54H_COMPONENTS } from './defaultComponents.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { DEFAULT_CABINET, toThermalFormat } from '../geometry.js';
import { validateHeatLoad } from './validateHeatLoad.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Executes a full thermal simulation over the active configuration.
 * Validates inputs, populates defaults, fires the solver, and structures the response.
 * 
 * @param {Object} config - The active configuration to simulate.
 * @returns {Object} Structured response containing success flag, errors, warnings, and results.
 */
export function runThermoAnalysis(config) {
  const errors = [];
  const warnings = [];

  if (!config) {
    errors.push('No configuration provided.');
    return { success: false, errors, warnings, results: null };
  }

  // 1. Core payload validation
  const required = [
    'geom', 'compParams', 'condenserConfig', 'refrigerant',
    'subcool', 'dischargeTemp', 'fixedTemps', 'fan', 'electrical', 'evapGeom'
  ];
  for (const key of required) {
    if (config[key] === undefined) errors.push(`Missing required config field: ${key}`);
  }

  if (config.fixedTemps && [config.fixedTemps.T0, config.fixedTemps.TF, config.fixedTemps.TR, config.fixedTemps.TE].some(v => typeof v !== 'number')) {
    errors.push('fixedTemps must contain numeric T0, TF, TR, TE.');
  }

  if (config.fan) {
    if (!config.fan.fanAirflow_m3h) errors.push('fan.fanAirflow_m3h is required.');
    config.fan.density = config.fan.density ?? PHYSICAL_CONSTANTS.air.density;
    config.fan.cp = config.fan.cp ?? PHYSICAL_CONSTANTS.air.cp;
  }

  if (errors.length > 0) return { success: false, errors, warnings, results: null };

  // 2. Set default solver thresholds
  const solverOptions = {
    TC0: 54.4,
    DH: 0.001,
    tolOuter: 0.0005,
    maxIterOuter: 100,
    innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
    ...(config.solverOptions || {})
  };

  if (config.inverterPR !== undefined) solverOptions.inverterPR = config.inverterPR;

  try {
    // 3. Trigger dynamic TE evaluation loop
    const result = runThermalAnalysisDynamic({
      ...config,                     
      geom: config.geom,
      compParams: config.compParams,
      condenserConfig: config.condenserConfig,
      refrigerant: config.refrigerant,
      subcool: config.subcool,
      dischargeTemp: config.dischargeTemp,
      fixedTemps: config.fixedTemps,
      fan: config.fan,
      electrical: config.electrical,
      freezerPosition: config.freezerPosition || 'top',
      initialTE: config.fixedTemps.TE,
      ...solverOptions,              
    });

    if (!result.converged) {
      errors.push(result.error || 'Thermal solver did not converge.');
      return { success: false, errors, warnings, results: null };
    }
    
    // 4. Structure the physical output payload
    const output = {
      TC: result.TC,
      Tsubcool: result.Tsubcool,
      T2: result.T2,
      PR: result.PR,
      TE: result.TE,
      heatLoads: {
        QF: result.heatLoads.QF,
        QR: result.heatLoads.QR,
        QEV: result.heatLoads.QEV,
        fanLoad: result.heatLoads.fanLoad,
        defrostLoad: result.heatLoads.defrostLoad,
        totalLoad: result.heatLoads.totalLoad,
      },
      compressor: {
        massFlow: result.compressor.massFlow,
        coolingCapacity: result.compressor.coolingCapacity,
        inputPower: result.compressor.inputPower,
        etaV: result.compressor.etaV,
        Pe: result.compressor.Pe,
        Pc: result.compressor.Pc,
        COP: result.compressor.COP,
      },
      fan: result.fan,
      electrical: result.electrical,
      iterations: {
        outer: result.outerIterations,
        innerTotal: result.innerTotalIterations,
      },
      MR: result.MR,
      MF: result.MF,
      T3: result.T3,
    };

    if (result.RPM !== undefined) output.RPM = result.RPM;
    if (result.warnings && result.warnings.length > 0) warnings.push(...result.warnings);

    if (result.PR >= 1) warnings.push('Compressor running ratio reached 100% – system may be undersized.');
    else if (result.PR <= 0.1) warnings.push('Compressor running ratio very low – check heat load inputs.');

    return { success: true, errors: [], warnings, results: output };
  } catch (err) {
    errors.push(`Unexpected error in thermal analysis: ${err.message}`);
    return { success: false, errors, warnings, results: null };
  }
}

/**
 * Returns a complete configuration object for the SJ‑54H baseline,
 * ensuring all internal objects and arrays are correctly initialized.
 */
export function buildDefaultConfig(overrides = {}) {
  const { compressor: compRaw, condenser: condRaw, fan, electrical } = SJ54H_COMPONENTS;

  const base = {
    geom: toThermalFormat(DEFAULT_CABINET),
    compParams: {
      name: compRaw.name,
      cylinderVolumeCm3: compRaw.Vc,
      speedRpm: compRaw.rpm,
      rpm0: compRaw.rpm0,
      T_suction: compRaw.T_suction,
      wCoeffs: [compRaw.powerCoeffs.AW, compRaw.powerCoeffs.BW, compRaw.powerCoeffs.CW, compRaw.powerCoeffs.DW, compRaw.powerCoeffs.EW],
      etaCoeffs: [compRaw.volEffCoeffs.A, compRaw.volEffCoeffs.B, compRaw.volEffCoeffs.C],
    },
    condenserConfig: {
      sidePipePitch_mm: condRaw.sidePipePitch_mm,
      backPipePitch_mm: condRaw.backPipePitch_mm,
      backCondenserEfficiency: condRaw.backCondenserEfficiency,
      backCondenser: 'Yes',
    },
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps: {
      T0: 30,
      TF: -18,
      TR: 3,
      TE: -23.3,
    },
fan: {
      fanAirflow_m3h: fan.totalAirflow_m3h,
      totalAirflow: fan.totalAirflow_m3h,
      inputPower_W: fan.inputPower_W,
    },
    electrical: { ...electrical },
    freezerPosition: 'top',
    initialTE: -25.27,
    solverOptions: {
      TC0: 54.4,
      DH: 0.001,
      tolOuter: 0.0005,
      maxIterOuter: 100,
      innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100, initialT2: -21.25, initialPR: 0.59 },
    },
  };

  return deepMerge(base, overrides);
}

/** Utility function for single-depth merging configuration overrides. */
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}