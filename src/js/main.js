import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawFrontView, drawSideView, enableCoordinateTooltip } from './ui/schematic.js';   // ← now imported from the same module
import { initSettingsModal } from './ui/settingsModal.js';
import { settings, updateSettings } from './settings.js';
import { formatTotalsDisplay, roundForDisplay } from './engine/calc.js';
import { initThermoUI } from './ui/thermoUI.js';
import { DEFAULT_CABINET, toVolumeFormat, toThermalFormat, upgradeConfig } from './engine/geometry.js';

// Load settings from localStorage on startup
updateSettings(settings);

// ---- DOM references ---------------------------------------------------
const divHorizInput       = document.getElementById('divHoriz');
const evapDepthInput      = document.getElementById('evapDepth');
const ctrlBoxHInput       = document.getElementById('ctrlBoxH');
const ctrlBoxWInput       = document.getElementById('ctrlBoxW');
const ctrlBoxLInput       = document.getElementById('ctrlBoxL');
const rshowerHInput       = document.getElementById('rshowerH');
const rshowerWInput       = document.getElementById('rshowerW');
const rshowerLInput       = document.getElementById('rshowerL');
const rshowerGroup        = document.getElementById('rshowerGroup');
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
const splitter            = document.getElementById('splitter');
const leftPanel           = document.querySelector('.left-panel');

let configSlotA = null;
let configSlotB = null;
let currentConfig = null;
let dirtySchematic = false;
let isResizing = false;
let startX, startWidth;

// Splitter logic (unchanged)
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

// ---- Shared cabinet geometry ------------------------------------------
let currentGeometry = { ...DEFAULT_CABINET };

// ---- Compartment reactive state ---------------------------------------
let compartmentsData = [];

fillGeometryDefaults();

// Dedicated listeners for geometry fields that affect internal height
['geom-H', 'geom-bottom3'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    syncConstraints();
    syncDisplay();
    markDirty();
  });
});

// Divider thickness changes also affect compartment heights
divHorizInput.addEventListener('input', () => {
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
      type: i === 0 ? 'freezer' : 'fresh',
      ...defaultWalls,
      height: 0,
      ratio: i === 0 ? 0.4 : 0.6,
      shelfCount: 0,               // ← NEW
    });
  }
  syncConstraints();
  buildCompartmentUI();
  updateRShowerVisibility();
}

function syncConstraints() {
  const count = compartmentsData.length;
  const H = parseFloat(document.getElementById('geom-H')?.value) || 1680;
  const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;
  const totalInsulTop = compartmentsData[0].top;
  const totalInsulBottom = parseFloat(document.getElementById('geom-bottom3')?.value) || 40;
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
    compartmentsData[0].ratio = 1.0;
    return;
  }
  if (count === 2) {
    compartmentsData[1].top = dividerThick;
  }

  // Two compartments
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
  if (field === 'type') {
    compartmentsData[compIdx].type = value;
    if (compartmentsData.length > 1) {
      const otherIdx = 1 - compIdx;
      compartmentsData[otherIdx].type = (value === 'freezer' ? 'fresh' : 'freezer');
      updateRShowerVisibility();
    }
    syncDisplay();
    if (settings.autoCalculate) calculateBtn.click();
    return;
  }

  if (isNaN(value)) return;
  compartmentsData[compIdx][field] = value;

  if (field === 'height' || field === 'ratio') {
    const count = compartmentsData.length;
    const H = parseFloat(document.getElementById('geom-H')?.value) || 1680;
    const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;
    const topInsul = compartmentsData[0].top;
    const bottomInsul = parseFloat(document.getElementById('geom-bottom3')?.value) || 40;
    const internalH = H - topInsul - bottomInsul - (count - 1) * dividerThick;

    if (count === 1) {
      compartmentsData[0].height = internalH;
      compartmentsData[0].ratio = 1.0;
    } else {
      if (field === 'height') {
        const minH = 0.1 * internalH;
        const maxH = 0.9 * internalH;
        let clamped = Math.max(minH, Math.min(maxH, value));
        compartmentsData[compIdx].height = clamped;
        const otherIdx = 1 - compIdx;
        compartmentsData[otherIdx].height = internalH - clamped;
        compartmentsData[0].ratio = compartmentsData[0].height / internalH;
        compartmentsData[1].ratio = 1.0 - compartmentsData[0].ratio;
      } else {
        let percent = Math.max(10, Math.min(count === 1 ? 100 : 90, value));
        let clamped = percent / 100;
        compartmentsData[compIdx].ratio = clamped;
        compartmentsData[compIdx].height = internalH * clamped;
        const otherIdx = 1 - compIdx;
        compartmentsData[otherIdx].ratio = 1.0 - clamped;
        compartmentsData[otherIdx].height = internalH - compartmentsData[compIdx].height;
      }
    }
  }

  if (field === 'type' && compartmentsData.length > 1) {
    const otherIdx = 1 - compIdx;
    compartmentsData[otherIdx].type = value === 'freezer' ? 'fresh' : 'freezer';
  }

  syncDisplay();
  if (settings.autoCalculate) calculateBtn.click();
}

