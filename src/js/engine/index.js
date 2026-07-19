/**
 * @file index.js
 * Main engine entry point.
 * Orchestrates the full lifecycle:
 * 1. Pass 1: Structural validation (tree hierarchy).
 * 2. Configuration Upgrade (Schema v1.0 -> v2.0).
 * 3. Cabinet-level geometry validation (wall thickness ratios).
 * 4. Pass 2: Volume Traversal (precise leaf volume computation).
 *
 * Public API:
 *   runCalculation(config) -> CalcResult
 */

import { deriveRootSpace, walkBoundaries } from './calc.js';
import { validateStructure }                from './validationPass1.js';
import { traverseAndComputePrecise }        from './traversal.js';
import { upgradeConfig, toVolumeFormat }    from './geometry.js';

// ---------------------------------------------------------------------------
// Cabinet-level pre-checks
// ---------------------------------------------------------------------------

/**
 * Validates cabinet-level dimensions and wall thickness sanity.
 * Checks for physical impossibilities like wall thickness exceeding external dimensions
 * or resulting in zero internal volume.
 * 
 * @param {Object} cabinet - Cabinet geometry object including external dimensions and layout.
 * @returns {import('./types').ValidationError[]} List of cabinet-level errors.
 */
function validateCabinet(cabinet) {
  const errors = [];
  const { external, wallThicknessesByType, layout, airGap } = cabinet;

  // Positive external dimensions
  for (const [key, val] of Object.entries(external)) {
    if (val <= 0) {
      errors.push({ rule: 'positiveValues', message: `external.${key} must be > 0, got ${val}` });
    }
  }

  // Compute effective wall thicknesses
  const boundaryTypes = { top: new Set(), bottom: new Set(), left: new Set(), right: new Set() };
  walkBoundaries(layout, boundaryTypes, true, true, true, true);
  const effective = {};
  const allTypes = ['fresh','freezer']; // Supported wall keys

  for (const face of ['top','bottom','left','right']) {
    let max = 0;
    for (const t of boundaryTypes[face]) {
      const val = wallThicknessesByType[t]?.[face] ?? 0;
      if (val > max) max = val;
    }
    // Fallback: If no type matches, check against all types
    if (boundaryTypes[face].size === 0) {
      for (const t of allTypes) max = Math.max(max, wallThicknessesByType[t]?.[face] ?? 0);
    }
    effective[face] = max;
  }
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));

  // Wall ratio checks: Insulation shouldn't consume > 50% of external space
  const pairs = [
    ['top',    external.height, 'height'],
    ['bottom', external.height, 'height'],
    ['left',   external.width,  'width'],
    ['right',  external.width,  'width'],
    ['rear',   external.depth,  'depth'],
    ['door',   external.depth,  'depth'],
  ];
  for (const [face, extDim, dimName] of pairs) {
    const thickness = effective[face];
    if (thickness >= extDim * 0.5) {
      errors.push({
        rule:    'wallRatio',
        message: `${face} wall (${thickness} mm) exceeds 50% of external ${dimName} (${extDim * 0.5} mm)`,
      });
    }
  }

  // Check if internal dimensions result in positive space
  if (errors.length === 0) {
    const rootSpace = deriveRootSpace({ external, wallThicknessesByType, airGap }, layout);
    for (const [dim, val] of Object.entries(rootSpace)) {
      if (val <= 0) {
        errors.push({
          rule:    'internalPositive',
          message: `Derived internal ${dim} (${val} mm) is ≤ 0 after wall subtraction`,
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Main orchestration entry point.
 * Performs a comprehensive validation and calculation pipeline:
 * 1. Validates input layout structure.
 * 2. Upgrades legacy v1.0 configs to v2.0.
 * 3. Validates cabinet dimensions.
 * 4. Traverses geometry to compute precise volumes.
 * 
 * @param {import('./types').CabinetConfig} config - The raw user configuration.
 * @returns {import('./types').CalcResult} The simulation results.
 */
export function runCalculation(config) {
  const result = { leaves: null, totals: null, validationErrors: [], calcErrors: [], warnings: [] };

  // Pass 1: Structural validation
  const structErrors = validateStructure(config.cabinet.layout);
  if (structErrors.length) { result.validationErrors = structErrors; return result; }

  // Schema Upgrade
  if (config.schemaVersion === '1.0' || (!config.cabinet.geometry && config.cabinet.external)) {
    config = upgradeConfig(config);
  }

  const { geometry, layout } = config.cabinet;
  const volumeGeom = toVolumeFormat(geometry);
  
  // Cabinet Validation
  const cabinetErrors = validateCabinet({ ...volumeGeom, layout });
  if (cabinetErrors.length) { result.validationErrors = cabinetErrors; return result; }

  // Pass 2: Precise volume computation
  const { leaves, errors: dimErrors, warnings } = traverseAndComputePrecise(layout, geometry);
  
  result.validationErrors = dimErrors;
  result.warnings = warnings;
  result.leaves = leaves.map(l => ({ leafId: l.leafId, gross: l.gross }));

  if (leaves.length > 0) {
    const totalGross = leaves.reduce((sum, l) => sum + l.gross, 0);
    result.totals = { gross: totalGross };
  }

  return result;
}

// Re-export core modules for external consumption
export { deriveRootSpace }    from './calc.js';
export { validateStructure } from './validationPass1.js';
export { traverseAndComputePrecise } from './traversal.js';