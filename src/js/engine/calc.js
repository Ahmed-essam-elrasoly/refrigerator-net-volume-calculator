/**
 * @file calc.js
 * Pure calculation functions. No DOM, no side effects, no validation.
 * All inputs are assumed valid when these functions are called.
 * Validation is the caller's responsibility (see validation.js + traversal.js).
 */

const MM3_TO_L   = 1e-6;
const L_TO_CUFT  = 0.0353147;
const EG_FACTOR  = 0.97;

// ---------------------------------------------------------------------------
// Root space derivation
// ---------------------------------------------------------------------------

/**
 * Derives the available internal space at the root of the tree
 * from cabinet external dimensions, wall thicknesses, and air gap.
 *
 * @param {import('./types').CabinetConfig['cabinet']} cabinet
 * @returns {import('./types').Space}
 */
export function deriveRootSpace(cabinet) {
  const { external, wallThicknesses: w, airGap } = cabinet;
  return {
    width:  external.width  - w.left  - w.right,
    height: external.height - w.top   - w.bottom,
    depth:  external.depth  - w.rear  - w.door - airGap,
  };
}

// ---------------------------------------------------------------------------
// Fitting volume calculations
// ---------------------------------------------------------------------------

/**
 * Volume of a shelf slab in L.
 * If shelf.width is null, the full available width is used.
 *
 * @param {import('./types').Shelf} shelf
 * @param {number} availableWidth - mm
 * @returns {number} L, full precision
 */
export function shelfVol(shelf, availableWidth) {
  const w = shelf.width ?? availableWidth;
  return w * shelf.depth * shelf.thickness * MM3_TO_L;
}

/**
 * Structure volume of a drawer (outer minus inner usable space) in L.
 * Open-top model: innerHeight = outerHeight - wallThickness (one wall only).
 *
 * @param {import('./types').Drawer} drawer
 * @returns {number} L, full precision
 */
export function drawerStructVol(drawer) {
  const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;
  const outerVol = oW * oD * oH;
  const innerW   = oW - 2 * t;
  const innerD   = oD - 2 * t;
  const innerH   = oH - t;          // open top
  const innerVol = innerW * innerD * innerH;
  return (outerVol - innerVol) * MM3_TO_L;
}

/**
 * Structure volume of a door bin (outer minus inner usable space) in L.
 * Open-front model: innerDepth = outerDepth - wallThickness (one wall only).
 *
 * @param {import('./types').DoorBin} bin
 * @returns {number} L, full precision
 */
export function binStructVol(bin) {
  const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;
  const outerVol = oW * oH * oD;
  const innerW   = oW - 2 * t;
  const innerH   = oH - 2 * t;
  const innerD   = oD - t;          // open front
  const innerVol = innerW * innerH * innerD;
  return (outerVol - innerVol) * MM3_TO_L;
}

// ---------------------------------------------------------------------------
// Leaf volume calculation
// ---------------------------------------------------------------------------

/**
 * Calculates gross, EG_Net, and IEC_Net for a single leaf node.
 *
 * EG_Net  = Gross × 0.97  (fixed deduction only; fittings do NOT affect EG)
 * IEC_Net = Gross × 0.97 - Σ(fitting deduction volumes)
 *
 * Invalid fittings (those that failed Pass 2 dimensional checks) are passed
 * via excludedFittingIds and silently skipped — their deduction contribution
 * is zero, but the leaf's gross and EG are unaffected.
 *
 * @param {import('./types').LeafNode}   leaf
 * @param {import('./types').Space}      space
 * @param {Set<string>}                  excludedFittingIds
 * @returns {import('./types').LeafResult}
 */
