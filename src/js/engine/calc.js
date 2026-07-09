// js/calc/calc.js
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

// ---------------------------------------------------------------------------
// Precise leaf volume – NEW
// ---------------------------------------------------------------------------

/**
 * Calculate gross volume (litres) for a single compartment,
 * using its own wall thicknesses and, for the bottom compartment,
 * the stepped floor (compressor hump).
 *
 * @param {object} leafNode  – the leaf node (must have `id` and `type`)
 * @param {number} height    – compartment height in mm (from layout)
 * @param {object} geom      – global geometry (H, W, D, Hb, Db1, Db2, walls)
 * @param {number} compTopY  – absolute Y coordinate of the compartment top (mm)
 * @param {boolean} isBottommost – true if this leaf is the last (lowest) child
 */
export function calcLeafGrossPrecise(leafNode, height, geom, compTopY, isBottommost) {
  const rawType = leafNode.type;
  // Map 'fresh' to 'refrigerator' because geometry uses that key.
  const wallKey = rawType === 'fresh' ? 'refrigerator' : rawType;
  const walls = geom.walls[wallKey];

  if (!walls) {
    // Handle gracefully – throw or return an error.
    throw new Error(`Unknown wall type: ${rawType} (mapped to ${wallKey})`);
  }

  // 1. Inner width (per compartment)
  const innerW = geom.W - walls.left - walls.right;   // mm

  // 2. Cross‑sectional area (side view)
  let area; // mm²

  const rearX = walls.rear;            // inner rear face x
  const frontX = geom.D;               // inner front face (door insulation outside)

  if (!isBottommost) {
    // Rectangular cross‑section (constant depth)
    const innerD = frontX - rearX;
    area = height * innerD;
  } else {
    // Bottom compartment – stepped floor
    const Hb   = geom.Hb;
    const tRb1 = walls.bottom1;        // e.g., refrigerator bottom1
    const tRb2 = walls.bottom2;        // refrigerator bottom2
    const tRb3 = walls.bottom3;

    const floorRaisedY = geom.H - Hb - tRb1;   // top of raised floor
    const floorLowerY  = geom.H - tRb3;        // lowest point

    // Raw compressor step points (outer surface)
    const xTopCB = geom.Db1;
    const yTopCB = geom.H - Hb;
    const xBottomCB = geom.Db2;
    const yBottomCB = geom.H;

    // Offset the compressor step inward by tRb2
    const cbDx = xBottomCB - xTopCB;
    const cbDy = yBottomCB - yTopCB;
    const cbLen = Math.sqrt(cbDx * cbDx + cbDy * cbDy);

    let slopeStartX, slopeEndX;

    if (cbLen === 0) {
      // Vertical step (degenerate) – treat as flat floor at raised level?
      slopeStartX = xTopCB + tRb2; // offset inward
      slopeEndX = slopeStartX;
    } else {
      // Unit normal pointing inward (perpendicular to step)
      const nx =  cbDy / cbLen;    // inward normal x
      const ny = -cbDx / cbLen;    // inward normal y

      // Offset the top corner of the step
      const px = xTopCB + nx * tRb2;
      const py = yTopCB + ny * tRb2;

      // Find where the offset line intersects the raised and lower floor levels
      const tStart = (floorRaisedY - py) / cbDy;
      slopeStartX = px + cbDx * tStart;

      const tEnd = (floorLowerY - py) / cbDy;
      slopeEndX = px + cbDx * tEnd;
    }

    // Build polygon (clockwise)
    const poly = [
      [rearX,         compTopY],
      [frontX,        compTopY],
      [frontX,        floorLowerY],
      [slopeEndX,     floorLowerY],
      [slopeStartX,   floorRaisedY],
      [rearX,         floorRaisedY]
    ];

    area = polygonArea(poly);
  }

  // 3. Volume in mm³ → litres
  const volumeL = area * innerW * settings.mm3ToL;

  return {
    leafId: leafNode.id,
    gross: volumeL,
  };
}

/**
 * Shoelace formula for polygon area.
 * @param {number[][]} vertices – array of [x, y]
 * @returns {number} area
 */
export function polygonArea(vertices) {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = vertices[i];
    const [x2, y2] = vertices[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}
