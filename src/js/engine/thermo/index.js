/**
 * @file index.js
 * Thermo analysis entry point – orchestrates the nested Newton‑Raphson solver
 * and returns a human‑readable result object.
 */

import { solveThermalSystem } from './solver.js';
import { SJ54H_COMPONENTS } from './defaultComponents.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { DEFAULT_CABINET, toThermalFormat } from '../geometry.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function runThermoAnalysis(config) {
  const errors = [];
  const warnings = [];

  if (!config) {
    errors.push('No configuration provided.');
    return { success: false, errors, warnings, results: null };
  }

  const required = [
    'geom', 'compParams', 'condenserConfig', 'refrigerant',
    'subcool', 'dischargeTemp', 'fixedTemps', 'fan', 'electrical'
  ];
  for (const key of required) {
    if (config[key] === undefined) {
      errors.push(`Missing required config field: ${key}`);
    }
  }

  // Fixed temperatures validation
  if (config.fixedTemps) {
    const { T0, TF, TR, TE } = config.fixedTemps;
    if ([T0, TF, TR, TE].some(v => typeof v !== 'number')) {
      errors.push('fixedTemps must contain numeric T0, TF, TR, TE.');
    }
  }

  // Fan defaults
  if (config.fan) {
    if (!config.fan.totalAirflow) {
      errors.push('fan.totalAirflow is required.');
    }
    config.fan.density = config.fan.density ?? PHYSICAL_CONSTANTS.air.density;
    config.fan.cp = config.fan.cp ?? PHYSICAL_CONSTANTS.air.cp;
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, results: null };
  }

  // Merge solver options with defaults
  const solverDefaults = {
    TC0: 54.4,
    DH: 0.001,
    tolOuter: 0.0005,
    maxIterOuter: 100,
    innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
  };
  const solverOptions = { ...solverDefaults, ...(config.solverOptions || {}) };

  try {
    const result = solveThermalSystem({
      geom: config.geom,
      compParams: config.compParams,
      condenserConfig: config.condenserConfig,
      refrigerant: config.refrigerant,
      subcool: config.subcool,
      dischargeTemp: config.dischargeTemp,
      fixedTemps: config.fixedTemps,
      fan: config.fan,
      electrical: config.electrical,
      freezerPosition: config.freezerPosition || 'top',   // new field
      initialTE: config.fixedTemps.TE,                    // solver needs initial TE
      ...solverOptions,
    });

    if (!result.converged) {
      errors.push(result.error || 'Thermal solver did not converge.');
      return { success: false, errors, warnings, results: null };
    }

    const output = {
      TC: result.TC,
      T2: result.T2,
      PR: result.PR,
      TE: result.TE,   // dynamic TE result
      heatLoads: {
        QF: result.heatLoads.QF,
        QR: result.heatLoads.QR,
        QEV: result.heatLoads.QEV,
        fanLoad: result.heatLoads.fanLoad,
        defrostLoad: result.heatLoads.defrostLoad,
      },
      compressor: {
        massFlow: result.compressor.massFlow,
        coolingCapacity: result.compressor.coolingCapacity,
        inputPower: result.compressor.inputPower,
        etaV: result.compressor.etaV,
      },
      iterations: {
        outer: result.outerIterations,
        innerTotal: result.innerTotalIterations,
      },
    };

    if (result.PR >= 1) {
      warnings.push('Compressor running ratio reached 100% — system may be undersized.');
    } else if (result.PR <= 0.1) {
      warnings.push('Compressor running ratio very low — check heat load inputs.');
    }

    return { success: true, errors: [], warnings, results: output };
  } catch (err) {
    errors.push(`Unexpected error in thermal analysis: ${err.message}`);
    return { success: false, errors, warnings, results: null };
  }
}

// ---------------------------------------------------------------------------
// Default config builder (SJ‑54H)
// ---------------------------------------------------------------------------

/**
 * Returns a complete configuration object for the SJ‑54H baseline,
 * formatted exactly as the solver expects.
 */
export function buildDefaultConfig(overrides = {}) {
  // Convert compressor coefficients from the old object format to arrays
  const { compressor: compRaw, condenser: condRaw, fan, electrical } = SJ54H_COMPONENTS;

  const compParams = {
    name: compRaw.name,
    cylinderVolumeCm3: compRaw.Vc,
    speedRpm: compRaw.rpm,
    rpm0: compRaw.rpm0,
    T_suction: compRaw.T_suction,
    wCoeffs: [
      compRaw.powerCoeffs.AW,
      compRaw.powerCoeffs.BW,
      compRaw.powerCoeffs.CW,
      compRaw.powerCoeffs.DW,
      compRaw.powerCoeffs.EW,
    ],
    etaCoeffs: [
      compRaw.volEffCoeffs.A,
      compRaw.volEffCoeffs.B,
      compRaw.volEffCoeffs.C,
    ],
  };
  const base = {
    geom: toThermalFormat(DEFAULT_CABINET),
    compParams,
    condenserConfig: {
      sidePipePitch_mm: condRaw.sidePipePitch_mm,
      backPipePitch_mm: condRaw.backPipePitch_mm,
      backCondenserEfficiency: condRaw.backCondenserEfficiency,
      backCondenser: 'Yes',   // SJ‑540 has a back condenser
    },
    refrigerant: 'R-600a',
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fixedTemps: {
      T0: 30,
      TF: -18,
      TR: 3,
      TE: -23.3,          // initial guess (will be updated by dynamic loop if used)
    },
    fan: {
      totalAirflow: fan.totalAirflow_m3h,
      inputPower_W: fan.inputPower_W,
    },
    electrical: { ...electrical },
    freezerPosition: 'top',   // SJ‑540 is top‑freezer
    initialTE: -25.27,        // better starting point for TE iterations
    solverOptions: {
      TC0: 54.4,
      DH: 0.001,
      tolOuter: 0.0005,
      maxIterOuter: 100,
      innerOptions: {
        dx: 0.001,
        tol: 1e-4,
        maxIter: 100,
        initialT2: -21.25,
        initialPR: 0.59,
      },
    },
  };

  return deepMerge(base, overrides);
}

// Simple deep merge (one level deep suffices for our configs)
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = deepMerge(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}