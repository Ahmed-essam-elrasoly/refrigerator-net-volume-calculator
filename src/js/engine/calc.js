// js/calc/calc.js
import { settings } from '../settings.js';

// ---------------------------------------------------------------------------
// Boundary walker (unchanged)
// ---------------------------------------------------------------------------

/**
 * Derives the maximum available internal root space by evaluating the 
 * external dimensions and subtracting the maximum effective wall thicknesses 
 * found across all compartments defined in the layout.
 *
 * @param {object} cabinet - Contains external dimensions and wallThicknessesByType.
 * @param {object} layout - The root node of the compartment layout tree.
 * @returns {{ width: number, height: number, depth: number }} The available internal root space in mm.
 */
export function deriveRootSpace(cabinet, layout) {
  const { external, wallThicknessesByType, airGap } = cabinet;

  const boundaryTypes = {
    top: new Set(),
    bottom: new Set(),
    left: new Set(),
    right: new Set(),
  };
  
  // Discover which compartment types touch which external boundaries.
  walkBoundaries(layout, boundaryTypes, true, true, true, true);

  const allTypes = ['fresh','freezer','flex'];
  const effective = {};
  
  // Calculate the maximum insulation thickness required for each outer face.
  for (const face of ['top','bottom','left','right']) {
    const typesForFace = boundaryTypes[face];
    let maxVal = 0;
    for (const type of typesForFace) {
      const val = wallThicknessesByType[type]?.[face] ?? 0;
      if (val > maxVal) maxVal = val;
    }
    // Fallback: If no types touch a face, take the absolute max thickness defined.
    if (typesForFace.size === 0) {
      for (const type of allTypes) {
        const val = wallThicknessesByType[type]?.[face] ?? 0;
        if (val > maxVal) maxVal = val;
      }
    }
    effective[face] = maxVal;
  }
  
  // Rear and door insulation thicknesses are uniform across the height/width.
  effective.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  effective.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));

  // Subtract effective boundaries from external dimensions.
  return {
    width:  external.width  - effective.left - effective.right,
    height: external.height - effective.top  - effective.bottom,
    depth:  external.depth  - effective.rear,
  };
}

/**
 * Recursively walks the layout tree to determine which compartment types 
 * touch the outer boundaries of the cabinet.
 *
 * @param {object} node - The current layout node.
 * @param {object} boundary - Sets tracking which types touch which face.
 * @param {boolean} topMost - True if the node touches the top boundary.
 * @param {boolean} bottomMost - True if the node touches the bottom boundary.
 * @param {boolean} leftMost - True if the node touches the left boundary.
 * @param {boolean} rightMost - True if the node touches the right boundary.
 */
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
 * Calculates a simple cubic gross volume for a compartment. 
 * (Primarily used in older API versions).
 *
 * @param {object} leaf - The leaf node.
 * @param {object} space - The calculated { width, height, depth } in mm.
 * @returns {{ leafId: string, gross: number }} Result object with volume in Litres.
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

/**
 * Converts volume from Litres to Cubic Feet.
 * @param {number} litres 
 * @returns {number}
 */
export function toCuft(litres) {
  return litres * settings.lToCuft;
}

/**
 * Rounds a numeric value based on the required display precision defined in settings.
 * @param {number} val 
 * @param {string} unit - 'L' or 'cuft'
 * @returns {number}
 */
export function roundForDisplay(val, unit) {
  const precision = unit === 'cuft' ? settings.displayPrecisionCuft : settings.displayPrecisionL;
  return Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision);
}

// ---------------------------------------------------------------------------
// Precise leaf volume – NEW
// ---------------------------------------------------------------------------

/**
 * Calculate the precise gross volume (litres) for a single compartment,
 * applying its specific wall thicknesses. Crucially, if the compartment is 
 * the bottommost in the cabinet, it utilizes the Shoelace algorithm to calculate 
 * the cross-sectional area incorporating the angled stepped floor (compressor hump).
 *
 * @param {object} leafNode - The leaf node representing the compartment.
 * @param {number} height - The full allocated compartment height in mm.
 * @param {object} geom - The global geometry object (H, W, D, Hb, Db1, Db2, walls).
 * @param {number} compTopY - The absolute Y coordinate representing the top boundary of this compartment (mm).
 * @param {boolean} isBottommost - True if this leaf sits at the bottom of the cabinet.
 * @returns {{ leafId: string, gross: number }} Result object with volume in Litres.
 */
