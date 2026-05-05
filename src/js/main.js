import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawSchematic } from './ui/schematic.js';
import { initSettingsModal, showModal } from './ui/settingsModal.js';
import { settings } from './settings.js';
import { formatTotalsDisplay, formatLeafDisplay } from './engine/calc.js';

// ---- DOM references ---------------------------------------------------
const extHeightInput      = document.getElementById('extHeight');
const extWidthInput       = document.getElementById('extWidth');
const extDepthInput       = document.getElementById('extDepth');
const wallTopInput        = document.getElementById('wallTop');
const wallBottomInput     = document.getElementById('wallBottom');
const wallLeftInput       = document.getElementById('wallLeft');
const wallRightInput      = document.getElementById('wallRight');
const wallRearInput       = document.getElementById('wallRear');
const wallDoorInput       = document.getElementById('wallDoor');
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
const resetAllBtn        = document.getElementById('resetAllBtn');
const storeSlotABtn      = document.getElementById('storeSlotABtn');
const storeSlotBBtn      = document.getElementById('storeSlotBBtn');
const compareSlotsBtn    = document.getElementById('compareSlotsBtn');
const comparisonModal    = document.getElementById('comparisonModal');
const closeComparison    = document.getElementById('closeComparison');
const comparisonContent  = document.getElementById('comparisonContent');

let configSlotA = null;
let configSlotB = null;
let currentConfig = null;
let dirtySchematic = false;

// ---- Mark schematic dirty on any input change ------------------------
function markDirty() {
  dirtySchematic = true;
  if (settings.showDirtyOverlay) {
    schematicOverlay.classList.remove('hidden');
  } else {
    schematicOverlay.classList.add('hidden');
  }
}

// Attach input listeners to all relevant fields
document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', markDirty));