export function calcLeaf(leaf, space, excludedFittingIds = new Set()) {
  const { width, height, depth } = space;
  const fittings = leaf.fittings;

  // Gross volume
  const gross = width * depth * height * MM3_TO_L;

  // EG_Net — fixed 3% factor only
  const egNet = gross * EG_FACTOR;

  // IEC deductions — iterate fittings, skip excluded ids
  let deductions = 0;

  for (const shelf of fittings.shelves) {
    if (excludedFittingIds.has(shelf.id)) continue;
    deductions += shelfVol(shelf, width);
  }

  for (const drawer of fittings.drawers) {
    if (excludedFittingIds.has(drawer.id)) continue;
    deductions += drawerStructVol(drawer);
  }

  for (const bin of fittings.doorBins) {
    if (excludedFittingIds.has(bin.id)) continue;
    deductions += binStructVol(bin);
  }

  if (fittings.iceMakerHousing?.volume != null) {
    deductions += fittings.iceMakerHousing.volume;
  }

  if (fittings.lightHousing?.volume != null) {
    deductions += fittings.lightHousing.volume;
  }

  const iecNet = egNet - deductions;

  return {
    leafId:         leaf.id,
    leafType:       leaf.type,
    space,
    gross,
    egNet,
    iecNet,
    fittingErrors:  [...excludedFittingIds],
  };
}

// ---------------------------------------------------------------------------
// Aggregation and unit conversion
// ---------------------------------------------------------------------------

/**
 * Sums full-precision per-leaf volumes into cabinet totals.
 * Rounding to display precision happens outside this function.
 *
 * @param {import('./types').LeafResult[]} leaves
 * @returns {import('./types').Totals}
 */
export function aggregateTotals(leaves) {
  let gross = 0, egNet = 0, iecNet = 0;
  for (const leaf of leaves) {
    gross  += leaf.gross;
    egNet  += leaf.egNet;
    iecNet += leaf.iecNet;
  }
  return { gross, egNet, iecNet };
}

/**
 * Converts a volume in litres to cubic feet.
 * @param {number} litres
 * @returns {number}
 */
export function toCuft(litres) {
  return litres * L_TO_CUFT;
}

/**
 * Rounds a volume value for display.
 * @param {number} val
 * @param {'L'|'cuft'} unit
 * @returns {number}
 */
export function roundForDisplay(val, unit) {
  return unit === 'cuft'
    ? Math.round(val * 1000) / 1000
    : Math.round(val * 100)  / 100;
}

/**
 * Formats a LeafResult and totals into display-ready rounded values.
 * @param {import('./types').LeafResult} leaf
 * @returns {{ gross: number, egNet: number, iecNet: number,
 *             grossCuft: number, egNetCuft: number, iecNetCuft: number }}
 */
export function formatLeafDisplay(leaf) {
  return {
    gross:       roundForDisplay(leaf.gross,  'L'),
    egNet:       roundForDisplay(leaf.egNet,  'L'),
    iecNet:      roundForDisplay(leaf.iecNet, 'L'),
    grossCuft:   roundForDisplay(toCuft(leaf.gross),  'cuft'),
    egNetCuft:   roundForDisplay(toCuft(leaf.egNet),  'cuft'),
    iecNetCuft:  roundForDisplay(toCuft(leaf.iecNet), 'cuft'),
  };
}

/**
 * Formats totals into display-ready rounded values.
 * @param {import('./types').Totals} totals
 * @returns {{ gross: number, egNet: number, iecNet: number,
 *             grossCuft: number, egNetCuft: number, iecNetCuft: number }}
 */
export function formatTotalsDisplay(totals) {
  return {
    gross:       roundForDisplay(totals.gross,  'L'),
    egNet:       roundForDisplay(totals.egNet,  'L'),
    iecNet:      roundForDisplay(totals.iecNet, 'L'),
    grossCuft:   roundForDisplay(toCuft(totals.gross),  'cuft'),
    egNetCuft:   roundForDisplay(toCuft(totals.egNet),  'cuft'),
    iecNetCuft:  roundForDisplay(toCuft(totals.iecNet), 'cuft'),
  };
}

export { EG_FACTOR, MM3_TO_L, L_TO_CUFT };
