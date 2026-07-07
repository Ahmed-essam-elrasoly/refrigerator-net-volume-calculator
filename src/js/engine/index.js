/**
 * @file index.js
 * Main engine entry point.
 * Orchestrates Pass 1 → cabinet-level pre-checks → Pass 2 → post-calc hierarchy check.
 *
 * Public API:
 *   runCalculation(config) → CalcResult
 */

import { deriveRootSpace, walkBoundaries } from './calc.js';
import { validateStructure }                from './validationPass1.js';
import { traverseAndCompute }               from './traversal.js';
import { upgradeConfig, toVolumeFormat }    from './geometry.js';

// ---------------------------------------------------------------------------
// Cabinet-level pre-checks (unchanged)
// ---------------------------------------------------------------------------

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
  const allTypes = ['fresh','freezer'];
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

  // Wall ratio checks
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
// Main entry point
// ---------------------------------------------------------------------------

export function runCalculation(config) {
  const result = { leaves: null, totals: null, validationErrors: [], calcErrors: [], warnings: [] };

  const structErrors = validateStructure(config.cabinet.layout);
  if (structErrors.length) { result.validationErrors = structErrors; return result; }

  if (config.schemaVersion === '1.0' || (!config.cabinet.geometry && config.cabinet.external)) {
    config = upgradeConfig(config);
  }

  const { geometry, layout } = config.cabinet;
  const volumeGeom = toVolumeFormat(geometry);
  const cabinetErrors = validateCabinet({ ...volumeGeom, layout });
  if (cabinetErrors.length) { result.validationErrors = cabinetErrors; return result; }

  const rootSpace = deriveRootSpace(volumeGeom, layout);

  // Pass 2 – only returns gross volumes
  const { leaves, errors: dimErrors, warnings } = traverseAndCompute(layout, rootSpace);
  result.validationErrors = dimErrors;
  result.warnings = warnings;
  result.leaves = leaves.map(l => ({ leafId: l.leafId, gross: l.gross }));

  if (leaves.length > 0) {
    const totalGross = leaves.reduce((sum, l) => sum + l.gross, 0);
    result.totals = { gross: totalGross };
  }

  return result;
}

export { deriveRootSpace }    from './calc.js';
export { validateStructure } from './validationPass1.js';
export { traverseAndCompute } from './traversal.js';