// ---- Dynamic compartment builder -------------------------------------
numCompartmentsInput.addEventListener('input', () => {
  markDirty();
  buildCompartmentUI();
});
buildCompartmentUI();

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
          <label>Light housing (L): <input type="number" step="any" class="light-vol" data-comp="${i}" data-sub="" placeholder="optional"></label>        </fieldset>
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
function addFittingsToDOM(compIdx, sub, fittings) {
  if (!fittings) return;

  // Shelves
  for (const shelf of fittings.shelves ?? []) {
    addShelf(compIdx, sub);
    // Find the last added shelf row (the one we just created)
    const container = document.querySelector(`.shelfContainer[data-comp="${compIdx}"]${sub ? `[data-sub="${sub}"]` : ':not([data-sub])'}`);
    if (!container) continue;
    const rows = container.querySelectorAll(':scope > div');
    const lastRow = rows[rows.length - 1];
    if (!lastRow) continue;
    lastRow.querySelector('.shelf-pos').value   = shelf.positionFromFloor;
    lastRow.querySelector('.shelf-thick').value  = shelf.thickness;
    lastRow.querySelector('.shelf-depth').value  = shelf.depth;
    const widthInput = lastRow.querySelector('.shelf-width');
    if (widthInput) widthInput.value = shelf.width !== null ? shelf.width : '';
  }

  // Drawers
  for (const drawer of fittings.drawers ?? []) {
    addDrawer(compIdx, sub);
    const container = document.querySelector(`.drawerContainer[data-comp="${compIdx}"]${sub ? `[data-sub="${sub}"]` : ':not([data-sub])'}`);
    if (!container) continue;
    const rows = container.querySelectorAll(':scope > div');
    const lastRow = rows[rows.length - 1];
    if (!lastRow) continue;
    lastRow.querySelector('.drawer-pos').value = drawer.positionFromFloor ?? 0;
    lastRow.querySelector('.drawer-w').value   = drawer.outerWidth;
    lastRow.querySelector('.drawer-d').value   = drawer.outerDepth;
    lastRow.querySelector('.drawer-h').value   = drawer.outerHeight;
    lastRow.querySelector('.drawer-t').value   = drawer.wallThickness;
  }

  // Door bins
  for (const bin of fittings.doorBins ?? []) {
    addBin(compIdx, sub);
    const container = document.querySelector(`.binContainer[data-comp="${compIdx}"]${sub ? `[data-sub="${sub}"]` : ':not([data-sub])'}`);
    if (!container) continue;
    const rows = container.querySelectorAll(':scope > div');
    const lastRow = rows[rows.length - 1];
    if (!lastRow) continue;
    lastRow.querySelector('.bin-w').value = bin.outerWidth;
    lastRow.querySelector('.bin-h').value = bin.outerHeight;
    lastRow.querySelector('.bin-d').value = bin.outerDepth;
    lastRow.querySelector('.bin-t').value = bin.wallThickness;
  }
}
function getHousingInputs(compIndex, sub) {
  const subAttr = sub ? `[data-sub="${sub}"]` : ':not([data-sub])';
  const iceInput = compartmentBuilder.querySelector(`input.ice-vol[data-comp="${compIndex}"]${subAttr}`);
  const lightInput = compartmentBuilder.querySelector(`input.light-vol[data-comp="${compIndex}"]${subAttr}`);
  return { ice: iceInput, light: lightInput };
}
// ---- Add fitting helpers (updated with position for drawers) --------
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
  `;
  container.appendChild(div);
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
  `;
  container.appendChild(div);
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
  `;
  container.appendChild(div);
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
// ---- Helper to collect fittings for a given compartment and sub ------
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

// ---- Build CabinetConfig from DOM ------------------------------------
function buildConfigFromForm() {
  const external = {
    height: parseFloat(extHeightInput.value),
    width:  parseFloat(extWidthInput.value),
    depth:  parseFloat(extDepthInput.value),
  };
  const wallThicknesses = {
    top:    parseFloat(wallTopInput.value),
    bottom: parseFloat(wallBottomInput.value),
    left:   parseFloat(wallLeftInput.value),
    right:  parseFloat(wallRightInput.value),
    rear:   parseFloat(wallRearInput.value),
    door:   parseFloat(wallDoorInput.value),
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
      const housing = getHousingVolumes(i, '');   // ← new

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
            iceMakerHousing: { volume: housing.ice },    // ← new
            lightHousing: { volume: housing.light },     // ← new
          },
        },
      });
    }
  }

  // Normalise height ratios
  const totalRatio = leaves.reduce((s, l) => s + l.heightValue, 0);
  if (totalRatio > 0) {
    leaves.forEach(l => l.heightValue /= totalRatio);
  }

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

  return {
    schemaVersion: '1.0',
    meta: {
      name: 'UI Config',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    cabinet: {
      external,
      wallThicknesses,
      airGap,
      layout: rootNode,
    },
  };
}
function populateUIFromConfig(config) {
  // 1. External dims & walls
  extHeightInput.value = config.cabinet.external.height;
  extWidthInput.value  = config.cabinet.external.width;
  extDepthInput.value  = config.cabinet.external.depth;
  wallTopInput.value   = config.cabinet.wallThicknesses.top;
  wallBottomInput.value= config.cabinet.wallThicknesses.bottom;
  wallLeftInput.value  = config.cabinet.wallThicknesses.left;
  wallRightInput.value = config.cabinet.wallThicknesses.right;
  wallRearInput.value  = config.cabinet.wallThicknesses.rear;
  wallDoorInput.value  = config.cabinet.wallThicknesses.door;
  sealOffsetInput.value= config.cabinet.airGap;

  const layout = config.cabinet.layout;
  if (layout.nodeType !== 'horizontal') return; // safety

  const compartmentCount = layout.children.length;
  numCompartmentsInput.value = compartmentCount;
  buildCompartmentUI();   // redraw compartments

  // 2. Fill each compartment
  for (let i = 0; i < compartmentCount; i++) {
    const child = layout.children[i];
    const compIdx = i;

    // Height ratio
    const heightRatioInput = document.querySelector(`input[data-comp="${compIdx}"][data-field="heightRatio"]`);
    if (heightRatioInput) heightRatioInput.value = child.heightValue;

    // ----- Handle leaf or vertical split -----
    if (child.node.nodeType === 'leaf') {
      // Non‑split
      const vertCheckbox = document.querySelector(`input[data-action="toggleVertical"][data-comp="${compIdx}"]`);
      if (vertCheckbox) vertCheckbox.checked = false;
      const singleContainer = document.querySelector(`.singleSubContainer[data-comp="${compIdx}"]`);
      const vertContainer   = document.querySelector(`.verticalSubContainer[data-comp="${compIdx}"]`);
      const ratioLabel      = document.querySelector(`label.vert-ratio-label[data-comp="${compIdx}"]`);
      if (singleContainer) singleContainer.style.display = 'block';
      if (vertContainer)   vertContainer.style.display   = 'none';
      if (ratioLabel)      ratioLabel.style.display      = 'none';

      const leaf = child.node;
      // Type
      const typeSelect = document.querySelector(`select[data-comp="${compIdx}"][data-field="type"]`);
      if (typeSelect) typeSelect.value = leaf.type;

      // Add fittings
      addFittingsToDOM(compIdx, '', leaf.fittings);
      // Set housing volumes
      const housingInputs = getHousingInputs(compIdx, '');
      if (housingInputs.ice) housingInputs.ice.value = leaf.fittings.iceMakerHousing?.volume ?? '';
      if (housingInputs.light) housingInputs.light.value = leaf.fittings.lightHousing?.volume ?? '';
    } else if (child.node.nodeType === 'vertical') {
      // Vertical split
      const vertCheckbox = document.querySelector(`input[data-action="toggleVertical"][data-comp="${compIdx}"]`);
      if (vertCheckbox) vertCheckbox.checked = true;
      const singleContainer = document.querySelector(`.singleSubContainer[data-comp="${compIdx}"]`);
      const vertContainer   = document.querySelector(`.verticalSubContainer[data-comp="${compIdx}"]`);
      const ratioLabel      = document.querySelector(`label.vert-ratio-label[data-comp="${compIdx}"]`);
      if (singleContainer) singleContainer.style.display = 'none';
      if (vertContainer)   vertContainer.style.display   = 'block';
      if (ratioLabel)      ratioLabel.style.display      = 'inline';

      // Left width ratio
      const leftRatioInput = document.querySelector(`input[data-comp="${compIdx}"][data-field="leftWidthRatio"]`);
      if (leftRatioInput) leftRatioInput.value = child.node.leftWidthRatio;

      // The whole compartment gets the type from the left leaf (they must match in UI)
      const typeSelect = document.querySelector(`select[data-comp="${compIdx}"][data-field="type"]`);
      if (typeSelect && child.node.left && child.node.left.type) {
        typeSelect.value = child.node.left.type;
      }

      // Add fittings to left and right sub‑compartments
      addFittingsToDOM(compIdx, 'left',  child.node.left.fittings);
      addFittingsToDOM(compIdx, 'right', child.node.right.fittings);
            // Restore left housing
      const leftHousingInputs = getHousingInputs(compIdx, 'left');
      if (leftHousingInputs.ice) leftHousingInputs.ice.value = child.node.left.fittings.iceMakerHousing?.volume ?? '';
      if (leftHousingInputs.light) leftHousingInputs.light.value = child.node.left.fittings.lightHousing?.volume ?? '';

      // Restore right housing
      const rightHousingInputs = getHousingInputs(compIdx, 'right');
      if (rightHousingInputs.ice) rightHousingInputs.ice.value = child.node.right.fittings.iceMakerHousing?.volume ?? '';
      if (rightHousingInputs.light) rightHousingInputs.light.value = child.node.right.fittings.lightHousing?.volume ?? '';
    }
  }
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

  // Apply canvas size from settings before drawing
  const canvas = document.getElementById('schematicCanvas');
  if (canvas) {
    canvas.width = settings.canvasWidth;
    canvas.height = settings.canvasHeight;
    if (result.leaves && result.leaves.length > 0) {
      drawSchematic(result.leaves, currentConfig, canvas, schematicTooltip);
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
      // Fully restore the form
      populateUIFromConfig(config);

      // Recalculate and draw
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
          drawSchematic(result.leaves, currentConfig, canvas, schematicTooltip);
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

  // Reset all number inputs to their default values (or predefined defaults)
  extHeightInput.value = '';
  extWidthInput.value  = '';
  extDepthInput.value  = '';
  wallTopInput.value   = 50;
  wallBottomInput.value= 50;
  wallLeftInput.value  = 50;
  wallRightInput.value = 50;
  wallRearInput.value  = 50;
  wallDoorInput.value  = 70;
  divHorizInput.value  = 20;
  divVertInput.value   = 20;
  sealOffsetInput.value = 5;
  numCompartmentsInput.value = 2;
  storeSlotABtn.style.display = 'none';
  storeSlotBBtn.style.display = 'none';
  compareSlotsBtn.style.display = 'none';
  configSlotA = null;
  configSlotB = null;
  // Clear compartment builder and rebuild default (2 fresh compartments)
  buildCompartmentUI();

  // Clear results
  document.getElementById('grossVol').textContent      = '--';
  document.getElementById('egNetVol').textContent      = '--';
  document.getElementById('iecNetVol').textContent     = '--';
  document.getElementById('grossVolCuft').textContent  = '--';
  document.getElementById('egNetVolCuft').textContent  = '--';
  document.getElementById('iecNetVolCuft').textContent = '--';

  // Clear messages
  messagesDiv.innerHTML = '';
  messagesFieldset.style.display = 'none';

  // Clear schematic
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
  configSlotA = JSON.parse(JSON.stringify(currentConfig)); // deep clone
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

  // Calculate results for stored configs
  let resultA = null, resultB = null;
  if (configSlotA) resultA = runCalculation(configSlotA);
  if (configSlotB) resultB = runCalculation(configSlotB);

  buildComparisonTable(resultA, resultB);
  comparisonModal.classList.remove('hidden');
});

closeComparison.addEventListener('click', () => {
  comparisonModal.classList.add('hidden');
});

// Close modal on outside click
window.addEventListener('click', (e) => {
  if (e.target === comparisonModal) comparisonModal.classList.add('hidden');
});

function buildComparisonTable(resultA, resultB) {
  if (!resultA && !resultB) {
    comparisonContent.innerHTML = '<p>No configurations stored.</p>';
    return;
  }

  const hasLeavesA = resultA && resultA.leaves && resultA.totals;
  const hasLeavesB = resultB && resultB.leaves && resultB.totals;

  // Helper to format a totals object
  const fmtTotals = (totals) => {
    if (!totals) return { gross:'-', egNet:'-', iecNet:'-', grossCuft:'-', egNetCuft:'-', iecNetCuft:'-' };
    const d = formatTotalsDisplay(totals);
    return d;
  };

  const tA = fmtTotals(hasLeavesA ? resultA.totals : null);
  const tB = fmtTotals(hasLeavesB ? resultB.totals : null);

  let html = `
    <table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th></th>
          <th colspan="2">Slot A</th>
          <th colspan="2">Slot B</th>
        </tr>
        <tr>
          <th></th>
          <th>Litres</th><th>cu.ft.</th>
          <th>Litres</th><th>cu.ft.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Gross</strong></td>
          <td>${tA.gross}</td><td>${tA.grossCuft}</td>
          <td>${tB.gross}</td><td>${tB.grossCuft}</td>
        </tr>
        <tr>
          <td><strong>EG Net</strong></td>
          <td>${tA.egNet}</td><td>${tA.egNetCuft}</td>
          <td>${tB.egNet}</td><td>${tB.egNetCuft}</td>
        </tr>
        <tr>
          <td><strong>IEC Net</strong></td>
          <td>${tA.iecNet}</td><td>${tA.iecNetCuft}</td>
          <td>${tB.iecNet}</td><td>${tB.iecNetCuft}</td>
        </tr>
        </tbody>
    </table>
  `;

  // Per‑compartment breakdown
  if (hasLeavesA && resultA.leaves.length > 0 && hasLeavesB && resultB.leaves.length > 0) {
    html += `<h3>Per‑Compartment Breakdown</h3>`;
    const maxLeaves = Math.max(resultA.leaves.length, resultB.leaves.length);
    html += `<table border="1" cellspacing="0" cellpadding="5" style="width:100%; border-collapse: collapse;">`;
    html += `<tr><th>Compartment</th><th colspan="3">Slot A</th><th colspan="3">Slot B</th></tr>`;
    html += `<tr><th></th><th>Gross</th><th>EG</th><th>IEC</th><th>Gross</th><th>EG</th><th>IEC</th></tr>`;
    for (let i = 0; i < maxLeaves; i++) {
      const leafA = resultA.leaves[i];
      const leafB = resultB.leaves[i];
      const fmtA = leafA ? formatLeafDisplay(leafA) : { gross:'-', egNet:'-', iecNet:'-' };
      const fmtB = leafB ? formatLeafDisplay(leafB) : { gross:'-', egNet:'-', iecNet:'-' };
      html += `<tr>
        <td>Comp ${i+1}</td>
        <td>${fmtA.gross}</td><td>${fmtA.egNet}</td><td>${fmtA.iecNet}</td>
        <td>${fmtB.gross}</td><td>${fmtB.egNet}</td><td>${fmtB.iecNet}</td>
        </tr>`;
    }
    html += `</table>`;
  }

  comparisonContent.innerHTML = html;
}