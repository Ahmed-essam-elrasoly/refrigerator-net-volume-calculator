import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawFrontView, drawSideView } from './ui/schematic.js';
import { initSettingsModal, showModal } from './ui/settingsModal.js';
import { settings } from './settings.js';
import { formatTotalsDisplay, formatLeafDisplay, walkBoundaries, roundForDisplay } from './engine/calc.js';
import { initThermoUI } from './ui/thermoUI.js';
import { DEFAULT_CABINET, toVolumeFormat, toThermalFormat, upgradeConfig } from './engine/geometry.js';
// ---- DOM references (only those that still exist) ---------------------
const divHorizInput       = document.getElementById('divHoriz');
const usableFactorInput = document.getElementById('usableFactor'); 
const numCompartmentsInput= document.getElementById('numCompartments');
const compartmentBuilder  = document.getElementById('compartmentBuilder');
const calculateBtn        = document.getElementById('calculateBtn');
const saveBtn             = document.getElementById('saveBtn');
const loadBtn             = document.getElementById('loadBtn');
const exportBtn           = document.getElementById('exportBtn');
const messagesDiv         = document.getElementById('messages');
const messagesFieldset    = document.getElementById('messagesFieldset');
const schematicOverlay    = document.getElementById('schematicOverlay');
const schematicTooltip    = document.getElementById('schematicTooltip');
const settingsBtn         = document.getElementById('settingsBtn');
const resetAllBtn         = document.getElementById('resetAllBtn');
const storeSlotABtn       = document.getElementById('storeSlotABtn');
const storeSlotBBtn       = document.getElementById('storeSlotBBtn');
const compareSlotsBtn     = document.getElementById('compareSlotsBtn');
const comparisonModal     = document.getElementById('comparisonModal');
const closeComparison     = document.getElementById('closeComparison');
const comparisonContent   = document.getElementById('comparisonContent');
const splitter = document.getElementById('splitter');
const leftPanel = document.querySelector('.left-panel');
let isResizing = false;
let startX, startWidth;

splitter.addEventListener('mousedown', (e) => {
  isResizing = true;
  startX = e.clientX;
  startWidth = leftPanel.getBoundingClientRect().width;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const delta = e.clientX - startX;
  const newWidth = Math.max(300, Math.min(800, startWidth + delta));
  leftPanel.style.flex = `0 0 ${newWidth}px`;
});

