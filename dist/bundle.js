(() => {
  // src/js/settings.js
  var DEFAULTS = {
    mm3ToL: 1e-6,
    lToCuft: 0.0353147,
    displayPrecisionL: 2,
    displayPrecisionCuft: 3,
    canvasWidth: 600,
    canvasHeight: 800,
    autoCalculate: false,
    showDirtyOverlay: true,
    evaporator: {
      width_mm: 460,
      height_mm: 150,
      depth_mm: 60,
      rows: 7,
      layers: 2,
      tubeOD_mm: 8,
      finPitch_mm: 4,
      finHeight_mm: 150,
      finLength_mm: 460,
      numFins: 32,
      sidePlateNo: 0
    },
    fanParam: {
      tipDiam_mm: 110,
      fanRPM: 2200,
      hubDiam_mm: 45.6,
      PitchAngle_degree: 30
    }
  };
  var STORAGE_KEY = "refrigerator-calc-settings";
  function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULTS, parsed);
      }
    } catch (e) {
    }
    return { ...DEFAULTS };
  }
  function saveToStorage(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
  var settings = loadSettings();
  function updateSettings(newSettings) {
    Object.assign(settings, newSettings);
    saveToStorage(settings);
    document.dispatchEvent(new CustomEvent("settings-changed", { detail: settings }));
  }
  function resetSettings() {
    Object.assign(settings, DEFAULTS);
    saveToStorage(settings);
    document.dispatchEvent(new CustomEvent("settings-changed", { detail: settings }));
  }

  // src/js/engine/calc.js
  function formatLeafDisplay(leaf) {
    return {
      gross: roundForDisplay(leaf.gross, "L"),
      grossCuft: roundForDisplay(toCuft(leaf.gross), "cuft")
    };
  }
  function formatTotalsDisplay(totals) {
    return {
      gross: roundForDisplay(totals.gross, "L"),
      grossCuft: roundForDisplay(toCuft(totals.gross), "cuft")
    };
  }
  function toCuft(litres) {
    return litres * settings.lToCuft;
  }
  function roundForDisplay(val, unit) {
    const precision = unit === "cuft" ? settings.displayPrecisionCuft : settings.displayPrecisionL;
    return Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision);
  }
  function calcLeafGrossPrecise(leafNode, height, geom, compTopY, isBottommost) {
    const rawType = leafNode.type;
    const wallKey = rawType === "fresh" ? "refrigerator" : rawType;
    const walls = geom.walls[wallKey];
    if (!walls) {
      throw new Error(`Unknown wall type: ${rawType} (mapped to ${wallKey})`);
    }
    const innerW = geom.W - walls.left - walls.right;
    let area;
    const rearX = walls.rear;
    const frontX = geom.D;
    if (!isBottommost) {
      const innerD = frontX - rearX;
      area = height * innerD;
    } else {
      const Hb = geom.Hb;
      const tRb1 = walls.bottom1;
      const tRb2 = walls.bottom2;
      const tRb3 = walls.bottom3;
      const floorRaisedY = geom.H - Hb - tRb1;
      const floorLowerY = geom.H - tRb3;
      const xTopCB = geom.Db1;
      const yTopCB = geom.H - Hb;
      const xBottomCB = geom.Db2;
      const yBottomCB = geom.H;
      const cbDx = xBottomCB - xTopCB;
      const cbDy = yBottomCB - yTopCB;
      const cbLen = Math.sqrt(cbDx * cbDx + cbDy * cbDy);
      let slopeStartX, slopeEndX;
      if (cbLen === 0) {
        slopeStartX = xTopCB + tRb2;
        slopeEndX = slopeStartX;
      } else {
        const nx = cbDy / cbLen;
        const ny = -cbDx / cbLen;
        const px = xTopCB + nx * tRb2;
        const py = yTopCB + ny * tRb2;
        const tStart = (floorRaisedY - py) / cbDy;
        slopeStartX = px + cbDx * tStart;
        const tEnd = (floorLowerY - py) / cbDy;
        slopeEndX = px + cbDx * tEnd;
      }
      const poly = [
        [rearX, compTopY],
        [frontX, compTopY],
        [frontX, floorLowerY],
        [slopeEndX, floorLowerY],
        [slopeStartX, floorRaisedY],
        [rearX, floorRaisedY]
      ];
      area = polygonArea(poly);
    }
    const volumeL = area * innerW * settings.mm3ToL;
    return {
      leafId: leafNode.id,
      gross: volumeL
    };
  }
  function polygonArea(vertices) {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = vertices[i];
      const [x2, y2] = vertices[(i + 1) % n];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
  }

  // src/js/io/io.js
  var SCHEMA_VERSION = "2.0";
  var ACCEPTED_VERSIONS = /* @__PURE__ */ new Set(["1.0", "2.0"]);
  function configToJSON(config, name) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const out = {
      ...config,
      schemaVersion: SCHEMA_VERSION,
      meta: {
        name: name ?? config.meta?.name ?? "Untitled",
        createdAt: config.meta?.createdAt ?? now,
        updatedAt: now
      }
    };
    return JSON.stringify(out, null, 2);
  }
  function downloadConfigJSON(config, filename) {
    if (typeof document === "undefined") return;
    const json = configToJSON(config);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `${config.meta?.name ?? "config"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function configFromJSON(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    if (!parsed.schemaVersion) {
      throw new Error("Missing schemaVersion in config file.");
    }
    if (!ACCEPTED_VERSIONS.has(parsed.schemaVersion)) {
      throw new Error(
        `Unsupported schema version v${parsed.schemaVersion}. Accepted: ${[...ACCEPTED_VERSIONS].join(", ")}.`
      );
    }
    if (!parsed.cabinet?.layout) {
      throw new Error("Config file is missing cabinet.layout.");
    }
    return parsed;
  }
  function loadConfigFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(configFromJSON(e.target.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsText(file);
    });
  }
  function resultToCSV(result, configName) {
    if (!result.leaves || !result.totals) {
      return "# No results available (calculation produced errors)\n";
    }
    const rows = [];
    rows.push(`# Refrigerator Net Storage Volume Calculator`);
    rows.push(`# Configuration: ${configName ?? "Unnamed"}`);
    rows.push(`# Generated: ${(/* @__PURE__ */ new Date()).toISOString()}`);
    rows.push("");
    rows.push([
      "Compartment",
      "Gross (L)",
      "Gross (cu.ft)"
    ].join(","));
    for (let i = 0; i < result.leaves.length; i++) {
      const leaf = result.leaves[i];
      const d = formatLeafDisplay(leaf);
      rows.push([
        `Compartment ${i + 1}`,
        d.gross,
        d.grossCuft
      ].join(","));
    }
    const t = formatTotalsDisplay(result.totals);
    rows.push([
      "TOTAL",
      t.gross,
      t.grossCuft
    ].join(","));
    if (result.warnings.length > 0) {
      rows.push("");
      rows.push("# Warnings");
      for (const w of result.warnings) {
        rows.push(`# [${w.rule}] ${w.message}`);
      }
    }
    return rows.join("\n");
  }
  function downloadResultsCSV(result, configName, filename) {
    if (typeof document === "undefined") return;
    const csv = resultToCSV(result, configName);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `${configName ?? "results"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // src/js/ui/schematic.js
  function drawDim(ctx, x1, y1, x2, y2, offset, label, {
    color = DRAW_THEME.color,
    lineWidth = DRAW_THEME.lineWidth,
    arrowSize = DRAW_THEME.arrowSize,
    font = DRAW_THEME.font,
    textOffsetX = 0,
    textOffsetY = 0,
    drawExtLines = true,
    bgColor = DRAW_THEME.bgColor
  } = {}) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len;
    const ny = dx / len;
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
      const extEnd = offset + Math.sign(offset) * 4;
      ctx.moveTo(x1 + nx * extStart, y1 + ny * extStart);
      ctx.lineTo(x1 + nx * extEnd, y1 + ny * extEnd);
      ctx.moveTo(x2 + nx * extStart, y2 + ny * extStart);
      ctx.lineTo(x2 + nx * extEnd, y2 + ny * extEnd);
      ctx.stroke();
    }
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
      let textAngle = angle;
      if (textAngle > Math.PI / 2 + 0.01) textAngle -= Math.PI;
      else if (textAngle < -Math.PI / 2 + 0.01) textAngle += Math.PI;
      if (Math.abs(textAngle - Math.PI / 2) < 0.01) textAngle = -Math.PI / 2;
      ctx.rotate(textAngle);
      ctx.font = font;
      const metrics = ctx.measureText(label);
      const tw = metrics.width;
      const th = 10;
      const padX = 4;
      const padY = 2;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-tw / 2 - padX, -th / 2 - padY, tw + padX * 2, th + padY * 2, 3);
      } else {
        ctx.fillRect(-tw / 2 - padX, -th / 2 - padY, tw + padX * 2, th + padY * 2);
      }
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 0);
    }
    ctx.restore();
  }
  var DRAW_THEME = {
    color: "#4c7df5",
    lineWidth: 1,
    arrowSize: 5,
    font: '11px "Segoe UI", Arial, sans-serif',
    bgColor: "#ffffff",
    textGap: 0
  };
  function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves, options = {}) {
    const ctx = canvas.getContext("2d");
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
      innerBottomY = 0
    } = options;
    const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const scale = Math.min(drawW / W, drawH / H);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(PAD.left, PAD.top);
    const innerLeft = compartments.map((c) => c.left);
    const innerRight = compartments.map((c) => W - c.right);
    const intTop = effectiveWalls.top;
    const intBottom = H - effectiveWalls.bottom;
    const tRbottom1 = walls.refrigerator?.bottom1 || 0;
    const floorRaisedY = H - Hb - tRbottom1;
    ctx.beginPath();
    ctx.rect(0, 0, W * scale, H * scale);
    let y = intTop;
    for (let i = 0; i < compHeights.length; i++) {
      const h = compHeights[i];
      const leftX = innerLeft[i] * scale;
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
    ctx.fillStyle = "#f0f0f0";
    ctx.fill();
    const types = leaves ? leaves.map((l) => l.leafType) : [];
    y = intTop;
    for (let i = 0; i < compHeights.length; i++) {
      const h = compHeights[i];
      const leftX = innerLeft[i] * scale;
      const rightX = innerRight[i] * scale;
      const compY = y * scale;
      const compH = h * scale;
      ctx.fillStyle = i === 0 ? "#e8f0e8" : "#ffffff";
      ctx.fillRect(leftX, compY, rightX - leftX, compH);
      ctx.strokeStyle = "#999";
      ctx.strokeRect(leftX, compY, rightX - leftX, compH);
      ctx.fillStyle = "#000";
      ctx.font = "12px Arial";
      if (types[i]) ctx.fillText(types[i], leftX + 4, compY + 16);
      y += h;
      if (i < compHeights.length - 1 && dividerThickness > 0) {
        const dividerY = y * scale;
        const dividerH = dividerThickness * scale;
        ctx.fillStyle = "#aaa";
        ctx.fillRect(leftX, dividerY, rightX - leftX, dividerH);
        ctx.strokeStyle = "#666";
        ctx.strokeRect(leftX, dividerY, rightX - leftX, dividerH);
        y += dividerThickness;
      }
    }
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
          const spacing = usableH * scale / (n + 1);
          for (let s = 1; s <= n; s++) {
            const shelfYpx = compY + spacing * s;
            ctx.beginPath();
            ctx.moveTo(innerLeft[i] * scale, shelfYpx);
            ctx.lineTo(innerRight[i] * scale, shelfYpx);
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#666";
            ctx.stroke();
            const railW = railWidth * scale;
            const railH = railHeight * scale;
            const leftRailX = innerLeft[i] * scale;
            ctx.fillStyle = "#aaa";
            ctx.fillRect(leftRailX, shelfYpx, railW, railH);
            ctx.strokeStyle = "#333";
            ctx.strokeRect(leftRailX, shelfYpx, railW, railH);
            const rightRailX = innerRight[i] * scale - railW;
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
        const fittingsForLeaf = fittings.find((f) => f.leafId === leaves[i]?.leafId);
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
            ctx.fillStyle = "#bbbbbb";
            ctx.fillRect(
              (effectiveWalls.left + 10) * scale,
              yy - 1,
              (internalWidth - 20) * scale,
              3
            );
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
            ctx.strokeStyle = "#555";
            ctx.lineWidth = 2;
            ctx.strokeRect(xx, yy, drawerWidth, drawerHeight);
            ctx.fillStyle = "#e0e0e0";
            ctx.fillRect(xx, yy, drawerWidth, drawerHeight);
          }
        }
        yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
      }
    }
    let freshIdx = -1;
    if (numCompartments === 1) {
      freshIdx = 0;
    } else {
      freshIdx = compartmentTypes.findIndex((t) => t === "fresh");
    }
    let freshTopY = 0, freshHeight = 0;
    if (freshIdx >= 0) {
      const compartmentHeight = freshHeight;
      const freshCompTop = freshTopY;
      const freshCompBottom = freshTopY + compartmentHeight;
      const placeAtTop = numCompartments === 1 || freshIdx > 0;
      const availableRearH = placeAtTop ? Math.max(0, Math.min(compartmentHeight, floorRaisedY - freshTopY)) : compartmentHeight;
      const effectiveCtrlH = Math.min(ctrlBoxH, availableRearH);
      const effectiveRShowerH = Math.max(0, Math.min(rshowerH, availableRearH - effectiveCtrlH));
      const ctrlBoxW_px = ctrlBoxW * scale;
      const rshowerW_px = rshowerW * scale;
      const ctrlBoxH_px = effectiveCtrlH * scale;
      const rshowerH_px = effectiveRShowerH * scale;
      let currentY = placeAtTop ? freshCompTop * scale : freshCompBottom * scale;
      if (effectiveCtrlH > 0 && ctrlBoxW > 0) {
        const ctrlBoxY = placeAtTop ? currentY : currentY - ctrlBoxH_px;
        const ctrlBoxX = (W / 2 - ctrlBoxW / 2) * scale;
        drawBox(
          ctrlBoxX,
          ctrlBoxY,
          ctrlBoxW_px,
          ctrlBoxH_px,
          "Ctrl Box",
          "rgba(255, 200, 0, 0.3)",
          "#aa6600"
        );
        currentY = placeAtTop ? ctrlBoxY + ctrlBoxH_px : ctrlBoxY;
      }
      if (effectiveRShowerH > 0 && rshowerW > 0) {
        const rshowerY = placeAtTop ? currentY : currentY - rshowerH_px;
        const rshowerX = (W / 2 - rshowerW / 2) * scale;
        drawBox(
          rshowerX,
          rshowerY,
          rshowerW_px,
          rshowerH_px,
          "R-Shower",
          "rgba(0, 200, 255, 0.3)",
          "#0066aa"
        );
      }
    }
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W * scale, H * scale);
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
    ctx.strokeStyle = "#e67e22";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(innerLeft[compIdx] * scale, hbY);
    ctx.lineTo(innerRight[compIdx] * scale, hbY);
    ctx.stroke();
    ctx.restore();
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
  function drawSideView(canvas, geometry, effectiveWalls, options = {}) {
    const ctx = canvas.getContext("2d");
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
      compartmentTypes = []
    } = options;
    let ctrlBoxFrontX = null, ctrlBoxTop = null, ctrlBoxBottom = null;
    let rshowerFrontX = null, rshowerTop = null, rshowerBottom = null;
    const tTop = effectiveWalls.top;
    const tDoor = effectiveWalls.door;
    const tRbottom1 = walls.refrigerator.bottom1;
    const tRbottom2 = walls.refrigerator.bottom2;
    const tRbottom3 = walls.refrigerator.bottom3;
    const compRear = compartments.map((c) => c.rear);
    const PAD = { left: 60, top: 40, right: 60, bottom: 40 };
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const scale = Math.min(drawW / D, drawH / H);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(PAD.left, PAD.top);
    const innerDoor = D;
    const innerTop = tTop;
    const floorLowerY = H - tRbottom3;
    const floorRaisedY = H - Hb - tRbottom1;
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
    if (compHeights.length === 1) {
      ctx.fillStyle = "#f0f0f0";
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
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0066cc";
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
      ctx.fillStyle = "#f0f0f0";
      ctx.fill();
      ctx.beginPath();
      ctx.rect(topRearX, topY, innerDoor * scale - topRearX, topCompH);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0066cc";
      ctx.stroke();
      const bottomH = compHeights[1];
      const bottomRearX = compRear[1] * scale;
      const bottomY = (innerTop + topH + dividerThickness) * scale;
      const bottomCompH = bottomH * scale;
      ctx.beginPath();
      ctx.rect(0, bottomY, D * scale, bottomCompH);
      ctx.fillStyle = "#f0f0f0";
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
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0066cc";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, H * scale);
    ctx.lineTo(0, yTopCB * scale);
    ctx.lineTo(xTopCB * scale, yTopCB * scale);
    ctx.lineTo(xBottomCB * scale, yBottomCB * scale);
    ctx.closePath();
    ctx.fillStyle = "#ddd";
    ctx.fill();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("Comp.", 6, yTopCB * scale + 14);
    let drawnDoors = [];
    if (compHeights.length === 2 && dividerThickness > 0) {
      const dividerY = innerTop + compHeights[0];
      const dividerH = dividerThickness;
      const dividerLeftX = compRear[1] * scale;
      ctx.fillStyle = "#aaa";
      ctx.fillRect(
        dividerLeftX,
        dividerY * scale,
        (innerDoor - compRear[1]) * scale,
        dividerH * scale
      );
      ctx.strokeStyle = "#666";
      ctx.strokeRect(
        dividerLeftX,
        dividerY * scale,
        (innerDoor - compRear[1]) * scale,
        dividerH * scale
      );
      const topDoorTop = 0;
      const topDoorBottom = (dividerY + dividerH / 2) * scale - doorGap / 2 * scale;
      const bottomDoorTop = (dividerY + dividerH / 2) * scale + doorGap / 2 * scale;
      const bottomDoorBottom = H * scale;
      drawnDoors.push({ top: topDoorTop, bottom: topDoorBottom, compIndex: 0 });
      drawnDoors.push({ top: bottomDoorTop, bottom: bottomDoorBottom, compIndex: 1 });
      drawDim(
        ctx,
        D * scale,
        topDoorBottom,
        D * scale,
        bottomDoorTop,
        -45,
        `door gap: ${(dividerThickness + doorGap).toFixed(0)}`
      );
    } else {
      drawnDoors.push({ top: 0, bottom: H * scale, compIndex: 0 });
    }
    for (const door of drawnDoors) {
      const compIdx = door.compIndex;
      const doorThickness = compartments[compIdx] && compartments[compIdx].door != null ? compartments[compIdx].door : effectiveWalls.door || 60;
      const doorLeftX = D * scale;
      const doorWidth = doorThickness * scale;
      ctx.fillStyle = "rgba(173, 216, 230, 0.5)";
      ctx.fillRect(doorLeftX, door.top, doorWidth, door.bottom - door.top);
      ctx.strokeStyle = "#555";
      ctx.strokeRect(doorLeftX, door.top, doorWidth, door.bottom - door.top);
    }
    for (const door of drawnDoors) {
      const compIdx = door.compIndex;
      const doorThickness = compartments[compIdx] && compartments[compIdx].door != null ? compartments[compIdx].door : effectiveWalls.door || 60;
      const doorMidY = (door.top + door.bottom) / 2.5;
      drawDim(
        ctx,
        (D - doorThickness) * scale,
        doorMidY,
        D * scale,
        doorMidY,
        0,
        `tDoor: ${doorThickness.toFixed(0)}`
      );
    }
    for (const door of drawnDoors) {
      const compIdx = door.compIndex;
      const doorThickness = compartments[compIdx] && compartments[compIdx].door != null ? compartments[compIdx].door : effectiveWalls.door || 60;
      const dimX = (D + doorThickness) * scale + 15;
      drawDim(
        ctx,
        dimX,
        door.top,
        dimX,
        door.bottom,
        0,
        `Door: ${((door.bottom - door.top) / scale).toFixed(0)}`
      );
    }
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
        ctx.fillStyle = "rgba(173, 216, 230, 0.5)";
        ctx.fill();
        ctx.strokeStyle = "#555";
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
    const isFreezer = (i) => compartmentTypes[i] === "freezer";
    let freshCompIdx = -1, freshTopWorld = 0, freshBottomWorld = 0;
    if (compHeights.length === 1) {
      freshCompIdx = 0;
      freshTopWorld = innerTopY;
      freshBottomWorld = innerBottomY;
    } else {
      freshCompIdx = compartmentTypes.findIndex((t) => t === "fresh");
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
    if (freshCompIdx >= 0) {
      const rearX = compRear[freshCompIdx];
      const freshHeight = freshBottomWorld - freshTopWorld;
      const isTopFreezer = freshCompIdx > 0;
      const placeAtTop = compHeights.length === 1 || isTopFreezer;
      const offsetRearX = compHeights.length === 1 && evapDepth > 0 ? rearX + evapDepth : rearX;
      const availableRearH = placeAtTop ? Math.max(0, Math.min(freshHeight, floorRaisedY - freshTopWorld)) : freshHeight;
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
        ctx.fillStyle = "rgba(255, 200, 0, 0.3)";
        ctx.fillRect(boxX, boxTop * scale, boxW, boxH);
        ctx.strokeStyle = "#aa6600";
        ctx.strokeRect(boxX, boxTop * scale, boxW, boxH);
        ctx.fillStyle = "#333";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Ctrl Box", boxX + boxW / 2, boxTop * scale + boxH / 2 + 3);
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
        ctx.fillStyle = "rgba(0, 200, 255, 0.3)";
        ctx.fillRect(boxX, boxTop * scale, boxW, boxH);
        ctx.strokeStyle = "#0066aa";
        ctx.strokeRect(boxX, boxTop * scale, boxW, boxH);
        ctx.fillStyle = "#333";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("R-Shower", boxX + boxW / 2, boxTop * scale + boxH / 2 + 3);
        rshowerFrontX = offsetRearX + rshowerL;
        rshowerTop = boxTop;
        rshowerBottom = boxTop + rshowerH_eff;
      }
    }
    if (numCompartments === 1 && evapDepth > 0) {
      const rearX = compRear[0];
      const evapX = (rearX + evapDepth) * scale;
      ctx.save();
      ctx.strokeStyle = "#cc0000";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(evapX, innerTopY * scale);
      ctx.lineTo(evapX, floorRaisedY * scale);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#cc0000";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Evap", evapX, innerTopY * scale + 10);
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
          ctx.strokeStyle = "#cc0000";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(evapX, compTopY * scale);
          ctx.lineTo(evapX, compBottomY * scale);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = "#cc0000";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Evap", evapX, compTopY * scale + 10);
        }
        yOffset += compHeights[i];
        if (i < compHeights.length - 1) yOffset += dividerThickness;
      }
    }
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
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#666";
            ctx.stroke();
            const railStartXWorld = evapDepth > 0 && (numCompartments === 1 || isFreezer(i)) ? compRear[i] + evapDepth : compRear[i];
            const usableDepthWorld = doorX - railStartXWorld;
            const railDepthPx = railDepthPct / 100 * usableDepthWorld * scale;
            const railH = railHeight * scale;
            const railY = shelfYpx;
            ctx.fillStyle = "#aaa";
            ctx.fillRect(railStartXWorld * scale, railY, railDepthPx, railH);
            ctx.strokeStyle = "#333";
            ctx.strokeRect(railStartXWorld * scale, railY, railDepthPx, railH);
          }
        }
        yOffset += compH + (i < compHeights.length - 1 ? dividerThickness : 0);
      }
    }
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, D * scale, H * scale);
    drawDim(ctx, 0, H * scale, 0, 0, -60, `H: ${H.toFixed(0)}`);
    drawDim(ctx, 0, H * scale, 0, (floorRaisedY + tRbottom1) * scale, -35, `Hb: ${Hb.toFixed(0)}`);
    drawDim(ctx, 0, yTopCB * scale, xTopCB * scale, yTopCB * scale, -15, `Db1: ${Db1.toFixed(0)}`);
    drawDim(ctx, 0, yBottomCB * scale, xBottomCB * scale, yBottomCB * scale, -15, `Db2: ${Db2.toFixed(0)}`);
    drawDim(ctx, 0, 0, D * scale, 0, -25, `D: ${D.toFixed(0)}`);
    const topMidX = (compRear[0] + innerDoor) / 2 * scale;
    drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, `tTop: ${tTop.toFixed(0)}`);
    for (let i = 0; i < compHeights.length; i++) {
      if (i === 0 || compRear[i] !== compRear[i - 1]) {
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
      ...drawnDoors.map((d) => {
        const idx = d.compIndex;
        return compartments[idx] && compartments[idx].door != null ? compartments[idx].door : effectiveWalls.door || 60;
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
      drawDim(
        ctx,
        compHeightDimX,
        innerTop * scale,
        compHeightDimX,
        (innerTop + compHeights[0]) * scale,
        0,
        `h: ${compHeights[0].toFixed(0)}`
      );
    }
  }
  function enableCoordinateTooltip(frontCanvas, sideCanvas, getGeometryFn2) {
    const tooltip = document.getElementById("schematicTooltip");
    function handleClick(canvas, isFront) {
      canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const pixelX = (e.clientX - rect.left) * scaleX;
        const pixelY = (e.clientY - rect.top) * scaleY;
        const geometry = getGeometryFn2();
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
        tooltip.classList.remove("hidden");
        tooltip.style.left = e.clientX + 10 + "px";
        tooltip.style.top = e.clientY - 30 + "px";
        tooltip.textContent = `X: ${worldX.toFixed(1)} mm, Y: ${worldY.toFixed(1)} mm`;
      });
    }
    handleClick(frontCanvas, true);
    handleClick(sideCanvas, false);
  }

  // src/js/engine/thermo/defaultComponents.js
  var SJ54H_COMPONENTS = Object.freeze({
    compressor: {
      name: "EGX80CLC 100V 50Hz",
      rpm: 2900,
      rpm0: 2900,
      Vc: 11.14,
      // Displacement in cc
      T_suction: 30,
      // Fixed suction temperature (°C)
      volEffCoeffs: {
        // Volumetric efficiency polynomial
        A: 0.9260142251566365,
        B: -0.01221312333322575,
        C: -0.0023789273042382304
      },
      kEtaV: { a: 1, b: 0, c: 0 },
      powerCoeffs: {
        // Input power polynomial
        AW: 135.175,
        BW: 2.6366666666666667,
        CW: 0.975,
        DW: 0.02,
        EW: 0.016666666666666666
      },
      powerKw: { a: 1, b: 0, c: 0 }
    },
    fan: {
      diameter_mm: 100,
      speed_rpm: 2550,
      inputPower_W: 2.1,
      totalAirflow_m3h: 59.5,
      fanAirflow_CFM: 59.5 / 1.699
    },
    electrical: {
      pwbOn_W: 2,
      pwbOff_W: 1,
      defrostHeater_W: 140,
      timerPeriod_h: 10.5,
      defrostOn_min: 20
    },
    condenser: {
      sidePipePitch_mm: 150,
      backPipePitch_mm: 200,
      K_side_kcalhm2C: 5.395,
      K_back_kcalhm2C: 4.17,
      backCondenserEfficiency: 0.7,
      k_RFront1: 0.3405,
      k_RFront2: 0.03322,
      k_FRPartition1: 0.1984,
      k_FRPartition2: 0.1219,
      k_FFront1: 0.3395,
      k_FFront2: 0.0344
    },
    subcool_K: 10,
    dischargeTemp_C: 60,
    evapGeom: {
      evapWidth_mm: 460,
      evapDepth_mm: 60,
      evapArea_m2: 1.754
    },
    initialTE: -25.7
  });
  var SJ_PV73K_COMPONENTS = Object.freeze({
    compressor: {
      name: "DZ90A1X Inverter",
      isInverter: true,
      rpmMin: 1600,
      rpmMax: 4500,
      normalizeRPM: 4320,
      centerTE: -25,
      centerTC: 45,
      refrigerantIndex: 2,
      compressorModel: null,
      // Generated dynamically via ridge regression
      dataPoints: [
        { RPM: 4320, TE: -35, TC: 35, W: 90.3, Q: 126.1 },
        { RPM: 4320, TE: -25, TC: 35, W: 121.1, Q: 188.4 },
        { RPM: 4320, TE: -15, TC: 35, W: 152, Q: 279.7 },
        { RPM: 4320, TE: -35, TC: 45, W: 83.4, Q: 117.5 },
        { RPM: 4320, TE: -25, TC: 45, W: 109.6, Q: 179.8 },
        { RPM: 4320, TE: -15, TC: 45, W: 134, Q: 271 },
        { RPM: 4320, TE: -35, TC: 55, W: 75.8, Q: 108.9 },
        { RPM: 4320, TE: -25, TC: 55, W: 96.9, Q: 171.1 },
        { RPM: 4320, TE: -15, TC: 55, W: 114.5, Q: 262.3 },
        { RPM: 3e3, TE: -35, TC: 35, W: 53.3, Q: 101.7 },
        { RPM: 3e3, TE: -25, TC: 35, W: 68.1, Q: 150.1 },
        { RPM: 3e3, TE: -15, TC: 35, W: 80.5, Q: 220.9 },
        { RPM: 3e3, TE: -35, TC: 45, W: 58.6, Q: 93.1 },
        { RPM: 3e3, TE: -25, TC: 45, W: 77, Q: 141.4 },
        { RPM: 3e3, TE: -15, TC: 45, W: 94.2, Q: 212.3 },
        { RPM: 3e3, TE: -35, TC: 55, W: 63.4, Q: 84.5 },
        { RPM: 3e3, TE: -25, TC: 55, W: 85.1, Q: 132.8 },
        { RPM: 3e3, TE: -15, TC: 55, W: 106.8, Q: 203.7 },
        { RPM: 1620, TE: -35, TC: 35, W: 28.4, Q: 62 },
        { RPM: 1620, TE: -25, TC: 35, W: 36.3, Q: 87.8 },
        { RPM: 1620, TE: -15, TC: 35, W: 42.9, Q: 125.5 },
        { RPM: 1620, TE: -35, TC: 45, W: 31.2, Q: 53.4 },
        { RPM: 1620, TE: -25, TC: 45, W: 41, Q: 79.2 },
        { RPM: 1620, TE: -15, TC: 45, W: 50.2, Q: 116.9 },
        { RPM: 1620, TE: -35, TC: 55, W: 33.8, Q: 44.8 },
        { RPM: 1620, TE: -25, TC: 55, W: 45.4, Q: 70.5 },
        { RPM: 1620, TE: -15, TC: 55, W: 56.9, Q: 108.3 },
        { RPM: 1320, TE: -35, TC: 35, W: 23, Q: 53.3 },
        { RPM: 1320, TE: -25, TC: 35, W: 29.4, Q: 74.2 },
        { RPM: 1320, TE: -15, TC: 35, W: 34.7, Q: 104.7 },
        { RPM: 1320, TE: -35, TC: 45, W: 25.3, Q: 44.7 },
        { RPM: 1320, TE: -25, TC: 45, W: 33.2, Q: 65.6 },
        { RPM: 1320, TE: -15, TC: 45, W: 40.6, Q: 96.1 },
        { RPM: 1320, TE: -35, TC: 55, W: 27.4, Q: 36.1 },
        { RPM: 1320, TE: -25, TC: 55, W: 36.7, Q: 57 },
        { RPM: 1320, TE: -15, TC: 55, W: 46, Q: 87.5 }
      ]
    },
    fan: {
      diameter_mm: 100,
      speed_rpm: 2850,
      inputPower_W: 2.4,
      totalAirflow_m3h: 146.4
    },
    electrical: {
      pwbOn_W: 2,
      pwbOff_W: 1,
      defrostHeater_W: 112,
      timerPeriod_h: 10.5,
      defrostOn_min: 0
    },
    condenser: {
      sidePipePitch_mm: 150,
      backPipePitch_mm: 200,
      K_side_kcalhm2C: 5.395,
      K_back_kcalhm2C: 4.17,
      backCondenserEfficiency: 0.7,
      k_RFront1: 0.3405,
      k_RFront2: 0.03322,
      k_FRPartition1: 0.1984,
      k_FRPartition2: 0.1219,
      k_FFront1: 0.3395,
      k_FFront2: 0.0344
    },
    subcool_K: 10,
    dischargeTemp_C: 60,
    evapGeom: {
      evapWidth_mm: 440.5,
      evapDepth_mm: 58,
      evapArea_m2: 1.2985
    },
    freezerPosition: "bottom",
    initialTE: -22.7
  });
  var INVERTER_EXAMPLE_COMPONENTS = Object.freeze(SJ_PV73K_COMPONENTS);

  // src/js/compressorManager.js
  var DEFAULT_COMPRESSORS = [
    {
      id: "EGX80CLC",
      name: "EGX80CLC 100V 50Hz",
      model: "EGX80CLC",
      voltage: 100,
      frequency: 50,
      cylinderVolumeCm3: SJ54H_COMPONENTS.compressor.cylinderVolumeCm3,
      speedRpm: SJ54H_COMPONENTS.compressor.speedRpm,
      wCoeffs: [
        SJ54H_COMPONENTS.compressor.powerCoeffs.AW,
        SJ54H_COMPONENTS.compressor.powerCoeffs.BW,
        SJ54H_COMPONENTS.compressor.powerCoeffs.CW,
        SJ54H_COMPONENTS.compressor.powerCoeffs.DW,
        SJ54H_COMPONENTS.compressor.powerCoeffs.EW
      ],
      etaCoeffs: [
        SJ54H_COMPONENTS.compressor.volEffCoeffs.A,
        SJ54H_COMPONENTS.compressor.volEffCoeffs.B,
        SJ54H_COMPONENTS.compressor.volEffCoeffs.C
      ],
      // ─── Store original test data ─────────────────
      dataPoints: [
        { TE: -34.4, TC: 37.8, Q: 70.554507 * 1.16279, W: 49.7 },
        { TE: -34.4, TC: 46.1, Q: 67.112824 * 1.16279, W: 51.3 },
        { TE: -34.4, TC: 54.4, Q: 61.950299 * 1.16279, W: 72 },
        { TE: -23.3, TC: 37.8, Q: 129.063122 * 1.16279, W: 67.6 },
        { TE: -23.3, TC: 46.1, Q: 126.48186 * 1.16279, W: 72.4 },
        { TE: -23.3, TC: 54.4, Q: 121.319335 * 1.16279, W: 141 },
        { TE: -12.2, TC: 37.8, Q: 215.105204 * 1.16279, W: 86.2 },
        { TE: -12.2, TC: 46.1, Q: 210.8031 * 1.16279, W: 93.5 },
        { TE: -12.2, TC: 54.4, Q: 203.919733 * 1.16279, W: 237 }
      ]
    },
    {
      id: "DZ90A1X",
      name: "DZ90A1X Inverter",
      model: "DZ90A1X",
      voltage: 220,
      frequency: 50,
      isInverter: true,
      normalizeRPM: 4320,
      centerTE: -25,
      centerTC: 45,
      compressorModel: null,
      // will be generated on first use
      refrigerantIndex: 2,
      dataPoints: [
        { RPM: 4320, TE: -35, TC: 35, W: 90.3, Q: 126.1 },
        { RPM: 4320, TE: -25, TC: 35, W: 121.1, Q: 188.4 },
        { RPM: 4320, TE: -15, TC: 35, W: 152, Q: 279.7 },
        { RPM: 4320, TE: -35, TC: 45, W: 83.4, Q: 117.5 },
        { RPM: 4320, TE: -25, TC: 45, W: 109.6, Q: 179.8 },
        { RPM: 4320, TE: -15, TC: 45, W: 134, Q: 271 },
        { RPM: 4320, TE: -35, TC: 55, W: 75.8, Q: 108.9 },
        { RPM: 4320, TE: -25, TC: 55, W: 96.9, Q: 171.1 },
        { RPM: 4320, TE: -15, TC: 55, W: 114.5, Q: 262.3 },
        { RPM: 3e3, TE: -35, TC: 35, W: 53.3, Q: 101.7 },
        { RPM: 3e3, TE: -25, TC: 35, W: 68.1, Q: 150.1 },
        { RPM: 3e3, TE: -15, TC: 35, W: 80.5, Q: 220.9 },
        { RPM: 3e3, TE: -35, TC: 45, W: 58.6, Q: 93.1 },
        { RPM: 3e3, TE: -25, TC: 45, W: 77, Q: 141.4 },
        { RPM: 3e3, TE: -15, TC: 45, W: 94.2, Q: 212.3 },
        { RPM: 3e3, TE: -35, TC: 55, W: 63.4, Q: 84.5 },
        { RPM: 3e3, TE: -25, TC: 55, W: 85.1, Q: 132.8 },
        { RPM: 3e3, TE: -15, TC: 55, W: 106.8, Q: 203.7 },
        { RPM: 1620, TE: -35, TC: 35, W: 28.4, Q: 62 },
        { RPM: 1620, TE: -25, TC: 35, W: 36.3, Q: 87.8 },
        { RPM: 1620, TE: -15, TC: 35, W: 42.9, Q: 125.5 },
        { RPM: 1620, TE: -35, TC: 45, W: 31.2, Q: 53.4 },
        { RPM: 1620, TE: -25, TC: 45, W: 41, Q: 79.2 },
        { RPM: 1620, TE: -15, TC: 45, W: 50.2, Q: 116.9 },
        { RPM: 1620, TE: -35, TC: 55, W: 33.8, Q: 44.8 },
        { RPM: 1620, TE: -25, TC: 55, W: 45.4, Q: 70.5 },
        { RPM: 1620, TE: -15, TC: 55, W: 56.9, Q: 108.3 },
        { RPM: 1320, TE: -35, TC: 35, W: 23, Q: 53.3 },
        { RPM: 1320, TE: -25, TC: 35, W: 29.4, Q: 74.2 },
        { RPM: 1320, TE: -15, TC: 35, W: 34.7, Q: 104.7 },
        { RPM: 1320, TE: -35, TC: 45, W: 25.3, Q: 44.7 },
        { RPM: 1320, TE: -25, TC: 45, W: 33.2, Q: 65.6 },
        { RPM: 1320, TE: -15, TC: 45, W: 40.6, Q: 96.1 },
        { RPM: 1320, TE: -35, TC: 55, W: 27.4, Q: 36.1 },
        { RPM: 1320, TE: -25, TC: 55, W: 36.7, Q: 57 },
        { RPM: 1320, TE: -15, TC: 55, W: 46, Q: 87.5 }
      ]
    }
  ];
  DEFAULT_COMPRESSORS.forEach((comp) => {
    if (comp.isInverter && Array.isArray(comp.dataPoints) && comp.dataPoints.length > 0) {
      comp.rpmMin = Math.min(...comp.dataPoints.map((d) => d.RPM));
      comp.rpmMax = Math.max(...comp.dataPoints.map((d) => d.RPM));
    }
  });
  var compressorList = [];
  var selectedCompressorId = "EGX80CLC";
  function ensureArrays(comp) {
    const toArray = (val, keys) => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") return keys.map((k) => val[k]).filter((v) => v !== void 0);
      return null;
    };
    const cleaned = {
      ...comp,
      wCoeffs: toArray(comp.wCoeffs, ["AW", "BW", "CW", "DW", "EW"]),
      etaCoeffs: toArray(comp.etaCoeffs, ["A", "B", "C"])
    };
    if (cleaned.isInverter && Array.isArray(cleaned.dataPoints) && cleaned.dataPoints.length > 0) {
      cleaned.rpmMin = Math.min(...cleaned.dataPoints.map((d) => d.RPM));
      cleaned.rpmMax = Math.max(...cleaned.dataPoints.map((d) => d.RPM));
    }
    return cleaned;
  }
  function loadCompressors() {
    const saved = localStorage.getItem("compressorList");
    if (saved) {
      compressorList = JSON.parse(saved);
      compressorList = compressorList.map((comp) => {
        if (comp.id === "EGX80CLC") {
          return {
            ...DEFAULT_COMPRESSORS[0],
            ...comp,
            cylinderVolumeCm3: comp.cylinderVolumeCm3 ?? DEFAULT_COMPRESSORS[0].cylinderVolumeCm3,
            speedRpm: comp.speedRpm ?? DEFAULT_COMPRESSORS[0].speedRpm,
            wCoeffs: ensureArrays(comp).wCoeffs || DEFAULT_COMPRESSORS[0].wCoeffs,
            etaCoeffs: ensureArrays(comp).etaCoeffs || DEFAULT_COMPRESSORS[0].etaCoeffs
          };
        }
        return ensureArrays(comp);
      });
      localStorage.setItem("compressorList", JSON.stringify(compressorList));
    } else {
      compressorList = [...DEFAULT_COMPRESSORS];
    }
    selectedCompressorId = localStorage.getItem("selectedCompressorId") || "EGX80CLC";
  }
  function saveCompressors() {
    localStorage.setItem("compressorList", JSON.stringify(compressorList));
    localStorage.setItem("selectedCompressorId", selectedCompressorId);
  }
  function getCompressorList() {
    return compressorList;
  }
  function getCurrentCompressor() {
    return compressorList.find((c) => c.id === selectedCompressorId) || compressorList[0];
  }
  function setSelectedCompressor(id) {
    selectedCompressorId = id;
    saveCompressors();
  }
  function addCompressor(comp) {
    compressorList.push(ensureArrays(comp));
    saveCompressors();
  }
  function deleteCompressor(id) {
    compressorList = compressorList.filter((c) => c.id !== id);
    if (selectedCompressorId === id) selectedCompressorId = compressorList[0]?.id || "";
    saveCompressors();
  }
  loadCompressors();

  // src/js/ui/settingsModal.js
  function initSettingsModal() {
    const modal = document.getElementById("settingsModal");
    const closeBtn = document.getElementById("closeSettings");
    const saveBtn2 = document.getElementById("settingsSave");
    const exportBtn2 = document.getElementById("settingsExport");
    const importBtn = document.getElementById("settingsImport");
    const resetBtn = document.getElementById("settingsReset");
    const gearBtn = document.getElementById("settingsBtn");
    gearBtn.addEventListener("click", () => {
      renderSettingsTabs();
      modal.classList.remove("hidden");
    });
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    window.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
    saveBtn2.addEventListener("click", () => {
      collectSettingsFromTabs();
      updateSettings(settings);
      modal.classList.add("hidden");
    });
    exportBtn2.addEventListener("click", exportSettings);
    importBtn.addEventListener("click", importSettings);
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all settings to factory defaults? This will also clear your compressor list.")) {
        resetAllSettings();
      }
    });
  }
  function renderSettingsTabs() {
    document.getElementById("stabGeneral").innerHTML = `
    <label>
      <input type="checkbox" id="autoCalculate" ${settings.autoCalculate ? "checked" : ""}>
      Auto\u2011calculate
    </label>
    <label>
      <input type="checkbox" id="showDirtyOverlay" ${settings.showDirtyOverlay ? "checked" : ""}>
      Show \u201Cschematic outdated\u201D overlay
    </label>
    <label>mm\xB3 \u2192 L: <input type="number" id="mm3ToL" value="${settings.mm3ToL}" step="1e-9"></label>
    <label>L \u2192 cu.ft: <input type="number" id="lToCuft" value="${settings.lToCuft}" step="1e-7"></label>
    <label>Decimal places (L): <input type="number" id="displayPrecisionL" value="${settings.displayPrecisionL}" min="0" max="5"></label>
    <label>Decimal places (cu.ft): <input type="number" id="displayPrecisionCuft" value="${settings.displayPrecisionCuft}" min="0" max="5"></label>
    <label>Canvas width: <input type="number" id="canvasWidth" value="${settings.canvasWidth}" step="10" min="200"></label>
    <label>Canvas height: <input type="number" id="canvasHeight" value="${settings.canvasHeight}" step="10" min="200"></label>
  `;
  }
  function collectSettingsFromTabs() {
    settings.autoCalculate = document.getElementById("autoCalculate").checked;
    settings.showDirtyOverlay = document.getElementById("showDirtyOverlay").checked;
    settings.mm3ToL = parseFloat(document.getElementById("mm3ToL").value) || 1e-6;
    settings.lToCuft = parseFloat(document.getElementById("lToCuft").value) || 0.0353147;
    settings.displayPrecisionL = parseInt(document.getElementById("displayPrecisionL").value) || 2;
    settings.displayPrecisionCuft = parseInt(document.getElementById("displayPrecisionCuft").value) || 3;
    settings.canvasWidth = parseInt(document.getElementById("canvasWidth").value) || 600;
    settings.canvasHeight = parseInt(document.getElementById("canvasHeight").value) || 800;
  }
  function exportSettings() {
    loadCompressors();
    const exportData = {
      settings: { ...settings },
      compressorList: getCompressorList(),
      selectedCompressorId: getCurrentCompressor()?.id ?? ""
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "refrigerator-calc-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function importSettings() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.settings) {
          updateSettings(data.settings);
        }
        if (data.compressorList && Array.isArray(data.compressorList)) {
          localStorage.setItem("compressorList", JSON.stringify(data.compressorList));
          if (data.selectedCompressorId) {
            localStorage.setItem("selectedCompressorId", data.selectedCompressorId);
          }
          loadCompressors();
        }
        renderSettingsTabs();
        alert("Settings imported successfully.");
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    input.click();
  }
  function resetAllSettings() {
    resetSettings();
    localStorage.removeItem("compressorList");
    localStorage.removeItem("selectedCompressorId");
    loadCompressors();
    renderSettingsTabs();
    document.getElementById("settingsModal").classList.add("hidden");
    alert("All settings and compressor list have been reset to defaults.");
  }

  // src/js/engine/thermo/constants.js
  var PHYSICAL_CONSTANTS = Object.freeze({
    // -------------------------------------------------------------------
    // Dry air properties (at approx. -20°C to +60°C – constant for modelling)
    // -------------------------------------------------------------------
    air: {
      density: 1.365,
      // Density in kg/m³     
      cp: 1.0048
      // Specific heat capacity in KJ/(kg·K) 
    },
    // -------------------------------------------------------------------
    // Insulation materials – thermal conductivity (W / (m·°C))
    // -------------------------------------------------------------------
    insulation: {
      urethane: 0.0192,
      // Rigid polyurethane foam
      polystyrene: 0.0407,
      // Expanded polystyrene (EPS)
      packing: 0.035
      // Door gasket/packing material
    },
    // -------------------------------------------------------------------
    // Surface heat‑transfer coefficients (W / (m²·°C))
    // -------------------------------------------------------------------
    surfaceCoefficients: {
      outside: 6.977,
      // Ambient exterior air to cabinet outer skin
      inside: 11.628
      // Cabinet interior air to inner liner
    }
  });

  // src/js/engine/thermo/heatLoad.js
  function lambdaUrethane(T_in, T_out) {
    const T_avg = (T_in + T_out) / 2;
    return (0.0165 + 11e-5 * (T_avg - 25)) * 1.16279;
  }
  function kExterior(thk, T_in, T_out) {
    const lam = lambdaUrethane(T_in, T_out);
    return 1 / (1 / PHYSICAL_CONSTANTS.surfaceCoefficients.outside + 1 / PHYSICAL_CONSTANTS.surfaceCoefficients.inside + thk / 1e3 / lam);
  }
  function kInterior(thk, T1, T2) {
    const lam = lambdaUrethane(T1, T2);
    return 1 / (1 / PHYSICAL_CONSTANTS.surfaceCoefficients.inside + 1 / PHYSICAL_CONSTANTS.surfaceCoefficients.inside + thk / 1e3 / lam);
  }
  function calcHeatLoads(geom, temps, electrical, PIPEPITCH, BackcondenserEfficiency = 0, fanInputPower_W, freezerPosition = "top", backCondenser = "No") {
    const {
      H,
      W,
      D,
      Hf,
      Hr,
      Hb,
      Db1,
      Db2,
      doorGap,
      packingPos,
      tFtop,
      tFleft,
      tFright,
      tFbottom,
      tFdoor,
      tFback,
      tEvaBack,
      tRtop,
      tRleft,
      tRright,
      tRback,
      tRdoor,
      tRbottom1,
      tRbottom2,
      tRbottom3,
      tFfloor1,
      tFfloor2,
      tFfloor3,
      tRfloor
    } = geom;
    const { T0, TF, TR, T2, TC, PR, TE } = temps;
    const K_side = 1.0738 - 4152e-6 * PIPEPITCH.side + 482e-8 * PIPEPITCH.side ** 2;
    const K_back = 1.0738 - 4152e-6 * PIPEPITCH.back + 482e-8 * PIPEPITCH.back ** 2;
    const T_compZone = T0 + (TC - T0) * PR;
    const TRise_side = (TC - T0) * K_side;
    const TRise_back = (TC - T0) * K_back;
    const T_wallSide = T0 + TRise_side * PR;
    const T_wallBack = T0 + TRise_back * PR;
    const isTopFreezer = freezerPosition === "top";
    const isBackCondenserAbsent = backCondenser !== "Yes";
    const hasFreezer = Hf > 0;
    const hasFresh = Hr > 0;
    let QF = 0;
    if (hasFreezer) {
      const AFtop = (W - (tFleft + tFright) / 2) * (D - tFback / 2) / 1e6;
      const AFdoor = (Hf - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6;
      const AFpackin = (Hf - 2 * packingPos + (W - 2 * packingPos)) * 2 / 1e3;
      let AFleft1, AFleft2, AFright1, AFright2;
      if (isTopFreezer) {
        AFleft1 = (D - tEvaBack) * (Hf - (tFtop + tFbottom) / 2) / 1e6;
        AFleft2 = tEvaBack * (Hf - (tFtop + tFbottom) / 2) / 1e6;
        AFright1 = AFleft1;
        AFright2 = AFleft2;
      } else {
        const fSideHeight = Hf - (tFtop + tFfloor1) / 2;
        AFleft1 = (fSideHeight * (D - tFback / 2) - (Db1 + Db2) * Hb / 2 - tEvaBack * (fSideHeight - Hb)) / 1e6;
        AFleft2 = tEvaBack * (fSideHeight - Hb) / 1e6;
        AFright1 = AFleft1;
        AFright2 = AFleft2;
      }
      QF += isTopFreezer ? kExterior(tFtop, TF, T0) * AFtop * (T0 - TF) : kInterior(tFtop, TF, TR) * AFtop * (TR - TF);
      QF += kExterior(tFleft, TF, T_wallSide) * AFleft1 * (T_wallSide - TF) + kExterior(tFright, TF, T_wallSide) * AFright1 * (T_wallSide - TF) + kExterior(tFleft, T2, T_wallSide) * AFleft2 * (T_wallSide - T2) + kExterior(tFright, T2, T_wallSide) * AFright2 * (T_wallSide - T2);
      if (!hasFresh) {
        const AFb1 = (W - (tFleft + tFright) / 2) * Db1 / 1e6;
        const AFb2 = (W - (tFleft + tFright) / 2) * Math.sqrt(Hb * Hb + (Db2 - Db1) ** 2) / 1e6;
        const AFb3 = (W - (tFleft + tFright) / 2) * (D - Db2) / 1e6;
        QF += kExterior(tFfloor1, TF, T_compZone) * AFb1 * (T_compZone - TF) + kExterior(tFfloor2, TF, T_compZone) * AFb2 * (T_compZone - TF) + kExterior(tFfloor3, TF, T0) * AFb3 * (T0 - TF);
      } else if (isTopFreezer) {
        const AFbottom = (D - tFback / 2) * (W - (tFleft + tFright) / 2) / 1e6;
        QF += kInterior(tFbottom, TF, TR) * AFbottom * (TR - TF);
      } else {
        const AFbottom1 = (W - (tFleft + tFright) / 2) * Db1 / 1e6;
        const AFbottom2 = (W - (tFleft + tFright) / 2) * Math.sqrt(Hb * Hb + (Db2 - Db1) ** 2) / 1e6;
        const AFbottom3 = (W - (tFleft + tFright) / 2) * (D - Db2) / 1e6;
        QF += kExterior(tFfloor1, TF, T_compZone) * AFbottom1 * (T_compZone - TF) + kExterior(tFfloor2, TF, T_compZone) * AFbottom2 * (T_compZone - TF) + kExterior(tFfloor3, TF, T0) * AFbottom3 * (T0 - TF);
      }
      QF += kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF) + PHYSICAL_CONSTANTS.insulation.packing * AFpackin * (T0 - TF);
      QF += (0.1219 * (TC - TF) * PR + 0.07551 * (T0 - TF) * (1 - PR)) * (W - tFleft - tFright) / 1e3 * 1.16279;
      QF += (0.0344 * (TC - TF) - 0.031235 * (T0 - TF)) * PR * (Hf * 2 + W) / 1e3 * 1.16279;
    }
    let QR = 0;
    if (hasFresh) {
      const ARdoor = (Hr - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6;
      const ARpackin = (Hr - 2 * packingPos + (W - 2 * packingPos)) * 2 / 1e3;
      let ARtop, ARleft, ARback;
      if (isTopFreezer) {
        ARtop = (W - (tRleft + tRright) / 2) * (D - tRback / 2) / 1e6;
        const rH = Hr - (tRtop + tRbottom1) / 2;
        ARleft = (rH * (D - tRback / 2) - (Db1 + Db2) * Hb / 2) / 1e6;
        ARback = (Hr - (tRtop + tRbottom1) / 2 - Hb) * (W - (tRleft + tRright) / 2) / 1e6;
      } else {
        ARtop = (W - (tRleft + tRright) / 2) * (D - tRback / 2) / 1e6;
        const rH = Hr - (tRtop + tRfloor) / 2;
        ARleft = rH * (D - tRback / 2) / 1e6;
        ARback = (Hr - (tRtop + tRfloor) / 2) * (W - (tRleft + tRright) / 2) / 1e6;
      }
      QR += isTopFreezer ? kInterior(tRtop, TF, TR) * ARtop * (TF - TR) : kExterior(tRtop, TR, T0) * ARtop * (T0 - TR);
      QR += kExterior(tRleft, TR, T_wallSide) * ARleft * (T_wallSide - TR) + kExterior(tRright, TR, T_wallSide) * ARleft * (T_wallSide - TR);
      if (isBackCondenserAbsent) {
        QR += kExterior(tRback, TR, T0) * ARback * (T0 - TR);
      } else {
        QR += kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR);
      }
      if (!hasFreezer || isTopFreezer) {
        const ARb1 = (W - (tRleft + tRright) / 2) * Db1 / 1e6;
        const ARb2 = (W - (tRleft + tRright) / 2) * Math.sqrt(Hb * Hb + (Db2 - Db1) ** 2) / 1e6;
        const ARb3 = (W - (tRleft + tRright) / 2) * (D - Db2) / 1e6;
        QR += kExterior(tRbottom1, TR, T_compZone) * ARb1 * (T_compZone - TR) + kExterior(tRbottom2, TR, T_compZone) * ARb2 * (T_compZone - TR) + kExterior(tRbottom3, TR, T0) * ARb3 * (T0 - TR);
      } else {
        const ARbottom = (W - (tRleft + tRright) / 2) * (D - tRback / 2) / 1e6;
        QR += kInterior(tRfloor, TF, TR) * ARbottom * (TF - TR);
      }
      QR += kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR) + PHYSICAL_CONSTANTS.insulation.packing * ARpackin * (T0 - TR);
      QR += (0.03322 * (TC - TR) - 0.030267 * (T0 - TR)) * PR * (Hr * 2) / 1e3 * 1.16279;
    }
    const H_evap = hasFreezer ? Hf : Hr;
    const tTop_evap = hasFreezer ? tFtop : tRtop;
    const tLeft_evap = hasFreezer ? tFleft : tRleft;
    const tRight_evap = hasFreezer ? tFright : tRright;
    const tBack_evap = hasFreezer ? tFback : tRback;
    let tBottom_evap;
    if (hasFreezer) {
      tBottom_evap = freezerPosition === "top" ? tFbottom : tFfloor1;
    } else {
      tBottom_evap = isTopFreezer || freezerPosition === "top" ? tRfloor : tRbottom1;
    }
    let A_evaBack;
    if (isTopFreezer || !hasFreezer) {
      A_evaBack = (W - (tLeft_evap + tRight_evap) / 2) * (H_evap - (tTop_evap + tBottom_evap) / 2) / 1e6;
    } else {
      A_evaBack = (W - (tLeft_evap + tRight_evap) / 2) * (H_evap - Hb - (tTop_evap + tBottom_evap) / 2) / 1e6;
    }
    let QEV_cond = 0;
    if (A_evaBack > 0) {
      if (isBackCondenserAbsent) {
        QEV_cond = kExterior(tEvaBack, T2, T0) * A_evaBack * (T0 - T2);
      } else {
        QEV_cond = kExterior(tEvaBack, T2, T_wallBack) * A_evaBack * (T_wallBack - T2);
      }
    }
    const fanLoad = (fanInputPower_W ?? 2.1) * PR;
    const defrostEventsPerDay = 24 / (electrical.timerPeriod_h / PR);
    const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60) * (defrostEventsPerDay / 24);
    return {
      QF,
      QR,
      QEV: QEV_cond + fanLoad + defrostLoad,
      fanLoad,
      defrostLoad,
      totalLoad: QF + QR + QEV_cond + fanLoad + defrostLoad
    };
  }

  // src/js/engine/thermo/condenser.js
  function calcQCout(geom, TC, T0, TF, TR, PR, PIPEPITCH, freezerPosition = "top", backCondenserEfficiency = 0) {
    const { H, W, D, Hf, Hr, Hb, Db1, Db2, tFright, tFleft } = geom;
    const sideArea = (H * (D - 60) - (Db1 + Db2) * Hb / 2) * 2 / 1e6;
    const backAreaRaw = W * (H - Hb) / 1e6;
    const backArea = backAreaRaw * backCondenserEfficiency;
    const K_side = 1.0738 - 4152e-6 * PIPEPITCH.side + 482e-8 * PIPEPITCH.side ** 2;
    const K_back = 1.0738 - 4152e-6 * PIPEPITCH.back + 482e-8 * PIPEPITCH.back ** 2;
    const Qdpfr = (0.1984 * (TC - T0) + 0.1219 * (TC - TF)) * PR * (W - tFright - tFleft) / 1e3 * 1.16279;
    const isTop = freezerPosition === "top";
    let Qdpf;
    let Qdpr;
    if (isTop) {
      Qdpf = (0.3395 * (TC - T0) + 0.0344 * (TC - TF)) * PR * (Hf * 2 + W) / 1e3 * 1.16279;
      Qdpr = (0.3405 * (TC - T0) + 0.03322 * (TC - TR)) * PR * (Hr * 2) / 1e3 * 1.16279;
    } else {
      Qdpf = (0.3395 * (TC - T0) + 0.0344 * (TC - TF)) * PR * (Hf * 2) / 1e3 * 1.16279;
      Qdpr = (0.3405 * (TC - T0) + 0.03322 * (TC - TR)) * PR * (Hr * 2 + W) / 1e3 * 1.16279;
    }
    const Qdp = Qdpfr + Qdpf + Qdpr;
    const Qside = K_side * sideArea * (TC - T0) * 1.16279;
    const Qback = K_back * backArea * (TC - T0) * 1.16279;
    return {
      Qdpfr,
      Qdpf,
      Qdpr,
      Qdp,
      Qside,
      Qback,
      QCout: Qdp + Qside + Qback
    };
  }

  // src/js/engine/thermo/CompressorPerformance.js
  var SUCTION_TEMP_C = 30;
  var KELVIN_OFFSET = 273.16;
  function r134a_satPressure(T_K) {
    return Math.exp(104.918 - 5301.3 / T_K - 16.2481 * Math.log(T_K) + 0.0246593 * T_K);
  }
  function r134a_liquidEnthalpy(T_C) {
    return 100.019 * 4.1868 + 0.31763 * T_C * 4.1868 + 33057e-8 * T_C ** 2 * 4.1868 + 35281e-10 * T_C ** 3 * 4.1868;
  }
  function r134a_gasEnthalpy(T_K, Pe) {
    return 119.36 * 4.1868 + 0.023174 * T_K * 4.1868 + 31297e-8 * 4.1868 * T_K ** 2 - 138.07 * 4.1868 * Pe / T_K;
  }
  function r134a_specificVolume(T_K, Pe) {
    return 0.01077 + 8278e-7 * T_K / Pe - 4.511 / T_K - 118e-6 * Pe;
  }
  function r600a_satPressure(T_K) {
    return Math.exp(68.322 - 4401 / T_K - 9.8436 * Math.log(T_K) + 0.0127711 * T_K);
  }
  function r600a_liquidEnthalpy(T_C) {
    return 75.545 * 4.1868 + 0.55731 * T_C * 4.1868 + 7088e-7 * T_C ** 2 * 4.1868 + 29408e-10 * T_C ** 3 * 4.1868;
  }
  function r600a_gasEnthalpy(T_K, Pe) {
    return 104.5 * 4.1868 + 0.049951 * T_K * 4.1868 + 58822e-8 * 4.1868 * T_K ** 2 - 249.18 * 4.1868 * Pe / T_K;
  }
  function r600a_specificVolume(T_K, Pe) {
    return 0.015883 + 1455e-6 * T_K / Pe - 7.2936 / T_K - 4645e-7 * Pe;
  }
  function getRefrigerantProperties(REI) {
    if (REI === 1) return { satPressure: r134a_satPressure, liquidEnthalpy: r134a_liquidEnthalpy, gasEnthalpy: r134a_gasEnthalpy, specificVolume: r134a_specificVolume };
    if (REI === 2) return { satPressure: r600a_satPressure, liquidEnthalpy: r600a_liquidEnthalpy, gasEnthalpy: r600a_gasEnthalpy, specificVolume: r600a_specificVolume };
    throw new Error(`Unsupported refrigerant index ${REI}.`);
  }
  function gaussJordanSolve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let k = 0; k < n; k++) {
      let maxRow = k;
      let maxAbs = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        const abs = Math.abs(M[i][k]);
        if (abs > maxAbs) {
          maxAbs = abs;
          maxRow = i;
        }
      }
      if (maxRow !== k) [M[k], M[maxRow]] = [M[maxRow], M[k]];
      const pivot = M[k][k];
      if (Math.abs(pivot) < 1e-12) throw new Error(`Singular matrix at column ${k}.`);
      for (let j = k; j <= n; j++) M[k][j] /= pivot;
      for (let i = 0; i < n; i++) {
        if (i === k) continue;
        const factor = M[i][k];
        for (let j = k; j <= n; j++) M[i][j] -= factor * M[k][j];
      }
    }
    return M.map((row) => row[n]);
  }
  function buildNormalEquations(features, targets) {
    const n = features.length;
    const m = features[0].length;
    const A = Array.from({ length: m }, () => new Array(m).fill(0));
    const b = new Array(m).fill(0);
    for (let i = 0; i < n; i++) {
      const f = features[i];
      const y = targets[i];
      for (let j = 0; j < m; j++) {
        for (let k = 0; k < m; k++) A[j][k] += f[j] * f[k];
        b[j] += f[j] * y;
      }
    }
    return { A, b };
  }
  function computeCompressorCoefficients({ cylinderVolumeCm3, speedRpm, refrigerantIndex, dataPoints }) {
    if (!Array.isArray(dataPoints) || dataPoints.length < 5) throw new Error("At least 5 points required.");
    const prop = getRefrigerantProperties(refrigerantIndex);
    const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
    const hLiquid = prop.liquidEnthalpy(SUCTION_TEMP_C);
    const etaFeatures = [], etaTargets = [], wFeatures = [], wTargets = [];
    for (const { TE, TC, Q, W } of dataPoints) {
      const Pe = prop.satPressure(TE + KELVIN_OFFSET);
      const Pc = prop.satPressure(TC + KELVIN_OFFSET);
      const hGas = prop.gasEnthalpy(suctionTempK, Pe);
      const vGas = prop.specificVolume(suctionTempK, Pe);
      const G = Q * 3.6 / (hGas - hLiquid);
      const GK = cylinderVolumeCm3 * speedRpm * 60 / 1e6 / vGas;
      etaFeatures.push([1, Pc / Pe, Pc]);
      etaTargets.push(G / GK);
      wFeatures.push([1, TE, TC, TC * TE, TE * TE]);
      wTargets.push(W);
    }
    return {
      etaCoeffs: gaussJordanSolve(buildNormalEquations(etaFeatures, etaTargets).A, buildNormalEquations(etaFeatures, etaTargets).b),
      wCoeffs: gaussJordanSolve(buildNormalEquations(wFeatures, wTargets).A, buildNormalEquations(wFeatures, wTargets).b)
    };
  }
  function compressorPower(TE, TC, refrigerantIndex, wCoeffs, etaCoeffs, cylinderVolumeCm3, speedRpm) {
    const [AW, BW, CW, DW, EW] = wCoeffs;
    const CompPower = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;
    const prop = getRefrigerantProperties(refrigerantIndex);
    const Pe = prop.satPressure(TE + KELVIN_OFFSET);
    const Pc = prop.satPressure(TC + KELVIN_OFFSET);
    const [A, B, C] = etaCoeffs;
    const VolumetricEfficiency = A + B * (Pc / Pe) + C * Pc;
    const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
    const vGas = prop.specificVolume(suctionTempK, Pe);
    const hLiq = prop.liquidEnthalpy(SUCTION_TEMP_C);
    const hGas = prop.gasEnthalpy(suctionTempK, Pe);
    const G = VolumetricEfficiency * (cylinderVolumeCm3 * speedRpm * 60 / 1e6) / vGas;
    return { Pe, Pc, VolumetricEfficiency, QCompressor: G * (hGas - hLiq) / 3.6, CompPower, massFlow: G };
  }
  function matrixMultiply(A, B) {
    const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
    const C = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
    for (let i = 0; i < rowsA; i++) for (let k = 0; k < colsA; k++) for (let j = 0; j < colsB; j++) C[i][j] += A[i][k] * B[k][j];
    return C;
  }
  function transpose(A) {
    return A[0].map((_, c) => A.map((row) => row[c]));
  }
  function solveRidge(X, y, alpha) {
    const n = X.length, p = X[0].length;
    const xMeans = new Array(p).fill(0);
    let yMean = 0;
    for (let i = 0; i < n; i++) {
      yMean += y[i];
      for (let j = 0; j < p; j++) xMeans[j] += X[i][j];
    }
    yMean /= n;
    for (let j = 0; j < p; j++) xMeans[j] /= n;
    const xStds = new Array(p).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) xStds[j] += Math.pow(X[i][j] - xMeans[j], 2);
    for (let j = 0; j < p; j++) {
      xStds[j] = Math.sqrt(xStds[j] / n);
      if (xStds[j] === 0) xStds[j] = 1;
    }
    const X_scaled = Array.from({ length: n }, () => Array(p).fill(0)), y_centered = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      y_centered[i] = y[i] - yMean;
      for (let j = 0; j < p; j++) X_scaled[i][j] = (X[i][j] - xMeans[j]) / xStds[j];
    }
    const Xt = transpose(X_scaled), XtX = matrixMultiply(Xt, X_scaled);
    for (let j = 0; j < p; j++) XtX[j][j] += alpha;
    const Xty = Xt.map((row) => row.reduce((sum, _, i) => sum + row[i] * y_centered[i], 0));
    const beta_scaled = gaussJordanSolve(XtX, Xty);
    const coefs_unscaled = new Array(p);
    let intercept_unscaled = yMean;
    for (let j = 0; j < p; j++) {
      coefs_unscaled[j] = beta_scaled[j] / xStds[j];
      intercept_unscaled -= coefs_unscaled[j] * xMeans[j];
    }
    return [intercept_unscaled, ...coefs_unscaled];
  }
  function makeFeatures(rpmForm, n, te, tc) {
    switch (rpmForm) {
      case "n_lin":
        return [n, n * te, n * tc, n * tc * te, n * te ** 2];
      case "n_quad":
        return [n, n ** 2, n * te, n * tc, n * tc * te, n * te ** 2];
      case "ln_n_lin":
        const ln1 = Math.log(Math.max(n, 1e-12));
        return [ln1, ln1 * te, ln1 * tc, ln1 * tc * te, ln1 * te ** 2];
      case "ln_n_quad":
        const ln2 = Math.log(Math.max(n, 1e-12));
        return [ln2, ln2 ** 2, ln2 * te, ln2 * tc, ln2 * tc * te, ln2 * te ** 2];
      default:
        throw new Error(`Unknown rpmForm: ${rpmForm}`);
    }
  }
  function cvInverter(dataPoints, targetCol, rpmForm, logTransform, alphas, normalizeRPM, centerTE, centerTC) {
    const groups = dataPoints.map((d) => d.RPM), uniqueGroups = [...new Set(groups)];
    if (uniqueGroups.length < 2) return { avgRMSE: Infinity };
    let bestAlpha = null, bestAvgRMSE = Infinity;
    for (const alpha of alphas) {
      let sumRMSE = 0, validFolds = 0;
      for (const g of uniqueGroups) {
        const trainIdx = [], testIdx = [];
        dataPoints.forEach((d, i) => {
          d.RPM === g ? testIdx.push(i) : trainIdx.push(i);
        });
        if (trainIdx.length < 2 || testIdx.length === 0) continue;
        const Xtrain = trainIdx.map((i) => makeFeatures(rpmForm, dataPoints[i].RPM / normalizeRPM, dataPoints[i].TE - centerTE, dataPoints[i].TC - centerTC));
        const yTrain = trainIdx.map((i) => logTransform ? Math.log(dataPoints[i][targetCol]) : dataPoints[i][targetCol]);
        const coeffs = solveRidge(Xtrain, yTrain, alpha);
        const Xtest = testIdx.map((i) => makeFeatures(rpmForm, dataPoints[i].RPM / normalizeRPM, dataPoints[i].TE - centerTE, dataPoints[i].TC - centerTC));
        const preds = Xtest.map((xi) => coeffs[0] + xi.reduce((s, x, j) => s + x * coeffs[j + 1], 0));
        const errs = testIdx.map((id, i) => ((logTransform ? Math.exp(preds[i]) : preds[i]) - dataPoints[id][targetCol]) ** 2);
        sumRMSE += Math.sqrt(errs.reduce((s, e) => s + e, 0) / errs.length);
        validFolds++;
      }
      const avgRMSE = validFolds > 0 ? sumRMSE / validFolds : Infinity;
      if (avgRMSE < bestAvgRMSE) {
        bestAvgRMSE = avgRMSE;
        bestAlpha = alpha;
      }
    }
    return { alpha: bestAlpha, avgRMSE: bestAvgRMSE };
  }
  function fitPiecewiseInverter(dataPoints, targetCol, splitRPM, normalizeRPM, centerTE, centerTC) {
    const lowData = dataPoints.filter((d) => d.RPM <= splitRPM);
    if (lowData.length < 6) throw new Error("Not enough low\u2011range points.");
    const coeffs = solveRidge(lowData.map((d) => makeFeatures("n_quad", d.RPM / splitRPM, d.TE - centerTE, d.TC - centerTC)), lowData.map((d) => d[targetCol]), 1);
    const maxRPM = Math.max(...dataPoints.map((d) => d.RPM));
    const maxData = dataPoints.filter((d) => d.RPM === maxRPM);
    const coeffs_max = solveRidge(maxData.map((d) => makeFeatures("n_quad", 1, d.TE - centerTE, d.TC - centerTC)), maxData.map((d) => d[targetCol]), 1);
    const predict = (RPM, TE, TC) => {
      if (RPM <= splitRPM) return coeffs[0] + makeFeatures("n_quad", RPM / splitRPM, TE - centerTE, TC - centerTC).reduce((s, f, i) => s + f * coeffs[i + 1], 0);
      if (RPM === maxRPM) return coeffs_max[0] + makeFeatures("n_quad", 1, TE - centerTE, TC - centerTC).reduce((s, f, i) => s + f * coeffs_max[i + 1], 0);
      const valLow = predict(splitRPM, TE, TC), valMax = predict(maxRPM, TE, TC);
      return valLow + (valMax - valLow) * ((RPM - splitRPM) / (maxRPM - splitRPM));
    };
    const preds = dataPoints.map((d) => predict(d.RPM, d.TE, d.TC));
    return { type: "piecewise", splitRPM, maxRPM, coeffs_low: coeffs, coeffs_max, rmse: Math.sqrt(preds.reduce((s, p, i) => s + (p - dataPoints[i][targetCol]) ** 2, 0) / preds.length), predict };
  }
  function buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE) {
    let best = null, bestRMSE = Infinity;
    for (const rpmForm of ["n_lin", "n_quad", "ln_n_lin", "ln_n_quad"]) {
      for (const logTrans of [false, true]) {
        const cv = cvInverter(dataPoints, targetCol, rpmForm, logTrans, [1e-3, 0.01, 0.1, 1, 10, 100], normalizeRPM, centerTE, centerTC);
        if (cv.avgRMSE < bestRMSE) {
          bestRMSE = cv.avgRMSE;
          best = { type: "global", rpmForm, logTransform: logTrans, alpha: cv.alpha, cvRMSE: cv.avgRMSE };
        }
      }
    }
    if (!best) return null;
    const X = dataPoints.map((d) => makeFeatures(best.rpmForm, d.RPM / normalizeRPM, d.TE - centerTE, d.TC - centerTC));
    const y = best.logTransform ? dataPoints.map((d) => Math.log(d[targetCol])) : dataPoints.map((d) => d[targetCol]);
    return { ...best, coeffs: solveRidge(X, y, best.alpha), rmse: bestRMSE };
  }
  function selectInverterModel(dataPoints, targetCol, targetRMSE, normalizeRPM, centerTE, centerTC) {
    const uniqueRPMs = [...new Set(dataPoints.map((d) => d.RPM))].sort((a, b) => a - b);
    const globalBest = buildGlobalModel(dataPoints, targetCol, normalizeRPM, centerTE, centerTC, targetRMSE);
    if (uniqueRPMs.length < 3) return globalBest;
    let bestPiecewise = null, bestPiecewiseRMSE = Infinity;
    for (let idx = 1; idx < uniqueRPMs.length - 1; idx++) {
      try {
        const pw = fitPiecewiseInverter(dataPoints, targetCol, uniqueRPMs[idx], normalizeRPM, centerTE, centerTC);
        if (pw.rmse < bestPiecewiseRMSE) {
          bestPiecewiseRMSE = pw.rmse;
          bestPiecewise = pw;
        }
      } catch (e) {
      }
    }
    if (bestPiecewise && bestPiecewise.rmse + 0.5 < (globalBest.cvRMSE || globalBest.rmse)) return bestPiecewise;
    return globalBest;
  }
  function fitInverterCoefficients(dataPoints, normalizeRPM, centerTE, centerTC, targetRMSE = 3) {
    return {
      Q: selectInverterModel(dataPoints, "Q", targetRMSE, normalizeRPM, centerTE, centerTC),
      W: selectInverterModel(dataPoints, "W", targetRMSE, normalizeRPM, centerTE, centerTC),
      normalizeRPM,
      centerTE,
      centerTC
    };
  }
  function inverterCompressorPerformance(TE, TC, RPM, refrigerantIndex, compressorModel) {
    const { Q, W, normalizeRPM, centerTE, centerTC } = compressorModel;
    const predict = (model, TE2, TC2, RPM2) => {
      if (model.type === "global") {
        const feat = makeFeatures(model.rpmForm, RPM2 / normalizeRPM, TE2 - centerTE, TC2 - centerTC);
        const y = model.coeffs[0] + feat.reduce((s, f, i) => s + f * model.coeffs[i + 1], 0);
        return model.logTransform ? Math.exp(y) : y;
      } else return model.predict(RPM2, TE2, TC2);
    };
    const QCompressor = predict(Q, TE, TC, RPM);
    const CompPower = predict(W, TE, TC, RPM);
    const prop = getRefrigerantProperties(refrigerantIndex);
    const Pe = prop.satPressure(TE + KELVIN_OFFSET);
    console.log(`[INV-PERF] RPM=${RPM} TE=${TE} TC=${TC} | Q.type=${Q.type} W.type=${W.type} | QCompressor=${QCompressor} CompPower=${CompPower} Pe=${Pe}`);
    return {
      QCompressor,
      CompPower,
      massFlow: QCompressor * 3.6 / (prop.gasEnthalpy(SUCTION_TEMP_C + KELVIN_OFFSET, Pe) - prop.liquidEnthalpy(SUCTION_TEMP_C)),
      Pe,
      Pc: prop.satPressure(TC + KELVIN_OFFSET),
      VolumetricEfficiency: null
    };
  }

  // src/js/engine/thermo/evaporator.js
  function computeEvaporatorArea(evap) {
    const {
      width_mm,
      height_mm,
      depth_mm,
      rows,
      layers,
      tubeOD_mm,
      finHeight_mm,
      finLength_mm,
      numFins,
      sidePlateNo
    } = evap;
    const tubeCrossArea = Math.PI * (tubeOD_mm / 2) ** 2;
    const finAreaPerFin = (finLength_mm * finHeight_mm - tubeCrossArea * layers) * 2 / 1e6;
    const totalFinArea = finAreaPerFin * numFins;
    const tubeArea = Math.PI * tubeOD_mm * width_mm * rows * layers / 1e6;
    const sidePlateArea = (height_mm * depth_mm * sidePlateNo - tubeCrossArea * rows * layers) * 2 / 1e6;
    return totalFinArea + tubeArea + sidePlateArea;
  }
  function airSpeed(fanParam, evap) {
    const { tipDiam_mm, fanRPM, hubDiam_mm, PitchAngle_degree } = fanParam;
    if (!fanParam || typeof fanParam !== "object") {
      throw new Error("fanParam is missing or invalid");
    }
    if ([tipDiam_mm, fanRPM, hubDiam_mm, PitchAngle_degree].some((v) => v == null || isNaN(v))) {
      throw new Error("fanParam missing required fields: tipDiam_mm, fanRPM, hubDiam_mm, PitchAngle_degree");
    }
    if (hubDiam_mm >= tipDiam_mm) {
      throw new Error(`Fan hub diameter (${hubDiam_mm}mm) must be smaller than tip diameter (${tipDiam_mm}mm).`);
    }
    const tipDiam_m = tipDiam_mm / 1e3;
    const hubDiam_m = hubDiam_mm / 1e3;
    const R = tipDiam_m / 2;
    const r = hubDiam_m / 2;
    const Q_m3s = 70 * fanRPM / 3e3 * (tipDiam_mm / 100) ** 2 / 3600;
    const fanAirflow_m3h = Q_m3s * 3600;
    const fanAirSpeed = fanAirflow_m3h / (Math.PI * R ** 2) / 3600;
    const frontArea_m2 = evap.width_mm * evap.depth_mm / 1e6;
    if (frontArea_m2 <= 0) throw new Error("Evaporator face area is zero or negative");
    const v_ms = fanAirflow_m3h / frontArea_m2 / 3600;
    const fanAirflow_cfm = fanAirflow_m3h * 0.588578;
    console.log(`[Fan param] tipDiam_mm=${tipDiam_mm} fanRPM=${fanRPM} hubDiam_mm=${hubDiam_mm} PitchAngle_degree=${PitchAngle_degree} | Q_m3s=${Q_m3s.toFixed(4)} m\xB3/s, fanAirflow_m3h=${fanAirflow_m3h.toFixed(2)} m\xB3/h, v_ms=${v_ms.toFixed(2)} m/s, fanAirflow_cfm=${fanAirflow_cfm.toFixed(2)} CFM`);
    return { v_ms, fanAirflow_m3h, fanAirflow_cfm, fanAirSpeed };
  }
  function evaporatorAlpha(v_ms) {
    return 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
  }
  function lmtd(T1, T2, TE) {
    const dT1 = T1 - TE;
    const dT2 = T2 - TE;
    if (dT1 <= 1e-4 || dT2 <= 1e-4) {
      throw new RangeError(`LMTD Undefined: TE (${TE.toFixed(2)}) >= Air Temps (T1:${T1.toFixed(2)}, T2:${T2.toFixed(2)})`);
    }
    const ratio = dT1 / dT2;
    if (Math.abs(ratio - 1) < 1e-6) {
      return dT1;
    }
    return (dT1 - dT2) / Math.log(ratio);
  }
  function evaporatorCapacity(alpha, area, LMTD) {
    return alpha * area * LMTD;
  }

  // src/js/engine/thermo/solver.js
  var RHO_AIR = PHYSICAL_CONSTANTS.air.density;
  var CP_AIR = PHYSICAL_CONSTANTS.air.cp;
  var KELVIN_OFFSET2 = 273.16;
  var CV = RHO_AIR * CP_AIR * 1e3 / 3600;
  function getRefrigerantIndex(name) {
    if (name === "R-134a") return 1;
    if (name === "R-600a") return 2;
    throw new Error(`Unsupported refrigerant: ${name}`);
  }
  function evaluateCompressorSafely(TE, TC, refIndex, compParams, RPM) {
    if (compParams.compressorModel && typeof compParams.compressorModel === "object") {
      return inverterCompressorPerformance(TE, TC, RPM, refIndex, compParams.compressorModel);
    }
    if (compParams.isInverter) throw new Error("Inverter compressor selected but no fitted model.");
    return compressorPower(
      TE,
      TC,
      refIndex,
      compParams.wCoeffs,
      compParams.etaCoeffs,
      compParams.cylinderVolumeCm3 || compParams.Vc,
      compParams.speedRpm || compParams.rpm
    );
  }
  function newton2(F, x0, dx, tol, maxIter, bounds, debug = false) {
    const logger = {
      log: (...args) => debug && console.log(...args),
      table: (data) => debug && console.table(data)
    };
    let x = [...x0], f, normF;
    logger.log(`
--- Starting Newton2 --- Initial Guess: [${x[0].toFixed(3)}, ${x[1].toFixed(3)}]`);
    try {
      f = F(x);
      if (f.error) return { x, f: [NaN, NaN], normF: NaN, converged: false, iterations: 0, error: f.error };
      normF = Math.sqrt(f[0] * f[0] + f[1] * f[1]);
    } catch (e) {
      logger.log(`Initial F(x) failed: ${e.message}`);
      return { x, f: [NaN, NaN], normF: NaN, converged: false, iterations: 0, error: `Initial F(x) failed: ${e.message}` };
    }
    for (let i = 0; i < maxIter; i++) {
      logger.log(`[Iter ${i}] x=[${x[0].toFixed(3)}, ${x[1].toFixed(3)}], f=[${f[0].toFixed(2)}, ${f[1].toFixed(2)}], norm=${normF.toFixed(4)}`);
      if (normF <= tol) {
        logger.log(`-> Converged in ${i + 1} iterations.`);
        return { x, f, normF, converged: true, iterations: i + 1 };
      }
      const J = [[0, 0], [0, 0]];
      try {
        for (let j = 0; j < 2; j++) {
          const h = Math.max(1e-7, Math.abs(x[j]) * 1e-6);
          const xp = [...x];
          if (xp[j] + h > bounds[j][1]) {
            xp[j] -= h;
            const fp = F(xp);
            if (fp.error) throw new Error(fp.error);
            J[0][j] = (f[0] - fp[0]) / h;
            J[1][j] = (f[1] - fp[1]) / h;
          } else {
            xp[j] += h;
            const fp = F(xp);
            if (fp.error) throw new Error(fp.error);
            J[0][j] = (fp[0] - f[0]) / h;
            J[1][j] = (fp[1] - f[1]) / h;
          }
        }
        logger.log(`[Iter ${i}] J = [[${J[0][0].toFixed(4)}, ${J[0][1].toFixed(4)}], [${J[1][0].toFixed(4)}, ${J[1][1].toFixed(4)}]]`);
      } catch (e) {
        logger.log(`Jacobian failed: ${e.message}`);
        return { x, f, normF, converged: false, iterations: i + 1, error: `Jacobian failed: ${e.message}` };
      }
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      let direction;
      if (Math.abs(det) > 1e-12) {
        const invDet = 1 / det;
        direction = [
          -invDet * (J[1][1] * f[0] - J[0][1] * f[1]),
          -invDet * (-J[1][0] * f[0] + J[0][0] * f[1])
        ];
        logger.log(`[Iter ${i}] det=${det.toFixed(4)}, raw_dir=[${direction[0].toFixed(4)}, ${direction[1].toFixed(4)}]`);
      } else {
        logger.log(`[Iter ${i}] Warning: Matrix singular or saddle point (det=${det}). Using gradient descent.`);
        direction = [-(J[0][0] * f[0] + J[1][0] * f[1]), -(J[0][1] * f[0] + J[1][1] * f[1])];
        const dirNorm = Math.sqrt(direction[0] ** 2 + direction[1] ** 2);
        if (dirNorm < 1e-12) return { x, f, normF, converged: false, iterations: i + 1, error: "Saddle point." };
      }
      const maxStepT2 = 5;
      const domainSpanVar2 = bounds[1][1] - bounds[1][0];
      const maxStepVar2 = domainSpanVar2 > 2 ? 500 : 0.15;
      let scale = 1;
      if (Math.abs(direction[0]) > maxStepT2) {
        scale = Math.min(scale, maxStepT2 / Math.abs(direction[0]));
      }
      if (Math.abs(direction[1]) > maxStepVar2) {
        scale = Math.min(scale, maxStepVar2 / Math.abs(direction[1]));
      }
      direction[0] *= scale;
      direction[1] *= scale;
      logger.log(`[Iter ${i}] clamped_dir=[${direction[0].toFixed(4)}, ${direction[1].toFixed(4)}]`);
      let alpha = 1, accept = false, newX, newF, newNorm;
      const armijoC = 1e-4;
      logger.log(`[Iter ${i}] Starting line search, initial alpha=1.0`);
      for (let bt = 0; bt < 15; bt++) {
        newX = [
          Math.max(bounds[0][0], Math.min(bounds[0][1], x[0] + alpha * direction[0])),
          Math.max(bounds[1][0], Math.min(bounds[1][1], x[1] + alpha * direction[1]))
        ];
        try {
          newF = F(newX);
          if (newF.error) throw new Error(newF.error);
          newNorm = Math.sqrt(newF[0] * newF[0] + newF[1] * newF[1]);
        } catch (e) {
          logger.log(`  [bt=${bt}] F(x+\u03B1d) failed at \u03B1=${alpha.toFixed(4)}: ${e.message}`);
          alpha *= 0.5;
          continue;
        }
        const enoughDecrease = newNorm < normF * (1 - armijoC * alpha);
        logger.log(`  [bt=${bt}] \u03B1=${alpha.toFixed(4)}, newNorm=${newNorm.toFixed(4)}, enoughDecrease=${enoughDecrease}`);
        if (enoughDecrease) {
          accept = true;
          logger.log(`  -> accepted \u03B1=${alpha.toFixed(4)}`);
          break;
        }
        alpha *= 0.5;
      }
      if (!accept) {
        logger.log(`[Iter ${i}] Line search failed! Alpha hit bottom.`);
        if (Math.abs(x[1] - bounds[1][0]) < 1e-4 && direction[1] < 0) return { x, f, normF, converged: true, iterations: i + 1, warning: "Compressor oversized limit." };
        if (Math.abs(x[1] - bounds[1][1]) < 1e-4 && direction[1] > 0) return { x, f, normF, converged: true, iterations: i + 1, warning: "Compressor undersized limit." };
        return { x, f, normF, converged: false, iterations: i + 1, error: "Line search failed." };
      }
      x = newX;
      f = newF;
      normF = newNorm;
    }
    logger.log(`Max iterations reached without convergence.`);
    return { x, f, normF, converged: false, iterations: maxIter, error: "Max iterations reached" };
  }
  function solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPos, innerOpts = {}, fixedPR, evapGeom) {
    const { tol = 1e-4, maxIter = 100, dx = 1e-3 } = innerOpts;
    const { Damp = 1 } = electrical;
    const PIPEPITCH = { side: condenserConfig.sidePipePitch_mm, back: condenserConfig.backPipePitch_mm };
    const refIndex = getRefrigerantIndex(refrigerant);
    const isInverterMode = compParams.isInverter && fixedPR !== void 0;
    let bounds, initialGuess;
    if (isInverterMode) {
      bounds = [[-80, 20], [compParams.rpmMin || 1e3, compParams.rpmMax || 6e3]];
      initialGuess = [innerOpts.initialT2 ?? -21.25, innerOpts.initialRPM ?? 3e3];
    } else {
      bounds = [[-80, 20], [1e-3, 0.999]];
      if (innerOpts.forcePR !== void 0) bounds[1] = [innerOpts.forcePR, innerOpts.forcePR];
      initialGuess = [innerOpts.initialT2 ?? -21.25, innerOpts.forcePR ?? innerOpts.initialPR ?? 0.59];
    }
    let convergedTE = TE;
    const F = (vars) => {
      const T2 = vars[0], secondVar = vars[1];
      const PR = isInverterMode ? fixedPR : secondVar, RPM = isInverterMode ? secondVar : void 0;
      const loads2 = calcHeatLoads(geom, { ...fixedTemps, T2, TC, PR, TE: -25 }, electrical, PIPEPITCH, condenserConfig.backCondenserEfficiency, fan.inputPower_W, freezerPos, condenserConfig.backCondenser);
      const Flow_m3h2 = fan.fanAirflow_m3h;
      const faceArea_m2 = evapGeom.width_mm / 1e3 * (evapGeom.depth_mm / 1e3);
      const v_ms = Flow_m3h2 / 3600 / faceArea_m2;
      const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
      const UA = alpha * evapGeom.evapArea_m2;
      const totalHeat_W = loads2.QF + loads2.QR + loads2.QEV;
      const LMTD_req = totalHeat_W / PR / UA;
      const T3 = T2 + loads2.QEV / (Flow_m3h2 * CV * PR);
      const denomR = CV * Math.max(0.01, fixedTemps.TR - T3) * PR * Damp;
      const MR = denomR > 0 ? Math.min(Flow_m3h2, Math.max(0, loads2.QR / denomR)) : 0;
      const MF = Flow_m3h2 - MR;
      const T1 = (MF * fixedTemps.TF + MR * fixedTemps.TR) / Flow_m3h2;
      if (isInverterMode && (RPM < bounds[1][0] || RPM > bounds[1][1])) {
        return { error: `RPM ${RPM} out of bounds [${bounds[1][0]}, ${bounds[1][1]}]` };
      }
      if (!isInverterMode && (PR < bounds[1][0] || PR > bounds[1][1])) {
        return { error: `PR ${PR} out of bounds [${bounds[1][0]}, ${bounds[1][1]}]` };
      }
      if (innerOpts.debug) console.log(`[BALANCE-CHECK] QF=${loads2.QF.toFixed(2)} MF*CV*(TF-T3)*PR=${(MF * CV * (fixedTemps.TF - T3) * PR).toFixed(2)} T3=${T3.toFixed(2)} MF=${MF.toFixed(2)} MR=${MR.toFixed(2)} T1=${T1.toFixed(2)} PR=${PR}`);
      if (innerOpts.debug) console.log(`[LOADS-CHECK] QF=${loads2.QF} QR=${loads2.QR} QEV=${loads2.QEV} LMTD_req=${LMTD_req.toFixed(2)} UA=${UA.toFixed(2)} v_ms=${v_ms.toFixed(2)}`);
      const calculated_TE = solveTE_Brent(T1, T2, LMTD_req);
      if (!isFinite(calculated_TE)) {
        if (innerOpts.debug) console.warn(`[Physics Error] TE search failed. LMTD_req: ${LMTD_req.toFixed(2)}, T1: ${T1.toFixed(2)}, T2: ${T2.toFixed(2)}`);
        return { error: "TE search failed: LMTD impossible" };
      }
      convergedTE = calculated_TE;
      const comp2 = evaluateCompressorSafely(calculated_TE, TC, refIndex, compParams, RPM);
      const f1 = loads2.QF - MF * CV * (fixedTemps.TF - T3) * PR;
      const f2 = totalHeat_W - comp2.QCompressor * PR;
      return [f1, f2];
    };
    let res = newton2(F, initialGuess, [dx, dx], tol, maxIter, bounds, innerOpts.debug || true);
    if (!res.converged) {
      if (!res.error || !res.error.includes("undersized") && !res.error.includes("oversized")) {
        let fallbackGuesses;
        if (isInverterMode) {
          const rpmMin = compParams.rpmMin || 1e3;
          const rpmMax = compParams.rpmMax || 6e3;
          const midRPM = (rpmMin + rpmMax) / 2;
          fallbackGuesses = [
            [initialGuess[0], midRPM],
            [initialGuess[0] - 2, rpmMin],
            [initialGuess[0] + 2, rpmMax],
            [-21, midRPM]
          ];
        } else {
          fallbackGuesses = [
            [initialGuess[0], 0.4],
            [initialGuess[0] - 2, 0.5],
            [-21, 0.3]
          ];
        }
        for (const guess of fallbackGuesses) {
          res = newton2(F, guess, [dx, dx], tol, maxIter, bounds, innerOpts.debug || true);
          if (res.converged) break;
        }
      }
    }
    if (!res.converged) return { ...res, T2: res.x[0], PR: isInverterMode ? fixedPR : res.x[1], RPM: isInverterMode ? res.x[1] : void 0 };
    const fT2 = res.x[0], fPR = isInverterMode ? fixedPR : res.x[1], fRPM = isInverterMode ? res.x[1] : void 0;
    const Flow_m3h = fan.fanAirflow_m3h;
    const loads = calcHeatLoads(geom, { ...fixedTemps, T2: fT2, TC, PR: fPR, TE: convergedTE }, electrical, PIPEPITCH, condenserConfig.backCondenserEfficiency, fan.inputPower_W, freezerPos, condenserConfig.backCondenser);
    const comp = evaluateCompressorSafely(convergedTE, TC, refIndex, compParams, fRPM);
    const fT3 = fT2 + loads.QEV / (Flow_m3h * CV * fPR);
    const fDenomR = CV * Math.max(0.01, fixedTemps.TR - fT3) * fPR * Damp;
    const fMR = fDenomR > 0 ? Math.min(Flow_m3h, Math.max(0, loads.QR / fDenomR)) : 0;
    const fMF = Flow_m3h - fMR;
    return {
      T2: fT2,
      PR: fPR,
      RPM: fRPM,
      TE: convergedTE,
      converged: true,
      iterations: res.iterations,
      warning: res.warning,
      heatLoads: loads,
      compressor: { etaV: comp.VolumetricEfficiency, coolingCapacity: comp.QCompressor, inputPower: comp.CompPower, COP: comp.QCompressor / comp.CompPower, massFlow: comp.massFlow, Pe: comp.Pe, Pc: comp.Pc },
      MR: fMR,
      MF: fMF,
      T3: fT3
    };
  }
  function solveTE_Brent(T1, T2, LMTD_req, tol = 1e-4) {
    const f = (TE) => {
      try {
        return lmtd(T1, T2, TE) - LMTD_req;
      } catch (e) {
        return Infinity;
      }
    };
    const ABSOLUTE_MIN_TE = -65;
    const ABSOLUTE_MAX_TE = Math.min(T1, T2) - 0.1;
    let a = -40;
    let b = ABSOLUTE_MAX_TE;
    while (f(a) * f(b) > 0 && a > ABSOLUTE_MIN_TE) {
      a -= 10;
    }
    if (f(a) * f(b) > 0) return NaN;
    let fa = f(a), fb = f(b);
    if (fa > 0) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
    let c = a, fc = fa, mflag = true, s = 0, d = 0;
    for (let iter = 0; iter < 100; iter++) {
      if (fa !== fc && fb !== fc) {
        s = a * fb * fc / ((fa - fb) * (fa - fc)) + b * fa * fc / ((fb - fa) * (fb - fc)) + c * fa * fb / ((fc - fa) * (fc - fb));
      } else {
        s = b - fb * (b - a) / (fb - fa);
      }
      if (s < (3 * a + b) / 4 || s > b || mflag && Math.abs(s - b) >= Math.abs(b - c) / 2 || !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2 || mflag && Math.abs(b - c) < tol || !mflag && Math.abs(c - d) < tol) {
        s = (a + b) / 2;
        mflag = true;
      } else {
        mflag = false;
      }
      const fs = f(s);
      d = c;
      c = b;
      fc = fb;
      if (fa * fs < 0) {
        b = s;
        fb = fs;
      } else {
        a = s;
        fa = fs;
      }
      if (Math.abs(fa) < Math.abs(fb)) {
        [a, b] = [b, a];
        [fa, fb] = [fb, fa];
      }
      if (Math.abs(b - a) < tol || fb === 0) return b;
    }
    return b;
  }
  function calculateNewTE(result, fan, evapGeom, TF, TR) {
    const { MR, MF, T2 } = result;
    const Flow_m3h = fan.fanAirflow_m3h;
    const T1 = (MF * TF + MR * TR) / Flow_m3h;
    const faceArea_m2 = evapGeom.width_mm / 1e3 * (evapGeom.depth_mm / 1e3);
    const v_ms = Flow_m3h / 3600 / faceArea_m2;
    const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
    const NTU = alpha * evapGeom.evapArea_m2 / (Flow_m3h * CV);
    const effectiveness = 1 - Math.exp(-NTU);
    return effectiveness < 1e-6 ? T1 : T1 - (T1 - T2) / effectiveness;
  }
  function createFailure(TC, errorMsg, inner = {}) {
    return { converged: false, TC, T2: inner.T2 ?? NaN, PR: inner.PR ?? NaN, RPM: inner.RPM, TE: NaN, error: errorMsg, outerIterations: 0, innerTotalIterations: 0 };
  }
  function solveThermalSystem(config, TE_override = null) {
    const {
      geom,
      compParams,
      condenserConfig,
      refrigerant,
      subcool,
      dischargeTemp,
      fixedTemps,
      fan,
      electrical,
      evapGeom,
      freezerPosition = "top",
      TC0 = 45,
      tolOuter = 1e-3,
      maxIterOuter = 50,
      innerOptions = {}
    } = config;
    if (!evapGeom) {
      throw new Error("FATAL: evapGeom is missing from the configuration payload.");
    }
    const TE = TE_override ?? config.initialTE;
    const fixedPR = config.inverterPR;
    const prop = getRefrigerantProperties(getRefrigerantIndex(refrigerant));
    let TC = TC0, totalInner = 0, prevF3, prevTC, prevInner = null;
    for (let iter = 0; iter < maxIterOuter; iter++) {
      if (TC < fixedTemps.T0) TC = fixedTemps.T0 + 2;
      if (TC > 90) TC = 90;
      let inner = solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPosition, prevInner ? { ...innerOptions, initialT2: prevInner.T2, initialPR: prevInner.PR, initialRPM: prevInner.RPM } : innerOptions, fixedPR, evapGeom);
      if (!inner.converged) {
        if (inner.error?.includes("undersized")) return createFailure(TC, "Compressor undersized.", inner);
        if (inner.error?.includes("oversized")) return createFailure(TC, "Compressor oversized.", inner);
        return createFailure(TC, "Inner loop failed.", inner);
      }
      totalInner += inner.iterations;
      prevInner = { T2: inner.T2, PR: inner.PR, RPM: inner.RPM };
      const QCout = calcQCout(geom, TC, fixedTemps.T0, fixedTemps.TF, fixedTemps.TR, inner.PR, { side: condenserConfig.sidePipePitch_mm, back: condenserConfig.backPipePitch_mm }, freezerPosition, condenserConfig.backCondenserEfficiency);
      const compOuter = evaluateCompressorSafely(TE, TC, getRefrigerantIndex(refrigerant), compParams, inner.RPM);
      const F3 = QCout.QCout - compOuter.massFlow * (prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET2, prop.satPressure(TC + KELVIN_OFFSET2)) - prop.liquidEnthalpy(TC - subcool)) / 3.6;
      if (Math.abs(F3) < tolOuter) return { TC, T2: inner.T2, PR: inner.PR, T3: inner.T3, RPM: inner.RPM, TE, Pe: inner.compressor.Pe, Pc: inner.compressor.Pc, converged: true, warnings: inner.warning ? [inner.warning] : [], outerIterations: iter + 1, innerTotalIterations: totalInner, heatLoads: inner.heatLoads, compressor: { ...inner.compressor }, MR: inner.MR, MF: inner.MF, fan, electrical };
      let innerPert = null;
      try {
        innerPert = solveInner(TC + 1e-3, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPosition, { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR, initialRPM: inner.RPM }, fixedPR, evapGeom);
      } catch (e) {
      }
      if (innerPert?.converged) {
        const compOuter_pert = evaluateCompressorSafely(TE, TC + 1e-3, getRefrigerantIndex(refrigerant), compParams, fixedPR !== void 0 ? innerPert.RPM : void 0);
        const QCout_pert = calcQCout(geom, TC + 1e-3, fixedTemps.T0, fixedTemps.TF, fixedTemps.TR, innerPert.PR, { side: condenserConfig.sidePipePitch_mm, back: condenserConfig.backPipePitch_mm }, freezerPosition, condenserConfig.backCondenserEfficiency);
        const F3_pert = QCout_pert.QCout - compOuter_pert.massFlow * (prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET2, prop.satPressure(TC + 1e-3 + KELVIN_OFFSET2)) - prop.liquidEnthalpy(TC + 1e-3 - subcool)) / 3.6;
        TC -= Math.max(-5, Math.min(5, F3 / ((F3_pert - F3) / 1e-3)));
      } else {
        if (prevF3 !== void 0 && prevTC !== void 0) TC -= Math.max(-5, Math.min(5, F3 / ((F3 - prevF3) / (Math.abs(TC - prevTC) < 1e-6 ? 1e-6 : TC - prevTC))));
        else TC += F3 > 0 ? -0.5 : 0.5;
      }
      prevF3 = F3;
      prevTC = TC;
    }
    return createFailure(TC, "Outer loop max iterations reached", prevInner);
  }
  function runThermalAnalysisDynamic(config) {
    let TE = config.initialTE, result, prevTE, prevError;
    for (let i = 0; i < 15; i++) {
      if (!(result = solveThermalSystem(config, TE)).converged) return result;
      const error = calculateNewTE(result, config.fan, config.evapGeom, config.fixedTemps.TF, config.fixedTemps.TR) - TE;
      console.log(`[TE-UPDATE] i=${i} TE=${TE} result.MR=${result.MR} result.MF=${result.MF} result.T2=${result.T2} newTE_raw=${error + TE} error=${error}`);
      if (Math.abs(error) < 0.1) {
        result.TE = TE + error;
        return evaluateSafetyCheckpoints(result, config, TE + error);
      }
      if (i > 0 && prevError !== void 0) TE += Math.max(-3, Math.min(3, -error * (TE - prevTE) / (error - prevError)));
      else TE += 0.5 * error;
      prevTE = TE - (i > 0 ? TE - prevTE : 0.5 * error);
      prevError = error;
    }
    return { converged: false, error: "Thermodynamic imbalance: TE loop failed." };
  }
  function evaluateSafetyCheckpoints(result, config, TE_conv) {
    result.warnings = result.warnings || [];
    if (TE_conv > result.T2) result.warnings.push(`Approach constraint flagged: TE > T2.`);
    else if (result.T2 - TE_conv > 2) result.warnings.push(`Approach constraint flagged: T2 - TE > 2 \xB0C.`);
    const peakConfig = { ...config, fixedTemps: { ...config.fixedTemps, T0: 43 }, solverOptions: { ...config.solverOptions, innerOptions: { ...config.solverOptions?.innerOptions || {} } } };
    if (config.compParams.isInverter) {
      peakConfig.solverOptions.innerOptions.initialRPM = config.compParams.rpmMax;
      peakConfig.inverterPR = 1;
    } else peakConfig.solverOptions.innerOptions.initialPR = 0.95;
    const peakResult = solveThermalSystem(peakConfig, TE_conv);
    if (!peakResult.converged) result.warnings.push("Peak heat load evaluation flagged: System cannot physically balance at 43 \xB0C.");
    else {
      const Flow_m3h = config.fan.fanAirflow_m3h;
      const faceArea_m2 = config.evapGeom.width_mm / 1e3 * (config.evapGeom.depth_mm / 1e3);
      const v_ms = Flow_m3h / 3600 / faceArea_m2;
      const alpha = 12.93 * Math.pow(v_ms, 0.415) * 1.16279;
      const UA = alpha * config.evapGeom.evapArea_m2;
      const LMTD_val = lmtd((result.MF * config.fixedTemps.TF + result.MR * config.fixedTemps.TR) / Flow_m3h, result.T2, result.T2 - 2);
      if (UA * LMTD_val < 1.15 * peakResult.heatLoads.totalLoad) {
        result.warnings.push(`Evaporator lacks 15% physical safety margin at 43\xB0C ambient.`);
      }
    }
    return result;
  }
  function EnergyConsumption(result) {
    if (result.converged === false) return NaN;
    const compPower = result.compressor.inputPower;
    const fanPower = result.fan.inputPower_W;
    const pwbOn = result.electrical.pwbOn_W;
    const pwbOff = result.electrical.pwbOff_W;
    const PR = result.PR;
    const defHeater = result.electrical.defrostHeater_W;
    const defOnMin = result.electrical.defrostOn_min;
    const defTimerPeriodH = result.electrical.timerPeriod_h;
    console.log("\n=== ENERGY CALCULATION DEBUG TRACE ===");
    console.table({
      "Compressor Power (W)": compPower,
      "Fan Input Power (W)": fanPower,
      "PWB On Power (W)": pwbOn,
      "PWB Off Power (W)": pwbOff,
      "Running Ratio (PR)": PR,
      "Defrost Heater (W)": defHeater,
      "Defrost On Time (min)": defOnMin,
      "Timer Period (h)": defTimerPeriodH
    });
    const activeCyclePower_W = (compPower + fanPower + pwbOn) * PR;
    const offCyclePower_W = pwbOff * (1 - PR);
    const dailyBaseEnergy_kWh = (activeCyclePower_W + offCyclePower_W) * 24 / 1e3;
    const actualDefrostInterval_h = defTimerPeriodH / PR;
    const defrostEventsPerDay = 24 / actualDefrostInterval_h;
    const dailyDefrostEnergy_kWh = defOnMin / 60 * defHeater * defrostEventsPerDay / 1e3;
    const totalDaily_kWh = dailyBaseEnergy_kWh + dailyDefrostEnergy_kWh;
    console.log(`[Component] Active Cycle Power:   ${activeCyclePower_W.toFixed(3)} W`);
    console.log(`[Component] Off Cycle Power:      ${offCyclePower_W.toFixed(3)} W`);
    console.log(`[Component] Actual Defrost Interval: ${actualDefrostInterval_h.toFixed(3)} h`);
    console.log(`[Component] Defrost Events/Day:   ${defrostEventsPerDay.toFixed(3)}`);
    console.log(`[Integration] Daily Base Energy:    ${dailyBaseEnergy_kWh.toFixed(4)} kWh`);
    console.log(`[Integration] Daily Defrost Energy: ${dailyDefrostEnergy_kWh.toFixed(4)} kWh`);
    console.log(`[Integration] TOTAL DAILY ENERGY:   ${totalDaily_kWh.toFixed(4)} kWh`);
    console.log("======================================\n");
    return {
      EnergyConsumption_kWhDay: totalDaily_kWh,
      EnergyConsumption_kWhMonth: totalDaily_kWh * 30
    };
  }

  // src/js/engine/geometry.js
  var DEFAULT_CABINET = Object.freeze({
    H: 1680,
    W: 800,
    D: 630,
    Hb: 260,
    Db1: 210,
    Db2: 230,
    doorGap: 10,
    packingPos: 15,
    airGap: 5,
    walls: {
      freezer: {
        top: 59.4,
        bottom: 70,
        left: 59.4,
        right: 59.4,
        door: 59.4,
        rear: 60
      },
      refrigerator: {
        top: 70,
        bottom1: 40,
        bottom2: 40,
        bottom3: 40,
        left: 40,
        right: 40,
        door: 40,
        rear: 60
      }
    }
  });
  function toThermalFormat(geom) {
    const { H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos, walls, dividerThickness } = geom;
    const isBottomFreezer = geom._compartments && geom._compartments[0].type === "fresh";
    const isTopFreezer = geom._compartments && geom._compartments[0].type === "freezer";
    const divThick = dividerThickness ?? 60;
    return {
      H,
      W,
      D,
      Hf,
      Hr,
      Hb,
      Db1,
      Db2,
      doorGap,
      packingPos,
      // Freezer walls: Assign the partition thickness to tFtop in a bottom freezer configuration, 
      // or tFbottom in a top freezer configuration.
      tFtop: isBottomFreezer ? divThick : walls.freezer.top,
      tFleft: walls.freezer.left,
      tFright: walls.freezer.right,
      tFbottom: isTopFreezer ? divThick : walls.freezer.bottom,
      tFdoor: walls.freezer.door,
      tFback: walls.freezer.rear,
      tEvaBack: walls.freezer.rear,
      // Refrigerator walls: Assign the partition thickness to tRfloor in a bottom freezer configuration, 
      // or tRtop in a top freezer configuration.
      tRtop: isTopFreezer ? divThick : walls.refrigerator.top,
      tRleft: walls.refrigerator.left,
      tRright: walls.refrigerator.right,
      tRback: walls.refrigerator.rear,
      tRdoor: walls.refrigerator.door,
      tRbottom1: walls.refrigerator.bottom1,
      tRbottom2: walls.refrigerator.bottom2,
      tRbottom3: walls.refrigerator.bottom3,
      // Isolate the exterior stepped floor thickness for the freezer compartment 
      // (fallback to refrigerator mappings if undefined).
      tFfloor1: walls.freezer.bottom1 ?? walls.refrigerator.bottom1,
      tFfloor2: walls.freezer.bottom2 ?? walls.refrigerator.bottom2,
      tFfloor3: walls.freezer.bottom3 ?? walls.refrigerator.bottom3,
      // Explicitly assign the internal partition to tRfloor for bottom freezer configs.
      tRfloor: isBottomFreezer ? divThick : walls.refrigerator.bottom1
    };
  }

  // src/js/engine/thermo/index.js
  function runThermoAnalysis(config) {
    const errors = [];
    const warnings = [];
    if (!config) {
      errors.push("No configuration provided.");
      return { success: false, errors, warnings, results: null };
    }
    const required = [
      "geom",
      "compParams",
      "condenserConfig",
      "refrigerant",
      "subcool",
      "dischargeTemp",
      "fixedTemps",
      "fan",
      "electrical",
      "evapGeom"
    ];
    for (const key of required) {
      if (config[key] === void 0) errors.push(`Missing required config field: ${key}`);
    }
    if (config.fixedTemps && [config.fixedTemps.T0, config.fixedTemps.TF, config.fixedTemps.TR, config.fixedTemps.TE].some((v) => typeof v !== "number")) {
      errors.push("fixedTemps must contain numeric T0, TF, TR, TE.");
    }
    if (config.fan) {
      if (!config.fan.fanAirflow_m3h) errors.push("fan.fanAirflow_m3h is required.");
      config.fan.density = config.fan.density ?? PHYSICAL_CONSTANTS.air.density;
      config.fan.cp = config.fan.cp ?? PHYSICAL_CONSTANTS.air.cp;
    }
    if (errors.length > 0) return { success: false, errors, warnings, results: null };
    const solverOptions = {
      TC0: 54.4,
      DH: 1e-3,
      tolOuter: 5e-4,
      maxIterOuter: 100,
      innerOptions: { dx: 1e-3, tol: 1e-4, maxIter: 100 },
      ...config.solverOptions || {}
    };
    if (config.inverterPR !== void 0) solverOptions.inverterPR = config.inverterPR;
    try {
      const result = runThermalAnalysisDynamic({
        ...config,
        geom: config.geom,
        compParams: config.compParams,
        condenserConfig: config.condenserConfig,
        refrigerant: config.refrigerant,
        subcool: config.subcool,
        dischargeTemp: config.dischargeTemp,
        fixedTemps: config.fixedTemps,
        fan: config.fan,
        electrical: config.electrical,
        freezerPosition: config.freezerPosition || "top",
        initialTE: config.fixedTemps.TE,
        ...solverOptions
      });
      if (!result.converged) {
        errors.push(result.error || "Thermal solver did not converge.");
        return { success: false, errors, warnings, results: null };
      }
      const output = {
        TC: result.TC,
        T2: result.T2,
        PR: result.PR,
        TE: result.TE,
        heatLoads: {
          QF: result.heatLoads.QF,
          QR: result.heatLoads.QR,
          QEV: result.heatLoads.QEV,
          fanLoad: result.heatLoads.fanLoad,
          defrostLoad: result.heatLoads.defrostLoad,
          totalLoad: result.heatLoads.totalLoad
        },
        compressor: {
          massFlow: result.compressor.massFlow,
          coolingCapacity: result.compressor.coolingCapacity,
          inputPower: result.compressor.inputPower,
          etaV: result.compressor.etaV,
          Pe: result.compressor.Pe,
          Pc: result.compressor.Pc,
          COP: result.compressor.COP
        },
        fan: result.fan,
        electrical: result.electrical,
        iterations: {
          outer: result.outerIterations,
          innerTotal: result.innerTotalIterations
        },
        MR: result.MR,
        MF: result.MF,
        T3: result.T3
      };
      if (result.RPM !== void 0) output.RPM = result.RPM;
      if (result.warnings && result.warnings.length > 0) warnings.push(...result.warnings);
      if (result.PR >= 1) warnings.push("Compressor running ratio reached 100% \u2013 system may be undersized.");
      else if (result.PR <= 0.1) warnings.push("Compressor running ratio very low \u2013 check heat load inputs.");
      return { success: true, errors: [], warnings, results: output };
    } catch (err) {
      errors.push(`Unexpected error in thermal analysis: ${err.message}`);
      return { success: false, errors, warnings, results: null };
    }
  }
  function buildDefaultConfig(overrides = {}) {
    const { compressor: compRaw, condenser: condRaw, fan, electrical } = SJ54H_COMPONENTS;
    const base = {
      geom: toThermalFormat(DEFAULT_CABINET),
      compParams: {
        name: compRaw.name,
        cylinderVolumeCm3: compRaw.Vc,
        speedRpm: compRaw.rpm,
        rpm0: compRaw.rpm0,
        T_suction: compRaw.T_suction,
        wCoeffs: [compRaw.powerCoeffs.AW, compRaw.powerCoeffs.BW, compRaw.powerCoeffs.CW, compRaw.powerCoeffs.DW, compRaw.powerCoeffs.EW],
        etaCoeffs: [compRaw.volEffCoeffs.A, compRaw.volEffCoeffs.B, compRaw.volEffCoeffs.C]
      },
      condenserConfig: {
        sidePipePitch_mm: condRaw.sidePipePitch_mm,
        backPipePitch_mm: condRaw.backPipePitch_mm,
        backCondenserEfficiency: condRaw.backCondenserEfficiency,
        backCondenser: "Yes"
      },
      refrigerant: "R-600a",
      subcool: SJ54H_COMPONENTS.subcool_K,
      dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
      fixedTemps: {
        T0: 30,
        TF: -18,
        TR: 3,
        TE: -23.3
      },
      fan: {
        fanAirflow_m3h: fan.totalAirflow_m3h,
        totalAirflow: fan.totalAirflow_m3h,
        inputPower_W: fan.inputPower_W
      },
      electrical: { ...electrical },
      freezerPosition: "top",
      initialTE: -25.27,
      solverOptions: {
        TC0: 54.4,
        DH: 1e-3,
        tolOuter: 5e-4,
        maxIterOuter: 100,
        innerOptions: { dx: 1e-3, tol: 1e-4, maxIter: 100, initialT2: -21.25, initialPR: 0.59 }
      }
    };
    return deepMerge2(base, overrides);
  }
  function deepMerge2(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        out[key] = deepMerge2(out[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }

  // src/js/engine/traversal.js
  var DIM_TOL = 0.01;
  function traverseAndComputePrecise(rootNode, geometry) {
    const errors = [];
    const warnings = [];
    const leaves = [];
    if (rootNode.nodeType !== "horizontal") {
      errors.push({ rule: "layout", message: "Root node must be horizontal for precise calc" });
      return { leaves, errors, warnings };
    }
    const firstChild = rootNode.children[0]?.node;
    if (!firstChild || firstChild.nodeType !== "leaf") {
      errors.push({ rule: "layout", message: "First child must be a leaf" });
      return { leaves, errors, warnings };
    }
    const topWallKey = firstChild.type === "fresh" ? "refrigerator" : firstChild.type;
    const topWalls = geometry.walls[topWallKey];
    if (!topWalls) {
      errors.push({ rule: "layout", message: `Unknown wall type: ${firstChild.type}` });
      return { leaves, errors, warnings };
    }
    const topInsul = topWalls.top;
    const topY = topInsul;
    const lastChild = rootNode.children[rootNode.children.length - 1]?.node;
    if (!lastChild || lastChild.nodeType !== "leaf") {
      errors.push({ rule: "layout", message: "Last child must be a leaf" });
      return { leaves, errors, warnings };
    }
    const bottomWallKey = lastChild.type === "fresh" ? "refrigerator" : lastChild.type;
    const bottomWalls = geometry.walls[bottomWallKey];
    if (!bottomWalls) {
      errors.push({ rule: "layout", message: `Unknown wall type: ${lastChild.type}` });
      return { leaves, errors, warnings };
    }
    let floorLowerY;
    if (bottomWalls.bottom1 === void 0) {
      errors.push({ rule: "layout", message: `Wall definition for type '${lastChild.type}' is missing 'bottom1' thickness for stepped floor calculation.` });
      return { leaves, errors, warnings };
    }
    floorLowerY = geometry.H - (bottomWalls.bottom3 || bottomWalls.bottom1);
    const totalAvailableHeight = floorLowerY - topY;
    const dividers = rootNode.dividers || [];
    const totalDividerH = dividers.reduce((s, d) => s + (d.thickness || 0), 0);
    const mode = rootNode.children[0].heightMode;
    let childHeights;
    if (mode === "ratio") {
      const usableH = totalAvailableHeight - totalDividerH;
      childHeights = rootNode.children.map((c) => usableH * c.heightValue);
    } else {
      const sumHeights = rootNode.children.reduce((s, c) => s + c.heightValue, 0);
      const total = sumHeights + totalDividerH;
      if (Math.abs(total - totalAvailableHeight) > DIM_TOL) {
        errors.push({
          rule: "heightBalance_explicit",
          nodeId: rootNode.id,
          message: `Sum of heights (${sumHeights}) + dividers (${totalDividerH}) = ${total} \u2260 availableHeight (${totalAvailableHeight})`,
          childrenSkipped: true
        });
        return { leaves, errors, warnings };
      }
      childHeights = rootNode.children.map((c) => c.heightValue);
    }
    let yOffset = topY;
    for (let i = 0; i < rootNode.children.length; i++) {
      const childNode = rootNode.children[i].node;
      const height = childHeights[i];
      const isBottommost = i === rootNode.children.length - 1;
      if (childNode.nodeType === "leaf") {
        const result = calcLeafGrossPrecise(childNode, height, geometry, yOffset, isBottommost);
        leaves.push(result);
      } else {
        errors.push({ rule: "layout", message: "Nested splits not supported in precise model" });
      }
      yOffset += height;
      if (i < rootNode.children.length - 1) {
        yOffset += dividers[i]?.thickness || 0;
      }
    }
    return { leaves, errors, warnings };
  }

  // src/js/ui/thermoUI.js
  var thermalAdvanced = {
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fanInputPower: SJ54H_COMPONENTS.fan.inputPower_W,
    defHeater: SJ54H_COMPONENTS.electrical.defrostHeater_W,
    defOnMin: SJ54H_COMPONENTS.electrical.defrostOn_min,
    pwbOn: SJ54H_COMPONENTS.electrical.pwbOn_W,
    pwbOff: SJ54H_COMPONENTS.electrical.pwbOff_W,
    timerPeriod: SJ54H_COMPONENTS.electrical.timerPeriod_h,
    Damp: 0.6
  };
  var getGeometryFn = () => null;
  var thermalModal = null;
  var thermalModalInputs = {};
  function initThermoUI(options) {
    if (typeof options === "function") {
      getGeometryFn = options;
    } else if (options && options.getGeometry) {
      getGeometryFn = options.getGeometry;
    }
    const panelThermal = document.getElementById("panelThermal");
    if (panelThermal) {
      panelThermal.innerHTML = `
      <button id="thermoRunBtn">Run Thermal Analysis</button>
      <div id="thermoErrors"></div>
      <fieldset>
        <legend>Constant\u2011Speed Compressor</legend>
        <label>Ambient T0 (\xB0C): <input type="number" id="thermoT0" value="30" step="any"></label>
        <label>Freezer TF (\xB0C): <input type="number" id="thermoTF" value="-18" step="any"></label>
        <label>Refrigerator TR (\xB0C): <input type="number" id="thermoTR" value="3" step="any"></label>
        <label>Refrigerant:
          <select id="thermoRefrigerant">
            <option value="R-600a">R-600a</option>
            <option value="R-134a">R-134a</option>
          </select>
        </label>
        <button id="thermoAdvancedBtn" type="button">\u2699\uFE0F Advanced</button>
      </fieldset>
    `;
      document.getElementById("thermoRunBtn").addEventListener("click", handleRun);
      document.getElementById("thermoAdvancedBtn").addEventListener("click", openThermalSettings);
    }
    const panelInverter = document.getElementById("panelInverter");
    if (panelInverter) {
      panelInverter.innerHTML = `
      <button id="inverterRunBtn">Run Inverter Analysis</button>
      <div id="inverterErrors"></div>
      <fieldset>
        <legend>Inverter Compressor</legend>
        <p style="margin:0; font-size:0.9em; color:#555;">
          \u2699\uFE0F Uses the compressor selected in <strong>Advanced Settings</strong>.
          <br>Ensure it is an inverter type.
        </p>
        <p id="currentInverterName" style="margin:4px 0 0; font-weight:bold;">\u2014</p>

        <label>Running Ratio PR:
          <input type="number" id="inverterPR" value="0.85" step="0.01" min="0.01" max="1">
        </label>
        <label>Ambient T0 (\xB0C):
          <input type="number" id="inverterT0" value="30" step="any">
        </label>
        <label>Freezer TF (\xB0C):
          <input type="number" id="inverterTF" value="-18" step="any">
        </label>
        <label>Refrigerator TR (\xB0C):
          <input type="number" id="inverterTR" value="3" step="any">
        </label>
        <label>Refrigerant:
          <select id="inverterRefrigerant">
            <option value="R-600a">R-600a</option>
            <option value="R-134a">R-134a</option>
          </select>
        </label>
        <button id="inverterAdvancedBtn" type="button">\u2699\uFE0F Advanced</button>
      </fieldset>
    `;
      document.getElementById("inverterRunBtn").addEventListener("click", handleInverterRun);
      document.getElementById("inverterAdvancedBtn").addEventListener("click", openThermalSettings);
    }
    refreshInverterCompressorSelect();
    const saved = localStorage.getItem("thermoAdvanced");
    if (saved) thermalAdvanced = { ...thermalAdvanced, ...JSON.parse(saved) };
    buildThermalModalOnce();
    updateInverterCompressorDisplay();
  }
  function buildThermalModalOnce() {
    thermalModal = document.getElementById("thermalSettingsModal");
    if (!thermalModal) {
      thermalModal = document.createElement("div");
      thermalModal.id = "thermalSettingsModal";
      thermalModal.className = "modal hidden";
      document.body.appendChild(thermalModal);
    }
    thermalModal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn" id="closeThermalSettings">&times;</span>
      <h2>Thermal Design Parameters</h2>

      <fieldset>
        <legend>Condenser</legend>
        <label>Side pipe pitch (mm): <input type="number" id="thermoCondSidePitch" step="any"></label>
        <label>Back pipe pitch (mm): <input type="number" id="thermoCondBackPitch" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Evaporator</legend>
        <label>Width (mm): <input id="evapWidth" type="number" step="any"></label>
        <label>Height (mm): <input id="evapHeight" type="number" step="any"></label>
        <label>Depth (mm): <input id="thermoEvapDepth" type="number" step="any"></label>
        <label>Rows: <input id="evapRows" type="number" step="any"></label>
        <label>Layers: <input id="evapLayers" type="number" step="any"></label>
        <label>Tube OD (mm): <input id="evapTubeOD" type="number" step="any"></label>
        <label>Fin Height (mm): <input id="evapFinHeight" type="number" step="any"></label>
        <label>Fin Length (mm): <input id="evapFinLength" type="number" step="any"></label>
        <label>Number of Fins: <input id="evapNumFins" type="number" step="any"></label>
        <label>Side Plates: <input id="evapSidePlateNo" type="number" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Fan Parameters</legend>
        <label>Tip Diameter (mm): <input id="tipDiam_mm" type="number" step="any"></label>
        <label>RPM: <input id="fanRPM" type="number" step="any"></label>
        <label>Hub Diameter (mm): <input id="hubDiam_mm" type="number" step="any"></label>
        <label>Pitch Angle (\xB0): <input id="PitchAngle_degree" type="number" step="any"></label>
        <label>Input power (W): <input type="number" id="thermoFanInputPower" step="any" min="0"></label>
      </fieldset>

      <fieldset>
        <legend>Compressor</legend>
        <label>Current Compressor: <select id="thermoCompressorSelect"></select></label>
        <button id="thermoAddCompressorBtn" type="button">Add Compressor</button>
        <button id="thermoEditCompressorBtn" type="button">Edit Selected</button>
        <button id="thermoDeleteCompressorBtn" type="button">Delete Selected</button>
      </fieldset>

      <fieldset>
        <legend>Subcool &amp; Discharge</legend>
        <label>Subcool (K): <input type="number" id="thermoSubcool" step="any"></label>
        <label>Discharge temp (\xB0C): <input type="number" id="thermoDiscTemp" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Electrical &amp; Defrost</legend>
        <label>PWB On Power (W): <input type="number" id="thermoPwbOn" step="any"></label>
        <label>PWB Standby Power (W): <input type="number" id="thermoPwbOff" step="any"></label>
        <label>Defrost Heater (W): <input type="number" id="thermoDefHeater" step="any"></label>
        <label>Defrost On time (min): <input type="number" id="thermoDefOn" step="any"></label>
        <label>Timer Period (h): <input type="number" id="thermoTimerPeriod" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Damper</legend>
        <label>Damper Ratio:
          <input type="number" id="thermoDamp" step="any">
        </label>
      </fieldset>


      <div class="settings-actions">
        <button id="saveThermalSettings">Save &amp; Close</button>
      </div>
    </div>
  `;
    thermalModalInputs = {
      condSidePitch: document.getElementById("thermoCondSidePitch"),
      condBackPitch: document.getElementById("thermoCondBackPitch"),
      evapWidth: document.getElementById("evapWidth"),
      evapHeight: document.getElementById("evapHeight"),
      thermoEvapDepth: document.getElementById("thermoEvapDepth"),
      evapRows: document.getElementById("evapRows"),
      evapLayers: document.getElementById("evapLayers"),
      evapTubeOD: document.getElementById("evapTubeOD"),
      evapFinHeight: document.getElementById("evapFinHeight"),
      evapFinLength: document.getElementById("evapFinLength"),
      evapNumFins: document.getElementById("evapNumFins"),
      evapSidePlateNo: document.getElementById("evapSidePlateNo"),
      tipDiam_mm: document.getElementById("tipDiam_mm"),
      fanRPM: document.getElementById("fanRPM"),
      hubDiam_mm: document.getElementById("hubDiam_mm"),
      PitchAngle_degree: document.getElementById("PitchAngle_degree"),
      fanInputPower: document.getElementById("thermoFanInputPower"),
      compressorSelect: document.getElementById("thermoCompressorSelect"),
      subcool: document.getElementById("thermoSubcool"),
      dischargeTemp: document.getElementById("thermoDiscTemp"),
      defHeater: document.getElementById("thermoDefHeater"),
      defOn: document.getElementById("thermoDefOn"),
      pwbOn: document.getElementById("thermoPwbOn"),
      pwbOff: document.getElementById("thermoPwbOff"),
      damp: document.getElementById("thermoDamp"),
      timerPeriod: document.getElementById("thermoTimerPeriod")
    };
    document.getElementById("closeThermalSettings").onclick = () => thermalModal.classList.add("hidden");
    document.getElementById("thermoAddCompressorBtn").onclick = openAddCompressorModal;
    document.getElementById("thermoEditCompressorBtn").onclick = openEditCompressorModal;
    document.getElementById("thermoDeleteCompressorBtn").onclick = () => {
      const sel = thermalModalInputs.compressorSelect;
      if (confirm("Delete the selected compressor?")) {
        deleteCompressor(sel.value);
        refreshCompressorSelect();
      }
    };
    thermalModalInputs.compressorSelect.onchange = (e) => {
      setSelectedCompressor(e.target.value);
    };
    document.getElementById("saveThermalSettings").onclick = saveThermalSettings;
    thermalModal.onclick = (e) => {
      if (e.target === thermalModal) thermalModal.classList.add("hidden");
    };
  }
  function openThermalSettings() {
    loadCompressors();
    const cond = settings.condenser || { sidePipePitch_mm: 50, backPipePitch_mm: 50 };
    thermalModalInputs.condSidePitch.value = cond.sidePipePitch_mm;
    thermalModalInputs.condBackPitch.value = cond.backPipePitch_mm;
    const evap = settings.evaporator || {};
    thermalModalInputs.evapWidth.value = evap.width_mm ?? 460;
    thermalModalInputs.evapHeight.value = evap.height_mm ?? 150;
    thermalModalInputs.thermoEvapDepth.value = evap.depth_mm ?? 60;
    thermalModalInputs.evapRows.value = evap.rows ?? 7;
    thermalModalInputs.evapLayers.value = evap.layers ?? 2;
    thermalModalInputs.evapTubeOD.value = evap.tubeOD_mm ?? 8;
    thermalModalInputs.evapFinHeight.value = evap.finHeight_mm ?? 150;
    thermalModalInputs.evapFinLength.value = evap.finLength_mm ?? 460;
    thermalModalInputs.evapNumFins.value = evap.numFins ?? 32;
    thermalModalInputs.evapSidePlateNo.value = evap.sidePlateNo ?? 0;
    const fanP = settings.fanParam || {};
    thermalModalInputs.tipDiam_mm.value = fanP.tipDiam_mm ?? 110;
    thermalModalInputs.fanRPM.value = fanP.fanRPM ?? 2200;
    thermalModalInputs.hubDiam_mm.value = fanP.hubDiam_mm ?? 45.6;
    thermalModalInputs.PitchAngle_degree.value = fanP.PitchAngle_degree ?? 30;
    thermalModalInputs.fanInputPower.value = thermalAdvanced.fanInputPower;
    thermalModalInputs.subcool.value = thermalAdvanced.subcool;
    thermalModalInputs.dischargeTemp.value = thermalAdvanced.dischargeTemp;
    thermalModalInputs.defHeater.value = thermalAdvanced.defHeater;
    thermalModalInputs.defOn.value = thermalAdvanced.defOnMin;
    thermalModalInputs.pwbOn.value = thermalAdvanced.pwbOn;
    thermalModalInputs.pwbOff.value = thermalAdvanced.pwbOff;
    thermalModalInputs.timerPeriod.value = thermalAdvanced.timerPeriod;
    thermalModalInputs.damp.value = thermalAdvanced.Damp;
    refreshCompressorSelect();
    updateInverterCompressorDisplay();
    thermalModal.classList.remove("hidden");
  }
  function refreshCompressorSelect() {
    const select = thermalModalInputs.compressorSelect;
    select.innerHTML = "";
    const compressors = getCompressorList();
    const currentId = getCurrentCompressor()?.id;
    compressors.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      opt.selected = c.id === currentId;
      select.appendChild(opt);
    });
  }
  function saveThermalSettings() {
    settings.condenser = {
      sidePipePitch_mm: parseFloat(thermalModalInputs.condSidePitch.value),
      backPipePitch_mm: parseFloat(thermalModalInputs.condBackPitch.value)
    };
    settings.evaporator = {
      width_mm: parseFloat(thermalModalInputs.evapWidth.value),
      height_mm: parseFloat(thermalModalInputs.evapHeight.value),
      depth_mm: parseFloat(thermalModalInputs.thermoEvapDepth.value),
      rows: parseInt(thermalModalInputs.evapRows.value),
      layers: parseInt(thermalModalInputs.evapLayers.value),
      tubeOD_mm: parseFloat(thermalModalInputs.evapTubeOD.value),
      finHeight_mm: parseFloat(thermalModalInputs.evapFinHeight.value),
      finLength_mm: parseFloat(thermalModalInputs.evapFinLength.value),
      numFins: parseInt(thermalModalInputs.evapNumFins.value),
      sidePlateNo: parseInt(thermalModalInputs.evapSidePlateNo.value)
    };
    settings.fanParam = {
      tipDiam_mm: parseFloat(thermalModalInputs.tipDiam_mm.value),
      fanRPM: parseFloat(thermalModalInputs.fanRPM.value),
      hubDiam_mm: parseFloat(thermalModalInputs.hubDiam_mm.value),
      PitchAngle_degree: parseFloat(thermalModalInputs.PitchAngle_degree.value)
    };
    updateSettings(settings);
    thermalAdvanced.subcool = parseFloat(thermalModalInputs.subcool.value) || SJ54H_COMPONENTS.subcool_K;
    thermalAdvanced.dischargeTemp = parseFloat(thermalModalInputs.dischargeTemp.value) || SJ54H_COMPONENTS.dischargeTemp_C;
    thermalAdvanced.fanInputPower = parseFloat(thermalModalInputs.fanInputPower.value) || SJ54H_COMPONENTS.fan.inputPower_W;
    thermalAdvanced.defHeater = parseFloat(thermalModalInputs.defHeater.value) || SJ54H_COMPONENTS.electrical.defrostHeater_W;
    thermalAdvanced.defOnMin = parseFloat(thermalModalInputs.defOn.value) || SJ54H_COMPONENTS.electrical.defrostOn_min;
    thermalAdvanced.pwbOn = parseFloat(thermalModalInputs.pwbOn.value) || SJ54H_COMPONENTS.electrical.pwbOn_W;
    thermalAdvanced.pwbOff = parseFloat(thermalModalInputs.pwbOff.value) || SJ54H_COMPONENTS.electrical.pwbOff_W;
    thermalAdvanced.timerPeriod = parseFloat(thermalModalInputs.timerPeriod.value) || SJ54H_COMPONENTS.electrical.timerPeriod_h;
    localStorage.setItem("thermoAdvanced", JSON.stringify(thermalAdvanced));
    thermalAdvanced.Damp = parseFloat(thermalModalInputs.damp.value) || 1;
    const compSelect = thermalModalInputs.compressorSelect;
    if (compSelect) setSelectedCompressor(compSelect.value);
    updateInverterCompressorDisplay();
    thermalModal.classList.add("hidden");
  }
  function parseCompressorDataFile(file, wantsInverter = false) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet);
          const headers = Object.keys(rows[0] || {});
          const findCol = (candidates) => headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c)));
          const teCol = findCol(["te", "evap temp"]);
          const tcCol = findCol(["tc", "cond temp"]);
          const wCol = findCol(["w", "power"]);
          const qCol = findCol(["q", "capacity"]);
          if (!teCol || !tcCol || !wCol || !qCol) {
            return reject(new Error("Missing TE/TC/W/Q columns."));
          }
          if (wantsInverter) {
            const rpmCol = findCol(["rpm", "speed", "r/min"]);
            if (!rpmCol) return reject(new Error("RPM column missing \u2013 required for inverter."));
            const data = rows.map((r) => ({
              RPM: parseFloat(r[rpmCol]),
              TE: parseFloat(r[teCol]),
              TC: parseFloat(r[tcCol]),
              W: parseFloat(r[wCol]),
              Q: parseFloat(r[qCol])
            })).filter((d) => Object.values(d).every((v) => !isNaN(v)));
            if (data.length < 5) return reject(new Error(`Only ${data.length} valid points.`));
            resolve(data);
          } else {
            const data = rows.map((r) => ({
              TE: parseFloat(r[teCol]),
              TC: parseFloat(r[tcCol]),
              W: parseFloat(r[wCol]),
              Q: parseFloat(r[qCol])
            })).filter((d) => Object.values(d).every((v) => !isNaN(v)));
            if (data.length < 5) return reject(new Error(`Only ${data.length} valid points.`));
            resolve(data);
          }
        } catch (err) {
          reject(new Error("Parsing error: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsArrayBuffer(file);
    });
  }
  function buildDataTable(dataPoints, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = `<table class="data-table" style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead><tr><th>TE (\xB0C)</th><th>TC (\xB0C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
    dataPoints.forEach((dp) => {
      html += `<tr><td>${dp.TE.toFixed(2)}</td><td>${dp.TC.toFixed(2)}</td><td>${dp.W.toFixed(2)}</td><td>${dp.Q.toFixed(2)}</td></tr>`;
    });
    html += `</tbody></table><p>${dataPoints.length} data points loaded.</p>`;
    container.innerHTML = html;
  }
  function openAddCompressorModal() {
    let modal = document.getElementById("addCompressorModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "addCompressorModal";
      modal.className = "modal hidden";
      document.body.appendChild(modal);
    }
    let contentDiv = document.getElementById("addCompressorContent");
    if (!contentDiv) {
      contentDiv = document.createElement("div");
      contentDiv.id = "addCompressorContent";
      modal.appendChild(contentDiv);
    }
    contentDiv.innerHTML = `
    <fieldset>
      <legend>Compressor Type</legend>
      <label><input type="radio" name="compType" value="constant" checked> Constant\u2011Speed</label>
      <label><input type="radio" name="compType" value="inverter"> Inverter</label>
    </fieldset>

    <fieldset>
      <legend>Basic Information</legend>
      <label>Name: <input id="acName" type="text" value=""></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1">R-134a</option>
          <option value="2" selected>R-600a</option>
        </select>
      </label>
    </fieldset>

    <div id="constantFields">
      <fieldset>
        <legend>Constant\u2011Speed Data</legend>
        <label>Cyl. Volume (cm\xB3): <input id="acCyl" type="number" step="any"></label>
        <label>Speed (rpm): <input id="acRpm" type="number" step="any"></label>
      </fieldset>
      <fieldset>
        <legend>Load Performance Data from Excel</legend>
        <input type="file" id="acFileInput" accept=".xlsx,.xls,.csv">
        <button id="acLoadBtn" type="button">Load Data</button>
        <div id="acDataContainer"><p>No data loaded yet.</p></div>
      </fieldset>
    </div>

    <div id="inverterFields" style="display:none;">
      <fieldset>
        <legend>Basic Information</legend>
        <label>Name: <input id="acInvName" type="text" value=""></label>
        <label>Refrigerant:
          <select id="acInvRef">
            <option value="1">R-134a</option>
            <option value="2" selected>R-600a</option>
          </select>
        </label>
        <label>Cyl. Volume (cm\xB3): <input id="acInvCyl" type="number" step="any" value="10.17"></label>
      </fieldset>
      <fieldset>
        <legend>Load Performance Data from Excel</legend>
        <input type="file" id="acInvFileInput" accept=".xlsx,.xls,.csv">
        <button id="acInvLoadBtn" type="button">Load Data</button>
        <div id="acInvDataContainer"><p>No data loaded yet.</p></div>
      </fieldset>
    </div>

    <div id="acError" class="error-msg"></div>
    <div class="settings-actions">
      <button id="fitCompressorBtn">Add Compressor</button>
      <button id="cancelAddCompressor">Cancel</button>
    </div>
  `;
    modal.classList.remove("hidden");
    document.querySelectorAll('input[name="compType"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const isInverter = e.target.value === "inverter";
        document.getElementById("constantFields").style.display = isInverter ? "none" : "block";
        document.getElementById("inverterFields").style.display = isInverter ? "block" : "none";
      });
    });
    let loadedDataPoints = null;
    let loadedInverterPoints = null;
    document.getElementById("acLoadBtn").onclick = async () => {
      const file = document.getElementById("acFileInput").files[0];
      if (!file) {
        document.getElementById("acError").textContent = "Please select a file.";
        return;
      }
      try {
        const points = await parseCompressorDataFile(file);
        loadedDataPoints = points;
        buildDataTable(points, "acDataContainer");
        document.getElementById("acError").textContent = "";
      } catch (err) {
        document.getElementById("acError").textContent = err.message;
        loadedDataPoints = null;
      }
    };
    document.getElementById("acInvLoadBtn").onclick = async () => {
      const file = document.getElementById("acInvFileInput").files[0];
      if (!file) {
        document.getElementById("acError").textContent = "Please select a file.";
        return;
      }
      try {
        const points = await parseCompressorDataFile(file, true);
        loadedInverterPoints = points;
        let html = `<table class="data-table" style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr><th>RPM</th><th>TE (\xB0C)</th><th>TC (\xB0C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
        points.forEach((dp) => {
          html += `<tr><td>${dp.RPM.toFixed(0)}</td><td>${dp.TE.toFixed(2)}</td><td>${dp.TC.toFixed(2)}</td><td>${dp.W.toFixed(2)}</td><td>${dp.Q.toFixed(2)}</td></tr>`;
        });
        html += `</tbody></table><p>${points.length} data points loaded.</p>`;
        document.getElementById("acInvDataContainer").innerHTML = html;
        document.getElementById("acError").textContent = "";
      } catch (err) {
        document.getElementById("acError").textContent = err.message;
        loadedInverterPoints = null;
      }
    };
    document.getElementById("cancelAddCompressor").onclick = () => modal.classList.add("hidden");
    document.getElementById("fitCompressorBtn").onclick = () => {
      const errorDiv = document.getElementById("acError");
      errorDiv.textContent = "";
      const compType = document.querySelector('input[name="compType"]:checked').value;
      const name = document.getElementById("acName").value.trim();
      const refIdx = parseInt(document.getElementById("acRef").value);
      if (!name) {
        errorDiv.textContent = "Name is required.";
        return;
      }
      if (compType === "constant") {
        if (!loadedDataPoints || loadedDataPoints.length < 5) {
          errorDiv.textContent = "Please load at least 5 data points.";
          return;
        }
        const cyl = parseFloat(document.getElementById("acCyl").value);
        const rpm = parseFloat(document.getElementById("acRpm").value);
        if (isNaN(cyl) || cyl <= 0) {
          errorDiv.textContent = "Invalid cylinder volume.";
          return;
        }
        if (isNaN(rpm) || rpm <= 0) {
          errorDiv.textContent = "Invalid speed.";
          return;
        }
        try {
          const { etaCoeffs, wCoeffs } = computeCompressorCoefficients({
            cylinderVolumeCm3: cyl,
            speedRpm: rpm,
            refrigerantIndex: refIdx,
            dataPoints: loadedDataPoints
          });
          addCompressor({
            id: name.replace(/\s/g, ""),
            name,
            model: name,
            voltage: 100,
            frequency: 50,
            cylinderVolumeCm3: cyl,
            speedRpm: rpm,
            refrigerantIndex: refIdx,
            wCoeffs,
            etaCoeffs,
            dataPoints: loadedDataPoints
          });
        } catch (err) {
          errorDiv.textContent = err.message;
          return;
        }
      } else {
        const invCyl = parseFloat(document.getElementById("acInvCyl")?.value) || 0;
        if (!loadedInverterPoints || loadedInverterPoints.length < 5) {
          errorDiv.textContent = "Load inverter data file (needs RPM, TE, TC, W, Q). At least 5 points required.";
          return;
        }
        try {
          const normalizeRPM = Math.max(...loadedInverterPoints.map((d) => d.RPM));
          const centerTE = loadedInverterPoints.reduce((s, d) => s + d.TE, 0) / loadedInverterPoints.length;
          const centerTC = loadedInverterPoints.reduce((s, d) => s + d.TC, 0) / loadedInverterPoints.length;
          const compressorModel = fitInverterCoefficients(
            loadedInverterPoints,
            normalizeRPM,
            centerTE,
            centerTC,
            3
          );
          const actualRpmMin = Math.min(...loadedInverterPoints.map((d) => d.RPM));
          const actualRpmMax = Math.max(...loadedInverterPoints.map((d) => d.RPM));
          addCompressor({
            id: name.replace(/\s/g, ""),
            name,
            model: name,
            voltage: 220,
            frequency: 50,
            isInverter: true,
            cylinderVolumeCm3: invCyl,
            refrigerantIndex: refIdx,
            compressorModel,
            dataPoints: loadedInverterPoints,
            rpmMin: actualRpmMin,
            rpmMax: actualRpmMax
          });
        } catch (e) {
          errorDiv.textContent = "Fitting failed: " + e.message;
          return;
        }
      }
      modal.classList.add("hidden");
      openThermalSettings();
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
  }
  function openEditCompressorModal() {
    let modal = document.getElementById("addCompressorModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "addCompressorModal";
      modal.className = "modal hidden";
      document.body.appendChild(modal);
    }
    let contentDiv = document.getElementById("addCompressorContent");
    if (!contentDiv) {
      contentDiv = document.createElement("div");
      contentDiv.id = "addCompressorContent";
      modal.appendChild(contentDiv);
    }
    loadCompressors();
    const comp = getCurrentCompressor();
    if (!comp) {
      alert("No compressor selected.");
      return;
    }
    const isInverter = comp.isInverter === true;
    const existingPoints = comp.dataPoints || [];
    const buildDataTableHTML = (points) => {
      if (!points || points.length === 0) return "<p>No data points stored.</p>";
      if (isInverter) {
        let html2 = `<table class="data-table"><thead><tr><th>RPM</th><th>TE (\xB0C)</th><th>TC (\xB0C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
        points.forEach((dp) => {
          html2 += `<tr><td>${dp.RPM?.toFixed(0) ?? "\u2014"}</td><td>${dp.TE?.toFixed(2) ?? "\u2014"}</td><td>${dp.TC?.toFixed(2) ?? "\u2014"}</td><td>${dp.W?.toFixed(2) ?? "\u2014"}</td><td>${dp.Q?.toFixed(2) ?? "\u2014"}</td></tr>`;
        });
        html2 += `</tbody></table><p>${points.length} points.</p>`;
        return html2;
      }
      let html = `<table class="data-table"><thead><tr><th>TE (\xB0C)</th><th>TC (\xB0C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
      points.forEach((dp) => {
        html += `<tr><td>${dp.TE?.toFixed(2) ?? "\u2014"}</td><td>${dp.TC?.toFixed(2) ?? "\u2014"}</td><td>${dp.W?.toFixed(2) ?? "\u2014"}</td><td>${dp.Q?.toFixed(2) ?? "\u2014"}</td></tr>`;
      });
      html += `</tbody></table><p>${points.length} points.</p>`;
      return html;
    };
    document.getElementById("addCompressorContent").innerHTML = `
    <h2>Edit Compressor</h2>
    <fieldset>
      <legend>Basic Information</legend>
      <label>Name: <input id="acName" type="text" value="${comp.name}"></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1" ${comp.refrigerantIndex === 1 ? "selected" : ""}>R-134a</option>
          <option value="2" ${comp.refrigerantIndex === 2 ? "selected" : ""}>R-600a</option>
        </select>
      </label>
      ${isInverter ? "" : `
        <label>Cyl. Volume (cm\xB3): <input id="acCyl" type="number" step="any" value="${comp.cylinderVolumeCm3}"></label>
        <label>Speed (rpm): <input id="acRpm" type="number" step="any" value="${comp.speedRpm}"></label>
      `}
      ${isInverter ? `
        <label>Cyl. Volume (cm\xB3) (for reference): <input id="acCyl" type="number" step="any" value="${comp.cylinderVolumeCm3 || ""}"></label>
      ` : ""}
    </fieldset>
    <fieldset>
      <legend>Current Data Points (${existingPoints.length} points)</legend>
      <div id="acDataContainer">${buildDataTableHTML(existingPoints)}</div>
    </fieldset>
    <fieldset>
      <legend>Replace with New Excel File</legend>
      <input type="file" id="acFileInput" accept=".xlsx,.xls,.csv">
      <button id="acLoadBtn" type="button">Load & Replace</button>
      <div id="acError" class="error-msg"></div>
    </fieldset>
    <div class="settings-actions">
      <button id="fitAndSaveBtn">Fit & Save</button>
      <button id="cancelEditCompressor">Cancel</button>
    </div>
  `;
    modal.classList.remove("hidden");
    let loadedDataPoints = existingPoints.length ? existingPoints : null;
    document.getElementById("acLoadBtn").onclick = async () => {
      const file = document.getElementById("acFileInput").files[0];
      if (!file) {
        document.getElementById("acError").textContent = "Please select a file.";
        return;
      }
      try {
        const points = await parseCompressorDataFile(file, isInverter);
        loadedDataPoints = points;
        document.getElementById("acDataContainer").innerHTML = buildDataTableHTML(points);
        document.getElementById("acError").textContent = "";
      } catch (err) {
        document.getElementById("acError").textContent = err.message;
        loadedDataPoints = null;
      }
    };
    document.getElementById("cancelEditCompressor").onclick = () => modal.classList.add("hidden");
    document.getElementById("fitAndSaveBtn").onclick = () => {
      const errorDiv = document.getElementById("acError");
      errorDiv.textContent = "";
      if (!loadedDataPoints || loadedDataPoints.length < 5) {
        errorDiv.textContent = "At least 5 data points required. Load a file or keep existing points.";
        return;
      }
      const newName = document.getElementById("acName").value.trim();
      const newRefIdx = parseInt(document.getElementById("acRef").value);
      if (!newName) {
        errorDiv.textContent = "Name is required.";
        return;
      }
      if (isInverter) {
        try {
          const normalizeRPM = Math.max(...loadedDataPoints.map((d) => d.RPM));
          const centerTE = loadedDataPoints.reduce((s, d) => s + d.TE, 0) / loadedDataPoints.length;
          const centerTC = loadedDataPoints.reduce((s, d) => s + d.TC, 0) / loadedDataPoints.length;
          const compressorModel = fitInverterCoefficients(
            loadedDataPoints,
            normalizeRPM,
            centerTE,
            centerTC,
            3
          );
          const actualRpmMin = Math.min(...loadedDataPoints.map((d) => d.RPM));
          const actualRpmMax = Math.max(...loadedDataPoints.map((d) => d.RPM));
          const updated = {
            ...comp,
            id: comp.id,
            name: newName,
            model: newName,
            refrigerantIndex: newRefIdx,
            cylinderVolumeCm3: parseFloat(document.getElementById("acCyl")?.value) || comp.cylinderVolumeCm3 || 0,
            isInverter: true,
            normalizeRPM,
            centerTE,
            centerTC,
            compressorModel,
            dataPoints: loadedDataPoints,
            rpmMin: actualRpmMin,
            rpmMax: actualRpmMax
          };
          deleteCompressor(comp.id);
          addCompressor(updated);
          setSelectedCompressor(comp.id);
        } catch (err) {
          errorDiv.textContent = "Fitting failed: " + err.message;
          return;
        }
      } else {
        const newCyl = parseFloat(document.getElementById("acCyl").value);
        const newRpm = parseFloat(document.getElementById("acRpm").value);
        if (isNaN(newCyl) || newCyl <= 0) {
          errorDiv.textContent = "Invalid cylinder volume.";
          return;
        }
        if (isNaN(newRpm) || newRpm <= 0) {
          errorDiv.textContent = "Invalid speed.";
          return;
        }
        const needRefit = loadedDataPoints !== existingPoints || newCyl !== comp.cylinderVolumeCm3 || newRpm !== comp.speedRpm || newRefIdx !== comp.refrigerantIndex;
        let wCoeffs, etaCoeffs;
        if (needRefit) {
          try {
            const coeffs = computeCompressorCoefficients({
              cylinderVolumeCm3: newCyl,
              speedRpm: newRpm,
              refrigerantIndex: newRefIdx,
              dataPoints: loadedDataPoints
            });
            wCoeffs = coeffs.wCoeffs;
            etaCoeffs = coeffs.etaCoeffs;
          } catch (err) {
            errorDiv.textContent = "Fitting failed: " + err.message;
            return;
          }
        } else {
          wCoeffs = comp.wCoeffs;
          etaCoeffs = comp.etaCoeffs;
        }
        const updated = {
          id: comp.id,
          name: newName,
          model: newName,
          voltage: comp.voltage || 100,
          frequency: comp.frequency || 50,
          cylinderVolumeCm3: newCyl,
          speedRpm: newRpm,
          refrigerantIndex: newRefIdx,
          wCoeffs,
          etaCoeffs,
          dataPoints: loadedDataPoints
        };
        deleteCompressor(comp.id);
        addCompressor(updated);
        setSelectedCompressor(comp.id);
      }
      modal.classList.add("hidden");
      openThermalSettings();
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
  }
  function handleRun() {
    clearMessages();
    if (!getGeometryFn) {
      showError("Geometry source not available.");
      return;
    }
    const cabinetGeom = getGeometryFn();
    const geom = toThermalFormat(cabinetGeom);
    const evapDepthMain = parseFloat(document.getElementById("evapDepth")?.value);
    const T0 = parseFloat(document.getElementById("thermoT0")?.value);
    const TF = parseFloat(document.getElementById("thermoTF")?.value);
    const TR = parseFloat(document.getElementById("thermoTR")?.value);
    if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
      showError("Please fill all temperatures.");
      return;
    }
    const refrigerant = document.getElementById("thermoRefrigerant")?.value || "R-600a";
    const fanParam = settings.fanParam || {};
    const evapParam = settings.evaporator || {};
    let fanFlow, fanAirSpeed;
    try {
      const fanResult = airSpeed(fanParam, evapParam);
      fanFlow = fanResult.fanAirflow_m3h;
      fanAirSpeed = fanResult.fanAirSpeed;
      evapParam.evapArea_m2 = computeEvaporatorArea(evapParam);
    } catch (e) {
      showError(e.message, "inverterErrors");
      return;
    }
    if (!Number.isFinite(thermalAdvanced.fanInputPower) || thermalAdvanced.fanInputPower < 0) {
      showError("Fan input power must be a non\u2011negative number. Set it in Advanced Settings.", "inverterErrors");
      return;
    }
    const comps = cabinetGeom._compartments;
    const nComps = comps?.length || 0;
    const hasFreezer = comps && comps[0].type === "freezer";
    const freezerPosition = nComps === 1 ? "top" : hasFreezer ? "top" : "bottom";
    const config = buildDefaultConfig({
      geom,
      freezerPosition,
      refrigerant,
      subcool: thermalAdvanced.subcool,
      dischargeTemp: thermalAdvanced.dischargeTemp,
      fixedTemps: { T0, TF, TR, TE: SJ54H_COMPONENTS.initialTE },
      fan: { fanAirflow_m3h: fanFlow, totalAirflow: fanFlow, inputPower_W: thermalAdvanced.fanInputPower },
      electrical: {
        defrostHeater_W: thermalAdvanced.defHeater,
        defrostOn_min: thermalAdvanced.defOnMin,
        pwbOn_W: thermalAdvanced.pwbOn,
        pwbOff_W: thermalAdvanced.pwbOff,
        timerPeriod_h: thermalAdvanced.timerPeriod,
        Damp: thermalAdvanced.Damp
      },
      evapGeom: evapParam
      // Pass the validated and calculated geometry explicitly
    });
    if (settings.condenser) {
      config.condenserConfig = {
        ...config.condenserConfig,
        sidePipePitch_mm: settings.condenser.sidePipePitch_mm,
        backPipePitch_mm: settings.condenser.backPipePitch_mm
      };
    }
    config.fanParam = fanParam;
    const defaultCompParams = config.compParams;
    loadCompressors();
    const compressor = getCurrentCompressor();
    let compressorWarning = null;
    if (compressor) {
      const toArray = (coeffs, keys) => {
        if (Array.isArray(coeffs)) return coeffs;
        if (coeffs && typeof coeffs === "object") return keys.map((k) => coeffs[k]).filter((v) => v !== void 0);
        return null;
      };
      const wArr = toArray(compressor.wCoeffs, ["AW", "BW", "CW", "DW", "EW"]);
      const etaArr = toArray(compressor.etaCoeffs, ["A", "B", "C"]);
      if (wArr && wArr.length === 5 && etaArr && etaArr.length === 3) {
        config.compParams = {
          name: compressor.name,
          cylinderVolumeCm3: compressor.cylinderVolumeCm3 || defaultCompParams.cylinderVolumeCm3,
          speedRpm: compressor.speedRpm || defaultCompParams.speedRpm,
          wCoeffs: wArr,
          etaCoeffs: etaArr
        };
      } else {
        compressorWarning = `Compressor \u201C${compressor.name}\u201D is missing valid coefficients. Using default compressor (EGX80CLC) instead.`;
        console.warn(compressorWarning);
      }
    }
    config.solverOptions = config.solverOptions || {};
    config.solverOptions.innerOptions = config.solverOptions.innerOptions || {};
    config.solverOptions.innerOptions.debug = true;
    const result = runThermoAnalysis(config);
    if (result.results && result.results.compressor) {
      if (config.compParams) {
        result.results.compressor.wCoeffs = config.compParams.wCoeffs;
        result.results.compressor.etaCoeffs = config.compParams.etaCoeffs;
      }
    }
    if (!result.success) {
      showError(result.errors.join("; "));
      return;
    }
    if (compressorWarning) {
      result.warnings = result.warnings || [];
      result.warnings.unshift(compressorWarning);
    }
    let energy = null;
    if (result.results && result.results.converged !== false) {
      try {
        energy = EnergyConsumption(result.results);
      } catch (e) {
        console.warn("EnergyConsumption failed:", e);
      }
    }
    let evapDetails = null;
    const evap = settings.evaporator;
    const fanP = settings.fanParam;
    if (evap && fanP && result.results && result.results.converged !== false) {
      try {
        const area = computeEvaporatorArea(evap);
        const fanResult = airSpeed(fanP, evap);
        const fanAirSpeed2 = fanResult.fanAirSpeed;
        const v = fanResult.v_ms;
        const alpha = evaporatorAlpha(v);
        const TF_ = parseFloat(document.getElementById("thermoTF")?.value);
        const TR_ = parseFloat(document.getElementById("thermoTR")?.value);
        const MR = result.results.MR;
        const MF = result.results.MF;
        const totalFlow = MR + MF;
        const T1 = totalFlow > 0 ? (MF * TF_ + MR * TR_) / totalFlow : TF_;
        const T2 = result.results.T2;
        const TE = result.results.TE;
        const LMTD = lmtd(T1, T2, TE);
        const Qevap = evaporatorCapacity(alpha, area, LMTD);
        evapDetails = { area, v, alpha, LMTD, Qevap, T1 };
      } catch (e) {
        console.warn("Evaporator calculation failed:", e);
      }
    }
    if (evapDetails) result.results.evapDetails = evapDetails;
    result.results.fanAirflow = fanFlow;
    result.results.fanAirSpeed = fanAirSpeed;
    document.getElementById("tabThermal").click();
    const thermoRight = document.getElementById("thermoRightPanel");
    if (thermoRight) thermoRight.innerHTML = "";
    result.results.configLabel = comps && comps.length === 1 ? `Single ${comps[0].type}` : freezerPosition === "top" ? "Top Freezer" : "Bottom Freezer";
    displayResults(result.results, energy);
    if (result.warnings.length) showWarnings(result.warnings);
  }
  function handleInverterRun() {
    clearMessages("inverterErrors");
    if (!getGeometryFn) {
      showError("Geometry source not available.", "inverterErrors");
      return;
    }
    const cabinetGeom = getGeometryFn();
    const geom = toThermalFormat(cabinetGeom);
    const PR = parseFloat(document.getElementById("inverterPR")?.value);
    if (isNaN(PR) || PR <= 0 || PR > 1) {
      showError("Please enter a valid Running Ratio (0.01\u20131).", "inverterErrors");
      return;
    }
    const T0 = parseFloat(document.getElementById("inverterT0")?.value);
    const TF = parseFloat(document.getElementById("inverterTF")?.value);
    const TR = parseFloat(document.getElementById("inverterTR")?.value);
    if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
      showError("Please fill all temperatures.", "inverterErrors");
      return;
    }
    const refrigerant = document.getElementById("inverterRefrigerant")?.value || "R-600a";
    const fanParam = settings.fanParam || {};
    let fanFlow, fanAirSpeed;
    const evapParam = settings.evaporator || {};
    try {
      const fanResult = airSpeed(fanParam, evapParam);
      fanFlow = fanResult.fanAirflow_m3h;
      fanAirSpeed = fanResult.fanAirSpeed;
      evapParam.evapArea_m2 = computeEvaporatorArea(evapParam);
    } catch (e) {
      showError(e.message, "inverterErrors");
      return;
    }
    if (!Number.isFinite(thermalAdvanced.fanInputPower) || thermalAdvanced.fanInputPower < 0) {
      showError("Fan input power must be a non\u2011negative number. Set it in Advanced Settings.", "inverterErrors");
      return;
    }
    const compartments = cabinetGeom._compartments;
    const freezerPos = compartments?.length === 1 ? "top" : compartments && compartments[0].type === "freezer" ? "top" : "bottom";
    const config = buildDefaultConfig({
      geom,
      freezerPosition: freezerPos,
      refrigerant,
      subcool: thermalAdvanced.subcool,
      dischargeTemp: thermalAdvanced.dischargeTemp,
      fixedTemps: { T0, TF, TR, TE: SJ54H_COMPONENTS.initialTE },
      fan: { fanAirflow_m3h: fanFlow, totalAirflow: fanFlow, inputPower_W: thermalAdvanced.fanInputPower },
      electrical: {
        defrostHeater_W: thermalAdvanced.defHeater,
        defrostOn_min: thermalAdvanced.defOnMin,
        pwbOn_W: thermalAdvanced.pwbOn,
        pwbOff_W: thermalAdvanced.pwbOff,
        timerPeriod_h: thermalAdvanced.timerPeriod,
        Damp: thermalAdvanced.Damp
      },
      condenserConfig: {
        sidePipePitch_mm: settings.condenser?.sidePipePitch_mm ?? 150,
        backPipePitch_mm: settings.condenser?.backPipePitch_mm ?? 200,
        backCondenserEfficiency: 0.7,
        backCondenser: "Yes"
      },
      evapGeom: evapParam
      // Pass the validated and calculated geometry explicitly
    });
    loadCompressors();
    let comp = getCurrentCompressor();
    if (!comp || !comp.isInverter) {
      showError("Selected compressor is not an inverter type.", "inverterErrors");
      return;
    }
    const pts = comp.dataPoints?.length >= 5 ? comp.dataPoints : INVERTER_EXAMPLE_COMPONENTS?.compressor?.dataPoints;
    if (!pts) {
      showError("No performance data available for inverter compressor.", "inverterErrors");
      return;
    }
    comp.compressorModel = fitInverterCoefficients(
      pts,
      comp.normalizeRPM || Math.max(...pts.map((d) => d.RPM)),
      comp.centerTE || pts.reduce((s, d) => s + d.TE, 0) / pts.length,
      comp.centerTC || pts.reduce((s, d) => s + d.TC, 0) / pts.length,
      3
    );
    if (!comp.compressorModel) {
      showError("Failed to fit inverter model.", "inverterErrors");
      return;
    }
    saveCompressors();
    config.compParams = {
      name: comp.name,
      isInverter: true,
      compressorModel: comp.compressorModel,
      centerTE: comp.centerTE || -25,
      centerTC: comp.centerTC || 45,
      rpmMin: comp.rpmMin || 1600,
      rpmMax: comp.rpmMax || 4500
    };
    config.inverterPR = PR;
    if (!settings.evaporator || settings.evaporator.evapArea_m2 <= 0) {
      showError("Evaporator area is not set. Please configure in Advanced Settings.");
      return;
    }
    const result = runThermoAnalysis(config);
    if (!result.success) {
      showError(result.errors.join("; "), "inverterErrors");
      return;
    }
    if (result.warnings.length) showWarnings(result.warnings, "inverterErrors");
    if (result.success && result.results) {
      result.results.refrigerantIndex = comp.refrigerantIndex;
      result.results.cylinderVolumeCm3 = comp.cylinderVolumeCm3;
      result.results.compressorModel = comp.compressorModel;
    }
    let energy = null;
    if (result.results && result.results.converged !== false)
      energy = EnergyConsumption(result.results);
    result.results.fanAirflow = fanFlow;
    result.results.fanAirSpeed = fanAirSpeed;
    let evapDetails = null;
    const evap = settings.evaporator;
    const fanP = settings.fanParam;
    if (evap && fanP && result.results && result.results.converged !== false) {
      try {
        const area = computeEvaporatorArea(evap);
        const fanResult = airSpeed(fanP, evap);
        const fanAirSpeed2 = fanResult.fanAirSpeed;
        const v = fanResult.v_ms;
        const alpha = evaporatorAlpha(v);
        const MR = result.results.MR;
        const MF = result.results.MF;
        const totalFlow = MR + MF;
        const T1 = totalFlow > 0 ? (MF * TF + MR * TR) / totalFlow : TF;
        const T2 = result.results.T2;
        const TE = result.results.TE;
        const LMTD = lmtd(T1, T2, TE);
        const Qevap = evaporatorCapacity(alpha, area, LMTD);
        evapDetails = { area, v, alpha, LMTD, Qevap, T1 };
      } catch (e) {
        console.warn("Evaporator calculation failed:", e);
      }
    }
    if (evapDetails) result.results.evapDetails = evapDetails;
    result.results.configLabel = (freezerPos === "top" ? "Top Freezer" : "Bottom Freezer") + " (Inverter)";
    displayResults(result.results, energy, true);
  }
  function buildInverterEquation(model, varName) {
    if (!model) return "";
    const formatEq = (c, form, log) => {
      const prefix = log ? `ln(${varName})` : varName;
      let eq = `${prefix} = ${c[0].toFixed(4)}`;
      const addTerm = (coeff, term) => {
        if (Math.abs(coeff) < 1e-12) return;
        const sign = coeff > 0 ? " + " : " - ";
        eq += `${sign}${Math.abs(coeff).toFixed(4)} * ${term}`;
      };
      if (form === "n_lin") {
        addTerm(c[1], "n");
        addTerm(c[2], "n*te");
        addTerm(c[3], "n*tc");
        addTerm(c[4], "n*tc*te");
        addTerm(c[5], "n*te\xB2");
      } else if (form === "n_quad") {
        addTerm(c[1], "n");
        addTerm(c[2], "n\xB2");
        addTerm(c[3], "n*te");
        addTerm(c[4], "n*tc");
        addTerm(c[5], "n*tc*te");
        addTerm(c[6], "n*te\xB2");
      } else if (form === "ln_n_lin") {
        addTerm(c[1], "ln(n)");
        addTerm(c[2], "ln(n)*te");
        addTerm(c[3], "ln(n)*tc");
        addTerm(c[4], "ln(n)*tc*te");
        addTerm(c[5], "ln(n)*te\xB2");
      } else if (form === "ln_n_quad") {
        addTerm(c[1], "ln(n)");
        addTerm(c[2], "ln(n)\xB2");
        addTerm(c[3], "ln(n)*te");
        addTerm(c[4], "ln(n)*tc");
        addTerm(c[5], "ln(n)*tc*te");
        addTerm(c[6], "ln(n)*te\xB2");
      }
      if (log) eq = `ln(${varName}) = ${eq.substring(eq.indexOf("=") + 1)}`;
      return eq;
    };
    if (model.type === "global" && model.coeffs) {
      return formatEq(model.coeffs, model.rpmForm, model.logTransform);
    } else if (model.type === "piecewise") {
      const eqLow = model.coeffs_low ? formatEq(model.coeffs_low, "n_quad", false) : "N/A";
      const eqMax = model.coeffs_max ? formatEq(model.coeffs_max, "n_quad", false) : "N/A";
      return `<strong>Piecewise Model</strong><br>
                RPM &le; ${model.splitRPM}: ${eqLow}<br>
                RPM = ${model.maxRPM}: ${eqMax}<br>
                <em style="color:#555;">(Interpolates between ${model.splitRPM} and ${model.maxRPM} RPM)</em>`;
    }
    return "";
  }
  function displayResults(res, energy, isInverter = false) {
    if (!res) return;
    const resultsDiv = document.getElementById("thermoRightPanel");
    if (!resultsDiv) return;
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    const overlay = document.getElementById("schematicOverlay");
    if (frontCanvas) frontCanvas.style.display = "none";
    if (sideCanvas) sideCanvas.style.display = "none";
    if (overlay) overlay.classList.add("hidden");
    resultsDiv.classList.remove("hidden");
    const fmt = (v, dp = 2) => isFinite(v) ? v.toFixed(dp) : "\u2014";
    const fmtP = (v, dp = 1) => isFinite(v) ? (v * 100).toFixed(dp) + " %" : "\u2014";
    let TF;
    if (isInverter) {
      TF = parseFloat(document.getElementById("inverterTF")?.value);
    } else {
      TF = parseFloat(document.getElementById("thermoTF")?.value);
    }
    const comp = res.compressor || {};
    const pe = (comp.Pe !== void 0 ? comp.Pe : res.Pe)?.toFixed(4) ?? "\u2014";
    const pc = (comp.Pc !== void 0 ? comp.Pc : res.Pc)?.toFixed(4) ?? "\u2014";
    const qComp = comp.coolingCapacity !== void 0 ? fmt(comp.coolingCapacity) : "\u2014";
    const pComp = comp.inputPower !== void 0 ? fmt(comp.inputPower) : "\u2014";
    const COP = comp.COP !== void 0 ? fmt(comp.COP, 2) : "\u2014";
    const mFlow = comp.massFlow !== void 0 ? fmt(comp.massFlow, 4) : "\u2014";
    const eW = energy ? fmt(energy.EnergyConsumption_kWhDay, 3) : "\u2014";
    const eKWh = energy ? fmt(energy.EnergyConsumption_kWhMonth, 3) : "\u2014";
    const volumes = exportvolume(traverseAndComputePrecise(buildLayoutNodeForPrecise(), readGeometryFromPanel()).leaves, readGeometryFromPanel());
    const Ann_EC = eW * 365;
    const AV = volumes.freezerTotal * (25 - TF) / 21 + volumes.freshTotal;
    const ES_27 = AV * 0.57 + 800 * 0.9;
    const ES_29 = AV * 0.57 + 800 * 0.8;
    const ES_31 = AV * 0.57 + 800 * 0.6;
    const IEE_27 = eKWh * 12 / ES_27;
    const IEE_29 = eKWh * 12 / ES_29;
    const IEE_31 = eKWh * 12 / ES_31;
    let Rank_27, Rank_29, Rank_31;
    if (IEE_27 <= 0.45) {
      Rank_27 = "A";
    } else if (IEE_27 <= 0.55) {
      Rank_27 = "B";
    } else if (IEE_27 <= 0.65) {
      Rank_27 = "C";
    } else if (IEE_27 <= 0.75) {
      Rank_27 = "D";
    } else if (IEE_27 <= 0.85) {
      Rank_27 = "OUT OF RANKING";
    }
    if (IEE_29 <= 0.45) {
      Rank_29 = "A";
    } else if (IEE_29 <= 0.55) {
      Rank_29 = "B";
    } else if (IEE_29 <= 0.65) {
      Rank_29 = "C";
    } else if (IEE_29 <= 0.75) {
      Rank_29 = "D";
    } else if (IEE_29 <= 0.85) {
      Rank_29 = "OUT OF RANKING";
    }
    if (IEE_31 <= 0.45) {
      Rank_31 = "A";
    } else if (IEE_31 <= 0.55) {
      Rank_31 = "B";
    } else if (IEE_31 <= 0.65) {
      Rank_31 = "C";
    } else if (IEE_31 <= 0.75) {
      Rank_31 = "D";
    } else if (IEE_31 <= 0.85) {
      Rank_31 = "OUT OF RANKING";
    }
    let etaV = "\u2014";
    if (isInverter && res.RPM !== void 0 && res.refrigerantIndex !== void 0 && res.cylinderVolumeCm3 && comp.massFlow) {
      try {
        const prop = getRefrigerantProperties(res.refrigerantIndex);
        const suctionTempK = 32.2 + 273.16;
        const Pe = comp.Pe;
        const vGas = prop.specificVolume(suctionTempK, Pe);
        const displacement_m3h = res.cylinderVolumeCm3 * res.RPM * 60 / 1e6;
        const theoMassFlow = displacement_m3h / vGas;
        const actualMassFlow = comp.massFlow;
        etaV = (actualMassFlow / theoMassFlow * 100).toFixed(1) + " %";
      } catch (e) {
        console.warn("etaV computation failed:", e);
        etaV = "\u2014";
      }
    } else {
      etaV = comp.etaV != null ? fmtP(comp.etaV) : "\u2014";
    }
    let etaStr = "\u2014", wStr = "\u2014";
    if (isInverter && res.compressorModel) {
      etaStr = buildInverterEquation(res.compressorModel.Q, "Q");
      wStr = buildInverterEquation(res.compressorModel.W, "W");
    } else {
      if (comp.etaCoeffs && comp.etaCoeffs.length === 3) {
        etaStr = `\u03B7v = A + B\xB7Pc/Pe + C\xB7Pc  (A=${comp.etaCoeffs[0].toFixed(5)}, B=${comp.etaCoeffs[1].toFixed(5)}, C=${comp.etaCoeffs[2].toFixed(5)})`;
      }
      if (comp.wCoeffs && comp.wCoeffs.length === 5) {
        wStr = `W = AW + BW\xB7TE + CW\xB7TC + DW\xB7TC\xB7TE + EW\xB7TE\xB2  (AW=${comp.wCoeffs[0].toFixed(5)}, BW=${comp.wCoeffs[1].toFixed(5)}, CW=${comp.wCoeffs[2].toFixed(5)}, DW=${comp.wCoeffs[3].toFixed(5)}, EW=${comp.wCoeffs[4].toFixed(5)})`;
      }
    }
    const fanAirflow_m3h = res.fanAirflow !== void 0 ? res.fanAirflow : 0;
    const fanAirflow_CFM = fanAirflow_m3h * 0.588578;
    const fanAirSpeed = res.fanAirSpeed;
    const configLabel = res.configLabel || "Unknown";
    const totalLoad = res.heatLoads?.totalLoad ?? "\u2014";
    const html = `
    <table class="thermo-results-table">
      <thead>
        <tr><th colspan="2">Thermal Analysis Results \u2014 ${configLabel}</th></tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="2">Operating Points</td></tr>
        <tr><td>Condensing temp TC</td><td>${fmt(res.TC)} \xB0C</td></tr>
        <tr><td>Evaporating temp TE</td><td>${fmt(res.TE)} \xB0C</td></tr>
        <tr><td>Evap. outlet T2</td><td>${fmt(res.T2)} \xB0C</td></tr>${isInverter ? `<tr><td>Running Ratio PR (fixed)</td><td>${fmtP(res.PR)}</td></tr><tr><td>Required Compressor RPM</td><td>${res.RPM !== void 0 ? fmt(res.RPM, 0) : "\u2014"} rpm</td></tr>` : `<tr><td>Running Ratio PR</td><td>${fmtP(res.PR)}</td></tr>`}

        <tr class="section-header"><td colspan="2">Compressor Details</td></tr>
        <tr class="section-header"><td colspan="2">Compressor Coefficients</td></tr>
        <tr><td>\u03B7<sub>v</sub> coefficients</td><td>${etaStr}</td></tr>
        <tr><td>Power coefficients</td><td>${wStr}</td></tr>
        <tr><td>Evap. pressure Pe</td><td>${pe} bar</td></tr>
        <tr><td>Cond. pressure Pc</td><td>${pc} bar</td></tr>
        <tr><td>Vol. efficiency \u03B7<sub>v</sub></td><td>${etaV}</td></tr>
        <tr><td>Cooling capacity</td><td>${qComp} W</td></tr>
        <tr><td>Input power</td><td>${pComp} W</td></tr>
        <tr><td>COP</td><td>${COP}</td></tr>
        <tr><td>Mass flow</td><td>${mFlow} kg/h</td></tr>

        <tr class="section-header"><td colspan="2">Energy Consumption</td></tr>
        <tr><td>Daily energy</td><td>${eW} kWh</td></tr>
        <tr><td>Monthly energy</td><td>${eKWh} kWh</td></tr>
        <tr><td>energy Rank</td><td>Rank_27 = ${Rank_27} <br> Rank_29 = ${Rank_29} <br> Rank_31 = ${Rank_31}</td>/td></tr>

        <tr class="section-header"><td colspan="2">Heat Loads (W)</td></tr>
        <tr><td>QF \u2014 Freezer compartment</td><td>${fmt(res.heatLoads.QF)}</td></tr>
        <tr><td>QR \u2014 Refrigerator compartment</td><td>${fmt(res.heatLoads.QR)}</td></tr>
        <tr><td>QEV \u2014 Evaporator total</td><td>${fmt(res.heatLoads.QEV)}</td></tr>
        <tr><td>Fan load</td><td>${fmt(res.heatLoads.fanLoad)}</td></tr>
        <tr><td>Defrost load</td><td>${fmt(res.heatLoads.defrostLoad)}</td></tr>
        <tr><td>Total load</td><td>${fmt(res.heatLoads.totalLoad)}</td></tr>

        <tr class="section-header"><td colspan="2">Fan Airflow</td></tr>
        <tr><td>Calculated Fan Air Speed</td><td>${fmt(fanAirSpeed, 1)}  m/s</td></tr>
        <tr><td>Calculated airflow</td><td>${fmt(fanAirflow_CFM, 1)} CFM (${fmt(fanAirflow_m3h, 1)} m\xB3/h)</td></tr>
        <tr><td>Freezer flow (MF)</td><td>${fmt(res.MF, 2)} m\xB3/h</td></tr>
        <tr><td>Refrigerator flow (MR)</td><td>${fmt(res.MR, 2)} m\xB3/h</td></tr>
        <tr><td>t3</td><td>${fmt(res.T3, 2)} C</td></tr>
        ${res.evapDetails ? `
          <tr class="section-header"><td colspan="2">Evaporator Performance</td></tr>
          <tr><td>Surface area</td><td>${fmt(res.evapDetails.area, 4)} m\xB2</td></tr>
          <tr><td>Air speed</td><td>${fmt(res.evapDetails.v, 3)} m/s</td></tr>
          <tr><td>Heat transfer coeff \u03B1</td><td>${fmt(res.evapDetails.alpha, 2)} W/(m\xB2\xB7K)</td></tr>
          <tr><td>LMTD</td><td>${fmt(res.evapDetails.LMTD, 2)} \xB0C</td></tr>
          <tr><td>Mixed inlet T1</td><td>${fmt(res.evapDetails.T1, 2)} \xB0C</td></tr>
          <tr><td>Evap. capacity (calculated)</td><td>${fmt(res.evapDetails.Qevap, 2)} W</td></tr>
          ` : ""}
        <tr class="section-header"><td colspan="2">Solver</td></tr>
        <tr><td>Outer iterations</td><td>${res.outerIterations ?? res.iterations?.outer ?? "\u2014"}</td></tr>
        <tr><td>Inner iterations (total)</td><td>${res.innerTotalIterations ?? res.iterations?.innerTotal ?? "\u2014"}</td></tr>
      </tbody>
    </table>
  `;
    resultsDiv.innerHTML = html;
  }
  function clearMessages(errorDivId = "thermoErrors") {
    const errDiv = document.getElementById(errorDivId);
    if (errDiv) errDiv.innerHTML = "";
    const thermoRight = document.getElementById("thermoRightPanel");
    if (thermoRight) thermoRight.innerHTML = "";
  }
  function showError(msg, errorDivId = "thermoErrors") {
    const e = document.getElementById(errorDivId);
    if (e) e.innerHTML = `<p class="error">\u274C ${msg}</p>`;
  }
  function showWarnings(warnings, errorDivId = "thermoErrors") {
    const e = document.getElementById(errorDivId);
    if (!e) return;
    const ul = document.createElement("ul");
    warnings.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      li.className = "warning";
      ul.appendChild(li);
    });
    e.appendChild(ul);
  }
  function getThermalState() {
    return {
      T0: parseFloat(document.getElementById("thermoT0")?.value),
      TF: parseFloat(document.getElementById("thermoTF")?.value),
      TR: parseFloat(document.getElementById("thermoTR")?.value),
      refrigerant: document.getElementById("thermoRefrigerant")?.value,
      advanced: thermalAdvanced,
      evaporator: settings.evaporator,
      condenser: settings.condenser,
      fanParam: settings.fanParam,
      compressor: getCurrentCompressor()
    };
  }
  function setThermalState(data) {
    if (!data) return;
    const el = (id) => document.getElementById(id);
    if (data.T0 !== void 0 && el("thermoT0")) el("thermoT0").value = data.T0;
    if (data.TF !== void 0 && el("thermoTF")) el("thermoTF").value = data.TF;
    if (data.TR !== void 0 && el("thermoTR")) el("thermoTR").value = data.TR;
    if (data.refrigerant !== void 0 && el("thermoRefrigerant")) el("thermoRefrigerant").value = data.refrigerant;
    if (data.advanced) {
      thermalAdvanced = { ...thermalAdvanced, ...data.advanced };
      localStorage.setItem("thermoAdvanced", JSON.stringify(thermalAdvanced));
    }
    if (data.evaporator) settings.evaporator = data.evaporator;
    if (data.condenser) settings.condenser = data.condenser;
    if (data.fanParam) settings.fanParam = data.fanParam;
    if (data.compressor) {
      const list = getCompressorList();
      const existingIdx = list.findIndex((c) => c.id === data.compressor.id);
      if (existingIdx === -1) {
        addCompressor(data.compressor);
      } else {
        list[existingIdx] = data.compressor;
        localStorage.setItem("compressorList", JSON.stringify(list));
      }
      setSelectedCompressor(data.compressor.id);
    }
    updateSettings(settings);
  }
  function refreshInverterCompressorSelect() {
    loadCompressors();
    const select = document.getElementById("inverterCompressorSelect");
    if (!select) return;
    select.innerHTML = "";
    const inverters = getCompressorList().filter((c) => c.isInverter);
    inverters.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    if (select.options.length > 0 && !select.value) {
      select.value = inverters[0].id;
    }
  }
  function updateInverterCompressorDisplay() {
    const comp = getCurrentCompressor();
    const nameEl = document.getElementById("currentInverterName");
    if (!nameEl) return;
    if (comp && comp.isInverter) {
      nameEl.textContent = comp.name;
      nameEl.style.color = "#22a55e";
    } else {
      nameEl.textContent = "No inverter compressor selected";
      nameEl.style.color = "#ef4444";
    }
  }

  // src/js/main.js
  updateSettings(settings);
  var divHorizInput = document.getElementById("divHoriz");
  var evapDepthInput = document.getElementById("evapDepth");
  var ctrlBoxHInput = document.getElementById("ctrlBoxH");
  var ctrlBoxWInput = document.getElementById("ctrlBoxW");
  var ctrlBoxLInput = document.getElementById("ctrlBoxL");
  var rshowerHInput = document.getElementById("rshowerH");
  var rshowerWInput = document.getElementById("rshowerW");
  var rshowerLInput = document.getElementById("rshowerL");
  var rshowerGroup = document.getElementById("rshowerGroup");
  var numCompartmentsInput = document.getElementById("numCompartments");
  var compartmentBuilder = document.getElementById("compartmentBuilder");
  var calculateBtn = document.getElementById("calculateBtn");
  var saveBtn = document.getElementById("saveBtn");
  var loadBtn = document.getElementById("loadBtn");
  var exportBtn = document.getElementById("exportBtn");
  var messagesDiv = document.getElementById("messages");
  var messagesFieldset = document.getElementById("messagesFieldset");
  var schematicOverlay = document.getElementById("schematicOverlay");
  var schematicTooltip = document.getElementById("schematicTooltip");
  var settingsBtn = document.getElementById("settingsBtn");
  var resetAllBtn = document.getElementById("resetAllBtn");
  var storeSlotABtn = document.getElementById("storeSlotABtn");
  var storeSlotBBtn = document.getElementById("storeSlotBBtn");
  var compareSlotsBtn = document.getElementById("compareSlotsBtn");
  var comparisonModal = document.getElementById("comparisonModal");
  var closeComparison = document.getElementById("closeComparison");
  var comparisonContent = document.getElementById("comparisonContent");
  var splitter = document.getElementById("splitter");
  var leftPanel = document.querySelector(".left-panel");
  var configSlotA = null;
  var configSlotB = null;
  var currentConfig = null;
  var dirtySchematic = false;
  var isResizing = false;
  var startX;
  var startWidth;
  function updateRShowerVisibility() {
    const hasFresh = compartmentsData.some((c) => c.type === "fresh");
    rshowerGroup.style.display = hasFresh ? "" : "none";
  }
  document.getElementById("geom-Hb").addEventListener("input", () => {
    clampAllShelfCounts();
    syncDisplay();
    markDirty();
  });
  document.getElementById("geom-bottom1").addEventListener("input", () => {
    clampAllShelfCounts();
    syncDisplay();
    markDirty();
  });
  splitter.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = leftPanel.getBoundingClientRect().width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });
  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const newWidth = Math.max(300, Math.min(800, startWidth + delta));
    leftPanel.style.flex = `0 0 ${newWidth}px`;
  });
  document.addEventListener("mouseup", () => {
    isResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
  var currentGeometry = { ...DEFAULT_CABINET };
  var compartmentsData = [];
  fillGeometryDefaults();
  ["geom-H", "geom-bottom3"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      syncConstraints();
      syncDisplay();
      markDirty();
    });
  });
  divHorizInput.addEventListener("input", () => {
    syncConstraints();
    syncDisplay();
    markDirty();
  });
  initCompartments();
  function initCompartments() {
    const count = parseInt(numCompartmentsInput.value) || 1;
    compartmentsData = [];
    const defaultWalls = { top: 60, left: 60, right: 60, rear: 60, door: 60 };
    for (let i = 0; i < count; i++) {
      compartmentsData.push({
        type: i === 0 ? "freezer" : "fresh",
        ...defaultWalls,
        height: 0,
        ratio: i === 0 ? 0.4 : 0.6,
        shelfCount: 0
      });
    }
    syncConstraints();
    buildCompartmentUI();
    updateRShowerVisibility();
  }
  function syncConstraints() {
    const count = compartmentsData.length;
    const H = parseFloat(document.getElementById("geom-H")?.value) || 1680;
    const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;
    const totalInsulTop = compartmentsData[0].top;
    const totalInsulBottom = parseFloat(document.getElementById("geom-bottom3")?.value) || 40;
    let internalH = H - totalInsulTop - totalInsulBottom - (count - 1) * dividerThick;
    if (internalH < 0) internalH = 0;
    if (internalH === 0) {
      compartmentsData[0].height = 0;
      compartmentsData[1] && (compartmentsData[1].height = 0);
      compartmentsData[0].ratio = 0.5;
      compartmentsData[1] && (compartmentsData[1].ratio = 0.5);
      return;
    }
    if (count === 1) {
      compartmentsData[0].height = internalH;
      compartmentsData[0].ratio = 1;
      return;
    }
    if (count === 2) {
      compartmentsData[1].top = dividerThick;
    }
    let h0 = compartmentsData[0].height;
    let h1 = compartmentsData[1].height;
    if (h0 === 0 && h1 === 0) {
      const r0 = Math.max(0.1, Math.min(0.9, compartmentsData[0].ratio));
      h0 = internalH * r0;
      h1 = internalH * (1 - r0);
    } else if (h0 !== 0 && h1 !== 0) {
      const sum = h0 + h1;
      if (Math.abs(sum - internalH) > 0.01) {
        h0 = Math.max(0.1 * internalH, Math.min(0.9 * internalH, h0));
        h1 = internalH - h0;
      }
    } else if (h0 !== 0) {
      h0 = Math.max(0.1 * internalH, Math.min(0.9 * internalH, h0));
      h1 = internalH - h0;
    } else if (h1 !== 0) {
      h1 = Math.max(0.1 * internalH, Math.min(0.9 * internalH, h1));
      h0 = internalH - h1;
    }
    compartmentsData[0].height = h0;
    compartmentsData[1].height = h1;
    compartmentsData[0].ratio = h0 / internalH;
    compartmentsData[1].ratio = h1 / internalH;
    clampAllShelfCounts();
  }
  function onCompFieldChange(compIdx, field, value) {
    if (field === "type") {
      compartmentsData[compIdx].type = value;
      if (compartmentsData.length > 1) {
        const otherIdx = 1 - compIdx;
        compartmentsData[otherIdx].type = value === "freezer" ? "fresh" : "freezer";
        updateRShowerVisibility();
      }
      syncDisplay();
      if (settings.autoCalculate) calculateBtn.click();
      return;
    }
    if (isNaN(value)) return;
    compartmentsData[compIdx][field] = value;
    if (field === "height" || field === "ratio") {
      const count = compartmentsData.length;
      const H = parseFloat(document.getElementById("geom-H")?.value) || 1680;
      const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;
      const topInsul = compartmentsData[0].top;
      const bottomInsul = parseFloat(document.getElementById("geom-bottom3")?.value) || 40;
      const internalH = H - topInsul - bottomInsul - (count - 1) * dividerThick;
      if (count === 1) {
        compartmentsData[0].height = internalH;
        compartmentsData[0].ratio = 1;
      } else {
        if (field === "height") {
          const minH = 0.1 * internalH;
          const maxH = 0.9 * internalH;
          let clamped = Math.max(minH, Math.min(maxH, value));
          compartmentsData[compIdx].height = clamped;
          const otherIdx = 1 - compIdx;
          compartmentsData[otherIdx].height = internalH - clamped;
          compartmentsData[0].ratio = compartmentsData[0].height / internalH;
          compartmentsData[1].ratio = 1 - compartmentsData[0].ratio;
        } else {
          let percent = Math.max(10, Math.min(count === 1 ? 100 : 90, value));
          let clamped = percent / 100;
          compartmentsData[compIdx].ratio = clamped;
          compartmentsData[compIdx].height = internalH * clamped;
          const otherIdx = 1 - compIdx;
          compartmentsData[otherIdx].ratio = 1 - clamped;
          compartmentsData[otherIdx].height = internalH - compartmentsData[compIdx].height;
        }
      }
    }
    if (field === "type" && compartmentsData.length > 1) {
      const otherIdx = 1 - compIdx;
      compartmentsData[otherIdx].type = value === "freezer" ? "fresh" : "freezer";
    }
    syncDisplay();
    if (settings.autoCalculate) calculateBtn.click();
  }
  function syncDisplay() {
    const count = compartmentsData.length;
    for (let i = 0; i < count; i++) {
      const d = compartmentsData[i];
      const heightInput = document.getElementById(`comp-${i}-height`);
      const ratioInput = document.getElementById(`comp-${i}-ratio`);
      const typeSelect = document.getElementById(`comp-${i}-type`);
      if (heightInput) heightInput.value = d.height.toFixed(1);
      if (ratioInput) {
        ratioInput.value = count === 1 ? 100 : (d.ratio * 100).toFixed(0);
      }
      if (typeSelect) typeSelect.value = d.type;
      const topInput = document.getElementById(`comp-${i}-top`);
      if (topInput) topInput.value = compartmentsData[i].top.toFixed(1);
      const shelfCountInput = document.getElementById(`comp-${i}-shelfCount`);
      if (shelfCountInput) {
        shelfCountInput.value = d.shelfCount;
      }
    }
  }
  function buildCompartmentUI() {
    const builder = document.getElementById("compartmentBuilder");
    builder.innerHTML = "";
    const count = compartmentsData.length;
    const dividerLabel = document.getElementById("dividerLabel");
    if (dividerLabel) dividerLabel.style.display = count > 1 ? "" : "none";
    for (let i = 0; i < count; i++) {
      const d = compartmentsData[i];
      const ratioMin = count === 1 ? 100 : 10;
      const ratioMax = count === 1 ? 100 : 90;
      const ratioVal = count === 1 ? 100 : Math.round(d.ratio * 100);
      const fieldset = document.createElement("fieldset");
      fieldset.innerHTML = `
      <legend>Compartment ${i + 1}</legend>
      <label>Type:
        <select id="comp-${i}-type">
          <option value="freezer" ${d.type === "freezer" ? "selected" : ""}>Freezer</option>
          <option value="fresh"  ${d.type === "fresh" ? "selected" : ""}>Fresh</option>
        </select>
      </label>
      <label>Height (mm): <input type="number" id="comp-${i}-height" step="any" value="${d.height.toFixed(1)}"></label>
      <label>Ratio (%): <input type="number" id="comp-${i}-ratio" step="1" min="${ratioMin}" max="${ratioMax}" value="${ratioVal}"></label>
      <label>Number of Shelves: <input type="number" id="comp-${i}-shelfCount" min="0" step="1" value="${d.shelfCount || 2}"></label>
      <fieldset>
        <legend>Wall Thicknesses (mm)</legend>
        ${count === 1 || i === 0 ? `<label>Top: <input type="number" id="comp-${i}-top" value="${d.top}" step="any"></label>` : ""}
        <label>Left:   <input type="number" id="comp-${i}-left"   value="${d.left}"   step="any"></label>
        <label>Right:  <input type="number" id="comp-${i}-right"  value="${d.right}"  step="any"></label>
        <label>Rear:   <input type="number" id="comp-${i}-rear"   value="${d.rear}"   step="any"></label>
        <label>Door:   <input type="number" id="comp-${i}-door"   value="${d.door}"   step="any"></label>
      </fieldset>
    `;
      builder.appendChild(fieldset);
    }
    for (let i = 0; i < count; i++) {
      document.getElementById(`comp-${i}-type`).addEventListener("change", (e) => {
        onCompFieldChange(i, "type", e.target.value);
      });
      document.getElementById(`comp-${i}-height`).addEventListener("change", (e) => {
        onCompFieldChange(i, "height", parseFloat(e.target.value) || 0);
      });
      document.getElementById(`comp-${i}-ratio`).addEventListener("change", (e) => {
        onCompFieldChange(i, "ratio", parseFloat(e.target.value) || 10);
      });
      for (const face of ["top", "left", "right", "rear", "door"]) {
        const el = document.getElementById(`comp-${i}-${face}`);
        if (!el) continue;
        el.addEventListener("input", (e) => {
          compartmentsData[i][face] = parseFloat(e.target.value) || 0;
          markDirty();
        });
        el.addEventListener("change", (e) => {
          syncConstraints();
          syncDisplay();
          if (settings.autoCalculate) calculateBtn.click();
        });
      }
      const shelfCountEl = document.getElementById(`comp-${i}-shelfCount`);
      if (shelfCountEl) {
        shelfCountEl.addEventListener("input", (e) => {
          const val = parseInt(e.target.value) || 0;
          const max = getMaxShelvesForCompartment(i);
          const clamped = Math.min(Math.max(0, val), max);
          compartmentsData[i].shelfCount = clamped;
          if (e.target.value !== String(clamped)) {
            e.target.value = clamped;
          }
          if (settings.autoCalculate) calculateBtn.click();
        });
      }
    }
  }
  function getCompTopWorldY(i) {
    let y = compartmentsData[0].top;
    for (let j = 0; j < i; j++) {
      y += compartmentsData[j].height;
      if (j < compartmentsData.length - 1) {
        y += parseFloat(divHorizInput.value) || 20;
      }
    }
    return y;
  }
  function getUsableHeightForCompartment(i) {
    const H = parseFloat(document.getElementById("geom-H")?.value) || 0;
    const Hb = parseFloat(document.getElementById("geom-Hb")?.value) || 0;
    const bottom1 = parseFloat(document.getElementById("geom-bottom1")?.value) || 0;
    const floorRaisedY = H - Hb - bottom1;
    const compTopY = getCompTopWorldY(i);
    const fullHeight = compartmentsData[i].height;
    if (i === compartmentsData.length - 1) {
      return Math.max(0, Math.min(fullHeight, floorRaisedY - compTopY));
    }
    return fullHeight;
  }
  function getMaxShelvesForCompartment(i) {
    const usable = getUsableHeightForCompartment(i);
    return Math.max(0, Math.floor(usable / 150) - 1);
  }
  function clampAllShelfCounts() {
    let changed = false;
    for (let i = 0; i < compartmentsData.length; i++) {
      const max = getMaxShelvesForCompartment(i);
      if (compartmentsData[i].shelfCount > max) {
        compartmentsData[i].shelfCount = max;
        changed = true;
      }
    }
    return changed;
  }
  function fillGeometryDefaults() {
    const def = DEFAULT_CABINET;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    set("geom-H", def.H);
    set("geom-W", def.W);
    set("geom-D", def.D);
    set("geom-Hb", def.Hb);
    set("geom-Db1", def.Db1);
    set("geom-Db2", def.Db2);
    set("geom-packingPos", def.packingPos);
    set("geom-doorGap", def.doorGap);
    set("geom-bottom1", 40);
    set("geom-bottom2", 40);
    set("geom-bottom3", 40);
    set("geom-railHeight", 20);
    set("geom-railWidth", 10);
    set("geom-railDepthPct", 50);
    set("geom-doorDikeHeight", 50);
    set("geom-doorDikeBaseWidth", 30);
    set("geom-doorDikeTopWidth", 15);
  }
  function readGeometryFromPanel() {
    const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
    const comps = compartmentsData;
    const count = comps.length;
    const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;
    const bottomIdx = count - 1;
    const bottom1 = g("geom-bottom1") ?? 40;
    const bottom2 = g("geom-bottom2") ?? 40;
    const bottom3 = g("geom-bottom3") ?? 40;
    const walls = {
      freezer: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        door: 0,
        rear: 0,
        bottom1,
        bottom2,
        bottom3
      },
      refrigerator: {
        top: 0,
        bottom1,
        bottom2,
        bottom3,
        left: 0,
        right: 0,
        door: 0,
        rear: 0
      }
    };
    for (let i = 0; i < count; i++) {
      const comp = comps[i];
      const isTopMost = i === 0;
      const isBottomMost = i === bottomIdx;
      const wallKey = comp.type === "fresh" ? "refrigerator" : "freezer";
      const w = walls[wallKey];
      w.top = isTopMost ? comp.top : dividerThick;
      if (wallKey === "freezer") {
        w.bottom = isBottomMost ? bottom1 : dividerThick;
      } else {
        w.bottom1 = isBottomMost ? bottom1 : dividerThick;
      }
      w.left = comp.left;
      w.right = comp.right;
      w.door = comp.door;
      w.rear = comp.rear;
    }
    return {
      H: g("geom-H") ?? DEFAULT_CABINET.H,
      W: g("geom-W") ?? DEFAULT_CABINET.W,
      D: g("geom-D") ?? DEFAULT_CABINET.D,
      Hb: g("geom-Hb") ?? DEFAULT_CABINET.Hb,
      Db1: g("geom-Db1") ?? DEFAULT_CABINET.Db1,
      Db2: g("geom-Db2") ?? DEFAULT_CABINET.Db2,
      doorGap: g("geom-doorGap") ?? DEFAULT_CABINET.doorGap,
      packingPos: g("geom-packingPos") ?? DEFAULT_CABINET.packingPos,
      airGap: 0,
      Hf: comps.find((c) => c.type === "freezer")?.height || 0,
      Hr: comps.find((c) => c.type === "fresh")?.height || 0,
      walls,
      dividerThickness: dividerThick,
      special: {
        railHeight: g("geom-railHeight") ?? 20,
        railWidth: g("geom-railWidth") ?? 10,
        railDepthPct: g("geom-railDepthPct") ?? 50,
        doorDikeHeight: g("geom-doorDikeHeight") ?? 50,
        doorDikeBaseWidth: g("geom-doorDikeBaseWidth") ?? 30,
        doorDikeTopWidth: g("geom-doorDikeTopWidth") ?? 15
      },
      obstacles: {
        evapDepth: g("evapDepth") ?? 85,
        ctrlBoxH: g("ctrlBoxH") ?? 150,
        ctrlBoxW: g("ctrlBoxW") ?? 500,
        ctrlBoxL: g("ctrlBoxL") ?? 100,
        rshowerH: g("rshowerH") ?? 700,
        rshowerW: g("rshowerW") ?? 500,
        rshowerL: g("rshowerL") ?? 50
      },
      _compartments: comps.map((c) => ({
        ...c,
        shelfCount: c.shelfCount ?? 0
      }))
    };
  }
  function getEffectiveThicknesses() {
    const comps = compartmentsData;
    const topComp = comps[0];
    const bottomComp = comps.length > 1 ? comps[1] : comps[0];
    const bottom1 = parseFloat(document.getElementById("geom-bottom1")?.value) || 40;
    const bottom2 = parseFloat(document.getElementById("geom-bottom2")?.value) || 40;
    const bottom3 = parseFloat(document.getElementById("geom-bottom3")?.value) || 40;
    return {
      top: topComp.top,
      bottom: Math.max(bottom1, bottom2, bottom3),
      left: Math.max(topComp.left, bottomComp.left),
      right: Math.max(topComp.right, bottomComp.right),
      rear: Math.max(topComp.rear, bottomComp.rear),
      door: Math.max(topComp.door, bottomComp.door)
    };
  }
  function markDirty() {
    dirtySchematic = true;
    if (settings.showDirtyOverlay) {
      schematicOverlay.classList.remove("hidden");
    } else {
      schematicOverlay.classList.add("hidden");
    }
  }
  document.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", markDirty));
  numCompartmentsInput.addEventListener("input", () => {
    markDirty();
    initCompartments();
  });
  function buildLayoutNodeForPrecise() {
    const count = compartmentsData.length;
    const leaves = [];
    for (let i = 0; i < count; i++) {
      const comp = compartmentsData[i];
      leaves.push({
        heightMode: "ratio",
        heightValue: comp.ratio,
        node: {
          nodeType: "leaf",
          id: `comp${i}`,
          type: comp.type,
          fittings: {
            shelfCount: comp.shelfCount || 0,
            shelves: [],
            drawers: [],
            doorBins: [],
            iceMakerHousing: { volume: null },
            lightHousing: { volume: null }
          }
        }
      });
    }
    return {
      nodeType: "horizontal",
      id: "root",
      children: leaves.map((l) => ({
        heightMode: l.heightMode,
        heightValue: l.heightValue,
        node: l.node
      })),
      dividers: count > 1 ? [{ afterChildIndex: 0, thickness: parseFloat(divHorizInput.value) || 20 }] : []
    };
  }
  function getCompTopWorldYFor(comps, idx, dividerThickness) {
    let y = comps[0].top;
    for (let i = 0; i < idx; i++) {
      y += comps[i].height;
      if (i < comps.length - 1) y += dividerThickness;
    }
    return y;
  }
  function computeObstacleVolumes(geometry) {
    const comps = geometry._compartments || compartmentsData;
    const special = geometry.special || {};
    const obs = geometry.obstacles || {};
    const dividerThick = geometry.dividerThickness ?? (parseFloat(divHorizInput.value) || 20);
    const evapDepth = obs.evapDepth ?? (parseFloat(evapDepthInput.value) || 85);
    const ctrlH = obs.ctrlBoxH ?? (parseFloat(ctrlBoxHInput.value) || 150);
    const ctrlW = obs.ctrlBoxW ?? (parseFloat(ctrlBoxWInput.value) || 500);
    const ctrlL = obs.ctrlBoxL ?? (parseFloat(ctrlBoxLInput.value) || 100);
    const rshowerH = obs.rshowerH ?? (parseFloat(rshowerHInput.value) || 700);
    const rshowerW = obs.rshowerW ?? (parseFloat(rshowerWInput.value) || 500);
    const rshowerL = obs.rshowerL ?? (parseFloat(rshowerLInput.value) || 50);
    const Hb = parseFloat(document.getElementById("geom-Hb")?.value) || 0;
    const bottom1 = parseFloat(document.getElementById("geom-bottom1")?.value) || 40;
    const floorRaisedY = geometry.H - Hb - bottom1;
    const freezerIdx = comps.findIndex((c) => c.type === "freezer");
    const freezerComp = freezerIdx >= 0 ? comps[freezerIdx] : comps[0];
    const freezerIsBottommost = comps.length === 1 || freezerIdx === comps.length - 1;
    const freezerTopWorld = getCompTopWorldYFor(comps, freezerIdx >= 0 ? freezerIdx : 0, dividerThick);
    const fHeight = freezerIsBottommost ? Math.max(0, Math.min(freezerComp.height, floorRaisedY - freezerTopWorld)) : freezerComp.height;
    const fInnerW = geometry.W - freezerComp.left - freezerComp.right;
    const evapVolMm3 = evapDepth * fHeight * fInnerW;
    const freshIdx = comps.findIndex((c) => c.type === "fresh");
    const freshComp = comps[freshIdx >= 0 ? freshIdx : 0];
    const isTopFreezer = freshIdx > 0;
    const freshTopWorld = getCompTopWorldYFor(comps, freshIdx >= 0 ? freshIdx : 0, dividerThick);
    const availableRearH = isTopFreezer ? Math.max(0, Math.min(freshComp.height, floorRaisedY - freshTopWorld)) : freshComp.height;
    const effectiveCtrlH = Math.min(ctrlH, availableRearH);
    const effectiveRShowerH = Math.max(0, Math.min(rshowerH, availableRearH - effectiveCtrlH));
    const ctrlVolMm3 = effectiveCtrlH * ctrlW * ctrlL;
    const rshowerVolMm3 = effectiveRShowerH * rshowerW * rshowerL;
    const railH = special.railHeight || 0;
    const railW = special.railWidth || 0;
    const railDepthPct = (special.railDepthPct || 0) / 100;
    let totalRailMm3 = 0;
    const dikeH = special.doorDikeHeight || 0;
    const dikeBaseW = special.doorDikeBaseWidth || 0;
    const dikeTopW = special.doorDikeTopWidth || 0;
    const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
    let totalDikeMm3 = 0;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      const shelfCount = c.shelfCount || 0;
      const innerW = geometry.W - c.left - c.right;
      const innerD = geometry.D - c.rear;
      const railVol = railH * railW * railDepthPct * innerD * shelfCount * 2;
      totalRailMm3 += railVol;
      const perimeter = 2 * (innerW + c.height);
      const dikeVol = dikeArea * perimeter;
      totalDikeMm3 += dikeVol;
    }
    const railsL = totalRailMm3 * settings.mm3ToL;
    const dikesL = totalDikeMm3 * settings.mm3ToL;
    const evapL = evapVolMm3 * settings.mm3ToL;
    const ctrlLiters = ctrlVolMm3 * settings.mm3ToL;
    const rshowerLiters = rshowerVolMm3 * settings.mm3ToL;
    return {
      evaporator: evapL,
      controlBox: ctrlLiters,
      rshower: rshowerLiters,
      rails: railsL,
      dikes: dikesL,
      totalAll: evapL + ctrlLiters + rshowerLiters + railsL + dikesL,
      railsDikesOnly: railsL + dikesL
    };
  }
  function exportvolume(leaves, geometry) {
    const comps = compartmentsData;
    const special = geometry.special || {};
    const perCompRailsDikesL = comps.map((c) => {
      const shelfCount = c.shelfCount || 0;
      const innerW = geometry.W - c.left - c.right;
      const innerD = geometry.D - c.rear;
      const railH = special.railHeight || 0;
      const railW = special.railWidth || 0;
      const railDepthPct = (special.railDepthPct || 0) / 100;
      const railsVol = railH * railW * railDepthPct * innerD * shelfCount * 2 * settings.mm3ToL;
      const dikeH = special.doorDikeHeight || 0;
      const dikeBaseW = special.doorDikeBaseWidth || 0;
      const dikeTopW = special.doorDikeTopWidth || 0;
      const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
      const perimeter = 2 * (innerW + c.height);
      const dikesVol = dikeArea * perimeter * settings.mm3ToL;
      return railsVol + dikesVol;
    });
    const adjustedLeaves = leaves.map((leaf, idx) => ({
      ...leaf,
      gross: Math.max(0, leaf.gross - perCompRailsDikesL[idx])
    }));
    const freezerIdx = comps.findIndex((c) => c.type === "freezer");
    const freshIdx = comps.findIndex((c) => c.type === "fresh");
    const freezerGross = freezerIdx >= 0 ? adjustedLeaves[freezerIdx]?.gross : null;
    const freshGross = freshIdx >= 0 ? adjustedLeaves[freshIdx]?.gross : null;
    const obstacles = computeObstacleVolumes(geometry);
    const freezerTotal = freezerGross != null ? Math.max(0, freezerGross - (obstacles.evaporator || 0)) : null;
    const freshTotal = freshGross != null ? Math.max(0, freshGross - (obstacles.controlBox || 0) - (obstacles.rshower || 0)) : null;
    return {
      freezerGross,
      freezerTotal,
      freshGross,
      freshTotal
    };
  }
  function displayPreciseResults(leaves, geometry) {
    const comps = compartmentsData;
    const special = geometry.special || {};
    const perCompRailsDikesL = comps.map((c) => {
      const shelfCount = c.shelfCount || 0;
      const innerW = geometry.W - c.left - c.right;
      const innerD = geometry.D - c.rear;
      const railH = special.railHeight || 0;
      const railW = special.railWidth || 0;
      const railDepthPct = (special.railDepthPct || 0) / 100;
      const railsVol = railH * railW * railDepthPct * innerD * shelfCount * 2 * settings.mm3ToL;
      const dikeH = special.doorDikeHeight || 0;
      const dikeBaseW = special.doorDikeBaseWidth || 0;
      const dikeTopW = special.doorDikeTopWidth || 0;
      const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
      const perimeter = 2 * (innerW + c.height);
      const dikesVol = dikeArea * perimeter * settings.mm3ToL;
      return railsVol + dikesVol;
    });
    const adjustedLeaves = leaves.map((leaf, idx) => ({
      ...leaf,
      gross: Math.max(0, leaf.gross - perCompRailsDikesL[idx])
    }));
    const grossL = adjustedLeaves.reduce((sum, l) => sum + l.gross, 0);
    const grossCuft = grossL * settings.lToCuft;
    const obstacles = computeObstacleVolumes(geometry);
    const totalL = Math.max(0, grossL - obstacles.evaporator - obstacles.controlBox - obstacles.rshower);
    const totalCuft = totalL * settings.lToCuft;
    document.getElementById("grossVol").textContent = roundForDisplay(grossL, "L");
    document.getElementById("grossVolCuft").textContent = roundForDisplay(grossCuft, "cuft");
    document.getElementById("totalVol").textContent = roundForDisplay(totalL, "L");
    document.getElementById("totalVolCuft").textContent = roundForDisplay(totalCuft, "cuft");
    const getDisplay = (val, unit) => val != null && !isNaN(val) ? roundForDisplay(val, unit) : "--";
    const getCuft = (val) => val != null && !isNaN(val) ? roundForDisplay(val * settings.lToCuft, "cuft") : "--";
    const freezerIdx = comps.findIndex((c) => c.type === "freezer");
    const freshIdx = comps.findIndex((c) => c.type === "fresh");
    const freezerGross = freezerIdx >= 0 ? adjustedLeaves[freezerIdx]?.gross : null;
    const freshGross = freshIdx >= 0 ? adjustedLeaves[freshIdx]?.gross : null;
    const freezerTotal = freezerGross != null ? Math.max(0, freezerGross - (obstacles.evaporator || 0)) : null;
    const freshTotal = freshGross != null ? Math.max(0, freshGross - (obstacles.controlBox || 0) - (obstacles.rshower || 0)) : null;
    document.getElementById("freezerGrossVol").textContent = getDisplay(freezerGross, "L");
    document.getElementById("freezerGrossVolCuft").textContent = getCuft(freezerGross);
    document.getElementById("freezerTotalVol").textContent = getDisplay(freezerTotal, "L");
    document.getElementById("freezerTotalVolCuft").textContent = getCuft(freezerTotal);
    document.getElementById("fridgeGrossVol").textContent = getDisplay(freshGross, "L");
    document.getElementById("fridgeGrossVolCuft").textContent = getCuft(freshGross);
    document.getElementById("fridgeTotalVol").textContent = getDisplay(freshTotal, "L");
    document.getElementById("fridgeTotalVolCuft").textContent = getCuft(freshTotal);
    let fdoorPUVolL = 0, rdoorPUVolL = 0;
    let totalDikesL = 0;
    let doorStartY = 0;
    let yOffset = comps[0].top || 0;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      const innerW = geometry.W - c.left - c.right;
      const doorThick = c.door || 0;
      let doorEndY;
      if (i === comps.length - 1) {
        doorEndY = geometry.H;
      } else {
        const compBottomY = yOffset + c.height;
        const dividerMidpoint = compBottomY + geometry.dividerThickness / 2;
        doorEndY = dividerMidpoint - geometry.doorGap / 2;
      }
      const outerDoorHeight = doorEndY - doorStartY;
      const baseVol = doorThick * geometry.W * outerDoorHeight * settings.mm3ToL;
      const dikeH = special.doorDikeHeight || 0;
      const dikeBaseW = special.doorDikeBaseWidth || 0;
      const dikeTopW = special.doorDikeTopWidth || 0;
      const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
      const perimeter = 2 * (innerW + c.height);
      const dikeVolL = dikeArea * perimeter * settings.mm3ToL;
      totalDikesL += dikeVolL;
      const totalDoorVol = baseVol + dikeVolL;
      if (c.type === "freezer") fdoorPUVolL = totalDoorVol;
      else if (c.type === "fresh") rdoorPUVolL = totalDoorVol;
      if (i < comps.length - 1) {
        const compBottomY = yOffset + c.height;
        const dividerMidpoint = compBottomY + geometry.dividerThickness / 2;
        doorStartY = dividerMidpoint + geometry.doorGap / 2;
        yOffset = compBottomY + geometry.dividerThickness;
      }
    }
    const extVolMm3 = geometry.H * geometry.W * geometry.D;
    const cutoutVolMm3 = geometry.Hb * (geometry.Db1 + geometry.Db2) / 2 * geometry.W;
    const extVolL = (extVolMm3 - cutoutVolMm3) * settings.mm3ToL;
    const cabPUVolL = extVolL - grossL - totalDikesL;
    document.getElementById("cabpuVol").textContent = roundForDisplay(cabPUVolL, "L");
    document.getElementById("cabpuVolCuft").textContent = roundForDisplay(cabPUVolL * settings.lToCuft, "cuft");
    document.getElementById("cabpuweight").textContent = roundForDisplay(cabPUVolL * 32 / 1e3, "kg");
    document.getElementById("fdoorpuVol").textContent = roundForDisplay(fdoorPUVolL, "L");
    document.getElementById("fdoorpuVolCuft").textContent = roundForDisplay(fdoorPUVolL * settings.lToCuft, "cuft");
    document.getElementById("fdoorpuweight").textContent = roundForDisplay(fdoorPUVolL * 32 / 1e3, "kg");
    document.getElementById("rdoorpuVol").textContent = roundForDisplay(rdoorPUVolL, "L");
    document.getElementById("rdoorpuVolCuft").textContent = roundForDisplay(rdoorPUVolL * settings.lToCuft, "cuft");
    document.getElementById("rdoorpuweight").textContent = roundForDisplay(rdoorPUVolL * 32 / 1e3, "kg");
  }
  function drawSchematics(config, leaves) {
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (!frontCanvas || !sideCanvas || !leaves) return;
    const rightPanel = document.querySelector(".right-panel");
    const panelHeight = rightPanel.clientHeight - 30;
    const panelWidth = rightPanel.clientWidth - 20;
    frontCanvas.height = panelHeight;
    sideCanvas.height = panelHeight;
    frontCanvas.width = panelWidth / 2 - 5;
    sideCanvas.width = panelWidth / 2 - 5;
    const effectiveWalls = getEffectiveThicknesses();
    const fittings = extractFittingsFromLayout(config.cabinet.layout);
    const geom = config.cabinet.geometry || currentGeometry;
    const obs = geom.obstacles || {};
    const rw = geom.walls?.refrigerator || {};
    const H = geom.H, D = geom.D;
    const eff = effectiveWalls;
    const innerTopY = eff.top;
    const innerBottomY = H - Math.max(
      parseFloat(document.getElementById("geom-bottom1")?.value) || 40,
      parseFloat(document.getElementById("geom-bottom2")?.value) || 40,
      parseFloat(document.getElementById("geom-bottom3")?.value) || 40
    );
    const shelfCounts = compartmentsData.map((c) => c.shelfCount || 2);
    const drawOptions = {
      dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
      compHeights: compartmentsData.map((c) => c.height),
      doorGap: parseFloat(document.getElementById("geom-doorGap")?.value) || 10,
      compartments: compartmentsData.map((c) => ({
        left: c.left,
        right: c.right,
        rear: c.rear,
        door: c.door
        // ← add this
      })),
      fittings,
      shelfCounts,
      railHeight: geom.special.railHeight,
      railWidth: geom.special.railWidth,
      railDepthPct: geom.special.railDepthPct,
      dikeHeight: geom.special.doorDikeHeight,
      dikeBaseWidth: geom.special.doorDikeBaseWidth,
      dikeTopWidth: geom.special.doorDikeTopWidth,
      innerTopY,
      innerBottomY,
      innerLeftX: eff.left,
      innerRightX: geom.W - eff.right,
      innerRearX: eff.rear,
      doorX: D - eff.rear,
      cabinetDepth: D,
      cabinetWidth: geom.W,
      cabinetHeight: H,
      evapDepth: obs.evapDepth ?? (parseFloat(evapDepthInput.value) || 0),
      ctrlBoxH: obs.ctrlBoxH ?? (parseFloat(ctrlBoxHInput.value) || 0),
      ctrlBoxW: obs.ctrlBoxW ?? (parseFloat(ctrlBoxWInput.value) || 0),
      ctrlBoxL: obs.ctrlBoxL ?? (parseFloat(ctrlBoxLInput.value) || 0),
      rshowerH: obs.rshowerH ?? (parseFloat(rshowerHInput.value) || 0),
      rshowerW: obs.rshowerW ?? (parseFloat(rshowerWInput.value) || 0),
      rshowerL: obs.rshowerL ?? (parseFloat(rshowerLInput.value) || 0),
      compartmentTypes: compartmentsData.map((c) => c.type),
      numCompartments: compartmentsData.length
    };
    drawFrontView(frontCanvas, currentGeometry, effectiveWalls, config.cabinet.layout, leaves, drawOptions);
    drawSideView(sideCanvas, currentGeometry, effectiveWalls, drawOptions);
    dirtySchematic = false;
    schematicOverlay.classList.add("hidden");
  }
  calculateBtn.addEventListener("click", () => {
    currentGeometry = readGeometryFromPanel();
    const layout = buildLayoutNodeForPrecise();
    const existingMeta = currentConfig?.meta || {
      name: "UI Config",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const configForDrawing = {
      schemaVersion: "2.0",
      meta: {
        ...existingMeta,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      cabinet: {
        geometry: currentGeometry,
        layout
      },
      thermal: getThermalState()
    };
    currentConfig = configForDrawing;
    storeSlotABtn.style.display = "inline-block";
    storeSlotBBtn.style.display = "inline-block";
    compareSlotsBtn.style.display = configSlotA || configSlotB ? "inline-block" : "none";
    const { leaves, errors, warnings } = traverseAndComputePrecise(layout, currentGeometry);
    const allMessages = [
      ...(errors || []).map((e) => `<p class="error">\u274C ${e.message}</p>`),
      ...(warnings || []).map((w) => `<p class="warning">\u26A0\uFE0F ${w.message}</p>`)
    ];
    if (allMessages.length) {
      messagesDiv.innerHTML = allMessages.join("");
      messagesFieldset.style.display = "block";
    } else {
      messagesFieldset.style.display = "none";
    }
    if (leaves && leaves.length > 0) {
      displayPreciseResults(leaves, currentGeometry);
      drawSchematics(configForDrawing, leaves);
    } else {
      document.getElementById("grossVol").textContent = "--";
      document.getElementById("totalVol").textContent = "--";
    }
  });
  function extractFittingsFromLayout(node) {
    const fittings = [];
    function walk(n) {
      if (n.nodeType === "leaf" && n.fittings) {
        const shelves = n.fittings.shelves || [];
        const safeShelves = n.fittings.shelfCount != null ? [] : shelves;
        fittings.push({
          leafId: n.id,
          type: n.type,
          shelves: safeShelves,
          drawers: n.fittings.drawers || [],
          doorBins: n.fittings.doorBins || []
        });
      }
      if (n.children) n.children.forEach((c) => walk(c.node));
    }
    walk(node);
    return fittings;
  }
  function populateUIFromConfig(config) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    const geometry = config.cabinet?.geometry;
    if (geometry) {
      set("geom-H", geometry.H);
      set("geom-W", geometry.W);
      set("geom-D", geometry.D);
      set("geom-Hb", geometry.Hb);
      set("geom-Db1", geometry.Db1);
      set("geom-Db2", geometry.Db2);
      set("geom-packingPos", geometry.packingPos);
      set("geom-doorGap", geometry.doorGap);
      const rw = geometry.walls?.refrigerator;
      if (rw) {
        set("geom-bottom1", rw.bottom1);
        set("geom-bottom2", rw.bottom2);
        set("geom-bottom3", rw.bottom3);
      }
      const savedComps = geometry._compartments;
      if (savedComps?.length > 0) {
        numCompartmentsInput.value = savedComps.length;
        compartmentsData = savedComps.map((c) => ({
          ...c,
          shelfCount: c.shelfCount ?? 0
        }));
        const layout = config.cabinet.layout;
        if (layout?.nodeType === "horizontal" && layout.dividers?.length > 0) {
          divHorizInput.value = layout.dividers[0].thickness ?? 20;
        }
      } else {
        initCompartments();
      }
      currentGeometry = { ...geometry };
      if (geometry.special) {
        set("geom-railHeight", geometry.special.railHeight);
        set("geom-railWidth", geometry.special.railWidth);
        set("geom-railDepthPct", geometry.special.railDepthPct);
        set("geom-doorDikeHeight", geometry.special.doorDikeHeight);
        set("geom-doorDikeBaseWidth", geometry.special.doorDikeBaseWidth);
        set("geom-doorDikeTopWidth", geometry.special.doorDikeTopWidth);
      } else {
        set("geom-railHeight", 20);
        set("geom-railWidth", 10);
        set("geom-railDepthPct", 50);
        set("geom-doorDikeHeight", 50);
        set("geom-doorDikeBaseWidth", 30);
        set("geom-doorDikeTopWidth", 15);
      }
      if (geometry.obstacles) {
        set("evapDepth", geometry.obstacles.evapDepth);
        set("ctrlBoxH", geometry.obstacles.ctrlBoxH);
        set("ctrlBoxW", geometry.obstacles.ctrlBoxW);
        set("ctrlBoxL", geometry.obstacles.ctrlBoxL);
        set("rshowerH", geometry.obstacles.rshowerH);
        set("rshowerW", geometry.obstacles.rshowerW);
        set("rshowerL", geometry.obstacles.rshowerL);
      } else {
        set("evapDepth", 85);
        set("ctrlBoxH", 150);
        set("ctrlBoxW", 500);
        set("ctrlBoxL", 100);
        set("rshowerH", 700);
        set("rshowerW", 500);
        set("rshowerL", 50);
      }
    } else if (config.cabinet?.external) {
      const ext = config.cabinet.external;
      set("geom-H", ext.height);
      set("geom-W", ext.width);
      set("geom-D", ext.depth);
      const wtt = config.cabinet.wallThicknessesByType;
      if (wtt?.fresh) {
        set("geom-bottom1", wtt.fresh.bottom);
        set("geom-bottom2", wtt.fresh.bottom);
        set("geom-bottom3", wtt.fresh.bottom);
      }
      initCompartments();
      currentGeometry = { ...DEFAULT_CABINET };
    } else {
      console.warn("populateUIFromConfig: unrecognised config structure \u2014 UI not restored.");
      return;
    }
    if (config.thermal) {
      setThermalState(config.thermal);
    }
    buildCompartmentUI();
    updateRShowerVisibility();
    syncConstraints();
    syncDisplay();
  }
  saveBtn.addEventListener("click", () => {
    if (!currentConfig) {
      alert("Calculate first");
      return;
    }
    currentConfig.thermal = getThermalState();
    downloadConfigJSON(currentConfig, currentConfig.meta.name);
  });
  loadBtn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const config = await loadConfigFromFile(file);
        currentConfig = config;
        storeSlotABtn.style.display = "inline-block";
        storeSlotBBtn.style.display = "inline-block";
        compareSlotsBtn.style.display = configSlotA || configSlotB ? "inline-block" : "none";
        populateUIFromConfig(config);
        calculateBtn.click();
      } catch (err) {
        alert("Error: " + err.message);
      }
    };
    input.click();
  });
  exportBtn.addEventListener("click", () => {
    if (!currentConfig) {
      alert("Calculate first");
      return;
    }
    const geometry = currentConfig.cabinet.geometry;
    const layout = currentConfig.cabinet.layout;
    const { leaves, errors, warnings } = traverseAndComputePrecise(layout, geometry);
    if (errors.length) {
      alert("Errors in calculation: " + errors.map((e) => e.message).join("; "));
      return;
    }
    const result = {
      leaves: leaves.map((l) => ({ leafId: l.leafId, gross: l.gross })),
      totals: { gross: leaves.reduce((sum, l) => sum + l.gross, 0) },
      warnings
    };
    downloadResultsCSV(result, currentConfig.meta.name);
  });
  initSettingsModal();
  resetAllBtn.addEventListener("click", () => {
    if (!confirm("Reset all fields to default values and clear results?")) return;
    currentGeometry = { ...DEFAULT_CABINET };
    fillGeometryDefaults();
    divHorizInput.value = 20;
    numCompartmentsInput.value = 2;
    initCompartments();
    document.getElementById("grossVol").textContent = "--";
    document.getElementById("grossVolCuft").textContent = "--";
    document.getElementById("totalVol").textContent = "--";
    document.getElementById("totalVolCuft").textContent = "--";
    messagesDiv.innerHTML = "";
    messagesFieldset.style.display = "none";
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (frontCanvas) frontCanvas.getContext("2d").clearRect(0, 0, frontCanvas.width, frontCanvas.height);
    if (sideCanvas) sideCanvas.getContext("2d").clearRect(0, 0, sideCanvas.width, sideCanvas.height);
    schematicOverlay.classList.add("hidden");
    dirtySchematic = false;
    currentConfig = null;
    const defaultFanParam = {
      tipDiam_mm: 220,
      fanRPM: 2200,
      hubDiam_mm: 80,
      PitchAngle_degree: 30
    };
    const defaultEvap = {
      width_mm: 460,
      depth_mm: 60
      // … keep other evap fields from DEFAULTS …
    };
    settings.fanParam = defaultFanParam;
    settings.evaporator = defaultEvap;
    updateSettings(settings);
    if (settings.autoCalculate) calculateBtn.click();
  });
  document.addEventListener("input", (e) => {
    if (settings.autoCalculate && e.target.closest(".left-panel")) {
      calculateBtn.click();
    }
  });
  document.addEventListener("settings-changed", () => {
    if (settings.autoCalculate && currentConfig) {
      calculateBtn.click();
    } else {
      markDirty();
    }
  });
  storeSlotABtn.addEventListener("click", () => {
    if (!currentConfig) return;
    configSlotA = JSON.parse(JSON.stringify(currentConfig));
    alert("Configuration stored in Slot A.");
    compareSlotsBtn.style.display = "inline-block";
  });
  storeSlotBBtn.addEventListener("click", () => {
    if (!currentConfig) return;
    configSlotB = JSON.parse(JSON.stringify(currentConfig));
    alert("Configuration stored in Slot B.");
    compareSlotsBtn.style.display = "inline-block";
  });
  compareSlotsBtn.addEventListener("click", () => {
    if (!configSlotA && !configSlotB) {
      alert("No stored configurations to compare.");
      return;
    }
    let resultA = null, resultB = null;
    if (configSlotA) {
      const geomA = configSlotA.cabinet.geometry;
      const layoutA = configSlotA.cabinet.layout;
      resultA = traverseAndComputePrecise(layoutA, geomA);
    }
    if (configSlotB) {
      const geomB = configSlotB.cabinet.geometry;
      const layoutB = configSlotB.cabinet.layout;
      resultB = traverseAndComputePrecise(layoutB, geomB);
    }
    buildComparisonTable(resultA, resultB);
    comparisonModal.classList.remove("hidden");
  });
  closeComparison.addEventListener("click", () => {
    comparisonModal.classList.add("hidden");
  });
  window.addEventListener("click", (e) => {
    if (e.target === comparisonModal) comparisonModal.classList.add("hidden");
  });
  function buildComparisonTable(resultA, resultB) {
    if (!resultA && !resultB) {
      comparisonContent.innerHTML = "<p>No configurations stored.</p>";
      return;
    }
    const obstaclesA = resultA ? computeObstacleVolumes(configSlotA.cabinet.geometry) : { totalAll: 0 };
    const obstaclesB = resultB ? computeObstacleVolumes(configSlotB.cabinet.geometry) : { totalAll: 0 };
    const fmtTotals = (leaves, obstacles) => {
      if (!leaves) return { gross: "-", total: "-", grossCuft: "-", totalCuft: "-" };
      const gross = leaves.reduce((s, l) => s + l.gross, 0);
      const total = Math.max(0, gross - obstacles.totalAll);
      return {
        gross: roundForDisplay(gross, "L"),
        total: roundForDisplay(total, "L"),
        grossCuft: roundForDisplay(gross * settings.lToCuft, "cuft"),
        totalCuft: roundForDisplay(total * settings.lToCuft, "cuft")
      };
    };
    const tA = fmtTotals(resultA?.leaves, obstaclesA);
    const tB = fmtTotals(resultB?.leaves, obstaclesB);
    let html = `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <thead><tr><th></th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Litres</th><th>cu.ft.</th><th>Litres</th><th>cu.ft.</th></tr></thead>
      <tbody>
      <tr><td><strong>Gross</strong></td><td>${tA.gross}</td><td>${tA.grossCuft}</td><td>${tB.gross}</td><td>${tB.grossCuft}</td></tr>
      <tr><td><strong>Total</strong></td><td>${tA.total}</td><td>${tA.totalCuft}</td><td>${tB.total}</td><td>${tB.totalCuft}</td></tr>
      </tbody></table>`;
    if (resultA?.leaves?.length > 0 && resultB?.leaves?.length > 0) {
      html += `<h3>Per\u2011Compartment Breakdown (Gross)</h3>`;
      const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
      html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <tr><th>Compartment</th><th>Slot A</th><th>Slot B</th></tr>`;
      for (let i = 0; i < maxLeaves; i++) {
        const leafA = resultA.leaves[i], leafB = resultB.leaves[i];
        const gA = leafA ? roundForDisplay(leafA.gross, "L") : "-";
        const gB = leafB ? roundForDisplay(leafB.gross, "L") : "-";
        html += `<tr><td>Comp ${i + 1}</td><td>${gA}</td><td>${gB}</td></tr>`;
      }
      html += `</table>`;
    }
    comparisonContent.innerHTML = html;
  }
  document.getElementById("tabVolume").addEventListener("click", () => {
    document.getElementById("panelVolume").classList.remove("hidden");
    document.getElementById("panelThermal").classList.add("hidden");
    document.getElementById("panelInverter").classList.add("hidden");
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.getElementById("tabVolume").classList.add("active");
    const thermoRight = document.getElementById("thermoRightPanel");
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (thermoRight) thermoRight.classList.add("hidden");
    if (frontCanvas) frontCanvas.style.display = "";
    if (sideCanvas) sideCanvas.style.display = "";
  });
  document.getElementById("tabThermal").addEventListener("click", () => {
    document.getElementById("panelThermal").classList.remove("hidden");
    document.getElementById("panelVolume").classList.add("hidden");
    document.getElementById("panelInverter").classList.add("hidden");
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.getElementById("tabThermal").classList.add("active");
    const thermoRight = document.getElementById("thermoRightPanel");
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (thermoRight) thermoRight.classList.remove("hidden");
    if (frontCanvas) frontCanvas.style.display = "none";
    if (sideCanvas) sideCanvas.style.display = "none";
  });
  document.getElementById("tabInverter").addEventListener("click", () => {
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    document.getElementById("panelInverter").classList.remove("hidden");
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.getElementById("tabInverter").classList.add("active");
    const thermoRight = document.getElementById("thermoRightPanel");
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (thermoRight) thermoRight.classList.remove("hidden");
    if (frontCanvas) frontCanvas.style.display = "none";
    if (sideCanvas) sideCanvas.style.display = "none";
  });
  initThermoUI({
    getGeometry: () => readGeometryFromPanel(),
    setGeometryProvider: null
  });
  enableCoordinateTooltip(
    document.getElementById("schematicFront"),
    document.getElementById("schematicSide"),
    () => readGeometryFromPanel()
  );
  updateRShowerVisibility();
})();
