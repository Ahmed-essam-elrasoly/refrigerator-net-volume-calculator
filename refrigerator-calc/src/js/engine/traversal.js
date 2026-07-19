// js/engine/traversal.js
import { calcLeafGrossPrecise } from './calc.js';

const DIM_TOL = 0.01;

/**
 * Traverses the hierarchical layout tree and computes the gross volumes for 
 * each compartment based on specific wall thicknesses and geometric constraints.
 * 
 * This function calculates the available internal height by evaluating the top
 * insulation of the topmost compartment and the stepped floor dimensions of the 
 * bottommost compartment. It then iterates through the child nodes, distributing 
 * height according to either a ratio or an explicit measurement, and computes the 
 * final volume.
 *
 * @param {object} rootNode - The root of the layout tree. Must be a 'horizontal' node.
 * @param {object} geometry - The full cabinet geometry object containing external dimensions, 
 *                            compressor step dimensions, and compartment wall definitions.
 * @returns {{ leaves: Array<object>, errors: Array<object>, warnings: Array<object> }} 
 *          An object containing an array of calculated leaf results (gross volumes), 
 *          and any validation errors or warnings encountered during traversal.
 */
export function traverseAndComputePrecise(rootNode, geometry) {
  const errors   = [];
  const warnings = [];
  const leaves   = [];

  // The root node must define a horizontal split (compartments stacked vertically).
  if (rootNode.nodeType !== 'horizontal') {
    errors.push({ rule: 'layout', message: 'Root node must be horizontal for precise calc' });
    return { leaves, errors, warnings };
  }

  // 1. Determine top insulation thickness from the first (topmost) child compartment.
  const firstChild = rootNode.children[0]?.node;
  if (!firstChild || firstChild.nodeType !== 'leaf') {
    errors.push({ rule: 'layout', message: 'First child must be a leaf' });
    return { leaves, errors, warnings };
  }
  
  // Map 'fresh' type to 'refrigerator' to match the geometry.walls schema.
  const topWallKey = firstChild.type === 'fresh' ? 'refrigerator' : firstChild.type;
  const topWalls = geometry.walls[topWallKey];
  
  if (!topWalls) {
    errors.push({ rule: 'layout', message: `Unknown wall type: ${firstChild.type}` });
    return { leaves, errors, warnings };
  }
  
  const topInsul = topWalls.top;
  const topY = topInsul;   // Absolute Y coordinate representing the inner top boundary.

  // 2. Determine bottom insulation thickness from the last (bottommost) child compartment.
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

  // 3. Compute the total available internal height for the compartment stack.
  // This evaluates the space between the inner top ceiling and the lowest point 
  // of the raised compressor floor.
  let floorLowerY;
  
  // The stepped floor logic applies to ANY bottom-most compartment. 
  // 'bottom1' defines the insulation thickness directly over the top of the compressor hump.
  if (bottomWalls.bottom1 === undefined) {
    errors.push({ rule: 'layout', message: `Wall definition for type '${lastChild.type}' is missing 'bottom1' thickness for stepped floor calculation.` });
    return { leaves, errors, warnings };
  }
  
  // Calculate the lowest internal floor Y coordinate.
  floorLowerY = geometry.H - (bottomWalls.bottom3 || bottomWalls.bottom1);
  const totalAvailableHeight = floorLowerY - topY;
  
  // 4. Calculate total thickness occupied by horizontal dividers between compartments.
  const dividers = rootNode.dividers || [];
  const totalDividerH = dividers.reduce((s, d) => s + (d.thickness || 0), 0);

  // 5. Determine individual compartment heights based on the layout height mode.
  const mode = rootNode.children[0].heightMode;
  let childHeights;
  
  if (mode === 'ratio') {
    // Distribute remaining height proportionally.
    const usableH = totalAvailableHeight - totalDividerH;
    childHeights = rootNode.children.map(c => usableH * c.heightValue);
  } else { 
    // Explicit mode: Check if explicit heights + dividers match the total available height.
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

  // 6. Iterate through children to calculate the volume for each leaf compartment.
  let yOffset = topY;
  for (let i = 0; i < rootNode.children.length; i++) {
    const childNode = rootNode.children[i].node;
    const height = childHeights[i];
    const isBottommost = (i === rootNode.children.length - 1);

    if (childNode.nodeType === 'leaf') {
      // Execute the precise volume calculation incorporating the stepped floor polygon if necessary.
      const result = calcLeafGrossPrecise(childNode, height, geometry, yOffset, isBottommost);
      leaves.push(result);
    } else {
      errors.push({ rule: 'layout', message: 'Nested splits not supported in precise model' });
    }

    yOffset += height;
    
    // Add divider thickness to the Y offset before moving to the next compartment.
    if (i < rootNode.children.length - 1) {
      yOffset += dividers[i]?.thickness || 0;
    }
  }

  return { leaves, errors, warnings };
}