document.addEventListener('mouseup', () => {
  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

let configSlotA = null;
let configSlotB = null;
let currentConfig = null;
let dirtySchematic = false;

// ---- Shared cabinet geometry ------------------------------------------
let currentGeometry = { ...DEFAULT_CABINET };

function readGeometryFromPanel() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
  return {
    H: g('geom-H') ?? DEFAULT_CABINET.H,
    W: g('geom-W') ?? DEFAULT_CABINET.W,
    D: g('geom-D') ?? DEFAULT_CABINET.D,
    Hf: g('geom-Hf') ?? DEFAULT_CABINET.Hf,
    Hr: g('geom-Hr') ?? DEFAULT_CABINET.Hr,
    Hb: g('geom-Hb') ?? DEFAULT_CABINET.Hb,
    Db1: g('geom-Db1') ?? DEFAULT_CABINET.Db1,
    Db2: g('geom-Db2') ?? DEFAULT_CABINET.Db2,
    doorGap: g('geom-doorGap') ?? DEFAULT_CABINET.doorGap,
    packingPos: g('geom-packingPos') ?? DEFAULT_CABINET.packingPos,
    airGap: g('geom-airGap') ?? DEFAULT_CABINET.airGap,
    walls: {
      freezer: {
        top:     g('geom-walls-freezer-top') ?? DEFAULT_CABINET.walls.freezer.top,
        bottom:  g('geom-walls-freezer-bottom') ?? DEFAULT_CABINET.walls.freezer.bottom,
        left:    g('geom-walls-freezer-left') ?? DEFAULT_CABINET.walls.freezer.left,
        right:   g('geom-walls-freezer-right') ?? DEFAULT_CABINET.walls.freezer.right,
        door:    g('geom-walls-freezer-door') ?? DEFAULT_CABINET.walls.freezer.door,
        rear:    g('geom-walls-freezer-rear') ?? DEFAULT_CABINET.walls.freezer.rear,
      },
      refrigerator: {
        top:     g('geom-walls-refrigerator-top') ?? DEFAULT_CABINET.walls.refrigerator.top,
        bottom1: g('geom-walls-refrigerator-bottom1') ?? DEFAULT_CABINET.walls.refrigerator.bottom1,
        bottom2: g('geom-walls-refrigerator-bottom2') ?? DEFAULT_CABINET.walls.refrigerator.bottom2,
        bottom3: g('geom-walls-refrigerator-bottom3') ?? DEFAULT_CABINET.walls.refrigerator.bottom3,
        left:    g('geom-walls-refrigerator-left') ?? DEFAULT_CABINET.walls.refrigerator.left,
        right:   g('geom-walls-refrigerator-right') ?? DEFAULT_CABINET.walls.refrigerator.right,
        rear:    g('geom-walls-refrigerator-rear') ?? DEFAULT_CABINET.walls.refrigerator.rear,
        door:    g('geom-walls-refrigerator-door') ?? DEFAULT_CABINET.walls.refrigerator.door,
      }
    }
  };
}

function writeGeometryToPanel(geom) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('geom-H', geom.H);
  set('geom-W', geom.W);
  set('geom-D', geom.D);
  set('geom-Hf', geom.Hf);
  set('geom-Hr', geom.Hr);
  set('geom-Hb', geom.Hb);
  set('geom-Db1', geom.Db1);
  set('geom-Db2', geom.Db2);
  set('geom-doorGap', geom.doorGap);
  set('geom-packingPos', geom.packingPos);
  set('geom-airGap', geom.airGap);
  set('geom-walls-freezer-top', geom.walls.freezer.top);
  set('geom-walls-freezer-bottom', geom.walls.freezer.bottom);
  set('geom-walls-freezer-left', geom.walls.freezer.left);
  set('geom-walls-freezer-right', geom.walls.freezer.right);
  set('geom-walls-freezer-door', geom.walls.freezer.door);
  set('geom-walls-freezer-rear', geom.walls.freezer.rear);
  set('geom-walls-refrigerator-top', geom.walls.refrigerator.top);
  set('geom-walls-refrigerator-bottom1', geom.walls.refrigerator.bottom1);
  set('geom-walls-refrigerator-bottom2', geom.walls.refrigerator.bottom2);
  set('geom-walls-refrigerator-bottom3', geom.walls.refrigerator.bottom3);
  set('geom-walls-refrigerator-left', geom.walls.refrigerator.left);
  set('geom-walls-refrigerator-right', geom.walls.refrigerator.right);
  set('geom-walls-refrigerator-rear', geom.walls.refrigerator.rear);
  set('geom-walls-refrigerator-door', geom.walls.refrigerator.door);
}

function getEffectiveThicknesses() {
  const g = currentGeometry;
  return {
    top: Math.max(g.walls.freezer.top, g.walls.refrigerator.top),
    bottom: Math.max(g.walls.freezer.bottom, g.walls.refrigerator.bottom1, g.walls.refrigerator.bottom2, g.walls.refrigerator.bottom3),
    left: Math.max(g.walls.freezer.left, g.walls.refrigerator.left),
    right: Math.max(g.walls.freezer.right, g.walls.refrigerator.right),
    rear: Math.max(g.walls.freezer.rear, g.walls.refrigerator.rear),
    door: Math.max(g.walls.freezer.door, g.walls.refrigerator.door),
  };
}

