/**
 * Draw a dimension line with extension lines, arrows, and label.
 * Styled to standard CAD drafting representation.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} offset
 * @param {string} label
 * @param {object} [opts]
 * @param {string} [opts.color]
 * @param {number} [opts.lineWidth]
 * @param {number} [opts.arrowSize]
 * @param {string} [opts.font]
 * @param {number} [opts.textOffsetX]
 * @param {number} [opts.textOffsetY]
 * @param {boolean} [opts.drawExtLines]
 * @param {string} [opts.bgColor]
 * @param {number} [opts.textGap]
 */
function drawDim(ctx, x1, y1, x2, y2, offset, label, {
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

    // Keep text upright and readable (Standard CAD behavior)
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
    const th = 12; // approximate font height

    // Semi-transparent background box
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-tw / 2 - 4, -th - textGap - 2, tw + 8, th + 4, 3);
    } else {
      ctx.fillRect(-tw / 2 - 4, -th - textGap - 2, tw + 8, th + 4);
    }
    ctx.fill();

    // Dimension text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -textGap);
  }
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// Drawing theme (exported for external use if needed)
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
  const { H, W } = geometry;
  const { dividerThickness = 0, compHeights = [], compartments = [] } = options;

  const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / W, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Outer cabinet
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W * scale, H * scale);

  // Per‑compartment inner boundaries
  const innerLeft  = compartments.map(c => c.left);
  const innerRight = compartments.map(c => W - c.right);
  const intTop     = effectiveWalls.top;
  const intBottom  = H - effectiveWalls.bottom;

  // Build the inner cavity polygon
  ctx.beginPath();
  ctx.rect(0, 0, W * scale, H * scale);
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
    if (i < compHeights.length - 1) {
      // divider gap will be handled below
    }
  }
  ctx.lineTo(innerLeft[compHeights.length - 1] * scale, y * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Draw individual compartments
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

    // divider after this compartment if there is a next one
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

  // Fittings drawing (if provided)
  if (options.fittings && leaves) {
    const internalWidth = W - effectiveWalls.left - effectiveWalls.right;
    let yOffset = effectiveWalls.top;   // start from top of internal space

    for (let i = 0; i < compHeights.length; i++) {
      const compH = compHeights[i];
      const fittingsForLeaf = options.fittings.find(f => f.leafId === leaves[i]?.leafId);
      if (!fittingsForLeaf) {
        yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
        continue;
      }

      const compY = yOffset * scale;
      const compHeightPx = compH * scale;

      // Draw shelves
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

      // Draw drawers
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
// Side view – per‑compartment rear thicknesses
// ──────────────────────────────────────────────────────────────────
export function drawSideView(canvas, geometry, effectiveWalls, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, D, Hb, Db1, Db2, walls } = geometry;
  const { dividerThickness = 0, compHeights = [], doorGap = 0, compartments = [] } = options;

  const tTop      = effectiveWalls.top;
  const tDoor     = effectiveWalls.door;
  const tRear     = effectiveWalls.rear;            // global rear for compressor box
  const tRbottom1 = walls.refrigerator.bottom1;
  const tRbottom2 = walls.refrigerator.bottom2;
  const tRbottom3 = walls.refrigerator.bottom3;

  const compRear = compartments.map(c => c.rear);   // per‑compartment

  const PAD = { left: 60, top: 40, right: 60, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / D, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Outer cabinet
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, D * scale, H * scale);

  const innerDoor = D - tDoor;
  const innerTop  = tTop;
  const floorLowerY  = H - tRbottom3;
  const floorRaisedY = H - Hb - tRbottom1;
  const bottomRear = compRear.length === 2 ? compRear[1] : compRear[0];
  const slopeStartX = bottomRear + Db1;
  const slopeEndX   = bottomRear + Db2;

  // Insulation bands
  const topH = compHeights[0];
  const topRearX = compRear[0] * scale;
  const topY = innerTop * scale;
  const topCompH = topH * scale;
  ctx.beginPath();
  ctx.rect(0, 0, D * scale, topY + topCompH);
  ctx.moveTo(topRearX, topCompH);
  ctx.lineTo(innerDoor * scale, topY);
  ctx.lineTo(innerDoor * scale, topY + topCompH);
  ctx.lineTo(topRearX, topY + topCompH);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  if (compHeights.length === 2) {
    const bottomH = compHeights[1];
    const bottomRearX = compRear[1] * scale;
    const bottomY = (innerTop + topH + dividerThickness) * scale;
    const bottomCompH = bottomH * scale;
    ctx.beginPath();
    ctx.rect(0, bottomY, D * scale, bottomCompH);
    ctx.moveTo(bottomRearX, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY + bottomCompH);
    ctx.lineTo(innerDoor * scale, floorLowerY * scale);
    ctx.lineTo(slopeEndX * scale, floorLowerY * scale);
    ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
    ctx.lineTo(bottomRearX, floorRaisedY * scale);
    ctx.closePath();
    ctx.fillStyle = '#f0f0f0';
    ctx.fill();
  }

  // Compressor box
  const slopeDx = slopeEndX - slopeStartX;
  const slopeDy = floorLowerY - floorRaisedY;
  const slopeLen = Math.sqrt(slopeDx*slopeDx + slopeDy*slopeDy);
  let nx =  slopeDy / slopeLen;
  let ny = -slopeDx / slopeLen;
  if (ny < 0) { nx = -nx; ny = -ny; }

  const yTopCB = floorRaisedY + tRbottom1;
  const sTop = slopeDy !== 0 ? (yTopCB - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xTopCB = slopeStartX + sTop * slopeDx + nx * tRbottom2;

  const yBottomCB = H;
  const sBottom = slopeDy !== 0 ? (yBottomCB - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xBottomCB = slopeStartX + sBottom * slopeDx + nx * tRbottom2;

  ctx.beginPath();
  ctx.moveTo(0, H * scale);
  ctx.lineTo(0, yTopCB * scale);
  ctx.lineTo(xTopCB * scale, yTopCB * scale);
  ctx.lineTo(xBottomCB * scale, yBottomCB * scale);
  ctx.closePath();
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#555'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Comp.', 6, yTopCB * scale + 14);

  // White inner cavity (two separate shapes)
  // Top compartment
  ctx.beginPath();
  ctx.rect(topRearX, topY, innerDoor * scale - topRearX, topCompH);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bottom compartment
  if (compHeights.length === 2) {
    const bottomRearX = compRear[1] * scale;
    const bottomY = (innerTop + topH + dividerThickness) * scale;
    const bottomCompH = compHeights[1] * scale;
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
    ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Divider & doors
  let drawnDoors = [];
  if (compHeights.length === 2 && dividerThickness > 0) {
    const dividerY = innerTop + topH;
    const dividerH = dividerThickness;

    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, dividerY * scale,
                 (innerDoor) * scale, dividerH * scale);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(0, dividerY * scale,
                  (innerDoor) * scale, dividerH * scale);

    const doorLeftX = innerDoor * scale;
    const doorWidth = (D - innerDoor) * scale;
    const topDoorTop = 0;
    const topDoorBottom = (dividerY + dividerH/2) * scale - (doorGap / 2) * scale;
    const bottomDoorTop = (dividerY + dividerH/2) * scale + (doorGap / 2) * scale;
    const bottomDoorBottom = H * scale;

    ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.fillRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
    ctx.fillRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
    ctx.strokeRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);

    drawnDoors.push({ top: topDoorTop, bottom: topDoorBottom });
    drawnDoors.push({ top: bottomDoorTop, bottom: bottomDoorBottom });

    drawDim(ctx, D * scale, topDoorBottom, D * scale, bottomDoorTop, -45,
            `[door gap= ${(dividerThickness + doorGap).toFixed(0)}]`);
  } else {
    drawnDoors.push({ top: innerTop * scale, bottom: floorLowerY * scale });
  }

  // Dimension lines
  drawDim(ctx, 0, H * scale, 0, 0, -45, `[H= ${H.toFixed(0)}]`);
  drawDim(ctx, 0, H * scale, 0, floorRaisedY * scale, -20, `[Hb= ${Hb.toFixed(0)}]`);
  drawDim(ctx, 0, 0, D * scale, 0, -25, `[D= ${D.toFixed(0)}]`);
  drawDim(ctx, bottomRear * scale, floorRaisedY * scale, slopeStartX * scale, floorRaisedY * scale, -18, `[Db1= ${Db1.toFixed(0)}]`);
  drawDim(ctx, bottomRear * scale, floorLowerY * scale, slopeEndX * scale, floorLowerY * scale, -18, `[Db2= ${Db2.toFixed(0)}]`);
  const topMidX = (tRear + innerDoor) / 2 * scale;
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

  const midSlopeX = (slopeStartX + slopeEndX) / 2;
  const midSlopeY = (floorRaisedY + floorLowerY) / 2;
  const innerPX = midSlopeX * scale;
  const innerPY = midSlopeY * scale;
  const outerPX = innerPX + nx * (tRbottom2 * scale);
  const outerPY = innerPY + ny * (tRbottom2 * scale);
  drawDim(ctx, innerPX, innerPY, outerPX, outerPY, 0, `[tRb2= ${tRbottom2.toFixed(0)}]`);

  // Compartment height dimensions (right side)
  if (compHeights.length === 2) {
    const dimX = D * scale + 20;
    let yPos = innerTop;
    compHeights.forEach((h, idx) => {
      const bottomY = yPos + h;
      drawDim(ctx, dimX, yPos * scale, dimX, bottomY * scale, 0, `[h= ${h.toFixed(0)}]`);
      yPos = bottomY;
      if (idx === 0 && dividerThickness > 0) yPos += dividerThickness;
    });
  } else if (compHeights.length === 1) {
    drawDim(ctx, D * scale + 20, innerTop * scale, D * scale + 20, (innerTop + compHeights[0]) * scale, 0,
            `[h= ${compHeights[0].toFixed(0)}]`);
  }

  ctx.restore();
}