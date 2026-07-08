/**
 * Draw a dimension line with extension lines, arrows, and label.
 * Styled to standard CAD drafting representation.
 */
export function drawDim(ctx, x1, y1, x2, y2, offset, label, {
  color = DRAW_THEME.color,
  lineWidth = DRAW_THEME.lineWidth,
  arrowSize = DRAW_THEME.arrowSize,
  font = DRAW_THEME.font,
  textOffsetX = 0,
  textOffsetY = 0,
  drawExtLines = true,
  bgColor = DRAW_THEME.bgColor,
  textGap = DRAW_THEME.textGap,
} = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = -dy / len;
  const ny =  dx / len;

  const p1x = x1 + nx * offset;
  const p1y = y1 + ny * offset;
  const p2x = x2 + nx * offset;
  const p2y = y2 + ny * offset;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // Extension lines
  if (drawExtLines && offset !== 0) {
    ctx.beginPath();
    const extStart = Math.sign(offset) * 2;
    const extEnd = offset + Math.sign(offset) * 4;
    ctx.moveTo(x1 + nx * extStart, y1 + ny * extStart);
    ctx.lineTo(x1 + nx * extEnd, y1 + ny * extEnd);
    ctx.moveTo(x2 + nx * extStart, y2 + ny * extStart);
    ctx.lineTo(x2 + nx * extEnd, y2 + ny * extEnd);
    ctx.stroke();
  }

  // Main dimension line
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();

  // Arrows
  const angle = Math.atan2(dy, dx);
  ctx.fillStyle = color;
  for (const [px, py, sign] of [[p1x, p1y, 1], [p2x, p2y, -1]]) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      px - arrowSize * Math.cos(angle - Math.PI / 6.5) * sign,
      py - arrowSize * Math.sin(angle - Math.PI / 6.5) * sign
    );
    ctx.lineTo(
      px - arrowSize * Math.cos(angle + Math.PI / 6.5) * sign,
      py - arrowSize * Math.sin(angle + Math.PI / 6.5) * sign
    );
    ctx.closePath();
    ctx.fill();
  }

  // Label
  if (label) {
    const midX = (p1x + p2x) / 2 + textOffsetX;
    const midY = (p1y + p2y) / 2 + textOffsetY;

    ctx.translate(midX, midY);

    // Keep text upright and readable
    let textAngle = angle;
    if (textAngle > Math.PI / 2 + 0.01) {
      textAngle -= Math.PI;
    } else if (textAngle < -Math.PI / 2 + 0.01) {
      textAngle += Math.PI;
    }
    if (Math.abs(textAngle - Math.PI / 2) < 0.01) {
      textAngle = -Math.PI / 2;
    }

    ctx.rotate(textAngle);

    ctx.font = font;
    const metrics = ctx.measureText(label);
    const tw = metrics.width;
    const th = 12;

    // Semi‑transparent background box
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-tw / 2 - 4, -th - textGap - 2, tw + 8, th + 4, 3);
    } else {
      ctx.fillRect(-tw / 2 - 4, -th - textGap - 2, tw + 8, th + 4);
    }
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -textGap);
  }
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// Drawing theme
// ──────────────────────────────────────────────────────────────────
export const DRAW_THEME = {
  color: '#2980b9',
  lineWidth: 1,
  arrowSize: 5,
  font: 'bold 11px "Segoe UI", Arial, sans-serif',
  bgColor: 'rgba(255, 255, 255, 0.85)',
  textGap: 4,
};