// ---- Mark schematic dirty ---------------------------------------------
function markDirty() {
  dirtySchematic = true;
  if (settings.showDirtyOverlay) {
    schematicOverlay.classList.remove('hidden');
  } else {
    schematicOverlay.classList.add('hidden');
  }
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', markDirty));

// ---- Compartment builder (unchanged) ----------------------------------
numCompartmentsInput.addEventListener('input', () => {
  markDirty();
  buildCompartmentUI();
});

buildCompartmentUI();
writeGeometryToPanel(currentGeometry);
initThermoUI(() => {
  // Ensure the thermo UI reads the latest geometry from the shared panel
  return readGeometryFromPanel();
});
function buildCompartmentUI() {
  const count = Math.max(1, Math.min(2, parseInt(numCompartmentsInput.value) || 1));
  compartmentBuilder.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const fieldset = document.createElement('fieldset');
    fieldset.innerHTML = `
      <legend>Compartment ${i + 1}</legend>
      <label>Type:
        <select data-comp="${i}" data-field="type">
          <option value="freezer">Freezer</option>
          <option value="fresh">Fresh</option>
        </select>
      </label>
      <label>Height Ratio (0-1):
        <input type="number" data-comp="${i}" data-field="heightRatio" step="0.01" min="0.01" max="1" value="${i === 0 ? 0.4 : 0.6}">
      </label>
    `;
    compartmentBuilder.appendChild(fieldset);
  }
}
// ---- Add fitting helpers (with remove buttons) ------------------------


