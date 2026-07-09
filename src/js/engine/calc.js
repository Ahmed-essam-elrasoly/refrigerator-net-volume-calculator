import { settings } from '../settings.js';

// ---------------------------------------------------------------------------
// Boundary walker (unchanged)
// ---------------------------------------------------------------------------

export function deriveRootSpace(cabinet, layout) {
  const { external, wallThicknessesByType, airGap } = cabinet;

  const boundaryTypes = {
    top: new Set(),
    bottom: new Set(),
    left: new Set(),
    right: new Set(),
  };
  walkBoundaries(layout, boundaryTypes, true, true, true, true);

  const allTypes = ['fresh','freezer','flex'];
  const effective = {};
  for (const face of ['top','bottom','left','right']) {
    const typesForFace = boundaryTypes[face];
    let maxVal = 0;
    for (const type of typesForFace) {
      const val = wallThicknessesByType[type]?.[face] ?? 0;
      if (val > maxVal) maxVal = val;
    }
    if (typesForFace.size === 0) {
      for (const type of allTypes) {
        const val = wallThicknessesByType[type]?.[face] ?? 0;
        if (val > maxVal) maxVal = val;
      }
    }
    effective[face] = maxVal;
  }
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));

  return {
    width:  external.width  - effective.left - effective.right,
    height: external.height - effective.top  - effective.bottom,
    depth:  external.depth  - effective.rear,
  };
}

export function walkBoundaries(node, boundary, topMost, bottomMost, leftMost, rightMost) {
  if (node.nodeType === 'leaf') {
    if (topMost) boundary.top.add(node.type);
    if (bottomMost) boundary.bottom.add(node.type);
    if (leftMost) boundary.left.add(node.type);
    if (rightMost) boundary.right.add(node.type);
  } else if (node.nodeType === 'horizontal') {
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const isFirst = (i === 0);
      const isLast = (i === children.length - 1);
      walkBoundaries(
        children[i].node,
        boundary,
        topMost && isFirst,
        bottomMost && isLast,
        leftMost,
        rightMost
      );
    }
  } else if (node.nodeType === 'vertical') {
    walkBoundaries(node.left,  boundary, topMost, bottomMost, true, false);
    walkBoundaries(node.right, boundary, topMost, bottomMost, false, true);
  }
}

// ---------------------------------------------------------------------------
// Leaf volume – gross only
// ---------------------------------------------------------------------------

/**
 * @param {object} leaf  – the leaf node (with `id`, `type`, `fittings` – unused for gross)
 * @param {object} space – { width, height, depth } in mm
 * @returns {{ leafId: string, gross: number }}
 */
export function calcLeafGross(leaf, space) {
  const gross = space.width * space.height * space.depth * settings.mm3ToL;
  return {
    leafId: leaf.id,
    gross,
  };
}

// ---------------------------------------------------------------------------
// Display helpers (keep interface compatible, only gross used)
// ---------------------------------------------------------------------------

export function formatLeafDisplay(leaf) {
  return {
    gross:     roundForDisplay(leaf.gross, 'L'),
    grossCuft: roundForDisplay(toCuft(leaf.gross), 'cuft'),
  };
}

export function formatTotalsDisplay(totals) {
  return {
    gross:     roundForDisplay(totals.gross, 'L'),
    grossCuft: roundForDisplay(toCuft(totals.gross), 'cuft'),
  };
}

export function toCuft(litres) {
  return litres * settings.lToCuft;
}

export function roundForDisplay(val, unit) {
  const precision = unit === 'cuft' ? settings.displayPrecisionCuft : settings.displayPrecisionL;
  return Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision);
}