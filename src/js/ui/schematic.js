/**
 * @file schematic.js
 * Renders the 2D CAD-like representations of the refrigerator configuration.
 * Maps abstract geometric boundaries and user inputs directly onto an HTML5 Canvas.
 * Refined with a unified, WCAG AAA-compliant dark theme for technical clarity.
 */

export const DRAW_THEME = {
  // Line & Text colors
  color: '#7AB3FF',          // Dimensions / Primary lines (Accent Blue)
  strokePrimary: '#4C5970',  // Structural outlines (Border Hover)
  strokeMuted: '#333C4D',    // Inner shelves / minor details (Border Default)
  text: '#F0F3F7',           // Text labels
  textMuted: '#AEB7C5',      // Secondary text labels
  
  // Fill colors (Dark mode native)
  bgCanvas: '#141923',       // Matches var(--bg-surface)
  bgInsulation: '#0D1118',   // Matches var(--bg-recessed)
  bgFresh: '#1A212D',        // Slightly elevated for fresh food compartment
  bgFreezer: '#1E293B',      // Cooler tone for freezer compartment
  bgObstacle: 'rgba(51, 60, 77, 0.6)', // Obstacles/Control boxes
  bgDoor: 'rgba(122, 179, 255, 0.12)', // Doors and dikes fill
  
  // Highlighting
  alert: '#FF9E9E',          // Evaporator / Errors
  warning: '#FCD34D',        // Control Box accents
  
  // Metrics
  lineWidth: 1,
  arrowSize: 5,
  font: '12px "Inter", sans-serif',
  fontMono: '11px "JetBrains Mono", monospace'
};

/**
 * Draw a dimension line with extension lines, arrows, and label.
 * Styled to mimic standard CAD drafting representations.
 */
export function drawDim(ctx, x1, y1, x2, y2, offset, label, options = {}) {
  const {
    color = DRAW_THEME.color,
    lineWidth = DRAW_THEME.lineWidth,
    arrowSize = DRAW_THEME.arrowSize,
    font = DRAW_THEME.fontMono,
    textOffsetX = 0,
    textOffsetY = 0,
    drawExtLines = true,
    bgColor = DRAW_THEME.bgCanvas,
  } = options;

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

  // Label text with opaque background interruption
  if (label) {
    const midX = (p1x + p2x) / 2 + textOffsetX;
    const midY = (p1y + p2y) / 2 + textOffsetY;
    ctx.translate(midX, midY);

    // Keep text upright
    let textAngle = angle;
    if (textAngle > Math.PI / 2 + 0.01) textAngle -= Math.PI;
    else if (textAngle < -Math.PI / 2 + 0.01) textAngle += Math.PI;
    if (Math.abs(textAngle - Math.PI / 2) < 0.01) textAngle = -Math.PI / 2;
    
    ctx.rotate(textAngle);
    ctx.font = font;
    
    const metrics = ctx.measureText(label);
    const tw = metrics.width;
    const th = 12; // Approx font height
    const padX = 4;
    const padY = 2;
    
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-tw / 2 - padX, -th / 2 - padY, tw + padX * 2, th + padY * 2, 2);
    } else {
      ctx.fillRect(-tw / 2 - padX, -th / 2 - padY, tw + padX * 2, th + padY * 2);
    }
    ctx.fill();
    
    ctx.fillStyle = DRAW_THEME.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
  }
  ctx.restore();
}

/**
 * Helper to draw internal obstacles consistently.
 */
