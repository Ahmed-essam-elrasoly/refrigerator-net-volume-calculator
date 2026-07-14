// ──────────────────────────────────────────────────────────────────────────────
// thermoUI.js — Thermal analysis panel
//   • Fan airflow is now calculated from fan geometry & RPM, not user‑entered.
//   • Modal is built once; values are refreshed each time it opens.
//   • Accepts an options object for cleaner injection of the geometry provider.
//   • Fan airflow is displayed in the results report.
//   • Full compressor management (add/edit/delete) via 3×3 matrix.
// ──────────────────────────────────────────────────────────────────────────────

import { runThermoAnalysis, buildDefaultConfig } from '../engine/thermo/index.js';
import { toThermalFormat } from '../engine/geometry.js';
import { SJ54H_COMPONENTS } from '../engine/thermo/defaultComponents.js';
import {
  loadCompressors,
  getCompressorList,
  getCurrentCompressor,
  setSelectedCompressor,
  addCompressor,
  deleteCompressor
} from '../compressorManager.js';
import { computeCompressorCoefficients } from '../engine/thermo/CompressorPerformance.js';
import { EnergyConsumption } from '../engine/thermo/solver.js';
import { settings, updateSettings } from '../settings.js';
import { computeEvaporatorArea, airSpeed, evaporatorAlpha, lmtd, evaporatorCapacity } from '../engine/thermo/evaporator.js';

// ---------------------------------------------------------------------------
// Helper: compute fan airflow from diameter (mm) and RPM (rev/min)
//   Returns m³/h. Uses a simplified axial‑flow fan model.
//   Adjust the axialVelocityFactor (0.15) based on empirical data if needed.
// ---------------------------------------------------------------------------
function computeFanAirflow(fanParam = {}) {
  const { fanDiam = 100, fanRPM = 2200 } = fanParam;   // mm, RPM
  const D = fanDiam / 1000;                            // convert to m
  const tipSpeed = (Math.PI * D * fanRPM) / 60;        // m/s
  const axialVelocity = tipSpeed * 0.15;               // typical axial‑to‑tip ratio
  const area = (Math.PI * D * D) / 4;                  // m²
  const flow_m3s = axialVelocity * area;
  return flow_m3s * 3600;                              // m³/h
}

// Module-level state
let thermalAdvanced = {
  subcool: SJ54H_COMPONENTS.subcool_K,
  dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
  fanInputPower: SJ54H_COMPONENTS.fan.inputPower_W,
  defHeater: SJ54H_COMPONENTS.electrical.defrostHeater_W,
  defOnMin: SJ54H_COMPONENTS.electrical.defrostOn_min
};

let getGeometryFn = () => null;               // geometry provider

// Persistent modal elements
let thermalModal = null;
let thermalModalInputs = {};

// ────────────────────────────────────────────────────────────────
// Public init
// ────────────────────────────────────────────────────────────────
export function initThermoUI(options) {
  if (typeof options === 'function') {        // backward compatibility
    getGeometryFn = options;
  } else if (options && options.getGeometry) {
    getGeometryFn = options.getGeometry;
  }

  const panel = document.getElementById('panelThermal');
  if (!panel) return;

  panel.innerHTML = `
    <button id="thermoRunBtn">Run Thermal Analysis</button>
    <div id="thermoErrors"></div>
    <fieldset>
      <legend>Design Inputs</legend>
      <label>Ambient T0 (°C): <input type="number" id="thermoT0" value="30" step="any"></label>
      <label>Freezer TF (°C): <input type="number" id="thermoTF" value="-18" step="any"></label>
      <label>Refrigerator TR (°C): <input type="number" id="thermoTR" value="3" step="any"></label>
      <label>Refrigerant:
        <select id="thermoRefrigerant">
          <option value="R-600a">R-600a</option>
          <option value="R-134a">R-134a</option>
        </select>
      </label>
      <button id="thermoAdvancedBtn" type="button">⚙️ Advanced</button>
    </fieldset>
  `;

  // Load saved advanced values from localStorage (if any)
  const saved = localStorage.getItem('thermoAdvanced');
  if (saved) thermalAdvanced = { ...thermalAdvanced, ...JSON.parse(saved) };

  document.getElementById('thermoAdvancedBtn').addEventListener('click', openThermalSettings);
  document.getElementById('thermoRunBtn').addEventListener('click', handleRun);

  // Build the modal once and keep it hidden
  buildThermalModalOnce();
}