// ──────────────────────────────────────────────────────────────────
// Front view
// ──────────────────────────────────────────────────────────────────
export function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, W, Hb = 0, walls = {} } = geometry
  const {
    dividerThickness = 0,
    compHeights = [],
    compartments = [],
    fittings,
    shelfCounts = [],
    innerLeftX,
    innerRightX,
    railHeight = 0,
    railWidth = 0,
  } = options;

  const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / W, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Per‑compartment inner boundaries
  const innerLeft  = compartments.map(c => c.left);
  const innerRight = compartments.map(c => W - c.right);
  const intTop     = effectiveWalls.top;
  const intBottom  = H - effectiveWalls.bottom;
  const tRbottom1 = walls.refrigerator?.bottom1 || 0;
  const floorRaisedY = H - Hb - tRbottom1;
  // Build the inner cavity polygon (filled insulation)
  ctx.beginPath();
  ctx.rect(0, 0, W * scale, H * scale);   // outer rectangle
  let y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    const leftX  = innerLeft[i]  * scale;
    const rightX = innerRight[i] * scale;

    if (i === 0) {
      ctx.moveTo(leftX, y * scale);
    } else {
      ctx.lineTo(leftX, y * scale);
    }
    ctx.lineTo(rightX, y * scale);
    y += h;
    ctx.lineTo(rightX, y * scale);
  }
  ctx.lineTo(innerLeft[compHeights.length - 1] * scale, y * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Draw individual compartments (white inner space)
  const types = leaves ? leaves.map(l => l.leafType) : [];
  y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    const leftX  = innerLeft[i]  * scale;
    const rightX = innerRight[i] * scale;
    const compY = y * scale;
    const compH = h * scale;

    ctx.fillStyle = i === 0 ? '#e8f0e8' : '#ffffff';
    ctx.fillRect(leftX, compY, rightX - leftX, compH);
    ctx.strokeStyle = '#999';
    ctx.strokeRect(leftX, compY, rightX - leftX, compH);
    ctx.fillStyle = '#000'; ctx.font = '12px Arial';
    if (types[i]) ctx.fillText(types[i], leftX + 4, compY + 16);

    y += h;

    // divider after this compartment
    if (i < compHeights.length - 1 && dividerThickness > 0) {
      const dividerY = y * scale;
      const dividerH = dividerThickness * scale;
      ctx.fillStyle = '#aaa';
      ctx.fillRect(leftX, dividerY, rightX - leftX, dividerH);
      ctx.strokeStyle = '#666';
      ctx.strokeRect(leftX, dividerY, rightX - leftX, dividerH);
      y += dividerThickness;
    }
  }

