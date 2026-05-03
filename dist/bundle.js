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
      fittingErrors: [...excludedFittingIds]
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
  var currentConfig = null;
  numCompartmentsInput.addEventListener("input", buildCompartmentUI);
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
    `;
      compartmentBuilder.appendChild(fieldset);
    }
    compartmentBuilder.querySelectorAll('button[data-action="addShelf"]').forEach((btn) => {
      btn.addEventListener("click", () => addShelf(btn.dataset.comp));
    });
    compartmentBuilder.querySelectorAll('button[data-action="addDrawer"]').forEach((btn) => {
      btn.addEventListener("click", () => addDrawer(btn.dataset.comp));
    });
    compartmentBuilder.querySelectorAll('button[data-action="addBin"]').forEach((btn) => {
      btn.addEventListener("click", () => addBin(btn.dataset.comp));
    });
  }
  function addShelf(compIndex) {
    const container = document.querySelector(`.shelfContainer[data-comp="${compIndex}"]`);
    const div = document.createElement("div");
    div.innerHTML = `
    <label>Pos from floor (mm): <input type="number" step="any" value="100" class="shelf-pos"></label>
    <label>Thickness (mm): <input type="number" step="any" value="5" class="shelf-thick"></label>
    <label>Depth (mm): <input type="number" step="any" value="300" class="shelf-depth"></label>
    <label>Width (mm, blank=full): <input type="number" step="any" class="shelf-width" placeholder="optional"></label>
  `;
    container.appendChild(div);
  }
  function addDrawer(compIndex) {
    const container = document.querySelector(`.drawerContainer[data-comp="${compIndex}"]`);
    const div = document.createElement("div");
    div.innerHTML = `
    <label>Outer W (mm): <input type="number" step="any" value="300" class="drawer-w"></label>
    <label>Outer D (mm): <input type="number" step="any" value="300" class="drawer-d"></label>
    <label>Outer H (mm): <input type="number" step="any" value="150" class="drawer-h"></label>
    <label>Wall t (mm): <input type="number" step="any" value="3" class="drawer-t"></label>
  `;
    container.appendChild(div);
  }
  function addBin(compIndex) {
    const container = document.querySelector(`.binContainer[data-comp="${compIndex}"]`);
    const div = document.createElement("div");
    div.innerHTML = `
    <label>Outer W (mm): <input type="number" step="any" value="200" class="bin-w"></label>
    <label>Outer H (mm): <input type="number" step="any" value="100" class="bin-h"></label>
    <label>Outer D (mm): <input type="number" step="any" value="80" class="bin-d"></label>
    <label>Wall t (mm): <input type="number" step="any" value="2" class="bin-t"></label>
  `;
    container.appendChild(div);
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
      const shelfRows = compartmentBuilder.querySelectorAll(`.shelfContainer[data-comp="${i}"] > div`);
      const shelves = [];
      shelfRows.forEach((row) => {
        const pos = parseFloat(row.querySelector(".shelf-pos").value);
        const thick = parseFloat(row.querySelector(".shelf-thick").value);
        const depth = parseFloat(row.querySelector(".shelf-depth").value);
        const widthInput = row.querySelector(".shelf-width");
        const widthVal = widthInput.value ? parseFloat(widthInput.value) : null;
        if (!isNaN(pos) && !isNaN(thick) && !isNaN(depth)) {
          shelves.push({
            id: `${i}-shelf-${shelves.length}`,
            positionFromFloor: pos,
            thickness: thick,
            depth,
            width: widthVal
          });
        }
      });
      const drawerRows = compartmentBuilder.querySelectorAll(`.drawerContainer[data-comp="${i}"] > div`);
      const drawers = [];
      drawerRows.forEach((row) => {
        const w = parseFloat(row.querySelector(".drawer-w").value);
        const d = parseFloat(row.querySelector(".drawer-d").value);
        const h = parseFloat(row.querySelector(".drawer-h").value);
        const t = parseFloat(row.querySelector(".drawer-t").value);
        if (!isNaN(w) && !isNaN(d) && !isNaN(h) && !isNaN(t)) {
          drawers.push({
            id: `${i}-drawer-${drawers.length}`,
            outerWidth: w,
            outerDepth: d,
            outerHeight: h,
            wallThickness: t
          });
        }
      });
      const binRows = compartmentBuilder.querySelectorAll(`.binContainer[data-comp="${i}"] > div`);
      const doorBins = [];
      binRows.forEach((row) => {
        const w = parseFloat(row.querySelector(".bin-w").value);
        const h = parseFloat(row.querySelector(".bin-h").value);
        const d = parseFloat(row.querySelector(".bin-d").value);
        const t = parseFloat(row.querySelector(".bin-t").value);
        if (!isNaN(w) && !isNaN(h) && !isNaN(d) && !isNaN(t)) {
          doorBins.push({
            id: `${i}-bin-${doorBins.length}`,
            outerWidth: w,
            outerHeight: h,
            outerDepth: d,
            wallThickness: t
          });
        }
      });
      leaves.push({
        id: `comp${i}`,
        nodeType: "leaf",
        type: compType,
        fittings: {
          shelves,
          drawers,
          doorBins,
          iceMakerHousing: { volume: null },
          lightHousing: { volume: null }
        },
        heightMode: "ratio",
        heightValue: heightRatio
      });
    }
    const totalRatio = leaves.reduce((s, l) => s + l.heightValue, 0);
    if (totalRatio > 0) {
      leaves.forEach((l) => l.heightValue /= totalRatio);
    }
    const rootNode = {
      nodeType: "horizontal",
      id: "root",
      children: leaves.map((leaf, idx) => ({
        heightMode: "ratio",
        heightValue: leaf.heightValue,
        node: {
          nodeType: "leaf",
          id: leaf.id,
          type: leaf.type,
          fittings: leaf.fittings
        }
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
    showMessages(result.validationErrors, result.warnings, result.calcErrors);
    if (result.leaves && result.totals) {
      document.getElementById("grossVol").textContent = result.totals.gross.toFixed(2);
      document.getElementById("egNetVol").textContent = result.totals.egNet.toFixed(2);
      document.getElementById("iecNetVol").textContent = result.totals.iecNet.toFixed(2);
      document.getElementById("grossVolCuft").textContent = (result.totals.gross * 0.0353147).toFixed(3);
      document.getElementById("egNetVolCuft").textContent = (result.totals.egNet * 0.0353147).toFixed(3);
      document.getElementById("iecNetVolCuft").textContent = (result.totals.iecNet * 0.0353147).toFixed(3);
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
        alert("Configuration loaded (only external fields restored).");
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
