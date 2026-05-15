// src/js/ui/schematic.js

function drawDim(ctx, x1, y1, x2, y2, offset, label, {
  color = '#2980b9', // A distinct technical blue
  lineWidth = 1,
  arrowSize = 5,
  font = '11px "Segoe UI", Arial, sans-serif',
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

  // Extension lines
  if (drawExtLines && offset !== 0) {
    ctx.beginPath();
    // Start 2px away from geometry, extend 6px past the dimension line
    const extStart = Math.sign(offset) * 2;
    const extEnd = offset + Math.sign(offset) * 6;
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

  // Label with semi-transparent background for high readability
  if (label) {
    const midX = (p1x + p2x) / 2 + textOffsetX;
    const midY = (p1y + p2y) / 2 + textOffsetY;
    
    ctx.font = font;
    const metrics = ctx.measureText(label);
    const tw = metrics.width;
    const th = 12; // Approx text height for padding calculation

    // Background pill
    ctx.fillStyle = 'rgba(253, 207, 207, 0.9)'; 
    ctx.beginPath();
    ctx.roundRect(midX - tw / 2 - 4, midY - th / 2 - 3, tw + 8, th + 6, 3);
    ctx.fill();

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY);
  }
  ctx.restore();
}

export function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves) {
  const ctx = canvas.getContext('2d');
  const { H, W } = geometry;
  const w = effectiveWalls;

  const PAD = { left: 40, top: 40, right: 40, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / W, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Outer box
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W * scale, H * scale);

  // Internal cavity
  const intLeft   = w.left * scale;
  const intRight  = (W - w.right) * scale;
  const intTop    = w.top * scale;
  const intBottom = (H - w.bottom) * scale;
  ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
  ctx.strokeRect(intLeft, intTop, intRight - intLeft, intBottom - intTop);

  // Compartments
  if (layout && leaves) {
    const internalH = H - w.top - w.bottom;
    let yOffset = 0;
    leaves.forEach((leaf, idx) => {
      const child = layout.children[idx];
      const childH = (child.heightMode === 'ratio')
                     ? internalH * child.heightValue
                     : child.heightValue;
      const compY = intTop + yOffset * scale;
      const compH = childH * scale;
      ctx.fillStyle = idx === 0 ? '#e8f0e8' : '#ffffff';
      ctx.fillRect(intLeft, compY, intRight - intLeft, compH);
      ctx.strokeStyle = '#999';
      ctx.strokeRect(intLeft, compY, intRight - intLeft, compH);
      ctx.fillStyle = '#000'; ctx.font = '12px Arial';
      ctx.fillText(leaf.leafType, intLeft + 4, compY + 16);
      yOffset += childH;
    });
  }

  ctx.restore();
}