function syncDisplay() {
  const count = compartmentsData.length;
  for (let i = 0; i < count; i++) {
    const d = compartmentsData[i];
    const heightInput = document.getElementById(`comp-${i}-height`);
    const ratioInput  = document.getElementById(`comp-${i}-ratio`);
    const typeSelect  = document.getElementById(`comp-${i}-type`);
    if (heightInput) heightInput.value = d.height.toFixed(1);
    if (ratioInput) {
      ratioInput.value = count === 1 ? 100 : (d.ratio * 100).toFixed(0);
    }
    if (typeSelect) typeSelect.value = d.type;
    const topInput = document.getElementById(`comp-${i}-top`);
    if (topInput) topInput.value = compartmentsData[i].top.toFixed(1);
    const shelfCountInput = document.getElementById(`comp-${i}-shelfCount`);
    if (shelfCountInput) shelfCountInput.value = d.shelfCount || 2;
  }
}

function buildCompartmentUI() {
  const builder = document.getElementById('compartmentBuilder');
  builder.innerHTML = '';

  const count = compartmentsData.length;
  const dividerLabel = document.getElementById('dividerLabel');
  if (dividerLabel) dividerLabel.style.display = count > 1 ? '' : 'none';

  for (let i = 0; i < count; i++) {
    const d = compartmentsData[i];
    const ratioMin = count === 1 ? 100 : 10;
    const ratioMax = count === 1 ? 100 : 90;
    const ratioVal = count === 1 ? 100 : Math.round(d.ratio * 100);

    const fieldset = document.createElement('fieldset');
    fieldset.innerHTML = `
      <legend>Compartment ${i+1}</legend>
      <label>Type:
        <select id="comp-${i}-type">
          <option value="freezer" ${d.type === 'freezer' ? 'selected' : ''}>Freezer</option>
          <option value="fresh"  ${d.type === 'fresh'  ? 'selected' : ''}>Fresh</option>
        </select>
      </label>
      <label>Height (mm): <input type="number" id="comp-${i}-height" step="any" value="${d.height.toFixed(1)}"></label>
      <label>Ratio (%): <input type="number" id="comp-${i}-ratio" step="1" min="${ratioMin}" max="${ratioMax}" value="${ratioVal}"></label>
      <!-- NEW shelf count input -->
      <label>Number of Shelves: <input type="number" id="comp-${i}-shelfCount" min="0" step="1" value="${d.shelfCount || 2}"></label>
      <fieldset>
        <legend>Wall Thicknesses (mm)</legend>
        ${ count === 1 || i === 0 ? `<label>Top: <input type="number" id="comp-${i}-top" value="${d.top}" step="any"></label>` : '' }
        <label>Left:   <input type="number" id="comp-${i}-left"   value="${d.left}"   step="any"></label>
        <label>Right:  <input type="number" id="comp-${i}-right"  value="${d.right}"  step="any"></label>
        <label>Rear:   <input type="number" id="comp-${i}-rear"   value="${d.rear}"   step="any"></label>
        <label>Door:   <input type="number" id="comp-${i}-door"   value="${d.door}"   step="any"></label>
      </fieldset>
    `;
    builder.appendChild(fieldset);
  }

  // Attach listeners
  for (let i = 0; i < count; i++) {
    document.getElementById(`comp-${i}-type`).addEventListener('change', (e) => {
      onCompFieldChange(i, 'type', e.target.value);
    });
    document.getElementById(`comp-${i}-height`).addEventListener('change', (e) => {
      onCompFieldChange(i, 'height', parseFloat(e.target.value) || 0);
    });
    document.getElementById(`comp-${i}-ratio`).addEventListener('change', (e) => {
      onCompFieldChange(i, 'ratio', parseFloat(e.target.value) || 10);
    });
    for (const face of ['top','left','right','rear','door']) {
      const el = document.getElementById(`comp-${i}-${face}`);
      if (!el) continue;
      el.addEventListener('input', (e) => {
        compartmentsData[i][face] = parseFloat(e.target.value) || 0;
        syncConstraints();
        syncDisplay();
        markDirty();
      });
    }
  
    const shelfCountEl = document.getElementById(`comp-${i}-shelfCount`);
  if (shelfCountEl) {
    shelfCountEl.addEventListener('input', (e) => {
      const val = parseInt(e.target.value) || 0;
      compartmentsData[i].shelfCount = Math.max(0, val);
      if (settings.autoCalculate) calculateBtn.click();
    });
  }
}
}

