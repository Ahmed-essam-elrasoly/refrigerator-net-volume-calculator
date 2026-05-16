/**
 * Draw a dimension line with extension lines, arrows, and label.
 * Styled to standard CAD drafting representation.
 */
function drawDim(ctx, x1, y1, x2, y2, offset, label, {
  color = '#2980b9',
  lineWidth = 1,
  arrowSize = 5,
  font = 'bold 11px "Segoe UI", Arial, sans-serif',
  textOffsetX = 0,
  textOffsetY = 0,
  drawExtLines = true
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

  if (drawExtLines && offset !== 0) {
    ctx.beginPath();
    const extStart = Math.sign(offset) * 2;
    const extEnd = offset + Math.sign(offset) * 4; // Slightly past the dim line
    ctx.moveTo(x1 + nx * extStart, y1 + ny * extStart);
    ctx.lineTo(x1 + nx * extEnd, y1 + ny * extEnd);
    ctx.moveTo(x2 + nx * extStart, y2 + ny * extStart);
    ctx.lineTo(x2 + nx * extEnd, y2 + ny * extEnd);
    ctx.stroke();
  }

  // Draw main dimension line
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();

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
    // Force vertical lines to read bottom-to-top strictly
    if (Math.abs(textAngle - Math.PI / 2) < 0.01) {
        textAngle = -Math.PI / 2;
    }

    ctx.rotate(textAngle);

    ctx.font = font;
    const metrics = ctx.measureText(label);
    const tw = metrics.width;
    const th = 12; // Approximate font height
    const gap = 4; // Separation from the dimension line

    // Semi-transparent background box to prevent overlap with model lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-tw / 2 - 4, -th - gap - 2, tw + 8, th + 4, 3);
    } else {
      ctx.fillRect(-tw / 2 - 4, -th - gap - 2, tw + 8, th + 4);
    }
    ctx.fill();

    // Render dimension value completely off the line
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -gap);
  }
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// Front view
// ──────────────────────────────────────────────────────────────────
export function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, W } = geometry;
  const w = effectiveWalls;
  const { dividerThickness = 0, compHeights = [] } = options;

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

  const intLeft   = w.left;
  const intRight  = W - w.right;
  const intTop    = w.top;
  const intBottom = H - w.bottom;

  // Insulation band
  ctx.beginPath();
  ctx.rect(0, 0, W * scale, H * scale);
  ctx.moveTo(intLeft  * scale, intTop    * scale);
  ctx.lineTo(intRight * scale, intTop    * scale);
  ctx.lineTo(intRight * scale, intBottom * scale);
  ctx.lineTo(intLeft  * scale, intBottom * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Inner cavity
  ctx.beginPath();
  ctx.rect(intLeft  * scale, intTop    * scale,
           (intRight - intLeft) * scale, (intBottom - intTop) * scale);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // Compartments
  if (compHeights.length > 0) {
    let yOffset = intTop;
    const types = leaves ? leaves.map(l => l.leafType) : [];
    compHeights.forEach((childH, idx) => {
      const compY = yOffset * scale;
      const compH = childH * scale;
      ctx.fillStyle = idx === 0 ? '#e8f0e8' : '#ffffff';
      ctx.fillRect(intLeft * scale, compY, (intRight - intLeft) * scale, compH);
      ctx.strokeStyle = '#999';
      ctx.strokeRect(intLeft * scale, compY, (intRight - intLeft) * scale, compH);
      ctx.fillStyle = '#000'; ctx.font = '12px Arial';
      if (types[idx]) ctx.fillText(types[idx], intLeft * scale + 4, compY + 16);
      yOffset += childH;

      // divider after this compartment if there is a next one
      if (idx < compHeights.length - 1 && dividerThickness > 0) {
        const dividerY = yOffset * scale;
        const dividerH = dividerThickness * scale;
        ctx.fillStyle = '#aaa';
        ctx.fillRect(intLeft * scale, dividerY, (intRight - intLeft) * scale, dividerH);
        ctx.strokeStyle = '#666';
        ctx.strokeRect(intLeft * scale, dividerY, (intRight - intLeft) * scale, dividerH);
        yOffset += dividerThickness;
      }
    });
  }
  
  // Dimensions: compartment heights and divider thickness on the left side
  const dimX = -35;
  let yCursor = intTop;
  if (compHeights.length > 0) {
    compHeights.forEach((h, idx) => {
      const bottomY = yCursor + h;
      drawDim(ctx, dimX, yCursor * scale, dimX, bottomY * scale, 0,
              `[h= ${h.toFixed(0)}]`);
      yCursor = bottomY;
      if (idx < compHeights.length - 1 && dividerThickness > 0) {
        const dividerBottom = yCursor + dividerThickness;
        drawDim(ctx, dimX, yCursor * scale, dimX, dividerBottom * scale, 0,
                `[div= ${dividerThickness}]`);
        yCursor = dividerBottom;
      }
    });
  }

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────
// Side view
// ──────────────────────────────────────────────────────────────────
export function drawSideView(canvas, geometry, effectiveWalls, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, D, Hb, Db1, Db2, walls } = geometry;
  const w = effectiveWalls;
  const { dividerThickness = 0, compHeights = [], doorGap = 0 } = options;

  const tTop    = w.top;
  const tDoor   = w.door;
  const tRear   = w.rear;
  const tRbottom1 = walls.refrigerator.bottom1;
  const tRbottom2 = walls.refrigerator.bottom2;
  const tRbottom3 = walls.refrigerator.bottom3;

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

  const innerRear   = tRear;
  const innerDoor   = D - tDoor;
  const innerTop    = tTop;
  const floorLowerY  = H - tRbottom3;
  const floorRaisedY = H - Hb - tRbottom1;
  const slopeStartX = innerRear + Db1;
  const slopeEndX   = innerRear + Db2;

  // Insulation band
  ctx.beginPath();
  ctx.rect(0, 0, D * scale, H * scale);
  ctx.moveTo(innerRear * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, floorLowerY * scale);
  ctx.lineTo(slopeEndX   * scale, floorLowerY * scale);
  ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
  ctx.lineTo(innerRear   * scale, floorRaisedY * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  // Compressor box
  const slopeDx = slopeEndX - slopeStartX;
  const slopeDy = floorLowerY - floorRaisedY;
  const slopeLen = Math.sqrt(slopeDx*slopeDx + slopeDy*slopeDy);
  let nx =  slopeDy / slopeLen;
  let ny = -slopeDx / slopeLen;
  if (ny < 0) { nx = -nx; ny = -ny; }

  const yTop = floorRaisedY + tRbottom1;
  const sTop = slopeDy !== 0 ? (yTop - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xTop = slopeStartX + sTop * slopeDx + nx * tRbottom2;

  const yBottom = H;
  const sBottom = slopeDy !== 0 ? (yBottom - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xBottom = slopeStartX + sBottom * slopeDx + nx * tRbottom2;

  ctx.beginPath();
  ctx.moveTo(0, H * scale);
  ctx.lineTo(0, yTop * scale);
  ctx.lineTo(xTop * scale, yTop * scale);
  ctx.lineTo(xBottom * scale, yBottom * scale);
  ctx.closePath();
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#555'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Comp.', 6, yTop * scale + 14);

  // Inner cavity outline (white)
  ctx.beginPath();
  ctx.moveTo(innerRear * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, floorLowerY * scale);
  ctx.lineTo(slopeEndX   * scale, floorLowerY * scale);
  ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
  ctx.lineTo(innerRear   * scale, floorRaisedY * scale);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // If two compartments, draw divider and doors
  if (compHeights.length === 2 && dividerThickness > 0) {
    const internalH = innerTop + compHeights[0] + dividerThickness + compHeights[1]; 
    const dividerY = innerTop + compHeights[0];
    const dividerH = dividerThickness;

    // Divider as a horizontal band across the internal depth
    ctx.fillStyle = '#aaa';
    ctx.fillRect(innerRear * scale, dividerY * scale,
                 (innerDoor - innerRear) * scale, dividerH * scale);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(innerRear * scale, dividerY * scale,
                  (innerDoor - innerRear) * scale, dividerH * scale);

    // Two doors on the right side
    const doorLeftX = innerDoor * scale;
    const doorRightX = D * scale;
    const doorWidth = (D - innerDoor) * scale;
    const topDoorTop = 0;
    const topDoorBottom = dividerY * scale - (doorGap / 2) * scale;
    const bottomDoorTop = (dividerY + dividerH) * scale + (doorGap / 2) * scale;
    const bottomDoorBottom = (H) * scale;

    ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.fillRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
    ctx.fillRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
    ctx.strokeRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);
  }

  // Dimensions: overall H, Hb, D, Db1, Db2, insulation thicknesses
  drawDim(ctx, 0, H * scale, 0, 0, -45, `[H= ${H.toFixed(0)}]`);
  drawDim(ctx, 0, H * scale, 0, floorRaisedY * scale, -20, `[Hb= ${Hb.toFixed(0)}]`);
  drawDim(ctx, 0, 0, D * scale, 0, -25, `[D= ${D.toFixed(0)}]`);
  drawDim(ctx, innerRear * scale, floorRaisedY * scale, slopeStartX * scale, floorRaisedY * scale, -18, `[Db1= ${Db1.toFixed(0)}]`);
  drawDim(ctx, innerRear * scale, floorLowerY * scale, slopeEndX * scale, floorLowerY * scale, -18, `[Db2= ${Db2.toFixed(0)}]`);

  const topMidX = (innerRear + innerDoor) / 2 * scale;
  drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, `[tTop= ${tTop.toFixed(0)}]`);

  const doorMidY = (innerTop + floorLowerY) / 2 * scale;
  drawDim(ctx, innerDoor * scale, doorMidY, D * scale, doorMidY, 0, `[tDoor= ${tDoor.toFixed(0)}]`);

  const rearMidY = (innerTop + floorRaisedY) / 2 * scale;
  drawDim(ctx, 0, rearMidY, innerRear * scale, rearMidY, 0, `[tRear= ${tRear.toFixed(0)}]`);

  const botMidX = (slopeEndX + innerDoor) / 2 * scale;
  drawDim(ctx, botMidX, floorLowerY * scale, botMidX, H * scale, 0, `[tRb3= ${tRbottom3.toFixed(0)}]`);

  const midSlopeX = (slopeStartX + slopeEndX) / 2;
  const midSlopeY = (floorRaisedY + floorLowerY) / 2;
  const innerPX = midSlopeX * scale;
  const innerPY = midSlopeY * scale;
  const outerPX = innerPX + nx * (tRbottom2 * scale);
  const outerPY = innerPY + ny * (tRbottom2 * scale);
  drawDim(ctx, innerPX, innerPY, outerPX, outerPY, 0, `[tRb2= ${tRbottom2.toFixed(0)}]`);

  // Compartment height dimensions in side view (on right side)
  if (compHeights.length === 2) {
    const dimX = D * scale + 20;
    let yPos = innerTop;
    compHeights.forEach((h, idx) => {
      const bottomY = yPos + h;
      drawDim(ctx, dimX, yPos * scale, dimX, bottomY * scale, 0,
              `[h= ${h.toFixed(0)}]`);
      yPos = bottomY;
      if (idx === 0 && dividerThickness > 0) {
        const dividerBottom = yPos + dividerThickness;
        drawDim(ctx, dimX, yPos * scale, dimX, dividerBottom * scale, 0,
                `[div= ${dividerThickness}]`);
        yPos = dividerBottom;
      }
    });
  } else if (compHeights.length === 1) {
    drawDim(ctx, D * scale + 20, innerTop * scale, D * scale + 20, (innerTop + compHeights[0]) * scale, 0,
            `[h= ${compHeights[0].toFixed(0)}]`);
  }

  ctx.restore();
}