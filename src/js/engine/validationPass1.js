/**
 * @file validationPass1.js
 * Pass 1 — structural validation.
 * Operates on the raw node tree with no space/dimension context.
 * Catches all errors that can be detected from tree shape and metadata alone.
 * Returns ValidationError[]. Non-empty result blocks Pass 2 entirely.
 */

const VALID_TYPES   = new Set(['fresh', 'freezer', 'flex']);
const VALID_MODES   = new Set(['ratio', 'explicit']);
const MAX_LEAVES    = 8;
const RATIO_TOL     = 0.001;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Runs all Pass 1 structural checks on the root node.
 * Validates the tree structure, counts leaf nodes against constraints,
 * and recursively traverses to verify component shapes.
 * 
 * @param {import('./types').Node} rootNode - The root of the layout tree to validate.
 * @returns {import('./types').ValidationError[]} List of structural errors found.
 */
export function validateStructure(rootNode) {
  const errors = [];

  // Global: leaf count check
  const leafCount = countLeaves(rootNode);
  if (leafCount > MAX_LEAVES) {
    errors.push({
      rule:    'maxLeaves',
      message: `${leafCount} leaves exceed maximum of ${MAX_LEAVES}`,
    });
  }

  // Recursive structural checks
  walkStructure(rootNode, errors);

  return errors;
}

// ---------------------------------------------------------------------------
// Leaf counting
// ---------------------------------------------------------------------------

/**
 * Recursively counts all 'leaf' nodes in the layout tree.
 * @param {import('./types').Node} node - Current node in the tree.
 * @returns {number} The total count of leaf compartments.
 */