function fillGeometryDefaults() {
  const def = DEFAULT_CABINET;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('geom-H', def.H);
  set('geom-W', def.W);
  set('geom-D', def.D);
  set('geom-Hb', def.Hb);
  set('geom-Db1', def.Db1);
  set('geom-Db2', def.Db2);
  set('geom-packingPos', def.packingPos);
  set('geom-doorGap', def.doorGap);
  set('geom-bottom1', 40);
  set('geom-bottom2', 40);
  set('geom-bottom3', 40);
  set('geom-railHeight', 20);
  set('geom-railWidth', 10);
  set('geom-railDepthPct', 50);
  set('geom-doorDikeHeight', 50);
  set('geom-doorDikeBaseWidth', 30);
  set('geom-doorDikeTopWidth', 15);
}

// ---- Read geometry from panel -----------------------------------------
function readGeometryFromPanel() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
  const comps = compartmentsData;
  const count = comps.length;
  const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;

  let freezerComp = comps.find(c => c.type === 'freezer');
  let freshComp   = comps.find(c => c.type === 'fresh');

  const defWalls = { top: 60, left: 60, right: 60, rear: 60, door: 60 };

  const walls = {
    freezer: {
      top:    freezerComp ? freezerComp.top    : defWalls.top,
      bottom: freshComp   ? dividerThick       : 0,
      left:   freezerComp ? freezerComp.left   : defWalls.left,
      right:  freezerComp ? freezerComp.right  : defWalls.right,
      door:   freezerComp ? freezerComp.door   : defWalls.door,
      rear:   freezerComp ? freezerComp.rear   : defWalls.rear,
    },
    refrigerator: {
      top:    freshComp ? (freezerComp ? dividerThick : freshComp.top) : defWalls.top,
      bottom1: g('geom-bottom1') ?? 40,
      bottom2: g('geom-bottom2') ?? 40,
      bottom3: g('geom-bottom3') ?? 40,
      left:   freshComp ? freshComp.left   : defWalls.left,
      right:  freshComp ? freshComp.right  : defWalls.right,
      door:   freshComp ? freshComp.door   : defWalls.door,
      rear:   freshComp ? freshComp.rear   : defWalls.rear,
    }
  };

  return {
    H: g('geom-H') ?? DEFAULT_CABINET.H,
    W: g('geom-W') ?? DEFAULT_CABINET.W,
    D: g('geom-D') ?? DEFAULT_CABINET.D,
    Hb: g('geom-Hb') ?? DEFAULT_CABINET.Hb,
    Db1: g('geom-Db1') ?? DEFAULT_CABINET.Db1,
    Db2: g('geom-Db2') ?? DEFAULT_CABINET.Db2,
    doorGap: g('geom-doorGap') ?? DEFAULT_CABINET.doorGap,
    packingPos: g('geom-packingPos') ?? DEFAULT_CABINET.packingPos,
    airGap: 0,
    Hf: freezerComp ? freezerComp.height : 0,
    Hr: freshComp   ? freshComp.height   : 0,
    walls,
    special: {
      railHeight:    g('geom-railHeight')    ?? 20,
      railWidth:     g('geom-railWidth')     ?? 10,
      railDepthPct:  g('geom-railDepthPct')  ?? 50,
      doorDikeHeight: g('geom-doorDikeHeight') ?? 50,
      doorDikeBaseWidth: g('geom-doorDikeBaseWidth') ?? 30,
      doorDikeTopWidth:  g('geom-doorDikeTopWidth')  ?? 15,
    },
    _compartments: comps
  };
}

