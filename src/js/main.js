/**
 * @file main.js
 * Primary UI Orchestrator for the Refrigerator Volume Calculator.
 * Binds the DOM, manages dynamic user inputs, constructs the geometric 
 * model required by the calculation engine, and renders outputs (both HTML 
 * textual results and 2D Canvas schematics).
 */
import { settings, updateSettings } from './settings.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawFrontView, drawSideView, enableCoordinateTooltip } from './ui/schematic.js';
import { initSettingsModal } from './ui/settingsModal.js';
import { initThermoUI, getThermalState, setThermalState } from './ui/thermoUI.js';
import { DEFAULT_CABINET, toVolumeFormat, toThermalFormat, upgradeConfig } from './engine/geometry.js';
import { traverseAndComputePrecise } from './engine/traversal.js'; // precise engine
import { roundForDisplay, toCuft, polygonArea } from './engine/calc.js';

// Load settings from localStorage
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

// ---- Application State ------------------------------------------------
let currentConfig = null;
let lastCalcState = null; // Caches { config, volumes, thermal }

// Persistent Storage Hydration
let configSlotA = JSON.parse(localStorage.getItem('refrig_slotA')) || null;
let configSlotB = JSON.parse(localStorage.getItem('refrig_slotB')) || null;

let dirtySchematic = false;
let isResizing = false;
let startX, startWidth;

// Initialize slot buttons based on local storage
if (configSlotA || configSlotB) {
  compareSlotsBtn.style.display = 'inline-block';
}

/**
 * Toggles visibility of the R-Shower input group depending on if a 'fresh' compartment exists.
 */
function updateRShowerVisibility() {
  const hasFresh = compartmentsData.some(c => c.type === 'fresh');
  rshowerGroup.style.display = hasFresh ? '' : 'none';
}

document.getElementById('geom-Hb').addEventListener('input', () => {
  clampAllShelfCounts();
  syncDisplay();
  markDirty();
});

document.getElementById('geom-bottom1').addEventListener('input', () => {
  clampAllShelfCounts();
  syncDisplay();
  markDirty();
});

// Splitter logic
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

divHorizInput.addEventListener('input', () => {
  syncConstraints();
  syncDisplay();
  markDirty();
});

initCompartments();

/**
 * Initializes the compartment array based on the requested count (1 or 2).
 * Establishes default thickness values and structural ratios.
 */
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
      shelfCount: 0,
    });
  }
  syncConstraints();
  buildCompartmentUI();
  updateRShowerVisibility();
}

/**
 * Rebalances internal heights and ratios to ensure compartments perfectly fill
 * the available internal space (External H - Top Insulation - Bottom Insulation - Dividers).
 */
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
    compartmentsData[1] && (compartmentsData[1].height = 0);
    compartmentsData[0].ratio = 0.5;
    compartmentsData[1] && (compartmentsData[1].ratio = 0.5);
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
  
  // Enforce minimum shelf spacing
  clampAllShelfCounts();
}

/**
 * Handles live input changes for compartment fields (Type, Ratio, Height).
 * Enforces min/max ratios and mutually exclusive types (Freezer/Fresh).
 */
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

/**
 * Renders state back to the corresponding DOM input fields.
 */
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
    if (shelfCountInput) {
      shelfCountInput.value = d.shelfCount;
    }
  }
}

