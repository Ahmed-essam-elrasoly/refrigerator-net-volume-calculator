/**
 * @file index.js
 * Main engine entry point.
 * Orchestrates Pass 1 → cabinet-level pre-checks → Pass 2 → post-calc hierarchy check.
 *
 * Public API:
 *   runCalculation(config) → CalcResult
 */

import { deriveRootSpace, aggregateTotals } from './calc.js';
import { validateStructure }                from './validationPass1.js';
import { traverseAndCompute }               from './traversal.js';

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
  const { external, wallThicknesses: w } = cabinet;

  // Positive external dimensions
  for (const [key, val] of Object.entries(external)) {
    if (val <= 0) {
      errors.push({ rule: 'positiveValues', message: `external.${key} must be > 0, got ${val}` });
    }
  }

  // Wall ratio: each thickness < 50% of corresponding external dimension
  const pairs = [
    ['top',    external.height, 'height'],
    ['bottom', external.height, 'height'],
    ['left',   external.width,  'width'],
    ['right',  external.width,  'width'],
    ['rear',   external.depth,  'depth'],
    ['door',   external.depth,  'depth'],
  ];

  for (const [face, extDim, dimName] of pairs) {
    const thickness = w[face];
    if (thickness >= extDim * 0.5) {
      errors.push({
        rule:    'wallRatio',
        message: `${face} wall (${thickness} mm) exceeds 50% of external ${dimName} (${extDim * 0.5} mm)`,
      });
    }
  }

  // Air gap positive
  if (cabinet.airGap <= 0) {
    errors.push({ rule: 'positiveValues', message: `airGap must be > 0, got ${cabinet.airGap}` });
  }

  // Internal dimensions positive
  if (errors.length === 0) {
    const rootSpace = deriveRootSpace(cabinet);
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
 * Pipeline:
 *   1. Pass 1 — structural validation (dimension-agnostic)
 *   2. Cabinet-level pre-checks (wall ratios, positive internal space)
 *   3. Pass 2 — space derivation + dimension-dependent validation + leaf calc
 *   4. Post-calc — hierarchy check
 *
 * Always returns a CalcResult. Inspect validationErrors and calcErrors
 * to determine whether the output is trustworthy.
 *
 * @param {import('./types').CabinetConfig} config
 * @returns {import('./types').CalcResult}
 */
export function runCalculation(config) {
  const result = {
    leaves:           null,
    totals:           null,
    validationErrors: [],
    calcErrors:       [],
    warnings:         [],
  };

  // Pass 1 — structural
  const structErrors = validateStructure(config.cabinet.layout);
  if (structErrors.length) {
    result.validationErrors = structErrors;
    return result; // halt: structural errors block everything
  }

  // Cabinet-level pre-checks
  const cabinetErrors = validateCabinet(config.cabinet);
  if (cabinetErrors.length) {
    result.validationErrors = cabinetErrors;
    return result;
  }

  // Derive root space
  const rootSpace = deriveRootSpace(config.cabinet);

  // Pass 2 — space derivation + dimension checks + calculation
  const { leaves, errors: dimErrors, warnings } = traverseAndCompute(
    config.cabinet.layout,
    rootSpace
  );

  result.validationErrors = dimErrors;
  result.warnings         = warnings;
  result.leaves           = leaves;

  // Aggregate totals only if we have leaf results
  if (leaves.length > 0) {
    const totals = aggregateTotals(leaves);
    result.totals = totals;

    // Post-calc hierarchy check
    result.calcErrors = checkHierarchy(leaves, totals);
  }

  return result;
}

export { deriveRootSpace, aggregateTotals } from './calc.js';
export { validateStructure }               from './validationPass1.js';
export { traverseAndCompute }              from './traversal.js';
