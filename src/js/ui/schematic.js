// src/js/ui/schematic.js
// Place this right after the import/export statements, before drawFrontView
function drawDim(ctx, x1, y1, x2, y2, offset, label, {
  textAlign = 'center',
  color = '#555',
  lineWidth = 0.6,
  arrowSize = 4,
  font = '9px Arial'
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

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + nx * (offset + 3 * lineWidth), y1 + ny * (offset + 3 * lineWidth));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + nx * (offset + 3 * lineWidth), y2 + ny * (offset + 3 * lineWidth));
  ctx.stroke();

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
      px - arrowSize * Math.cos(angle - Math.PI / 6) * sign,
      py - arrowSize * Math.sin(angle - Math.PI / 6) * sign
    );
    ctx.lineTo(
      px - arrowSize * Math.cos(angle + Math.PI / 6) * sign,
      py - arrowSize * Math.sin(angle + Math.PI / 6) * sign
    );
    ctx.closePath();
    ctx.fill();
  }

  const midX = (p1x + p2x) / 2;
  const midY = (p1y + p2y) / 2;
  ctx.fillStyle = '#000';
  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, midX, midY);
}
export function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves) {
  const ctx = canvas.getContext('2d');
  const { H, W } = geometry;
  const w = effectiveWalls;

  const PAD = { left: 40, top: 20, right: 20, bottom: 20 };
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

  const PAD = { left: 40, top: 20, right: 20, bottom: 20 };
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
  ctx.fillStyle = '#e8e8e8';   // insulation colour
  ctx.fill();
console.log('effectiveWalls:', effectiveWalls);
console.log('walls:', walls);
console.log('tTop, tDoor, tRear:', tTop, tDoor, tRear);
console.log('tRbottom1-3:', tRbottom1, tRbottom2, tRbottom3);
// ---- Compressor box (touches outer shell on left & bottom) ----
// Slope vector and length (already computed above)
const slopeDx = slopeEndX - slopeStartX;
const slopeDy = floorLowerY - floorRaisedY;
const slopeLen = Math.sqrt(slopeDx*slopeDx + slopeDy*slopeDy);

// Outward normal (pointing into compressor box)
let nx =  slopeDy / slopeLen;
let ny = -slopeDx / slopeLen;
if (ny < 0) { nx = -nx; ny = -ny; }   // ensure outward is down

// The outer sloped wall is offset from the inner slope by tRbottom2 perpendicular.
// Parametric: (x, y) = innerPoint(s) + (nx, ny) * tRbottom2
//   innerPoint(s) = (slopeStartX + s*slopeDx, floorRaisedY + s*slopeDy)

// Top horizontal of compressor box: yTop = floorRaisedY + tRbottom1
const yTop = floorRaisedY + tRbottom1;
// Find s where offset line crosses yTop
// floorRaisedY + s*slopeDy + ny*tRbottom2 = yTop
const sTop = slopeDy !== 0 ? (yTop - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
const xTop = slopeStartX + sTop * slopeDx + nx * tRbottom2;

// Bottom of compressor box is outer shell: yBottom = H
const yBottom = H;
// Find s where offset line crosses yBottom
const sBottom = slopeDy !== 0 ? (yBottom - floorRaisedY - ny * tRbottom2) / slopeDy : 0;
const xBottom = slopeStartX + sBottom * slopeDx + nx * tRbottom2;

ctx.beginPath();
ctx.moveTo(0, H * scale);                                   // bottom-left corner
ctx.lineTo(0, yTop * scale);                                // left edge (outer shell)
ctx.lineTo(xTop * scale, yTop * scale);                     // top edge (horizontal)
ctx.lineTo(xBottom * scale, yBottom * scale);               // sloped wall (constant offset)
ctx.closePath();                                            // bottom edge (outer shell) back to (0,H)
ctx.fillStyle = '#ccc';
ctx.fill();
ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8;
ctx.stroke();
ctx.fillStyle = '#000'; ctx.font = '10px Arial';
ctx.fillText('Comp.', 4, yTop * scale + 12);

   // ---- Inner cavity outline (white fill, blue border) ----
  ctx.beginPath();
  ctx.moveTo(innerRear * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, floorLowerY * scale);
  ctx.lineTo(slopeEndX   * scale, floorLowerY * scale);
  ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
  ctx.lineTo(innerRear   * scale, floorRaisedY * scale);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // ---- Draw dimensions (overlay) ----
  ctx.save();
  ctx.strokeStyle = '#555';
  ctx.fillStyle = '#000';
  ctx.font = '9px Arial';
  ctx.lineWidth = 0.6;

  const scaleVal = scale;

  // ---------- 1. tDoor – right side, text pushed further right ----------
  drawDim(ctx, D * scaleVal, innerTop * scaleVal, innerDoor * scaleVal, innerTop * scaleVal, -14, 'tDoor', { textAlign: 'left' });
  // manually add extra spacing for the label
  const tDoorMidX = (D * scaleVal + innerDoor * scaleVal) / 2;
  const tDoorMidY = innerTop * scaleVal - 14;   // line’s vertical position
  ctx.fillText('tDoor', tDoorMidX + 12, tDoorMidY - 5);

  // ---------- 2. Db1 – draw it lower, e.g. just above the raised floor ----------
  const db1Y = floorRaisedY * scaleVal - 16;   // adjust vertical offset as needed
  drawDim(ctx, innerRear * scaleVal, db1Y, slopeStartX * scaleVal, db1Y, -8, 'Db1', { textAlign: 'center' });

  // ---------- 3. tTop – centre it horizontally, pull text up ----------
  const topMidX = D * scaleVal / 2;
  drawDim(ctx, topMidX, 0, topMidX, innerTop * scaleVal, -16, '', {});   // draw line only
  ctx.fillText('tTop', topMidX - 10, -22);        // text up and slightly left

  // ---------- 4. tRear – middle of the rear wall height ----------
  const rearMidY = ((innerTop + floorRaisedY) / 2) * scaleVal;
  drawDim(ctx, 0, rearMidY, innerRear * scaleVal, rearMidY, -16, 'tRear', { textAlign: 'right' });

  // ---------- 5. tRb2 – slope insulation, text left of the dimension line ----------
  const midSlopeX = (slopeStartX + slopeEndX) / 2;
  const midSlopeY = (floorRaisedY + floorLowerY) / 2;
  const slopeAngle = Math.atan2(floorLowerY - floorRaisedY, slopeEndX - slopeStartX);
  let perpX = Math.sin(slopeAngle);
  let perpY = -Math.cos(slopeAngle);
  if (perpY < 0) { perpX = -perpX; perpY = -perpY; }
  const offsetX = perpX * 16;
  const offsetY = perpY * 16;
  // line
  drawDim(ctx, midSlopeX * scaleVal, midSlopeY * scaleVal, midSlopeX * scaleVal + offsetX, midSlopeY * scaleVal + offsetY, 0, '', {});
  // text to the left of the line
  const textAngle = Math.atan2(offsetY, offsetX);
  const textX = midSlopeX * scaleVal + offsetX / 2 - 15 * Math.cos(textAngle);
  const textY = midSlopeY * scaleVal + offsetY / 2 - 15 * Math.sin(textAngle);
  ctx.fillText('tRb2', textX, textY);

  // ---------- 6. tRb3 – centre horizontally, push text down ----------
  const botMidX = D * scaleVal / 2;
  drawDim(ctx, botMidX, H * scaleVal, botMidX, floorLowerY * scaleVal, 10, '', {});
  ctx.fillText('tRb3', botMidX + 5, H * scaleVal + 20);

  // ---------- 7. Hb – move to left side ----------
  drawDim(ctx, 0, H * scaleVal, 0, (H - Hb) * scaleVal, -14, 'Hb', { textAlign: 'right' });

  // ---------- Remaining dimensions (D, H, Db2) – keep them as they were ----------
  drawDim(ctx, 0, 0, D * scaleVal, 0, -12, 'D', { textAlign: 'center' });
  drawDim(ctx, 0, H * scaleVal, 0, 0, -14, 'H', { textAlign: 'center' });
  drawDim(ctx, innerRear * scaleVal, floorLowerY * scaleVal, slopeEndX * scaleVal, floorLowerY * scaleVal, 10, 'Db2', { textAlign: 'center' });

  ctx.restore();   // this is the final restore that was already there
}
