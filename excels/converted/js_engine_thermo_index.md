# index.js

**Original file:** `index.js`

**File type:** .JS

**Size:** 7,152 bytes

**Last modified:** 2026-05-18 17:25:38


---

## Content

```javascript
/**
 * @file index.js
 * Thermo analysis entry point – orchestrates the nested Newton‑Raphson solver
 * and returns a human‑readable result object.
 */

import { solveThermalSystem } from './solver.js';
import { DEFAULT_GEOMETRY } from './heatLoad.js';
import { SJ54H_COMPONENTS } from './defaultComponents.js';
import { PHYSICAL_CONSTANTS } from './constants.js';
import { DEFAULT_CABINET, toThermalFormat } from '../geometry.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a full thermodynamic analysis of a refrigerator.
 *
 * @param {object} config
 * @param {object} config.geom               - cabinet dimensions (see DEFAULT_GEOMETRY)
 * @param {object} config.compParams         - compressor parameters
 * @param {object} config.condenserConfig    - condenser design
 * @param {string} config.refrigerant        - 'R-600a' | 'R-134a'
 * @param {number} config.subcool            - sub‑cooling (K)
 * @param {number} config.dischargeTemp      - discharge temperature (°C)
 * @param {object} config.fixedTemps         - { T0, TF, TR }
 * @param {object} config.fan                - { totalAirflow, density?, cp? }
 * @param {object} config.electrical         - { defrostHeater_W, defrostOn_min, ... }
 * @param {object} [config.solverOptions]    - optional solver tuning
 * @returns {{ success: boolean, errors: string[], warnings: string[], results: object|null }}
 */
export function runThermoAnalysis(config) {
  const errors = [];
  const warnings = [];

  // Basic input validation
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

  if (config.fixedTemps) {
    const { T0, TF, TR, TE } = config.fixedTemps;
    if ([T0, TF, TR, TE].some(v => typeof v !== 'number')) {
      errors.push('fixedTemps must contain numeric T0, TF, TR, TE.');
    }
  }

  if (config.fan) {
    if (!config.fan.totalAirflow) {
      errors.push('fan.totalAirflow is required.');
    }
    // Apply defaults for density and cp if not supplied
    config.fan.density = config.fan.density ?? PHYSICAL_CONSTANTS.air.density;
    config.fan.cp = config.fan.cp ?? PHYSICAL_CONSTANTS.air.cp;
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings, results: null };
  }

  // Merge solver options with defaults
  const solverOptions = {
    TC0: 54.4,
    DH: 0.001,
    tolOuter: 0.0005,
    maxIterOuter: 100,
    innerOptions: {},
    ...(config.solverOptions || {}),
  };

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
      ...solverOptions,
    });

    if (!result.converged) {
      errors.push(result.error || 'Thermal solver did not converge.');
      return { success: false, errors, warnings, results: null };
    }

    // Build output
    const output = {
      TC: result.TC,
      T2: result.T2,
      PR: result.PR,
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

    // Warnings (e.g. if PR hit a limit – not implemented yet, but placeholder)
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
// Helper: build a default configuration using the SJ‑54H baseline
// ---------------------------------------------------------------------------

/**
 * Returns a complete configuration object pre‑filled with SJ‑54H defaults.
 * The caller can override any field after.
 *
 * @param {object} [overrides] - optional partial config to merge
 * @returns {object} config ready for runThermoAnalysis
 */
export function buildDefaultConfig(overrides = {}) {
  const base = {
    geom: toThermalFormat(DEFAULT_CABINET),
    compParams: { ...SJ54H_COMPONENTS.compressor },
    condenserConfig: {
      K_side: SJ54H_COMPONENTS.condenser.K_side_kcalhm2C,
      K_back: SJ54H_COMPONENTS.condenser.K_back_kcalhm2C,
      backCondenserEfficiency: SJ54H_COMPONENTS.condenser.backCondenserEfficiency,
      k_RFront1: SJ54H_COMPONENTS.condenser.k_RFront1,
      k_RFront2: SJ54H_COMPONENTS.condenser.k_RFront2,
      k_FRPartition1: SJ54H_COMPONENTS.condenser.k_FRPartition1,
      k_FRPartition2: SJ54H_COMPONENTS.condenser.k_FRPartition2,
      k_FFront1: SJ54H_COMPONENTS.condenser.k_FFront1,
      k_FFront2: SJ54H_COMPONENTS.condenser.k_FFront2,
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
      totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h,
      inputPower_W: SJ54H_COMPONENTS.fan.inputPower_W,   // add this
    },
    electrical: { ...SJ54H_COMPONENTS.electrical },
    solverOptions: {
      TC0: 54.4,
      DH: 0.001,
      tolOuter: 0.0005,
      maxIterOuter: 100,
      innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 100 },
    },
  };

  return deepMerge(base, overrides);
}

// Simple deep merge (only one level needed for our configs)
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
```


---

*Converted from `index.js` on 2026-05-23 11:54:21*