// ---- Build CabinetConfig from DOM -------------------------------------
function buildConfigFromForm() {
  currentGeometry = readGeometryFromPanel();
  const volumeGeom = toVolumeFormat(currentGeometry);

  const count = parseInt(numCompartmentsInput.value) || 1;
  const leaves = [];

  for (let i = 0; i < count; i++) {
    const typeSelect = compartmentBuilder.querySelector(`select[data-comp="${i}"][data-field="type"]`);
    const heightRatioInput = compartmentBuilder.querySelector(`input[data-comp="${i}"][data-field="heightRatio"]`);
    const compType = typeSelect.value;
    const heightRatio = parseFloat(heightRatioInput.value) || (i === 0 ? 0.4 : 0.6);

    leaves.push({
      heightMode: 'ratio',
      heightValue: heightRatio,
      node: {
        nodeType: 'leaf',
        id: `comp${i}`,
        type: compType,
        fittings: {
          shelves: [],
          drawers: [],
          doorBins: [],
          iceMakerHousing: { volume: null },
          lightHousing:    { volume: null },
        },
      },
    });
  }

  // Normalise ratios
  const totalRatio = leaves.reduce((s, l) => s + l.heightValue, 0);
  if (totalRatio > 0) leaves.forEach(l => l.heightValue /= totalRatio);

  const rootNode = {
    nodeType: 'horizontal',
    id: 'root',
    children: leaves.map(l => ({ heightMode: l.heightMode, heightValue: l.heightValue, node: l.node })),
    dividers: Array.from({ length: leaves.length - 1 }, (_, i) => ({
      afterChildIndex: i,
      thickness: parseFloat(divHorizInput.value) || 20,
    })),
  };

  const cabinet = {
    external: volumeGeom.external,
    wallThicknessesByType: volumeGeom.wallThicknessesByType,
    airGap: currentGeometry.airGap,
    layout: rootNode,
  };

  return {
    config: {
      schemaVersion: '2.0',
      meta: { name: 'UI Config', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      cabinet
    },
    layout: rootNode
  };
}
// ---- Populate from loaded config --------------------------------------
function populateUIFromConfig(config) {
  if (!config.cabinet.geometry && config.cabinet.external) {
    config = upgradeConfig(config);
  }
  currentGeometry = config.cabinet.geometry;
  writeGeometryToPanel(currentGeometry);

  const layout = config.cabinet.layout;
  if (layout.nodeType !== 'horizontal') return;

  const compartmentCount = layout.children.length;
  numCompartmentsInput.value = compartmentCount;
  buildCompartmentUI();

  for (let i = 0; i < compartmentCount; i++) {
    const child = layout.children[i];
    const compIdx = i;

    const heightRatioInput = document.querySelector(`input[data-comp="${compIdx}"][data-field="heightRatio"]`);
    if (heightRatioInput) heightRatioInput.value = child.heightValue;

    const typeSelect = document.querySelector(`select[data-comp="${compIdx}"][data-field="type"]`);
    if (typeSelect && child.node) {
      if (child.node.nodeType === 'leaf') {
        typeSelect.value = child.node.type;
      } else if (child.node.nodeType === 'vertical') {
        // Legacy support – take left side type
        typeSelect.value = child.node.left.type;
      }
    }
  }
}


// ---- Display messages, Calculate, Save/Load/Export, etc. (unchanged from previous) ----
// (I'll include the rest of main.js after this block to keep the file complete)
// The code below is identical to your previous working version, with the only change being
// that drawSchematic now takes effectiveWalls as second argument.

// ---- Display messages -------------------------------------------------
function showMessages(errors, warnings, calcErrors) {
  messagesDiv.innerHTML = '';
  const all = [
    ...errors.map(e => `<p class="error">❌ ${e.message}</p>`),
    ...warnings.map(w => `<p class="warning">⚠️ ${w.message}</p>`),
    ...calcErrors.map(e => `<p class="error">🔧 ${e.message}</p>`),
  ];
  if (all.length) {
    messagesDiv.innerHTML = all.join('');
    messagesFieldset.style.display = 'block';
  } else {
    messagesFieldset.style.display = 'none';
  }
}
calculateBtn.addEventListener('click', () => {
  const { config, layout } = buildConfigFromForm();
  currentConfig = config;
  // …

  const result = runCalculation(config);

  if (result.leaves && result.totals) {
    // ----- Compressor box subtraction -----
    const internalWidth = result.leaves[0].space.width;  // all leaves share same width
    const compressorBoxVolL = internalWidth
                            * currentGeometry.Db2
                            * currentGeometry.Hb
                            * settings.mm3ToL;

    if (result.leaves.length > 0) {
      const bottomLeaf = result.leaves[result.leaves.length - 1];
      bottomLeaf.gross -= compressorBoxVolL;
      result.totals.gross -= compressorBoxVolL;
    }

    // ----- Display -----
    const disp = formatTotalsDisplay(result.totals);
    document.getElementById('grossVol').textContent      = disp.gross;
    document.getElementById('grossVolCuft').textContent  = disp.grossCuft;

    const usableFactor = parseFloat(usableFactorInput?.value) || 97;
    const usableL = result.totals.gross * (usableFactor / 100);
    const usableCuft = usableL * settings.lToCuft;
    document.getElementById('usableVol').textContent      = roundForDisplay(usableL, 'L');
    document.getElementById('usableVolCuft').textContent  = roundForDisplay(usableCuft, 'cuft');
  }

  showMessages(result.validationErrors, result.warnings, result.calcErrors);
const frontCanvas = document.getElementById('schematicFront');
const sideCanvas  = document.getElementById('schematicSide');

const rightPanel = document.querySelector('.right-panel');
const panelHeight = rightPanel.clientHeight - 30;   // leave some padding
const panelWidth  = rightPanel.clientWidth - 20;

if (frontCanvas && sideCanvas) {
  // Set both canvases to the same height, width split equally
  frontCanvas.height = panelHeight;
  sideCanvas.height  = panelHeight;
  frontCanvas.width  = panelWidth / 2 - 5;
  sideCanvas.width   = panelWidth / 2 - 5;

  const effectiveWalls = getEffectiveThicknesses();
  drawFrontView(frontCanvas, currentGeometry, effectiveWalls, layout, result.leaves);
  drawSideView(sideCanvas, currentGeometry, effectiveWalls);
  dirtySchematic = false;
  schematicOverlay.classList.add('hidden');
}
}
);

// ---- Save / Load / Export ---------------------------------------------
saveBtn.addEventListener('click', () => {
  if (!currentConfig) { alert('Calculate first'); return; }
  downloadConfigJSON(currentConfig, currentConfig.meta.name);
});

loadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const config = await loadConfigFromFile(file);
      currentConfig = config;
      if (currentConfig) {
        storeSlotABtn.style.display = 'inline-block';
        storeSlotBBtn.style.display = 'inline-block';
        compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';
      }
      populateUIFromConfig(config);

      const result = runCalculation(config);
      const loadedLayout = config.cabinet.layout;
      if (result.leaves && result.totals) {
        const disp = formatTotalsDisplay(result.totals);
        document.getElementById('grossVol').textContent      = disp.gross;
        document.getElementById('grossVolCuft').textContent  = disp.grossCuft;

        const usableFactor = parseFloat(usableFactorInput?.value) || 97;
        const usableL = result.totals.gross * (usableFactor / 100);
        const usableCuft = usableL * settings.lToCuft;
        document.getElementById('usableVol').textContent      = roundForDisplay(usableL, 'L');
        document.getElementById('usableVolCuft').textContent  = roundForDisplay(usableCuft, 'cuft');
      }
      showMessages(result.validationErrors, result.warnings, result.calcErrors);

const frontCanvas = document.getElementById('schematicFront');
const sideCanvas  = document.getElementById('schematicSide');

const rightPanel = document.querySelector('.right-panel');
const panelHeight = rightPanel.clientHeight - 30;   // leave some padding
const panelWidth  = rightPanel.clientWidth - 20;

if (frontCanvas && sideCanvas) {
  // Set both canvases to the same height, width split equally
  frontCanvas.height = panelHeight;
  sideCanvas.height  = panelHeight;
  frontCanvas.width  = panelWidth / 2 - 5;
  sideCanvas.width   = panelWidth / 2 - 5;

  const effectiveWalls = getEffectiveThicknesses();
  drawFrontView(frontCanvas, currentGeometry, effectiveWalls, loadedLayout, result.leaves);
  drawSideView(sideCanvas, currentGeometry, effectiveWalls);
  dirtySchematic = false;
  schematicOverlay.classList.add('hidden');
}

      
      alert('Configuration loaded and calculated.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };
  input.click();
});

