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

// ────────────────────────────────────────────────────────────────
// Add Compressor Modal – builds the 3×3 matrix, fits coefficients
// ────────────────────────────────────────────────────────────────
function openAddCompressorModal() {
  const modal = document.getElementById('addCompressorModal');
  if (!modal) return;

  // Default values to pre‑fill the editable matrix
  const defaultComp = {
    name: 'EGX80CLC',
    cylinderVolumeCm3: 10.17,
    speedRpm: 2220,
  };

  const defaultTE = [-34.4, -23.3, -12.2];
  const defaultTC = [37.8, 46.1, 54.4];
  const Q_matrix = [
    [ 70.554507,  67.112824,  61.950299].map(v => v * 1.16279),
    [129.063122, 126.481860, 121.319335].map(v => v * 1.16279),
    [215.105204, 210.803100, 203.919733].map(v => v * 1.16279),
  ];

  // W values stay unchanged (already W)
  const W_matrix = [
    [ 49.7,  51.3,  72.0],
    [ 67.6,  72.4, 141.0],
    [ 86.2,  93.5, 237.0],
  ];
  // Build table rows with editable TE values at the start of each row
  const headerCells = defaultTC.map((tc, j) => `
    <th style="text-align:center;">TC<br><input id="tc_${j}" type="number" step="any" value="${tc}" style="width:70px;"></th>
  `).join('');

  const bodyRows = defaultTE.map((te, i) => `
    <tr>
      <th style="text-align:center;">TE<br><input id="te_${i}" type="number" step="any" value="${te}" style="width:70px;"></th>
      ${defaultTC.map((tc, j) => `
        <td>
          Q: <input id="q_${i}_${j}" type="number" step="any" value="${Q_matrix[i][j]}" style="width:80px;">W<br>
          W: <input id="w_${i}_${j}" type="number" step="any" value="${W_matrix[i][j]}" style="width:80px;">W
        </td>
      `).join('')}
    </tr>
  `).join('');

  document.getElementById('addCompressorContent').innerHTML = `
    <style>
      .matrix-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      .matrix-table th, .matrix-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
      .matrix-table input { width: 80px; }
      .error-msg { color: #d32f2f; font-weight: bold; margin-top: 10px; }
    </style>

    <fieldset>
      <legend>Basic Data</legend>
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
      <legend>Test Data (edit TE / TC and fill Q & W)</legend>
      <table class="matrix-table">
        <thead>
          <tr>
            <th></th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
      <p><small>Pre‑filled with example data. Change TE and TC values as needed. At least 5 data points required.</small></p>
    </fieldset>

    <div id="acError" class="error-msg"></div>
    <div class="settings-actions">
      <button id="fitCompressorBtn">Fit & Add</button>
      <button id="cancelAddCompressor">Cancel</button>
    </div>
  `;

  modal.classList.remove('hidden');

  document.getElementById('cancelAddCompressor').onclick = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('fitCompressorBtn').onclick = () => {
    const errorDiv = document.getElementById('acError');
    errorDiv.textContent = '';
    const name = document.getElementById('acName').value.trim();
    const cyl = parseFloat(document.getElementById('acCyl').value);
    const rpm = parseFloat(document.getElementById('acRpm').value);
    const refIdx = parseInt(document.getElementById('acRef').value);

    if (!name) { errorDiv.textContent = 'Name is required.'; return; }
    if (isNaN(cyl) || cyl <= 0) { errorDiv.textContent = 'Invalid cylinder volume.'; return; }
    if (isNaN(rpm) || rpm <= 0) { errorDiv.textContent = 'Invalid speed.'; return; }

    // Read TE and TC values from the editable headers
    const TE_vals = [];
    const TC_vals = [];
    for (let i = 0; i < 3; i++) {
      const te = parseFloat(document.getElementById(`te_${i}`).value);
      if (isNaN(te)) { errorDiv.textContent = `Invalid TE value in row ${i+1}.`; return; }
      TE_vals.push(te);
    }
    for (let j = 0; j < 3; j++) {
      const tc = parseFloat(document.getElementById(`tc_${j}`).value);
      if (isNaN(tc)) { errorDiv.textContent = `Invalid TC value in column ${j+1}.`; return; }
      TC_vals.push(tc);
    }

    // Build dataPoints from all filled-in cells
    const dataPoints = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const q = parseFloat(document.getElementById(`q_${i}_${j}`).value);
        const w = parseFloat(document.getElementById(`w_${i}_${j}`).value);
        if (!isNaN(q) && !isNaN(w)) {
          dataPoints.push({ TE: TE_vals[i], TC: TC_vals[j], Q: q, W: w });
        }
      }
    }

    if (dataPoints.length < 5) {
      errorDiv.textContent = `At least 5 data points required. Only ${dataPoints.length} provided.`;
      return;
    }

    try {
      const { etaCoeffs, wCoeffs } = computeCompressorCoefficients({
        cylinderVolumeCm3: cyl,
        speedRpm: rpm,
        refrigerantIndex: refIdx,
        dataPoints,
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
        dataPoints,          // <── store the test data
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

function openEditCompressorModal() {
  const modal = document.getElementById('addCompressorModal');
  if (!modal) return;

  loadCompressors();
  const comp = getCurrentCompressor();
  if (!comp) {
    alert('No compressor selected.');
    return;
  }

  // ── Basic values ─────────────────────────────────────
  const name = comp.name || '';
  const cyl  = comp.cylinderVolumeCm3 || 10.17;
  const rpm  = comp.speedRpm || 2220;
  const refIdx = comp.refrigerantIndex || 2;

  // ── Determine TE / TC headers from stored dataPoints ──
  let teVals = [];
  let tcVals = [];
  const dataMap = new Map();   // key "TE|TC" → {Q, W}

  if (Array.isArray(comp.dataPoints) && comp.dataPoints.length) {
    const teSet = new Set();
    const tcSet = new Set();
    comp.dataPoints.forEach(dp => {
      teSet.add(dp.TE);
      tcSet.add(dp.TC);
      dataMap.set(`${dp.TE}|${dp.TC}`, { Q: dp.Q, W: dp.W });
    });
    teVals = [...teSet].sort((a, b) => a - b);
    tcVals = [...tcSet].sort((a, b) => a - b);
  }

  // Fallback to defaults if no dataPoints
  if (!teVals.length) teVals = [-34.4, -23.3, -12.2];
  if (!tcVals.length) tcVals = [37.8, 46.1, 54.4];

  // Build table headers with editable TE/TC inputs
  const headerCells = tcVals.map((tc, j) => `
    <th style="text-align:center;">TC<br>
      <input id="tc_${j}" type="number" step="any" value="${tc}" style="width:70px;">
    </th>
  `).join('');

  const bodyRows = teVals.map((te, i) => `
    <tr>
      <th style="text-align:center;">TE<br>
        <input id="te_${i}" type="number" step="any" value="${te}" style="width:70px;">
      </th>
      ${tcVals.map((tc, j) => {
        const key = `${te}|${tc}`;
        const dp = dataMap.get(key) || { Q: '', W: '' };
        return `
          <td>
            Q: <input id="q_${i}_${j}" type="number" step="any" value="${dp.Q}" style="width:80px;">W<br>
            W: <input id="w_${i}_${j}" type="number" step="any" value="${dp.W}" style="width:80px;">W
          </td>
        `;
      }).join('')}
    </tr>
  `).join('');

  // ── Build coefficient display string ────────────────
  const etaStr = Array.isArray(comp.etaCoeffs) && comp.etaCoeffs.length === 3
    ? `A = ${comp.etaCoeffs[0].toFixed(5)}, B = ${comp.etaCoeffs[1].toFixed(5)}, C = ${comp.etaCoeffs[2].toFixed(5)}`
    : 'Missing';
  const wStr   = Array.isArray(comp.wCoeffs) && comp.wCoeffs.length === 5
    ? `AW = ${comp.wCoeffs[0].toFixed(5)}, BW = ${comp.wCoeffs[1].toFixed(5)}, CW = ${comp.wCoeffs[2].toFixed(5)}, DW = ${comp.wCoeffs[3].toFixed(5)}, EW = ${comp.wCoeffs[4].toFixed(5)}`
    : 'Missing';

  document.getElementById('addCompressorContent').innerHTML = `
    <h2>Edit Compressor</h2>
    <style>
      .matrix-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      .matrix-table th, .matrix-table td { border: 1px solid #ccc; padding: 4px; text-align: center; }
      .matrix-table input { width: 80px; }
      .error-msg { color: #d32f2f; font-weight: bold; margin-top: 10px; }
    </style>

    <fieldset>
      <legend>Basic Data</legend>
      <label>Name: <input id="acName" type="text" value="${name}"></label>
      <label>Cyl. Volume (cm³): <input id="acCyl" type="number" step="any" value="${cyl}"></label>
      <label>Speed (rpm): <input id="acRpm" type="number" step="any" value="${rpm}"></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1" ${refIdx === 1 ? 'selected' : ''}>R-134a</option>
          <option value="2" ${refIdx === 2 ? 'selected' : ''}>R-600a</option>
        </select>
      </label>
    </fieldset>

    <fieldset>
      <legend>Current Fitted Coefficients</legend>
      <p><strong>Volumetric efficiency (η<sub>v</sub>):</strong> ${etaStr}</p>
      <p><strong>Input power (W):</strong> ${wStr}</p>
      <p><small>Leave test data empty to keep these coefficients.
      Enter at least 5 data points to recompute.</small></p>
    </fieldset>

    <fieldset>
      <legend>Test Data (edit TE / TC headers and fill Q & W)</legend>
      <table class="matrix-table">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </fieldset>

    <div id="acError" class="error-msg"></div>
    <div class="settings-actions">
      <button id="fitAndSaveBtn">Fit & Save</button>
      <button id="cancelEditCompressor">Cancel</button>
    </div>
  `;

  modal.classList.remove('hidden');

  document.getElementById('cancelEditCompressor').onclick = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('fitAndSaveBtn').onclick = () => {
    const errorDiv = document.getElementById('acError');
    errorDiv.textContent = '';

    const newName = document.getElementById('acName').value.trim();
    const newCyl  = parseFloat(document.getElementById('acCyl').value);
    const newRpm  = parseFloat(document.getElementById('acRpm').value);
    const newRefIdx = parseInt(document.getElementById('acRef').value);

    if (!newName) { errorDiv.textContent = 'Name is required.'; return; }
    if (isNaN(newCyl) || newCyl <= 0) { errorDiv.textContent = 'Invalid cylinder volume.'; return; }
    if (isNaN(newRpm) || newRpm <= 0) { errorDiv.textContent = 'Invalid speed.'; return; }

    // Read TE and TC from headers
    const TE_vals = [];
    const TC_vals = [];
    for (let i = 0; i < 3; i++) {
      const te = parseFloat(document.getElementById(`te_${i}`).value);
      if (isNaN(te)) { errorDiv.textContent = `Invalid TE in row ${i+1}.`; return; }
      TE_vals.push(te);
    }
    for (let j = 0; j < 3; j++) {
      const tc = parseFloat(document.getElementById(`tc_${j}`).value);
      if (isNaN(tc)) { errorDiv.textContent = `Invalid TC in col ${j+1}.`; return; }
      TC_vals.push(tc);
    }

    // Build data points from filled cells
    const dataPoints = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const q = parseFloat(document.getElementById(`q_${i}_${j}`).value);
        const w = parseFloat(document.getElementById(`w_${i}_${j}`).value);
        if (!isNaN(q) && !isNaN(w)) {
          dataPoints.push({ TE: TE_vals[i], TC: TC_vals[j], Q: q, W: w });
        }
      }
    }

    let wCoeffs, etaCoeffs;
    const nonZeroCount = dataPoints.filter(dp => dp.Q !== 0 || dp.W !== 0).length;
    if (dataPoints.length >= 5 && nonZeroCount === 0) {
      errorDiv.textContent = 'All test data values are zero – cannot fit. Leave cells empty to keep existing coefficients.';
      return;
    }

    if (dataPoints.length >= 5) {
      try {
        const coeffs = computeCompressorCoefficients({
          cylinderVolumeCm3: newCyl,
          speedRpm: newRpm,
          refrigerantIndex: newRefIdx,
          dataPoints,
        });
        wCoeffs = coeffs.wCoeffs;
        etaCoeffs = coeffs.etaCoeffs;
      } catch (err) {
        errorDiv.textContent = 'Coefficient fitting failed: ' + err.message;
        return;
      }
    } else {
      // Keep existing coefficients
      if (!comp.wCoeffs || !comp.etaCoeffs || comp.wCoeffs.length !== 5 || comp.etaCoeffs.length !== 3) {
        errorDiv.textContent = 'No valid existing coefficients. Please enter at least 5 test data points.';
        return;
      }
      wCoeffs = comp.wCoeffs;
      etaCoeffs = comp.etaCoeffs;
    }

    // Build updated compressor object
    const updatedComp = {
      id: newName.replace(/\s/g, ''),
      name: newName,
      model: newName,
      voltage: comp.voltage || 100,
      frequency: comp.frequency || 50,
      cylinderVolumeCm3: newCyl,
      speedRpm: newRpm,
      wCoeffs,
      etaCoeffs,
    };

    // Replace the old compressor with the updated one
    deleteCompressor(comp.id);
    addCompressor(updatedComp);
    setSelectedCompressor(updatedComp.id);

    modal.classList.add('hidden');
    openThermalSettings();   // refresh the compressor dropdown
  };

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
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