/**
 * Dynamically builds the HTML elements for the compartment configuration sections.
 */
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
        markDirty(); 
      });
      el.addEventListener('change', (e) => {
        syncConstraints();
        syncDisplay();
        if (settings.autoCalculate) calculateBtn.click();
      });
    }
    
    const shelfCountEl = document.getElementById(`comp-${i}-shelfCount`);
    if (shelfCountEl) {
      shelfCountEl.addEventListener('input', (e) => {
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

/**
 * World Y coordinate of the top of compartment i (mm).
 */
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

/**
 * Usable shelf height for compartment i (mm), considering the compressor step.
 */
function getUsableHeightForCompartment(i) {
  const H = parseFloat(document.getElementById('geom-H')?.value) || 0;
  const Hb = parseFloat(document.getElementById('geom-Hb')?.value) || 0;
  const bottom1 = parseFloat(document.getElementById('geom-bottom1')?.value) || 0;
  
  const floorRaisedY = H - Hb - bottom1;
  const compTopY = getCompTopWorldY(i);
  const fullHeight = compartmentsData[i].height;
  
  if (i === compartmentsData.length - 1) {
    return Math.max(0, Math.min(fullHeight, floorRaisedY - compTopY));
  }
  return fullHeight;
}

/**
 * Maximum number of shelves that can fit in the compartment (with 150 mm spacing).
 */
function getMaxShelvesForCompartment(i) {
  const usable = getUsableHeightForCompartment(i);
  return Math.max(0, Math.floor(usable / 150) - 1);
}

/**
 * Clamp all compartments shelf counts to the calculated maximum.
 */
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

/**
 * Scrapes all UI inputs to build the final unified geometric definition.
 */
export function readGeometryFromPanel() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || null;
  const comps = compartmentsData;
  const count = comps.length;
  const dividerThick = count > 1 ? parseFloat(divHorizInput.value) || 60 : 0;
  const bottomIdx = count - 1;
  
  const bottom1 = g('geom-bottom1') ?? 40;
  const bottom2 = g('geom-bottom2') ?? 40;
  const bottom3 = g('geom-bottom3') ?? 40;
  
  const walls = {
    freezer: {
      top: 0, bottom: 0, left: 0, right: 0, door: 0, rear: 0,
      bottom1, bottom2, bottom3, 
    },
    refrigerator: {
      top: 0, bottom1: bottom1, bottom2: bottom2, bottom3: bottom3, 
      left: 0, right: 0, door: 0, rear: 0,
    }
  };
  
  for (let i = 0; i < count; i++) {
    const comp = comps[i];
    const isTopMost = (i === 0);
    const isBottomMost = (i === bottomIdx);
    const wallKey = comp.type === 'fresh' ? 'refrigerator' : 'freezer';
    const w = walls[wallKey];
    
    w.top = isTopMost ? comp.top : dividerThick;
    
    if (wallKey === 'freezer') {
      w.bottom = isBottomMost ? bottom1 : dividerThick;
    } else {
      w.bottom1 = isBottomMost ? bottom1 : dividerThick;
    }
    w.left  = comp.left;
    w.right = comp.right;
    w.door  = comp.door;
    w.rear  = comp.rear;
  }
  
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
    Hf: comps.find(c => c.type === 'freezer')?.height || 0,
    Hr: comps.find(c => c.type === 'fresh')?.height || 0,
    walls,
    dividerThickness: dividerThick, 
    special: {
      railHeight:    g('geom-railHeight')    ?? 20,
      railWidth:     g('geom-railWidth')     ?? 10,
      railDepthPct:  g('geom-railDepthPct')  ?? 50,
      doorDikeHeight: g('geom-doorDikeHeight') ?? 50,
      doorDikeBaseWidth: g('geom-doorDikeBaseWidth') ?? 30,
      doorDikeTopWidth:  g('geom-doorDikeTopWidth')  ?? 15,
    },
    obstacles: {
      evapDepth: g('evapDepth') ?? 85,
      ctrlBoxH: g('ctrlBoxH') ?? 150,
      ctrlBoxW: g('ctrlBoxW') ?? 500,
      ctrlBoxL: g('ctrlBoxL') ?? 100,
      rshowerH: g('rshowerH') ?? 700,
      rshowerW: g('rshowerW') ?? 500,
      rshowerL: g('rshowerL') ?? 50,
    },
    _compartments: comps.map(c => ({
      ...c,
      shelfCount: c.shelfCount ?? 0
    }))
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

function markDirty() {
  dirtySchematic = true;
  if (settings.showDirtyOverlay) {
    schematicOverlay.classList.remove('hidden');
  } else {
    schematicOverlay.classList.add('hidden');
  }
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', markDirty));
numCompartmentsInput.addEventListener('input', () => {
  markDirty();
  initCompartments();
});

// ======================================================================
// NEW: Precise calculation using per-compartment geometry
// ======================================================================

export function buildLayoutNodeForPrecise() {
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
          shelfCount: comp.shelfCount || 0,
          shelves: [],
          drawers: [],
          doorBins: [],
          iceMakerHousing: { volume: null },
          lightHousing:    { volume: null },
        }
      }
    });
  }
  return {
    nodeType: 'horizontal',
    id: 'root',
    children: leaves.map(l => ({
      heightMode: l.heightMode,
      heightValue: l.heightValue,
      node: l.node
    })),
    dividers: count > 1 ? [{ afterChildIndex: 0, thickness: parseFloat(divHorizInput.value) || 20 }] : [],
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
  
  const Hb = parseFloat(document.getElementById('geom-Hb')?.value) || 0;
  const bottom1 = parseFloat(document.getElementById('geom-bottom1')?.value) || 40;
  const floorRaisedY = geometry.H - Hb - bottom1;
  
  // Evaporator (freezer compartment)
  const freezerIdx = comps.findIndex(c => c.type === 'freezer');
  const freezerComp = freezerIdx >= 0 ? comps[freezerIdx] : comps[0];
  const freezerIsBottommost = comps.length === 1 || freezerIdx === comps.length - 1;
  const freezerTopWorld = getCompTopWorldYFor(comps, freezerIdx >= 0 ? freezerIdx : 0, dividerThick);
  const fHeight = freezerIsBottommost
    ? Math.max(0, Math.min(freezerComp.height, floorRaisedY - freezerTopWorld))
    : freezerComp.height;
  const fInnerW = geometry.W - freezerComp.left - freezerComp.right;
  const evapVolMm3 = evapDepth * fHeight * fInnerW;
  
  // Control box / R-shower (fresh compartment)
  const freshIdx = comps.findIndex(c => c.type === 'fresh');
  const freshComp = comps[freshIdx >= 0 ? freshIdx : 0];
  const isTopFreezer = freshIdx > 0;
  const freshTopWorld = getCompTopWorldYFor(comps, freshIdx >= 0 ? freshIdx : 0, dividerThick);
  
  const availableRearH = isTopFreezer
    ? Math.max(0, Math.min(freshComp.height, floorRaisedY - freshTopWorld))
    : freshComp.height;
  const effectiveCtrlH = Math.min(ctrlH, availableRearH);
  const effectiveRShowerH = Math.max(0, Math.min(rshowerH, availableRearH - effectiveCtrlH));
  
  const ctrlVolMm3 = effectiveCtrlH * ctrlW * ctrlL;
  const rshowerVolMm3 = effectiveRShowerH * rshowerW * rshowerL;
  
  // Rails and Dikes
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
    rshower:    rshowerLiters,
    rails:      railsL,
    dikes:      dikesL,
    totalAll:   evapL + ctrlLiters + rshowerLiters + railsL + dikesL,
    railsDikesOnly: railsL + dikesL,
  };
}

