import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';
import { drawSchematic } from './ui/schematic.js';
import { initSettingsModal, showModal } from './ui/settingsModal.js';
import { settings } from './settings.js';
import { formatTotalsDisplay } from './engine/calc.js';

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
            iceMakerHousing: { volume: null },
            lightHousing: { volume: null },
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
            iceMakerHousing: { volume: null },
            lightHousing: { volume: null },
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
            iceMakerHousing: { volume: null },
            lightHousing: { volume: null },
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
        drawSchematic(result.leaves, currentConfig, canvas, schematicTooltip);
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
