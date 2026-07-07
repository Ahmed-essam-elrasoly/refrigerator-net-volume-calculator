import { calcLeafGross } from './calc.js';
import { settings } from '../settings.js';

const DIM_TOL   = 0.01;
const RATIO_TOL = 0.001;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function traverseAndCompute(rootNode, rootSpace) {
  const errors   = [];
  const warnings = [];
  const leaves   = [];

  traverseNode(rootNode, rootSpace, errors, warnings, leaves);

  return { leaves, errors, warnings };
}

// ---------------------------------------------------------------------------
// Recursive node traversal
// ---------------------------------------------------------------------------

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

  let childHeights;
  if (mode === 'ratio') {
    const totalDividerH = dividers.reduce((s, d) => s + d.thickness, 0);
    const usableH = space.height - totalDividerH;
    childHeights = children.map(c => usableH * c.heightValue);
  } else {
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
      return;
    }
    childHeights = children.map(c => c.heightValue);
  }

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
// Leaf: keep fitting dimension validation, but compute only gross
// ---------------------------------------------------------------------------

function processLeaf(node, space, errors, warnings, leaves) {
  const { fittings, id } = node;

  if (fittings.shelves && fittings.shelves.length > 0) {
    // existing detailed validation
    for (const shelf of fittings.shelves) {
      errors.push(...validateShelf(shelf, space, id));
    }
  } else if (fittings.shelfCount != null) {
    // No detailed shelves → no dimensional checks needed
    // Optionally add a soft warning that shelf dimensions are not verified
    warnings.push({
      rule: 'shelfCountOnly',
      nodeId: id,
      message: `Using shelfCount=${fittings.shelfCount}; shelf dimensions/positions not checked`
    });
  }

  // Drawers, door bins validation unchanged …
  // Compute gross volume (unchanged)
  const leafResult = calcLeafGross(node, space);
  leaves.push(leafResult);
}
// ---------------------------------------------------------------------------
// Fitting validators (unchanged, except we don't need excludedFittingIds)
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

  const minOuter = Math.min(oW, oD, oH);
  if (t >= minOuter * 0.5) {
    errs.push({ rule: 'drawerWall', nodeId,
      message: `wallThickness (${t}) ≥ 50% of smallest outer dimension (${minOuter})` });
  }

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

function checkDoorBinDepth(fittings, space, nodeId) {
  const bins    = fittings.doorBins ?? [];
  const shelves = fittings.shelves ?? [];
  if (!bins.length) return null;

  const totalBinDepth = bins.reduce((s, b) => s + b.outerDepth, 0);
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