export function drawSideView(canvas, geometry, effectiveWalls) {
  const ctx = canvas.getContext('2d');
  const { H, D, Hb, Db1, Db2, walls } = geometry;

  // per‑face insulation thicknesses
  const tTop   = effectiveWalls.top;
  const tDoor  = effectiveWalls.door;
  const tRear  = effectiveWalls.rear;
  const tRbottom1 = walls.refrigerator.bottom1;  // below raised floor
  const tRbottom2 = walls.refrigerator.bottom2;  // along slope
  const tRbottom3 = walls.refrigerator.bottom3;  // below lower floor

  // Expanded padding to comfortably fit external dimensions
  const PAD = { left: 60, top: 40, right: 40, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / D, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // ---- Outer cabinet ----
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, D * scale, H * scale);

  // ---- Inner cavity (refrigerated space) ----
  const innerRear   = tRear;
  const innerDoor   = D - tDoor;
  const innerTop    = tTop;
  const floorLowerY  = H - tRbottom3;                // inner lower floor y
  const floorRaisedY = H - Hb - tRbottom1;           // inner raised floor y

  const slopeStartX = innerRear + Db1;               // top of slope
  const slopeEndX   = innerRear + Db2;               // foot of slope

  // ---- Insulation band (outer‑inner gap) ----
  ctx.beginPath();
  // outer outline
  ctx.rect(0, 0, D * scale, H * scale);
  // cut out inner cavity
  ctx.moveTo(innerRear * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, floorLowerY * scale);
  ctx.lineTo(slopeEndX   * scale, floorLowerY * scale);
  ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
  ctx.lineTo(innerRear   * scale, floorRaisedY * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';   // lighter insulation colour for better contrast
  ctx.fill();

  // Slope vector and length
  const slopeDx = slopeEndX - slopeStartX;
  const slopeDy = floorLowerY - floorRaisedY;
  const slopeLen = Math.sqrt(slopeDx*slopeDx + slopeDy*slopeDy);

  // Outward normal (pointing into compressor box)
  let nx =  slopeDy / slopeLen;
  let ny = -slopeDx / slopeLen;
  if (ny < 0) { nx = -nx; ny = -ny; }   // ensure outward is down

  // Top horizontal of compressor box
  const yTop = floorRaisedY + tRbottom1;
  const sTop = slopeDy !== 0 ? (yTop - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xTop = slopeStartX + sTop * slopeDx + nx * tRbottom2;

  // Bottom of compressor box
  const yBottom = H;
  const sBottom = slopeDy !== 0 ? (yBottom - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
  const xBottom = slopeStartX + sBottom * slopeDx + nx * tRbottom2;

  ctx.beginPath();
  ctx.moveTo(0, H * scale);                                   // bottom-left corner
  ctx.lineTo(0, yTop * scale);                                // left edge
  ctx.lineTo(xTop * scale, yTop * scale);                     // top edge
  ctx.lineTo(xBottom * scale, yBottom * scale);               // sloped wall
  ctx.closePath();                                            
  ctx.fillStyle = '#ddd';
  ctx.fill();
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = '#555'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('Comp.', 6, yTop * scale + 14);

  // ---- Inner cavity outline (white fill, blue border) ----
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

  // ==========================================
  // DIMENSIONS OVERLAY
  // ==========================================
  
  // 1. Overall Height (Nested on the far left)
  drawDim(ctx, 0, H * scale, 0, 0, -45, 'H');

  // 2. Compressor Height (Nested inside Overall Height on the left)
  drawDim(ctx, 0, H * scale, 0, floorRaisedY * scale, -20, 'Hb');

  // 3. Overall Depth (Nested far up top)
  drawDim(ctx, 0, 0, D * scale, 0, -25, 'D');

  // 4. Db1 - Raised Floor Depth (Inside, horizontally placed above raised floor)
  drawDim(ctx, innerRear * scale, floorRaisedY * scale, slopeStartX * scale, floorRaisedY * scale, -18, 'Db1');

  // 5. Db2 - Lower Floor Depth (Inside, horizontally placed above lower floor)
  drawDim(ctx, innerRear * scale, floorLowerY * scale, slopeEndX * scale, floorLowerY * scale, -18, 'Db2');

  // 6. tTop - Top Insulation (Centered, spans top wall)
  const topMidX = (innerRear + innerDoor) / 2 * scale;
  drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, 'tTop');

  // 7. tDoor - Door Insulation (Right wall, vertically centered)
  const doorMidY = (innerTop + floorLowerY) / 2 * scale;
  drawDim(ctx, innerDoor * scale, doorMidY, D * scale, doorMidY, 0, 'tDoor');

  // 8. tRear - Rear Insulation (Left wall, inside the refrigerated space)
  const rearMidY = (innerTop + floorRaisedY) / 2 * scale;
  drawDim(ctx, 0, rearMidY, innerRear * scale, rearMidY, 0, 'tRear');

  // 9. tRb3 - Bottom Insulation (Bottom flat floor)
  const botMidX = (slopeEndX + innerDoor) / 2 * scale;
  drawDim(ctx, botMidX, floorLowerY * scale, botMidX, H * scale, 0, 'tRb3');

  // 10. tRb2 - Slope Insulation (Perpendicular to the slope)
  const midSlopeX = (slopeStartX + slopeEndX) / 2;
  const midSlopeY = (floorRaisedY + floorLowerY) / 2;
  
  const innerPX = midSlopeX * scale;
  const innerPY = midSlopeY * scale;
  const outerPX = innerPX + nx * (tRbottom2 * scale);
  const outerPY = innerPY + ny * (tRbottom2 * scale);

  drawDim(ctx, innerPX, innerPY, outerPX, outerPY, 0, 'tRb2');

  ctx.restore();
}