export function calcLeafGrossPrecise(leafNode, height, geom, compTopY, isBottommost) {
  const rawType = leafNode.type;
  
  // Map 'fresh' to 'refrigerator' to access the correct geometry definitions.
  const wallKey = rawType === 'fresh' ? 'refrigerator' : rawType;
  const walls = geom.walls[wallKey];

  if (!walls) {
    throw new Error(`Unknown wall type: ${rawType} (mapped to ${wallKey})`);
  }

  // 1. Calculate Internal Width
  const innerW = geom.W - walls.left - walls.right;   // mm

  // 2. Calculate Cross-sectional Area (Side View Profile)
  let area; // mm²

  const rearX = walls.rear;            // Inner rear face x-coordinate
  const frontX = geom.D;               // Inner front face x-coordinate (door insulation is handled externally)

  if (!isBottommost) {
    // Upper compartments are rectangular cubes.
    const innerD = frontX - rearX;
    area = height * innerD;
  } else {
    // Bottom compartment requires polygon area calculation to account for the stepped floor.
    const Hb   = geom.Hb;
    const tRb1 = walls.bottom1;        // Insulation thickness above the step
    const tRb2 = walls.bottom2;        // Insulation thickness along the angled step
    const tRb3 = walls.bottom3;        // Insulation thickness along the lower floor

    const floorRaisedY = geom.H - Hb - tRb1;   // Y-coordinate of the raised floor (top of step)
    const floorLowerY  = geom.H - tRb3;        // Y-coordinate of the lowest internal floor

    // Raw compressor step coordinates (Exterior surface of the cabinet)
    const xTopCB = geom.Db1;
    const yTopCB = geom.H - Hb;
    const xBottomCB = geom.Db2;
    const yBottomCB = geom.H;

    // Calculate the step vector to offset the internal boundary by the insulation thickness (tRb2)
    const cbDx = xBottomCB - xTopCB;
    const cbDy = yBottomCB - yTopCB;
    const cbLen = Math.sqrt(cbDx * cbDx + cbDy * cbDy);

    let slopeStartX, slopeEndX;

    if (cbLen === 0) {
      // Degenerate case: The step is perfectly vertical. Treat as a flat floor at the raised level.
      slopeStartX = xTopCB + tRb2; 
      slopeEndX = slopeStartX;
    } else {
      // Calculate unit normal vector pointing inward (perpendicular to the step surface)
      const nx =  cbDy / cbLen;    
      const ny = -cbDx / cbLen;    

      // Offset the top corner of the step inward
      const px = xTopCB + nx * tRb2;
      const py = yTopCB + ny * tRb2;

      // Calculate intersection points of the offset line with the raised and lower floor planes
      const tStart = (floorRaisedY - py) / cbDy;
      slopeStartX = px + cbDx * tStart;

      const tEnd = (floorLowerY - py) / cbDy;
      slopeEndX = px + cbDx * tEnd;
    }

    // Define the internal cross-section polygon (ordered clockwise)
    const poly = [
      [rearX,         compTopY],
      [frontX,        compTopY],
      [frontX,        floorLowerY],
      [slopeEndX,     floorLowerY],
      [slopeStartX,   floorRaisedY],
      [rearX,         floorRaisedY]
    ];

    // Calculate area using Gauss's area formula
    area = polygonArea(poly);
  }

  // 3. Extrude the area by the internal width and convert mm³ to Litres
  const volumeL = area * innerW * settings.mm3ToL;

  return {
    leafId: leafNode.id,
    gross: volumeL,
  };
}

/**
 * Calculates the area of a 2D polygon using the Shoelace formula (Gauss's area formula).
 * Required for accurately determining the cross-sectional area of compartments containing 
 * the angled compressor step.
 * 
 * @param {number[][]} vertices - An array of [x, y] coordinate pairs defining the polygon clockwise or counter-clockwise.
 * @returns {number} The absolute area of the polygon.
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