// ────────────────────────────────────────────────────────────────
// Modal construction (runs only once)
// ────────────────────────────────────────────────────────────────
function buildThermalModalOnce() {
  // Create the modal container if it doesn't already exist
  thermalModal = document.getElementById('thermalSettingsModal');
  if (!thermalModal) {
    thermalModal = document.createElement('div');
    thermalModal.id = 'thermalSettingsModal';
    thermalModal.className = 'modal hidden';
    document.body.appendChild(thermalModal);
  }

  thermalModal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn" id="closeThermalSettings">&times;</span>
      <h2>Thermal Design Parameters</h2>

      <fieldset>
        <legend>Condenser</legend>
        <label>Side pipe pitch (mm):
          <input type="number" id="thermoCondSidePitch" step="any">
        </label>
        <label>Back pipe pitch (mm):
          <input type="number" id="thermoCondBackPitch" step="any">
        </label>
      </fieldset>

      <fieldset>
        <legend>Evaporator</legend>
        <label>Width (mm): <input id="evapWidth" type="number" step="any"></label>
        <label>Height (mm): <input id="evapHeight" type="number" step="any"></label>
        <label>Depth (mm): <input id="thermoEvapDepth" type="number" step="any"></label>
        <label>Rows: <input id="evapRows" type="number" step="any"></label>
        <label>Tube OD (mm): <input id="evapTubeOD" type="number" step="any"></label>
        <label>Fin Height (mm): <input id="evapFinHeight" type="number" step="any"></label>
        <label>Fin Length (mm): <input id="evapFinLength" type="number" step="any"></label>
        <label>Number of Fins: <input id="evapNumFins" type="number" step="any"></label>
        <label>Side Plates: <input id="evapSidePlateNo" type="number" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Fan Parameters</legend>
        <label>Diameter (mm): <input id="fanDiam" type="number" step="any"></label>
        <label>RPM: <input id="fanRPM" type="number" step="any"></label>
        <label>Thickness (mm): <input id="fanThick" type="number" step="any"></label>
        <label>Input power (W):
          <input type="number" id="thermoFanInputPower" step="any" min="0">
        </label>
      </fieldset>

      <fieldset>
        <legend>Compressor</legend>
        <label>Current Compressor:
          <select id="thermoCompressorSelect"></select>
        </label>
        <button id="thermoAddCompressorBtn" type="button">Add Compressor</button>
        <button id="thermoEditCompressorBtn" type="button">Edit Selected</button>
        <button id="thermoDeleteCompressorBtn" type="button">Delete Selected</button>
      </fieldset>

      <fieldset>
        <legend>Subcool &amp; Discharge</legend>
        <label>Subcool (K):
          <input type="number" id="thermoSubcool" step="any">
        </label>
        <label>Discharge temp (°C):
          <input type="number" id="thermoDiscTemp" step="any">
        </label>
      </fieldset>

      <fieldset>
        <legend>Defrost</legend>
        <label>Heater (W):
          <input type="number" id="thermoDefHeater" step="any">
        </label>
        <label>On time (min/24h):
          <input type="number" id="thermoDefOn" step="any">
        </label>
      </fieldset>

      <div class="settings-actions">
        <button id="saveThermalSettings">Save &amp; Close</button>
      </div>
    </div>
  `;

  // Cache all input references
  thermalModalInputs = {
    condSidePitch: document.getElementById('thermoCondSidePitch'),
    condBackPitch: document.getElementById('thermoCondBackPitch'),
    evapWidth: document.getElementById('evapWidth'),
    evapHeight: document.getElementById('evapHeight'),
    thermoEvapDepth: document.getElementById('thermoEvapDepth'),
    evapRows: document.getElementById('evapRows'),
    evapTubeOD: document.getElementById('evapTubeOD'),
    evapFinHeight: document.getElementById('evapFinHeight'),
    evapFinLength: document.getElementById('evapFinLength'),
    evapNumFins: document.getElementById('evapNumFins'),
    evapSidePlateNo: document.getElementById('evapSidePlateNo'),
    fanDiam: document.getElementById('fanDiam'),
    fanRPM: document.getElementById('fanRPM'),
    fanThick: document.getElementById('fanThick'),
    fanInputPower: document.getElementById('thermoFanInputPower'),
    compressorSelect: document.getElementById('thermoCompressorSelect'),
    subcool: document.getElementById('thermoSubcool'),
    dischargeTemp: document.getElementById('thermoDiscTemp'),
    defHeater: document.getElementById('thermoDefHeater'),
    defOn: document.getElementById('thermoDefOn'),
  };

  // Attach permanent event listeners
  document.getElementById('closeThermalSettings').onclick = () => thermalModal.classList.add('hidden');
  document.getElementById('thermoAddCompressorBtn').onclick = openAddCompressorModal;
  document.getElementById('thermoEditCompressorBtn').onclick = openEditCompressorModal;
  document.getElementById('thermoDeleteCompressorBtn').onclick = () => {
    const sel = thermalModalInputs.compressorSelect;
    if (confirm('Delete the selected compressor?')) {
      deleteCompressor(sel.value);
      refreshCompressorSelect();
    }
  };
  thermalModalInputs.compressorSelect.onchange = (e) => {
    setSelectedCompressor(e.target.value);
  };
  document.getElementById('saveThermalSettings').onclick = saveThermalSettings;

  // Close when clicking outside modal
  thermalModal.onclick = (e) => {
    if (e.target === thermalModal) thermalModal.classList.add('hidden');
  };
}

// ────────────────────────────────────────────────────────────────
// Refresh modal fields and show it
// ────────────────────────────────────────────────────────────────
function openThermalSettings() {
  loadCompressors();   // ensure latest compressor list

  // Condenser
  const cond = settings.condenser || { sidePipePitch_mm: 50, backPipePitch_mm: 50 };
  thermalModalInputs.condSidePitch.value = cond.sidePipePitch_mm;
  thermalModalInputs.condBackPitch.value = cond.backPipePitch_mm;

  // Evaporator
  const evap = settings.evaporator || {};
  thermalModalInputs.evapWidth.value       = evap.width_mm ?? 460;
  thermalModalInputs.evapHeight.value      = evap.height_mm ?? 150;
  thermalModalInputs.thermoEvapDepth.value       = evap.depth_mm ?? 60;
  thermalModalInputs.evapRows.value        = evap.rows ?? 2;
  thermalModalInputs.evapTubeOD.value      = evap.tubeOD_mm ?? 8;
  thermalModalInputs.evapFinHeight.value   = evap.finHeight_mm ?? 150;
  thermalModalInputs.evapFinLength.value   = evap.finLength_mm ?? 460;
  thermalModalInputs.evapNumFins.value     = evap.numFins ?? 32;
  thermalModalInputs.evapSidePlateNo.value = evap.sidePlateNo ?? 0;

  // Fan parameters
  const fanP = settings.fanParam || {};
  thermalModalInputs.fanDiam.value  = fanP.fanDiam ?? 100;
  thermalModalInputs.fanRPM.value   = fanP.fanRPM ?? 2200;
  thermalModalInputs.fanThick.value = fanP.fanThick ?? 25;
  thermalModalInputs.fanInputPower.value = thermalAdvanced.fanInputPower;

  // Advanced thermal values
  thermalModalInputs.subcool.value       = thermalAdvanced.subcool;
  thermalModalInputs.dischargeTemp.value = thermalAdvanced.dischargeTemp;
  thermalModalInputs.defHeater.value     = thermalAdvanced.defHeater;
  thermalModalInputs.defOn.value         = thermalAdvanced.defOnMin;

  // Compressor dropdown
  refreshCompressorSelect();

  thermalModal.classList.remove('hidden');
}

function refreshCompressorSelect() {
  const select = thermalModalInputs.compressorSelect;
  select.innerHTML = '';
  const compressors = getCompressorList();
  const currentId = getCurrentCompressor()?.id;
  compressors.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    opt.selected = c.id === currentId;
    select.appendChild(opt);
  });
}

// ────────────────────────────────────────────────────────────────
// Save settings from the modal
// ────────────────────────────────────────────────────────────────
function saveThermalSettings() {
  // Condenser
  const sidePitch = parseFloat(thermalModalInputs.condSidePitch.value) ;
  const backPitch = parseFloat(thermalModalInputs.condBackPitch.value) ;
  settings.condenser = { sidePipePitch_mm: sidePitch, backPipePitch_mm: backPitch };

  // Evaporator
  settings.evaporator = {
    width_mm:       parseFloat(thermalModalInputs.evapWidth.value) ,
    height_mm:      parseFloat(thermalModalInputs.evapHeight.value) ,
    depth_mm:       parseFloat(thermalModalInputs.thermoEvapDepth.value) ,
    rows:           parseInt(thermalModalInputs.evapRows.value) ,
    tubeOD_mm:      parseFloat(thermalModalInputs.evapTubeOD.value) ,
    finHeight_mm:   parseFloat(thermalModalInputs.evapFinHeight.value) ,
    finLength_mm:   parseFloat(thermalModalInputs.evapFinLength.value) ,
    numFins:        parseInt(thermalModalInputs.evapNumFins.value),
    sidePlateNo:    parseInt(thermalModalInputs.evapSidePlateNo.value) ,
  };

  // Fan
  settings.fanParam = {
    fanDiam:  parseFloat(thermalModalInputs.fanDiam.value) ,
    fanRPM:   parseFloat(thermalModalInputs.fanRPM.value) ,
    fanThick: parseFloat(thermalModalInputs.fanThick.value) ,
  };

  updateSettings(settings);

  // Advanced thermal values
  thermalAdvanced.subcool       = parseFloat(thermalModalInputs.subcool.value) || SJ54H_COMPONENTS.subcool_K;
  thermalAdvanced.dischargeTemp = parseFloat(thermalModalInputs.dischargeTemp.value) || SJ54H_COMPONENTS.dischargeTemp_C;
  thermalAdvanced.fanInputPower = parseFloat(thermalModalInputs.fanInputPower.value) || SJ54H_COMPONENTS.fan.inputPower_W;
  thermalAdvanced.defHeater     = parseFloat(thermalModalInputs.defHeater.value) || SJ54H_COMPONENTS.electrical.defrostHeater_W;
  thermalAdvanced.defOnMin      = parseFloat(thermalModalInputs.defOn.value) || SJ54H_COMPONENTS.electrical.defrostOn_min;
  localStorage.setItem('thermoAdvanced', JSON.stringify(thermalAdvanced));

  // Compressor
  const compSelect = thermalModalInputs.compressorSelect;
  if (compSelect) setSelectedCompressor(compSelect.value);

  thermalModal.classList.add('hidden');
}

// Helper: parse Excel/CSV file and extract data points
function parseCompressorDataFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet);

        // Find columns by header (case-insensitive)
        const headers = Object.keys(rows[0] || {});
        const findCol = (names) => {
          for (const name of names) {
            const found = headers.find(h => h.toLowerCase() === name.toLowerCase());
            if (found) return found;
          }
          return null;
        };
        const teCol = findCol(['TE', 'Te', 'Evap Temp', 'T_E']);
        const tcCol = findCol(['TC', 'Tc', 'Cond Temp', 'T_C']);
        const wCol  = findCol(['W', 'Power', 'Input Power']);
        const qCol  = findCol(['Q', 'Capacity', 'Cooling Capacity']);

        if (!teCol || !tcCol || !wCol || !qCol) {
          reject(new Error('Could not find required columns: TE, TC, W, Q'));
          return;
        }

        const dataPoints = rows.map(row => ({
          TE: parseFloat(row[teCol]),
          TC: parseFloat(row[tcCol]),
          W:  parseFloat(row[wCol]),
          Q:  parseFloat(row[qCol])
        })).filter(dp => !isNaN(dp.TE) && !isNaN(dp.TC) && !isNaN(dp.W) && !isNaN(dp.Q));

        if (dataPoints.length < 5) {
          reject(new Error(`Only ${dataPoints.length} valid data points found. At least 5 are required.`));
          return;
        }

        resolve(dataPoints);
      } catch (err) {
        reject(new Error('Failed to parse file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}

// Build a table of data points inside the modal
function buildDataTable(dataPoints, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let html = `<table class="data-table" style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead><tr><th>TE (°C)</th><th>TC (°C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
  dataPoints.forEach(dp => {
    html += `<tr><td>${dp.TE.toFixed(2)}</td><td>${dp.TC.toFixed(2)}</td><td>${dp.W.toFixed(2)}</td><td>${dp.Q.toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table><p>${dataPoints.length} data points loaded.</p>`;
  container.innerHTML = html;
}

// --- Add Compressor Modal ---
function openAddCompressorModal() {
  const modal = document.getElementById('addCompressorModal');
  if (!modal) return;

  // Defaults
  const defaultComp = {
    name: 'EGX80CLC',
    cylinderVolumeCm3: 10.17,
    speedRpm: 2220,
  };
  const defaultRef = 2; // R-600a

  // Build the modal content
  document.getElementById('addCompressorContent').innerHTML = `
    <style>
      .data-table th, .data-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
      .data-table { margin: 10px 0; }
    </style>
    <fieldset>
      <legend>Compressor Basic Data</legend>
      <label>Name: <input id="acName" type="text" value="${defaultComp.name}"></label>
      <label>Cyl. Volume (cm³): <input id="acCyl" type="number" step="any" value="${defaultComp.cylinderVolumeCm3}"></label>
      <label>Speed (rpm): <input id="acRpm" type="number" step="any" value="${defaultComp.speedRpm}"></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1">R-134a</option>
          <option value="2" selected>R-600a</option>
        </select>
      </label>
    </fieldset>
    <fieldset>
      <legend>Load Performance Data from Excel</legend>
      <input type="file" id="acFileInput" accept=".xlsx,.xls,.csv">
      <button id="acLoadBtn" type="button">Load Data</button>
      <div id="acDataContainer"><p>No data loaded yet.</p></div>
    </fieldset>
    <div id="acError" class="error-msg" style="color:#d32f2f; margin-top:8px;"></div>
    <div class="settings-actions">
      <button id="fitCompressorBtn">Fit & Add</button>
      <button id="cancelAddCompressor">Cancel</button>
    </div>
  `;

  modal.classList.remove('hidden');

  // Store loaded data points
  let loadedDataPoints = null;

  // File input change / load button
  document.getElementById('acLoadBtn').onclick = async () => {
    const fileInput = document.getElementById('acFileInput');
    const file = fileInput.files[0];
    if (!file) {
      document.getElementById('acError').textContent = 'Please select a file.';
      return;
    }
    try {
      const points = await parseCompressorDataFile(file);
      loadedDataPoints = points;
      buildDataTable(points, 'acDataContainer');
      document.getElementById('acError').textContent = '';
    } catch (err) {
      document.getElementById('acError').textContent = err.message;
      loadedDataPoints = null;
    }
  };

  // Cancel
  document.getElementById('cancelAddCompressor').onclick = () => {
    modal.classList.add('hidden');
  };

  // Fit & Add
  document.getElementById('fitCompressorBtn').onclick = () => {
    const errorDiv = document.getElementById('acError');
    errorDiv.textContent = '';

    if (!loadedDataPoints || loadedDataPoints.length < 5) {
      errorDiv.textContent = 'Please load at least 5 data points from an Excel file.';
      return;
    }

    const name = document.getElementById('acName').value.trim();
    const cyl = parseFloat(document.getElementById('acCyl').value);
    const rpm = parseFloat(document.getElementById('acRpm').value);
    const refIdx = parseInt(document.getElementById('acRef').value);

    if (!name) { errorDiv.textContent = 'Name is required.'; return; }
    if (isNaN(cyl) || cyl <= 0) { errorDiv.textContent = 'Invalid cylinder volume.'; return; }
    if (isNaN(rpm) || rpm <= 0) { errorDiv.textContent = 'Invalid speed.'; return; }

    try {
      const { etaCoeffs, wCoeffs } = computeCompressorCoefficients({
        cylinderVolumeCm3: cyl,
        speedRpm: rpm,
        refrigerantIndex: refIdx,
        dataPoints: loadedDataPoints,
      });

      addCompressor({
        id: name.replace(/\s/g, ''),
        name,
        model: name,
        voltage: 100,
        frequency: 50,
        cylinderVolumeCm3: cyl,
        speedRpm: rpm,
        refrigerantIndex: refIdx,
        wCoeffs,
        etaCoeffs,
        dataPoints: loadedDataPoints,
      });

      modal.classList.add('hidden');
      openThermalSettings(); // refresh compressor list
    } catch (err) {
      errorDiv.textContent = err.message;
    }
  };

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}

// --- Edit Compressor Modal ---
function openEditCompressorModal() {
  const modal = document.getElementById('addCompressorModal');
  if (!modal) return;

  loadCompressors();
  const comp = getCurrentCompressor();
  if (!comp) {
    alert('No compressor selected.');
    return;
  }

  // Pre-fill data points if they exist
  let existingPoints = comp.dataPoints || [];

  document.getElementById('addCompressorContent').innerHTML = `
    <style>
      .data-table th, .data-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
      .data-table { margin: 10px 0; }
    </style>
    <h2>Edit Compressor</h2>
    <fieldset>
      <legend>Basic Data</legend>
      <label>Name: <input id="acName" type="text" value="${comp.name}"></label>
      <label>Cyl. Volume (cm³): <input id="acCyl" type="number" step="any" value="${comp.cylinderVolumeCm3}"></label>
      <label>Speed (rpm): <input id="acRpm" type="number" step="any" value="${comp.speedRpm}"></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1" ${comp.refrigerantIndex === 1 ? 'selected' : ''}>R-134a</option>
          <option value="2" ${comp.refrigerantIndex === 2 ? 'selected' : ''}>R-600a</option>
        </select>
      </label>
    </fieldset>
    <fieldset>
      <legend>Current Data Points (${existingPoints.length} points)</legend>
      <div id="acDataContainer">
        ${existingPoints.length ? buildDataTableHTML(existingPoints) : '<p>No data points stored.</p>'}
      </div>
    </fieldset>
    <fieldset>
      <legend>Replace with New Excel File</legend>
      <input type="file" id="acFileInput" accept=".xlsx,.xls,.csv">
      <button id="acLoadBtn" type="button">Load & Replace</button>
      <div id="acError" class="error-msg" style="color:#d32f2f; margin-top:8px;"></div>
    </fieldset>
    <div class="settings-actions">
      <button id="fitAndSaveBtn">Fit & Save</button>
      <button id="cancelEditCompressor">Cancel</button>
    </div>
  `;

  modal.classList.remove('hidden');

  let loadedDataPoints = existingPoints.length ? existingPoints : null;

  // Load button to replace data
  document.getElementById('acLoadBtn').onclick = async () => {
    const fileInput = document.getElementById('acFileInput');
    const file = fileInput.files[0];
    if (!file) {
      document.getElementById('acError').textContent = 'Please select a file.';
      return;
    }
    try {
      const points = await parseCompressorDataFile(file);
      loadedDataPoints = points;
      buildDataTable(points, 'acDataContainer');
      document.getElementById('acError').textContent = '';
    } catch (err) {
      document.getElementById('acError').textContent = err.message;
      loadedDataPoints = null;
    }
  };

  document.getElementById('cancelEditCompressor').onclick = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('fitAndSaveBtn').onclick = () => {
    const errorDiv = document.getElementById('acError');
    errorDiv.textContent = '';

    if (!loadedDataPoints || loadedDataPoints.length < 5) {
      errorDiv.textContent = 'At least 5 data points required. Load a file or keep existing points.';
      return;
    }

    const newName = document.getElementById('acName').value.trim();
    const newCyl = parseFloat(document.getElementById('acCyl').value);
    const newRpm = parseFloat(document.getElementById('acRpm').value);
    const newRefIdx = parseInt(document.getElementById('acRef').value);

    if (!newName) { errorDiv.textContent = 'Name is required.'; return; }
    if (isNaN(newCyl) || newCyl <= 0) { errorDiv.textContent = 'Invalid cylinder volume.'; return; }
    if (isNaN(newRpm) || newRpm <= 0) { errorDiv.textContent = 'Invalid speed.'; return; }

    // If dataPoints changed or basic data changed, refit
    const needRefit = (loadedDataPoints !== existingPoints) ||
                      (newCyl !== comp.cylinderVolumeCm3) ||
                      (newRpm !== comp.speedRpm) ||
                      (newRefIdx !== comp.refrigerantIndex);

    let wCoeffs, etaCoeffs, finalPoints;
    if (needRefit) {
      try {
        const coeffs = computeCompressorCoefficients({
          cylinderVolumeCm3: newCyl,
          speedRpm: newRpm,
          refrigerantIndex: newRefIdx,
          dataPoints: loadedDataPoints,
        });
        wCoeffs = coeffs.wCoeffs;
        etaCoeffs = coeffs.etaCoeffs;
        finalPoints = loadedDataPoints;
      } catch (err) {
        errorDiv.textContent = 'Fitting failed: ' + err.message;
        return;
      }
    } else {
      // Keep existing coefficients
      wCoeffs = comp.wCoeffs;
      etaCoeffs = comp.etaCoeffs;
      finalPoints = existingPoints;
    }

    const updatedComp = {
      id: newName.replace(/\s/g, ''),
      name: newName,
      model: newName,
      voltage: comp.voltage || 100,
      frequency: comp.frequency || 50,
      cylinderVolumeCm3: newCyl,
      speedRpm: newRpm,
      refrigerantIndex: newRefIdx,
      wCoeffs,
      etaCoeffs,
      dataPoints: finalPoints,
    };

    deleteCompressor(comp.id);
    addCompressor(updatedComp);
    setSelectedCompressor(updatedComp.id);

    modal.classList.add('hidden');
    openThermalSettings();
  };

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}

// Helper to build data table HTML from array
function buildDataTableHTML(dataPoints) {
  if (!dataPoints || dataPoints.length === 0) return '<p>No data points.</p>';
  let html = `<table class="data-table"><thead><tr><th>TE (°C)</th><th>TC (°C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
  dataPoints.forEach(dp => {
    html += `<tr><td>${dp.TE.toFixed(2)}</td><td>${dp.TC.toFixed(2)}</td><td>${dp.W.toFixed(2)}</td><td>${dp.Q.toFixed(2)}</td></tr>`;
  });
  html += `</tbody></table><p>${dataPoints.length} data points.</p>`;
  return html;
}

// ────────────────────────────────────────────────────────────────
// Run thermal analysis
// ────────────────────────────────────────────────────────────────
function handleRun() {
  clearMessages();
  if (!getGeometryFn) { showError('Geometry source not available.'); return; }
  const cabinetGeom = getGeometryFn();
  const geom = toThermalFormat(cabinetGeom);
  const evapDepthMain = parseFloat(document.getElementById('evapDepth')?.value) ;
  geom.tEvaBack = evapDepthMain;

  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) { showError('Please fill all temperatures.'); return; }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';

  // Fan airflow calculated from fan parameters stored in settings
  const fanParam = settings.fanParam || {};
  const fanFlow = computeFanAirflow(fanParam);

  // Determine freezer position correctly for any configuration
  const comps = cabinetGeom._compartments;
  const nComps = comps?.length || 0;
  const hasFreezer = comps && comps[0].type === 'freezer';
  const freezerPosition =
      nComps === 1 ? 'top' :                // single compartment always 'top'
      hasFreezer ? 'top' : 'bottom';
  const config = buildDefaultConfig({
    geom,
    freezerPosition,
    refrigerant,
    subcool: thermalAdvanced.subcool,
    dischargeTemp: thermalAdvanced.dischargeTemp,
    fixedTemps: { T0, TF, TR, TE: SJ54H_COMPONENTS.initialTE },
    fan: { totalAirflow: fanFlow, inputPower_W: thermalAdvanced.fanInputPower },
    electrical: { defrostHeater_W: thermalAdvanced.defHeater, defrostOn_min: thermalAdvanced.defOnMin },
  });
  if (settings.condenser) {
  config.condenserConfig = {
    ...config.condenserConfig,                         // keep K‑values, efficiency, etc.
    sidePipePitch_mm: settings.condenser.sidePipePitch_mm,
    backPipePitch_mm: settings.condenser.backPipePitch_mm,
  };
}

  console.log(geom);

  config.evapGeom = settings.evaporator || {};
  config.fanParam = fanParam;

  // Compressor coefficients
  const defaultCompParams = config.compParams;
  loadCompressors();
  const compressor = getCurrentCompressor();
  let compressorWarning = null;   // <-- new: store fallback warning
  if (compressor) {
    const toArray = (coeffs, keys) => {
      if (Array.isArray(coeffs)) return coeffs;
      if (coeffs && typeof coeffs === 'object') {
        return keys.map(k => coeffs[k]).filter(v => v !== undefined);
      }
      return null;
    };
    const wArr = toArray(compressor.wCoeffs, ['AW','BW','CW','DW','EW']);
    const etaArr = toArray(compressor.etaCoeffs, ['A','B','C']);

    if (wArr && wArr.length === 5 && etaArr && etaArr.length === 3) {
      config.compParams = {
        name: compressor.name,
        cylinderVolumeCm3: compressor.cylinderVolumeCm3 || defaultCompParams.cylinderVolumeCm3,
        speedRpm: compressor.speedRpm || defaultCompParams.speedRpm,
        wCoeffs: wArr,
        etaCoeffs: etaArr,
      };
    } else {
      // Fallback – log warning and store message
      compressorWarning = `Compressor “${compressor.name}” is missing valid coefficients. Using default compressor (EGX80CLC) instead.`;
      console.warn(compressorWarning);
    }
  }
  config.solverOptions = config.solverOptions || {};
  config.solverOptions.innerOptions = config.solverOptions.innerOptions || {};
  config.solverOptions.innerOptions.debug = true;

  const result = runThermoAnalysis(config);
  if (result.results && result.results.compressor) {
  // Attach coefficients for display
  if (config.compParams) {
    result.results.compressor.wCoeffs = config.compParams.wCoeffs;
    result.results.compressor.etaCoeffs = config.compParams.etaCoeffs;
  }
}
  if (!result.success) {
    showError(result.errors.join('; '));
    return;
  }
  // ── Add compressor fallback warning to result ──────────
  if (compressorWarning) {
    result.warnings = result.warnings || [];
    result.warnings.unshift(compressorWarning);   // show it first
  }

  // Energy consumption
  let energy = null;
  if (result.results && (result.results.converged !== false)) {
    try { energy = EnergyConsumption(result.results); }
    catch (e) { console.warn('EnergyConsumption failed:', e); }
  }

  // Evaporator performance
  let evapDetails = null;
  const evap = settings.evaporator;
  const fanP = settings.fanParam;
  if (evap && fanP && result.results && result.results.converged !== false) {
    try {
      const area = computeEvaporatorArea(evap);
      const v = airSpeed(fanP, evap);
      const alpha = evaporatorAlpha(v);
      const TF = parseFloat(document.getElementById('thermoTF')?.value) ;
      const TR = parseFloat(document.getElementById('thermoTR')?.value) ;
      const MR = result.results.MR ;
      const MF = result.results.MF ;
      const totalFlow = MR + MF;
      const T1 = totalFlow > 0 ? (MF * TF + MR * TR) / totalFlow : TF;
      const T2 = result.results.T2;
      const TE = result.results.TE;
      const LMTD = lmtd(T1, T2, TE);
      const Qevap = evaporatorCapacity(alpha, area, LMTD);
      evapDetails = { area, v, alpha, LMTD, Qevap, T1 };
    } catch (e) { console.warn('Evaporator calculation failed:', e); }
  }
  if (evapDetails) result.results.evapDetails = evapDetails;

  // Attach fan airflow to results for display
  result.results.fanAirflow = fanFlow;

  // Switch to Thermal tab and display results
  document.getElementById('tabThermal').click();
  const thermoRight = document.getElementById('thermoRightPanel');
  if (thermoRight) thermoRight.innerHTML = '';
  result.results.configLabel =
    (comps && comps.length === 1 ? `Single ${comps[0].type}` :
     freezerPosition === 'top' ? 'Top Freezer' : 'Bottom Freezer');
  displayResults(result.results, energy);
  if (result.warnings.length) showWarnings(result.warnings);
}

// ────────────────────────────────────────────────────────────────
// Display helpers (now includes fan airflow section)
// ────────────────────────────────────────────────────────────────
function displayResults(res, energy) {
  if (!res) return;

  const resultsDiv = document.getElementById('thermoRightPanel');
  if (!resultsDiv) return;
  const frontCanvas = document.getElementById('schematicFront');
  const sideCanvas  = document.getElementById('schematicSide');
  const overlay     = document.getElementById('schematicOverlay');
  if (frontCanvas) frontCanvas.style.display = 'none';
  if (sideCanvas)  sideCanvas.style.display  = 'none';
  if (overlay)     overlay.classList.add('hidden');
  resultsDiv.classList.remove('hidden');

  const fmt  = (v, dp = 2)  => (isFinite(v) ? v.toFixed(dp) : '—');
  const fmtP = (v, dp = 1)  => (isFinite(v) ? (v * 100).toFixed(dp) + ' %' : '—');

  const comp = res.compressor || {};
  const pe = (comp.Pe !== undefined ? comp.Pe : res.Pe)?.toFixed(4) ?? '—';
  const pc = (comp.Pc !== undefined ? comp.Pc : res.Pc)?.toFixed(4) ?? '—';
  const etaV = comp.etaV !== undefined ? fmtP(comp.etaV) : '—';
  const qComp= comp.coolingCapacity !== undefined ? fmt(comp.coolingCapacity) : '—';  // W
  const pComp= comp.inputPower       !== undefined ? fmt(comp.inputPower) : '—';      // W
  const COP = comp.COP !== undefined ? fmt(comp.COP, 2) : '—';
  const mFlow= comp.massFlow         !== undefined ? fmt(comp.massFlow, 4) : '—';

  const eW   = energy ? fmt(energy.EnergyConsumption_W, 3) : '—';
  const eKWh = energy ? fmt(energy.EnergyConsumption_kWhMonth, 3) : '—';
  let etaStr = '—', wStr = '—';
  if (comp.etaCoeffs && comp.etaCoeffs.length === 3) {
    etaStr = `A = ${comp.etaCoeffs[0].toFixed(5)}, B = ${comp.etaCoeffs[1].toFixed(5)}, C = ${comp.etaCoeffs[2].toFixed(5)}`;
  }
  if (comp.wCoeffs && comp.wCoeffs.length === 5) {
    wStr = `AW = ${comp.wCoeffs[0].toFixed(5)}, BW = ${comp.wCoeffs[1].toFixed(5)}, CW = ${comp.wCoeffs[2].toFixed(5)}, DW = ${comp.wCoeffs[3].toFixed(5)}, EW = ${comp.wCoeffs[4].toFixed(5)}`;
  }

  const fanAirflow_m3h = res.fanAirflow !== undefined ? res.fanAirflow : 0;
  const fanAirflow_CFM = fanAirflow_m3h * 0.588578;   // 1 m³/h = 0.588578 CFM

  const configLabel = res.configLabel || 'Unknown';
  const html = `
    <table class="thermo-results-table">
      <thead>
        <tr><th colspan="2">Thermal Analysis Results — ${configLabel}</th></tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="2">Operating Points</td></tr>
        <tr><td>Condensing temp TC</td><td>${fmt(res.TC)} °C</td></tr>
        <tr><td>Evaporating temp TE</td><td>${fmt(res.TE)} °C</td></tr>
        <tr><td>Evap. outlet T2</td><td>${fmt(res.T2)} °C</td></tr>
        <tr><td>Running ratio PR</td><td>${fmtP(res.PR)}</td></tr>

        <tr class="section-header"><td colspan="2">Compressor Details</td></tr>
        <tr class="section-header"><td colspan="2">Compressor Coefficients</td></tr>
        <tr><td>η<sub>v</sub> coefficients</td><td>${etaStr}</td></tr>
        <tr><td>Power coefficients</td><td>${wStr}</td></tr>
        <tr><td>Evap. pressure Pe</td><td>${pe} bar</td></tr>
        <tr><td>Cond. pressure Pc</td><td>${pc} bar</td></tr>
        <tr><td>Vol. efficiency η<sub>v</sub></td><td>${etaV}</td></tr>
        <tr><td>Cooling capacity</td><td>${qComp} W</td></tr>
        <tr><td>Input power</td><td>${pComp} W</td></tr>
        <tr><td>COP</td><td>${COP}</td></tr>
        <tr><td>Mass flow</td><td>${mFlow} kg/h</td></tr>

        <tr class="section-header"><td colspan="2">Energy Consumption</td></tr>
        <tr><td>Daily energy</td><td>${eW} kWh</td></tr>
        <tr><td>Monthly energy</td><td>${eKWh} kWh</td></tr>

        <tr class="section-header"><td colspan="2">Heat Loads (W)</td></tr>
        <tr><td>QF — Freezer compartment</td><td>${fmt(res.heatLoads.QF)}</td></tr>
        <tr><td>QR — Refrigerator compartment</td><td>${fmt(res.heatLoads.QR)}</td></tr>
        <tr><td>QEV — Evaporator total</td><td>${fmt(res.heatLoads.QEV)}</td></tr>
        <tr><td>Fan load</td><td>${fmt(res.heatLoads.fanLoad)}</td></tr>
        <tr><td>Defrost load</td><td>${fmt(res.heatLoads.defrostLoad)}</td></tr>

        <tr class="section-header"><td colspan="2">Fan Airflow</td></tr>
        <tr><td>Calculated airflow</td><td>${fmt(fanAirflow_CFM, 1)} CFM (${fmt(fanAirflow_m3h, 1)} m³/h)</td></tr>
        ${
          res.evapDetails ? `
          <tr class="section-header"><td colspan="2">Evaporator Performance</td></tr>
          <tr><td>Surface area</td><td>${fmt(res.evapDetails.area, 4)} m²</td></tr>
          <tr><td>Air speed</td><td>${fmt(res.evapDetails.v, 3)} m/s</td></tr>
          <tr><td>Heat transfer coeff α</td><td>${fmt(res.evapDetails.alpha, 2)} W/(m²·K)</td></tr>
          <tr><td>LMTD</td><td>${fmt(res.evapDetails.LMTD, 2)} °C</td></tr>
          <tr><td>Mixed inlet T1</td><td>${fmt(res.evapDetails.T1, 2)} °C</td></tr>
          <tr><td>Evap. capacity (calculated)</td><td>${fmt(res.evapDetails.Qevap, 2)} W</td></tr>
          ` : ''
        }
        <tr class="section-header"><td colspan="2">Solver</td></tr>
        <tr><td>Outer iterations</td><td>${res.outerIterations ?? res.iterations?.outer ?? '—'}</td></tr>
        <tr><td>Inner iterations (total)</td><td>${res.innerTotalIterations ?? res.iterations?.innerTotal ?? '—'}</td></tr>
      </tbody>
    </table>
  `;
  resultsDiv.innerHTML = html;
}

function clearMessages() {
  const thermoRight = document.getElementById('thermoRightPanel');
  const thermoErrors = document.getElementById('thermoErrors');
  if (thermoRight) thermoRight.innerHTML = '';
  if (thermoErrors) thermoErrors.innerHTML = '';
}

function showError(msg) {
  const e = document.getElementById('thermoErrors');
  if (e) e.innerHTML = `<p class="error">❌ ${msg}</p>`;
}

function showWarnings(warnings) {
  const e = document.getElementById('thermoErrors');
  if (!e) return;
  const ul = document.createElement('ul');
  warnings.forEach(w => {
    const li = document.createElement('li');
    li.textContent = w;
    li.className = 'warning';
    ul.appendChild(li);
  });
  e.appendChild(ul);
}

export function getThermalState() {
  return {
    T0: parseFloat(document.getElementById('thermoT0')?.value) ,
    TF: parseFloat(document.getElementById('thermoTF')?.value),
    TR: parseFloat(document.getElementById('thermoTR')?.value) ,
    refrigerant: document.getElementById('thermoRefrigerant')?.value ,
    advanced: thermalAdvanced,
    evaporator: settings.evaporator,
    condenser: settings.condenser,
    fanParam: settings.fanParam,
    compressor: getCurrentCompressor()
  };
}

export function setThermalState(data) {
  if (!data) return;
  
  const el = (id) => document.getElementById(id);
  if (data.T0 !== undefined && el('thermoT0')) el('thermoT0').value = data.T0;
  if (data.TF !== undefined && el('thermoTF')) el('thermoTF').value = data.TF;
  if (data.TR !== undefined && el('thermoTR')) el('thermoTR').value = data.TR;
  if (data.refrigerant !== undefined && el('thermoRefrigerant')) el('thermoRefrigerant').value = data.refrigerant;

  if (data.advanced) {
    thermalAdvanced = { ...thermalAdvanced, ...data.advanced };
    localStorage.setItem('thermoAdvanced', JSON.stringify(thermalAdvanced));
  }
  
  if (data.evaporator) settings.evaporator = data.evaporator;
  if (data.condenser) settings.condenser = data.condenser;
  if (data.fanParam) settings.fanParam = data.fanParam;

if (data.compressor) {
  const list = getCompressorList();
  const existingIdx = list.findIndex(c => c.id === data.compressor.id);
  
  if (existingIdx === -1) {
    addCompressor(data.compressor);
  } else {
    // Overwrite the existing local compressor with the imported one
    list[existingIdx] = data.compressor;
    localStorage.setItem('compressorList', JSON.stringify(list));
  }
  setSelectedCompressor(data.compressor.id);
}
  updateSettings(settings);
}