import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawSchematic } from './ui/schematic.js';
import { initSettingsModal, showModal } from './ui/settingsModal.js';
import { settings } from './settings.js';
import { formatTotalsDisplay, formatLeafDisplay, walkBoundaries } from './engine/calc.js';
import { initThermoUI } from './ui/thermoUI.js';
import { DEFAULT_CABINET, toVolumeFormat, toThermalFormat } from './engine/geometry.js';
// ---- DOM references ---------------------------------------------------
const extHeightInput      = document.getElementById('extHeight');
const extWidthInput       = document.getElementById('extWidth');
const extDepthInput       = document.getElementById('extDepth');
const divHorizInput       = document.getElementById('divHoriz');
const divVertInput        = document.getElementById('divVert');
const sealOffsetInput     = document.getElementById('sealOffset');
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

let configSlotA = null;
let configSlotB = null;
let currentConfig = null;
let dirtySchematic = false;
let wallThicknessByType = null;
// Shared cabinet geometry
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
// ---- Effective thickness helper (for schematic) -----------------------
function getEffectiveThicknesses(config) {
  const { external, wallThicknessesByType, layout } = config.cabinet;
  const boundaryTypes = { top: new Set(), bottom: new Set(), left: new Set(), right: new Set() };
  walkBoundaries(layout, boundaryTypes, true, true, true, true);
  const eff = {};
  const allTypes = ['fresh','freezer','flex'];
  for (const face of ['top','bottom','left','right']) {
    let max = 0;
    for (const t of boundaryTypes[face]) {
      const val = wallThicknessesByType[t]?.[face] ?? 0;
      if (val > max) max = val;
    }
    if (boundaryTypes[face].size === 0) {
      for (const t of allTypes) max = Math.max(max, wallThicknessesByType[t]?.[face] ?? 0);
    }
    eff[face] = max;
  }
  eff.rear = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.rear ?? 0));
  eff.door = Math.max(...allTypes.map(t => wallThicknessesByType[t]?.door ?? 0));
  return eff;
}

