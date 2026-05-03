export function drawSchematic(leaves, config, canvas, tooltipDiv) {
  const ctx = canvas.getContext('2d');
  const { external, wallThicknesses: w } = config.cabinet;

  const PAD = { left: 50, top: 30, right: 30, bottom: 30 };
  const drawW = canvas.width  - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top  - PAD.bottom;
  const scale = Math.min(drawW / external.width, drawH / external.height);

  const extW = external.width  * scale;
  const extH = external.height * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // Outer cabinet
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, extW, extH);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, extW, extH);

  // Internal cavity outline
  const intLeft   = w.left  * scale;
  const intRight  = extW - w.right * scale;
  const intTop    = w.top   * scale;
  const intBottom = extH - w.bottom * scale;
  const intW = intRight - intLeft;
  const intH = intBottom - intTop;

  ctx.strokeStyle = '#00a'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.strokeRect(intLeft, intTop, intW, intH);
  ctx.setLineDash([]);

  if (!leaves || leaves.length === 0) {
    ctx.restore();
    return;
  }

  // Compute leaf rectangles (internal coordinates)
  const internalW = external.width  - w.left - w.right;
  const internalH = external.height - w.top  - w.bottom;
  const rootSpace = { x: 0, y: 0, width: internalW, height: internalH };
  const leafRects = [];

  function traverse(node, space, leafIdxAcc = { idx: 0 }) {
    if (node.nodeType === 'leaf') {
      leafRects.push({ ...space, fittings: node.fittings, type: node.type, leafIdx: leafIdxAcc.idx });
      leafIdxAcc.idx++;
    } else if (node.nodeType === 'horizontal') {
      const { children, dividers } = node;
      const totalDivThick = dividers.reduce((s, d) => s + d.thickness, 0);
      const usableH = space.height - totalDivThick;
      let yOffset = space.y;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        let childH = (child.heightMode === 'ratio') ? usableH * child.heightValue : child.heightValue;
        traverse(child.node, { x: space.x, y: yOffset, width: space.width, height: childH }, leafIdxAcc);
        yOffset += childH;
        if (i < dividers.length) yOffset += dividers[i].thickness;
      }
    } else if (node.nodeType === 'vertical') {
      const { dividerThickness, leftWidthRatio, left, right } = node;
      const usableW = space.width - dividerThickness;
      const leftW = usableW * leftWidthRatio;
      const rightW = usableW * (1 - leftWidthRatio);
      traverse(left,  { x: space.x, y: space.y, width: leftW, height: space.height }, leafIdxAcc);
      traverse(right, { x: space.x + leftW + dividerThickness, y: space.y, width: rightW, height: space.height }, leafIdxAcc);
    }
  }
  traverse(config.cabinet.layout, rootSpace);

  const hitRegions = [];

  // Draw compartments and fittings
  leafRects.forEach((rect) => {
    const x = intLeft + rect.x * scale;
    const y = intTop  + rect.y * scale;
    const w = rect.width  * scale;
    const h = rect.height * scale;
    const compBottom = y + h;
    const leafData = leaves[rect.leafIdx];

    // Compartment background
    ctx.fillStyle = rect.leafIdx % 2 === 0 ? '#e8f0e8' : '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#000'; ctx.font = '11px Arial';
    ctx.fillText(rect.type, x + 4, y + 13);

    hitRegions.push({
      rect: { x, y, w, h },
      label: `Compartment: ${rect.type}`,
      info: leafData ? 
        `W×D×H: ${rect.width.toFixed(0)}×${leafData.space.depth.toFixed(0)}×${rect.height.toFixed(0)} mm\n` +
        `Gross: ${leafData.gross.toFixed(2)} L\nEG Net: ${leafData.egNet.toFixed(2)} L\nIEC Net: ${leafData.iecNet.toFixed(2)} L`
        : 'No data'
    });

    // Shelves (respecting optional width)
    if (rect.fittings?.shelves) {
      for (const shelf of rect.fittings.shelves) {
        const shelfY = compBottom - shelf.positionFromFloor * scale;
        const shelfW = (shelf.width !== null) ? shelf.width * scale : w;
        const shelfX = x + (w - shelfW) / 2;   // centre if narrower than full width
        ctx.strokeStyle = '#b22222'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(shelfX, shelfY);
        ctx.lineTo(shelfX + shelfW, shelfY);
        ctx.stroke();
        hitRegions.push({
          rect: { x: shelfX, y: shelfY - 2, w: shelfW, h: 4 },
          label: 'Shelf',
          info: `Pos: ${shelf.positionFromFloor} mm\nThick: ${shelf.thickness} mm\nDepth: ${shelf.depth} mm` +
                (shelf.width ? `\nWidth: ${shelf.width} mm` : '\nFull width')
        });
      }
    }

    // Drawers (grouped by position, side‑by‑side)
    const drawers = rect.fittings?.drawers;
    if (drawers && drawers.length > 0) {
      const groups = {};
      drawers.forEach(d => {
        const pos = d.positionFromFloor ?? 0;
        if (!groups[pos]) groups[pos] = [];
        groups[pos].push(d);
      });
      Object.keys(groups).sort((a,b) => parseFloat(a)-parseFloat(b)).forEach(pos => {
        const group = groups[pos];
        const posNum = parseFloat(pos);
        const totalOuterW = group.reduce((sum, d) => sum + d.outerWidth, 0);
        let groupScale = scale;
        if (totalOuterW * scale > w - 10) groupScale = (w - 10) / totalOuterW;
        let xOffset = x + 5;
        const baseY = compBottom - posNum * scale; // bottom edge of drawer
        group.forEach(d => {
          const dw = d.outerWidth * groupScale;
          const dh = d.outerHeight * groupScale;
          const dy = baseY - dh; // top edge
          ctx.fillStyle = '#d4a373';
          ctx.fillRect(xOffset, dy, dw, dh);
          ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
          ctx.strokeRect(xOffset, dy, dw, dh);
          hitRegions.push({
            rect: { x: xOffset, y: dy, w: dw, h: dh },
            label: 'Drawer',
            info: `Pos: ${posNum} mm\nOuter: ${d.outerWidth}×${d.outerDepth}×${d.outerHeight} mm\nWall: ${d.wallThickness} mm`
          });
          xOffset += dw + 2;
        });
      });
    }
  });

  // ---------- Draw closed transparent door & bins ----------
  // Draw door overlay over the entire internal cavity
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#aaccff';
  ctx.fillRect(intLeft, intTop, intW, intH);
  ctx.restore();
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
  ctx.strokeRect(intLeft, intTop, intW, intH);
  ctx.fillStyle = '#000'; ctx.font = '10px Arial';
  
  // Draw door bins as transparent rectangles spanning full compartment width
  leafRects.forEach((rect) => {
    const x = intLeft + rect.x * scale;
    const y = intTop  + rect.y * scale;
    const w = rect.width  * scale;
    const h = rect.height * scale;
    const bins = rect.fittings?.doorBins;
    if (!bins || bins.length === 0) return;

    const totalBinsHeight = bins.reduce((sum, b) => sum + b.outerHeight * scale, 0);
    const gap = 3 * scale;
    const totalStackH = totalBinsHeight + (bins.length - 1) * gap;
    let startY = y + (h - totalStackH) / 2; // centre vertically
    if (startY < y) startY = y + 2;

    for (const bin of bins) {
      const bh = bin.outerHeight * scale;
      const bx = x;
      const bw = w;                       // full width
      const by = startY;

      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5;
      ctx.strokeRect(bx, by, bw, bh);

      hitRegions.push({
        rect: { x: bx, y: by, w: bw, h: bh },
        label: 'Door Bin',
        info: `Outer: ${bin.outerWidth}×${bin.outerHeight}×${bin.outerDepth} mm\nWall: ${bin.wallThickness} mm`
      });
      startY += bh + gap;
    }
  });

  ctx.restore();

  // ---------- Tooltip hover handling ----------
  if (canvas._schematicMouseMove) {
    canvas.removeEventListener('mousemove', canvas._schematicMouseMove);
  }
  canvas._schematicMouseMove = (e) => {
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    const mouseCanvasX = (e.clientX - canvasRect.left) * scaleX - PAD.left;
    const mouseCanvasY = (e.clientY - canvasRect.top)  * scaleY - PAD.top;

    let bestRegion = null;
    let bestArea = Infinity;

    // Find all matching hit regions and pick the smallest one
    for (const region of hitRegions) {
      if (mouseCanvasX >= region.rect.x && mouseCanvasX <= region.rect.x + region.rect.w &&
          mouseCanvasY >= region.rect.y && mouseCanvasY <= region.rect.y + region.rect.h) {
        const area = region.rect.w * region.rect.h;
        if (area < bestArea) {
          bestRegion = region;
          bestArea = area;
        }
      }
    }

    if (bestRegion) {
      tooltipDiv.classList.remove('hidden');
      tooltipDiv.innerHTML = `<strong>${bestRegion.label}</strong><br>${bestRegion.info.replace(/\n/g, '<br>')}`;
      const panelRect = document.querySelector('.right-panel').getBoundingClientRect();
      let left = e.clientX - panelRect.left + 15;
      let top  = e.clientY - panelRect.top + 15;
      const tw = tooltipDiv.offsetWidth;
      const th = tooltipDiv.offsetHeight;
      if (left + tw > panelRect.width) left = left - tw - 30;
      if (top + th > panelRect.height) top = top - th - 30;
      tooltipDiv.style.left = left + 'px';
      tooltipDiv.style.top  = top + 'px';
    } else {
      tooltipDiv.classList.add('hidden');
    }
  };
  canvas.addEventListener('mousemove', canvas._schematicMouseMove);
}