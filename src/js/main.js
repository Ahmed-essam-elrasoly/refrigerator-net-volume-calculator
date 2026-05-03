import { runCalculation } from './engine/index.js';
import { downloadConfigJSON, loadConfigFromFile, downloadResultsCSV } from './io/io.js';

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

let currentConfig = null;

// ---- Dynamic compartment builder -------------------------------------
numCompartmentsInput.addEventListener('input', buildCompartmentUI);
buildCompartmentUI(); // initial draw

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

  // Attach button handlers
  compartmentBuilder.querySelectorAll('button[data-action="addShelf"]').forEach(btn => {
    btn.addEventListener('click', () => addShelf(btn.dataset.comp));
  });
  compartmentBuilder.querySelectorAll('button[data-action="addDrawer"]').forEach(btn => {
    btn.addEventListener('click', () => addDrawer(btn.dataset.comp));
  });
  compartmentBuilder.querySelectorAll('button[data-action="addBin"]').forEach(btn => {
    btn.addEventListener('click', () => addBin(btn.dataset.comp));
  });
}

// ---- Add fitting helpers (called via "Add Shelf/..." buttons) --------
function addShelf(compIndex) {
  const container = document.querySelector(`.shelfContainer[data-comp="${compIndex}"]`);
  const div = document.createElement('div');
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
  const div = document.createElement('div');
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
  const div = document.createElement('div');
  div.innerHTML = `
    <label>Outer W (mm): <input type="number" step="any" value="200" class="bin-w"></label>
    <label>Outer H (mm): <input type="number" step="any" value="100" class="bin-h"></label>
    <label>Outer D (mm): <input type="number" step="any" value="80" class="bin-d"></label>
    <label>Wall t (mm): <input type="number" step="any" value="2" class="bin-t"></label>
  `;
  container.appendChild(div);
}

// ---- Build CabinetConfig from DOM ------------------------------------
function buildConfigFromForm() {
  // External / wall / air gap
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

  // Compartments (leaves)
  const count = parseInt(numCompartmentsInput.value) || 1;
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const typeSelect = compartmentBuilder.querySelector(`select[data-comp="${i}"][data-field="type"]`);
    const heightRatioInput = compartmentBuilder.querySelector(`input[data-comp="${i}"][data-field="heightRatio"]`);
    const compType = typeSelect.value;
    const heightRatio = parseFloat(heightRatioInput.value) || 0.5;

    // Collect shelves
    const shelfRows = compartmentBuilder.querySelectorAll(`.shelfContainer[data-comp="${i}"] > div`);
    const shelves = [];
    shelfRows.forEach(row => {
      const pos   = parseFloat(row.querySelector('.shelf-pos').value);
      const thick = parseFloat(row.querySelector('.shelf-thick').value);
      const depth = parseFloat(row.querySelector('.shelf-depth').value);
      const widthInput = row.querySelector('.shelf-width');
      const widthVal = widthInput.value ? parseFloat(widthInput.value) : null;
      if (!isNaN(pos) && !isNaN(thick) && !isNaN(depth)) {
        shelves.push({
          id: `${i}-shelf-${shelves.length}`,
          positionFromFloor: pos,
          thickness: thick,
          depth: depth,
          width: widthVal,
        });
      }
    });

    // Collect drawers
    const drawerRows = compartmentBuilder.querySelectorAll(`.drawerContainer[data-comp="${i}"] > div`);
    const drawers = [];
    drawerRows.forEach(row => {
      const w = parseFloat(row.querySelector('.drawer-w').value);
      const d = parseFloat(row.querySelector('.drawer-d').value);
      const h = parseFloat(row.querySelector('.drawer-h').value);
      const t = parseFloat(row.querySelector('.drawer-t').value);
      if (!isNaN(w) && !isNaN(d) && !isNaN(h) && !isNaN(t)) {
        drawers.push({
          id: `${i}-drawer-${drawers.length}`,
          outerWidth: w,
          outerDepth: d,
          outerHeight: h,
          wallThickness: t,
        });
      }
    });

    // Collect door bins
    const binRows = compartmentBuilder.querySelectorAll(`.binContainer[data-comp="${i}"] > div`);
    const doorBins = [];
    binRows.forEach(row => {
      const w = parseFloat(row.querySelector('.bin-w').value);
      const h = parseFloat(row.querySelector('.bin-h').value);
      const d = parseFloat(row.querySelector('.bin-d').value);
      const t = parseFloat(row.querySelector('.bin-t').value);
      if (!isNaN(w) && !isNaN(h) && !isNaN(d) && !isNaN(t)) {
        doorBins.push({
          id: `${i}-bin-${doorBins.length}`,
          outerWidth: w,
          outerHeight: h,
          outerDepth: d,
          wallThickness: t,
        });
      }
    });

    leaves.push({
      id: `comp${i}`,
      nodeType: 'leaf',
      type: compType,
      fittings: {
        shelves,
        drawers,
        doorBins,
        iceMakerHousing: { volume: null },
        lightHousing: { volume: null },
      },
      heightMode: 'ratio',
      heightValue: heightRatio,
    });
  }

  // Build a simple horizontal (stacked) layout from the leaves
  // Use ratio mode and evenly distribute height (summing to 1)
  // But since we collected explicit heightRatios, we need to normalise them.
  const totalRatio = leaves.reduce((s, l) => s + l.heightValue, 0);
  if (totalRatio > 0) {
    leaves.forEach(l => l.heightValue /= totalRatio);
  }

  const rootNode = {
    nodeType: 'horizontal',
    id: 'root',
    children: leaves.map((leaf, idx) => ({
      heightMode: 'ratio',
      heightValue: leaf.heightValue,
      node: {
        nodeType: 'leaf',
        id: leaf.id,
        type: leaf.type,
        fittings: leaf.fittings,
      },
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

  showMessages(result.validationErrors, result.warnings, result.calcErrors);

  if (result.leaves && result.totals) {
    document.getElementById('grossVol').textContent      = result.totals.gross.toFixed(2);
    document.getElementById('egNetVol').textContent      = result.totals.egNet.toFixed(2);
    document.getElementById('iecNetVol').textContent     = result.totals.iecNet.toFixed(2);
    document.getElementById('grossVolCuft').textContent  = (result.totals.gross * 0.0353147).toFixed(3);
    document.getElementById('egNetVolCuft').textContent  = (result.totals.egNet * 0.0353147).toFixed(3);
    document.getElementById('iecNetVolCuft').textContent = (result.totals.iecNet * 0.0353147).toFixed(3);
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
      // Populate form from loaded config (simplified: just set external dims)
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
      alert('Configuration loaded (only external fields restored).');
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