function drawBox(ctx, x, y, w, h, label, color) {
  ctx.fillStyle = DRAW_THEME.bgObstacle;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = DRAW_THEME.text;
  ctx.font = DRAW_THEME.fontMono;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

/**
 * Renders the 2D front-facing elevation of the refrigerator.
 */
export function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves, options = {}) {
  const ctx = canvas.getContext('2d');
  const { H, W, Hb = 0, walls = {} } = geometry;
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
    compartmentTypes = [],
    numCompartments = 1,
    ctrlBoxH = 0,
    ctrlBoxW = 0,
    rshowerH = 0,
    rshowerW = 0,
    innerTopY = 0,
    innerBottomY = 0,
  } = options;

  const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / W, drawH / H);

  // Clear canvas to native dark
  ctx.fillStyle = DRAW_THEME.bgCanvas;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Per compartment inner boundaries
  const innerLeft  = compartments.map(c => c.left);
  const innerRight = compartments.map(c => W - c.right);
  const intTop     = effectiveWalls.top;
  const intBottom  = H - effectiveWalls.bottom;
  const tRbottom1 = walls.refrigerator?.bottom1 || 0;
  const floorRaisedY = H - Hb - tRbottom1;

  // Build the inner cavity polygon (filled insulation)
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
  }
  ctx.lineTo(innerLeft[compHeights.length - 1] * scale, y * scale);
  ctx.closePath();
  ctx.fillStyle = DRAW_THEME.bgInsulation;
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
    
    ctx.fillStyle = types[i] === 'freezer' ? DRAW_THEME.bgFreezer : DRAW_THEME.bgFresh;
    ctx.fillRect(leftX, compY, rightX - leftX, compH);
    ctx.strokeStyle = DRAW_THEME.strokePrimary;
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, compY, rightX - leftX, compH);
    
    ctx.fillStyle = DRAW_THEME.text;
    ctx.font = DRAW_THEME.font;
    ctx.textAlign = 'left';
    if (types[i]) ctx.fillText(types[i].toUpperCase(), leftX + 8, compY + 20);
    
    y += h;
    
    if (i < compHeights.length - 1 && dividerThickness > 0) {
      const dividerY = y * scale;
      const dividerH = dividerThickness * scale;
      ctx.fillStyle = DRAW_THEME.bgInsulation;
      ctx.fillRect(leftX, dividerY, rightX - leftX, dividerH);
      ctx.strokeStyle = DRAW_THEME.strokeMuted;
      ctx.strokeRect(leftX, dividerY, rightX - leftX, dividerH);
      y += dividerThickness;
    }
  }

  // Shelves + rails
  if (shelfCounts && shelfCounts.length > 0) {
    let yOffset = intTop;
    for (let i = 0; i < compHeights.length; i++) {
      const n = shelfCounts[i] || 0;
      const compH = compHeights[i];
      const compY = yOffset * scale;
      if (n > 0) {
        let usableH = compH;
        if (i === compHeights.length - 1) {
          usableH = Math.min(compH, floorRaisedY - yOffset);
        }
        const spacing = (usableH * scale) / (n + 1);
        for (let s = 1; s <= n; s++) {
          const shelfYpx = compY + spacing * s;
          
          ctx.beginPath();
          ctx.moveTo(innerLeft[i] * scale, shelfYpx);
          ctx.lineTo(innerRight[i] * scale, shelfYpx);
          ctx.lineWidth = 2;
          ctx.strokeStyle = DRAW_THEME.strokeMuted;
          ctx.stroke();
          
          const railW = railWidth * scale;
          const railH = railHeight * scale;
          const leftRailX = innerLeft[i] * scale;
          const rightRailX = innerRight[i] * scale - railW;
          
          ctx.fillStyle = DRAW_THEME.bgInsulation;
          ctx.strokeStyle = DRAW_THEME.strokePrimary;
          
          ctx.fillRect(leftRailX, shelfYpx, railW, railH);
          ctx.strokeRect(leftRailX, shelfYpx, railW, railH);
          
          ctx.fillRect(rightRailX, shelfYpx, railW, railH);
          ctx.strokeRect(rightRailX, shelfYpx, railW, railH);
        }
      }
      yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
    }
  } else if (fittings && leaves) {
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
      
      const shelfCount = fittingsForLeaf.shelves.length;
      if (shelfCount > 0) {
        const shelfGap = compHeightPx / (shelfCount + 1);
        for (let s = 0; s < shelfCount; s++) {
          const yy = compY + shelfGap * (s + 1);
          ctx.fillStyle = DRAW_THEME.strokeMuted;
          ctx.fillRect((effectiveWalls.left + 10) * scale, yy - 1, (internalWidth - 20) * scale, 2);
        }
      }
      
      const drawerCount = fittingsForLeaf.drawers.length;
      if (drawerCount > 0) {
        const drawerWidth = internalWidth * 0.8 * scale;
        const drawerHeight = 30;
        const drawerGap = (compHeightPx - drawerCount * drawerHeight) / (drawerCount + 1);
        for (let d = 0; d < drawerCount; d++) {
          const yy = compY + drawerGap * (d + 1) + drawerHeight * d;
          const xx = (effectiveWalls.left + (internalWidth - drawerWidth / scale) / 2) * scale;
          ctx.strokeStyle = DRAW_THEME.strokeMuted;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(xx, yy, drawerWidth, drawerHeight);
          ctx.fillStyle = DRAW_THEME.bgInsulation;
          ctx.fillRect(xx, yy, drawerWidth, drawerHeight);
        }
      }
      yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
    }
  }

  // Control Box & R Shower
  let freshIdx = -1;
  if (numCompartments === 1) {
    freshIdx = 0;
  } else {
    freshIdx = compartmentTypes.findIndex(t => t === 'fresh');
  }
  
  if (freshIdx >= 0 && compHeights[freshIdx]) {
    let freshTopY = intTop;
    for (let i = 0; i < freshIdx; i++) {
        freshTopY += compHeights[i] + dividerThickness;
    }
    const freshHeight = compHeights[freshIdx];
    const placeAtTop = (numCompartments === 1) || (freshIdx > 0);
    
    const availableRearH = placeAtTop 
      ? Math.max(0, Math.min(freshHeight, floorRaisedY - freshTopY))
      : freshHeight;
      
    const effectiveCtrlH = Math.min(ctrlBoxH, availableRearH);
    const effectiveRShowerH = Math.max(0, Math.min(rshowerH, availableRearH - effectiveCtrlH));
    
    const ctrlBoxW_px = ctrlBoxW * scale;
    const rshowerW_px = rshowerW * scale;
    const ctrlBoxH_px = effectiveCtrlH * scale;
    const rshowerH_px = effectiveRShowerH * scale;
    
    let currentY = placeAtTop ? freshTopY * scale : (freshTopY + freshHeight) * scale;
    
    if (effectiveCtrlH > 0 && ctrlBoxW > 0) {
      const ctrlBoxY = placeAtTop ? currentY : currentY - ctrlBoxH_px;
      const ctrlBoxX = (W / 2 - ctrlBoxW / 2) * scale;
      drawBox(ctx, ctrlBoxX, ctrlBoxY, ctrlBoxW_px, ctrlBoxH_px, 'Ctrl Box', DRAW_THEME.warning);
      currentY = placeAtTop ? ctrlBoxY + ctrlBoxH_px : ctrlBoxY;
    }
    
    if (effectiveRShowerH > 0 && rshowerW > 0) {
      const rshowerY = placeAtTop ? currentY : currentY - rshowerH_px;
      const rshowerX = (W / 2 - rshowerW / 2) * scale;
      drawBox(ctx, rshowerX, rshowerY, rshowerW_px, rshowerH_px, 'R-Shower', DRAW_THEME.color);
    }
  }

  // Outer cabinet stroke
  ctx.strokeStyle = DRAW_THEME.strokePrimary;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W * scale, H * scale);

  // Dashed Hb line for compressor step reference
  const hbY = (H - Hb - tRbottom1) * scale;
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
  if (compIdx === -1) compIdx = compHeights.length - 1;
  
  ctx.save();
  ctx.strokeStyle = DRAW_THEME.warning;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerLeft[compIdx] * scale, hbY);
  ctx.lineTo(innerRight[compIdx] * scale, hbY);
  ctx.stroke();
  ctx.restore();

  // Dimension lines
  const dimX = -25;
  y = intTop;
  for (let i = 0; i < compHeights.length; i++) {
    const h = compHeights[i];
    drawDim(ctx, dimX, y * scale, dimX, (y + h) * scale, 0, `h: ${h.toFixed(0)}`);
    y += h;
    if (i < compHeights.length - 1 && dividerThickness > 0) {
      const dividerBottom = y + dividerThickness;
      drawDim(ctx, dimX, y * scale, dimX, dividerBottom * scale, 0, `div: ${dividerThickness}`);
      y = dividerBottom;
    }
  }
  
  drawDim(ctx, 0, H * scale, W * scale, H * scale, 30, `W: ${W.toFixed(0)}`);
  drawDim(ctx, 0, 0, innerLeft[0] * scale, 0, -20, `tLeft: ${compartments[0].left.toFixed(0)}`);
  drawDim(ctx, innerRight[0] * scale, 0, W * scale, 0, -20, `tRight: ${compartments[0].right.toFixed(0)}`);
  
  ctx.restore();
}