exportBtn.addEventListener('click', () => {
  if (!currentConfig) { alert('Calculate first'); return; }
  const result = runCalculation(currentConfig);
  downloadResultsCSV(result, currentConfig.meta.name);
});

// ---- Settings Modal --------------------------------------------------
initSettingsModal();
settingsBtn.addEventListener('click', showModal);

// ---- Reset All ---------------------------------------------------------
resetAllBtn.addEventListener('click', () => {
  if (!confirm('Reset all fields to default values and clear results?')) return;

  currentGeometry = { ...DEFAULT_CABINET };
  writeGeometryToPanel(currentGeometry);

  divHorizInput.value = 20;
  numCompartmentsInput.value = 2;
  storeSlotABtn.style.display = 'none';
  storeSlotBBtn.style.display = 'none';
  compareSlotsBtn.style.display = 'none';
  configSlotA = null;
  configSlotB = null;

  buildCompartmentUI();

  document.getElementById('grossVol').textContent      = '--';
  document.getElementById('grossVolCuft').textContent  = '--';
  document.getElementById('usableVol').textContent      = '--';
  document.getElementById('usableVolCuft').textContent  = '--';

  messagesDiv.innerHTML = '';
  messagesFieldset.style.display = 'none';

const frontCanvas = document.getElementById('schematicFront');
const sideCanvas  = document.getElementById('schematicSide');
if (frontCanvas) {
  const ctx = frontCanvas.getContext('2d');
  ctx.clearRect(0, 0, frontCanvas.width, frontCanvas.height);
}
if (sideCanvas) {
  const ctx = sideCanvas.getContext('2d');
  ctx.clearRect(0, 0, sideCanvas.width, sideCanvas.height);
}
});
// ---- Auto‑calculate & settings change handler ------------------------
document.addEventListener('input', (e) => {
  if (settings.autoCalculate && e.target.closest('.left-panel')) {
    calculateBtn.click();
  }
});

