/**
 * Draws a 2D front‑view schematic of the refrigerator layout.
 * Supports horizontal/vertical splits. Door bins are drawn on the
 * right interior wall (representing the door liner).
 *
 * @param {import('../engine/types.js').LeafResult[]} leaves
 * @param {import('../engine/types.js').CabinetConfig} config
 * @param {HTMLCanvasElement} canvas
 */
export function drawSchematic(leaves, config, canvas) {
  const ctx = canvas.getContext('2d');
  const { external, wallThicknesses: w } = config.cabinet;

  const PAD = { left: 60, top: 40, right: 60, bottom: 40 };
  const drawW = canvas.width  - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top  - PAD.bottom;
  const scale = Math.min(drawW / external.width, drawH / external.height);

  const extW = external.width  * scale;
  const extH = external.height * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // --------------- outer cabinet ---------------
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, extW, extH);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, extW, extH);

  // --------------- internal cavity outline ---------------
  const intLeft   = w.left  * scale;
  const intRight  = extW - w.right * scale;
  const intTop    = w.top   * scale;
  const intBottom = extH - w.bottom * scale;
  const intW = intRight - intLeft;
  const intH = intBottom - intTop;

  ctx.strokeStyle = '#00a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.strokeRect(intLeft, intTop, intW, intH);
  ctx.setLineDash([]);

  // --------------- door representation ---------------
  // Thick line at the right edge of the internal cavity (the door side)
  ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(intRight, intTop);
  ctx.lineTo(intRight, intBottom);
  ctx.stroke();

  if (!leaves || leaves.length === 0) {
    ctx.restore();
    return;
  }

  // --------------- compute leaf positions from config tree ---------------
  const internalW = external.width  - w.left - w.right;
  const internalH = external.height - w.top  - w.bottom;
  const rootSpace = { x: 0, y: 0, width: internalW, height: internalH };
  const leafRects = [];

  function traverse(node, space) {
    if (node.nodeType === 'leaf') {
      leafRects.push({ ...space, fittings: node.fittings, type: node.type });
    } else if (node.nodeType === 'horizontal') {
      const { children, dividers } = node;
      const totalDivThick = dividers.reduce((s, d) => s + d.thickness, 0);
      const usableH = space.height - totalDivThick;
      let yOffset = space.y;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        let childH;
        if (child.heightMode === 'ratio') childH = usableH * child.heightValue;
        else childH = child.heightValue;
        traverse(child.node, { x: space.x, y: yOffset, width: space.width, height: childH });
        yOffset += childH;
        if (i < dividers.length) yOffset += dividers[i].thickness;
      }
    } else if (node.nodeType === 'vertical') {
      const { dividerThickness, leftWidthRatio, left, right } = node;
      const usableW = space.width - dividerThickness;
      const leftW = usableW * leftWidthRatio;
      const rightW = usableW * (1 - leftWidthRatio);
      traverse(left,  { x: space.x, y: space.y, width: leftW, height: space.height });
      traverse(right, { x: space.x + leftW + dividerThickness, y: space.y, width: rightW, height: space.height });
    }
  }

  traverse(config.cabinet.layout, rootSpace);

  // --------------- draw compartments & fittings ---------------
  leafRects.forEach((rect, idx) => {
    const x = intLeft + rect.x * scale;
    const y = intTop  + rect.y * scale;
    const w = rect.width  * scale;
    const h = rect.height * scale;
    const compBottom = y + h;

    // Compartment fill + border
    ctx.fillStyle = idx % 2 === 0 ? '#e8f0e8' : '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.fillStyle = '#000'; ctx.font = '11px Arial';
    ctx.fillText(rect.type, x + 4, y + 13);

    // ------- Shelves (horizontal lines) -------
    if (rect.fittings?.shelves) {
      for (const shelf of rect.fittings.shelves) {
        const shelfY = compBottom - shelf.positionFromFloor * scale;
        ctx.strokeStyle = '#b22222'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, shelfY);
        ctx.lineTo(x + w, shelfY);
        ctx.stroke();
      }
    }

    // ------- Drawers (simplified rectangles near bottom) -------
    if (rect.fittings?.drawers) {
      for (const drawer of rect.fittings.drawers) {
        const dw = drawer.outerWidth * scale * 0.8;
        const dh = drawer.outerHeight * scale * 0.8;
        const dx = x + (w - dw) / 2;
        const dy = compBottom - dh - 5 * scale;
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
        ctx.strokeRect(dx, dy, dw, dh);
      }
    }

    // ------- Door bins (on the right interior wall) -------
    const doorBins = rect.fittings?.doorBins;
    if (doorBins && doorBins.length > 0) {
      const binW = 12; // visual width of a bin (mm equivalent scaled down)
      const gap   = 4 * scale; // spacing between bins
      const totalBinsHeight = doorBins.reduce((sum, b) => sum + b.outerHeight * scale, 0)
                            + (doorBins.length - 1) * gap;

      let startY = y + (h - totalBinsHeight) / 2; // center bins vertically in compartment
      if (startY < y) startY = y + 2 * scale;     // avoid overflow

      for (const bin of doorBins) {
        const bh = bin.outerHeight * scale;
        const bx = x + w - binW;          // anchored to right wall
        const by = startY;

        // Bin body (grey)
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(bx, by, binW, bh);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, binW, bh);

        // Label
        if (bh > 10) {
          ctx.fillStyle = '#fff';
          ctx.font = `${Math.min(bh - 2, 8)}px Arial`;
          ctx.fillText('DB', bx + 1, by + bh / 2 + 2);
        }

        startY += bh + gap;
      }
    }
  });

  ctx.restore();
}