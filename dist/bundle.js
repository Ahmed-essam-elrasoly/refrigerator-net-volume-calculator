(() => {
  // src/js/engine/calc.js
  var MM3_TO_L = 1e-6;
  var L_TO_CUFT = 0.0353147;
  var EG_FACTOR = 0.97;
  function deriveRootSpace(cabinet) {
    const { external, wallThicknesses: w, airGap } = cabinet;
    return {
      width: external.width - w.left - w.right,
      height: external.height - w.top - w.bottom,
      depth: external.depth - w.rear - w.door - airGap
    };
  }
  function shelfVol(shelf, availableWidth) {
    const w = shelf.width ?? availableWidth;
    return w * shelf.depth * shelf.thickness * MM3_TO_L;
  }
  function drawerStructVol(drawer) {
    const { outerWidth: oW, outerDepth: oD, outerHeight: oH, wallThickness: t } = drawer;
    const outerVol = oW * oD * oH;
    const innerW = oW - 2 * t;
    const innerD = oD - 2 * t;
    const innerH = oH - t;
    const innerVol = innerW * innerD * innerH;
    return (outerVol - innerVol) * MM3_TO_L;
  }
  function binStructVol(bin) {
    const { outerWidth: oW, outerHeight: oH, outerDepth: oD, wallThickness: t } = bin;
    const outerVol = oW * oH * oD;
    const innerW = oW - 2 * t;
    const innerH = oH - 2 * t;
    const innerD = oD - t;
    const innerVol = innerW * innerH * innerD;
    return (outerVol - innerVol) * MM3_TO_L;
  }
  function calcLeaf(leaf, space, excludedFittingIds = /* @__PURE__ */ new Set()) {
    const { width, height, depth } = space;
    const fittings = leaf.fittings;
    const gross = width * depth * height * MM3_TO_L;
    const egNet = gross * EG_FACTOR;
    let deductions = 0;
    for (const shelf of fittings.shelves) {
      if (excludedFittingIds.has(shelf.id)) continue;
      deductions += shelfVol(shelf, width);
    }
    for (const drawer of fittings.drawers) {
      if (excludedFittingIds.has(drawer.id)) continue;
      deductions += drawerStructVol(drawer);
    }
    for (const bin of fittings.doorBins) {
      if (excludedFittingIds.has(bin.id)) continue;
      deductions += binStructVol(bin);
    }
    if (fittings.iceMakerHousing?.volume != null) {
      deductions += fittings.iceMakerHousing.volume;
    }
    if (fittings.lightHousing?.volume != null) {
      deductions += fittings.lightHousing.volume;
    }
    const iecNet = egNet - deductions;
    return {
      leafId: leaf.id,
      leafType: leaf.type,
      space,
      gross,
      egNet,
      iecNet,
      fittingErrors: [...excludedFittingIds],
      fittings: leaf.fittings
    };
  }
  function aggregateTotals(leaves) {
    let gross = 0, egNet = 0, iecNet = 0;
    for (const leaf of leaves) {
      gross += leaf.gross;
      egNet += leaf.egNet;
      iecNet += leaf.iecNet;
    }
    return { gross, egNet, iecNet };
  }
  function toCuft(litres) {
    return litres * L_TO_CUFT;
  }
  function roundForDisplay(val, unit) {
    return unit === "cuft" ? Math.round(val * 1e3) / 1e3 : Math.round(val * 100) / 100;
  }
  function formatLeafDisplay(leaf) {
    return {
      gross: roundForDisplay(leaf.gross, "L"),
      egNet: roundForDisplay(leaf.egNet, "L"),
      iecNet: roundForDisplay(leaf.iecNet, "L"),
      grossCuft: roundForDisplay(toCuft(leaf.gross), "cuft"),
      egNetCuft: roundForDisplay(toCuft(leaf.egNet), "cuft"),
      iecNetCuft: roundForDisplay(toCuft(leaf.iecNet), "cuft")
    };
  }
  function formatTotalsDisplay(totals) {
    return {
      gross: roundForDisplay(totals.gross, "L"),
      egNet: roundForDisplay(totals.egNet, "L"),
      iecNet: roundForDisplay(totals.iecNet, "L"),
      grossCuft: roundForDisplay(toCuft(totals.gross), "cuft"),
      egNetCuft: roundForDisplay(toCuft(totals.egNet), "cuft"),
      iecNetCuft: roundForDisplay(toCuft(totals.iecNet), "cuft")
    };
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
    const excludedFittingIds = /* @__PURE__ */ new Set();
    const { fittings, id } = node;
    for (const shelf of fittings.shelves ?? []) {
      const shelfErrors = validateShelf(shelf, space, id);
      for (const e of shelfErrors) {
        errors.push(e);
        excludedFittingIds.add(shelf.id);
      }
    }
    for (const drawer of fittings.drawers ?? []) {
      const drawerErrors = validateDrawer(drawer, space, id);
      for (const e of drawerErrors) {
        errors.push(e);
        excludedFittingIds.add(drawer.id);
      }
    }
    for (const bin of fittings.doorBins ?? []) {
      const binErrors = validateDoorBin(bin, space, id);
      for (const e of binErrors) {
        errors.push(e);
        excludedFittingIds.add(bin.id);
      }
    }
    const binDepthWarning = checkDoorBinDepth(fittings, space, id);
    if (binDepthWarning) warnings.push(binDepthWarning);
    const result = calcLeaf(node, space, excludedFittingIds);
    leaves.push(result);
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

  // src/js/engine/index.js
  function validateCabinet(cabinet) {
    const errors = [];
    const { external, wallThicknesses: w } = cabinet;
    for (const [key, val] of Object.entries(external)) {
      if (val <= 0) {
        errors.push({ rule: "positiveValues", message: `external.${key} must be > 0, got ${val}` });
      }
    }
    const pairs = [
      ["top", external.height, "height"],
      ["bottom", external.height, "height"],
      ["left", external.width, "width"],
      ["right", external.width, "width"],
      ["rear", external.depth, "depth"],
      ["door", external.depth, "depth"]
    ];
    for (const [face, extDim, dimName] of pairs) {
      const thickness = w[face];
      if (thickness >= extDim * 0.5) {
        errors.push({
          rule: "wallRatio",
          message: `${face} wall (${thickness} mm) exceeds 50% of external ${dimName} (${extDim * 0.5} mm)`
        });
      }
    }
    if (cabinet.airGap <= 0) {
      errors.push({ rule: "positiveValues", message: `airGap must be > 0, got ${cabinet.airGap}` });
    }
    if (errors.length === 0) {
      const rootSpace = deriveRootSpace(cabinet);
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
  function checkHierarchy(leaves, totals) {
    const errors = [];
    for (const leaf of leaves) {
      if (leaf.gross < leaf.egNet - 1e-9) {
        errors.push({
          rule: "hierarchyCheck_leaf",
          message: `Gross (${leaf.gross}) < EG_Net (${leaf.egNet}) on leaf ${leaf.leafId}`
        });
      }
      if (leaf.egNet < leaf.iecNet - 1e-9) {
        errors.push({
          rule: "hierarchyCheck_leaf",
          message: `EG_Net (${leaf.egNet}) < IEC_Net (${leaf.iecNet}) on leaf ${leaf.leafId}`
        });
      }
    }
    if (totals.gross < totals.egNet - 1e-9) {
      errors.push({
        rule: "hierarchyCheck_total",
        message: `Total Gross (${totals.gross}) < Total EG_Net (${totals.egNet})`
      });
    }
    if (totals.egNet < totals.iecNet - 1e-9) {
      errors.push({
        rule: "hierarchyCheck_total",
        message: `Total EG_Net (${totals.egNet}) < Total IEC_Net (${totals.iecNet})`
      });
    }
    return errors;
  }
  function runCalculation(config) {
    const result = {
      leaves: null,
      totals: null,
      validationErrors: [],
      calcErrors: [],
      warnings: []
    };
    const structErrors = validateStructure(config.cabinet.layout);
    if (structErrors.length) {
      result.validationErrors = structErrors;
      return result;
    }
    const cabinetErrors = validateCabinet(config.cabinet);
    if (cabinetErrors.length) {
      result.validationErrors = cabinetErrors;
      return result;
    }
    const rootSpace = deriveRootSpace(config.cabinet);
    const { leaves, errors: dimErrors, warnings } = traverseAndCompute(
      config.cabinet.layout,
      rootSpace
    );
    result.validationErrors = dimErrors;
    result.warnings = warnings;
    result.leaves = leaves;
    if (leaves.length > 0) {
      const totals = aggregateTotals(leaves);
      result.totals = totals;
      result.calcErrors = checkHierarchy(leaves, totals);
    }
    return result;
  }

  // src/js/io/io.js
  var SCHEMA_VERSION = "1.0";
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
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(
        `Schema version mismatch: file is v${parsed.schemaVersion}, expected v${SCHEMA_VERSION}.`
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
      "Type",
      "Gross (L)",
      "EG Net (L)",
      "IEC Net (L)",
      "Gross (cu.ft)",
      "EG Net (cu.ft)",
      "IEC Net (cu.ft)"
    ].join(","));
    for (let i = 0; i < result.leaves.length; i++) {
      const leaf = result.leaves[i];
      const d = formatLeafDisplay(leaf);
      rows.push([
        `Compartment ${i + 1}`,
        leaf.leafType,
        d.gross,
        d.egNet,
        d.iecNet,
        d.grossCuft,
        d.egNetCuft,
        d.iecNetCuft
      ].join(","));
    }
    const t = formatTotalsDisplay(result.totals);
    rows.push([
      "TOTAL",
      "",
      t.gross,
      t.egNet,
      t.iecNet,
      t.grossCuft,
      t.egNetCuft,
      t.iecNetCuft
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
  function drawSchematic(leaves, config, canvas, tooltipDiv) {
    const ctx = canvas.getContext("2d");
    const { external, wallThicknesses: w } = config.cabinet;
    const PAD = { left: 50, top: 30, right: 30, bottom: 30 };
    const drawW = canvas.width - PAD.left - PAD.right;
    const drawH = canvas.height - PAD.top - PAD.bottom;
    const scale = Math.min(drawW / external.width, drawH / external.height);
    const extW = external.width * scale;
    const extH = external.height * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(PAD.left, PAD.top);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, extW, extH);
    ctx.fillStyle = "#f8f8f8";
    ctx.fillRect(0, 0, extW, extH);
    const intLeft = w.left * scale;
    const intRight = extW - w.right * scale;
    const intTop = w.top * scale;
    const intBottom = extH - w.bottom * scale;
    const intW = intRight - intLeft;
    const intH = intBottom - intTop;
    ctx.strokeStyle = "#00a";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(intLeft, intTop, intW, intH);
    ctx.setLineDash([]);
    if (!leaves || leaves.length === 0) {
      ctx.restore();
      return;
    }
    const internalW = external.width - w.left - w.right;
    const internalH = external.height - w.top - w.bottom;
    const rootSpace = { x: 0, y: 0, width: internalW, height: internalH };
    const leafRects = [];
    function traverse(node, space, leafIdxAcc = { idx: 0 }) {
      if (node.nodeType === "leaf") {
        leafRects.push({ ...space, fittings: node.fittings, type: node.type, leafIdx: leafIdxAcc.idx });
        leafIdxAcc.idx++;
      } else if (node.nodeType === "horizontal") {
        const { children, dividers } = node;
        const totalDivThick = dividers.reduce((s, d) => s + d.thickness, 0);
        const usableH = space.height - totalDivThick;
        let yOffset = space.y;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          let childH = child.heightMode === "ratio" ? usableH * child.heightValue : child.heightValue;
          traverse(child.node, { x: space.x, y: yOffset, width: space.width, height: childH }, leafIdxAcc);
          yOffset += childH;
          if (i < dividers.length) yOffset += dividers[i].thickness;
        }
      } else if (node.nodeType === "vertical") {
        const { dividerThickness, leftWidthRatio, left, right } = node;
        const usableW = space.width - dividerThickness;
        const leftW = usableW * leftWidthRatio;
        const rightW = usableW * (1 - leftWidthRatio);
        traverse(left, { x: space.x, y: space.y, width: leftW, height: space.height }, leafIdxAcc);
        traverse(right, { x: space.x + leftW + dividerThickness, y: space.y, width: rightW, height: space.height }, leafIdxAcc);
      }
    }
    traverse(config.cabinet.layout, rootSpace);
    const hitRegions = [];
    leafRects.forEach((rect) => {
      const x = intLeft + rect.x * scale;
      const y = intTop + rect.y * scale;
      const w2 = rect.width * scale;
      const h = rect.height * scale;
      const compBottom = y + h;
      const leafData = leaves[rect.leafIdx];
      ctx.fillStyle = rect.leafIdx % 2 === 0 ? "#e8f0e8" : "#ffffff";
      ctx.fillRect(x, y, w2, h);
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w2, h);
      ctx.fillStyle = "#000";
      ctx.font = "11px Arial";
      ctx.fillText(rect.type, x + 4, y + 13);
      hitRegions.push({
        rect: { x, y, w: w2, h },
        label: `Compartment: ${rect.type}`,
        info: leafData ? `W\xD7D\xD7H: ${rect.width.toFixed(0)}\xD7${leafData.space.depth.toFixed(0)}\xD7${rect.height.toFixed(0)} mm
Gross: ${leafData.gross.toFixed(2)} L
EG Net: ${leafData.egNet.toFixed(2)} L
IEC Net: ${leafData.iecNet.toFixed(2)} L` : "No data"
      });
      if (rect.fittings?.shelves) {
        for (const shelf of rect.fittings.shelves) {
          const shelfY = compBottom - shelf.positionFromFloor * scale;
          const shelfW = shelf.width !== null ? shelf.width * scale : w2;
          const shelfX = x + (w2 - shelfW) / 2;
          ctx.strokeStyle = "#b22222";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(shelfX, shelfY);
          ctx.lineTo(shelfX + shelfW, shelfY);
          ctx.stroke();
          hitRegions.push({
            rect: { x: shelfX, y: shelfY - 2, w: shelfW, h: 4 },
            label: "Shelf",
            info: `Pos: ${shelf.positionFromFloor} mm
Thick: ${shelf.thickness} mm
Depth: ${shelf.depth} mm` + (shelf.width ? `
Width: ${shelf.width} mm` : "\nFull width")
          });
        }
      }
      const drawers = rect.fittings?.drawers;
      if (drawers && drawers.length > 0) {
        const groups = {};
        drawers.forEach((d) => {
          const pos = d.positionFromFloor ?? 0;
          if (!groups[pos]) groups[pos] = [];
          groups[pos].push(d);
        });
        Object.keys(groups).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach((pos) => {
          const group = groups[pos];
          const posNum = parseFloat(pos);
          const totalOuterW = group.reduce((sum, d) => sum + d.outerWidth, 0);
          let groupScale = scale;
          if (totalOuterW * scale > w2 - 10) groupScale = (w2 - 10) / totalOuterW;
          let xOffset = x + 5;
          const baseY = compBottom - posNum * scale;
          group.forEach((d) => {
            const dw = d.outerWidth * groupScale;
            const dh = d.outerHeight * groupScale;
            const dy = baseY - dh;
            ctx.fillStyle = "#d4a373";
            ctx.fillRect(xOffset, dy, dw, dh);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.strokeRect(xOffset, dy, dw, dh);
            hitRegions.push({
              rect: { x: xOffset, y: dy, w: dw, h: dh },
              label: "Drawer",
              info: `Pos: ${posNum} mm
Outer: ${d.outerWidth}\xD7${d.outerDepth}\xD7${d.outerHeight} mm
Wall: ${d.wallThickness} mm`
            });
            xOffset += dw + 2;
          });
        });
      }
    });
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#aaccff";
    ctx.fillRect(intLeft, intTop, intW, intH);
    ctx.restore();
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    ctx.strokeRect(intLeft, intTop, intW, intH);
    ctx.fillStyle = "#000";
    ctx.font = "10px Arial";
    leafRects.forEach((rect) => {
      const x = intLeft + rect.x * scale;
      const y = intTop + rect.y * scale;
      const w2 = rect.width * scale;
      const h = rect.height * scale;
      const bins = rect.fittings?.doorBins;
      if (!bins || bins.length === 0) return;
      const totalBinsHeight = bins.reduce((sum, b) => sum + b.outerHeight * scale, 0);
      const gap = 3 * scale;
      const totalStackH = totalBinsHeight + (bins.length - 1) * gap;
      let startY = y + (h - totalStackH) / 2;
      if (startY < y) startY = y + 2;
      for (const bin of bins) {
        const bh = bin.outerHeight * scale;
        const bx = x;
        const bw = w2;
        const by = startY;
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#7f8c8d";
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, bw, bh);
        hitRegions.push({
          rect: { x: bx, y: by, w: bw, h: bh },
          label: "Door Bin",
          info: `Outer: ${bin.outerWidth}\xD7${bin.outerHeight}\xD7${bin.outerDepth} mm
Wall: ${bin.wallThickness} mm`
        });
        startY += bh + gap;
      }
    });
    ctx.restore();
    if (canvas._schematicMouseMove) {
      canvas.removeEventListener("mousemove", canvas._schematicMouseMove);
    }
    canvas._schematicMouseMove = (e) => {
      const canvasRect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const mouseCanvasX = (e.clientX - canvasRect.left) * scaleX - PAD.left;
      const mouseCanvasY = (e.clientY - canvasRect.top) * scaleY - PAD.top;
      let bestRegion = null;
      let bestArea = Infinity;
      for (const region of hitRegions) {
        if (mouseCanvasX >= region.rect.x && mouseCanvasX <= region.rect.x + region.rect.w && mouseCanvasY >= region.rect.y && mouseCanvasY <= region.rect.y + region.rect.h) {
          const area = region.rect.w * region.rect.h;
          if (area < bestArea) {
            bestRegion = region;
            bestArea = area;
          }
        }
      }
      if (bestRegion) {
        tooltipDiv.classList.remove("hidden");
        tooltipDiv.innerHTML = `<strong>${bestRegion.label}</strong><br>${bestRegion.info.replace(/\n/g, "<br>")}`;
        const panelRect = document.querySelector(".right-panel").getBoundingClientRect();
        let left = e.clientX - panelRect.left + 15;
        let top = e.clientY - panelRect.top + 15;
        const tw = tooltipDiv.offsetWidth;
        const th = tooltipDiv.offsetHeight;
        if (left + tw > panelRect.width) left = left - tw - 30;
        if (top + th > panelRect.height) top = top - th - 30;
        tooltipDiv.style.left = left + "px";
        tooltipDiv.style.top = top + "px";
      } else {
        tooltipDiv.classList.add("hidden");
      }
    };
    canvas.addEventListener("mousemove", canvas._schematicMouseMove);
  }

  // src/js/main.js
  var extHeightInput = document.getElementById("extHeight");
  var extWidthInput = document.getElementById("extWidth");
  var extDepthInput = document.getElementById("extDepth");
  var wallTopInput = document.getElementById("wallTop");
  var wallBottomInput = document.getElementById("wallBottom");
  var wallLeftInput = document.getElementById("wallLeft");
  var wallRightInput = document.getElementById("wallRight");
  var wallRearInput = document.getElementById("wallRear");
  var wallDoorInput = document.getElementById("wallDoor");
  var divHorizInput = document.getElementById("divHoriz");
  var divVertInput = document.getElementById("divVert");
  var sealOffsetInput = document.getElementById("sealOffset");
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
  var currentConfig = null;
  var dirtySchematic = false;
  function markDirty() {
    dirtySchematic = true;
    schematicOverlay.classList.remove("hidden");
  }
  document.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", markDirty));
  numCompartmentsInput.addEventListener("input", () => {
    markDirty();
    buildCompartmentUI();
  });
  buildCompartmentUI();
  function buildCompartmentUI() {
    const count = Math.max(1, Math.min(8, parseInt(numCompartmentsInput.value) || 1));
    compartmentBuilder.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const fieldset = document.createElement("fieldset");
      fieldset.innerHTML = `
      <legend>Compartment ${i + 1}</legend>
      <label>Type:
        <select data-comp="${i}" data-field="type">
          <option value="fresh">Fresh Food</option>
          <option value="freezer">Freezer</option>
          <option value="flex">Convertible</option>
        </select>
      </label>
      <label>Height Ratio (0-1):
        <input type="number" data-comp="${i}" data-field="heightRatio" step="0.01" min="0.01" max="1" value="0.5">
      </label>

      <label>
        <input type="checkbox" data-comp="${i}" data-action="toggleVertical"> Split vertically
      </label>
      <label class="vert-ratio-label" data-comp="${i}" style="display:none;">
        Left width ratio (0-1):
        <input type="number" data-comp="${i}" data-field="leftWidthRatio" step="0.01" min="0.1" max="0.9" value="0.5">
      </label>

      <div class="verticalSubContainer" data-comp="${i}" style="display:none;">
        <fieldset>
          <legend>Left sub-compartment</legend>
          <div class="shelfContainer" data-comp="${i}" data-sub="left"></div>
          <button type="button" data-action="addShelf" data-comp="${i}" data-sub="left">Add Shelf</button>
          <div class="drawerContainer" data-comp="${i}" data-sub="left"></div>
          <button type="button" data-action="addDrawer" data-comp="${i}" data-sub="left">Add Drawer</button>
          <div class="binContainer" data-comp="${i}" data-sub="left"></div>
          <button type="button" data-action="addBin" data-comp="${i}" data-sub="left">Add Door Bin</button>
        </fieldset>
        <fieldset>
          <legend>Right sub-compartment</legend>
          <div class="shelfContainer" data-comp="${i}" data-sub="right"></div>
          <button type="button" data-action="addShelf" data-comp="${i}" data-sub="right">Add Shelf</button>
          <div class="drawerContainer" data-comp="${i}" data-sub="right"></div>
          <button type="button" data-action="addDrawer" data-comp="${i}" data-sub="right">Add Drawer</button>
          <div class="binContainer" data-comp="${i}" data-sub="right"></div>
          <button type="button" data-action="addBin" data-comp="${i}" data-sub="right">Add Door Bin</button>
        </fieldset>
      </div>

      <div class="singleSubContainer" data-comp="${i}">
        <fieldset>
          <legend>Shelves</legend>
          <div class="shelfContainer" data-comp="${i}"></div>
          <button type="button" data-action="addShelf" data-comp="${i}">Add Shelf</button>
        </fieldset>
        <fieldset>
          <legend>Drawers / Crispers</legend>
          <div class="drawerContainer" data-comp="${i}"></div>
          <button type="button" data-action="addDrawer" data-comp="${i}">Add Drawer</button>
        </fieldset>
        <fieldset>
          <legend>Door Bins</legend>
          <div class="binContainer" data-comp="${i}"></div>
          <button type="button" data-action="addBin" data-comp="${i}">Add Door Bin</button>
        </fieldset>
      </div>
    `;
      compartmentBuilder.appendChild(fieldset);
    }
    compartmentBuilder.querySelectorAll('input[data-action="toggleVertical"]').forEach((cb) => {
      cb.addEventListener("change", function() {
        markDirty();
        const compIdx = this.dataset.comp;
        const vertContainer = document.querySelector(`.verticalSubContainer[data-comp="${compIdx}"]`);
        const singleContainer = document.querySelector(`.singleSubContainer[data-comp="${compIdx}"]`);
        const ratioLabel = document.querySelector(`label.vert-ratio-label[data-comp="${compIdx}"]`);
        if (this.checked) {
          vertContainer.style.display = "block";
          singleContainer.style.display = "none";
          if (ratioLabel) ratioLabel.style.display = "inline";
        } else {
          vertContainer.style.display = "none";
          singleContainer.style.display = "block";
          if (ratioLabel) ratioLabel.style.display = "none";
        }
      });
    });
    compartmentBuilder.querySelectorAll('button[data-action="addShelf"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        markDirty();
        addShelf(btn.dataset.comp, btn.dataset.sub || "");
      });
    });
    compartmentBuilder.querySelectorAll('button[data-action="addDrawer"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        markDirty();
        addDrawer(btn.dataset.comp, btn.dataset.sub || "");
      });
    });
    compartmentBuilder.querySelectorAll('button[data-action="addBin"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        markDirty();
        addBin(btn.dataset.comp, btn.dataset.sub || "");
      });
    });
  }
  function addShelf(compIndex, sub = "") {
    const subAttr = sub ? `[data-sub="${sub}"]` : ":not([data-sub])";
    const container = document.querySelector(`.shelfContainer[data-comp="${compIndex}"]${subAttr}`);
    if (!container) return;
    const div = document.createElement("div");
    div.innerHTML = `
    <label>Pos from floor (mm): <input type="number" step="any" value="100" class="shelf-pos"></label>
    <label>Thickness (mm): <input type="number" step="any" value="5" class="shelf-thick"></label>
    <label>Depth (mm): <input type="number" step="any" value="300" class="shelf-depth"></label>
    <label>Width (mm, blank=full): <input type="number" step="any" class="shelf-width" placeholder="optional"></label>
  `;
    container.appendChild(div);
  }
  function addDrawer(compIndex, sub = "") {
    const subAttr = sub ? `[data-sub="${sub}"]` : ":not([data-sub])";
    const container = document.querySelector(`.drawerContainer[data-comp="${compIndex}"]${subAttr}`);
    if (!container) return;
    const div = document.createElement("div");
    div.innerHTML = `
    <label>Pos from floor (mm): <input type="number" step="any" value="0" class="drawer-pos"></label>
    <label>Outer W (mm): <input type="number" step="any" value="300" class="drawer-w"></label>
    <label>Outer D (mm): <input type="number" step="any" value="300" class="drawer-d"></label>
    <label>Outer H (mm): <input type="number" step="any" value="150" class="drawer-h"></label>
    <label>Wall t (mm): <input type="number" step="any" value="3" class="drawer-t"></label>
  `;
    container.appendChild(div);
  }
  function addBin(compIndex, sub = "") {
    const subAttr = sub ? `[data-sub="${sub}"]` : ":not([data-sub])";
    const container = document.querySelector(`.binContainer[data-comp="${compIndex}"]${subAttr}`);
    if (!container) return;
    const div = document.createElement("div");
    div.innerHTML = `
    <label>Outer W (mm): <input type="number" step="any" value="200" class="bin-w"></label>
    <label>Outer H (mm): <input type="number" step="any" value="100" class="bin-h"></label>
    <label>Outer D (mm): <input type="number" step="any" value="80" class="bin-d"></label>
    <label>Wall t (mm): <input type="number" step="any" value="2" class="bin-t"></label>
  `;
    container.appendChild(div);
  }
  function collectFittings(compIndex, sub, type) {
    const subAttr = sub ? `[data-sub="${sub}"]` : ":not([data-sub])";
    const containerClass = type === "shelf" ? "shelfContainer" : type === "drawer" ? "drawerContainer" : "binContainer";
    const rows = compartmentBuilder.querySelectorAll(`.${containerClass}[data-comp="${compIndex}"]${subAttr} > div`);
    const items = [];
    rows.forEach((row) => {
      if (type === "shelf") {
        const pos = parseFloat(row.querySelector(".shelf-pos").value);
        const thick = parseFloat(row.querySelector(".shelf-thick").value);
        const depth = parseFloat(row.querySelector(".shelf-depth").value);
        const widthInput = row.querySelector(".shelf-width");
        const widthVal = widthInput.value ? parseFloat(widthInput.value) : null;
        if (!isNaN(pos) && !isNaN(thick) && !isNaN(depth)) {
          items.push({
            id: `${compIndex}-${sub}-shelf-${items.length}`,
            positionFromFloor: pos,
            thickness: thick,
            depth,
            width: widthVal
          });
        }
      } else if (type === "drawer") {
        const pos = parseFloat(row.querySelector(".drawer-pos").value);
        const w = parseFloat(row.querySelector(".drawer-w").value);
        const d = parseFloat(row.querySelector(".drawer-d").value);
        const h = parseFloat(row.querySelector(".drawer-h").value);
        const t = parseFloat(row.querySelector(".drawer-t").value);
        if (!isNaN(w) && !isNaN(d) && !isNaN(h) && !isNaN(t) && !isNaN(pos)) {
          items.push({
            id: `${compIndex}-${sub}-drawer-${items.length}`,
            positionFromFloor: pos,
            outerWidth: w,
            outerDepth: d,
            outerHeight: h,
            wallThickness: t
          });
        }
      } else if (type === "bin") {
        const w = parseFloat(row.querySelector(".bin-w").value);
        const h = parseFloat(row.querySelector(".bin-h").value);
        const d = parseFloat(row.querySelector(".bin-d").value);
        const t = parseFloat(row.querySelector(".bin-t").value);
        if (!isNaN(w) && !isNaN(h) && !isNaN(d) && !isNaN(t)) {
          items.push({
            id: `${compIndex}-${sub}-bin-${items.length}`,
            outerWidth: w,
            outerHeight: h,
            outerDepth: d,
            wallThickness: t
          });
        }
      }
    });
    return items;
  }
  function buildConfigFromForm() {
    const external = {
      height: parseFloat(extHeightInput.value),
      width: parseFloat(extWidthInput.value),
      depth: parseFloat(extDepthInput.value)
    };
    const wallThicknesses = {
      top: parseFloat(wallTopInput.value),
      bottom: parseFloat(wallBottomInput.value),
      left: parseFloat(wallLeftInput.value),
      right: parseFloat(wallRightInput.value),
      rear: parseFloat(wallRearInput.value),
      door: parseFloat(wallDoorInput.value)
    };
    const airGap = parseFloat(sealOffsetInput.value);
    const count = parseInt(numCompartmentsInput.value) || 1;
    const leaves = [];
    for (let i = 0; i < count; i++) {
      const typeSelect = compartmentBuilder.querySelector(`select[data-comp="${i}"][data-field="type"]`);
      const heightRatioInput = compartmentBuilder.querySelector(`input[data-comp="${i}"][data-field="heightRatio"]`);
      const compType = typeSelect.value;
      const heightRatio = parseFloat(heightRatioInput.value) || 0.5;
      const vertCheckbox = compartmentBuilder.querySelector(`input[data-action="toggleVertical"][data-comp="${i}"]`);
      const isVertical = vertCheckbox && vertCheckbox.checked;
      const leftWidthRatioInput = compartmentBuilder.querySelector(`input[data-comp="${i}"][data-field="leftWidthRatio"]`);
      const leftRatio = parseFloat(leftWidthRatioInput?.value) || 0.5;
      if (isVertical) {
        const leftShelves = collectFittings(i, "left", "shelf");
        const leftDrawers = collectFittings(i, "left", "drawer");
        const leftBins = collectFittings(i, "left", "bin");
        const rightShelves = collectFittings(i, "right", "shelf");
        const rightDrawers = collectFittings(i, "right", "drawer");
        const rightBins = collectFittings(i, "right", "bin");
        const divThickness = parseFloat(divVertInput.value) || 20;
        const vertNode = {
          nodeType: "vertical",
          id: `vert-${i}`,
          dividerThickness: divThickness,
          leftWidthRatio: leftRatio,
          left: {
            nodeType: "leaf",
            id: `comp${i}-L`,
            type: compType,
            fittings: {
              shelves: leftShelves,
              drawers: leftDrawers,
              doorBins: leftBins,
              iceMakerHousing: { volume: null },
              lightHousing: { volume: null }
            }
          },
          right: {
            nodeType: "leaf",
            id: `comp${i}-R`,
            type: compType,
            fittings: {
              shelves: rightShelves,
              drawers: rightDrawers,
              doorBins: rightBins,
              iceMakerHousing: { volume: null },
              lightHousing: { volume: null }
            }
          }
        };
        leaves.push({
          heightMode: "ratio",
          heightValue: heightRatio,
          node: vertNode
        });
      } else {
        const shelves = collectFittings(i, "", "shelf");
        const drawers = collectFittings(i, "", "drawer");
        const bins = collectFittings(i, "", "bin");
        leaves.push({
          heightMode: "ratio",
          heightValue: heightRatio,
          node: {
            nodeType: "leaf",
            id: `comp${i}`,
            type: compType,
            fittings: {
              shelves,
              drawers,
              doorBins: bins,
              iceMakerHousing: { volume: null },
              lightHousing: { volume: null }
            }
          }
        });
      }
    }
    const totalRatio = leaves.reduce((s, l) => s + l.heightValue, 0);
    if (totalRatio > 0) {
      leaves.forEach((l) => l.heightValue /= totalRatio);
    }
    const rootNode = {
      nodeType: "horizontal",
      id: "root",
      children: leaves.map((l) => ({
        heightMode: l.heightMode,
        heightValue: l.heightValue,
        node: l.node
      })),
      dividers: Array.from({ length: leaves.length - 1 }, (_, i) => ({
        afterChildIndex: i,
        thickness: parseFloat(divHorizInput.value) || 20
      }))
    };
    return {
      schemaVersion: "1.0",
      meta: {
        name: "UI Config",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      cabinet: {
        external,
        wallThicknesses,
        airGap,
        layout: rootNode
      }
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
  calculateBtn.addEventListener("click", () => {
    const config = buildConfigFromForm();
    currentConfig = config;
    const result = runCalculation(config);
    if (result.leaves && result.totals) {
      document.getElementById("grossVol").textContent = result.totals.gross.toFixed(2);
      document.getElementById("egNetVol").textContent = result.totals.egNet.toFixed(2);
      document.getElementById("iecNetVol").textContent = result.totals.iecNet.toFixed(2);
      document.getElementById("grossVolCuft").textContent = (result.totals.gross * 0.0353147).toFixed(3);
      document.getElementById("egNetVolCuft").textContent = (result.totals.egNet * 0.0353147).toFixed(3);
      document.getElementById("iecNetVolCuft").textContent = (result.totals.iecNet * 0.0353147).toFixed(3);
    }
    showMessages(result.validationErrors, result.warnings, result.calcErrors);
    const canvas = document.getElementById("schematicCanvas");
    if (canvas && result.leaves && result.leaves.length > 0) {
      drawSchematic(result.leaves, currentConfig, canvas, schematicTooltip);
      dirtySchematic = false;
      schematicOverlay.classList.add("hidden");
    } else if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirtySchematic = false;
      schematicOverlay.classList.add("hidden");
    }
  });
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
        extHeightInput.value = config.cabinet.external.height;
        extWidthInput.value = config.cabinet.external.width;
        extDepthInput.value = config.cabinet.external.depth;
        wallTopInput.value = config.cabinet.wallThicknesses.top;
        wallBottomInput.value = config.cabinet.wallThicknesses.bottom;
        wallLeftInput.value = config.cabinet.wallThicknesses.left;
        wallRightInput.value = config.cabinet.wallThicknesses.right;
        wallRearInput.value = config.cabinet.wallThicknesses.rear;
        wallDoorInput.value = config.cabinet.wallThicknesses.door;
        sealOffsetInput.value = config.cabinet.airGap;
        const result = runCalculation(config);
        if (result.leaves && result.totals) {
          document.getElementById("grossVol").textContent = result.totals.gross.toFixed(2);
          document.getElementById("egNetVol").textContent = result.totals.egNet.toFixed(2);
          document.getElementById("iecNetVol").textContent = result.totals.iecNet.toFixed(2);
          document.getElementById("grossVolCuft").textContent = (result.totals.gross * 0.0353147).toFixed(3);
          document.getElementById("egNetVolCuft").textContent = (result.totals.egNet * 0.0353147).toFixed(3);
          document.getElementById("iecNetVolCuft").textContent = (result.totals.iecNet * 0.0353147).toFixed(3);
        }
        showMessages(result.validationErrors, result.warnings, result.calcErrors);
        const canvas = document.getElementById("schematicCanvas");
        if (canvas && result.leaves && result.leaves.length > 0) {
          drawSchematic(result.leaves, currentConfig, canvas, schematicTooltip);
          dirtySchematic = false;
          schematicOverlay.classList.add("hidden");
        }
        alert("Configuration loaded and calculated.");
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
})();
