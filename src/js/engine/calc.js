import { settings } from '../settings.js';

/**
 * Derives internal root space using per‑type wall thicknesses and the layout tree.
 * @param {object} cabinet - { external, wallThicknessesByType, airGap }
 * @param {object} layout - the root node tree
 * @returns {import('./types').Space}
 */
export function deriveRootSpace(cabinet, layout) {
  const { external, wallThicknessesByType, airGap } = cabinet;
  
  // Helper: find all leaf types touching a given side
  const boundaryTypes = {
    top: new Set(),
    bottom: new Set(),
    left: new Set(),
    right: new Set(),
  };
  
  // Walk the tree to collect which types appear at the extremes
  walkBoundaries(layout, boundaryTypes, true, true, true, true);
  
  const allTypes = ['fresh','freezer','flex']; // all possible types
  // Effective thickness for a face = max thickness among types touching that face
  const effective = {};
  for (const face of ['top','bottom','left','right']) {
    const typesForFace = boundaryTypes[face];
    let maxVal = 0;
    for (const type of typesForFace) {
      const val = wallThicknessesByType[type]?.[face] ?? 0;
      if (val > maxVal) maxVal = val;
    }
    // If no type touches the face (shouldn't happen), fallback to max over all types
    if (typesForFace.size === 0) {
      for (const type of allTypes) {
        const val = wallThicknessesByType[type]?.[face] ?? 0;
        if (val > maxVal) maxVal = val;
      }
    }
    effective[face] = maxVal;
  }
  
  // Rear and door: max over all types
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));
  
  return {
    width:  external.width  - effective.left - effective.right,
    height: external.height - effective.top  - effective.bottom,
    depth:  external.depth  - effective.rear - effective.door - airGap,
  };
}

// Recursive function to collect types that touch the boundaries
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
    // left child touches left, right child touches right
    walkBoundaries(node.left,  boundary, topMost, bottomMost, true, false);
    walkBoundaries(node.right, boundary, topMost, bottomMost, false, true);
  }
}

// Volume of a shelf slab in L
export function shelfVol(shelf, availableWidth) {
  const w = shelf.width ?? availableWidth;
  return w * shelf.depth * shelf.thickness * settings.mm3ToL;
}

// Structure volume of a drawer (plastic) in L
export function drawerStructVol(drawer) {
  const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;
  const outerVol = oW * oD * oH;
  const innerW = oW - 2 * t;
  const innerD = oD - 2 * t;
  const innerH = oH - t;
  const innerVol = innerW * innerD * innerH;
  return (outerVol - innerVol) * settings.mm3ToL;
}

// Structure volume of a door bin (plastic) in L
export function binStructVol(bin) {
  const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;
  const outerVol = oW * oH * oD;
  const innerW = oW - 2 * t;
  const innerH = oH - 2 * t;
  const innerD = oD - t;
  const innerVol = innerW * innerH * innerD;
  return (outerVol - innerVol) * settings.mm3ToL;
}

/**
 * Calculates gross, EG_Net, and IEC_Net for a single leaf node.
 * EG_Net = Gross − Σ(user‑removable accessories)
 * IEC_Net = Gross × iecFactor − Σ(all fitting volumes)
 */
export function calcLeaf(leaf, space, excludedFittingIds = new Set()) {
  const { width, height, depth } = space;
  const fittings = leaf.fittings;
  const gross = width * depth * height * settings.mm3ToL;

  let userRemoveDeductions = 0;
  let allFittingDeductions = 0;

  for (const shelf of fittings.shelves) {
    if (excludedFittingIds.has(shelf.id)) continue;
    const vol = shelfVol(shelf, width);
    userRemoveDeductions += vol;
    allFittingDeductions += vol;
  }

  for (const drawer of fittings.drawers) {
    if (excludedFittingIds.has(drawer.id)) continue;
    const vol = drawerStructVol(drawer);
    userRemoveDeductions += vol;
    allFittingDeductions += vol;
  }

  for (const bin of fittings.doorBins) {
    if (excludedFittingIds.has(bin.id)) continue;
    const vol = binStructVol(bin);
    userRemoveDeductions += vol;
    allFittingDeductions += vol;
  }

  // Ice maker / light housing
  if (fittings.iceMakerHousing?.volume != null) {
    allFittingDeductions += fittings.iceMakerHousing.volume;
    if (settings.iceMakerRemovable) userRemoveDeductions += fittings.iceMakerHousing.volume;
  }
  if (fittings.lightHousing?.volume != null) {
    allFittingDeductions += fittings.lightHousing.volume;
    if (settings.lightRemovable) userRemoveDeductions += fittings.lightHousing.volume;
  }

  const egNet = gross - userRemoveDeductions;
  const iecNet = gross * settings.iecFactor - allFittingDeductions;

  return {
    leafId:           leaf.id,
    leafType:         leaf.type,
    space,
    gross,
    egNet,
    iecNet,
    fittings:         leaf.fittings,
    fittingErrors:    [...excludedFittingIds],
  };
}

// Aggregation and conversion
export function aggregateTotals(leaves) {
  let gross = 0, egNet = 0, iecNet = 0;
  for (const leaf of leaves) {
    gross  += leaf.gross;
    egNet  += leaf.egNet;
    iecNet += leaf.iecNet;
  }
  return { gross, egNet, iecNet };
}

export function toCuft(litres) {
  return litres * settings.lToCuft;
}

export function roundForDisplay(val, unit) {
  return unit === 'cuft'
    ? Math.round(val * Math.pow(10, settings.displayPrecisionCuft)) / Math.pow(10, settings.displayPrecisionCuft)
    : Math.round(val * Math.pow(10, settings.displayPrecisionL)) / Math.pow(10, settings.displayPrecisionL);
}

export function formatLeafDisplay(leaf) {
  return {
    gross:      roundForDisplay(leaf.gross,  'L'),
    egNet:      roundForDisplay(leaf.egNet,  'L'),
    iecNet:     roundForDisplay(leaf.iecNet, 'L'),
    grossCuft:  roundForDisplay(toCuft(leaf.gross),  'cuft'),
    egNetCuft:  roundForDisplay(toCuft(leaf.egNet),  'cuft'),
    iecNetCuft: roundForDisplay(toCuft(leaf.iecNet), 'cuft'),
  };
}

export function formatTotalsDisplay(totals) {
  return {
    gross:      roundForDisplay(totals.gross,  'L'),
    egNet:      roundForDisplay(totals.egNet,  'L'),
    iecNet:     roundForDisplay(totals.iecNet, 'L'),
    grossCuft:  roundForDisplay(toCuft(totals.gross),  'cuft'),
    egNetCuft:  roundForDisplay(toCuft(totals.egNet),  'cuft'),
    iecNetCuft: roundForDisplay(toCuft(totals.iecNet), 'cuft'),
  };
}