// ── NEW: Shelves + rails using shelfCounts ──
  if (shelfCounts && shelfCounts.length > 0) {
    let yOffset = intTop;
    for (let i = 0; i < compHeights.length; i++) {
      const n = shelfCounts[i] || 0;
      const compH = compHeights[i];
      const compY = yOffset * scale;

      if (n > 0) {
        // REPLACE compHpx with usableH constrained by the step
        let usableH = compH;
        if (i === compHeights.length - 1) {
          usableH = Math.min(compH, floorRaisedY - yOffset);
        }
        
        const spacing = (usableH * scale) / (n + 1);
        
        for (let s = 1; s <= n; s++) {
          const shelfYpx = compY + spacing * s;          // Thick shelf line
          ctx.beginPath();
          ctx.moveTo(innerLeft[i] * scale, shelfYpx);
          ctx.lineTo(innerRight[i] * scale, shelfYpx);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#666';
          ctx.stroke();

          // Left rail rectangle
          const railW = railWidth * scale;
          const railH = railHeight * scale;
          const leftRailX = innerLeft[i] * scale;
          ctx.fillStyle = '#aaa';
          ctx.fillRect(leftRailX, shelfYpx, railW, railH);
          ctx.strokeStyle = '#333';
          ctx.strokeRect(leftRailX, shelfYpx, railW, railH);

          // Right rail rectangle
          const rightRailX = innerRight[i] * scale - railW;
          ctx.fillRect(rightRailX, shelfYpx, railW, railH);
          ctx.strokeRect(rightRailX, shelfYpx, railW, railH);
        }
      }

      yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
    }
  }
  // Fallback: detailed shelves (old style) – kept for backward compatibility
  else if (fittings && leaves) {
    const internalWidth = W - effectiveWalls.left - effectiveWalls.right;
    let yOffset = effectiveWalls.top;

    for (let i = 0; i < compHeights.length; i++) {
      const compH = compHeights[i];
      const fittingsForLeaf = fittings.find(f => f.leafId === leaves[i]?.leafId);
      if (!fittingsForLeaf) {
        yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
        continue;
      }

      const compY = yOffset * scale;
      const compHeightPx = compH * scale;

      // Shelves
      const shelfCount = fittingsForLeaf.shelves.length;
      if (shelfCount > 0) {
        const shelfGap = compHeightPx / (shelfCount + 1);
        for (let s = 0; s < shelfCount; s++) {
          const yy = compY + shelfGap * (s + 1);
          ctx.fillStyle = '#bbbbbb';
          ctx.fillRect((effectiveWalls.left + 10) * scale, yy - 1,
                       (internalWidth - 20) * scale, 3);
        }
      }

      // Drawers
      const drawerCount = fittingsForLeaf.drawers.length;
      if (drawerCount > 0) {
        const drawerWidth = internalWidth * 0.8 * scale;
        const drawerHeight = 30;
        const drawerGap = (compHeightPx - drawerCount * drawerHeight) / (drawerCount + 1);
        for (let d = 0; d < drawerCount; d++) {
          const yy = compY + drawerGap * (d + 1) + drawerHeight * d;
          const xx = (effectiveWalls.left + (internalWidth - drawerWidth / scale) / 2) * scale;
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 2;
          ctx.strokeRect(xx, yy, drawerWidth, drawerHeight);
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(xx, yy, drawerWidth, drawerHeight);
        }
      }

      yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
    }
  }

  // ── Outer cabinet stroke (drawn after all fills) ──
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W * scale, H * scale);
  // ── Dashed line for Hb (raised floor height) ──
  const hbY = (H - Hb - tRbottom1) * scale;
  // Find which compartment contains this Y
  let yAcc = intTop;
  let compIdx = -1;
  for (let i = 0; i < compHeights.length; i++) {
    if (hbY >= yAcc * scale && hbY <= (yAcc + compHeights[i]) * scale) {
      compIdx = i;
      break;
    }
    yAcc += compHeights[i];
    if (i < compHeights.length - 1) yAcc += dividerThickness;
  }
  // Default to the last compartment if not found
  if (compIdx === -1) compIdx = compHeights.length - 1;

  ctx.save();
  ctx.strokeStyle = '#e67e22';   // distinct colour (orange)
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerLeft[compIdx] * scale, hbY);
  ctx.lineTo(innerRight[compIdx] * scale, hbY);
  ctx.stroke();
  ctx.restore();
  // Dimension lines
  const dimX = -35;
  y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    drawDim(ctx, dimX, y * scale, dimX, (y + h) * scale, 0, `[h= ${h.toFixed(0)}]`);
    y += h;
    if (i < compHeights.length - 1 && dividerThickness > 0) {
      const dividerBottom = y + dividerThickness;
      drawDim(ctx, dimX, y * scale, dimX, dividerBottom * scale, 0, `[div= ${dividerThickness}]`);
      y = dividerBottom;
    }
  }

  // Horizontal dimensions at bottom
  drawDim(ctx, 0, H * scale, W * scale, H * scale, 35, `[W= ${W.toFixed(0)}]`);
  drawDim(ctx, 0, 0, innerLeft[0] * scale, 0, -20, `[tLeft= ${compartments[0].left.toFixed(0)}]`);
  drawDim(ctx, innerRight[0] * scale, 0, W * scale, 0, -20, `[tRight= ${compartments[0].right.toFixed(0)}]`);

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────
// Side view – per‑compartment rear thicknesses, dikes, shelves, rails
// ──────────────────────────────────────────────────────────────────
export function drawSideView(canvas, geometry, effectiveWalls, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, D, Hb, Db1, Db2, walls } = geometry;
  const {
    dividerThickness = 0,
    compHeights = [],
    doorGap = 0,
    compartments = [],
    shelfCounts = [],
    innerTopY,
    innerBottomY,
    innerRearX,
    doorX,
    railHeight = 0,
    railDepthPct = 0,
    dikeHeight = 0,
    dikeBaseWidth = 0,
    dikeTopWidth = 0,
  } = options;

  const tTop      = effectiveWalls.top;
  const tDoor     = effectiveWalls.door;
  const tRbottom1 = walls.refrigerator.bottom1;
  const tRbottom2 = walls.refrigerator.bottom2;
  const tRbottom3 = walls.refrigerator.bottom3;

  const compRear = compartments.map(c => c.rear);

  const PAD = { left: 60, top: 40, right: 60, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / D, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  const innerDoor = D;
  const innerTop  = tTop;
  const floorLowerY  = H - tRbottom3;
  const floorRaisedY = H - Hb - tRbottom1;

  // Compressor box bounds from OUTSIDE (x=0)
  const xTopCB = Db1;
  const yTopCB = H - Hb;
  const xBottomCB = Db2;
  const yBottomCB = H;

  // Slope vector for insulation thickness tRbottom2
  const cbDx = xBottomCB - xTopCB;
  const cbDy = yBottomCB - yTopCB;
  const cbLen = Math.sqrt(cbDx * cbDx + cbDy * cbDy);

  let slopeStartX = Db1;
  let slopeEndX = Db2;
  let nx = 1, ny = 0;

  if (cbLen > 0) {
    nx = cbDy / cbLen;
    ny = -cbDx / cbLen;           // points inward (right and up)

    const px = xTopCB + nx * tRbottom2;
    const py = yTopCB + ny * tRbottom2;

    if (cbDy !== 0) {
      const tStart = (floorRaisedY - py) / cbDy;
      slopeStartX = px + cbDx * tStart;

      const tEnd = (floorLowerY - py) / cbDy;
      slopeEndX = px + cbDx * tEnd;
    } else {
      slopeStartX = px;
      slopeEndX = px;
    }
  }

  // ── Insulation bands (full cabinet grey, white cavity on top) ──
  if (compHeights.length === 1) {
    // Single compartment: grey insulation from innerTop down to H
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, innerTop * scale, D * scale, (H - innerTop) * scale);

    // White inner cavity – polygon with sloped bottom cutout
    const topRearX = compRear[0] * scale;
    const topY = innerTop * scale;
    ctx.beginPath();
    ctx.moveTo(topRearX, topY);
    ctx.lineTo(innerDoor * scale, topY);
    ctx.lineTo(innerDoor * scale, floorLowerY * scale);
    ctx.lineTo(slopeEndX * scale, floorLowerY * scale);
    ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
    ctx.lineTo(topRearX, floorRaisedY * scale);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

  } else if (compHeights.length === 2) {
    const topH = compHeights[0];
    const topRearX = compRear[0] * scale;
    const topY = innerTop * scale;
    const topCompH = topH * scale;

    // Top compartment insulation and white cavity (rectangle)
    ctx.beginPath();
    ctx.rect(0, 0, D * scale, topY + topCompH);
    ctx.moveTo(topRearX, topCompH);
    ctx.lineTo(innerDoor * scale, topY);
    ctx.lineTo(innerDoor * scale, topY + topCompH);
    ctx.lineTo(topRearX, topY + topCompH);
    ctx.closePath();
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();

    ctx.beginPath();
    ctx.rect(topRearX, topY, innerDoor * scale - topRearX, topCompH);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0066cc';
    ctx.stroke();

    const bottomH = compHeights[1];
    const bottomRearX = compRear[1] * scale;
    const bottomY = (innerTop + topH + dividerThickness) * scale;
    const bottomCompH = bottomH * scale;

    // Bottom compartment insulation (full rectangle)
    ctx.beginPath();
    ctx.rect(0, bottomY, D * scale, bottomCompH);
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();

    // Bottom white cavity with sloped cutout
    ctx.beginPath();
    ctx.moveTo(bottomRearX, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY + bottomCompH);
    ctx.lineTo(innerDoor * scale, floorLowerY * scale);
    ctx.lineTo(slopeEndX * scale, floorLowerY * scale);
    ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
    ctx.lineTo(bottomRearX, floorRaisedY * scale);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ── Compressor box (drawn after insulation / cavity) ──
  ctx.beginPath();
  ctx.moveTo(0, H * scale);
  ctx.lineTo(0, yTopCB * scale);
  ctx.lineTo(xTopCB * scale, yTopCB * scale);
  ctx.lineTo(xBottomCB * scale, yBottomCB * scale);
  ctx.closePath();
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#555';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Comp.', 6, yTopCB * scale + 14);

  // ── Divider & doors ──
  let drawnDoors = [];

  if (compHeights.length === 2 && dividerThickness > 0) {
    const dividerY = innerTop + compHeights[0];
    const dividerH = dividerThickness;
    const dividerLeftX = compRear[1] * scale;

    // Divider bar
    ctx.fillStyle = '#aaa';
    ctx.fillRect(dividerLeftX, dividerY * scale,
                (innerDoor - compRear[1]) * scale, dividerH * scale);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(dividerLeftX, dividerY * scale,
                  (innerDoor - compRear[1]) * scale, dividerH * scale);

    // Two doors with gap
    const doorLeftX = innerDoor * scale;
    const doorWidth = tDoor * scale;
    const topDoorTop = 0;
    const topDoorBottom = (dividerY + dividerH/2) * scale - (doorGap / 2) * scale;
    const bottomDoorTop = (dividerY + dividerH/2) * scale + (doorGap / 2) * scale;
    const bottomDoorBottom = H * scale;

    drawnDoors.push({ top: topDoorTop, bottom: topDoorBottom });
    drawnDoors.push({ top: bottomDoorTop, bottom: bottomDoorBottom });

    drawDim(ctx, D * scale, topDoorBottom, D * scale, bottomDoorTop, -45,
            `[door gap= ${(dividerThickness + doorGap).toFixed(0)}]`);

  } else {
    // Single door (full height or top compartment only if dividerThickness == 0)
    drawnDoors.push({ top: 0 * scale, bottom: H * scale });
  }

  // Draw every door rectangle
  for (const door of drawnDoors) {
    const doorLeftX = innerDoor * scale;
    const doorWidth = tDoor * scale;
    ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.fillRect(doorLeftX, door.top, doorWidth, door.bottom - door.top);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(doorLeftX, door.top, doorWidth, door.bottom - door.top);
  }

  // ── NEW: Door dikes – one pair per compartment ──
  if (dikeHeight > 0 && doorX != null) {
    const dikeH_dike = dikeHeight * scale;
    const baseW_dike = dikeBaseWidth * scale;
    const topW_dike = dikeTopWidth * scale;
    const doorX_dike = (innerDoor)* scale;
    const leftX_dike = (innerDoor - dikeHeight) * scale;

    let yComp = innerTop;
    for (let i = 0; i < compHeights.length; i++) {
      const compTopY = yComp * scale;
      const compBottomY = (yComp + compHeights[i]) * scale;

      // Top dike of this door
      ctx.beginPath();
      ctx.moveTo(doorX_dike, compTopY);
      ctx.lineTo(doorX_dike, compTopY + baseW_dike);
      ctx.lineTo(leftX_dike, compTopY + (baseW_dike - topW_dike) / 2 + topW_dike);
      ctx.lineTo(leftX_dike, compTopY + (baseW_dike - topW_dike) / 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.stroke();

      // Bottom dike of this door
      ctx.beginPath();
      ctx.moveTo(doorX_dike, compBottomY - baseW_dike);
      ctx.lineTo(doorX_dike, compBottomY);
      ctx.lineTo(leftX_dike, compBottomY - (baseW_dike - topW_dike) / 2);
      ctx.lineTo(leftX_dike, compBottomY - (baseW_dike + topW_dike) / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Advance to next compartment
      yComp += compHeights[i];
      if (i < compHeights.length - 1) {
        yComp += dividerThickness;
      }
    }
  }
// ── NEW: Shelves and rails per compartment ──
  if (shelfCounts && shelfCounts.length > 0 && innerRearX != null && doorX != null) {
    let yOffset = innerTop;
    for (let i = 0; i < compHeights.length; i++) {
      const n = shelfCounts[i] || 0;
      const compH = compHeights[i];
      const compY = yOffset * scale;

      if (n > 0) {
        // REPLACE compHpx with usableH constrained by the step
        let usableH = compH;
        if (i === compHeights.length - 1) {
          usableH = Math.min(compH, floorRaisedY - yOffset);
        }
        
        const spacing = (usableH * scale) / (n + 1);
        
        for (let s = 1; s <= n; s++) {
          const shelfYpx = compY + spacing * s;          // Shelf line
          ctx.beginPath();
          ctx.moveTo(innerRearX * scale, shelfYpx);
          ctx.lineTo(doorX * scale, shelfYpx);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#666';
          ctx.stroke();

          // Rail under shelf (from rear inward)
          const usableDepth = (doorX - innerRearX) * scale;
          const railDepthPx = (railDepthPct / 100) * usableDepth;
          const railH = railHeight * scale;
          const railY = shelfYpx;
          ctx.fillStyle = '#aaa';
          ctx.fillRect(innerRearX * scale, railY, railDepthPx, railH);
          ctx.strokeStyle = '#333';
          ctx.strokeRect(innerRearX * scale, railY, railDepthPx, railH);
        }
      }

      yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
    }
  }

  // ── Outer cabinet stroke (drawn after all fills) ──
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, D * scale, H * scale);

  // Dimension lines (unchanged from your original)
  drawDim(ctx, 0, H * scale, 0, 0, -45, `[H= ${H.toFixed(0)}]`);
  drawDim(ctx, 0, H * scale, 0, floorRaisedY * scale, -20, `[Hb= ${Hb.toFixed(0)}]`);
  drawDim(ctx, 0, 0, D * scale, 0, -25, `[D= ${D.toFixed(0)}]`);

  // Db1 and Db2 explicitly dimensioned on the compressor box bounds
  drawDim(ctx, 0, yTopCB * scale, xTopCB * scale, yTopCB * scale, -18, `[Db1= ${Db1.toFixed(0)}]`);
  drawDim(ctx, 0, yBottomCB * scale, xBottomCB * scale, yBottomCB * scale, -18, `[Db2= ${Db2.toFixed(0)}]`);

  const topMidX = (compRear[0] + innerDoor) / 2 * scale;
  drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, `[tTop= ${tTop.toFixed(0)}]`);

  drawnDoors.forEach(door => {
    const doorMidY = (door.top + door.bottom) / 2.5;
    drawDim(ctx, innerDoor * scale, doorMidY, D * scale, doorMidY, 0, `[tDoor= ${tDoor.toFixed(0)}]`);
  });

  // Rear dimensions – per compartment
  for (let i = 0; i < compHeights.length; i++) {
    if (i === 0 || compRear[i] !== compRear[i-1]) {
      let compY = innerTop;
      for (let j = 0; j < i; j++) compY += compHeights[j];
      if (i > 0) compY += dividerThickness;
      const midY = (compY + compY + compHeights[i]) / 2.5 * scale;
      drawDim(ctx, 0, midY, compRear[i] * scale, midY, 0, `[tRear= ${compartments[i].rear.toFixed(0)}]`);
    }
  }

  const botMidX = (slopeEndX + innerDoor) / 2.5 * scale;
  drawDim(ctx, botMidX, floorLowerY * scale, botMidX, H * scale, 0, `[tRb3= ${tRbottom3.toFixed(0)}]`);

  // Map slope insulation thickness dimensioning to the new inward vector
  const midCbX = (xTopCB + xBottomCB) / 2;
  const midCbY = (yTopCB + yBottomCB) / 2;
  const inPX = midCbX + nx * tRbottom2;
  const inPY = midCbY + ny * tRbottom2;
  drawDim(ctx, inPX * scale, inPY * scale, midCbX * scale, midCbY * scale, 0, `[tRb2= ${tRbottom2.toFixed(0)}]`);

  // Compartment height dimensions (right side)
  if (compHeights.length === 2) {
    const dimX = (D + tDoor) * scale + 20;
    let yPos = innerTop;
    compHeights.forEach((h, idx) => {
      const bottomY = yPos + h;
      drawDim(ctx, dimX, yPos * scale, dimX, bottomY * scale, 0, `[h= ${h.toFixed(0)}]`);
      yPos = bottomY;
      if (idx === 0 && dividerThickness > 0) yPos += dividerThickness;
    });
  } else if (compHeights.length === 1) {
    drawDim(ctx, (D + tDoor) * scale + 20, innerTop * scale, (D + tDoor) * scale + 20, (innerTop + compHeights[0]) * scale, 0,
            `[h= ${compHeights[0].toFixed(0)}]`);
  }

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// Click‑to‑show‑coordinate feature (unchanged)
// ──────────────────────────────────────────────────────────────────
export function enableCoordinateTooltip(frontCanvas, sideCanvas, getGeometryFn) {
  const tooltip = document.getElementById('schematicTooltip');

  function handleClick(canvas, isFront) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;   // account for CSS vs. canvas size
      const scaleY = canvas.height / rect.height;

      const pixelX = (e.clientX - rect.left) * scaleX;
      const pixelY = (e.clientY - rect.top) * scaleY;

      const geometry = getGeometryFn();
      if (!geometry) return;

      let worldX, worldY;
      if (isFront) {
        const PAD = { left: 50, top: 40 };
        const drawW = canvas.width - PAD.left - 40;
        const drawH = canvas.height - PAD.top - 40;
        const scale = Math.min(drawW / geometry.W, drawH / geometry.H);
        worldX = (pixelX - PAD.left) / scale;
        worldY = (pixelY - PAD.top) / scale;
      } else {
        const PAD = { left: 60, top: 40 };
        const drawW = canvas.width - PAD.left - 60;
        const drawH = canvas.height - PAD.top - 40;
        const scale = Math.min(drawW / geometry.D, drawH / geometry.H);
        worldX = (pixelX - PAD.left) / scale;
        worldY = (pixelY - PAD.top) / scale;
      }

      tooltip.classList.remove('hidden');
      tooltip.style.left = (e.clientX + 10) + 'px';
      tooltip.style.top = (e.clientY - 30) + 'px';
      tooltip.textContent = `X: ${worldX.toFixed(1)} mm, Y: ${worldY.toFixed(1)} mm`;
    });
  }

  handleClick(frontCanvas, true);
  handleClick(sideCanvas, false);
}