document.addEventListener('settings-changed', () => {
  if (settings.autoCalculate && currentConfig) {
    calculateBtn.click();
  } else {
    markDirty();
  }
});

// ---- Slot storage -----------------------------------------------------
storeSlotABtn.addEventListener('click', () => {
  if (!currentConfig) return;
  configSlotA = JSON.parse(JSON.stringify(currentConfig));
  alert('Configuration stored in Slot A.');
  compareSlotsBtn.style.display = 'inline-block';
});

storeSlotBBtn.addEventListener('click', () => {
  if (!currentConfig) return;
  configSlotB = JSON.parse(JSON.stringify(currentConfig));
  alert('Configuration stored in Slot B.');
  compareSlotsBtn.style.display = 'inline-block';
});

// ---- Compare Slots ----------------------------------------------------
compareSlotsBtn.addEventListener('click', () => {
  if (!configSlotA && !configSlotB) {
    alert('No stored configurations to compare.');
    return;
  }
  let resultA = null, resultB = null;
  if (configSlotA) resultA = runCalculation(configSlotA);
  if (configSlotB) resultB = runCalculation(configSlotB);
  buildComparisonTable(resultA, resultB);
  comparisonModal.classList.remove('hidden');
});

closeComparison.addEventListener('click', () => { comparisonModal.classList.add('hidden'); });
window.addEventListener('click', (e) => { if (e.target === comparisonModal) comparisonModal.classList.add('hidden'); });

function buildComparisonTable(resultA, resultB) {
  if (!resultA && !resultB) { comparisonContent.innerHTML = '<p>No configurations stored.</p>'; return; }
  const hasLeavesA = resultA && resultA.leaves && resultA.totals;
  const hasLeavesB = resultB && resultB.leaves && resultB.totals;
  const fmtTotals = (totals) => {
    if (!totals) return { gross:'-', usable:'-', grossCuft:'-', usableCuft:'-' };
    const usableFactor = parseFloat(usableFactorInput?.value) || 97;
    return {
      gross: roundForDisplay(totals.gross, 'L'),
      usable: roundForDisplay(totals.gross * (usableFactor / 100), 'L'),
      grossCuft: roundForDisplay(totals.gross * settings.lToCuft, 'cuft'),
      usableCuft: roundForDisplay(totals.gross * (usableFactor / 100) * settings.lToCuft, 'cuft'),
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
    html += `<h3>Per‑Compartment Breakdown</h3>`;
    const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
    html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <tr><th>Compartment</th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Gross</th><th>Usable</th><th>Gross</th><th>Usable</th></tr>`;
    for (let i = 0; i < maxLeaves; i++) {
      const leafA = resultA.leaves[i], leafB = resultB.leaves[i];
      const fmtA = leafA ? {
        gross: roundForDisplay(leafA.gross, 'L'),
        usable: roundForDisplay(leafA.gross * (parseFloat(usableFactorInput?.value) || 97) / 100, 'L'),
      } : { gross:'-', usable:'-' };
      const fmtB = leafB ? {
        gross: roundForDisplay(leafB.gross, 'L'),
        usable: roundForDisplay(leafB.gross * (parseFloat(usableFactorInput?.value) || 97) / 100, 'L'),
      } : { gross:'-', usable:'-' };
      html += `<tr><td>Comp ${i+1}</td><td>${fmtA.gross}</td><td>${fmtA.usable}</td><td>${fmtB.gross}</td><td>${fmtB.usable}</td></tr>`;
    }
    html += `</table>`;
  }
  comparisonContent.innerHTML = html;
}