/**
 * Renders the 2D side-profile elevation of the refrigerator.
 * Recreates the compressor step geometry (Hb, Db1, Db2) and cross-sectional volumes.
 */
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
    evapDepth = 0,
    ctrlBoxH = 0,
    ctrlBoxL = 0,
    rshowerH = 0,
    rshowerL = 0,
    numCompartments = 2,
    compartmentTypes = [],
  } = options;

  let ctrlBoxFrontX = null, ctrlBoxTop = null, ctrlBoxBottom = null;
  let rshowerFrontX = null, rshowerTop = null, rshowerBottom = null;

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

  // Clear canvas to native dark
  ctx.fillStyle = DRAW_THEME.bgCanvas;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  const innerDoor = D;
  const innerTop  = tTop;
  const floorLowerY  = H - tRbottom3;
  const floorRaisedY = H - Hb - tRbottom1;

  // Compressor step coordinates (outer)
  const xTopCB = Db1;
  const yTopCB = H - Hb;
  const xBottomCB = Db2;
  const yBottomCB = H;
  
  const cbDx = xBottomCB - xTopCB;
  const cbDy = yBottomCB - yTopCB;
  const cbLen = Math.sqrt(cbDx * cbDx + cbDy * cbDy);
  
  let slopeStartX = Db1;
  let slopeEndX = Db2;
  let nx = 1, ny = 0;
  
  if (cbLen > 0) {
    nx = cbDy / cbLen;
    ny = -cbDx / cbLen;
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

  // Insulation bands and internal cavities
  if (compHeights.length === 1) {
    ctx.fillStyle = DRAW_THEME.bgInsulation;
    ctx.fillRect(0, innerTop * scale, D * scale, (H - innerTop) * scale);
    
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
    
    ctx.fillStyle = compartmentTypes[0] === 'freezer' ? DRAW_THEME.bgFreezer : DRAW_THEME.bgFresh;
    ctx.fill();
    ctx.strokeStyle = DRAW_THEME.strokePrimary;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (compHeights.length === 2) {
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
    ctx.fillStyle = DRAW_THEME.bgInsulation;
    ctx.fill();
    
    ctx.beginPath();
    ctx.rect(topRearX, topY, innerDoor * scale - topRearX, topCompH);
    ctx.fillStyle = compartmentTypes[0] === 'freezer' ? DRAW_THEME.bgFreezer : DRAW_THEME.bgFresh;
    ctx.fill();
    ctx.strokeStyle = DRAW_THEME.strokePrimary;
    ctx.stroke();
    
    const bottomH = compHeights[1];
    const bottomRearX = compRear[1] * scale;
    const bottomY = (innerTop + topH + dividerThickness) * scale;
    const bottomCompH = bottomH * scale;
    
    ctx.beginPath();
    ctx.rect(0, bottomY, D * scale, bottomCompH);
    ctx.fillStyle = DRAW_THEME.bgInsulation;
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(bottomRearX, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY);
    ctx.lineTo(innerDoor * scale, bottomY + bottomCompH);
    ctx.lineTo(innerDoor * scale, floorLowerY * scale);
    ctx.lineTo(slopeEndX * scale, floorLowerY * scale);
    ctx.lineTo(slopeStartX * scale, floorRaisedY * scale);
    ctx.lineTo(bottomRearX, floorRaisedY * scale);
    ctx.closePath();
    
    ctx.fillStyle = compartmentTypes[1] === 'freezer' ? DRAW_THEME.bgFreezer : DRAW_THEME.bgFresh;
    ctx.fill();
    ctx.strokeStyle = DRAW_THEME.strokePrimary;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Compressor box
  ctx.beginPath();
  ctx.moveTo(0, H * scale);
  ctx.lineTo(0, yTopCB * scale);
  ctx.lineTo(xTopCB * scale, yTopCB * scale);
  ctx.lineTo(xBottomCB * scale, yBottomCB * scale);
  ctx.closePath();
  ctx.fillStyle = DRAW_THEME.bgObstacle;
  ctx.fill();
  ctx.strokeStyle = DRAW_THEME.strokeMuted;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = DRAW_THEME.text;
  ctx.font = DRAW_THEME.fontMono;
  ctx.fillText('Comp.', 6, yTopCB * scale + 14);

  // Divider & doors
  let drawnDoors = [];
  if (compHeights.length === 2 && dividerThickness > 0) {
    const dividerY = innerTop + compHeights[0];
    const dividerH = dividerThickness;
    const dividerLeftX = compRear[1] * scale;
    
    ctx.fillStyle = DRAW_THEME.bgInsulation;
    ctx.fillRect(dividerLeftX, dividerY * scale, (innerDoor - compRear[1]) * scale, dividerH * scale);
    ctx.strokeStyle = DRAW_THEME.strokeMuted;
    ctx.strokeRect(dividerLeftX, dividerY * scale, (innerDoor - compRear[1]) * scale, dividerH * scale);
    
    const topDoorTop = 0;
    const topDoorBottom = (dividerY + dividerH/2) * scale - (doorGap / 2) * scale;
    const bottomDoorTop = (dividerY + dividerH/2) * scale + (doorGap / 2) * scale;
    const bottomDoorBottom = H * scale;
    
    drawnDoors.push({ top: topDoorTop, bottom: topDoorBottom, compIndex: 0 });
    drawnDoors.push({ top: bottomDoorTop, bottom: bottomDoorBottom, compIndex: 1 });
    
    drawDim(ctx, D * scale, topDoorBottom, D * scale, bottomDoorTop, -45, `door gap: ${(dividerThickness + doorGap).toFixed(0)}`);
  } else {
    drawnDoors.push({ top: 0, bottom: H * scale, compIndex: 0 });
  }

  for (const door of drawnDoors) {
    const compIdx = door.compIndex;
    const doorThickness = (compartments[compIdx] && compartments[compIdx].door != null)
                          ? compartments[compIdx].door : (effectiveWalls.door || 60);
    const doorLeftX = D * scale;
    const doorWidth = doorThickness * scale;
    
    ctx.fillStyle = DRAW_THEME.bgDoor;
    ctx.fillRect(doorLeftX, door.top, doorWidth, door.bottom - door.top);
    ctx.strokeStyle = DRAW_THEME.strokeMuted;
    ctx.strokeRect(doorLeftX, door.top, doorWidth, door.bottom - door.top);
  }

  for (const door of drawnDoors) {
    const compIdx = door.compIndex;
    const doorThickness = (compartments[compIdx] && compartments[compIdx].door != null)
                          ? compartments[compIdx].door : (effectiveWalls.door || 60);
    const doorMidY = (door.top + door.bottom) / 2.5;
    drawDim(ctx, (D - doorThickness) * scale, doorMidY, D * scale, doorMidY, 0, `tDoor: ${doorThickness.toFixed(0)}`);
  }

  for (const door of drawnDoors) {
    const compIdx = door.compIndex;
    const doorThickness = (compartments[compIdx] && compartments[compIdx].door != null)
                          ? compartments[compIdx].door : (effectiveWalls.door || 60);
    const dimX = (D + doorThickness) * scale + 15;
    drawDim(ctx, dimX, door.top, dimX, door.bottom, 0, `Door: ${((door.bottom - door.top) / scale).toFixed(0)}`);
  }

  // Door dikes
  if (dikeHeight > 0 && doorX != null) {
    const dikeH_dike = dikeHeight * scale;
    const baseW_dike = dikeBaseWidth * scale;
    const topW_dike = dikeTopWidth * scale;
    const doorX_dike = innerDoor * scale;
    const leftX_dike = (innerDoor - dikeHeight) * scale;
    
    let yComp = innerTop;
    for (let i = 0; i < compHeights.length; i++) {
      const compTopY = yComp * scale;
      const compBottomY = (yComp + compHeights[i]) * scale;
      
      ctx.beginPath();
      ctx.moveTo(doorX_dike, compTopY);
      ctx.lineTo(doorX_dike, compTopY + baseW_dike);
      ctx.lineTo(leftX_dike, compTopY + (baseW_dike - topW_dike) / 2 + topW_dike);
      ctx.lineTo(leftX_dike, compTopY + (baseW_dike - topW_dike) / 2);
      ctx.closePath();
      
      ctx.fillStyle = DRAW_THEME.bgDoor;
      ctx.fill();
      ctx.strokeStyle = DRAW_THEME.strokeMuted;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(doorX_dike, compBottomY - baseW_dike);
      ctx.lineTo(doorX_dike, compBottomY);
      ctx.lineTo(leftX_dike, compBottomY - (baseW_dike - topW_dike) / 2);
      ctx.lineTo(leftX_dike, compBottomY - (baseW_dike + topW_dike) / 2);
      ctx.closePath();
      
      ctx.fill();
      ctx.stroke();
      
      yComp += compHeights[i];
      if (i < compHeights.length - 1) yComp += dividerThickness;
    }
  }

  const isFreezer = (i) => compartmentTypes[i] === 'freezer';
  let freshCompIdx = -1, freshTopWorld = 0, freshBottomWorld = 0;
  
  if (compHeights.length === 1) {
    freshCompIdx = 0;
    freshTopWorld = innerTopY;
    freshBottomWorld = innerBottomY;
  } else {
    freshCompIdx = compartmentTypes.findIndex(t => t === 'fresh');
    if (freshCompIdx >= 0) {
      let yAcc = innerTopY;
      for (let i = 0; i < freshCompIdx; i++) {
        yAcc += compHeights[i];
        if (i < freshCompIdx - 1) yAcc += dividerThickness;
      }
      if (freshCompIdx > 0) yAcc += dividerThickness;
      freshTopWorld = yAcc;
      freshBottomWorld = yAcc + compHeights[freshCompIdx];
    }
  }

  // Obstructions (Control box, R-shower)
  if (freshCompIdx >= 0) {
    const rearX = compRear[freshCompIdx];
    const freshHeight = freshBottomWorld - freshTopWorld;
    
    const isTopFreezer = freshCompIdx > 0;
    const placeAtTop = (compHeights.length === 1) || isTopFreezer;
    
    const offsetRearX = (compHeights.length === 1 && evapDepth > 0) ? rearX + evapDepth : rearX;
    
    const availableRearH = placeAtTop 
      ? Math.max(0, Math.min(freshHeight, floorRaisedY - freshTopWorld))
      : freshHeight;
      
    const ctrlBoxH_eff = Math.min(ctrlBoxH, availableRearH);
    const rshowerH_eff = Math.max(0, Math.min(rshowerH, availableRearH - ctrlBoxH_eff));
    
    const drawCtrl = ctrlBoxH_eff > 0 && ctrlBoxL > 0;
    const drawRshower = rshowerH_eff > 0 && rshowerL > 0;
    
    let yCursor = placeAtTop ? freshTopWorld : freshBottomWorld;
    
    if (drawCtrl) {
      const boxTop = placeAtTop ? yCursor : yCursor - ctrlBoxH_eff;
      const boxH = ctrlBoxH_eff * scale;
      const boxW = ctrlBoxL * scale;
      const boxX = offsetRearX * scale;
      
      drawBox(ctx, boxX, boxTop * scale, boxW, boxH, 'Ctrl Box', DRAW_THEME.warning);
      
      ctrlBoxFrontX = offsetRearX + ctrlBoxL;
      ctrlBoxTop = boxTop;
      ctrlBoxBottom = boxTop + ctrlBoxH_eff;
      yCursor = placeAtTop ? ctrlBoxBottom : boxTop;
    }
    
    if (drawRshower) {
      const boxTop = placeAtTop ? yCursor : yCursor - rshowerH_eff;
      const boxH = rshowerH_eff * scale;
      const boxW = rshowerL * scale;
      const boxX = offsetRearX * scale;
      
      drawBox(ctx, boxX, boxTop * scale, boxW, boxH, 'R-Shower', DRAW_THEME.color);
      
      rshowerFrontX = offsetRearX + rshowerL;
      rshowerTop = boxTop;
      rshowerBottom = boxTop + rshowerH_eff;
    }
  }

  // Evaporator dashed boundary
  if (numCompartments === 1 && evapDepth > 0) {
    const rearX = compRear[0];
    const evapX = (rearX + evapDepth) * scale;
    
    ctx.save();
    ctx.strokeStyle = DRAW_THEME.alert;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(evapX, innerTopY * scale);
    ctx.lineTo(evapX, floorRaisedY * scale);
    ctx.stroke();
    ctx.restore();
    
    ctx.fillStyle = DRAW_THEME.alert;
    ctx.font = DRAW_THEME.fontMono;
    ctx.textAlign = 'center';
    ctx.fillText('Evap', evapX, innerTopY * scale + 10);
  } else {
    let yOffset = innerTopY;
    for (let i = 0; i < compHeights.length; i++) {
      if (isFreezer(i)) {
        const compTopY = yOffset;
        let compBottomY = yOffset + compHeights[i];
        if (i === compHeights.length - 1) {
          compBottomY = Math.min(compBottomY, floorRaisedY);
        }
        
        const rearX = compRear[i];
        const evapX = (rearX + evapDepth) * scale;
        
        ctx.save();
        ctx.strokeStyle = DRAW_THEME.alert;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(evapX, compTopY * scale);
        ctx.lineTo(evapX, compBottomY * scale);
        ctx.stroke();
        ctx.restore();
        
        ctx.fillStyle = DRAW_THEME.alert;
        ctx.font = DRAW_THEME.fontMono;
        ctx.textAlign = 'center';
        ctx.fillText('Evap', evapX, compTopY * scale + 10);
      }
      yOffset += compHeights[i];
      if (i < compHeights.length - 1) yOffset += dividerThickness;
    }
  }

  // Shelves and rails
  if (shelfCounts && shelfCounts.length > 0 && innerRearX != null && doorX != null) {
    let yOffset = innerTop;
    for (let i = 0; i < compHeights.length; i++) {
      const n = shelfCounts[i] || 0;
      const compH = compHeights[i];
      const compY = yOffset * scale;
      
      if (n > 0) {
        let usableH = compH;
        if (i === compHeights.length - 1) {
          usableH = Math.min(compH, floorRaisedY - yOffset);
        }
        
        const spacingWorld = usableH / (n + 1);
        for (let s = 1; s <= n; s++) {
          const shelfYWorld = yOffset + s * spacingWorld;
          const shelfYpx = compY + s * spacingWorld * scale;
          let startXWorld = compRear[i];
          
          if (evapDepth > 0 && (numCompartments === 1 || isFreezer(i))) {
            startXWorld = Math.max(startXWorld, compRear[i] + evapDepth);
          }
          if (ctrlBoxTop != null && shelfYWorld >= ctrlBoxTop && shelfYWorld <= ctrlBoxBottom) {
            startXWorld = Math.max(startXWorld, ctrlBoxFrontX);
          }
          if (rshowerTop != null && shelfYWorld >= rshowerTop && shelfYWorld <= rshowerBottom) {
            startXWorld = Math.max(startXWorld, rshowerFrontX);
          }
          
          startXWorld = Math.min(startXWorld, doorX);
          
          ctx.beginPath();
          ctx.moveTo(startXWorld * scale, shelfYpx);
          ctx.lineTo(doorX * scale, shelfYpx);
          ctx.lineWidth = 2;
          ctx.strokeStyle = DRAW_THEME.strokeMuted;
          ctx.stroke();
          
          const railStartXWorld = (evapDepth > 0 && (numCompartments === 1 || isFreezer(i)))
            ? compRear[i] + evapDepth
            : compRear[i];
            
          const usableDepthWorld = doorX - railStartXWorld;
          const railDepthPx = (railDepthPct / 100) * usableDepthWorld * scale;
          const railH = railHeight * scale;
          const railY = shelfYpx;
          
          ctx.fillStyle = DRAW_THEME.bgInsulation;
          ctx.fillRect(railStartXWorld * scale, railY, railDepthPx, railH);
          ctx.strokeStyle = DRAW_THEME.strokePrimary;
          ctx.strokeRect(railStartXWorld * scale, railY, railDepthPx, railH);
        }
      }
      yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
    }
  }

  // Outer cabinet stroke
  ctx.strokeStyle = DRAW_THEME.strokePrimary;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, D * scale, H * scale);

  // Cascaded Dimension lines
  drawDim(ctx, 0, H * scale, 0, 0, -60, `H: ${H.toFixed(0)}`);
  drawDim(ctx, 0, H * scale, 0, (floorRaisedY+tRbottom1) * scale, -35, `Hb: ${Hb.toFixed(0)}`);
  drawDim(ctx, 0, yTopCB * scale, xTopCB * scale, yTopCB * scale, -15, `Db1: ${Db1.toFixed(0)}`);
  drawDim(ctx, 0, yBottomCB * scale, xBottomCB * scale, yBottomCB * scale, -15, `Db2: ${Db2.toFixed(0)}`);
  drawDim(ctx, 0, 0, D * scale, 0, -25, `D: ${D.toFixed(0)}`);
  
  const topMidX = (compRear[0] + innerDoor) / 2 * scale;
  drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, `tTop: ${tTop.toFixed(0)}`);
  
  for (let i = 0; i < compHeights.length; i++) {
    if (i === 0 || compRear[i] !== compRear[i-1]) {
      let compY = innerTop;
      for (let j = 0; j < i; j++) compY += compHeights[j];
      if (i > 0) compY += dividerThickness;
      const midY = (compY + compY + compHeights[i]) / 2.5 * scale;
      drawDim(ctx, 0, midY, compRear[i] * scale, midY, 0, `tRear: ${compartments[i].rear.toFixed(0)}`);
    }
  }

  const botMidX = (slopeEndX + innerDoor) / 2.5 * scale;
  drawDim(ctx, botMidX, floorLowerY * scale, botMidX, H * scale, 0, `tRb3: ${tRbottom3.toFixed(0)}`);
  
  const midCbX = (xTopCB + xBottomCB) / 2;
  const midCbY = (yTopCB + yBottomCB) / 2;
  const inPX = midCbX + nx * tRbottom2;
  const inPY = midCbY + ny * tRbottom2;
  drawDim(ctx, inPX * scale, inPY * scale, midCbX * scale, midCbY * scale, 0, `tRb2: ${tRbottom2.toFixed(0)}`);

  const maxActualDoor = Math.max(
    ...drawnDoors.map(d => {
      const idx = d.compIndex;
      return (compartments[idx] && compartments[idx].door != null)
             ? compartments[idx].door : (effectiveWalls.door || 60);
    })
  );
  
  const compHeightDimX = (D + maxActualDoor) * scale + 40; 
  if (compHeights.length === 2) {
    let yPos = innerTop;
    compHeights.forEach((h, idx) => {
      const bottomY = yPos + h;
      drawDim(ctx, compHeightDimX, yPos * scale, compHeightDimX, bottomY * scale, 0, `h: ${h.toFixed(0)}`);
      yPos = bottomY;
      if (idx === 0 && dividerThickness > 0) yPos += dividerThickness;
    });
  } else if (compHeights.length === 1) {
    drawDim(ctx, compHeightDimX, innerTop * scale, compHeightDimX, (innerTop + compHeights[0]) * scale, 0, `h: ${compHeights[0].toFixed(0)}`);
  }
  
  ctx.restore();
}