export function exportvolume(leaves, geometry){
  const comps = compartmentsData;
  const special = geometry.special || {};
  const perCompRailsDikesL = comps.map(c => {
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
    gross: Math.max(0, leaf.gross - perCompRailsDikesL[idx]),
  }));
  
  const freezerIdx = comps.findIndex(c => c.type === 'freezer');
  const freshIdx   = comps.findIndex(c => c.type === 'fresh');
  
  const freezerGross = freezerIdx >= 0 ? adjustedLeaves[freezerIdx]?.gross : null;
  const freshGross   = freshIdx >= 0 ? adjustedLeaves[freshIdx]?.gross : null;
  
  const obstacles = computeObstacleVolumes(geometry);
  const freezerTotal = freezerGross != null
    ? Math.max(0, freezerGross - (obstacles.evaporator || 0))
    : null;
  const freshTotal = freshGross != null
    ? Math.max(0, freshGross - (obstacles.controlBox || 0) - (obstacles.rshower || 0))
    : null;
    
  return {
    freezerGross: freezerGross,
    freezerTotal: freezerTotal,
    freshGross: freshGross,
    freshTotal: freshTotal,
  };
}

/**
 * Submits computed volumes to the UI table.
 */
function displayPreciseResults(leaves, geometry) {
  const comps = compartmentsData;
  const special = geometry.special || {};
  const perCompRailsDikesL = comps.map(c => {
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
    gross: Math.max(0, leaf.gross - perCompRailsDikesL[idx]),
  }));
  
  const grossL = adjustedLeaves.reduce((sum, l) => sum + l.gross, 0);
  const grossCuft = grossL * settings.lToCuft;
  
  const obstacles = computeObstacleVolumes(geometry);
  const totalL = Math.max(0, grossL - obstacles.evaporator - obstacles.controlBox - obstacles.rshower);
  const totalCuft = totalL * settings.lToCuft;
  
  document.getElementById('grossVol').textContent      = roundForDisplay(grossL, 'L');
  document.getElementById('grossVolCuft').textContent  = roundForDisplay(grossCuft, 'cuft');
  document.getElementById('totalVol').textContent      = roundForDisplay(totalL, 'L');
  document.getElementById('totalVolCuft').textContent  = roundForDisplay(totalCuft, 'cuft');
  
  const getDisplay = (val, unit) => (val != null && !isNaN(val)) ? roundForDisplay(val, unit) : '--';
  const getCuft = (val) => (val != null && !isNaN(val)) ? roundForDisplay(val * settings.lToCuft, 'cuft') : '--';
  
  const freezerIdx = comps.findIndex(c => c.type === 'freezer');
  const freshIdx   = comps.findIndex(c => c.type === 'fresh');
  
  const freezerGross = freezerIdx >= 0 ? adjustedLeaves[freezerIdx]?.gross : null;
  const freshGross   = freshIdx >= 0 ? adjustedLeaves[freshIdx]?.gross : null;
  
  const freezerTotal = freezerGross != null
    ? Math.max(0, freezerGross - (obstacles.evaporator || 0))
    : null;
  const freshTotal = freshGross != null
    ? Math.max(0, freshGross - (obstacles.controlBox || 0) - (obstacles.rshower || 0))
    : null;
    
  document.getElementById('freezerGrossVol').textContent      = getDisplay(freezerGross, 'L');
  document.getElementById('freezerGrossVolCuft').textContent  = getCuft(freezerGross);
  document.getElementById('freezerTotalVol').textContent      = getDisplay(freezerTotal, 'L');
  document.getElementById('freezerTotalVolCuft').textContent  = getCuft(freezerTotal);
  
  document.getElementById('fridgeGrossVol').textContent       = getDisplay(freshGross, 'L');
  document.getElementById('fridgeGrossVolCuft').textContent   = getCuft(freshGross);
  document.getElementById('fridgeTotalVol').textContent       = getDisplay(freshTotal, 'L');
  document.getElementById('fridgeTotalVolCuft').textContent   = getCuft(freshTotal);

  // PU Estimation
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
      const dividerMidpoint = compBottomY + (geometry.dividerThickness / 2);
      doorEndY = dividerMidpoint - (geometry.doorGap / 2);
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
    if (c.type === 'freezer') fdoorPUVolL = totalDoorVol;
    else if (c.type === 'fresh') rdoorPUVolL = totalDoorVol;
    
    if (i < comps.length - 1) {
      const compBottomY = yOffset + c.height;
      const dividerMidpoint = compBottomY + (geometry.dividerThickness / 2);
      doorStartY = dividerMidpoint + (geometry.doorGap / 2);
      yOffset = compBottomY + geometry.dividerThickness;
    }
  }
  
  const extVolMm3 = geometry.H * geometry.W * geometry.D;
  const cutoutVolMm3 = geometry.Hb * (geometry.Db1 + geometry.Db2) / 2 * geometry.W;
  const extVolL = (extVolMm3 - cutoutVolMm3) * settings.mm3ToL;
  const cabPUVolL = extVolL - grossL - totalDikesL;
  
  document.getElementById('cabpuVol').textContent      = roundForDisplay(cabPUVolL, 'L');
  document.getElementById('cabpuVolCuft').textContent  = roundForDisplay(cabPUVolL * settings.lToCuft, 'cuft');
  document.getElementById('cabpuweight').textContent   = roundForDisplay(cabPUVolL * 32 / 1000, 'kg');
  document.getElementById('fdoorpuVol').textContent    = roundForDisplay(fdoorPUVolL, 'L');
  document.getElementById('fdoorpuVolCuft').textContent = roundForDisplay(fdoorPUVolL * settings.lToCuft, 'cuft');
  document.getElementById('fdoorpuweight').textContent = roundForDisplay(fdoorPUVolL * 32 / 1000, 'kg');
  document.getElementById('rdoorpuVol').textContent    = roundForDisplay(rdoorPUVolL, 'L');
  document.getElementById('rdoorpuVolCuft').textContent = roundForDisplay(rdoorPUVolL * settings.lToCuft, 'cuft');
  document.getElementById('rdoorpuweight').textContent = roundForDisplay(rdoorPUVolL * 32 / 1000, 'kg');
}

