/**
 * @file index.js
 * Main engine entry point.
 * Orchestrates Pass 1 → cabinet-level pre-checks → Pass 2 → post-calc hierarchy check.
 *
 * Public API:
 *   runCalculation(config) → CalcResult
 */

import { deriveRootSpace, aggregateTotals, walkBoundaries } from './calc.js';
import { validateStructure }                                from './validationPass1.js';
import { traverseAndCompute }                               from './traversal.js';
import { upgradeConfig, toVolumeFormat } from './geometry.js';

// ---------------------------------------------------------------------------
// Cabinet-level pre-checks (run before Pass 2 tree traversal)
// ---------------------------------------------------------------------------

/**
 * Validates cabinet external dims, wall thicknesses, and derived internal space.
 * These are not tree-node checks — they guard the root space derivation.
 *
 * @param {import('./types').CabinetConfig['cabinet']} cabinet
 * @returns {import('./types').ValidationError[]}
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

  // Compute effective wall thicknesses (same logic as deriveRootSpace)
  const boundaryTypes = { top: new Set(), bottom: new Set(), left: new Set(), right: new Set() };
  walkBoundaries(layout, boundaryTypes, true, true, true, true);
  const effective = {};
  const allTypes = ['fresh','freezer','flex'];
  for (const face of ['top','bottom','left','right']) {
    let max = 0;
    for (const t of boundaryTypes[face]) {
      const val = wallThicknessesByType[t]?.[face] ?? 0;
      if (val > max) max = val;
    }
    if (boundaryTypes[face].size === 0) {
      for (const t of allTypes) max = Math.max(max, wallThicknessesByType[t]?.[face] ?? 0);
    }
    effective[face] = max;
  }
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));

  // Wall ratio checks using effective thicknesses
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


  // Internal dimensions positive
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
// Post-calc hierarchy check
// ---------------------------------------------------------------------------

/**
 * Asserts Gross ≥ EG_Net ≥ IEC_Net per leaf and on totals.
 * Returns CalcError[]. Non-empty means a formula regression — should never
 * fire under correct formulas.
 *
 * @param {import('./types').LeafResult[]} leaves
 * @param {import('./types').Totals}       totals
 * @returns {import('./types').CalcError[]}
 */
function checkHierarchy(leaves, totals) {
  const errors = [];

  for (const leaf of leaves) {
    if (leaf.gross < leaf.egNet - 1e-9) {
      errors.push({ rule: 'hierarchyCheck_leaf',
        message: `Gross (${leaf.gross}) < EG_Net (${leaf.egNet}) on leaf ${leaf.leafId}` });
    }
    if (leaf.egNet < leaf.iecNet - 1e-9) {
      errors.push({ rule: 'hierarchyCheck_leaf',
        message: `EG_Net (${leaf.egNet}) < IEC_Net (${leaf.iecNet}) on leaf ${leaf.leafId}` });
    }
  }

  if (totals.gross < totals.egNet - 1e-9) {
    errors.push({ rule: 'hierarchyCheck_total',
      message: `Total Gross (${totals.gross}) < Total EG_Net (${totals.egNet})` });
  }
  if (totals.egNet < totals.iecNet - 1e-9) {
    errors.push({ rule: 'hierarchyCheck_total',
      message: `Total EG_Net (${totals.egNet}) < Total IEC_Net (${totals.iecNet})` });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Runs the full calculation pipeline on a cabinet configuration.
 *
 * @param {import('./types').CabinetConfig} config
 * @returns {import('./types').CalcResult}
 */
export function runCalculation(config) {
  const result = { leaves:null, totals:null, validationErrors:[], calcErrors:[], warnings:[] };

  // Pass 1 — structural
  const structErrors = validateStructure(config.cabinet.layout);
  if (structErrors.length) { result.validationErrors = structErrors; return result; }

  // Backward compatibility
  if (config.schemaVersion === '1.0' || (!config.cabinet.geometry && config.cabinet.external)) {
    config = upgradeConfig(config);
  }

  const { geometry, layout } = config.cabinet;

  // Derive volume format and validate cabinet dimensions
  const volumeGeom = toVolumeFormat(geometry);
  const cabinetErrors = validateCabinet({ ...volumeGeom, layout });
  if (cabinetErrors.length) { result.validationErrors = cabinetErrors; return result; }

  const rootSpace = deriveRootSpace(volumeGeom, layout);

  // Pass 2
  const { leaves, errors: dimErrors, warnings } = traverseAndCompute(layout, rootSpace);
  result.validationErrors = dimErrors;
  result.warnings = warnings;
  result.leaves = leaves;

  if (leaves.length > 0) {
    const totals = aggregateTotals(leaves);
    result.totals = totals;
    result.calcErrors = checkHierarchy(leaves, totals);
  }

  return result;
}

export { deriveRootSpace, aggregateTotals } from './calc.js';
export { validateStructure }               from './validationPass1.js';
export { traverseAndCompute }              from './traversal.js';