/**
 * Binds mouse events to the canvases to display real-world coordinates on hover.
 * Maps canvas pixel space back to real-world millimeters.
 */
export function enableCoordinateTooltip(frontCanvas, sideCanvas, getGeometryFn) {
  const tooltip = document.getElementById('schematicTooltip');
  
  function handleMouseMove(canvas, isFront) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const pixelX = (e.clientX - rect.left) * scaleX;
      const pixelY = (e.clientY - rect.top) * scaleY;
      const geometry = getGeometryFn();
      
      if (!geometry) return;
      
      let worldX, worldY;
      
      if (isFront) {
        const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
        const drawW = canvas.width - PAD.left - PAD.right;
        const drawH = canvas.height - PAD.top - PAD.bottom;
        const scale = Math.min(drawW / geometry.W, drawH / geometry.H);
        worldX = (pixelX - PAD.left) / scale;
        worldY = (pixelY - PAD.top) / scale;
      } else {
        const PAD = { left: 60, top: 40, right: 60, bottom: 40 };
        const drawW = canvas.width - PAD.left - PAD.right;
        const drawH = canvas.height - PAD.top - PAD.bottom;
        const scale = Math.min(drawW / geometry.D, drawH / geometry.H);
        worldX = (pixelX - PAD.left) / scale;
        worldY = (pixelY - PAD.top) / scale;
      }

      // Hide tooltip if coordinates are outside of the cabinet boundaries
      if (worldX < 0 || worldX > (isFront ? geometry.W : geometry.D) || worldY < 0 || worldY > geometry.H) {
        tooltip.classList.add('hidden');
        return;
      }

      tooltip.classList.remove('hidden');
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top = (e.clientY + 16) + 'px';
      tooltip.textContent = `X: ${worldX.toFixed(1)} mm\nY: ${worldY.toFixed(1)} mm`;
    });
    
    canvas.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  }
  
  if (frontCanvas) handleMouseMove(frontCanvas, true);
  if (sideCanvas) handleMouseMove(sideCanvas, false);
}