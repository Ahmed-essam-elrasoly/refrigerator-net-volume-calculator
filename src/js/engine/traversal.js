// js/engine/traversal.js
import { calcLeafGrossPrecise } from './calc.js';

const DIM_TOL = 0.01;

/**
 * Traverse the layout tree and compute volumes using per‑compartment geometry.
 * @param {object} rootNode   – layout node (horizontal)
 * @param {object} geometry   – full cabinet.geometry object
 * @returns {{ leaves: array, errors: array, warnings: array }}
 */
export function traverseAndComputePrecise(rootNode, geometry) {
  const errors   = [];
  const warnings = [];
  const leaves   = [];

  if (rootNode.nodeType !== 'horizontal') {
    errors.push({ rule: 'layout', message: 'Root node must be horizontal for precise calc' });
    return { leaves, errors, warnings };
  }

  // Determine top insulation from first child
  const firstChild = rootNode.children[0]?.node;
  if (!firstChild || firstChild.nodeType !== 'leaf') {
    errors.push({ rule: 'layout', message: 'First child must be a leaf' });
    return { leaves, errors, warnings };
  }
  const topWallKey = firstChild.type === 'fresh' ? 'refrigerator' : firstChild.type;
  const topWalls = geometry.walls[topWallKey];
  if (!topWalls) {
    errors.push({ rule: 'layout', message: `Unknown wall type: ${firstChild.type}` });
    return { leaves, errors, warnings };
  }
  const topInsul = topWalls.top;
  const topY = topInsul;   // absolute Y of inner top

  // Determine bottom insulation of last child (for available height)
  const lastChild = rootNode.children[rootNode.children.length - 1]?.node;
  if (!lastChild || lastChild.nodeType !== 'leaf') {
    errors.push({ rule: 'layout', message: 'Last child must be a leaf' });
    return { leaves, errors, warnings };
  }
  const bottomWallKey = lastChild.type === 'fresh' ? 'refrigerator' : lastChild.type;
  const bottomWalls = geometry.walls[bottomWallKey];
  if (!bottomWalls) {
    errors.push({ rule: 'layout', message: `Unknown wall type: ${lastChild.type}` });
    return { leaves, errors, warnings };
  }

  // Compute total available height for the stack (from inner top to raised floor)
  let floorRaisedY;
  if (lastChild.type === 'fresh') {
    // Stepped floor: raised level = H - Hb - bottom1
    if (bottomWalls.bottom1 === undefined) {
      errors.push({ rule: 'layout', message: 'Fresh compartment missing bottom1 thickness' });
      return { leaves, errors, warnings };
    }
    floorRaisedY = geometry.H - geometry.Hb - bottomWalls.bottom1;
  } else {
    // Flat floor: bottom is outer H minus bottom insulation (use 'bottom' if present, else 0)
    const bottomInsul = bottomWalls.bottom || 0;
    floorRaisedY = geometry.H - bottomInsul;
  }
  const totalAvailableHeight = floorRaisedY - topY;

  // Divider sum
  const dividers = rootNode.dividers || [];
  const totalDividerH = dividers.reduce((s, d) => s + (d.thickness || 0), 0);

  // Height mode
  const mode = rootNode.children[0].heightMode;
  let childHeights;
  if (mode === 'ratio') {
    const usableH = totalAvailableHeight - totalDividerH;
    childHeights = rootNode.children.map(c => usableH * c.heightValue);
  } else { // explicit
    const sumHeights = rootNode.children.reduce((s, c) => s + c.heightValue, 0);
    const total = sumHeights + totalDividerH;
    if (Math.abs(total - totalAvailableHeight) > DIM_TOL) {
      errors.push({
        rule: 'heightBalance_explicit',
        nodeId: rootNode.id,
        message: `Sum of heights (${sumHeights}) + dividers (${totalDividerH}) = ${total} ≠ availableHeight (${totalAvailableHeight})`,
        childrenSkipped: true,
      });
      return { leaves, errors, warnings };
    }
    childHeights = rootNode.children.map(c => c.heightValue);
  }

  // Iterate children
  let yOffset = topY;
  for (let i = 0; i < rootNode.children.length; i++) {
    const childNode = rootNode.children[i].node;
    const height = childHeights[i];
    const isBottommost = (i === rootNode.children.length - 1);

    if (childNode.nodeType === 'leaf') {
      // Calculate precise volume for this leaf
      const result = calcLeafGrossPrecise(childNode, height, geometry, yOffset, isBottommost);
      leaves.push(result);
    } else {
      errors.push({ rule: 'layout', message: 'Nested splits not supported in precise model' });
    }

    yOffset += height;
    // Add divider after this child (if not last)
    if (i < rootNode.children.length - 1) {
      yOffset += dividers[i]?.thickness || 0;
    }
  }

  return { leaves, errors, warnings };
}