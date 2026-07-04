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
    showDirtyOverlay: true
  };
  var STORAGE_KEY = "refrigerator-calc-settings";
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
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

  // src/js/engine/calc.js
  function deriveRootSpace(cabinet, layout) {
    const { external, wallThicknessesByType, airGap } = cabinet;
    const boundaryTypes = {
      top: /* @__PURE__ */ new Set(),
      bottom: /* @__PURE__ */ new Set(),
      left: /* @__PURE__ */ new Set(),
      right: /* @__PURE__ */ new Set()
    };
    walkBoundaries(layout, boundaryTypes, true, true, true, true);
    const allTypes = ["fresh", "freezer", "flex"];
    const effective = {};
    for (const face of ["top", "bottom", "left", "right"]) {
      const typesForFace = boundaryTypes[face];
      let maxVal = 0;
      for (const type of typesForFace) {
        const val = wallThicknessesByType[type]?.[face] ?? 0;
        if (val > maxVal) maxVal = val;
      }
      if (typesForFace.size === 0) {
        for (const type of allTypes) {
          const val = wallThicknessesByType[type]?.[face] ?? 0;
          if (val > maxVal) maxVal = val;
        }
      }
      effective[face] = maxVal;
    }
    effective.rear = Math.max(...allTypes.map((t) => wallThicknessesByType[t]?.rear ?? 0));
    effective.door = Math.max(...allTypes.map((t) => wallThicknessesByType[t]?.door ?? 0));
    return {
      width: external.width - effective.left - effective.right,
      height: external.height - effective.top - effective.bottom,
      depth: external.depth - effective.rear - effective.door
    };
  }
  function walkBoundaries(node, boundary, topMost, bottomMost, leftMost, rightMost) {
    if (node.nodeType === "leaf") {
      if (topMost) boundary.top.add(node.type);
      if (bottomMost) boundary.bottom.add(node.type);
      if (leftMost) boundary.left.add(node.type);
      if (rightMost) boundary.right.add(node.type);
    } else if (node.nodeType === "horizontal") {
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        const isFirst = i === 0;
        const isLast = i === children.length - 1;
        walkBoundaries(
          children[i].node,
          boundary,
          topMost && isFirst,
          bottomMost && isLast,
          leftMost,
          rightMost
        );
      }
    } else if (node.nodeType === "vertical") {
      walkBoundaries(node.left, boundary, topMost, bottomMost, true, false);
      walkBoundaries(node.right, boundary, topMost, bottomMost, false, true);
    }
  }
  function calcLeafGross(leaf, space) {
    const gross = space.width * space.height * space.depth * settings.mm3ToL;
    return {
      leafId: leaf.id,
      gross
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

  // src/js/engine/validationPass1.js
  var VALID_TYPES = /* @__PURE__ */ new Set(["fresh", "freezer", "flex"]);
  var VALID_MODES = /* @__PURE__ */ new Set(["ratio", "explicit"]);
  var MAX_LEAVES = 8;
  var RATIO_TOL = 1e-3;
  function validateStructure(rootNode) {
    const errors = [];
    const leafCount = countLeaves(rootNode);
    if (leafCount > MAX_LEAVES) {
      errors.push({
        rule: "maxLeaves",
        message: `${leafCount} leaves exceed maximum of ${MAX_LEAVES}`
      });
    }
    walkStructure(rootNode, errors);
    return errors;
  }
  function countLeaves(node) {
    if (node.nodeType === "leaf") return 1;
    if (node.nodeType === "vertical") {
      return countLeaves(node.left) + countLeaves(node.right);
    }
    if (node.nodeType === "horizontal") {
      return node.children.reduce((sum, c) => sum + countLeaves(c.node), 0);
    }
    return 0;
  }
  function walkStructure(node, errors) {
    if (!node || typeof node !== "object") {
      errors.push({ rule: "malformedNode", message: "Node is null or not an object" });
      return;
    }
    switch (node.nodeType) {
      case "leaf":
        checkLeafStructure(node, errors);
        break;
      case "horizontal":
        checkHorizontalShape(node, errors);
        checkHeightRatios(node, errors);
        for (const child of node.children) walkStructure(child.node, errors);
        break;
      case "vertical":
        checkVerticalShape(node, errors);
        walkStructure(node.left, errors);
        walkStructure(node.right, errors);
        break;
      default:
        errors.push({
          rule: "unknownNodeType",
          nodeId: node.id,
          message: `Unknown nodeType: "${node.nodeType}"`
        });
    }
  }
  function checkLeafStructure(node, errors) {
    checkEnums(node, errors);
    checkPositiveFittingValues(node, errors);
  }
  function checkEnums(node, errors) {
    if (!VALID_TYPES.has(node.type)) {
      errors.push({
        rule: "checkEnums",
        nodeId: node.id,
        message: `Unknown compartment type: ${node.type}`
      });
    }
    if (!node.fittings) {
      errors.push({
        rule: "missingFittings",
        nodeId: node.id,
        message: "LeafNode is missing fittings object"
      });
    }
  }
  function checkPositiveFittingValues(node, errors) {
    if (!node.fittings) return;
    const f = node.fittings;
    for (const shelf of f.shelves ?? []) {
      checkPositive(shelf, ["positionFromFloor", "thickness", "depth"], errors, node.id);
      if (shelf.width != null) checkPositive(shelf, ["width"], errors, node.id);
    }
    for (const drawer of f.drawers ?? []) {
      checkPositive(drawer, ["outerWidth", "outerDepth", "outerHeight", "wallThickness"], errors, node.id);
    }
    for (const bin of f.doorBins ?? []) {
      checkPositive(bin, ["outerWidth", "outerHeight", "outerDepth", "wallThickness"], errors, node.id);
    }
    if (f.iceMakerHousing?.volume != null && f.iceMakerHousing.volume <= 0) {
      errors.push({
        rule: "positiveValues",
        nodeId: node.id,
        message: "iceMakerHousing.volume must be > 0"
      });
    }
    if (f.lightHousing?.volume != null && f.lightHousing.volume <= 0) {
      errors.push({
        rule: "positiveValues",
        nodeId: node.id,
        message: "lightHousing.volume must be > 0"
      });
    }
  }
  function checkHorizontalShape(node, errors) {
    const { children, dividers, id } = node;
    const expectedDividers = children.length - 1;
    if (dividers.length !== expectedDividers) {
      errors.push({
        rule: "dividerCount",
        nodeId: id,
        message: `Expected ${expectedDividers} divider(s), found ${dividers.length}`
      });
    }
    const seen = /* @__PURE__ */ new Set();
    for (const d of dividers) {
      if (seen.has(d.afterChildIndex)) {
        errors.push({
          rule: "afterChildIndex_unique",
          nodeId: id,
          message: `Duplicate afterChildIndex: ${d.afterChildIndex}`
        });
      }
      seen.add(d.afterChildIndex);
      if (d.afterChildIndex < 0 || d.afterChildIndex > children.length - 2) {
        errors.push({
          rule: "afterChildIndex_range",
          nodeId: id,
          message: `afterChildIndex ${d.afterChildIndex} out of range [0, ${children.length - 2}]`
        });
      }
    }
    const modes = new Set(children.map((c) => c.heightMode));
    if (modes.size > 1) {
      errors.push({
        rule: "heightMode_uniform",
        nodeId: id,
        message: "Mixed heightMode in same HorizontalSplitNode"
      });
      return;
    }
    for (const child of children) {
      if (!VALID_MODES.has(child.heightMode)) {
        errors.push({
          rule: "heightMode_unknown",
          nodeId: id,
          message: `Unknown heightMode: "${child.heightMode}"`
        });
      }
    }
  }
  function checkHeightRatios(node, errors) {
    if (!node.children.length) return;
    const mode = node.children[0].heightMode;
    if (mode !== "ratio") return;
    const sum = node.children.reduce((acc, c) => acc + c.heightValue, 0);
    if (Math.abs(sum - 1) > RATIO_TOL) {
      errors.push({
        rule: "heightBalance_ratio",
        nodeId: node.id,
        message: `Ratio sum ${sum.toFixed(4)} deviates from 1.0 by more than ${RATIO_TOL}`
      });
    }
  }
  function checkVerticalShape(node, errors) {
    const { leftWidthRatio, dividerThickness, id } = node;
    if (leftWidthRatio <= 0 || leftWidthRatio >= 1) {
      errors.push({
        rule: "leftWidthRatio_bounds",
        nodeId: id,
        message: `leftWidthRatio must satisfy 0 < value < 1, got ${leftWidthRatio}`
      });
    }
    if (dividerThickness <= 0) {
      errors.push({
        rule: "positiveValues",
        nodeId: id,
        message: `VerticalSplitNode dividerThickness must be > 0, got ${dividerThickness}`
      });
    }
  }
  function checkPositive(obj, fields, errors, nodeId) {
    for (const field of fields) {
      if (obj[field] <= 0) {
        errors.push({
          rule: "positiveValues",
          nodeId,
          message: `${field} must be > 0, got ${obj[field]}`
        });
      }
    }
  }

  // src/js/engine/traversal.js
  var DIM_TOL = 0.01;
  function traverseAndCompute(rootNode, rootSpace) {
    const errors = [];
    const warnings = [];
    const leaves = [];
    traverseNode(rootNode, rootSpace, errors, warnings, leaves);
    return { leaves, errors, warnings };
  }
  function traverseNode(node, space, errors, warnings, leaves) {
    switch (node.nodeType) {
      case "leaf":
        processLeaf(node, space, errors, warnings, leaves);
        break;
      case "horizontal":
        processHorizontal(node, space, errors, warnings, leaves);
        break;
      case "vertical":
        processVertical(node, space, errors, warnings, leaves);
        break;
    }
  }
  function processHorizontal(node, space, errors, warnings, leaves) {
    const { children, dividers, id } = node;
    const mode = children[0].heightMode;
    let childHeights;
    if (mode === "ratio") {
      const totalDividerH = dividers.reduce((s, d) => s + d.thickness, 0);
      const usableH = space.height - totalDividerH;
      childHeights = children.map((c) => usableH * c.heightValue);
    } else {
      const sumHeights = children.reduce((s, c) => s + c.heightValue, 0);
      const sumDividers = dividers.reduce((s, d) => s + d.thickness, 0);
      const total = sumHeights + sumDividers;
      if (Math.abs(total - space.height) > DIM_TOL) {
        errors.push({
          rule: "heightBalance_explicit",
          nodeId: id,
          message: `Sum of heights (${sumHeights}) + dividers (${sumDividers}) = ${total} \u2260 availableHeight (${space.height})`,
          childrenSkipped: true
        });
        return;
      }
      childHeights = children.map((c) => c.heightValue);
    }
    for (let i = 0; i < children.length; i++) {
      const childSpace = {
        width: space.width,
        height: childHeights[i],
        depth: space.depth
      };
      traverseNode(children[i].node, childSpace, errors, warnings, leaves);
    }
  }
  function processVertical(node, space, errors, warnings, leaves) {
    const { dividerThickness, leftWidthRatio, left, right, id } = node;
    if (dividerThickness >= space.width) {
      errors.push({
        rule: "verticalDividerBounds",
        nodeId: id,
        message: `dividerThickness (${dividerThickness}) \u2265 availableWidth (${space.width})`,
        childrenSkipped: true
      });
      return;
    }
    const usableW = space.width - dividerThickness;
    const leftW = usableW * leftWidthRatio;
    const rightW = usableW * (1 - leftWidthRatio);
    traverseNode(left, { width: leftW, height: space.height, depth: space.depth }, errors, warnings, leaves);
    traverseNode(right, { width: rightW, height: space.height, depth: space.depth }, errors, warnings, leaves);
  }
  function processLeaf(node, space, errors, warnings, leaves) {
    const { fittings, id } = node;
    for (const shelf of fittings.shelves ?? []) {
      errors.push(...validateShelf(shelf, space, id));
    }
    for (const drawer of fittings.drawers ?? []) {
      errors.push(...validateDrawer(drawer, space, id));
    }
    for (const bin of fittings.doorBins ?? []) {
      errors.push(...validateDoorBin(bin, space, id));
    }
    const binDepthWarning = checkDoorBinDepth(fittings, space, id);
    if (binDepthWarning) warnings.push(binDepthWarning);
    const leafResult = calcLeafGross(node, space);
    leaves.push(leafResult);
  }
  function validateShelf(shelf, space, nodeId) {
    const errs = [];
    const topEdge = shelf.positionFromFloor + shelf.thickness;
    if (shelf.positionFromFloor <= 0) {
      errs.push({
        rule: "shelfPosition",
        nodeId,
        message: `Shelf positionFromFloor must be > 0, got ${shelf.positionFromFloor}`
      });
    } else if (topEdge >= space.height) {
      errs.push({
        rule: "shelfPosition",
        nodeId,
        message: `Shelf top (${topEdge} mm) exceeds compartment height (${space.height} mm)`
      });
    }
    if (shelf.depth > space.depth) {
      errs.push({
        rule: "shelfDepth",
        nodeId,
        message: `Shelf depth (${shelf.depth}) exceeds availableDepth (${space.depth})`
      });
    }
    if (shelf.width != null && shelf.width > space.width) {
      errs.push({
        rule: "shelfWidth",
        nodeId,
        message: `Shelf width (${shelf.width}) exceeds availableWidth (${space.width})`
      });
    }
    return errs;
  }
  function validateDrawer(drawer, space, nodeId) {
    const errs = [];
    const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;
    if (oW > space.width) {
      errs.push({
        rule: "drawerBounds",
        nodeId,
        message: `Drawer outerWidth (${oW}) exceeds availableWidth (${space.width})`
      });
    }
    if (oD > space.depth) {
      errs.push({
        rule: "drawerBounds",
        nodeId,
        message: `Drawer outerDepth (${oD}) exceeds availableDepth (${space.depth})`
      });
    }
    if (oH >= space.height) {
      errs.push({
        rule: "drawerBounds",
        nodeId,
        message: `Drawer outerHeight (${oH}) must be < compartment height (${space.height})`
      });
    }
    const minOuter = Math.min(oW, oD, oH);
    if (t >= minOuter * 0.5) {
      errs.push({
        rule: "drawerWall",
        nodeId,
        message: `wallThickness (${t}) \u2265 50% of smallest outer dimension (${minOuter})`
      });
    }
    const innerW = oW - 2 * t;
    const innerD = oD - 2 * t;
    const innerH = oH - t;
    if (innerW <= 0) errs.push({ rule: "drawerInnerPositive", nodeId, message: `Derived innerWidth \u2264 0` });
    if (innerD <= 0) errs.push({ rule: "drawerInnerPositive", nodeId, message: `Derived innerDepth \u2264 0` });
    if (innerH <= 0) errs.push({ rule: "drawerInnerPositive", nodeId, message: `Derived innerHeight \u2264 0` });
    return errs;
  }
  function validateDoorBin(bin, space, nodeId) {
    const errs = [];
    const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;
    const minOuter = Math.min(oW, oH, oD);
    if (t >= minOuter * 0.5) {
      errs.push({
        rule: "doorBinWall",
        nodeId,
        message: `wallThickness (${t}) \u2265 50% of smallest outer dimension (${minOuter})`
      });
    }
    const innerW = oW - 2 * t;
    const innerH = oH - 2 * t;
    const innerD = oD - t;
    if (innerW <= 0) errs.push({ rule: "doorBinInnerPositive", nodeId, message: `Derived innerWidth \u2264 0` });
    if (innerH <= 0) errs.push({ rule: "doorBinInnerPositive", nodeId, message: `Derived innerHeight \u2264 0` });
    if (innerD <= 0) errs.push({ rule: "doorBinInnerPositive", nodeId, message: `Derived innerDepth \u2264 0` });
    return errs;
  }
  function checkDoorBinDepth(fittings, space, nodeId) {
    const bins = fittings.doorBins ?? [];
    const shelves = fittings.shelves ?? [];
    if (!bins.length) return null;
    const totalBinDepth = bins.reduce((s, b) => s + b.outerDepth, 0);
    const minShelfDepth = shelves.length ? Math.min(...shelves.map((s) => s.depth)) : 0;
    const threshold = space.depth - minShelfDepth;
    if (totalBinDepth > threshold) {
      return {
        rule: "doorBinDepth",
        nodeId,
        message: `\u03A3 bin depths (${totalBinDepth} mm) exceeds availableDepth \u2212 minShelfDepth (${threshold} mm)`
      };
    }
    return null;
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
  function toVolumeFormat(geom) {
    const { H, W, D, walls } = geom;
    const t = {
      fresh: {
        top: walls.refrigerator.top,
        bottom: walls.refrigerator.bottom1,
        left: walls.refrigerator.left,
        right: walls.refrigerator.right,
        rear: walls.refrigerator.rear,
        door: walls.refrigerator.door
      },
      freezer: {
        top: walls.freezer.top,
        bottom: walls.freezer.bottom,
        left: walls.freezer.left,
        right: walls.freezer.right,
        rear: walls.freezer.rear,
        door: walls.freezer.door
      },
      flex: {
        top: walls.refrigerator.top,
        bottom: walls.refrigerator.bottom1,
        left: walls.refrigerator.left,
        right: walls.refrigerator.right,
        rear: walls.refrigerator.rear,
        door: walls.refrigerator.door
      }
    };
    return {
      external: { height: H, width: W, depth: D },
      wallThicknessesByType: t,
      airGap: 0
    };
  }
  function toThermalFormat(geom) {
    const { H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos, walls } = geom;
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
      tFtop: walls.freezer.top,
      tFleft: walls.freezer.left,
      tFright: walls.freezer.right,
      tFbottom: walls.freezer.bottom,
      tFdoor: walls.freezer.door,
      tFback: walls.freezer.rear,
      tEvaBack: walls.freezer.rear,
      tRtop: walls.refrigerator.top,
      tRleft: walls.refrigerator.left,
      tRright: walls.refrigerator.right,
      tRback: walls.refrigerator.rear,
      tRbottom1: walls.refrigerator.bottom1,
      tRbottom2: walls.refrigerator.bottom2,
      tRbottom3: walls.refrigerator.bottom3,
      tRdoor: walls.refrigerator.door
    };
  }
  function upgradeConfig(oldConfig) {
    if (!oldConfig?.cabinet) throw new Error("Invalid old config");
    const { external, wallThicknessesByType, airGap, layout } = oldConfig.cabinet;
    const def = DEFAULT_CABINET;
    const walls = {
      freezer: {
        top: wallThicknessesByType?.freezer?.top ?? def.walls.freezer.top,
        bottom: wallThicknessesByType?.freezer?.bottom ?? def.walls.freezer.bottom,
        left: wallThicknessesByType?.freezer?.left ?? def.walls.freezer.left,
        right: wallThicknessesByType?.freezer?.right ?? def.walls.freezer.right,
        door: wallThicknessesByType?.freezer?.door ?? def.walls.freezer.door,
        rear: def.walls.freezer.rear
        // old format had no "rear" for freezer
      },
      refrigerator: {
        top: wallThicknessesByType?.fresh?.top ?? def.walls.refrigerator.top,
        bottom1: wallThicknessesByType?.fresh?.bottom ?? def.walls.refrigerator.bottom1,
        bottom2: def.walls.refrigerator.bottom2,
        bottom3: def.walls.refrigerator.bottom3,
        left: wallThicknessesByType?.fresh?.left ?? def.walls.refrigerator.left,
        right: wallThicknessesByType?.fresh?.right ?? def.walls.refrigerator.right,
        door: wallThicknessesByType?.fresh?.door ?? def.walls.refrigerator.door,
        rear: def.walls.refrigerator.rear
      }
    };
    const geom = {
      H: external.height,
      W: external.width,
      D: external.depth,
      Hf: def.Hf,
      Hr: def.Hr,
      Hb: def.Hb,
      Db1: def.Db1,
      Db2: def.Db2,
      doorGap: def.doorGap,
      packingPos: def.packingPos,
      airGap: airGap ?? def.airGap,
      walls
    };
    return {
      schemaVersion: "2.0",
      meta: {
        ...oldConfig.meta,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        upgradedFrom: oldConfig.schemaVersion
      },
      cabinet: {
        geometry: geom,
        layout
      }
    };
  }

  // src/js/engine/index.js
  function validateCabinet(cabinet) {
    const errors = [];
    const { external, wallThicknessesByType, layout, airGap } = cabinet;
    for (const [key, val] of Object.entries(external)) {
      if (val <= 0) {
        errors.push({ rule: "positiveValues", message: `external.${key} must be > 0, got ${val}` });
      }
    }
    const boundaryTypes = { top: /* @__PURE__ */ new Set(), bottom: /* @__PURE__ */ new Set(), left: /* @__PURE__ */ new Set(), right: /* @__PURE__ */ new Set() };
    walkBoundaries(layout, boundaryTypes, true, true, true, true);
    const effective = {};
    const allTypes = ["fresh", "freezer", "flex"];
    for (const face of ["top", "bottom", "left", "right"]) {
      let max = 0;
      for (const t of boundaryTypes[face]) {
        const val = wallThicknessesByType[t]?.[face] ?? 0;
        if (val > max) max = val;
      }
      if (boundaryTypes[face].size === 0) {
        for (const t of allTypes) max = Math.max(max, wallThicknessesByType[t]?.[face] ?? 0);
      }
      effective[face] = max;
    }
    effective.rear = Math.max(...allTypes.map((t) => wallThicknessesByType[t]?.rear ?? 0));
    effective.door = Math.max(...allTypes.map((t) => wallThicknessesByType[t]?.door ?? 0));
    const pairs = [
      ["top", external.height, "height"],
      ["bottom", external.height, "height"],
      ["left", external.width, "width"],
      ["right", external.width, "width"],
      ["rear", external.depth, "depth"],
      ["door", external.depth, "depth"]
    ];
    for (const [face, extDim, dimName] of pairs) {
      const thickness = effective[face];
      if (thickness >= extDim * 0.5) {
        errors.push({
          rule: "wallRatio",
          message: `${face} wall (${thickness} mm) exceeds 50% of external ${dimName} (${extDim * 0.5} mm)`
        });
      }
    }
    if (errors.length === 0) {
      const rootSpace = deriveRootSpace({ external, wallThicknessesByType, airGap }, layout);
      for (const [dim, val] of Object.entries(rootSpace)) {
        if (val <= 0) {
          errors.push({
            rule: "internalPositive",
            message: `Derived internal ${dim} (${val} mm) is \u2264 0 after wall subtraction`
          });
        }
      }
    }
    return errors;
  }
  function runCalculation(config) {
    const result = { leaves: null, totals: null, validationErrors: [], calcErrors: [], warnings: [] };
    const structErrors = validateStructure(config.cabinet.layout);
    if (structErrors.length) {
      result.validationErrors = structErrors;
      return result;
    }
    if (config.schemaVersion === "1.0" || !config.cabinet.geometry && config.cabinet.external) {
      config = upgradeConfig(config);
    }
    const { geometry, layout } = config.cabinet;
    const volumeGeom = toVolumeFormat(geometry);
    const cabinetErrors = validateCabinet({ ...volumeGeom, layout });
    if (cabinetErrors.length) {
      result.validationErrors = cabinetErrors;
      return result;
    }
    const rootSpace = deriveRootSpace(volumeGeom, layout);
    const { leaves, errors: dimErrors, warnings } = traverseAndCompute(layout, rootSpace);
    result.validationErrors = dimErrors;
    result.warnings = warnings;
    result.leaves = leaves.map((l) => ({ leafId: l.leafId, gross: l.gross }));
    if (leaves.length > 0) {
      const totalGross = leaves.reduce((sum, l) => sum + l.gross, 0);
      result.totals = { gross: totalGross };
    }
    return result;
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
  function formatLeafDisplay(leaf) {
    return {
      gross: roundForDisplay(leaf.gross, "L"),
      grossCuft: roundForDisplay(toCuft(leaf.gross), "cuft")
    };
  }
  function formatTotalsDisplay2(totals) {
    return {
      gross: roundForDisplay(totals.gross, "L"),
      grossCuft: roundForDisplay(toCuft(totals.gross), "cuft")
    };
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
    const t = formatTotalsDisplay2(result.totals);
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
    color = "#2980b9",
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
      const gap = 4;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-tw / 2 - 4, -th - gap - 2, tw + 8, th + 4, 3);
      } else {
        ctx.fillRect(-tw / 2 - 4, -th - gap - 2, tw + 8, th + 4);
      }
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, 0, -gap);
    }
    ctx.restore();
  }
  function drawFrontView(canvas, geometry, effectiveWalls, layout, leaves, options = {}) {
    const ctx = canvas.getContext("2d");
    const { H, W } = geometry;
    const { dividerThickness = 0, compHeights = [], compartments = [] } = options;
    const PAD = { left: 50, top: 40, right: 40, bottom: 40 };
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const scale = Math.min(drawW / W, drawH / H);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(PAD.left, PAD.top);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W * scale, H * scale);
    const innerLeft = compartments.map((c) => c.left);
    const innerRight = compartments.map((c) => W - c.right);
    const intTop = effectiveWalls.top;
    const intBottom = H - effectiveWalls.bottom;
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
      if (i < compHeights.length - 1) {
      }
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
    if (options.fittings && leaves) {
      const internalWidth = W - effectiveWalls.left - effectiveWalls.right;
      let yOffset = effectiveWalls.top;
      for (let i = 0; i < compHeights.length; i++) {
        const compH = compHeights[i];
        const fittingsForLeaf = options.fittings.find((f) => f.leafId === leaves[i]?.leafId);
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
    drawDim(ctx, 0, H * scale, W * scale, H * scale, 35, `[W= ${W.toFixed(0)}]`);
    drawDim(ctx, 0, 0, innerLeft[0] * scale, 0, -20, `[tLeft= ${compartments[0].left.toFixed(0)}]`);
    drawDim(ctx, innerRight[0] * scale, 0, W * scale, 0, -20, `[tRight= ${compartments[0].right.toFixed(0)}]`);
    ctx.restore();
  }
  function drawSideView(canvas, geometry, effectiveWalls, options = {}) {
    const ctx = canvas.getContext("2d");
    const { H, D, Hb, Db1, Db2, walls } = geometry;
    const { dividerThickness = 0, compHeights = [], doorGap = 0, compartments = [] } = options;
    const tTop = effectiveWalls.top;
    const tDoor = effectiveWalls.door;
    const tRear = effectiveWalls.rear;
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
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, D * scale, H * scale);
    const innerDoor = D - tDoor;
    const innerTop = tTop;
    const floorLowerY = H - tRbottom3;
    const floorRaisedY = H - Hb - tRbottom1;
    const bottomRear = compRear.length === 2 ? compRear[1] : compRear[0];
    const slopeStartX = bottomRear + Db1;
    const slopeEndX = bottomRear + Db2;
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
      ctx.fillStyle = "#f0f0f0";
      ctx.fill();
    }
    const slopeDx = slopeEndX - slopeStartX;
    const slopeDy = floorLowerY - floorRaisedY;
    const slopeLen = Math.sqrt(slopeDx * slopeDx + slopeDy * slopeDy);
    let nx = slopeDy / slopeLen;
    let ny = -slopeDx / slopeLen;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
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
    ctx.fillStyle = "#ddd";
    ctx.fill();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("Comp.", 6, yTopCB * scale + 14);
    ctx.beginPath();
    ctx.rect(topRearX, topY, innerDoor * scale - topRearX, topCompH);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#0066cc";
    ctx.lineWidth = 1.5;
    ctx.stroke();
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
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#0066cc";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    let drawnDoors = [];
    if (compHeights.length === 2 && dividerThickness > 0) {
      const dividerY = innerTop + topH;
      const dividerH = dividerThickness;
      ctx.fillStyle = "#aaa";
      ctx.fillRect(
        0,
        dividerY * scale,
        innerDoor * scale,
        dividerH * scale
      );
      ctx.strokeStyle = "#666";
      ctx.strokeRect(
        0,
        dividerY * scale,
        innerDoor * scale,
        dividerH * scale
      );
      const doorLeftX = innerDoor * scale;
      const doorWidth = (D - innerDoor) * scale;
      const topDoorTop = 0;
      const topDoorBottom = (dividerY + dividerH / 2) * scale - doorGap / 2 * scale;
      const bottomDoorTop = (dividerY + dividerH / 2) * scale + doorGap / 2 * scale;
      const bottomDoorBottom = H * scale;
      ctx.fillStyle = "rgba(173, 216, 230, 0.5)";
      ctx.fillRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
      ctx.fillRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);
      ctx.strokeStyle = "#555";
      ctx.strokeRect(doorLeftX, topDoorTop, doorWidth, topDoorBottom - topDoorTop);
      ctx.strokeRect(doorLeftX, bottomDoorTop, doorWidth, bottomDoorBottom - bottomDoorTop);
      drawnDoors.push({ top: topDoorTop, bottom: topDoorBottom });
      drawnDoors.push({ top: bottomDoorTop, bottom: bottomDoorBottom });
      drawDim(
        ctx,
        D * scale,
        topDoorBottom,
        D * scale,
        bottomDoorTop,
        -45,
        `[door gap= ${(dividerThickness + doorGap).toFixed(0)}]`
      );
    } else {
      drawnDoors.push({ top: innerTop * scale, bottom: floorLowerY * scale });
    }
    drawDim(ctx, 0, H * scale, 0, 0, -45, `[H= ${H.toFixed(0)}]`);
    drawDim(ctx, 0, H * scale, 0, floorRaisedY * scale, -20, `[Hb= ${Hb.toFixed(0)}]`);
    drawDim(ctx, 0, 0, D * scale, 0, -25, `[D= ${D.toFixed(0)}]`);
    drawDim(ctx, bottomRear * scale, floorRaisedY * scale, slopeStartX * scale, floorRaisedY * scale, -18, `[Db1= ${Db1.toFixed(0)}]`);
    drawDim(ctx, bottomRear * scale, floorLowerY * scale, slopeEndX * scale, floorLowerY * scale, -18, `[Db2= ${Db2.toFixed(0)}]`);
    const topMidX = (tRear + innerDoor) / 2 * scale;
    drawDim(ctx, topMidX, 0, topMidX, innerTop * scale, 0, `[tTop= ${tTop.toFixed(0)}]`);
    drawnDoors.forEach((door) => {
      const doorMidY = (door.top + door.bottom) / 2.5;
      drawDim(ctx, innerDoor * scale, doorMidY, D * scale, doorMidY, 0, `[tDoor= ${tDoor.toFixed(0)}]`);
    });
    for (let i = 0; i < compHeights.length; i++) {
      if (i === 0 || compRear[i] !== compRear[i - 1]) {
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
      drawDim(
        ctx,
        D * scale + 20,
        innerTop * scale,
        D * scale + 20,
        (innerTop + compHeights[0]) * scale,
        0,
        `[h= ${compHeights[0].toFixed(0)}]`
      );
    }
    ctx.restore();
  }

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
      if (confirm("Reset all settings to factory defaults?")) {
        resetToDefaults();
        updateSettings(settings);
        renderSettingsTabs();
        modal.classList.add("hidden");
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
    const data = { ...settings, compressors: getCompressorList() };
  }
  function importSettings() {
  }
  function resetToDefaults() {
    const defaults = {
      autoCalculate: true,
      showDirtyOverlay: true,
      mm3ToL: 1e-6,
      lToCuft: 0.0353147,
      displayPrecisionL: 2,
      displayPrecisionCuft: 3,
      canvasWidth: 600,
      canvasHeight: 800
    };
    Object.assign(settings, defaults);
  }

  // src/js/engine/thermo/constants.js
  var PHYSICAL_CONSTANTS = Object.freeze({
    // -------------------------------------------------------------------
    // Dry air properties (at approx. -20 °C to +60 °C – constant for modelling)
    // -------------------------------------------------------------------
    air: {
      density: 1.365,
      // kg/m³     (Excel: MAIN B20)
      cp: 0.24
      // kcal/kg·°C (Excel: MAIN B21)
    },
    // -------------------------------------------------------------------
    // Insulation materials – thermal conductivity (kcal / (m·h·°C))
    // -------------------------------------------------------------------
    insulation: {
      urethane: 0.0165,
      // rigid polyurethane foam (SIZE B33)
      polystyrene: 0.035,
      // (SIZE B34)
      packing: 0.035
      // door gasket material (SIZE B36)
    },
    // -------------------------------------------------------------------
    // Surface heat‑transfer coefficients (kcal / (m²·h·°C))
    // -------------------------------------------------------------------
    surfaceCoefficients: {
      outside: 6,
      // ambient air to cabinet (SIZE B40)
      inside: 10
      // cabinet interior air to wall (SIZE B41)
    },
    // -------------------------------------------------------------------
    // Unit conversions
    // -------------------------------------------------------------------
    conversion: {
      wattToKcalPerH: 0.86
      // kcal/h → W : multiply by 1/0.86 ≈ 1.16279
    }
  });

  // src/js/engine/thermo/heatLoad.js
  function lambdaUrethane(T_in, T_out) {
    const T_avg = (T_in + T_out) / 2;
    return 0.0165 + 11e-5 * (T_avg - 25);
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
    const T_comp = 50 * PR + T0;
    const T_compZone = T0 + (TC - T0) * PR;
    const TRise_side = (TC - T0) * K_side;
    const TRise_back = (TC - T0) * K_back;
    const T_wallSide = T0 + TRise_side * PR;
    const T_wallBack = T0 + TRise_back * PR;
    const isTopFreezer = freezerPosition === "top";
    const isBackCondenserAbsent = backCondenser !== "Yes";
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
    let QF = 0;
    QF += isTopFreezer ? kExterior(tFtop, TF, T0) * AFtop * (T0 - TF) : kInterior(tFtop, TF, TR) * AFtop * (TR - TF);
    QF += kExterior(tFleft, TF, T_wallSide) * AFleft1 * (T_wallSide - TF) + kExterior(tFright, TF, T_wallSide) * AFright1 * (T_wallSide - TF) + kExterior(tFleft, T2, T_wallSide) * AFleft2 * (T_wallSide - T2) + kExterior(tFright, T2, T_wallSide) * AFright2 * (T_wallSide - T2);
    if (isTopFreezer) {
      const AFbottom = (D - tFback / 2) * (W - (tFleft + tFright) / 2) / 1e6;
      QF += kInterior(tFbottom, TF, TR) * AFbottom * (TR - TF);
    } else {
      const AFbottom1 = (W - (tFleft + tFright) / 2) * Db1 / 1e6;
      const AFbottom2 = (W - (tFleft + tFright) / 2) * Math.sqrt(Hb * Hb + (Db2 - Db1) ** 2) / 1e6;
      const AFbottom3 = (W - (tFleft + tFright) / 2) * (D - Db2) / 1e6;
      QF += kExterior(tFfloor1, TF, T_compZone) * AFbottom1 * (T_compZone - TF) + kExterior(tFfloor2, TF, T_compZone) * AFbottom2 * (T_compZone - TF) + kExterior(tFfloor3, TF, T0) * AFbottom3 * (T0 - TF);
    }
    QF += kExterior(tFdoor, TF, T0) * AFdoor * (T0 - TF) + PHYSICAL_CONSTANTS.insulation.packing * AFpackin * (T0 - TF);
    QF += (0.1219 * (TC - TF) * PR + 0.07551 * (T0 - TF) * (1 - PR)) * (W - tFleft - tFright) / 1e3;
    QF += (0.0344 * (TC - TF) - 0.031235 * (T0 - TF)) * PR * (Hf * 2 + W) / 1e3;
    let ARtop, ARleft, ARback;
    const ARdoor = (Hr - doorGap / 2 - 2 * packingPos) * (W - 2 * packingPos) / 1e6;
    const ARpackin = (Hr - 2 * packingPos + (W - 2 * packingPos)) * 2 / 1e3;
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
    let QR = 0;
    QR += isTopFreezer ? kInterior(tRtop, TF, TR) * ARtop * (TF - TR) : kExterior(tRtop, TR, T0) * ARtop * (T0 - TR);
    QR += kExterior(tRleft, TR, T_wallSide) * ARleft * (T_wallSide - TR) + kExterior(tRright, TR, T_wallSide) * ARleft * (T_wallSide - TR);
    if (isBackCondenserAbsent) {
      QR += kExterior(tRback, TR, T0) * ARback * (T0 - TR);
    } else {
      QR += kExterior(tRback, TR, T_wallBack) * ARback * (T_wallBack - TR);
    }
    if (isTopFreezer) {
      const ARb1 = (W - (tRleft + tRright) / 2) * Db1 / 1e6;
      const ARb2 = (W - (tRleft + tRright) / 2) * Math.sqrt(Hb * Hb + (Db2 - Db1) ** 2) / 1e6;
      const ARb3 = (W - (tRleft + tRright) / 2) * (D - Db2) / 1e6;
      QR += kExterior(tRbottom1, TR, T_compZone) * ARb1 * (T_compZone - TR) + kExterior(tRbottom2, TR, T_compZone) * ARb2 * (T_compZone - TR) + kExterior(tRbottom3, TR, T0) * ARb3 * (T0 - TR);
    } else {
      const ARbottom = (W - (tRleft + tRright) / 2) * (D - tRback / 2) / 1e6;
      QR += kInterior(tRfloor, TF, TR) * ARbottom * (TF - TR);
    }
    QR += kExterior(tRdoor, TR, T0) * ARdoor * (T0 - TR) + PHYSICAL_CONSTANTS.insulation.packing * ARpackin * (T0 - TR);
    QR += (0.03322 * (TC - TR) - 0.030267 * (T0 - TR)) * PR * (Hr * 2) / 1e3;
    let A_evaBack;
    if (isTopFreezer) {
      A_evaBack = (W - (tFleft + tFright) / 2) * (Hf - (tFtop + tFbottom) / 2) / 1e6;
    } else {
      A_evaBack = (W - (tFleft + tFright) / 2) * (Hf - Hb - (tFtop + tFfloor1) / 2) / 1e6;
    }
    let QEV_cond;
    if (isBackCondenserAbsent) {
      QEV_cond = kExterior(tEvaBack, T2, T0) * A_evaBack * (T0 - T2);
    } else {
      QEV_cond = kExterior(tEvaBack, T2, T_wallBack) * A_evaBack * (T_wallBack - T2);
    }
    const fanLoad = (fanInputPower_W ?? 2.1) * PHYSICAL_CONSTANTS.conversion.wattToKcalPerH * PR;
    const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60 / 24) * PHYSICAL_CONSTANTS.conversion.wattToKcalPerH;
    return { QF, QR, QEV: QEV_cond + fanLoad + defrostLoad, fanLoad, defrostLoad };
  }

  // src/js/engine/thermo/condenser.js
  function calcQCout(geom, TC, T0, TF, TR, PR, PIPEPITCH, freezerPosition = "top", backCondenserEfficiency = 0) {
    const { H, W, D, Hf, Hr, Hb, Db1, Db2, tFright, tFleft } = geom;
    const sideArea = (H * (D - 60) - (Db1 + Db2) * Hb / 2) * 2 / 1e6;
    const backAreaRaw = W * (H - Hb) / 1e6;
    const backArea = backAreaRaw * backCondenserEfficiency;
    const K_side = 1.0738 - 4152e-6 * PIPEPITCH.side + 482e-8 * PIPEPITCH.side ** 2;
    const K_back = 1.0738 - 4152e-6 * PIPEPITCH.back + 482e-8 * PIPEPITCH.back ** 2;
    const TRise_side = (TC - T0) * K_side;
    const TRise_back = (TC - T0) * K_back;
    const Qdpfr = (0.1984 * (TC - T0) + 0.1219 * (TC - TF)) * PR * (W - tFright - tFleft) / 1e3;
    const isTop = freezerPosition === "top";
    let Qdpf;
    let Qdpr;
    if (isTop) {
      Qdpf = (0.3395 * (TC - T0) + 0.0344 * (TC - TF)) * PR * (Hf * 2 + W) / 1e3;
      Qdpr = (0.3405 * (TC - T0) + 0.03322 * (TC - TR)) * PR * (Hr * 2) / 1e3;
    } else {
      Qdpf = (0.3395 * (TC - T0) + 0.0344 * (TC - TR)) * PR * (Hf * 2) / 1e3;
      Qdpr = (0.3405 * (TC - T0) + 0.03322 * (TC - TF)) * PR * (Hr * 2 + W) / 1e3;
    }
    const Qdp = Qdpfr + Qdpf + Qdpr;
    const Qside = K_side * sideArea * (TC - T0);
    const Qback = K_back * backArea * (TC - T0);
    return { Qdpfr, Qdpf, Qdpr, Qdp, Qside, Qback, QCout: Qdp + Qside + Qback };
  }

  // src/js/engine/thermo/CompressorPerformance.js
  var SUCTION_TEMP_C = 32.2;
  var KELVIN_OFFSET = 273.16;
  function r134a_satPressure(T_K) {
    return Math.exp(
      104.918 - 5301.3 / T_K - 16.2481 * Math.log(T_K) + 0.0246593 * T_K
    );
  }
  function r134a_liquidEnthalpy(T_C) {
    return 100.019 + 0.31763 * T_C + 33057e-8 * T_C ** 2 + 35281e-10 * T_C ** 3;
  }
  function r134a_gasEnthalpy(T_K, Pe) {
    return 119.36 + 0.023174 * T_K + 31297e-8 * T_K ** 2 - 138.07 * Pe / T_K;
  }
  function r134a_specificVolume(T_K, Pe) {
    return 0.01077 + 8278e-7 * T_K / Pe - 4.511 / T_K - 118e-6 * Pe;
  }
  function r600a_satPressure(T_K) {
    return Math.exp(
      68.322 - 4401 / T_K - 9.8436 * Math.log(T_K) + 0.0127711 * T_K
    );
  }
  function r600a_liquidEnthalpy(T_C) {
    return 75.545 + 0.55731 * T_C + 7088e-7 * T_C ** 2 + 29408e-10 * T_C ** 3;
  }
  function r600a_gasEnthalpy(T_K, Pe) {
    return 104.5 + 0.049951 * T_K + 58822e-8 * T_K ** 2 - 249.18 * Pe / T_K;
  }
  function r600a_specificVolume(T_K, Pe) {
    return 0.015883 + 1455e-6 * T_K / Pe - 7.2936 / T_K - 4645e-7 * Pe;
  }
  function getRefrigerantProperties(REI) {
    if (REI === 1) {
      return {
        satPressure: r134a_satPressure,
        liquidEnthalpy: r134a_liquidEnthalpy,
        gasEnthalpy: r134a_gasEnthalpy,
        specificVolume: r134a_specificVolume
      };
    }
    if (REI === 2) {
      return {
        satPressure: r600a_satPressure,
        liquidEnthalpy: r600a_liquidEnthalpy,
        gasEnthalpy: r600a_gasEnthalpy,
        specificVolume: r600a_specificVolume
      };
    }
    throw new Error(
      `Unsupported refrigerant index ${REI}. Use 1 (R-134a) or 2 (R-600a).`
    );
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
      if (maxRow !== k) {
        [M[k], M[maxRow]] = [M[maxRow], M[k]];
      }
      const pivot = M[k][k];
      if (Math.abs(pivot) < 1e-12) {
        throw new Error(
          `Near-zero pivot at column ${k}. Normal equation matrix is singular \u2014 check for duplicate or linearly dependent data.`
        );
      }
      for (let j = k; j <= n; j++) {
        M[k][j] /= pivot;
      }
      for (let i = 0; i < n; i++) {
        if (i === k) continue;
        const factor = M[i][k];
        for (let j = k; j <= n; j++) {
          M[i][j] -= factor * M[k][j];
        }
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
        for (let k = 0; k < m; k++) {
          A[j][k] += f[j] * f[k];
        }
        b[j] += f[j] * y;
      }
    }
    return { A, b };
  }
  function computeCompressorCoefficients({
    cylinderVolumeCm3,
    speedRpm,
    refrigerantIndex,
    dataPoints
  }) {
    if (!Array.isArray(dataPoints) || dataPoints.length < 5) {
      throw new Error(
        `At least 5 data points required (W model needs 5 coefficients). Got ${dataPoints?.length ?? 0}.`
      );
    }
    const prop = getRefrigerantProperties(refrigerantIndex);
    const suctionTempK = SUCTION_TEMP_C + KELVIN_OFFSET;
    const hLiquid = prop.liquidEnthalpy(SUCTION_TEMP_C);
    const etaFeatures = [];
    const etaTargets = [];
    const wFeatures = [];
    const wTargets = [];
    for (const { TE, TC, Q, W } of dataPoints) {
      const Pe = prop.satPressure(TE + KELVIN_OFFSET);
      const Pc = prop.satPressure(TC + KELVIN_OFFSET);
      const hGas = prop.gasEnthalpy(suctionTempK, Pe);
      const vGas = prop.specificVolume(suctionTempK, Pe);
      const G = Q / (hGas - hLiquid);
      const displacement_m3h = cylinderVolumeCm3 * speedRpm * 60 / 1e6;
      const GK = displacement_m3h / vGas;
      const etaV = G / GK;
      etaFeatures.push([1, Pc / Pe, Pc]);
      etaTargets.push(etaV);
      wFeatures.push([1, TE, TC, TC * TE, TE * TE]);
      wTargets.push(W);
    }
    const { A: A_eta, b: b_eta } = buildNormalEquations(etaFeatures, etaTargets);
    const etaCoeffs = gaussJordanSolve(A_eta, b_eta);
    const { A: A_w, b: b_w } = buildNormalEquations(wFeatures, wTargets);
    const wCoeffs = gaussJordanSolve(A_w, b_w);
    return { etaCoeffs, wCoeffs };
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
    const displacement_m3h = cylinderVolumeCm3 * speedRpm * 60 / 1e6;
    const G = VolumetricEfficiency * displacement_m3h / vGas;
    const QCompressor = G * (hGas - hLiq);
    return {
      Pe,
      Pc,
      VolumetricEfficiency,
      QCompressor,
      CompPower,
      massFlow: G
    };
  }

  // src/js/engine/thermo/solver.js
  var RHO_AIR = PHYSICAL_CONSTANTS.air.density;
  var CP_AIR = PHYSICAL_CONSTANTS.air.cp;
  var KELVIN_OFFSET2 = 273.16;
  function getRefrigerantIndex(name) {
    if (name === "R-134a") return 1;
    if (name === "R-600a") return 2;
    throw new Error(`Unsupported refrigerant: ${name}`);
  }
  function evaluateCompressorSafely(TE, TC, refIndex, compParams) {
    if (compParams.useMap) {
      throw new Error(
        "Compressor map logic is required but missing. Implement map interpolation or provide polynomial coefficients (wCoeffs, etaCoeffs)."
      );
    }
    if (!compParams.wCoeffs || !compParams.etaCoeffs) {
      throw new Error("Missing polynomial coefficients (wCoeffs, etaCoeffs) for compressor evaluation.");
    }
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
  function newton2(F, x0, dx, tol, maxIter, debug = false) {
    let x = [x0[0], x0[1]];
    let prevF = [Infinity, Infinity];
    let prevX = [...x];
    for (let i = 0; i < maxIter; i++) {
      const f = F(x);
      const maxAbsF = Math.max(Math.abs(f[0]), Math.abs(f[1]));
      if (debug) console.log(
        `  Newton ${i}: T2=${x[0].toFixed(4)} PR=${x[1].toFixed(6)} F1=${f[0].toFixed(4)} F2=${f[1].toFixed(4)}`
      );
      if (maxAbsF <= tol) return { x, converged: true, iterations: i + 1 };
      if (maxAbsF > Math.max(Math.abs(prevF[0]), Math.abs(prevF[1])) && i > 0) {
        if (debug) console.log("  Damping");
        x[0] = (x[0] + prevX[0]) / 2;
        x[1] = (x[1] + prevX[1]) / 2;
        continue;
      }
      prevF = f;
      prevX = [...x];
      const J = [[0, 0], [0, 0]];
      for (let j = 0; j < 2; j++) {
        const xp = [x[0], x[1]];
        xp[j] += dx;
        const fp = F(xp);
        J[0][j] = (fp[0] - f[0]) / dx;
        J[1][j] = (fp[1] - f[1]) / dx;
      }
      const det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
      if (Math.abs(det) < 1e-12)
        return { x, converged: false, iterations: i + 1, error: "Singular Jacobian" };
      x[0] = Math.max(-80, Math.min(20, x[0] + (-f[0] * J[1][1] + f[1] * J[0][1]) / det));
      x[1] = Math.max(1e-3, Math.min(0.999, x[1] + (J[0][0] * -f[1] + J[1][0] * f[0]) / det));
    }
    return { x, converged: false, iterations: maxIter, error: "Max iterations reached" };
  }
  function solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, TE, freezerPos, innerOpts = {}) {
    const {
      dx = 1e-4,
      tol = 1e-4,
      maxIter = 100,
      initialT2,
      initialPR,
      debug = false
    } = innerOpts;
    const { T0, TF, TR } = fixedTemps;
    const rho = RHO_AIR, cp = CP_AIR;
    const PIPEPITCH = {
      side: condenserConfig.sidePipePitch_mm,
      back: condenserConfig.backPipePitch_mm
    };
    const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0;
    const backCondenser = condenserConfig.backCondenser ?? "No";
    const refIndex = getRefrigerantIndex(refrigerant);
    let currentMR = fan.totalAirflow * 0.1;
    let currentMF = fan.totalAirflow * 0.9;
    const F = ([T2, PR]) => {
      const loads2 = calcHeatLoads(
        geom,
        { T0, TF, TR, T2, TC, PR, TE },
        electrical,
        PIPEPITCH,
        backCondenserEfficiency,
        fan.inputPower_W,
        freezerPos,
        backCondenser
      );
      const comp2 = evaluateCompressorSafely(TE, TC, refIndex, compParams);
      const F2 = loads2.QF + loads2.QR + loads2.QEV - comp2.QCompressor * PR;
      const denom = fan.totalAirflow * rho * cp * PR;
      let F1;
      if (Math.abs(denom) < 1e-12) {
        F1 = loads2.QF;
      } else {
        const T3 = T2 + loads2.QEV / denom;
        const MR = Math.min(fan.totalAirflow, Math.max(
          0,
          loads2.QR / (rho * cp * Math.max(0.01, TR - T3) * PR)
        ));
        const MF = fan.totalAirflow - MR;
        currentMR = MR;
        currentMF = MF;
        F1 = loads2.QF - MF * rho * cp * (TF - T3) * PR;
      }
      return [F1, F2];
    };
    let totalIter = 0;
    const T2_guess = initialT2 ?? -21.25;
    const PR_guess = initialPR ?? 0.59;
    let res = newton2(F, [T2_guess, PR_guess], dx, tol, maxIter, debug);
    totalIter += res.iterations;
    if (!res.converged) {
      for (const [t2, pr] of [[T2_guess, 0.4], [T2_guess - 2, 0.5], [-21, 0.3]]) {
        res = newton2(F, [t2, pr], dx, tol, maxIter, debug);
        totalIter += res.iterations;
        if (res.converged) break;
      }
    }
    if (!res.converged)
      return { T2: res.x[0], PR: res.x[1], converged: false, iterations: totalIter, error: res.error };
    const fT2 = res.x[0], fPR = res.x[1];
    const loads = calcHeatLoads(
      geom,
      { T0, TF, TR, T2: fT2, TC, PR: fPR, TE },
      electrical,
      PIPEPITCH,
      backCondenserEfficiency,
      fan.inputPower_W,
      freezerPos,
      backCondenser
    );
    const comp = evaluateCompressorSafely(TE, TC, refIndex, compParams);
    return {
      T2: fT2,
      PR: fPR,
      TE,
      converged: true,
      iterations: totalIter,
      heatLoads: loads,
      compressor: {
        etaV: comp.VolumetricEfficiency,
        coolingCapacity: comp.QCompressor,
        inputPower: comp.CompPower,
        massFlow: comp.massFlow,
        Pe: comp.Pe,
        Pc: comp.Pc
      },
      MR: currentMR,
      MF: currentMF
    };
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
      freezerPosition = "top",
      TC0 = 45,
      DH = 1e-3,
      tolOuter = 1e-3,
      maxIterOuter = 50,
      innerOptions = {}
    } = config;
    const T0 = fixedTemps.T0;
    const debug = innerOptions.debug ?? false;
    const TE = TE_override ?? config.initialTE ?? -25.27;
    const PIPEPITCH = {
      side: condenserConfig.sidePipePitch_mm,
      back: condenserConfig.backPipePitch_mm
    };
    const backCondenserEfficiency = condenserConfig.backCondenserEfficiency ?? 0.7;
    const refIndex = getRefrigerantIndex(refrigerant);
    const prop = getRefrigerantProperties(refIndex);
    let TC = TC0;
    let totalInner = 0;
    for (let iter = 0; iter < maxIterOuter; iter++) {
      if (debug) console.log(`
Outer ${iter}, TC=${TC.toFixed(2)}`);
      if (TC < T0) TC = T0 + 2;
      if (TC > 90) TC = 90;
      const inner = solveInner(
        TC,
        geom,
        compParams,
        refrigerant,
        subcool,
        fixedTemps,
        fan,
        electrical,
        condenserConfig,
        TE,
        freezerPosition,
        innerOptions
      );
      console.log("inner.compressor:", inner.compressor);
      if (!inner.converged)
        return { TC, T2: NaN, PR: NaN, converged: false, error: "Inner loop failed: " + inner.error };
      totalInner += inner.iterations;
      const QCout = calcQCout(
        geom,
        TC,
        T0,
        fixedTemps.TF,
        fixedTemps.TR,
        inner.PR,
        PIPEPITCH,
        freezerPosition,
        backCondenserEfficiency
      );
      const compOuter = evaluateCompressorSafely(TE, TC, refIndex, compParams);
      const Pc = prop.satPressure(TC + KELVIN_OFFSET2);
      const h_dis = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET2, Pc);
      const h_liq = prop.liquidEnthalpy(TC - subcool);
      const QCin = compOuter.massFlow * (h_dis - h_liq);
      const F3 = QCout.QCout - QCin;
      if (debug) console.log(
        `  T2=${inner.T2.toFixed(3)} PR=${inner.PR.toFixed(4)} F3=${F3.toFixed(3)}`
      );
      if (Math.abs(F3) < tolOuter) {
        return {
          TC,
          T2: inner.T2,
          PR: inner.PR,
          TE,
          Pe: inner.compressor.Pe,
          // added
          Pc: inner.compressor.Pc,
          // added
          converged: true,
          outerIterations: iter + 1,
          innerTotalIterations: totalInner,
          heatLoads: inner.heatLoads,
          compressor: {
            ...inner.compressor
          },
          MR: inner.MR,
          MF: inner.MF,
          fan,
          electrical
        };
      }
      const pertOpts = { ...innerOptions, initialT2: inner.T2, initialPR: inner.PR };
      let innerPert = solveInner(
        TC + DH,
        geom,
        compParams,
        refrigerant,
        subcool,
        fixedTemps,
        fan,
        electrical,
        condenserConfig,
        TE,
        freezerPosition,
        pertOpts
      );
      if (!innerPert.converged) {
        innerPert = solveInner(
          TC + DH,
          geom,
          compParams,
          refrigerant,
          subcool,
          fixedTemps,
          fan,
          electrical,
          condenserConfig,
          TE,
          freezerPosition,
          innerOptions
        );
      }
      if (!innerPert.converged)
        return { TC, T2: NaN, PR: NaN, converged: false, error: "Perturbation inner loop failed" };
      totalInner += innerPert.iterations;
      const QCout_pert = calcQCout(
        geom,
        TC + DH,
        T0,
        fixedTemps.TF,
        fixedTemps.TR,
        innerPert.PR,
        PIPEPITCH,
        freezerPosition,
        backCondenserEfficiency
      );
      const compOuter_pert = evaluateCompressorSafely(TE, TC + DH, refIndex, compParams);
      const Pc_pert = prop.satPressure(TC + DH + KELVIN_OFFSET2);
      const h_dis_pert = prop.gasEnthalpy(dischargeTemp + KELVIN_OFFSET2, Pc_pert);
      const h_liq_pert = prop.liquidEnthalpy(TC + DH - subcool);
      const QCin_pert = compOuter_pert.massFlow * (h_dis_pert - h_liq_pert);
      const F3_pert = QCout_pert.QCout - QCin_pert;
      const dF3dTC = (F3_pert - F3) / DH;
      if (Math.abs(dF3dTC) < 1e-9)
        return { TC, T2: NaN, PR: NaN, converged: false, error: "Zero derivative in outer loop" };
      const step = F3 / dF3dTC;
      const clampedStep = Math.max(-5, Math.min(5, step));
      TC -= clampedStep;
    }
    return { TC, T2: NaN, PR: NaN, converged: false, error: "Outer loop max iterations reached" };
  }
  function EnergyConsumption(result) {
    if (result.converged === false) {
      console.log("EnergyConsumption: converged === false, returning NaN");
      return NaN;
    }
    const PR = result.PR;
    const compressor = result.compressor || {};
    const fan = result.fan || {};
    const electrical = result.electrical || {};
    const pwbOn_W = electrical.pwbOn_W ?? 0;
    const pwbOff_W = electrical.pwboff_W ?? 0;
    const defrostOn_W = electrical.defrostOn_W ?? electrical.defrostHeater_W ?? 0;
    const defrostOn_min = electrical.defrostOn_min ?? 0;
    const fanPower = fan.inputPower_W ?? 0;
    const OnPower_W = (compressor.inputPower ?? 0) + fanPower + pwbOn_W;
    const energy_W = (OnPower_W * PR + pwbOff_W * (1 - PR)) * 24 / 1e3 + defrostOn_min * defrostOn_W * (24 / (10.5 / PR)) / 60 / 1e3;
    return {
      EnergyConsumption_W: energy_W,
      EnergyConsumption_kWhMonth: energy_W * 30
    };
  }

  // src/js/engine/thermo/defaultComponents.js
  var SJ54H_COMPONENTS = Object.freeze({
    compressor: {
      name: "EGX80CLC 100V 50Hz",
      rpm: 2900,
      rpm0: 2900,
      Vc: 11.14,
      // cc
      T_suction: 32.2,
      // °C – fixed suction temperature from Excel H11
      volEffCoeffs: {
        A: 0.9260142251566365,
        B: -0.01221312333322575,
        C: -0.0023789273042382304
      },
      kEtaV: { a: 1, b: 0, c: 0 },
      powerCoeffs: {
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
      totalAirflow_m3h: 59.5
    },
    electrical: {
      pwbOn_W: 2,
      pwbOff_W: 1,
      defrostHeater_W: 140,
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
    // Evaporator geometry (used by dynamic TE calculation)
    evapGeom: {
      evapWidth_mm: 460,
      // E26 (EV WIDTH)
      evapDepth_mm: 60,
      // E27 (EV DEPTH)
      evapArea_m2: 1.754
      // E33 (SURFACE OF EVAPORATOR)
    },
    initialTE: -25.7
  });
  var SJ_PV73K_COMPONENTS = Object.freeze({
    compressor: {
      name: "SQ47LAEG 220V 50Hz",
      rpm: 2220,
      rpm0: 2220,
      Vc: 10.17,
      T_suction: 32.2,
      // use compressorMap instead of polynomial coefficients
      useMap: true
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
      "electrical"
    ];
    for (const key of required) {
      if (config[key] === void 0) {
        errors.push(`Missing required config field: ${key}`);
      }
    }
    if (config.fixedTemps) {
      const { T0, TF, TR, TE } = config.fixedTemps;
      if ([T0, TF, TR, TE].some((v) => typeof v !== "number")) {
        errors.push("fixedTemps must contain numeric T0, TF, TR, TE.");
      }
    }
    if (config.fan) {
      if (!config.fan.totalAirflow) {
        errors.push("fan.totalAirflow is required.");
      }
      config.fan.density = config.fan.density ?? PHYSICAL_CONSTANTS.air.density;
      config.fan.cp = config.fan.cp ?? PHYSICAL_CONSTANTS.air.cp;
    }
    if (errors.length > 0) {
      return { success: false, errors, warnings, results: null };
    }
    const solverDefaults = {
      TC0: 54.4,
      DH: 1e-3,
      tolOuter: 5e-4,
      maxIterOuter: 100,
      innerOptions: { dx: 1e-3, tol: 1e-4, maxIter: 100 }
    };
    const solverOptions = { ...solverDefaults, ...config.solverOptions || {} };
    try {
      const result = solveThermalSystem({
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
        // new field
        initialTE: config.fixedTemps.TE,
        // solver needs initial TE
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
        // dynamic TE result
        heatLoads: {
          QF: result.heatLoads.QF,
          QR: result.heatLoads.QR,
          QEV: result.heatLoads.QEV,
          fanLoad: result.heatLoads.fanLoad,
          defrostLoad: result.heatLoads.defrostLoad
        },
        compressor: {
          massFlow: result.compressor.massFlow,
          coolingCapacity: result.compressor.coolingCapacity,
          inputPower: result.compressor.inputPower,
          etaV: result.compressor.etaV,
          Pe: result.compressor.Pe,
          // ← added
          Pc: result.compressor.Pc
          // ← added
        },
        fan: result.fan,
        electrical: result.electrical,
        iterations: {
          outer: result.outerIterations,
          innerTotal: result.innerTotalIterations
        }
      };
      if (result.PR >= 1) {
        warnings.push("Compressor running ratio reached 100% \u2014 system may be undersized.");
      } else if (result.PR <= 0.1) {
        warnings.push("Compressor running ratio very low \u2014 check heat load inputs.");
      }
      return { success: true, errors: [], warnings, results: output };
    } catch (err) {
      errors.push(`Unexpected error in thermal analysis: ${err.message}`);
      return { success: false, errors, warnings, results: null };
    }
  }
  function buildDefaultConfig(overrides = {}) {
    const { compressor: compRaw, condenser: condRaw, fan, electrical } = SJ54H_COMPONENTS;
    const compParams = {
      name: compRaw.name,
      cylinderVolumeCm3: compRaw.Vc,
      speedRpm: compRaw.rpm,
      rpm0: compRaw.rpm0,
      T_suction: compRaw.T_suction,
      wCoeffs: [
        compRaw.powerCoeffs.AW,
        compRaw.powerCoeffs.BW,
        compRaw.powerCoeffs.CW,
        compRaw.powerCoeffs.DW,
        compRaw.powerCoeffs.EW
      ],
      etaCoeffs: [
        compRaw.volEffCoeffs.A,
        compRaw.volEffCoeffs.B,
        compRaw.volEffCoeffs.C
      ]
    };
    const base = {
      geom: toThermalFormat(DEFAULT_CABINET),
      compParams,
      condenserConfig: {
        sidePipePitch_mm: condRaw.sidePipePitch_mm,
        backPipePitch_mm: condRaw.backPipePitch_mm,
        backCondenserEfficiency: condRaw.backCondenserEfficiency,
        backCondenser: "Yes"
        // SJ‑540 has a back condenser
      },
      refrigerant: "R-600a",
      subcool: SJ54H_COMPONENTS.subcool_K,
      dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
      fixedTemps: {
        T0: 30,
        TF: -18,
        TR: 3,
        TE: -23.3
        // initial guess (will be updated by dynamic loop if used)
      },
      fan: {
        totalAirflow: fan.totalAirflow_m3h,
        inputPower_W: fan.inputPower_W
      },
      electrical: { ...electrical },
      freezerPosition: "top",
      // SJ‑540 is top‑freezer
      initialTE: -25.27,
      // better starting point for TE iterations
      solverOptions: {
        TC0: 54.4,
        DH: 1e-3,
        tolOuter: 5e-4,
        maxIterOuter: 100,
        innerOptions: {
          dx: 1e-3,
          tol: 1e-4,
          maxIter: 100,
          initialT2: -21.25,
          initialPR: 0.59
        }
      }
    };
    return deepMerge(base, overrides);
  }
  function deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        out[key] = deepMerge(out[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }

  // src/js/compressorManager.js
  var DEFAULT_COMPRESSORS = [
    {
      id: "EGX80CLC",
      name: "EGX80CLC 100V 50Hz",
      model: "EGX80CLC",
      voltage: 100,
      frequency: 50,
      cylinderVolumeCm3: SJ54H_COMPONENTS.compressor.cylinderVolumeCm3,
      // e.g. 10.17
      speedRpm: SJ54H_COMPONENTS.compressor.speedRpm,
      // e.g. 2220
      wCoeffs: SJ54H_COMPONENTS.compressor.wCoeffs,
      etaCoeffs: SJ54H_COMPONENTS.compressor.etaCoeffs
    }
  ];
  var compressorList = [];
  var selectedCompressorId = "EGX80CLC";
  function loadCompressors() {
    const saved = localStorage.getItem("compressorList");
    if (saved) {
      compressorList = JSON.parse(saved);
    } else {
      compressorList = [...DEFAULT_COMPRESSORS];
    }
    selectedCompressorId = localStorage.getItem("selectedCompressorId") || "EGX80CLC";
  }
  function saveCompressors() {
    localStorage.setItem("compressorList", JSON.stringify(compressorList));
    localStorage.setItem("selectedCompressorId", selectedCompressorId);
  }
  function getCompressorList2() {
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
    compressorList.push(comp);
    saveCompressors();
  }
  function deleteCompressor(id) {
    compressorList = compressorList.filter((c) => c.id !== id);
    if (selectedCompressorId === id) selectedCompressorId = compressorList[0]?.id || "";
    saveCompressors();
  }
  loadCompressors();

  // src/js/ui/thermoUI.js
  var thermalAdvanced = {
    subcool: SJ54H_COMPONENTS.subcool_K,
    dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
    fanInputPower: SJ54H_COMPONENTS.fan.inputPower_W,
    defHeater: SJ54H_COMPONENTS.electrical.defrostHeater_W,
    defOnMin: SJ54H_COMPONENTS.electrical.defrostOn_min
  };
  var getGeometryFn = null;
  function initThermoUI(getGeometry) {
    getGeometryFn = getGeometry;
    const panel = document.getElementById("panelThermal");
    if (!panel) return;
    panel.innerHTML = `
    <button id="thermoRunBtn">Run Thermal Analysis</button>
    <div id="thermoErrors"></div>   <!-- keep errors in the left panel -->
    <fieldset>
      <legend>Design Inputs</legend>
      <label>Ambient T0 (\xB0C): <input type="number" id="thermoT0" value="30" step="any"></label>
      <label>Freezer TF (\xB0C): <input type="number" id="thermoTF" value="-18" step="any"></label>
      <label>Refrigerator TR (\xB0C): <input type="number" id="thermoTR" value="3" step="any"></label>
      <label>Refrigerant:
        <select id="thermoRefrigerant">
          <option value="R-600a">R-600a</option>
          <option value="R-134a">R-134a</option>
        </select>
      </label>
      <label>Fan airflow (m\xB3/h): <input type="number" id="thermoFanFlow" step="any"></label>
      <button id="thermoAdvancedBtn" type="button">\u2699\uFE0F Advanced</button>
    </fieldset>
  `;
    document.getElementById("thermoFanFlow").value = SJ54H_COMPONENTS.fan.totalAirflow_m3h;
    const saved = localStorage.getItem("thermoAdvanced");
    if (saved) thermalAdvanced = { ...thermalAdvanced, ...JSON.parse(saved) };
    document.getElementById("thermoAdvancedBtn").addEventListener("click", openThermalSettings);
    document.getElementById("thermoRunBtn").addEventListener("click", handleRun);
  }
  function openThermalSettings() {
    const modal = document.getElementById("thermalSettingsModal");
    if (!modal) return;
    loadCompressors();
    const compressors = getCompressorList2();
    const currentComp = getCurrentCompressor();
    const cond = settings.condenser || { sidePipePitch_mm: 50, backPipePitch_mm: 50 };
    modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn" id="closeThermalSettings">&times;</span>
      <h2>Thermal Design Parameters</h2>

      <fieldset>
        <legend>Condenser</legend>
        <label>Side pipe pitch (mm):
          <input type="number" id="thermoCondSidePitch" value="${cond.sidePipePitch_mm}" step="any">
        </label>
        <label>Back pipe pitch (mm):
          <input type="number" id="thermoCondBackPitch" value="${cond.backPipePitch_mm}" step="any">
        </label>
      </fieldset>

      <fieldset>
        <legend>Evaporator</legend>
        <p><i>Evaporator parameters \u2013 TBD</i></p>
      </fieldset>

      <fieldset>
        <legend>Compressor</legend>
        <label>Current Compressor:
          <select id="thermoCompressorSelect">
            ${compressors.map((c) => `<option value="${c.id}" ${c.id === currentComp.id ? "selected" : ""}>${c.name}</option>`).join("")}
          </select>
        </label>
        <button id="thermoAddCompressorBtn" type="button">Add Compressor</button>
        <button id="thermoDeleteCompressorBtn" type="button">Delete Selected</button>
        <div id="thermoCompressorList"></div>  <!-- can be used for detailed info later -->
      </fieldset>

      <fieldset>
        <legend>Subcool &amp; Discharge</legend>
        <label>Subcool (K):
          <input type="number" id="thermoSubcool" value="${thermalAdvanced.subcool}" step="any">
        </label>
        <label>Discharge temp (\xB0C):
          <input type="number" id="thermoDiscTemp" value="${thermalAdvanced.dischargeTemp}" step="any">
        </label>
      </fieldset>

      <fieldset>
        <legend>Fan</legend>
        <label>Input power (W):
          <input type="number" id="thermoFanInputPower" value="${thermalAdvanced.fanInputPower}" step="any" min="0">
        </label>
      </fieldset>

      <fieldset>
        <legend>Defrost</legend>
        <label>Heater (W):
          <input type="number" id="thermoDefHeater" value="${thermalAdvanced.defHeater}" step="any">
        </label>
        <label>On time (min/24h):
          <input type="number" id="thermoDefOn" value="${thermalAdvanced.defOnMin}" step="any">
        </label>
      </fieldset>

      <div class="settings-actions">
        <button id="saveThermalSettings">Save &amp; Close</button>
      </div>
    </div>
  `;
    modal.classList.remove("hidden");
    document.getElementById("closeThermalSettings").onclick = () => modal.classList.add("hidden");
    document.getElementById("thermoAddCompressorBtn").onclick = () => {
      openAddCompressorModal();
    };
    document.getElementById("thermoDeleteCompressorBtn").onclick = () => {
      const sel = document.getElementById("thermoCompressorSelect");
      if (confirm("Delete the selected compressor?")) {
        deleteCompressor(sel.value);
        openThermalSettings();
      }
    };
    document.getElementById("thermoCompressorSelect").onchange = (e) => {
      setSelectedCompressor(e.target.value);
    };
    document.getElementById("saveThermalSettings").onclick = () => {
      const sidePitch = parseFloat(document.getElementById("thermoCondSidePitch").value) || 50;
      const backPitch = parseFloat(document.getElementById("thermoCondBackPitch").value) || 50;
      settings.condenser = {
        sidePipePitch_mm: sidePitch,
        backPipePitch_mm: backPitch
      };
      updateSettings(settings);
      thermalAdvanced.subcool = parseFloat(document.getElementById("thermoSubcool").value) || SJ54H_COMPONENTS.subcool_K;
      thermalAdvanced.dischargeTemp = parseFloat(document.getElementById("thermoDiscTemp").value) || SJ54H_COMPONENTS.dischargeTemp_C;
      thermalAdvanced.fanInputPower = parseFloat(document.getElementById("thermoFanInputPower").value) || SJ54H_COMPONENTS.fan.inputPower_W;
      thermalAdvanced.defHeater = parseFloat(document.getElementById("thermoDefHeater").value) || SJ54H_COMPONENTS.electrical.defrostHeater_W;
      thermalAdvanced.defOnMin = parseFloat(document.getElementById("thermoDefOn").value) || SJ54H_COMPONENTS.electrical.defrostOn_min;
      localStorage.setItem("thermoAdvanced", JSON.stringify(thermalAdvanced));
      const compSelect = document.getElementById("thermoCompressorSelect");
      if (compSelect) setSelectedCompressor(compSelect.value);
      modal.classList.add("hidden");
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
    if (cabinetGeom._compartments && cabinetGeom._compartments.length > 1 && cabinetGeom._compartments[0].type !== "freezer") {
      showError("Thermal analysis currently supports only freezer-top configurations.");
      return;
    }
    const geom = toThermalFormat(cabinetGeom);
    const T0 = parseFloat(document.getElementById("thermoT0")?.value);
    const TF = parseFloat(document.getElementById("thermoTF")?.value);
    const TR = parseFloat(document.getElementById("thermoTR")?.value);
    if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
      showError("Please fill all temperatures.");
      return;
    }
    const refrigerant = document.getElementById("thermoRefrigerant")?.value || "R-600a";
    const fanFlow = parseFloat(document.getElementById("thermoFanFlow")?.value) || SJ54H_COMPONENTS.fan.totalAirflow_m3h;
    loadCompressors();
    const compressor = getCurrentCompressor();
    const config = buildDefaultConfig({
      geom,
      freezerPosition: cabinetGeom._compartments?.[0]?.type === "freezer" ? "top" : "bottom",
      refrigerant,
      subcool: thermalAdvanced.subcool,
      dischargeTemp: thermalAdvanced.dischargeTemp,
      fixedTemps: {
        T0,
        TF,
        TR,
        TE: SJ54H_COMPONENTS.initialTE
      },
      fan: {
        totalAirflow: fanFlow,
        inputPower_W: thermalAdvanced.fanInputPower
      },
      electrical: {
        defrostHeater_W: thermalAdvanced.defHeater,
        defrostOn_min: thermalAdvanced.defOnMin
      },
      compressor
    });
    if (compressor) {
      config.compParams = {
        name: compressor.name,
        cylinderVolumeCm3: compressor.cylinderVolumeCm3,
        speedRpm: compressor.speedRpm,
        wCoeffs: compressor.wCoeffs,
        etaCoeffs: compressor.etaCoeffs
      };
    }
    const result = runThermoAnalysis(config);
    console.log("results.compressor keys:", Object.keys(result.results.compressor));
    console.log("results.compressor.Pe:", result.results.compressor.Pe);
    console.log("results.compressor.Pc:", result.results.compressor.Pc);
    console.log("Full solver result:", JSON.parse(JSON.stringify(result)));
    if (!result.success) {
      showError(result.errors.join("; "));
      return;
    }
    let energy = null;
    3;
    console.log("results.converged:", result.results?.converged);
    console.log("results.fan:", result.results?.fan);
    console.log("results.electrical:", result.results?.electrical);
    if (result.results && result.results.converged) {
      try {
        energy = EnergyConsumption(result.results);
      } catch (e) {
        console.warn("EnergyConsumption calculation failed:", e);
      }
    }
    if (result.results && result.results.converged !== false) {
      try {
        energy = EnergyConsumption(result.results);
        console.log("Energy result:", energy);
      } catch (e) {
        console.error("EnergyConsumption threw:", e);
      }
    }
    displayResults(result.results, energy);
    if (result.warnings.length) showWarnings(result.warnings);
  }
  function openAddCompressorModal() {
    const modal = document.getElementById("addCompressorModal");
    if (!modal) return;
    const defaultComp = {
      name: "EGX80CLC",
      cylinderVolumeCm3: 10.17,
      speedRpm: 2220
    };
    const defaultTE = [-34.4, -23.3, -12.2];
    const defaultTC = [37.8, 46.1, 54.4];
    const Q_matrix = [
      [70.554507, 67.112824, 61.950299],
      [129.063122, 126.48186, 121.319335],
      [215.105204, 210.8031, 203.919733]
    ];
    const W_matrix = [
      [49.7, 51.3, 72],
      [67.6, 72.4, 141],
      [86.2, 93.5, 237]
    ];
    const headerCells = defaultTC.map((tc, j) => `
    <th style="text-align:center;">TC<br><input id="tc_${j}" type="number" step="any" value="${tc}" style="width:70px;"></th>
  `).join("");
    const bodyRows = defaultTE.map((te, i) => `
    <tr>
      <th style="text-align:center;">TE<br><input id="te_${i}" type="number" step="any" value="${te}" style="width:70px;"></th>
      ${defaultTC.map((tc, j) => `
        <td>
          Q: <input id="q_${i}_${j}" type="number" step="any" value="${Q_matrix[i][j]}" style="width:80px;"><br>
          W: <input id="w_${i}_${j}" type="number" step="any" value="${W_matrix[i][j]}" style="width:80px;">
        </td>
      `).join("")}
    </tr>
  `).join("");
    document.getElementById("addCompressorContent").innerHTML = `
    <style>
      .matrix-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      .matrix-table th, .matrix-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
      .matrix-table input { width: 80px; }
      .error-msg { color: #d32f2f; font-weight: bold; margin-top: 10px; }
    </style>

    <fieldset>
      <legend>Basic Data</legend>
      <label>Name: <input id="acName" type="text" value="${defaultComp.name}"></label>
      <label>Cyl. Volume (cm\xB3): <input id="acCyl" type="number" step="any" value="${defaultComp.cylinderVolumeCm3}"></label>
      <label>Speed (rpm): <input id="acRpm" type="number" step="any" value="${defaultComp.speedRpm}"></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1">R-134a</option>
          <option value="2" selected>R-600a</option>
        </select>
      </label>
    </fieldset>

    <fieldset>
      <legend>Test Data (edit TE / TC and fill Q & W)</legend>
      <table class="matrix-table">
        <thead>
          <tr>
            <th></th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
      <p><small>Pre\u2011filled with example data. Change TE and TC values as needed. At least 5 data points required.</small></p>
    </fieldset>

    <div id="acError" class="error-msg"></div>
    <div class="settings-actions">
      <button id="fitCompressorBtn">Fit & Add</button>
      <button id="cancelAddCompressor">Cancel</button>
    </div>
  `;
    modal.classList.remove("hidden");
    document.getElementById("cancelAddCompressor").onclick = () => {
      modal.classList.add("hidden");
    };
    document.getElementById("fitCompressorBtn").onclick = () => {
      const errorDiv = document.getElementById("acError");
      errorDiv.textContent = "";
      const name = document.getElementById("acName").value.trim();
      const cyl = parseFloat(document.getElementById("acCyl").value);
      const rpm = parseFloat(document.getElementById("acRpm").value);
      const refIdx = parseInt(document.getElementById("acRef").value);
      if (!name) {
        errorDiv.textContent = "Name is required.";
        return;
      }
      if (isNaN(cyl) || cyl <= 0) {
        errorDiv.textContent = "Invalid cylinder volume.";
        return;
      }
      if (isNaN(rpm) || rpm <= 0) {
        errorDiv.textContent = "Invalid speed.";
        return;
      }
      const TE_vals = [];
      const TC_vals = [];
      for (let i = 0; i < 3; i++) {
        const te = parseFloat(document.getElementById(`te_${i}`).value);
        if (isNaN(te)) {
          errorDiv.textContent = `Invalid TE value in row ${i + 1}.`;
          return;
        }
        TE_vals.push(te);
      }
      for (let j = 0; j < 3; j++) {
        const tc = parseFloat(document.getElementById(`tc_${j}`).value);
        if (isNaN(tc)) {
          errorDiv.textContent = `Invalid TC value in column ${j + 1}.`;
          return;
        }
        TC_vals.push(tc);
      }
      const dataPoints = [];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const q = parseFloat(document.getElementById(`q_${i}_${j}`).value);
          const w = parseFloat(document.getElementById(`w_${i}_${j}`).value);
          if (!isNaN(q) && !isNaN(w)) {
            dataPoints.push({ TE: TE_vals[i], TC: TC_vals[j], Q: q, W: w });
          }
        }
      }
      if (dataPoints.length < 5) {
        errorDiv.textContent = `At least 5 data points required. Only ${dataPoints.length} provided.`;
        return;
      }
      try {
        const { etaCoeffs, wCoeffs } = computeCompressorCoefficients({
          cylinderVolumeCm3: cyl,
          speedRpm: rpm,
          refrigerantIndex: refIdx,
          dataPoints
        });
        addCompressor({
          id: name.replace(/\s/g, ""),
          name,
          model: name,
          voltage: 100,
          frequency: 50,
          cylinderVolumeCm3: cyl,
          speedRpm: rpm,
          wCoeffs,
          etaCoeffs
        });
        modal.classList.add("hidden");
        openThermalSettings();
      } catch (err) {
        errorDiv.textContent = err.message;
      }
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    };
  }
  function displayResults(res, energy) {
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
    const comp = res.compressor || {};
    const pe = (comp.Pe !== void 0 ? comp.Pe : res.Pe)?.toFixed(4) ?? "\u2014";
    const pc = (comp.Pc !== void 0 ? comp.Pc : res.Pc)?.toFixed(4) ?? "\u2014";
    const etaV = comp.etaV !== void 0 ? fmtP(comp.etaV) : "\u2014";
    const qComp = comp.coolingCapacity !== void 0 ? fmt(comp.coolingCapacity) : "\u2014";
    const pComp = comp.inputPower !== void 0 ? fmt(comp.inputPower) : "\u2014";
    const mFlow = comp.massFlow !== void 0 ? fmt(comp.massFlow, 4) : "\u2014";
    const eW = energy ? fmt(energy.EnergyConsumption_W, 3) : "\u2014";
    const eKWh = energy ? fmt(energy.EnergyConsumption_kWhMonth, 3) : "\u2014";
    const html = `
    <table class="thermo-results-table">
      <thead>
        <tr><th colspan="2">Thermal Analysis Results</th></tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="2">Operating Points</td></tr>
        <tr><td>Condensing temp TC</td><td>${fmt(res.TC)} \xB0C</td></tr>
        <tr><td>Evaporating temp TE</td><td>${fmt(res.TE)} \xB0C</td></tr>
        <tr><td>Evap. outlet T2</td><td>${fmt(res.T2)} \xB0C</td></tr>
        <tr><td>Running ratio PR</td><td>${fmtP(res.PR)}</td></tr>

        <tr class="section-header"><td colspan="2">Compressor Details</td></tr>
        <tr><td>Evap. pressure Pe</td><td>${pe} bar</td></tr>
        <tr><td>Cond. pressure Pc</td><td>${pc} bar</td></tr>
        <tr><td>Vol. efficiency \u03B7<sub>v</sub></td><td>${etaV}</td></tr>
        <tr><td>Cooling capacity</td><td>${qComp} kcal/h</td></tr>
        <tr><td>Input power</td><td>${pComp} W</td></tr>
        <tr><td>Mass flow</td><td>${mFlow} kg/h</td></tr>

        <tr class="section-header"><td colspan="2">Energy Consumption</td></tr>
        <tr><td>Daily energy</td><td>${eW} kWh</td></tr>
        <tr><td>Monthly energy</td><td>${eKWh} kWh</td></tr>

        <tr class="section-header"><td colspan="2">Heat Loads (kcal/h)</td></tr>
        <tr><td>QF \u2014 Freezer compartment</td><td>${fmt(res.heatLoads.QF)}</td></tr>
        <tr><td>QR \u2014 Refrigerator compartment</td><td>${fmt(res.heatLoads.QR)}</td></tr>
        <tr><td>QEV \u2014 Evaporator total</td><td>${fmt(res.heatLoads.QEV)}</td></tr>
        <tr><td>Fan load</td><td>${fmt(res.heatLoads.fanLoad)}</td></tr>
        <tr><td>Defrost load</td><td>${fmt(res.heatLoads.defrostLoad)}</td></tr>

        <tr class="section-header"><td colspan="2">Solver</td></tr>
        <tr><td>Outer iterations</td><td>${res.outerIterations ?? res.iterations?.outer ?? "\u2014"}</td></tr>
        <tr><td>Inner iterations (total)</td><td>${res.innerTotalIterations ?? res.iterations?.innerTotal ?? "\u2014"}</td></tr>
      </tbody>
    </table>
  `;
    resultsDiv.innerHTML = html;
  }
  function clearMessages() {
    const thermoRight = document.getElementById("thermoRightPanel");
    const thermoErrors = document.getElementById("thermoErrors");
    if (thermoRight) thermoRight.innerHTML = "";
    if (thermoErrors) thermoErrors.innerHTML = "";
  }
  function showError(msg) {
    const e = document.getElementById("thermoErrors");
    if (e) e.innerHTML = `<p class="error">\u274C ${msg}</p>`;
  }
  function showWarnings(warnings) {
    const e = document.getElementById("thermoErrors");
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

  // src/js/main.js
  updateSettings(settings);
  var divHorizInput = document.getElementById("divHoriz");
  var usableFactorInput = document.getElementById("usableFactor");
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
        ratio: i === 0 ? 0.4 : 0.6
      });
    }
    syncConstraints();
    buildCompartmentUI();
  }
  function syncConstraints() {
    const count = compartmentsData.length;
    const H = parseFloat(document.getElementById("geom-H")?.value) || 1680;
    const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
    const totalInsulTop = compartmentsData[0].top;
    const totalInsulBottom = parseFloat(document.getElementById("geom-bottom3")?.value) || 40;
    let internalH = H - totalInsulTop - totalInsulBottom - (count - 1) * dividerThick;
    if (internalH < 0) internalH = 0;
    if (internalH === 0) {
      compartmentsData[0].height = 0;
      compartmentsData[1].height = 0;
      compartmentsData[0].ratio = 0.5;
      compartmentsData[1].ratio = 0.5;
      return;
    }
    if (count === 1) {
      compartmentsData[0].height = internalH;
      compartmentsData[0].ratio = 1;
      return;
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
  }
  function onCompFieldChange(compIdx, field, value) {
    if (isNaN(value)) return;
    compartmentsData[compIdx][field] = value;
    if (field === "height" || field === "ratio") {
      const count = compartmentsData.length;
      const H = parseFloat(document.getElementById("geom-H")?.value) || 1680;
      const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
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
    if (settings.autoCalculate) {
      calculateBtn.click();
    }
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
      <fieldset>
        <legend>Wall Thicknesses (mm)</legend>
        <label>Top:    <input type="number" id="comp-${i}-top"    value="${d.top}"    step="any"></label>
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
        document.getElementById(`comp-${i}-${face}`).addEventListener("input", (e) => {
          compartmentsData[i][face] = parseFloat(e.target.value) || 0;
          syncConstraints();
          syncDisplay();
          markDirty();
        });
      }
    }
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
  }
  function readGeometryFromPanel() {
    const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
    const comps = compartmentsData;
    const count = comps.length;
    const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
    let freezerComp = comps.find((c) => c.type === "freezer");
    let freshComp = comps.find((c) => c.type === "fresh");
    const defWalls = { top: 60, left: 60, right: 60, rear: 60, door: 60 };
    const walls = {
      freezer: {
        top: freezerComp ? freezerComp.top : defWalls.top,
        bottom: freshComp ? dividerThick : 0,
        left: freezerComp ? freezerComp.left : defWalls.left,
        right: freezerComp ? freezerComp.right : defWalls.right,
        door: freezerComp ? freezerComp.door : defWalls.door,
        rear: freezerComp ? freezerComp.rear : defWalls.rear
      },
      refrigerator: {
        top: freshComp ? freezerComp ? dividerThick : freshComp.top : defWalls.top,
        bottom1: g("geom-bottom1") ?? 40,
        bottom2: g("geom-bottom2") ?? 40,
        bottom3: g("geom-bottom3") ?? 40,
        left: freshComp ? freshComp.left : defWalls.left,
        right: freshComp ? freshComp.right : defWalls.right,
        door: freshComp ? freshComp.door : defWalls.door,
        rear: freshComp ? freshComp.rear : defWalls.rear
      }
    };
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
      Hf: freezerComp ? freezerComp.height : 0,
      Hr: freshComp ? freshComp.height : 0,
      walls,
      _compartments: comps
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
  function buildConfigFromForm() {
    currentGeometry = readGeometryFromPanel();
    const volumeGeom = toVolumeFormat(currentGeometry);
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
            shelves: [],
            drawers: [],
            doorBins: [],
            iceMakerHousing: { volume: null },
            lightHousing: { volume: null }
          }
        }
      });
    }
    const rootNode = {
      nodeType: "horizontal",
      id: "root",
      children: leaves.map((l) => ({ heightMode: l.heightMode, heightValue: l.heightValue, node: l.node })),
      dividers: count > 1 ? [{ afterChildIndex: 0, thickness: parseFloat(divHorizInput.value) || 20 }] : []
    };
    const cabinet = {
      geometry: currentGeometry,
      layout: rootNode
    };
    return {
      config: {
        schemaVersion: "2.0",
        meta: { name: "UI Config", createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
        cabinet
      },
      layout: rootNode
    };
  }
  function showMessages(errors, warnings, calcErrors) {
    messagesDiv.innerHTML = "";
    const all = [
      ...errors.map((e) => `<p class="error">\u274C ${e.message}</p>`),
      ...warnings.map((w) => `<p class="warning">\u26A0\uFE0F ${w.message}</p>`),
      ...calcErrors.map((e) => `<p class="error">\u{1F527} ${e.message}</p>`)
    ];
    if (all.length) {
      messagesDiv.innerHTML = all.join("");
      messagesFieldset.style.display = "block";
    } else {
      messagesFieldset.style.display = "none";
    }
  }
  function computeAccurateBottomVolume(geom, eff) {
    const { H, D, Hb, Db1, Db2, walls } = geom;
    const rearX = eff.rear;
    const doorX = D - eff.door;
    const innerTop = eff.top;
    const topCompH = compartmentsData.length > 1 ? compartmentsData[0].height : 0;
    const divider = compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
    const yTopBottom = innerTop + topCompH + divider;
    const yBottomRear = H - Hb - walls.refrigerator.bottom1;
    const yBottomDoor = H - walls.refrigerator.bottom3;
    const slopeStartX = rearX + Db1;
    const slopeEndX = rearX + Db2;
    const points = [
      [rearX, yTopBottom],
      [doorX, yTopBottom],
      [doorX, yBottomDoor],
      [slopeEndX, yBottomDoor],
      [slopeStartX, yBottomRear],
      [rearX, yBottomRear]
    ];
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;
    const width = geom.W - eff.left - eff.right;
    return area * width * settings.mm3ToL;
  }
  calculateBtn.addEventListener("click", () => {
    const { config, layout } = buildConfigFromForm();
    currentConfig = config;
    if (currentConfig) {
      storeSlotABtn.style.display = "inline-block";
      storeSlotBBtn.style.display = "inline-block";
      compareSlotsBtn.style.display = configSlotA || configSlotB ? "inline-block" : "none";
    }
    const result = runCalculation(config);
    if (result.leaves && result.totals) {
      const eff = getEffectiveThicknesses();
      const bottomIdx = result.leaves.length - 1;
      const bottomCompHeight = compartmentsData[bottomIdx].height;
      const accurateBottomVol = computeAccurateBottomVolume(currentGeometry, eff);
      const bottomLeaf = result.leaves[bottomIdx];
      const oldBottomVol = bottomLeaf.gross;
      bottomLeaf.gross = accurateBottomVol;
      result.totals.gross = result.totals.gross - oldBottomVol + accurateBottomVol;
      const disp = formatTotalsDisplay({ gross: result.totals.gross });
      document.getElementById("grossVol").textContent = disp.gross;
      document.getElementById("grossVolCuft").textContent = disp.grossCuft;
      const usableFactor = parseFloat(usableFactorInput?.value) || 97;
      const usableL = result.totals.gross * (usableFactor / 100);
      const usableCuft = usableL * settings.lToCuft;
      document.getElementById("usableVol").textContent = roundForDisplay(usableL, "L");
      document.getElementById("usableVolCuft").textContent = roundForDisplay(usableCuft, "cuft");
    }
    showMessages(result.validationErrors, result.warnings, result.calcErrors);
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (frontCanvas && sideCanvas) {
      const rightPanel = document.querySelector(".right-panel");
      const panelHeight = rightPanel.clientHeight - 30;
      const panelWidth = rightPanel.clientWidth - 20;
      frontCanvas.height = panelHeight;
      sideCanvas.height = panelHeight;
      frontCanvas.width = panelWidth / 2 - 5;
      sideCanvas.width = panelWidth / 2 - 5;
      const effectiveWalls = getEffectiveThicknesses();
      const fittings = extractFittingsFromLayout(layout);
      const drawOptions = {
        dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
        compHeights: compartmentsData.map((c) => c.height),
        doorGap: parseFloat(document.getElementById("geom-doorGap")?.value) || 10,
        compartments: compartmentsData.map((c) => ({
          left: c.left,
          right: c.right,
          rear: c.rear
        })),
        fittings
        // <-- pass to schematic
      };
      drawFrontView(frontCanvas, currentGeometry, effectiveWalls, layout, result.leaves, drawOptions);
      drawSideView(sideCanvas, currentGeometry, effectiveWalls, drawOptions);
      dirtySchematic = false;
      schematicOverlay.classList.add("hidden");
    }
  });
  function extractFittingsFromLayout(node) {
    const fittings = [];
    function walk(n) {
      if (n.nodeType === "leaf" && n.fittings) {
        fittings.push({
          leafId: n.id,
          type: n.type,
          shelves: n.fittings.shelves || [],
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
        compartmentsData = savedComps.map((c) => ({ ...c }));
        const layout = config.cabinet.layout;
        if (layout?.nodeType === "horizontal" && layout.dividers?.length > 0) {
          divHorizInput.value = layout.dividers[0].thickness ?? 20;
        }
      } else {
        initCompartments();
      }
      currentGeometry = { ...geometry };
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
    buildCompartmentUI();
    syncConstraints();
    syncDisplay();
  }
  saveBtn.addEventListener("click", () => {
    if (!currentConfig) {
      alert("Calculate first");
      return;
    }
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
        const result = runCalculation(config);
        if (result.leaves && result.totals) {
          const eff = getEffectiveThicknesses();
          const bottomIdx = result.leaves.length - 1;
          const bottomCompHeight = compartmentsData[bottomIdx].height;
          const accurateBottomVol = computeAccurateBottomVolume(currentGeometry, eff);
          const bottomLeaf = result.leaves[bottomIdx];
          const oldBottomVol = bottomLeaf.gross;
          bottomLeaf.gross = accurateBottomVol;
          result.totals.gross = result.totals.gross - oldBottomVol + accurateBottomVol;
          const disp = formatTotalsDisplay({ gross: result.totals.gross });
          document.getElementById("grossVol").textContent = disp.gross;
          document.getElementById("grossVolCuft").textContent = disp.grossCuft;
          const usableFactor = parseFloat(usableFactorInput?.value) || 97;
          const usableL = result.totals.gross * (usableFactor / 100);
          const usableCuft = usableL * settings.lToCuft;
          document.getElementById("usableVol").textContent = roundForDisplay(usableL, "L");
          document.getElementById("usableVolCuft").textContent = roundForDisplay(usableCuft, "cuft");
        }
        showMessages(result.validationErrors, result.warnings, result.calcErrors);
        const frontCanvas = document.getElementById("schematicFront");
        const sideCanvas = document.getElementById("schematicSide");
        if (frontCanvas && sideCanvas && result.leaves) {
          const rightPanel = document.querySelector(".right-panel");
          const panelHeight = rightPanel.clientHeight - 30;
          const panelWidth = rightPanel.clientWidth - 20;
          frontCanvas.height = panelHeight;
          sideCanvas.height = panelHeight;
          frontCanvas.width = panelWidth / 2 - 5;
          sideCanvas.width = panelWidth / 2 - 5;
          const effectiveWalls = getEffectiveThicknesses();
          const fittings = extractFittingsFromLayout(config.cabinet.layout);
          const drawOptions = {
            dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
            compHeights: compartmentsData.map((c) => c.height),
            doorGap: parseFloat(document.getElementById("geom-doorGap")?.value) || 10,
            compartments: compartmentsData.map((c) => ({
              left: c.left,
              right: c.right,
              rear: c.rear
            })),
            fittings
            // <-- correct placement at top level
          };
          drawFrontView(frontCanvas, currentGeometry, effectiveWalls, config.cabinet.layout, result.leaves, drawOptions);
          drawSideView(sideCanvas, currentGeometry, effectiveWalls, drawOptions);
          dirtySchematic = false;
          schematicOverlay.classList.add("hidden");
        }
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
    const result = runCalculation(currentConfig);
    downloadResultsCSV(result, currentConfig.meta.name);
  });
  initSettingsModal();
  resetAllBtn.addEventListener("click", () => {
    if (!confirm("Reset all fields to default values and clear results?")) return;
    currentGeometry = { ...DEFAULT_CABINET };
    document.getElementById("geom-H").value = DEFAULT_CABINET.H;
    document.getElementById("geom-W").value = DEFAULT_CABINET.W;
    document.getElementById("geom-D").value = DEFAULT_CABINET.D;
    document.getElementById("geom-Hb").value = DEFAULT_CABINET.Hb;
    document.getElementById("geom-Db1").value = DEFAULT_CABINET.Db1;
    document.getElementById("geom-Db2").value = DEFAULT_CABINET.Db2;
    document.getElementById("geom-packingPos").value = DEFAULT_CABINET.packingPos;
    document.getElementById("geom-doorGap").value = DEFAULT_CABINET.doorGap;
    document.getElementById("geom-bottom1").value = 40;
    document.getElementById("geom-bottom2").value = 40;
    document.getElementById("geom-bottom3").value = 40;
    divHorizInput.value = 20;
    numCompartmentsInput.value = 2;
    initCompartments();
    document.getElementById("grossVol").textContent = "--";
    document.getElementById("grossVolCuft").textContent = "--";
    document.getElementById("usableVol").textContent = "--";
    document.getElementById("usableVolCuft").textContent = "--";
    messagesDiv.innerHTML = "";
    messagesFieldset.style.display = "none";
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (frontCanvas) frontCanvas.getContext("2d").clearRect(0, 0, frontCanvas.width, frontCanvas.height);
    if (sideCanvas) sideCanvas.getContext("2d").clearRect(0, 0, sideCanvas.width, sideCanvas.height);
    schematicOverlay.classList.add("hidden");
    dirtySchematic = false;
    currentConfig = null;
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
    if (configSlotA) resultA = runCalculation(configSlotA);
    if (configSlotB) resultB = runCalculation(configSlotB);
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
    const hasLeavesA = resultA && resultA.leaves && resultA.totals;
    const hasLeavesB = resultB && resultB.leaves && resultB.totals;
    const fmtTotals = (totals) => {
      if (!totals) return { gross: "-", usable: "-", grossCuft: "-", usableCuft: "-" };
      const usableFactor = parseFloat(usableFactorInput?.value) || 97;
      return {
        gross: roundForDisplay(totals.gross, "L"),
        usable: roundForDisplay(totals.gross * (usableFactor / 100), "L"),
        grossCuft: roundForDisplay(totals.gross * settings.lToCuft, "cuft"),
        usableCuft: roundForDisplay(totals.gross * (usableFactor / 100) * settings.lToCuft, "cuft")
      };
    };
    const tA = fmtTotals(hasLeavesA ? resultA.totals : null);
    const tB = fmtTotals(hasLeavesB ? resultB.totals : null);
    let html = `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <thead><tr><th></th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Litres</th><th>cu.ft.</th><th>Litres</th><th>cu.ft.</th></tr></thead>
      <tbody>
      <tr><td><strong>Gross</strong></td><td>${tA.gross}</td><td>${tA.grossCuft}</td><td>${tB.gross}</td><td>${tB.grossCuft}</td></tr>
      <tr><td><strong>Usable</strong></td><td>${tA.usable}</td><td>${tA.usableCuft}</td><td>${tB.usable}</td><td>${tB.usableCuft}</td></tr>
      </tbody></table>`;
    if (hasLeavesA && resultA.leaves.length > 0 && hasLeavesB && resultB.leaves.length > 0) {
      html += `<h3>Per\u2011Compartment Breakdown</h3>`;
      const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
      html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <tr><th>Compartment</th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Gross</th><th>Usable</th><th>Gross</th><th>Usable</th></tr>`;
      for (let i = 0; i < maxLeaves; i++) {
        const leafA = resultA.leaves[i], leafB = resultB.leaves[i];
        const fmtA = leafA ? {
          gross: roundForDisplay(leafA.gross, "L"),
          usable: roundForDisplay(leafA.gross * (parseFloat(usableFactorInput?.value) || 97) / 100, "L")
        } : { gross: "-", usable: "-" };
        const fmtB = leafB ? {
          gross: roundForDisplay(leafB.gross, "L"),
          usable: roundForDisplay(leafB.gross * (parseFloat(usableFactorInput?.value) || 97) / 100, "L")
        } : { gross: "-", usable: "-" };
        html += `<tr><td>Comp ${i + 1}</td><td>${fmtA.gross}</td><td>${fmtA.usable}</td><td>${fmtB.gross}</td><td>${fmtB.usable}</td></tr>`;
      }
      html += `</table>`;
    }
    comparisonContent.innerHTML = html;
  }
  document.getElementById("tabVolume").addEventListener("click", () => {
    document.getElementById("panelVolume").classList.remove("hidden");
    document.getElementById("panelThermal").classList.add("hidden");
    document.getElementById("tabVolume").classList.add("active");
    document.getElementById("tabThermal").classList.remove("active");
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
    document.getElementById("tabThermal").classList.add("active");
    document.getElementById("tabVolume").classList.remove("active");
    const thermoRight = document.getElementById("thermoRightPanel");
    const frontCanvas = document.getElementById("schematicFront");
    const sideCanvas = document.getElementById("schematicSide");
    if (thermoRight) thermoRight.classList.remove("hidden");
    if (frontCanvas) frontCanvas.style.display = "none";
    if (sideCanvas) sideCanvas.style.display = "none";
  });
  initThermoUI(() => readGeometryFromPanel());
})();