// ---- Build wall thickness UI ------------------------------------------
function buildWallThicknessUI() {
  const container = document.getElementById('wallThicknessPerType');
  const types = ['fresh', 'freezer', 'flex'];
  const labels = ['Fresh Food', 'Freezer', 'Convertible'];
  const faces = ['top','bottom','left','right','rear','door'];
  const defaultValues = {
    top:50, bottom:50, left:50, right:50, rear:50, door:70
  };
  const currentValues = wallThicknessByType || {};
  
  let html = '<table style="width:100%; border:1px solid #ccc; border-collapse:collapse;">';
  html += '<tr><th></th><th>Top</th><th>Bottom</th><th>Left</th><th>Right</th><th>Rear</th><th>Door</th></tr>';
  for (let t = 0; t < types.length; t++) {
    const type = types[t];
    html += `<tr><td><strong>${labels[t]}</strong></td>`;
    for (const face of faces) {
      const val = (currentValues[type] && currentValues[type][face] != null) ? currentValues[type][face] : defaultValues[face];
      html += `<td><input type="number" id="wall-${type}-${face}" value="${val}" step="any" min="0" style="width:60px;"></td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  container.innerHTML = html;

  document.getElementById('copyToAllTypesBtn').addEventListener('click', () => {
    const freshValues = {};
    for (const face of faces) {
      freshValues[face] = parseFloat(document.getElementById(`wall-fresh-${face}`).value) || defaultValues[face];
    }
    for (const otherType of ['freezer','flex']) {
      for (const face of faces) {
        document.getElementById(`wall-${otherType}-${face}`).value = freshValues[face];
      }
    }
    markDirty();
  });

  container.querySelectorAll('input').forEach(inp => inp.addEventListener('input', markDirty));
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

// ---- Dynamic compartment builder --------------------------------------
numCompartmentsInput.addEventListener('input', () => {
  markDirty();
  buildCompartmentUI();
});
buildCompartmentUI();
buildWallThicknessUI();
writeGeometryToPanel(currentGeometry);
initThermoUI(() => {
  // Ensure the thermo UI reads the latest geometry from the shared panel
  return readGeometryFromPanel();
});
function buildCompartmentUI() {
  const count = Math.max(1, Math.min(8, parseInt(numCompartmentsInput.value) || 1));
  compartmentBuilder.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const fieldset = document.createElement('fieldset');
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
          <legend>Mechanical Housings</legend>
          <label>Ice maker (L): <input type="number" step="any" class="ice-vol" data-comp="${i}" data-sub="left" placeholder="optional"></label>
          <label>Light housing (L): <input type="number" step="any" class="light-vol" data-comp="${i}" data-sub="left" placeholder="optional"></label>
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
        <fieldset>
          <legend>Mechanical Housings</legend>
          <label>Ice maker (L): <input type="number" step="any" class="ice-vol" data-comp="${i}" data-sub="right" placeholder="optional"></label>
          <label>Light housing (L): <input type="number" step="any" class="light-vol" data-comp="${i}" data-sub="right" placeholder="optional"></label>
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
        <fieldset>
          <legend>Mechanical Housings</legend>
          <label>Ice maker (L): <input type="number" step="any" class="ice-vol" data-comp="${i}" data-sub="" placeholder="optional"></label>
          <label>Light housing (L): <input type="number" step="any" class="light-vol" data-comp="${i}" data-sub="" placeholder="optional"></label>
        </fieldset>
      </div>
    `;
    compartmentBuilder.appendChild(fieldset);
  }

  // Vertical split toggle listeners
  compartmentBuilder.querySelectorAll('input[data-action="toggleVertical"]').forEach(cb => {
    cb.addEventListener('change', function() {
      markDirty();
      const compIdx = this.dataset.comp;
      const vertContainer = document.querySelector(`.verticalSubContainer[data-comp="${compIdx}"]`);
      const singleContainer = document.querySelector(`.singleSubContainer[data-comp="${compIdx}"]`);
      const ratioLabel = document.querySelector(`label.vert-ratio-label[data-comp="${compIdx}"]`);
      if (this.checked) {
        vertContainer.style.display = 'block';
        singleContainer.style.display = 'none';
        if (ratioLabel) ratioLabel.style.display = 'inline';
      } else {
        vertContainer.style.display = 'none';
        singleContainer.style.display = 'block';
        if (ratioLabel) ratioLabel.style.display = 'none';
      }
    });
  });

  // Attach button handlers with sub support
  compartmentBuilder.querySelectorAll('button[data-action="addShelf"]').forEach(btn => {
    btn.addEventListener('click', () => { markDirty(); addShelf(btn.dataset.comp, btn.dataset.sub || ''); });
  });
  compartmentBuilder.querySelectorAll('button[data-action="addDrawer"]').forEach(btn => {
    btn.addEventListener('click', () => { markDirty(); addDrawer(btn.dataset.comp, btn.dataset.sub || ''); });
  });
  compartmentBuilder.querySelectorAll('button[data-action="addBin"]').forEach(btn => {
    btn.addEventListener('click', () => { markDirty(); addBin(btn.dataset.comp, btn.dataset.sub || ''); });
  });
}

// ---- Add fitting helpers (with remove buttons) ------------------------
function addShelf(compIndex, sub = '') {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const container = document.querySelector(`.shelfContainer[data-comp="${compIndex}"]${subAttr}`);
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <label>Pos from floor (mm): <input type="number" step="any" value="100" class="shelf-pos"></label>
    <label>Thickness (mm): <input type="number" step="any" value="5" class="shelf-thick"></label>
    <label>Depth (mm): <input type="number" step="any" value="300" class="shelf-depth"></label>
    <label>Width (mm, blank=full): <input type="number" step="any" class="shelf-width" placeholder="optional"></label>
    <button type="button" class="remove-fitting-btn">✕ Remove</button>
  `;
  container.appendChild(div);
  div.querySelector('.remove-fitting-btn').addEventListener('click', () => {
    div.remove();
    markDirty();
  });
}

function addDrawer(compIndex, sub = '') {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const container = document.querySelector(`.drawerContainer[data-comp="${compIndex}"]${subAttr}`);
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <label>Pos from floor (mm): <input type="number" step="any" value="0" class="drawer-pos"></label>
    <label>Outer W (mm): <input type="number" step="any" value="300" class="drawer-w"></label>
    <label>Outer D (mm): <input type="number" step="any" value="300" class="drawer-d"></label>
    <label>Outer H (mm): <input type="number" step="any" value="150" class="drawer-h"></label>
    <label>Wall t (mm): <input type="number" step="any" value="3" class="drawer-t"></label>
    <button type="button" class="remove-fitting-btn">✕ Remove</button>
  `;
  container.appendChild(div);
  div.querySelector('.remove-fitting-btn').addEventListener('click', () => {
    div.remove();
    markDirty();
  });
}

function addBin(compIndex, sub = '') {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const container = document.querySelector(`.binContainer[data-comp="${compIndex}"]${subAttr}`);
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <label>Outer W (mm): <input type="number" step="any" value="200" class="bin-w"></label>
    <label>Outer H (mm): <input type="number" step="any" value="100" class="bin-h"></label>
    <label>Outer D (mm): <input type="number" step="any" value="80" class="bin-d"></label>
    <label>Wall t (mm): <input type="number" step="any" value="2" class="bin-t"></label>
    <button type="button" class="remove-fitting-btn">✕ Remove</button>
  `;
  container.appendChild(div);
  div.querySelector('.remove-fitting-btn').addEventListener('click', () => {
    div.remove();
    markDirty();
  });
}

// ---- Helpers for housing volumes --------------------------------------
function getHousingInputs(compIndex, sub) {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const iceInput = compartmentBuilder.querySelector(`input.ice-vol[data-comp="${compIndex}"]${subAttr}`);
  const lightInput = compartmentBuilder.querySelector(`input.light-vol[data-comp="${compIndex}"]${subAttr}`);
  return { ice: iceInput, light: lightInput };
}

function getHousingVolumes(compIndex, sub) {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const iceInput = compartmentBuilder.querySelector(`input.ice-vol[data-comp="${compIndex}"]${subAttr}`);
  const lightInput = compartmentBuilder.querySelector(`input.light-vol[data-comp="${compIndex}"]${subAttr}`);
  const iceVol = iceInput && iceInput.value !== '' ? parseFloat(iceInput.value) : null;
  const lightVol = lightInput && lightInput.value !== '' ? parseFloat(lightInput.value) : null;
  return {
    ice: (iceVol != null && !isNaN(iceVol)) ? iceVol : null,
    light: (lightVol != null && !isNaN(lightVol)) ? lightVol : null
  };
}

// ---- Collect fittings from DOM ----------------------------------------
function collectFittings(compIndex, sub, type) {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const containerClass = type === 'shelf' ? 'shelfContainer' :
                         type === 'drawer' ? 'drawerContainer' : 'binContainer';
  const rows = compartmentBuilder.querySelectorAll(`.${containerClass}[data-comp="${compIndex}"]${subAttr} > div`);
  const items = [];
  rows.forEach(row => {
    if (type === 'shelf') {
      const pos = parseFloat(row.querySelector('.shelf-pos').value);
      const thick = parseFloat(row.querySelector('.shelf-thick').value);
      const depth = parseFloat(row.querySelector('.shelf-depth').value);
      const widthInput = row.querySelector('.shelf-width');
      const widthVal = widthInput.value ? parseFloat(widthInput.value) : null;
      if (!isNaN(pos) && !isNaN(thick) && !isNaN(depth)) {
        items.push({
          id: `${compIndex}-${sub}-shelf-${items.length}`,
          positionFromFloor: pos,
          thickness: thick,
          depth: depth,
          width: widthVal,
        });
      }
    } else if (type === 'drawer') {
      const pos   = parseFloat(row.querySelector('.drawer-pos').value);
      const w     = parseFloat(row.querySelector('.drawer-w').value);
      const d     = parseFloat(row.querySelector('.drawer-d').value);
      const h     = parseFloat(row.querySelector('.drawer-h').value);
      const t     = parseFloat(row.querySelector('.drawer-t').value);
      if (!isNaN(w) && !isNaN(d) && !isNaN(h) && !isNaN(t) && !isNaN(pos)) {
        items.push({
          id: `${compIndex}-${sub}-drawer-${items.length}`,
          positionFromFloor: pos,
          outerWidth: w,
          outerDepth: d,
          outerHeight: h,
          wallThickness: t,
        });
      }
    } else if (type === 'bin') {
      const w = parseFloat(row.querySelector('.bin-w').value);
      const h = parseFloat(row.querySelector('.bin-h').value);
      const d = parseFloat(row.querySelector('.bin-d').value);
      const t = parseFloat(row.querySelector('.bin-t').value);
      if (!isNaN(w) && !isNaN(h) && !isNaN(d) && !isNaN(t)) {
        items.push({
          id: `${compIndex}-${sub}-bin-${items.length}`,
          outerWidth: w,
          outerHeight: h,
          outerDepth: d,
          wallThickness: t,
        });
      }
    }
  });
  return items;
}

// ---- Build CabinetConfig from DOM -------------------------------------
function buildConfigFromForm() {
  const external = {
    height: parseFloat(extHeightInput.value),
    width:  parseFloat(extWidthInput.value),
    depth:  parseFloat(extDepthInput.value),
  };
    currentGeometry = readGeometryFromPanel();

  const types = ['fresh','freezer','flex'];
  const faces = ['top','bottom','left','right','rear','door'];
  const wallThicknessesByType = {};
  for (const type of types) {
    wallThicknessesByType[type] = {};
    for (const face of faces) {
      const el = document.getElementById(`wall-${type}-${face}`);
      wallThicknessesByType[type][face] = parseFloat(el.value) || 0;
    }
  }
  wallThicknessByType = wallThicknessesByType;
  const volumeGeom = toVolumeFormat(currentGeometry);

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
      const leftShelves = collectFittings(i, 'left', 'shelf');
      const leftDrawers = collectFittings(i, 'left', 'drawer');
      const leftBins    = collectFittings(i, 'left', 'bin');
      const rightShelves = collectFittings(i, 'right', 'shelf');
      const rightDrawers = collectFittings(i, 'right', 'drawer');
      const rightBins    = collectFittings(i, 'right', 'bin');

      const leftHousing  = getHousingVolumes(i, 'left');
      const rightHousing = getHousingVolumes(i, 'right');

      const divThickness = parseFloat(divVertInput.value) || 20;
      const vertNode = {
        nodeType: 'vertical',
        id: `vert-${i}`,
        dividerThickness: divThickness,
        leftWidthRatio: leftRatio,
        left: {
          nodeType: 'leaf',
          id: `comp${i}-L`,
          type: compType,
          fittings: {
            shelves: leftShelves,
            drawers: leftDrawers,
            doorBins: leftBins,
            iceMakerHousing: { volume: leftHousing.ice },
            lightHousing:    { volume: leftHousing.light },
          },
        },
        right: {
          nodeType: 'leaf',
          id: `comp${i}-R`,
          type: compType,
          fittings: {
            shelves: rightShelves,
            drawers: rightDrawers,
            doorBins: rightBins,
            iceMakerHousing: { volume: rightHousing.ice },
            lightHousing:    { volume: rightHousing.light },
          },
        },
      };
      leaves.push({
        heightMode: 'ratio',
        heightValue: heightRatio,
        node: vertNode,
      });
    } else {
      const shelves = collectFittings(i, '', 'shelf');
      const drawers = collectFittings(i, '', 'drawer');
      const bins    = collectFittings(i, '', 'bin');
      const housing = getHousingVolumes(i, '');

      leaves.push({
        heightMode: 'ratio',
        heightValue: heightRatio,
        node: {
          nodeType: 'leaf',
          id: `comp${i}`,
          type: compType,
          fittings: {
            shelves,
            drawers,
            doorBins: bins,
            iceMakerHousing: { volume: housing.ice },
            lightHousing:    { volume: housing.light },
          },
        },
      });
    }
  }

  const totalRatio = leaves.reduce((s, l) => s + l.heightValue, 0);
  if (totalRatio > 0) { leaves.forEach(l => l.heightValue /= totalRatio); }

  const rootNode = {
    nodeType: 'horizontal',
    id: 'root',
    children: leaves.map(l => ({
      heightMode: l.heightMode,
      heightValue: l.heightValue,
      node: l.node,
    })),
    dividers: Array.from({ length: leaves.length - 1 }, (_, i) => ({
      afterChildIndex: i,
      thickness: parseFloat(divHorizInput.value) || 20,
    })),
  };

  const cabinet = {
    external: volumeGeom.external,
    wallThicknessesByType: volumeGeom.wallThicknessesByType,
    airGap: volumeGeom.airGap,
    layout: rootNode,
  };

  return {
    schemaVersion: '2.0',
    meta: {
      name: 'UI Config',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    cabinet
  };
}


// ---- Populate UI from loaded config -----------------------------------
function populateUIFromConfig(config) {
  extHeightInput.value = config.cabinet.external.height;
  extWidthInput.value  = config.cabinet.external.width;
  extDepthInput.value  = config.cabinet.external.depth;
  sealOffsetInput.value = config.cabinet.airGap;

  let perType = config.cabinet.wallThicknessesByType;
  if (!perType && config.cabinet.wallThicknesses) {
    const old = config.cabinet.wallThicknesses;
    perType = {};
    for (const type of ['fresh','freezer','flex']) { perType[type] = { ...old }; }
  } else if (!perType) {
    const def = { top:50, bottom:50, left:50, right:50, rear:50, door:70 };
    perType = {};
    for (const type of ['fresh','freezer','flex']) { perType[type] = { ...def }; }
  }
  wallThicknessByType = perType;
  buildWallThicknessUI();

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

    if (child.node.nodeType === 'leaf') {
      const vertCheckbox = document.querySelector(`input[data-action="toggleVertical"][data-comp="${compIdx}"]`);
      if (vertCheckbox) vertCheckbox.checked = false;
      const singleContainer = document.querySelector(`.singleSubContainer[data-comp="${compIdx}"]`);
      const vertContainer   = document.querySelector(`.verticalSubContainer[data-comp="${compIdx}"]`);
      const ratioLabel      = document.querySelector(`label.vert-ratio-label[data-comp="${compIdx}"]`);
      if (singleContainer) singleContainer.style.display = 'block';
      if (vertContainer)   vertContainer.style.display   = 'none';
      if (ratioLabel)      ratioLabel.style.display      = 'none';

      const leaf = child.node;
      const typeSelect = document.querySelector(`select[data-comp="${compIdx}"][data-field="type"]`);
      if (typeSelect) typeSelect.value = leaf.type;

      addFittingsToDOM(compIdx, '', leaf.fittings);
      const housingInputs = getHousingInputs(compIdx, '');
      if (housingInputs.ice) housingInputs.ice.value = leaf.fittings.iceMakerHousing?.volume ?? '';
      if (housingInputs.light) housingInputs.light.value = leaf.fittings.lightHousing?.volume ?? '';
    } else if (child.node.nodeType === 'vertical') {
      const vertCheckbox = document.querySelector(`input[data-action="toggleVertical"][data-comp="${compIdx}"]`);
      if (vertCheckbox) vertCheckbox.checked = true;
      const singleContainer = document.querySelector(`.singleSubContainer[data-comp="${compIdx}"]`);
      const vertContainer   = document.querySelector(`.verticalSubContainer[data-comp="${compIdx}"]`);
      const ratioLabel      = document.querySelector(`label.vert-ratio-label[data-comp="${compIdx}"]`);
      if (singleContainer) singleContainer.style.display = 'none';
      if (vertContainer)   vertContainer.style.display   = 'block';
      if (ratioLabel)      ratioLabel.style.display      = 'inline';

      const leftRatioInput = document.querySelector(`input[data-comp="${compIdx}"][data-field="leftWidthRatio"]`);
      if (leftRatioInput) leftRatioInput.value = child.node.leftWidthRatio;

      const typeSelect = document.querySelector(`select[data-comp="${compIdx}"][data-field="type"]`);
      if (typeSelect && child.node.left && child.node.left.type) {
        typeSelect.value = child.node.left.type;
      }

      addFittingsToDOM(compIdx, 'left',  child.node.left.fittings);
      addFittingsToDOM(compIdx, 'right', child.node.right.fittings);

      const leftHousingInputs = getHousingInputs(compIdx, 'left');
      if (leftHousingInputs.ice) leftHousingInputs.ice.value = child.node.left.fittings.iceMakerHousing?.volume ?? '';
      if (leftHousingInputs.light) leftHousingInputs.light.value = child.node.left.fittings.lightHousing?.volume ?? '';

      const rightHousingInputs = getHousingInputs(compIdx, 'right');
      if (rightHousingInputs.ice) rightHousingInputs.ice.value = child.node.right.fittings.iceMakerHousing?.volume ?? '';
      if (rightHousingInputs.light) rightHousingInputs.light.value = child.node.right.fittings.lightHousing?.volume ?? '';
    }
  }
}

function addFittingsToDOM(compIdx, sub, fittings) {
  if (!fittings) return;
  for (const shelf of fittings.shelves ?? []) { addShelf(compIdx, sub); /* set values */ }
  for (const drawer of fittings.drawers ?? []) { addDrawer(compIdx, sub); /* set values */ }
  for (const bin of fittings.doorBins ?? []) { addBin(compIdx, sub); /* set values */ }
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

// ---- Calculate --------------------------------------------------------
calculateBtn.addEventListener('click', () => {
  const config = buildConfigFromForm();
  currentConfig = config;
  if (currentConfig) {
    storeSlotABtn.style.display = 'inline-block';
    storeSlotBBtn.style.display = 'inline-block';
    compareSlotsBtn.style.display = (configSlotA || configSlotB) ? 'inline-block' : 'none';
  }
  const result = runCalculation(config);

  if (result.leaves && result.totals) {
    const disp = formatTotalsDisplay(result.totals);
    document.getElementById('grossVol').textContent      = disp.gross;
    document.getElementById('egNetVol').textContent      = disp.egNet;
    document.getElementById('iecNetVol').textContent     = disp.iecNet;
    document.getElementById('grossVolCuft').textContent  = disp.grossCuft;
    document.getElementById('egNetVolCuft').textContent  = disp.egNetCuft;
    document.getElementById('iecNetVolCuft').textContent = disp.iecNetCuft;
  }

  showMessages(result.validationErrors, result.warnings, result.calcErrors);

  const canvas = document.getElementById('schematicCanvas');
  if (canvas) {
    canvas.width = settings.canvasWidth;
    canvas.height = settings.canvasHeight;
    if (result.leaves && result.leaves.length > 0) {
      const effectiveWalls = getEffectiveThicknesses(currentConfig);
      drawSchematic(result.leaves, effectiveWalls, currentConfig, canvas, schematicTooltip);
      dirtySchematic = false;
      schematicOverlay.classList.add('hidden');
    } else {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirtySchematic = false;
      schematicOverlay.classList.add('hidden');
    }
  }
});

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
      if (result.leaves && result.totals) {
        const disp = formatTotalsDisplay(result.totals);
        document.getElementById('grossVol').textContent      = disp.gross;
        document.getElementById('egNetVol').textContent      = disp.egNet;
        document.getElementById('iecNetVol').textContent     = disp.iecNet;
        document.getElementById('grossVolCuft').textContent  = disp.grossCuft;
        document.getElementById('egNetVolCuft').textContent  = disp.egNetCuft;
        document.getElementById('iecNetVolCuft').textContent = disp.iecNetCuft;
      }
      showMessages(result.validationErrors, result.warnings, result.calcErrors);

      const canvas = document.getElementById('schematicCanvas');
      if (canvas) {
        canvas.width = settings.canvasWidth;
        canvas.height = settings.canvasHeight;
        if (result.leaves && result.leaves.length > 0) {
          const effectiveWalls = getEffectiveThicknesses(currentConfig);
          drawSchematic(result.leaves, effectiveWalls, currentConfig, canvas, schematicTooltip);
          dirtySchematic = false;
          schematicOverlay.classList.add('hidden');
        }
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

  extHeightInput.value = '';
  extWidthInput.value  = '';
  extDepthInput.value  = '';
  divHorizInput.value  = 20;
  divVertInput.value   = 20;
  sealOffsetInput.value = 5;
  numCompartmentsInput.value = 2;
  storeSlotABtn.style.display = 'none';
  storeSlotBBtn.style.display = 'none';
  compareSlotsBtn.style.display = 'none';
  configSlotA = null;
  configSlotB = null;

  // Reset per-type walls to defaults
  wallThicknessByType = null;
  buildWallThicknessUI();

  buildCompartmentUI();

  document.getElementById('grossVol').textContent      = '--';
  document.getElementById('egNetVol').textContent      = '--';
  document.getElementById('iecNetVol').textContent     = '--';
  document.getElementById('grossVolCuft').textContent  = '--';
  document.getElementById('egNetVolCuft').textContent  = '--';
  document.getElementById('iecNetVolCuft').textContent = '--';

  messagesDiv.innerHTML = '';
  messagesFieldset.style.display = 'none';

  const canvas = document.getElementById('schematicCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
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
  const fmtTotals = (totals) => {
    if (!totals) return { gross:'-', egNet:'-', iecNet:'-', grossCuft:'-', egNetCuft:'-', iecNetCuft:'-' };
    return formatTotalsDisplay(totals);
  };
  const tA = fmtTotals(hasLeavesA ? resultA.totals : null);
  const tB = fmtTotals(hasLeavesB ? resultB.totals : null);
  let html = `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <thead><tr><th></th><th colspan="2">Slot A</th><th colspan="2">Slot B</th></tr>
      <tr><th></th><th>Litres</th><th>cu.ft.</th><th>Litres</th><th>cu.ft.</th></tr></thead>
      <tbody><tr><td><strong>Gross</strong></td><td>${tA.gross}</td><td>${tA.grossCuft}</td><td>${tB.gross}</td><td>${tB.grossCuft}</td></tr>
      <tr><td><strong>EG Net</strong></td><td>${tA.egNet}</td><td>${tA.egNetCuft}</td><td>${tB.egNet}</td><td>${tB.egNetCuft}</td></tr>
      <tr><td><strong>IEC Net</strong></td><td>${tA.iecNet}</td><td>${tA.iecNetCuft}</td><td>${tB.iecNet}</td><td>${tB.iecNetCuft}</td></tr>
      </tbody></table>`;
  if (hasLeavesA && resultA.leaves.length > 0 && hasLeavesB && resultB.leaves.length > 0) {
    html += `<h3>Per‑Compartment Breakdown</h3>`;
    const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
    html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <tr><th>Compartment</th><th colspan="3">Slot A</th><th colspan="3">Slot B</th></tr>
      <tr><th></th><th>Gross</th><th>EG</th><th>IEC</th><th>Gross</th><th>EG</th><th>IEC</th></tr>`;
    for (let i = 0; i < maxLeaves; i++) {
      const leafA = resultA.leaves[i], leafB = resultB.leaves[i];
      const fmtA = leafA ? formatLeafDisplay(leafA) : { gross:'-', egNet:'-', iecNet:'-' };
      const fmtB = leafB ? formatLeafDisplay(leafB) : { gross:'-', egNet:'-', iecNet:'-' };
      html += `<tr><td>Comp ${i+1}</td><td>${fmtA.gross}</td><td>${fmtA.egNet}</td><td>${fmtA.iecNet}</td><td>${fmtB.gross}</td><td>${fmtB.egNet}</td><td>${fmtB.iecNet}</td></tr>`;
    }
    html += `</table>`;
  }
  comparisonContent.innerHTML = html;
}