function getEffectiveThicknesses() {
  const comps = compartmentsData;
  const topComp = comps[0];
  const bottomComp = comps.length > 1 ? comps[1] : comps[0];
  const bottom1 = parseFloat(document.getElementById('geom-bottom1')?.value) || 40;
  const bottom2 = parseFloat(document.getElementById('geom-bottom2')?.value) || 40;
  const bottom3 = parseFloat(document.getElementById('geom-bottom3')?.value) || 40;

  return {
    top:    topComp.top,
    bottom: Math.max(bottom1, bottom2, bottom3),
    left:   Math.max(topComp.left, bottomComp.left),
    right:  Math.max(topComp.right, bottomComp.right),
    rear:   Math.max(topComp.rear, bottomComp.rear),
    door:   Math.max(topComp.door, bottomComp.door),
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

// ---- Compartment builder init -----------------------------------------
numCompartmentsInput.addEventListener('input', () => {
  markDirty();
  initCompartments();
});

// ---- Volume calculation -----------------------------------------------
function buildConfigFromForm() {
  currentGeometry = readGeometryFromPanel();
  const volumeGeom = toVolumeFormat(currentGeometry);

  const count = compartmentsData.length;
  const leaves = [];

  for (let i = 0; i < count; i++) {
    const comp = compartmentsData[i];
    leaves.push({
      heightMode: 'ratio',
      heightValue: comp.ratio,
      node: {
        nodeType: 'leaf',
        id: `comp${i}`,
        type: comp.type,
        fittings: {
          // Use simple count if specified, otherwise keep empty shelves array
          ...(comp.shelfCount > 0
            ? { shelfCount: comp.shelfCount }
            : { shelves: [] }),
          drawers: [],
          doorBins: [],
          iceMakerHousing: { volume: null },
          lightHousing:    { volume: null },
        },
      },
    });
  }

  const rootNode = {
    nodeType: 'horizontal',
    id: 'root',
    children: leaves.map(l => ({ heightMode: l.heightMode, heightValue: l.heightValue, node: l.node })),
    dividers: count > 1 ? [{ afterChildIndex: 0, thickness: parseFloat(divHorizInput.value) || 20 }] : [],
  };

  const cabinet = {
    geometry: currentGeometry,
    layout: rootNode
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

function computeAccurateBottomVolume(geom, eff) {
  const { H, D, Hb, Db1, Db2, walls } = geom;
  const rearX = eff.rear;
  const doorX = D - eff.rear;                  // if D is body depth (no door) – required
  const slopeStartX = Db1;                     // Db1 is distance from exterior rear
  const slopeEndX   = Db2;                     // same for Db2
  const innerTop = eff.top;

  const topCompH = compartmentsData.length > 1 ? compartmentsData[0].height : 0;
  const divider  = compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0;
  const yTopBottom = innerTop + topCompH + divider;

  const yBottomRear = H - Hb - walls.refrigerator.bottom1;
  const yBottomDoor = H - walls.refrigerator.bottom3;

  const points = [
    [rearX,        yTopBottom],
    [doorX,        yTopBottom],
    [doorX,        yBottomDoor],
    [slopeEndX,    yBottomDoor],
    [slopeStartX,  yBottomRear],
    [rearX,        yBottomRear]
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
// Show/hide R‑Shower section based on presence of a fresh compartment
function updateRShowerVisibility() {
  const hasFresh = compartmentsData.some(c => c.type === 'fresh');
  rshowerGroup.style.display = hasFresh ? '' : 'none';
}

// Calculate total subtracted volume from the three elements (in litres)
function computeSubtractedVolumes() {
  const evapDepth = parseFloat(evapDepthInput.value) || 85;
  const ctrlH = parseFloat(ctrlBoxHInput.value) || 150;
  const ctrlW = parseFloat(ctrlBoxWInput.value) || 500;
  const ctrlL = parseFloat(ctrlBoxLInput.value) || 100;
  const rshowerH = parseFloat(rshowerHInput.value) || 700;
  const rshowerW = parseFloat(rshowerWInput.value) || 500;
  const rshowerL = parseFloat(rshowerLInput.value) || 50;

  // Find the freezer compartment (or use the only one)
  let freezerIdx = 0;
  if (compartmentsData.length > 1) {
    freezerIdx = compartmentsData.findIndex(c => c.type === 'freezer');
    if (freezerIdx === -1) freezerIdx = 0;
  }
  const f = compartmentsData[freezerIdx];
  const internalHeight = f.height;
  const internalWidth = currentGeometry.W - f.left - f.right;

  const evapVol = evapDepth * internalHeight * internalWidth;       // mm³
  const ctrlVol = ctrlH * ctrlW * ctrlL;                            // mm³
  const rshowerVol = rshowerH * rshowerW * rshowerL;                // mm³

  return (evapVol + ctrlVol + rshowerVol) * settings.mm3ToL;
}
function displayVolumeResults(result) {
  if (!result.leaves || !result.totals) return;

  const eff = getEffectiveThicknesses();
  const bottomIdx = result.leaves.length - 1;
  const accurateBottomVol = computeAccurateBottomVolume(currentGeometry, eff);

  const bottomLeaf = result.leaves[bottomIdx];
  const oldBottomVol = bottomLeaf.gross;
  bottomLeaf.gross = accurateBottomVol;
  result.totals.gross = result.totals.gross - oldBottomVol + accurateBottomVol;

  // ---- Extract geometry & special parameters ----
  const geometry = currentGeometry;
  const special = geometry.special || {};
  const railHeight = special.railHeight || 0;
  const railWidth = special.railWidth || 0;
  const railDepthPct = (special.railDepthPct || 0) / 100;
  const dikeHeight = special.doorDikeHeight || 0;
  const dikeBaseWidth = special.doorDikeBaseWidth || 0;
  const dikeTopWidth = special.doorDikeTopWidth || 0;

  const internalDepth = geometry.D - eff.rear - eff.door;
  const innerWidth = geometry.W - eff.left - eff.right;

  // ---- 1. Subtract rail & dike volumes from compartment gross volumes ----
  let totalSubtracted = 0;
  const dikeVolumes = [];   // store mm³ for later use in door PU

  for (let i = 0; i < result.leaves.length; i++) {
    const leaf = result.leaves[i];
    const comp = compartmentsData[i];
    const shelfCount = comp.shelfCount || 0;

    // Rails (two per shelf)
    const railVol = railHeight * railWidth * railDepthPct * internalDepth * shelfCount * 2;

    // Dike around this compartment's door opening (perimeter = 2*(innerWidth + comp.height))
    const dikeVol = dikeHeight * (dikeBaseWidth + dikeTopWidth) / 2 *
                    2 * (innerWidth + comp.height);
    dikeVolumes.push(dikeVol);

    const subtractVol = (railVol + dikeVol) * settings.mm3ToL;
    leaf.gross = Math.max(0, leaf.gross - subtractVol);
    totalSubtracted += subtractVol;
  }

  // Recalculate total gross after subtractions
  result.totals.gross = result.leaves.reduce((sum, leaf) => sum + leaf.gross, 0);

  // ---- 2. Total usable volume (after further subtracted elements) ----
  const subtractedL = computeSubtractedVolumes();
  const totalL = Math.max(0, result.totals.gross - subtractedL);
  const totalCuft = totalL * settings.lToCuft;

  // ---- 3. Compute door PU volumes (insulation + dike) ----
  let FDoorPUVolL = 0;
  let RDoorPUVolL = 0;

  for (let i = 0; i < compartmentsData.length; i++) {
    const comp = compartmentsData[i];
    const doorThickness = comp.door || 0;        // mm
    const compHeight = comp.height;              // mm

    // Flat part of the door insulation
    const baseDoorVol = doorThickness * compHeight * innerWidth * settings.mm3ToL;

    // Total door volume = flat insulation + dike
    const totalDoorVol = baseDoorVol + dikeVolumes[i] * settings.mm3ToL;

    if (comp.type === 'freezer') {
      FDoorPUVolL = totalDoorVol;
    } else if (comp.type === 'fresh') {
      RDoorPUVolL = totalDoorVol;
    }
  }

  // ---- 4. Cabinet body PU volume (all walls except doors) ----
  // Approximate using external volume minus internal volume minus door volumes
  const externalBoxVol = geometry.H * geometry.W * geometry.D;                     // mm³
  const cutoutVol = geometry.Hb * (geometry.Db1 + geometry.Db2) / 2 * geometry.W; // mm³ (wedge approx)
  const externalVol = (externalBoxVol - cutoutVol) * settings.mm3ToL;
  const CabPUVolL = externalVol - result.totals.gross - FDoorPUVolL - RDoorPUVolL;

  // ---- 5. Update the UI ----
  document.getElementById('grossVol').textContent      = roundForDisplay(result.totals.gross, 'L');
  document.getElementById('grossVolCuft').textContent  = roundForDisplay(result.totals.gross * settings.lToCuft, 'cuft');
  document.getElementById('totalVol').textContent      = roundForDisplay(totalL, 'L');
  document.getElementById('totalVolCuft').textContent  = roundForDisplay(totalCuft, 'cuft');

  document.getElementById('cabpuVol').textContent      = roundForDisplay(CabPUVolL, 'L');
  document.getElementById('cabpuVolCuft').textContent  = roundForDisplay(CabPUVolL * settings.lToCuft, 'cuft');
  document.getElementById('cabpuweight').textContent   = roundForDisplay(CabPUVolL * 32 / 1000, 'kg');

  document.getElementById('fdoorpuVol').textContent    = roundForDisplay(FDoorPUVolL, 'L');
  document.getElementById('fdoorpuVolCuft').textContent = roundForDisplay(FDoorPUVolL * settings.lToCuft, 'cuft');
  document.getElementById('fdoorpuweight').textContent = roundForDisplay(FDoorPUVolL * 32 / 1000, 'kg');

  document.getElementById('rdoorpuVol').textContent    = roundForDisplay(RDoorPUVolL, 'L');
  document.getElementById('rdoorpuVolCuft').textContent = roundForDisplay(RDoorPUVolL * settings.lToCuft, 'cuft');
  document.getElementById('rdoorpuweight').textContent = roundForDisplay(RDoorPUVolL * 32 / 1000, 'kg');
}

function drawSchematics(config, leaves) {
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (!frontCanvas || !sideCanvas || !leaves) return;

  const rightPanel = document.querySelector('.right-panel');
  const panelHeight = rightPanel.clientHeight - 30;
  const panelWidth  = rightPanel.clientWidth - 20;
  frontCanvas.height = panelHeight;
  sideCanvas.height  = panelHeight;
  frontCanvas.width  = panelWidth / 2 - 5;
  sideCanvas.width   = panelWidth / 2 - 5;

  const effectiveWalls = getEffectiveThicknesses();
  const fittings = extractFittingsFromLayout(config.cabinet.layout);
  
  const geom = currentGeometry;
  const H = geom.H, D = geom.D;
  const eff = effectiveWalls;
  const innerTopY = eff.top;
  const innerLeftX = eff.left;
  const innerRightX = geom.W - eff.right;
  const innerRearX = eff.rear;
  const doorX = D - eff.rear;
  const innerBottomY = H - Math.max(
    parseFloat(document.getElementById('geom-bottom1')?.value) || 40,
    parseFloat(document.getElementById('geom-bottom2')?.value) || 40,
    parseFloat(document.getElementById('geom-bottom3')?.value) || 40
  );
  // Shelf count per compartment (from compartmentsData)
  const shelfCounts = compartmentsData.map(c => c.shelfCount || 2);

  const drawOptions = {
    dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
    compHeights: compartmentsData.map(c => c.height),
    doorGap: parseFloat(document.getElementById('geom-doorGap')?.value) || 10,
    compartments: compartmentsData.map(c => ({
      left: c.left,
      right: c.right,
      rear: c.rear
    })),
    fittings,
    // New fields
    shelfCounts,
    railHeight: geom.special.railHeight,
    railWidth: geom.special.railWidth,
    railDepthPct: geom.special.railDepthPct,
    dikeHeight: geom.special.doorDikeHeight,
    dikeBaseWidth: geom.special.doorDikeBaseWidth,
    dikeTopWidth: geom.special.doorDikeTopWidth,
    innerTopY,
    innerBottomY,
    innerLeftX,
    innerRightX,
    innerRearX,
    doorX,
    cabinetDepth: D,
    cabinetWidth: geom.W,
    cabinetHeight: H,
    evapDepth: parseFloat(evapDepthInput.value) || 0,
    ctrlBoxH:   parseFloat(ctrlBoxHInput.value) || 0,
    ctrlBoxW:   parseFloat(ctrlBoxWInput.value) || 0,
    ctrlBoxL:   parseFloat(ctrlBoxLInput.value) || 0,
    rshowerH:   parseFloat(rshowerHInput.value) || 0,
    rshowerW:   parseFloat(rshowerWInput.value) || 0,
    rshowerL:   parseFloat(rshowerLInput.value) || 0,
    compartmentTypes: compartmentsData.map(c => c.type),
    numCompartments: compartmentsData.length
  };
  drawFrontView(frontCanvas, currentGeometry, effectiveWalls, config.cabinet.layout, leaves, drawOptions);
  drawSideView(sideCanvas, currentGeometry, effectiveWalls, drawOptions);
  dirtySchematic = false;
  schematicOverlay.classList.add('hidden');
}

// ---- Calculate button -------------------------------------------------
calculateBtn.addEventListener('click', () => {
  const { config, layout } = buildConfigFromForm();
  currentConfig = config;
  if (currentConfig) {
    storeSlotABtn.style.display = 'inline-block';
    storeSlotBBtn.style.display = 'inline-block';
    compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';
  }

  const result = runCalculation(config);

  displayVolumeResults(result);
  showMessages(result.validationErrors, result.warnings, result.calcErrors);
  drawSchematics(config, result.leaves);
});

function extractFittingsFromLayout(node) {
  const fittings = [];
  function walk(n) {
    if (n.nodeType === 'leaf' && n.fittings) {
      const shelves = n.fittings.shelves || [];
      // If using shelfCount, we skip drawing shelves for now
      const safeShelves = n.fittings.shelfCount != null ? [] : shelves;
      fittings.push({
        leafId: n.id,
        type: n.type,
        shelves: safeShelves,
        drawers: n.fittings.drawers || [],
        doorBins: n.fittings.doorBins || []
      });
    }
    if (n.children) n.children.forEach(c => walk(c.node));
  }
  walk(node);
  return fittings;
}

// ---- populateUIFromConfig ---------------------------------------------
function populateUIFromConfig(config) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
  };

  const geometry = config.cabinet?.geometry;

  if (geometry) {
    set('geom-H',          geometry.H);
    set('geom-W',          geometry.W);
    set('geom-D',          geometry.D);
    set('geom-Hb',         geometry.Hb);
    set('geom-Db1',        geometry.Db1);
    set('geom-Db2',        geometry.Db2);
    set('geom-packingPos', geometry.packingPos);
    set('geom-doorGap',    geometry.doorGap);
    set('geom-doorDikeHeight', geometry.doorDikeHeight);
    set('geom-doorDikeBaseWidth', geometry.doorDikeBaseWidth);
    set('geom-doorDikeTopWidth', geometry.doorDikeTopWidth);
    const rw = geometry.walls?.refrigerator;
    if (rw) {
      set('geom-bottom1', rw.bottom1);
      set('geom-bottom2', rw.bottom2);
      set('geom-bottom3', rw.bottom3);
    }

    const savedComps = geometry._compartments;
    if (savedComps?.length > 0) {
      numCompartmentsInput.value = savedComps.length;
      compartmentsData = savedComps.map(c => ({
        ...c,
        shelfCount: c.shelfCount ?? 0,   // fallback for older configs
      }));

      const layout = config.cabinet.layout;
      if (layout?.nodeType === 'horizontal' && layout.dividers?.length > 0) {
        divHorizInput.value = layout.dividers[0].thickness ?? 20;
      }
    } else {
      initCompartments();
    }

    currentGeometry = { ...geometry };
    if (geometry.special) {
      set('geom-railHeight',   geometry.special.railHeight);
      set('geom-railWidth',    geometry.special.railWidth);
      set('geom-railDepthPct', geometry.special.railDepthPct);
      set('geom-doorDikeHeight', geometry.special.doorDikeHeight);
      set('geom-doorDikeBaseWidth', geometry.special.doorDikeBaseWidth);
      set('geom-doorDikeTopWidth', geometry.special.doorDikeTopWidth);
    } else {
      // default values if loading an old config without special geometries
      set('geom-railHeight', 20);
      set('geom-railWidth', 10);
      set('geom-railDepthPct', 50);
      set('geom-doorDikeHeight', 50);
      set('geom-doorDikeBaseWidth', 30);
      set('geom-doorDikeTopWidth', 15);
    }
  } else if (config.cabinet?.external) {
    const ext = config.cabinet.external;
    set('geom-H', ext.height);
    set('geom-W', ext.width);
    set('geom-D', ext.depth);

    const wtt = config.cabinet.wallThicknessesByType;
    if (wtt?.fresh) {
      set('geom-bottom1', wtt.fresh.bottom);
      set('geom-bottom2', wtt.fresh.bottom);
      set('geom-bottom3', wtt.fresh.bottom);
    }

    initCompartments();
    currentGeometry = { ...DEFAULT_CABINET };

  } else {
    console.warn('populateUIFromConfig: unrecognised config structure — UI not restored.');
    return;
  }

  buildCompartmentUI();
  updateRShowerVisibility();
  syncConstraints();
  syncDisplay();
}

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

      storeSlotABtn.style.display = 'inline-block';
      storeSlotBBtn.style.display = 'inline-block';
      compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';

      populateUIFromConfig(config);

      const result = runCalculation(config);
      displayVolumeResults(result);
      showMessages(result.validationErrors, result.warnings, result.calcErrors);
      drawSchematics(config, result.leaves);
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

// ---- Reset All ---------------------------------------------------------
resetAllBtn.addEventListener('click', () => {
  if (!confirm('Reset all fields to default values and clear results?')) return;

  currentGeometry = { ...DEFAULT_CABINET };
  document.getElementById('geom-H').value = DEFAULT_CABINET.H;
  document.getElementById('geom-W').value = DEFAULT_CABINET.W;
  document.getElementById('geom-D').value = DEFAULT_CABINET.D;
  document.getElementById('geom-Hb').value = DEFAULT_CABINET.Hb;
  document.getElementById('geom-Db1').value = DEFAULT_CABINET.Db1;
  document.getElementById('geom-Db2').value = DEFAULT_CABINET.Db2;
  document.getElementById('geom-packingPos').value = DEFAULT_CABINET.packingPos;
  document.getElementById('geom-doorGap').value = DEFAULT_CABINET.doorGap;
  document.getElementById('geom-bottom1').value = 40;
  document.getElementById('geom-bottom2').value = 40;
  document.getElementById('geom-bottom3').value = 40;
  document.getElementById('geom-railHeight').value = 20;
  document.getElementById('geom-railWidth').value = 10;
  document.getElementById('geom-railDepthPct').value = 50;
  document.getElementById('geom-doorDikeHeight').value = 50;
  document.getElementById('geom-doorDikeBaseWidth').value = 30;
  document.getElementById('geom-doorDikeTopWidth').value = 15;
  divHorizInput.value = 20;
  numCompartmentsInput.value = 2;

  initCompartments();

  document.getElementById('grossVol').textContent      = '--';
  document.getElementById('grossVolCuft').textContent  = '--';
  document.getElementById('usableVol').textContent      = '--';
  document.getElementById('TTLVolCuft').textContent  = '--';

  messagesDiv.innerHTML = '';
  messagesFieldset.style.display = 'none';

  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (frontCanvas) frontCanvas.getContext('2d').clearRect(0, 0, frontCanvas.width, frontCanvas.height);
  if (sideCanvas) sideCanvas.getContext('2d').clearRect(0, 0, sideCanvas.width, sideCanvas.height);

  schematicOverlay.classList.add('hidden');
  dirtySchematic = false;
  currentConfig = null;
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

  const subtractedL = computeSubtractedVolumes(); // use current UI values

  const fmtTotals = (totals) => {
    if (!totals) return { gross:'-', total:'-', grossCuft:'-', totalCuft:'-' };
    const gross = totals.gross;
    const total = Math.max(0, gross - subtractedL);
    return {
      gross: roundForDisplay(gross, 'L'),
      total: roundForDisplay(total, 'L'),
      grossCuft: roundForDisplay(gross * settings.lToCuft, 'cuft'),
      totalCuft: roundForDisplay(total * settings.lToCuft, 'cuft'),
    };
  };
  const tA = fmtTotals(hasLeavesA ? resultA.totals : null);
  const tB = fmtTotals(hasLeavesB ? resultB.totals : null);
  let html = `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <thead><tr><th></th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Litres</th><th>cu.ft.</th><th>Litres</th><th>cu.ft.</th></tr></thead>
      <tbody>
      <tr><td><strong>Gross</strong></td><td>${tA.gross}</td><td>${tA.grossCuft}</td><td>${tB.gross}</td><td>${tB.grossCuft}</td></tr>
      <tr><td><strong>Total</strong></td><td>${tA.total}</td><td>${tA.totalCuft}</td><td>${tB.total}</td><td>${tB.totalCuft}</td></tr>
      </tbody></table>`;
  if (hasLeavesA && resultA.leaves.length > 0 && hasLeavesB && resultB.leaves.length > 0) {
    html += `<h3>Per‑Compartment Breakdown (Gross)</h3>`;
    const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
    html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <tr><th>Compartment</th><th>Slot A</th><th>Slot B</th></tr>`;
    for (let i = 0; i < maxLeaves; i++) {
      const leafA = resultA.leaves[i], leafB = resultB.leaves[i];
      const gA = leafA ? roundForDisplay(leafA.gross, 'L') : '-';
      const gB = leafB ? roundForDisplay(leafB.gross, 'L') : '-';
      html += `<tr><td>Comp ${i+1}</td><td>${gA}</td><td>${gB}</td></tr>`;
    }
    html += `</table>`;
  }
  comparisonContent.innerHTML = html;
}

// ---- Tab Switching ----
document.getElementById('tabVolume').addEventListener('click', () => {
  document.getElementById('panelVolume').classList.remove('hidden');
  document.getElementById('panelThermal').classList.add('hidden');
  document.getElementById('tabVolume').classList.add('active');
  document.getElementById('tabThermal').classList.remove('active');

  const thermoRight = document.getElementById('thermoRightPanel');
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (thermoRight) thermoRight.classList.add('hidden');
  if (frontCanvas) frontCanvas.style.display = '';
  if (sideCanvas)  sideCanvas.style.display  = '';
});

document.getElementById('tabThermal').addEventListener('click', () => {
  document.getElementById('panelThermal').classList.remove('hidden');
  document.getElementById('panelVolume').classList.add('hidden');
  document.getElementById('tabThermal').classList.add('active');
  document.getElementById('tabVolume').classList.remove('active');

  const thermoRight = document.getElementById('thermoRightPanel');
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (thermoRight) thermoRight.classList.remove('hidden');
  if (frontCanvas) frontCanvas.style.display = 'none';
  if (sideCanvas)  sideCanvas.style.display = 'none';
});

// Thermo UI init with geometry provider
initThermoUI({
  getGeometry: () => readGeometryFromPanel(),
  setGeometryProvider: null
});

// ======================================================================
//  NEW: Enable coordinate tooltip on both schematic canvases
// ======================================================================
enableCoordinateTooltip(
  document.getElementById('schematicFront'),
  document.getElementById('schematicSide'),
  () => readGeometryFromPanel()   // returns { H, W, D, … } required by the tooltip
);
updateRShowerVisibility();