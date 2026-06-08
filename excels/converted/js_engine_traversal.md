# traversal.js

**Original file:** `traversal.js`

**File type:** .JS

**Size:** 10,908 bytes

**Last modified:** 2026-05-03 22:45:32


---

## Content

```javascript
/**
 * @file traversal.js
 * Pass 2 — single recursive descent that simultaneously:
 *   1. Derives each node's available space from parent context
 *   2. Validates dimension-dependent rules at each node
 *   3. Calculates leaf volumes immediately after validation passes
 *
 * If a node fails dimension-dependent validation, its entire subtree is
 * skipped (childrenSkipped: true on the error). Sibling subtrees continue.
 *
 * Fitting-level errors do NOT skip the leaf — they exclude the offending
 * fitting from IEC deductions only; gross and EG_Net are unaffected.
 */

import { calcLeaf } from './calc.js';

const DIM_TOL   = 0.01;   // mm tolerance for explicit height balance
const RATIO_TOL = 0.001;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Runs Pass 2 from the root node.
 * Call only after validateStructure() returns no errors.
 *
 * @param {import('./types').Node}   rootNode
 * @param {import('./types').Space}  rootSpace  - from deriveRootSpace()
 * @returns {{ leaves: import('./types').LeafResult[],
 *             errors: import('./types').ValidationError[],
 *             warnings: import('./types').Warning[] }}
 */
export function traverseAndCompute(rootNode, rootSpace) {
  const errors   = [];
  const warnings = [];
  const leaves   = [];

  // Pre-traverse: validate cabinet-level wall ratio and positive internal dims
  // These are checked before traverseNode to avoid propagating bad root space.
  // (Called by runCalculation in index.js before this function is invoked.)

  traverseNode(rootNode, rootSpace, errors, warnings, leaves);

  return { leaves, errors, warnings };
}

// ---------------------------------------------------------------------------
// Recursive node traversal
// ---------------------------------------------------------------------------

/**
 * @param {import('./types').Node}                node
 * @param {import('./types').Space}               space
 * @param {import('./types').ValidationError[]}   errors
 * @param {import('./types').Warning[]}           warnings
 * @param {import('./types').LeafResult[]}        leaves
 */
function traverseNode(node, space, errors, warnings, leaves) {
  switch (node.nodeType) {
    case 'leaf':
      processLeaf(node, space, errors, warnings, leaves);
      break;
    case 'horizontal':
      processHorizontal(node, space, errors, warnings, leaves);
      break;
    case 'vertical':
      processVertical(node, space, errors, warnings, leaves);
      break;
  }
}

// ---------------------------------------------------------------------------
// Horizontal split
// ---------------------------------------------------------------------------

function processHorizontal(node, space, errors, warnings, leaves) {
  const { children, dividers, id } = node;
  const mode = children[0].heightMode;

  // Derive child heights
  let childHeights;
  if (mode === 'ratio') {
    const totalDividerH = dividers.reduce((s, d) => s + d.thickness, 0);
    const usableH = space.height - totalDividerH;
    childHeights = children.map(c => usableH * c.heightValue);
  } else {
    // explicit mode — validate balance first
    const sumHeights   = children.reduce((s, c) => s + c.heightValue, 0);
    const sumDividers  = dividers.reduce((s, d) => s + d.thickness, 0);
    const total        = sumHeights + sumDividers;

    if (Math.abs(total - space.height) > DIM_TOL) {
      errors.push({
        rule:           'heightBalance_explicit',
        nodeId:         id,
        message:        `Sum of heights (${sumHeights}) + dividers (${sumDividers}) = ${total} ≠ availableHeight (${space.height})`,
        childrenSkipped: true,
      });
      return; // skip entire subtree
    }
    childHeights = children.map(c => c.heightValue);
  }

  // Recurse into each child with its derived height
  for (let i = 0; i < children.length; i++) {
    const childSpace = {
      width:  space.width,
      height: childHeights[i],
      depth:  space.depth,
    };
    traverseNode(children[i].node, childSpace, errors, warnings, leaves);
  }
}

// ---------------------------------------------------------------------------
// Vertical split
// ---------------------------------------------------------------------------

function processVertical(node, space, errors, warnings, leaves) {
  const { dividerThickness, leftWidthRatio, left, right, id } = node;

  // Validate divider fits within available width
  if (dividerThickness >= space.width) {
    errors.push({
      rule:           'verticalDividerBounds',
      nodeId:         id,
      message:        `dividerThickness (${dividerThickness}) ≥ availableWidth (${space.width})`,
      childrenSkipped: true,
    });
    return;
  }

  const usableW  = space.width - dividerThickness;
  const leftW    = usableW * leftWidthRatio;
  const rightW   = usableW * (1 - leftWidthRatio);

  traverseNode(left,  { width: leftW,  height: space.height, depth: space.depth }, errors, warnings, leaves);
  traverseNode(right, { width: rightW, height: space.height, depth: space.depth }, errors, warnings, leaves);
}

// ---------------------------------------------------------------------------
// Leaf: dimension-dependent fitting validation + calculation
// ---------------------------------------------------------------------------

function processLeaf(node, space, errors, warnings, leaves) {
  const excludedFittingIds = new Set();
  const { fittings, id } = node;

  // Shelves
  for (const shelf of fittings.shelves ?? []) {
    const shelfErrors = validateShelf(shelf, space, id);
    for (const e of shelfErrors) {
      errors.push(e);
      excludedFittingIds.add(shelf.id); // exclude from IEC deduction
    }
  }

  // Drawers
  for (const drawer of fittings.drawers ?? []) {
    const drawerErrors = validateDrawer(drawer, space, id);
    for (const e of drawerErrors) {
      errors.push(e);
      excludedFittingIds.add(drawer.id);
    }
  }

  // Door bins
  for (const bin of fittings.doorBins ?? []) {
    const binErrors = validateDoorBin(bin, space, id);
    for (const e of binErrors) {
      errors.push(e);
      excludedFittingIds.add(bin.id);
    }
  }

  // Soft warning: door bin depth vs shelf depth
  const binDepthWarning = checkDoorBinDepth(fittings, space, id);
  if (binDepthWarning) warnings.push(binDepthWarning);

  // Calculate leaf volumes (gross and EG always computed; excluded fittings skipped in IEC)
  const result = calcLeaf(node, space, excludedFittingIds);
  leaves.push(result);
}

// ---------------------------------------------------------------------------
// Fitting validators (return ValidationError[])
// ---------------------------------------------------------------------------

function validateShelf(shelf, space, nodeId) {
  const errs = [];
  const topEdge = shelf.positionFromFloor + shelf.thickness;

  if (shelf.positionFromFloor <= 0) {
    errs.push({ rule: 'shelfPosition', nodeId,
      message: `Shelf positionFromFloor must be > 0, got ${shelf.positionFromFloor}` });
  } else if (topEdge >= space.height) {
    errs.push({ rule: 'shelfPosition', nodeId,
      message: `Shelf top (${topEdge} mm) exceeds compartment height (${space.height} mm)` });
  }

  if (shelf.depth > space.depth) {
    errs.push({ rule: 'shelfDepth', nodeId,
      message: `Shelf depth (${shelf.depth}) exceeds availableDepth (${space.depth})` });
  }

  if (shelf.width != null && shelf.width > space.width) {
    errs.push({ rule: 'shelfWidth', nodeId,
      message: `Shelf width (${shelf.width}) exceeds availableWidth (${space.width})` });
  }

  return errs;
}

function validateDrawer(drawer, space, nodeId) {
  const errs = [];
  const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;

  if (oW > space.width) {
    errs.push({ rule: 'drawerBounds', nodeId,
      message: `Drawer outerWidth (${oW}) exceeds availableWidth (${space.width})` });
  }
  if (oD > space.depth) {
    errs.push({ rule: 'drawerBounds', nodeId,
      message: `Drawer outerDepth (${oD}) exceeds availableDepth (${space.depth})` });
  }
  if (oH >= space.height) {
    errs.push({ rule: 'drawerBounds', nodeId,
      message: `Drawer outerHeight (${oH}) must be < compartment height (${space.height})` });
  }

  // Wall ratio: must be < 50% of the smallest outer dimension
  const minOuter = Math.min(oW, oD, oH);
  if (t >= minOuter * 0.5) {
    errs.push({ rule: 'drawerWall', nodeId,
      message: `wallThickness (${t}) ≥ 50% of smallest outer dimension (${minOuter})` });
  }

  // Inner dimensions positive
  const innerW = oW - 2 * t;
  const innerD = oD - 2 * t;
  const innerH = oH - t;
  if (innerW <= 0) errs.push({ rule: 'drawerInnerPositive', nodeId, message: `Derived innerWidth ≤ 0` });
  if (innerD <= 0) errs.push({ rule: 'drawerInnerPositive', nodeId, message: `Derived innerDepth ≤ 0` });
  if (innerH <= 0) errs.push({ rule: 'drawerInnerPositive', nodeId, message: `Derived innerHeight ≤ 0` });

  return errs;
}

function validateDoorBin(bin, space, nodeId) {
  const errs = [];
  const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;

  const minOuter = Math.min(oW, oH, oD);
  if (t >= minOuter * 0.5) {
    errs.push({ rule: 'doorBinWall', nodeId,
      message: `wallThickness (${t}) ≥ 50% of smallest outer dimension (${minOuter})` });
  }

  const innerW = oW - 2 * t;
  const innerH = oH - 2 * t;
  const innerD = oD - t;
  if (innerW <= 0) errs.push({ rule: 'doorBinInnerPositive', nodeId, message: `Derived innerWidth ≤ 0` });
  if (innerH <= 0) errs.push({ rule: 'doorBinInnerPositive', nodeId, message: `Derived innerHeight ≤ 0` });
  if (innerD <= 0) errs.push({ rule: 'doorBinInnerPositive', nodeId, message: `Derived innerDepth ≤ 0` });

  return errs;
}

// ---------------------------------------------------------------------------
// Soft warnings
// ---------------------------------------------------------------------------

/**
 * Fires if sum of all door bin depths exceeds availableDepth minus min shelf depth.
 * @returns {import('./types').Warning|null}
 */
function checkDoorBinDepth(fittings, space, nodeId) {
  const bins   = fittings.doorBins ?? [];
  const shelves = fittings.shelves ?? [];
  if (!bins.length) return null;

  const totalBinDepth = bins.reduce((s, b) => s + b.outerDepth, 0);

  // If no shelves, use 0 as minShelfDepth — threshold equals full availableDepth
  const minShelfDepth = shelves.length
    ? Math.min(...shelves.map(s => s.depth))
    : 0;

  const threshold = space.depth - minShelfDepth;

  if (totalBinDepth > threshold) {
    return {
      rule:    'doorBinDepth',
      nodeId,
      message: `Σ bin depths (${totalBinDepth} mm) exceeds availableDepth − minShelfDepth (${threshold} mm)`,
    };
  }
  return null;
}

```


---

*Converted from `traversal.js` on 2026-05-27 14:13:10*