/**
 * Triggers the canvas rendering tools based on the current calculation state.
 */
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
  const geom = config.cabinet.geometry || currentGeometry;
  const obs = geom.obstacles || {};
  const H = geom.H, D = geom.D;
  const eff = effectiveWalls;
  
  const innerTopY = eff.top;
  const innerBottomY = H - Math.max(
    parseFloat(document.getElementById('geom-bottom1')?.value) || 40,
    parseFloat(document.getElementById('geom-bottom2')?.value) || 40,
    parseFloat(document.getElementById('geom-bottom3')?.value) || 40
  );
  
  const shelfCounts = compartmentsData.map(c => c.shelfCount || 2);
  
  const drawOptions = {
    dividerThickness: compartmentsData.length > 1 ? parseFloat(divHorizInput.value) || 20 : 0,
    compHeights: compartmentsData.map(c => c.height),
    doorGap: parseFloat(document.getElementById('geom-doorGap')?.value) || 10,
    compartments: compartmentsData.map(c => ({
      left: c.left, right: c.right, rear: c.rear, door: c.door
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
    ctrlBoxH:  obs.ctrlBoxH ?? (parseFloat(ctrlBoxHInput.value) || 0),
    ctrlBoxW:  obs.ctrlBoxW ?? (parseFloat(ctrlBoxWInput.value) || 0),
    ctrlBoxL:  obs.ctrlBoxL ?? (parseFloat(ctrlBoxLInput.value) || 0),
    rshowerH:  obs.rshowerH ?? (parseFloat(rshowerHInput.value) || 0),
    rshowerW:  obs.rshowerW ?? (parseFloat(rshowerWInput.value) || 0),
    rshowerL:  obs.rshowerL ?? (parseFloat(rshowerLInput.value) || 0),
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
  currentGeometry = readGeometryFromPanel();
  const layout = buildLayoutNodeForPrecise();
  
  const existingMeta = currentConfig?.meta || { 
    name: 'UI Config', 
    createdAt: new Date().toISOString() 
  };
  
  currentConfig = {
    schemaVersion: '2.0',
    meta: { ...existingMeta, updatedAt: new Date().toISOString() },
    cabinet: { geometry: currentGeometry, layout: layout },
    thermal: getThermalState()
  };

  const { leaves, errors, warnings } = traverseAndComputePrecise(layout, currentGeometry);
  
  const allMessages = [...(errors||[]).map(e => `<p class="error">  ${e.message}</p>`), 
                       ...(warnings||[]).map(w => `<p class="warning">  ${w.message}</p>`)];
  
  if (allMessages.length) {
    messagesDiv.innerHTML = allMessages.join('');
    messagesFieldset.style.display = 'block';
  } else {
    messagesFieldset.style.display = 'none';
  }
  
  if (leaves && leaves.length > 0) {
    // Generate the calculation cache state
    const grossL = leaves.reduce((sum, l) => sum + l.gross, 0);
    lastCalcState = {
      config: currentConfig,
      volumes: { leaves, errors, warnings, totals: { gross: grossL } },
      thermal: null // This will be assigned externally when thermo calculation completes
    };

    storeSlotABtn.style.display = 'inline-block';
    storeSlotBBtn.style.display = 'inline-block';
    compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';

    displayPreciseResults(leaves, currentGeometry);
    drawSchematics(currentConfig, leaves);
  } else {
    document.getElementById('grossVol').textContent = '--';
    document.getElementById('totalVol').textContent = '--';
  }
});

function extractFittingsFromLayout(node) {
  const fittings = [];
  function walk(n) {
    if (n.nodeType === 'leaf' && n.fittings) {
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
        shelfCount: c.shelfCount ?? 0,
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
      set('geom-railHeight', 20);
      set('geom-railWidth', 10);
      set('geom-railDepthPct', 50);
      set('geom-doorDikeHeight', 50);
      set('geom-doorDikeBaseWidth', 30);
      set('geom-doorDikeTopWidth', 15);
    }
    if (geometry.obstacles) {
      set('evapDepth', geometry.obstacles.evapDepth);
      set('ctrlBoxH',  geometry.obstacles.ctrlBoxH);
      set('ctrlBoxW',  geometry.obstacles.ctrlBoxW);
      set('ctrlBoxL',  geometry.obstacles.ctrlBoxL);
      set('rshowerH',  geometry.obstacles.rshowerH);
      set('rshowerW',  geometry.obstacles.rshowerW);
      set('rshowerL',  geometry.obstacles.rshowerL);
    } else {
      set('evapDepth', 85);
      set('ctrlBoxH', 150);
      set('ctrlBoxW', 500);
      set('ctrlBoxL', 100);
      set('rshowerH', 700);
      set('rshowerW', 500);
      set('rshowerL', 50);
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
    console.warn('populateUIFromConfig: unrecognised config structure UI not restored.');
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

// ---- Save / Load / Export ---------------------------------------------

// Decoupled Save
saveBtn.addEventListener('click', () => {
  if (!currentConfig) { alert('Calculate first'); return; }
  currentConfig.thermal = getThermalState();
  // downloadConfigJSON now handles the filename prompt internally
  downloadConfigJSON(currentConfig, currentConfig.meta.name);
});

// Decoupled File Load
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
      populateUIFromConfig(config); // Sync UI inputs silently
      alert('Configuration loaded successfully. Press Calculate to evaluate.');
    } catch (err) {
      alert(`Initialization Error: ${err.message}`);
    }
  };
  input.click();
});

// State-Driven Export
exportBtn.addEventListener('click', () => {
  if (!lastCalcState) { 
    alert('No computational state found. Calculate first.'); 
    return; 
  }
  downloadResultsCSV(lastCalcState, currentConfig.meta.name);
});


// ---- Settings Modal --------------------------------------------------
initSettingsModal();

// ---- Reset All ---------------------------------------------------------
resetAllBtn.addEventListener('click', () => {
  if (!confirm('Reset all fields to default values and clear results?')) return;
  currentGeometry = { ...DEFAULT_CABINET };
  fillGeometryDefaults();
  divHorizInput.value = 20;
  numCompartmentsInput.value = 2;
  initCompartments();
  document.getElementById('grossVol').textContent      = '--';
  document.getElementById('grossVolCuft').textContent  = '--';
  document.getElementById('totalVol').textContent      = '--';
  document.getElementById('totalVolCuft').textContent  = '--';
  messagesDiv.innerHTML = '';
  messagesFieldset.style.display = 'none';
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (frontCanvas) frontCanvas.getContext('2d').clearRect(0, 0, frontCanvas.width, frontCanvas.height);
  if (sideCanvas) sideCanvas.getContext('2d').clearRect(0, 0, sideCanvas.width, sideCanvas.height);
  schematicOverlay.classList.add('hidden');
  dirtySchematic = false;
  currentConfig = null;
  lastCalcState = null;
  
  const defaultFanParam = {
    tipDiam_mm: 220,
    fanRPM: 2200,
    hubDiam_mm: 80,
    PitchAngle_degree: 30,
  };
  const defaultEvap = {
    width_mm: 460,
    depth_mm: 60,
  };
  settings.fanParam = defaultFanParam;
  settings.evaporator = defaultEvap;
  updateSettings(settings);
  if (settings.autoCalculate) calculateBtn.click();
});

// ---- Auto calculate & settings change handler ------------------------
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

// ---- Slot storage & comparison -----------------------------------------
storeSlotABtn.addEventListener('click', () => {
  if (!lastCalcState) return;
  configSlotA = JSON.parse(JSON.stringify(lastCalcState));
  localStorage.setItem('refrig_slotA', JSON.stringify(configSlotA));
  alert('State committed to Slot A.');
  compareSlotsBtn.style.display = 'inline-block';
});

storeSlotBBtn.addEventListener('click', () => {
  if (!lastCalcState) return;
  configSlotB = JSON.parse(JSON.stringify(lastCalcState));
  localStorage.setItem('refrig_slotB', JSON.stringify(configSlotB));
  alert('State committed to Slot B.');
  compareSlotsBtn.style.display = 'inline-block';
});

compareSlotsBtn.addEventListener('click', () => {
  if (!configSlotA && !configSlotB) {
    alert('No stored states to compare.');
    return;
  }
  buildComparisonTable(configSlotA, configSlotB);
  comparisonModal.classList.remove('hidden');
});

closeComparison.addEventListener('click', () => { comparisonModal.classList.add('hidden'); });
window.addEventListener('click', (e) => { if (e.target === comparisonModal) comparisonModal.classList.add('hidden'); });

/**
 * Builds and renders the HTML table for side-by-side slot comparison encompassing volumes and thermal limits.
 */
/**
 * Builds and renders the HTML table for side-by-side slot comparison encompassing volumes, thermal limits, and energy.
 */
function buildComparisonTable(stateA, stateB) {
  if (!stateA && !stateB) {
    comparisonContent.innerHTML = '<p>No states stored.</p>';
    return;
  }

  // Helper to re-calculate all PU/Geometric volumes locally (Matches CSV logic)
  const getExt = (state) => {
    if (!state || !state.config || !state.config.cabinet.geometry) return null;
    
    const geometry = state.config.cabinet.geometry;
    const leaves = state.volumes?.leaves || [];
    const comps = geometry._compartments || [];
    const special = geometry.special || {};
    const mm3ToL = 1e-6;

    // Rail and Dike volumes
    const perCompRailsDikesL = comps.map(c => {
      const shelfCount = c.shelfCount || 0;
      const innerW = geometry.W - c.left - c.right;
      const innerD = geometry.D - c.rear;

      const railH = special.railHeight || 0;
      const railW = special.railWidth || 0;
      const railDepthPct = (special.railDepthPct || 0) / 100;
      const railsVol = railH * railW * railDepthPct * innerD * shelfCount * 2 * mm3ToL;

      const dikeH = special.doorDikeHeight || 0;
      const dikeBaseW = special.doorDikeBaseWidth || 0;
      const dikeTopW = special.doorDikeTopWidth || 0;
      const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;

      const perimeter = 2 * (innerW + c.height);
      const dikesVol = dikeArea * perimeter * mm3ToL;

      return railsVol + dikesVol;
    });

    const adjustedLeaves = leaves.map((leaf, idx) => ({
      ...leaf,
      gross: Math.max(0, leaf.gross - (perCompRailsDikesL[idx] || 0)),
    }));

    const freezerIdx = comps.findIndex(c => c.type === 'freezer');
    const freshIdx = comps.findIndex(c => c.type === 'fresh');
    const freezerGross = freezerIdx >= 0 ? adjustedLeaves[freezerIdx]?.gross : 0;
    const freshGross = freshIdx >= 0 ? adjustedLeaves[freshIdx]?.gross : 0;
    const grossVolume = adjustedLeaves.reduce((sum, l) => sum + (l.gross || 0), 0);

    const obs = geometry.obstacles || {};
    const dividerThick = geometry.dividerThickness ?? 20;
    const evapDepth = obs.evapDepth ?? 85;
    const ctrlH = obs.ctrlBoxH ?? 150;
    const ctrlW = obs.ctrlBoxW ?? 500;
    const ctrlL = obs.ctrlBoxL ?? 100;
    const rshowerH = obs.rshowerH ?? 700;
    const rshowerW = obs.rshowerW ?? 500;
    const rshowerL = obs.rshowerL ?? 50;

    const Hb = geometry.Hb || 0;
    const bottom1 = geometry.walls?.freezer?.bottom1 ?? geometry.walls?.refrigerator?.bottom1 ?? 40;
    const floorRaisedY = geometry.H - Hb - bottom1;

    const getCompTopWorldYFor = (compsList, idx, divThick) => {
      let y = compsList[0]?.top || 0;
      for (let i = 0; i < idx; i++) {
        y += compsList[i].height;
        if (i < compsList.length - 1) y += divThick;
      }
      return y;
    };

    const freezerComp = freezerIdx >= 0 ? comps[freezerIdx] : comps[0];
    const freezerIsBottommost = comps.length === 1 || freezerIdx === comps.length - 1;
    const freezerTopWorld = getCompTopWorldYFor(comps, freezerIdx >= 0 ? freezerIdx : 0, dividerThick);
    const fHeight = freezerIsBottommost && freezerComp ? Math.max(0, Math.min(freezerComp.height, floorRaisedY - freezerTopWorld)) : (freezerComp?.height || 0);
    const fInnerW = freezerComp ? (geometry.W - freezerComp.left - freezerComp.right) : 0;
    const evaporatorL = (evapDepth * fHeight * fInnerW) * mm3ToL;

    const freshComp = comps[freshIdx >= 0 ? freshIdx : 0];
    const isTopFreezer = freshIdx > 0;
    const freshTopWorld = getCompTopWorldYFor(comps, freshIdx >= 0 ? freshIdx : 0, dividerThick);
    const availableRearH = isTopFreezer && freshComp ? Math.max(0, Math.min(freshComp.height, floorRaisedY - freshTopWorld)) : (freshComp?.height || 0);
    const effectiveCtrlH = Math.min(ctrlH, availableRearH);
    const effectiveRShowerH = Math.max(0, Math.min(rshowerH, availableRearH - effectiveCtrlH));

    const controlBoxL = (effectiveCtrlH * ctrlW * ctrlL) * mm3ToL;
    const rshowerLiters = (effectiveRShowerH * rshowerW * rshowerL) * mm3ToL;

    const freezerTotal = Math.max(0, freezerGross - evaporatorL);
    const freshTotal = Math.max(0, freshGross - controlBoxL - rshowerLiters);
    const totalVolume = freezerTotal + freshTotal;

    let fdoorPUVolL = 0, rdoorPUVolL = 0, totalDikesL = 0;
    let doorStartY = 0;
    let yOffset = comps[0]?.top || 0;

    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      const innerW = geometry.W - c.left - c.right;
      const doorThick = c.door || 0;

      let doorEndY;
      if (i === comps.length - 1) {
        doorEndY = geometry.H;
      } else {
        const compBottomY = yOffset + c.height;
        const dividerMidpoint = compBottomY + (geometry.dividerThickness / 2);
        doorEndY = dividerMidpoint - (geometry.doorGap / 2);
      }

      const outerDoorHeight = doorEndY - doorStartY;
      const baseVol = doorThick * geometry.W * outerDoorHeight * mm3ToL;

      const dikeH = special.doorDikeHeight || 0;
      const dikeBaseW = special.doorDikeBaseWidth || 0;
      const dikeTopW = special.doorDikeTopWidth || 0;
      const dikeArea = (dikeBaseW + dikeTopW) / 2 * dikeH;
      const perimeter = 2 * (innerW + c.height);
      const dikeVolL = dikeArea * perimeter * mm3ToL;

      totalDikesL += dikeVolL;

      const totalDoorVol = baseVol + dikeVolL;
      if (c.type === 'freezer') fdoorPUVolL = totalDoorVol;
      else if (c.type === 'fresh') rdoorPUVolL = totalDoorVol;

      if (i < comps.length - 1) {
        const compBottomY = yOffset + c.height;
        const dividerMidpoint = compBottomY + (geometry.dividerThickness / 2);
        doorStartY = dividerMidpoint + (geometry.doorGap / 2);
        yOffset = compBottomY + geometry.dividerThickness;
      }
    }

    const extVolMm3 = geometry.H * geometry.W * geometry.D;
    const cutoutVolMm3 = geometry.Hb * (geometry.Db1 + geometry.Db2) / 2 * geometry.W;
    const extVolL = (extVolMm3 - cutoutVolMm3) * mm3ToL;
    const cabPUVolL = extVolL - grossVolume - totalDikesL;

    return {
      freezerGross, freshGross, grossVolume,
      freezerTotal, freshTotal, totalVolume,
      cabPUVolL, fdoorPUVolL, rdoorPUVolL,
      cabPUweight: cabPUVolL * 32 / 1000,
      fdoorPUweight: fdoorPUVolL * 32 / 1000,
      rdoorPUweight: rdoorPUVolL * 32 / 1000
    };
  };

  const getRank = (state, ext) => {
    if (!state || !ext) return { r27: '-', r29: '-', r31: '-' };
    const TF = state.config.fixedTemps?.TF ?? -18;
    const monthlyE = state.thermal?.energy?.EnergyConsumption_kWhMonth ?? 0;
    if (monthlyE === 0) return { r27: '-', r29: '-', r31: '-' };

    const AV = (ext.freezerTotal * (25 - TF) / 21) + ext.freshTotal;
    const ES_27 = AV * 0.57 + (800 * 0.9);
    const ES_29 = AV * 0.57 + (800 * 0.8);
    const ES_31 = AV * 0.57 + (800 * 0.6);
    
    const IEE_27 = (monthlyE * 12) / ES_27;
    const IEE_29 = (monthlyE * 12) / ES_29;
    const IEE_31 = (monthlyE * 12) / ES_31;

    const rankStr = (iee) => {
      if (!iee || isNaN(iee)) return 'OUT OF RANKING';
      if (iee <= 0.45) return 'A';
      if (iee <= 0.55) return 'B';
      if (iee <= 0.65) return 'C';
      if (iee <= 0.75) return 'D';
      return 'OUT OF RANKING';
    };
    return { r27: rankStr(IEE_27), r29: rankStr(IEE_29), r31: rankStr(IEE_31) };
  };

  // Extract Data Architectures
  const extA = getExt(stateA);
  const extB = getExt(stateB);
  const ranksA = getRank(stateA, extA);
  const ranksB = getRank(stateB, extB);

  const tA = stateA?.thermal?.results || {};
  const tB = stateB?.thermal?.results || {};
  const cA = tA.compressor || {};
  const cB = tB.compressor || {};
  const hA = tA.heatLoads || {};
  const hB = tB.heatLoads || {};
  const evA = tA.evapDetails || {};
  const evB = tB.evapDetails || {};
  const enA = stateA?.thermal?.energy || {};
  const enB = stateB?.thermal?.energy || {};

  const fmt = (val, dec = 2) => val != null && !isNaN(val) ? Number(val).toFixed(dec) : '-';
  const fmt0 = (val) => val != null && !isNaN(val) ? Number(val).toFixed(0) : '-';

  const row = (label, valA, valB) => `<tr><td style="text-align:left;">${label}</td><td>${valA}</td><td>${valB}</td></tr>`;
  const head = (label) => `<tr><td colspan="3" style="font-weight:bold; background:#eaeaea; text-align:left;">${label}</td></tr>`;

  let html = `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse; font-size:13px; text-align:right;">
    <thead>
      <tr style="background:#f4f4f4;"><th style="text-align:left;">Metric</th><th style="text-align:right;">Slot A</th><th style="text-align:right;">Slot B</th></tr>
    </thead>
    <tbody>`;

  html += head('Gross Volume');
  html += row('Freezer Gross (L)', fmt(extA?.freezerGross), fmt(extB?.freezerGross));
  html += row('Fresh Gross (L)', fmt(extA?.freshGross), fmt(extB?.freshGross));
  html += row('Gross Volume (L)', fmt(extA?.grossVolume), fmt(extB?.grossVolume));

  html += head('Total Volume');
  html += row('Freezer Total (L)', fmt(extA?.freezerTotal), fmt(extB?.freezerTotal));
  html += row('Fresh Total (L)', fmt(extA?.freshTotal), fmt(extB?.freshTotal));
  html += row('Total Volume (L)', fmt(extA?.totalVolume), fmt(extB?.totalVolume));

  html += head('PU Volume Estimation');
  html += row('Estimated Cabinet PU Vol (L)', fmt(extA?.cabPUVolL), fmt(extB?.cabPUVolL));
  html += row('Estimated F-Door PU Vol (L)', fmt(extA?.fdoorPUVolL), fmt(extB?.fdoorPUVolL));
  html += row('Estimated R-Door PU Vol (L)', fmt(extA?.rdoorPUVolL), fmt(extB?.rdoorPUVolL));

  html += head('PU Weight Estimation');
  html += row('Estimated Cabinet PU Wt (kg)', fmt(extA?.cabPUweight), fmt(extB?.cabPUweight));
  html += row('Estimated F-Door PU Wt (kg)', fmt(extA?.fdoorPUweight), fmt(extB?.fdoorPUweight));
  html += row('Estimated R-Door PU Wt (kg)', fmt(extA?.rdoorPUweight), fmt(extB?.rdoorPUweight));

  html += head('Operating Points');
  html += row('Condensing temp TC (C)', fmt(tA.TC), fmt(tB.TC));
  html += row('Evaporating temp TE (C)', fmt(tA.TE), fmt(tB.TE));
  html += row('Mixed inlet T1 (C)', fmt(evA.T1), fmt(evB.T1));
  html += row('Evap. outlet T2 (C)', fmt(tA.T2), fmt(tB.T2));
  html += row('Fan out Temp T3 (C)', fmt(tA.T3), fmt(tB.T3));
  html += row('Running Ratio PR', fmt(tA.PR), fmt(tB.PR));

  html += head('Compressor Details');
  html += row('Evap. pressure Pe (bar)', fmt(cA.Pe), fmt(cB.Pe));
  html += row('Cond. pressure Pc (bar)', fmt(cA.Pc), fmt(cB.Pc));
  html += row('Vol. efficiency ηv', fmt(cA.etaV), fmt(cB.etaV));
  html += row('Cooling capacity (W)', fmt(cA.coolingCapacity), fmt(cB.coolingCapacity));
  html += row('Input power (W)', fmt(cA.inputPower), fmt(cB.inputPower));
  html += row('COP', fmt(cA.COP), fmt(cB.COP));
  html += row('Required Compressor RPM', fmt0(tA.RPM), fmt0(tB.RPM));
  html += row('Mass flow (kg/h)', fmt(cA.massFlow), fmt(cB.massFlow));

  html += head('Energy Consumption');
  html += row('Daily energy (kWh)', fmt(enA.EnergyConsumption_kWhDay, 4), fmt(enB.EnergyConsumption_kWhDay, 4));
  html += row('Monthly energy (kWh)', fmt(enA.EnergyConsumption_kWhMonth), fmt(enB.EnergyConsumption_kWhMonth));
  html += row('Rank_27', ranksA.r27, ranksB.r27);
  html += row('Rank_29', ranksA.r29, ranksB.r29);
  html += row('Rank_31', ranksA.r31, ranksB.r31);

  html += head('Heat Loads (W)');
  html += row('QF — Freezer compartment', fmt(hA.QF), fmt(hB.QF));
  html += row('QR — Refrigerator compartment', fmt(hA.QR), fmt(hB.QR));
  html += row('QEV — Evaporator total', fmt(hA.QEV), fmt(hB.QEV));
  html += row('Fan load', fmt(hA.fanLoad), fmt(hB.fanLoad));
  html += row('Defrost load', fmt(hA.defrostLoad), fmt(hB.defrostLoad));
  html += row('Total load', fmt(hA.totalLoad), fmt(hB.totalLoad));

  html += head('Airflow');
  html += row('Calculated Fan Air Speed (m/s)', fmt(tA.fanAirSpeed), fmt(tB.fanAirSpeed));
  html += row('Calculated airflow (m³/h)', fmt(tA.fanAirflow), fmt(tB.fanAirflow));
  html += row('Freezer flow (MF)', fmt(tA.MF), fmt(tB.MF));
  html += row('Refrigerator flow (MR)', fmt(tA.MR), fmt(tB.MR));

  html += head('Evaporator Performance');
  html += row('Surface area (m²)', fmt(evA.area, 4), fmt(evB.area, 4));
  html += row('Air speed (m/s)', fmt(evA.v, 3), fmt(evB.v, 3));
  html += row('Heat transfer coeff α', fmt(evA.alpha), fmt(evB.alpha));
  html += row('LMTD', fmt(evA.LMTD), fmt(evB.LMTD));
  html += row('Evap. capacity (calculated)', fmt(evA.Qevap), fmt(evB.Qevap));

  html += `</tbody></table>`;
  comparisonContent.innerHTML = html;
}