export function countLeaves(node) {
  if (node.nodeType === 'leaf') return 1;
  if (node.nodeType === 'vertical') {
    return countLeaves(node.left) + countLeaves(node.right);
  }
  if (node.nodeType === 'horizontal') {
    return node.children.reduce((sum, c) => sum + countLeaves(c.node), 0);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Recursive structural walk
// ---------------------------------------------------------------------------

/**
 * Walks the tree and collects structural errors into the errors array.
 * This is the primary dispatcher for node-specific validation logic.
 * 
 * @param {import('./types').Node} node - Current node being inspected.
 * @param {import('./types').ValidationError[]} errors - Array to collect errors.
 */
function walkStructure(node, errors) {
  if (!node || typeof node !== 'object') {
    errors.push({ rule: 'malformedNode', message: 'Node is null or not an object' });
    return;
  }

  switch (node.nodeType) {
    case 'leaf':
      checkLeafStructure(node, errors);
      break;
    case 'horizontal':
      checkHorizontalShape(node, errors);
      checkHeightRatios(node, errors);
      for (const child of node.children) walkStructure(child.node, errors);
      break;
    case 'vertical':
      checkVerticalShape(node, errors);
      walkStructure(node.left,  errors);
      walkStructure(node.right, errors);
      break;
    default:
      errors.push({
        rule:    'unknownNodeType',
        nodeId:  node.id,
        message: `Unknown nodeType: "${node.nodeType}"`,
      });
  }
}

// ---------------------------------------------------------------------------
// Per-node checkers
// ---------------------------------------------------------------------------

/**
 * Orchestrates checks for a single LeafNode.
 * @param {import('./types').LeafNode} node
 * @param {import('./types').ValidationError[]} errors
 */
function checkLeafStructure(node, errors) {
  checkEnums(node, errors);
  checkPositiveFittingValues(node, errors);
}

/**
 * Validates that the compartment type is allowed and required fittings exist.
 * @param {import('./types').LeafNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkEnums(node, errors) {
  if (!VALID_TYPES.has(node.type)) {
    errors.push({
      rule:    'checkEnums',
      nodeId:  node.id,
      message: `Unknown compartment type: ${node.type}`,
    });
  }

  // Verify fittings object exists
  if (!node.fittings) {
    errors.push({
      rule:    'missingFittings',
      nodeId:  node.id,
      message: 'LeafNode is missing fittings object',
    });
  }
}

/**
 * Ensures all numeric dimension values for fittings (drawers, shelves, etc.) are > 0.
 * @param {import('./types').LeafNode} node
 * @param {import('./types').ValidationError[]} errors
 */
function checkPositiveFittingValues(node, errors) {
  if (!node.fittings) return;
  const f = node.fittings;

  if (f.shelfCount != null) {
    if (!Number.isInteger(f.shelfCount) || f.shelfCount <= 0) {
      errors.push({
        rule: 'positiveValues',
        nodeId: node.id,
        message: `shelfCount must be a positive integer, got ${f.shelfCount}`
      });
    }
    // If shelfCount is given, detailed shelves are optional
    if (f.shelves && f.shelves.length > 0) {
      errors.push({
        rule: 'ambiguousShelves',
        nodeId: node.id,
        message: 'Provide either shelfCount or shelves, not both'
      });
    }
    return; // skip checking detailed shelves
  }
  for (const drawer of f.drawers ?? []) {
    checkPositive(drawer, ['outerWidth', 'outerDepth', 'outerHeight', 'wallThickness'], errors, node.id);
  }
  for (const bin of f.doorBins ?? []) {
    checkPositive(bin, ['outerWidth', 'outerHeight', 'outerDepth', 'wallThickness'], errors, node.id);
  }
  if (f.iceMakerHousing?.volume != null && f.iceMakerHousing.volume <= 0) {
    errors.push({ rule: 'positiveValues', nodeId: node.id,
      message: 'iceMakerHousing.volume must be > 0' });
  }
  if (f.lightHousing?.volume != null && f.lightHousing.volume <= 0) {
    errors.push({ rule: 'positiveValues', nodeId: node.id,
      message: 'lightHousing.volume must be > 0' });
  }
}

/**
 * Validates the horizontal split configuration including divider count and height modes.
 * @param {import('./types').HorizontalSplitNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkHorizontalShape(node, errors) {
  const { children, dividers, id } = node;

  // dividerCount: must be exactly children.length - 1
  const expectedDividers = children.length - 1;
  if (dividers.length !== expectedDividers) {
    errors.push({
      rule:    'dividerCount',
      nodeId:  id,
      message: `Expected ${expectedDividers} divider(s), found ${dividers.length}`,
    });
  }

  // afterChildIndex: unique, in range [0, children.length - 2]
  const seen = new Set();
  for (const d of dividers) {
    if (seen.has(d.afterChildIndex)) {
      errors.push({
        rule:    'afterChildIndex_unique',
        nodeId:  id,
        message: `Duplicate afterChildIndex: ${d.afterChildIndex}`,
      });
    }
    seen.add(d.afterChildIndex);

    if (d.afterChildIndex < 0 || d.afterChildIndex > children.length - 2) {
      errors.push({
        rule:    'afterChildIndex_range',
        nodeId:  id,
        message: `afterChildIndex ${d.afterChildIndex} out of range [0, ${children.length - 2}]`,
      });
    }
  }

  // heightMode_uniform: all children must use the same heightMode
  const modes = new Set(children.map(c => c.heightMode));
  if (modes.size > 1) {
    errors.push({
      rule:    'heightMode_uniform',
      nodeId:  id,
      message: 'Mixed heightMode in same HorizontalSplitNode',
    });
    return; // cannot check ratios if modes are mixed
  }

  // Validate each child has a known heightMode
  for (const child of children) {
    if (!VALID_MODES.has(child.heightMode)) {
      errors.push({
        rule:    'heightMode_unknown',
        nodeId:  id,
        message: `Unknown heightMode: "${child.heightMode}"`,
      });
    }
  }
}

/**
 * Checks ratio balance for HorizontalSplitNode children in ratio mode.
 * Must run after checkHorizontalShape (depends on uniform mode guarantee).
 * @param {import('./types').HorizontalSplitNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkHeightRatios(node, errors) {
  if (!node.children.length) return;
  const mode = node.children[0].heightMode;
  if (mode !== 'ratio') return; // explicit balance checked in Pass 2

  const sum = node.children.reduce((acc, c) => acc + c.heightValue, 0);
  if (Math.abs(sum - 1.0) > RATIO_TOL) {
    errors.push({
      rule:    'heightBalance_ratio',
      nodeId:  node.id,
      message: `Ratio sum ${sum.toFixed(4)} deviates from 1.0 by more than ${RATIO_TOL}`,
    });
  }
}

/**
 * Validates the vertical split configuration, specifically width ratios and divider thickness.
 * @param {import('./types').VerticalSplitNode} node
 * @param {import('./types').ValidationError[]} errors
 */
export function checkVerticalShape(node, errors) {
  const { leftWidthRatio, dividerThickness, id } = node;

  if (leftWidthRatio <= 0 || leftWidthRatio >= 1) {
    errors.push({
      rule:    'leftWidthRatio_bounds',
      nodeId:  id,
      message: `leftWidthRatio must satisfy 0 < value < 1, got ${leftWidthRatio}`,
    });
  }

  if (dividerThickness <= 0) {
    errors.push({
      rule:    'positiveValues',
      nodeId:  id,
      message: `VerticalSplitNode dividerThickness must be > 0, got ${dividerThickness}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generic helper to check that an object's fields contain positive values.
 * @param {Object} obj - The object containing numeric properties to check.
 * @param {string[]} fields - List of property names to validate.
 * @param {import('./types').ValidationError[]} errors - Accumulator for errors.
 * @param {string} nodeId - Node identifier for error reporting.
 */
function checkPositive(obj, fields, errors, nodeId) {
  for (const field of fields) {
    if (obj[field] <= 0) {
      errors.push({
        rule:    'positiveValues',
        nodeId,
        message: `${field} must be > 0, got ${obj[field]}`,
      });
    }
  }
}