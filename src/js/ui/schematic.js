// src/js/ui/schematic.js

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
  const { H, D, Hb, Db1, Db2 } = geometry;
  const w = effectiveWalls;   // { top, bottom, left, right, rear, door }

  const PAD = { left: 40, top: 20, right: 20, bottom: 20 };
  const drawW = canvas.width - PAD.left - PAD.right;
  const drawH = canvas.height - PAD.top - PAD.bottom;
  const scale = Math.min(drawW / D, drawH / H);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(PAD.left, PAD.top);

  // -------------------- Outer cabinet (thick line) --------------------
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, D * scale, H * scale);

  // -------------------- Coordinate helpers (mm) --------------------
  const innerRear   = w.rear;                     // inner rear wall x
  const innerDoor   = D - w.door;                 // inner door wall x
  const innerTop    = w.top;                      // inner top y

  const floorLowerY   = H - w.bottom;             // inner floor at door side
  const floorRaisedY  = H - Hb - w.bottom;        // inner floor over compressor

  const compTopX    = w.rear + Db1;               // top‑right of compressor (x)
  const compFootX   = w.rear + Db2;               // foot of sloped face (x)

  // -------------------- Insulation area (fill light grey) ----------------
  ctx.beginPath();
  // Outer border (clockwise)
  ctx.rect(0, 0, D * scale, H * scale);
  // Inner cavity polygon (reverse winding to cut out a hole)
  ctx.moveTo(innerRear * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, floorLowerY * scale);
  ctx.lineTo(compFootX * scale, floorLowerY * scale);
  ctx.lineTo(compTopX * scale, floorRaisedY * scale);
  ctx.lineTo(innerRear * scale, floorRaisedY * scale);
  ctx.closePath();
  ctx.fillStyle = '#f0f0f0';   // light grey for insulation
  ctx.fill();

  // -------------------- Inner cavity (white fill, blue outline) --------
  ctx.beginPath();
  ctx.moveTo(innerRear * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, innerTop * scale);
  ctx.lineTo(innerDoor * scale, floorLowerY * scale);
  ctx.lineTo(compFootX * scale, floorLowerY * scale);
  ctx.lineTo(compTopX * scale, floorRaisedY * scale);
  ctx.lineTo(innerRear * scale, floorRaisedY * scale);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#0066cc'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // -------------------- Compressor box (grey) ---------------------------
  ctx.beginPath();
  ctx.moveTo(0, H * scale);                            // bottom‑left (outer rear)
  ctx.lineTo(0, floorRaisedY * scale);                 // top‑left (external rear)
  ctx.lineTo(compTopX * scale, floorRaisedY * scale);  // top‑right (insulated – will be overwritten by cavity but draw for clarity)
  ctx.lineTo(compFootX * scale, floorLowerY * scale);  // bottom of slope (insulated)
  ctx.lineTo(compFootX * scale, H * scale);            // bottom‑right (external)
  ctx.closePath();
  ctx.fillStyle = '#d0d0d0';
  ctx.fill();
  ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#000'; ctx.font = '10px Arial';
  ctx.fillText('Comp.', 4, floorRaisedY * scale + 12);

  // -------------------- Wall labels (optional) -------------------------
  ctx.font = '9px Arial'; ctx.fillStyle = '#000';
  ctx.fillText('rear', (w.rear/2 - 10) * scale, H/2 * scale);
  ctx.fillText('door', (D - w.door/2) * scale, H/2 * scale);
  ctx.fillText('top', D/2 * scale, w.top/2 * scale);
  ctx.fillText('bottom', D/2 * scale, H - w.bottom/2 * scale);

  ctx.restore();
}