// ---- Tab Switching ----

// Tab: Volume 
document.getElementById('tabVolume').addEventListener('click', () => {
  // Reset all panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  // Activate target panel
  document.getElementById('panelVolume').classList.add('active');
  document.getElementById('panelVolume').classList.remove('hidden');
  
  // Reset tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tabVolume').classList.add('active');
  
  // Manage side panels/canvases
  const thermoRight = document.getElementById('thermoRightPanel');
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (thermoRight) thermoRight.classList.add('hidden');
  if (frontCanvas) frontCanvas.style.display = '';
  if (sideCanvas)  sideCanvas.style.display  = '';
});

// Tab: Thermal 
document.getElementById('tabThermal').addEventListener('click', () => {
  // Reset all panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  // Activate target panel
  document.getElementById('panelThermal').classList.add('active');
  document.getElementById('panelThermal').classList.remove('hidden');
  
  // Reset tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tabThermal').classList.add('active');
  
  // Manage side panels/canvases
  const thermoRight = document.getElementById('thermoRightPanel');
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  if (thermoRight) thermoRight.classList.remove('hidden');
  if (frontCanvas) frontCanvas.style.display = 'none';
  if (sideCanvas)  sideCanvas.style.display = 'none';
});

// Tab: Inverter 
document.getElementById('tabInverter').addEventListener('click', () => {
  // Reset all panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  // Activate target panel
  document.getElementById('panelInverter').classList.add('active');
  document.getElementById('panelInverter').classList.remove('hidden');
  
  // Reset tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tabInverter').classList.add('active');
  
  // Manage side panels/canvases
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

// Coordinate tooltip
enableCoordinateTooltip(
  document.getElementById('schematicFront'),
  document.getElementById('schematicSide'),
  () => readGeometryFromPanel()
);
updateRShowerVisibility();

// Allow external scripts to attach thermal evaluations to the cached state
export function setLastCalcThermalState(thermalResults, energyResults) {
  if (lastCalcState) {
    lastCalcState.thermal = { results: thermalResults, energy: energyResults };
  }
}