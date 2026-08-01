/**
 * @file thermoUI.js
 * Thermal analysis UI orchestrator.
 * Binds the DOM elements for the Constant-Speed and Inverter analysis tabs.
 * Scrapes user inputs, manages the advanced thermal settings modal, handles
 * custom compressor Excel data ingestion, invokes the thermodynamic solver, 
 * and renders the resulting performance metrics to HTML tables.
 */

import { runThermoAnalysis, buildDefaultConfig } from '../engine/thermo/index.js';
import { traverseAndComputePrecise } from '../engine/traversal.js'; // ← new precise engine
import { exportvolume, readGeometryFromPanel, buildLayoutNodeForPrecise } from '../main.js';
import { toThermalFormat } from '../engine/geometry.js';
import { SJ54H_COMPONENTS } from '../engine/thermo/defaultComponents.js';
import { setLastCalcThermalState } from '../main.js';
import {
  loadCompressors,
  getCompressorList,
  getCurrentCompressor,
  setSelectedCompressor,
  addCompressor,
  saveCompressors,
  deleteCompressor
} from '../compressorManager.js';
import { fitInverterCoefficients } from '../engine/thermo/CompressorPerformance.js';
import { computeCompressorCoefficients } from '../engine/thermo/CompressorPerformance.js';
import { EnergyConsumption } from '../engine/thermo/solver.js';
import { settings, updateSettings } from '../settings.js';
import { getRefrigerantProperties } from '../engine/thermo/CompressorPerformance.js';
import { INVERTER_EXAMPLE_COMPONENTS } from '../engine/thermo/defaultComponents.js';
import { computeEvaporatorArea, airSpeed, evaporatorAlpha, lmtd, evaporatorCapacity } from '../engine/thermo/evaporator.js';
import * as XLSX from 'xlsx';


// Module-level state for advanced parameters
let thermalAdvanced = {
  subcool: SJ54H_COMPONENTS.subcool_K,
  dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
  fanInputPower: SJ54H_COMPONENTS.fan.inputPower_W,
  defHeater: SJ54H_COMPONENTS.electrical.defrostHeater_W,
  defOnMin: SJ54H_COMPONENTS.electrical.defrostOn_min,
  pwbOn: SJ54H_COMPONENTS.electrical.pwbOn_W,
  pwbOff: SJ54H_COMPONENTS.electrical.pwbOff_W,
  timerPeriod: SJ54H_COMPONENTS.electrical.timerPeriod_h,
  Damp: 0.6
};

let getGeometryFn = () => null; // geometry provider function

// Persistent modal elements
let thermalModal = null;
let thermalModalInputs = {};


/**
 * Public initialization entry point. 
 * Builds BOTH constant-speed and inverter panels, and restores saved state.
 * 
 * @param {Object|Function} options - Options object or geometry provider function.
 */
export function initThermoUI(options) {
  // Resolve geometry provider (backward compatible)
  if (typeof options === 'function') {
    getGeometryFn = options;
  } else if (options && options.getGeometry) {
    getGeometryFn = options.getGeometry;
  }

  // ─── Constant-speed compressor panel ───────────────
  const panelThermal = document.getElementById('panelThermal');
  if (panelThermal) {
    panelThermal.innerHTML = `
      <button id="thermoRunBtn">Run Thermal Analysis</button>
      <div id="thermoErrors"></div>
      <fieldset>
        <legend>Constant‑Speed Compressor</legend>
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
    document.getElementById('thermoRunBtn').addEventListener('click', handleRun);
    document.getElementById('thermoAdvancedBtn').addEventListener('click', openThermalSettings);
  }

  // ─── Inverter compressor panel ──────────────────────────
  const panelInverter = document.getElementById('panelInverter');
  if (panelInverter) {
    panelInverter.innerHTML = `
      <button id="inverterRunBtn">Run Inverter Analysis</button>
      <div id="inverterErrors"></div>
      <fieldset>
        <legend>Inverter Compressor</legend>
        <p style="margin:0; font-size:0.9em; color:#555;">
          ⚙️ Uses the compressor selected in <strong>Advanced Settings</strong>.
          <br>Ensure it is an inverter type.
        </p>
        <p id="currentInverterName" style="margin:4px 0 0; font-weight:bold;">—</p>

        <label>Running Ratio PR:
          <input type="number" id="inverterPR" value="0.85" step="0.01" min="0.01" max="1">
        </label>
        <label>Ambient T0 (°C):
          <input type="number" id="inverterT0" value="30" step="any">
        </label>
        <label>Freezer TF (°C):
          <input type="number" id="inverterTF" value="-18" step="any">
        </label>
        <label>Refrigerator TR (°C):
          <input type="number" id="inverterTR" value="3" step="any">
        </label>
        <label>Refrigerant:
          <select id="inverterRefrigerant">
            <option value="R-600a">R-600a</option>
            <option value="R-134a">R-134a</option>
          </select>
        </label>
        <button id="inverterAdvancedBtn" type="button">⚙️ Advanced</button>
      </fieldset>
    `;
    document.getElementById('inverterRunBtn').addEventListener('click', handleInverterRun);
    document.getElementById('inverterAdvancedBtn').addEventListener('click', openThermalSettings);
  }
  
  refreshInverterCompressorSelect();
  
  // Load saved advanced values (subcool, discharge, defrost, etc.)
  const saved = localStorage.getItem('thermoAdvanced');
  if (saved) thermalAdvanced = { ...thermalAdvanced, ...JSON.parse(saved) };

  // Build the advanced settings modal once
  buildThermalModalOnce();
  updateInverterCompressorDisplay();
}


/**
 * Builds the comprehensive thermal settings modal HTML. 
 * Executed only once during initialization to prevent DOM bloat.
 */
function buildThermalModalOnce() {
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
        <label>Side pipe pitch (mm): <input type="number" id="thermoCondSidePitch" step="any"></label>
        <label>Back pipe pitch (mm): <input type="number" id="thermoCondBackPitch" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Evaporator</legend>
        <label>Width (mm): <input id="evapWidth" type="number" step="any"></label>
        <label>Height (mm): <input id="evapHeight" type="number" step="any"></label>
        <label>Depth (mm): <input id="thermoEvapDepth" type="number" step="any"></label>
        <label>Rows: <input id="evapRows" type="number" step="any"></label>
        <label>Layers: <input id="evapLayers" type="number" step="any"></label>
        <label>Tube OD (mm): <input id="evapTubeOD" type="number" step="any"></label>
        <label>Fin Height (mm): <input id="evapFinHeight" type="number" step="any"></label>
        <label>Fin Length (mm): <input id="evapFinLength" type="number" step="any"></label>
        <label>Number of Fins: <input id="evapNumFins" type="number" step="any"></label>
        <label>Side Plates: <input id="evapSidePlateNo" type="number" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Fan Parameters</legend>
        <label>Tip Diameter (mm): <input id="tipDiam_mm" type="number" step="any"></label>
        <label>RPM: <input id="fanRPM" type="number" step="any"></label>
        <label>Input power (W): <input type="number" id="thermoFanInputPower" step="any" min="0"></label>
      </fieldset>

      <fieldset>
        <legend>Compressor</legend>
        <label>Current Compressor: <select id="thermoCompressorSelect"></select></label>
        <button id="thermoAddCompressorBtn" type="button">Add Compressor</button>
        <button id="thermoEditCompressorBtn" type="button">Edit Selected</button>
        <button id="thermoDeleteCompressorBtn" type="button">Delete Selected</button>
      </fieldset>

      <fieldset>
        <legend>Discharge</legend>
        <label>Discharge temp (°C): <input type="number" id="thermoDiscTemp" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Electrical &amp; Defrost</legend>
        <label>PWB On Power (W): <input type="number" id="thermoPwbOn" step="any"></label>
        <label>PWB Standby Power (W): <input type="number" id="thermoPwbOff" step="any"></label>
        <label>Defrost Heater (W): <input type="number" id="thermoDefHeater" step="any"></label>
        <label>Defrost On time (min): <input type="number" id="thermoDefOn" step="any"></label>
        <label>Timer Period (h): <input type="number" id="thermoTimerPeriod" step="any"></label>
      </fieldset>

      <fieldset>
        <legend>Damper</legend>
        <label>Damper Ratio:
          <input type="number" id="thermoDamp" step="any">
        </label>
      </fieldset>


      <div class="settings-actions">
        <button id="saveThermalSettings">Save &amp; Close</button>
      </div>
    </div>
  `;

  // Cache all input references for quick access
  thermalModalInputs = {
    condSidePitch: document.getElementById('thermoCondSidePitch'),
    condBackPitch: document.getElementById('thermoCondBackPitch'),
    evapWidth: document.getElementById('evapWidth'),
    evapHeight: document.getElementById('evapHeight'),
    thermoEvapDepth: document.getElementById('thermoEvapDepth'),
    evapRows: document.getElementById('evapRows'),
    evapLayers: document.getElementById('evapLayers'),
    evapTubeOD: document.getElementById('evapTubeOD'),
    evapFinHeight: document.getElementById('evapFinHeight'),
    evapFinLength: document.getElementById('evapFinLength'),
    evapNumFins: document.getElementById('evapNumFins'),
    evapSidePlateNo: document.getElementById('evapSidePlateNo'),
    tipDiam_mm: document.getElementById('tipDiam_mm'),
    fanRPM: document.getElementById('fanRPM'),
    fanInputPower: document.getElementById('thermoFanInputPower'),
    compressorSelect: document.getElementById('thermoCompressorSelect'),
    dischargeTemp: document.getElementById('thermoDiscTemp'),
    defHeater: document.getElementById('thermoDefHeater'),
    defOn: document.getElementById('thermoDefOn'),
    pwbOn: document.getElementById('thermoPwbOn'),
    pwbOff: document.getElementById('thermoPwbOff'),
    damp: document.getElementById('thermoDamp'),
    timerPeriod: document.getElementById('thermoTimerPeriod'),  };

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


/**
 * Hydrates the modal input fields from global state and unhides the modal.
 */
function openThermalSettings() {
  loadCompressors();   // ensure latest compressor list

  const cond = settings.condenser || { sidePipePitch_mm: 50, backPipePitch_mm: 50 };
  thermalModalInputs.condSidePitch.value = cond.sidePipePitch_mm;
  thermalModalInputs.condBackPitch.value = cond.backPipePitch_mm;

  const evap = settings.evaporator || {};
  thermalModalInputs.evapWidth.value       = evap.width_mm ?? 460;
  thermalModalInputs.evapHeight.value      = evap.height_mm ?? 150;
  thermalModalInputs.thermoEvapDepth.value = evap.depth_mm ?? 60;
  thermalModalInputs.evapRows.value        = evap.rows ?? 7;
  thermalModalInputs.evapLayers.value      = evap.layers ?? 2;
  thermalModalInputs.evapTubeOD.value      = evap.tubeOD_mm ?? 8;
  thermalModalInputs.evapFinHeight.value   = evap.finHeight_mm ?? 150;
  thermalModalInputs.evapFinLength.value   = evap.finLength_mm ?? 460;
  thermalModalInputs.evapNumFins.value     = evap.numFins ?? 32;
  thermalModalInputs.evapSidePlateNo.value = evap.sidePlateNo ?? 0;

  const fanP = settings.fanParam || {};
  thermalModalInputs.tipDiam_mm.value  = fanP.tipDiam_mm ?? 110;
  thermalModalInputs.fanRPM.value   = fanP.fanRPM ?? 2200;
  thermalModalInputs.fanInputPower.value = thermalAdvanced.fanInputPower;

  thermalModalInputs.dischargeTemp.value = thermalAdvanced.dischargeTemp;
  thermalModalInputs.defHeater.value     = thermalAdvanced.defHeater;
  thermalModalInputs.defOn.value         = thermalAdvanced.defOnMin;
  thermalModalInputs.pwbOn.value         = thermalAdvanced.pwbOn;
  thermalModalInputs.pwbOff.value        = thermalAdvanced.pwbOff;
  thermalModalInputs.timerPeriod.value   = thermalAdvanced.timerPeriod;
  thermalModalInputs.damp.value          = thermalAdvanced.Damp;
  refreshCompressorSelect();
  updateInverterCompressorDisplay();
  thermalModal.classList.remove('hidden');
}

/**
 * Synchronizes the compressor dropdown list with the local storage catalog.
 */
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

/**
 * Scrapes values from the thermal modal and persists them into settings.
 */
function saveThermalSettings() {
  settings.condenser = { 
    sidePipePitch_mm: parseFloat(thermalModalInputs.condSidePitch.value), 
    backPipePitch_mm: parseFloat(thermalModalInputs.condBackPitch.value) 
  };

  settings.evaporator = {
    width_mm:       parseFloat(thermalModalInputs.evapWidth.value),
    height_mm:      parseFloat(thermalModalInputs.evapHeight.value),
    depth_mm:       parseFloat(thermalModalInputs.thermoEvapDepth.value),
    rows:           parseInt(thermalModalInputs.evapRows.value),
    layers:         parseInt(thermalModalInputs.evapLayers.value),
    tubeOD_mm:      parseFloat(thermalModalInputs.evapTubeOD.value),
    finHeight_mm:   parseFloat(thermalModalInputs.evapFinHeight.value),
    finLength_mm:   parseFloat(thermalModalInputs.evapFinLength.value),
    numFins:        parseInt(thermalModalInputs.evapNumFins.value),
    sidePlateNo:    parseInt(thermalModalInputs.evapSidePlateNo.value),
  };

  settings.fanParam = {
    tipDiam_mm:  parseFloat(thermalModalInputs.tipDiam_mm.value),
    fanRPM:   parseFloat(thermalModalInputs.fanRPM.value),
  };

  updateSettings(settings);

  thermalAdvanced.dischargeTemp = parseFloat(thermalModalInputs.dischargeTemp.value) || SJ54H_COMPONENTS.dischargeTemp_C;
  thermalAdvanced.fanInputPower = parseFloat(thermalModalInputs.fanInputPower.value) || SJ54H_COMPONENTS.fan.inputPower_W;
  thermalAdvanced.defHeater     = parseFloat(thermalModalInputs.defHeater.value) || SJ54H_COMPONENTS.electrical.defrostHeater_W;
  thermalAdvanced.defOnMin      = parseFloat(thermalModalInputs.defOn.value) || SJ54H_COMPONENTS.electrical.defrostOn_min;
  thermalAdvanced.pwbOn         = parseFloat(thermalModalInputs.pwbOn.value) || SJ54H_COMPONENTS.electrical.pwbOn_W;
  thermalAdvanced.pwbOff        = parseFloat(thermalModalInputs.pwbOff.value) || SJ54H_COMPONENTS.electrical.pwbOff_W;
  thermalAdvanced.timerPeriod   = parseFloat(thermalModalInputs.timerPeriod.value) || SJ54H_COMPONENTS.electrical.timerPeriod_h;  localStorage.setItem('thermoAdvanced', JSON.stringify(thermalAdvanced));
  thermalAdvanced.Damp          = parseFloat(thermalModalInputs.damp.value) || 1.0;

  const compSelect = thermalModalInputs.compressorSelect;
  if (compSelect) setSelectedCompressor(compSelect.value);
  updateInverterCompressorDisplay();
  thermalModal.classList.add('hidden');
}


/**
 * Parses user-uploaded Excel/CSV files containing compressor performance data points.
 * Handles both Constant-Speed (TE, TC, W, Q) and Inverter (RPM, TE, TC, W, Q) formats.
 * 
 * @param {File} file - The file to parse.
 * @param {boolean} wantsInverter - Whether to enforce strict RPM column checking.
 * @returns {Promise<Array<Object>>} Extracted performance data points.
 */
export function parseCompressorDataFile(file, wantsInverter = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        const headers = Object.keys(rows[0] || {});
        
        const findCol = (candidates) =>
          headers.find(h => candidates.some(c => h.toLowerCase().includes(c)));
        
        const teCol = findCol(['te', 'evap temp']);
        const tcCol = findCol(['tc', 'cond temp']);
        const wCol  = findCol(['w', 'power']);
        const qCol  = findCol(['q', 'capacity']);
        
        if (!teCol || !tcCol || !wCol || !qCol) {
          return reject(new Error('Missing TE/TC/W/Q columns.'));
        }

        if (wantsInverter) {
          const rpmCol = findCol(['rpm', 'speed', 'r/min']);
          if (!rpmCol) return reject(new Error('RPM column missing – required for inverter.'));
          
          const data = rows.map(r => ({
            RPM: parseFloat(r[rpmCol]),
            TE: parseFloat(r[teCol]),
            TC: parseFloat(r[tcCol]),
            W:  parseFloat(r[wCol]),
            Q:  parseFloat(r[qCol]),
          })).filter(d => Object.values(d).every(v => !isNaN(v)));
          
          if (data.length < 5) return reject(new Error(`Only ${data.length} valid points.`));
          resolve(data);
        } else {
          const data = rows.map(r => ({
            TE: parseFloat(r[teCol]),
            TC: parseFloat(r[tcCol]),
            W:  parseFloat(r[wCol]),
            Q:  parseFloat(r[qCol]),
          })).filter(d => Object.values(d).every(v => !isNaN(v)));
          
          if (data.length < 5) return reject(new Error(`Only ${data.length} valid points.`));
          resolve(data);
        }
      } catch (err) {
        reject(new Error('Parsing error: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}

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


/**
 * Spawns the "Add Custom Compressor" interface, enabling users to upload
 * performance data files and fit thermodynamic polynomials.
 */
function openAddCompressorModal() {
  let modal = document.getElementById('addCompressorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'addCompressorModal';
    modal.className = 'modal hidden';
    document.body.appendChild(modal);
  }
  let contentDiv = document.getElementById('addCompressorContent');
  if (!contentDiv) {
    contentDiv = document.createElement('div');
    contentDiv.id = 'addCompressorContent';
    contentDiv.className = 'modal-content';
    modal.appendChild(contentDiv);
  }

  contentDiv.innerHTML = `
    <span class="close-btn" id="closeAddModal">&times;</span>
    <fieldset>
      <legend>Compressor Type</legend>
      <label><input type="radio" name="compType" value="constant" checked> Constant‑Speed</label>
      <label><input type="radio" name="compType" value="inverter"> Inverter</label>
    </fieldset>

    <fieldset>
      <legend>Basic Information</legend>
      <label>Name: <input id="acName" type="text" value=""></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1">R-134a</option>
          <option value="2" selected>R-600a</option>
        </select>
      </label>
    </fieldset>

    <div id="constantFields">
      <fieldset>
        <legend>Constant‑Speed Data</legend>
        <label>Cyl. Volume (cm³): <input id="acCyl" type="number" step="any"></label>
        <label>Speed (rpm): <input id="acRpm" type="number" step="any"></label>
      </fieldset>
      <fieldset>
        <legend>Load Performance Data from Excel</legend>
        <input type="file" id="acFileInput" accept=".xlsx,.xls,.csv">
        <button id="acLoadBtn" type="button">Load Data</button>
        <div id="acDataContainer"><p>No data loaded yet.</p></div>
      </fieldset>
    </div>

    <div id="inverterFields" style="display:none;">
      <fieldset>
        <legend>Inverter Data</legend>
        <label>Cyl. Volume (cm³): <input id="acInvCyl" type="number" step="any" value="10.17"></label>
      </fieldset>
      <fieldset>
        <legend>Load Performance Data from Excel</legend>
        <input type="file" id="acInvFileInput" accept=".xlsx,.xls,.csv">
        <button id="acInvLoadBtn" type="button">Load Data</button>
        <div id="acInvDataContainer"><p>No data loaded yet.</p></div>
      </fieldset>
    </div>

    <div id="acError" class="error-msg"></div>
    <div class="settings-actions">
      <button id="fitCompressorBtn">Add Compressor</button>
      <button id="cancelAddCompressor">Cancel</button>
    </div>
  `;

  modal.classList.remove('hidden');

  document.querySelectorAll('input[name="compType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isInverter = e.target.value === 'inverter';
      document.getElementById('constantFields').style.display = isInverter ? 'none' : 'block';
      document.getElementById('inverterFields').style.display = isInverter ? 'block' : 'none';
    });
  });

  let loadedDataPoints = null;
  let loadedInverterPoints = null;

  document.getElementById('acLoadBtn').onclick = async () => {
    const file = document.getElementById('acFileInput').files[0];
    if (!file) { document.getElementById('acError').textContent = 'Please select a file.'; return; }
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

  document.getElementById('acInvLoadBtn').onclick = async () => {
    const file = document.getElementById('acInvFileInput').files[0];
    if (!file) { document.getElementById('acError').textContent = 'Please select a file.'; return; }
    try {
      const points = await parseCompressorDataFile(file, true);
      loadedInverterPoints = points;
      let html = `<table class="data-table" style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr><th>RPM</th><th>TE (°C)</th><th>TC (°C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
      points.forEach(dp => {
        html += `<tr><td>${dp.RPM.toFixed(0)}</td><td>${dp.TE.toFixed(2)}</td><td>${dp.TC.toFixed(2)}</td><td>${dp.W.toFixed(2)}</td><td>${dp.Q.toFixed(2)}</td></tr>`;
      });
      html += `</tbody></table><p>${points.length} data points loaded.</p>`;
      document.getElementById('acInvDataContainer').innerHTML = html;
      document.getElementById('acError').textContent = '';
    } catch (err) {
      document.getElementById('acError').textContent = err.message;
      loadedInverterPoints = null;
    }
  };

  document.getElementById('cancelAddCompressor').onclick = () => modal.classList.add('hidden');
  document.getElementById('closeAddModal').onclick = () => modal.classList.add('hidden');

  // Triggering the polynomial solver upon creation
  document.getElementById('fitCompressorBtn').onclick = () => {
    const errorDiv = document.getElementById('acError');
    errorDiv.textContent = '';
    const compType = document.querySelector('input[name="compType"]:checked').value;
    const name = document.getElementById('acName').value.trim();
    const refIdx = parseInt(document.getElementById('acRef').value);

    if (!name) { errorDiv.textContent = 'Name is required.'; return; }

    if (compType === 'constant') {
      if (!loadedDataPoints || loadedDataPoints.length < 5) {
        errorDiv.textContent = 'Please load at least 5 data points.';
        return;
      }
      const cyl = parseFloat(document.getElementById('acCyl').value);
      const rpm = parseFloat(document.getElementById('acRpm').value);
      if (isNaN(cyl) || cyl <= 0) { errorDiv.textContent = 'Invalid cylinder volume.'; return; }
      if (isNaN(rpm) || rpm <= 0) { errorDiv.textContent = 'Invalid speed.'; return; }

      try {
        const { etaCoeffs, wCoeffs } = computeCompressorCoefficients({
          cylinderVolumeCm3: cyl, speedRpm: rpm, refrigerantIndex: refIdx, dataPoints: loadedDataPoints,
        });
        addCompressor({
          id: name.replace(/\s/g, ''), name, model: name, voltage: 100, frequency: 50,
          cylinderVolumeCm3: cyl, speedRpm: rpm, refrigerantIndex: refIdx, wCoeffs, etaCoeffs, dataPoints: loadedDataPoints,
        });
      } catch (err) { errorDiv.textContent = err.message; return; }
    } else {
      const invCyl = parseFloat(document.getElementById('acInvCyl')?.value) || 0;
      if (!loadedInverterPoints || loadedInverterPoints.length < 5) {
        errorDiv.textContent = 'Load inverter data file (needs RPM, TE, TC, W, Q). At least 5 points required.';
        return;
      }
      try {
        const normalizeRPM = Math.max(...loadedInverterPoints.map(d => d.RPM));
        const centerTE = loadedInverterPoints.reduce((s, d) => s + d.TE, 0) / loadedInverterPoints.length;
        const centerTC = loadedInverterPoints.reduce((s, d) => s + d.TC, 0) / loadedInverterPoints.length;      
        const compressorModel = fitInverterCoefficients(
          loadedInverterPoints, normalizeRPM, centerTE, centerTC, 3.0
        );
        const actualRpmMin = Math.min(...loadedInverterPoints.map(d => d.RPM));
        const actualRpmMax = Math.max(...loadedInverterPoints.map(d => d.RPM));

        addCompressor({
          id: name.replace(/\s/g, ''), name, model: name, voltage: 220, frequency: 50, isInverter: true,
          cylinderVolumeCm3: invCyl, refrigerantIndex: refIdx, compressorModel, dataPoints: loadedInverterPoints,
          rpmMin: actualRpmMin, rpmMax: actualRpmMax
        });
      } catch (e) {
        errorDiv.textContent = 'Fitting failed: ' + e.message;
        return;
      }
    }
    modal.classList.add('hidden');
    openThermalSettings(); 
  };

  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}


/**
 * Modifies an existing compressor in the catalog, allowing the user to 
 * swap out performance tables and recalculate regression models.
 */
function openEditCompressorModal() {
  let modal = document.getElementById('addCompressorModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'addCompressorModal';
    modal.className = 'modal hidden';
    document.body.appendChild(modal);
  }
  let contentDiv = document.getElementById('addCompressorContent');
  if (!contentDiv) {
    contentDiv = document.createElement('div');
    contentDiv.id = 'addCompressorContent';
    contentDiv.className = 'modal-content'; 
    modal.appendChild(contentDiv);
  }
  loadCompressors();
  const comp = getCurrentCompressor();
  if (!comp) { alert('No compressor selected.'); return; }

  const isInverter = comp.isInverter === true;
  const existingPoints = comp.dataPoints || [];

  const buildDataTableHTML = (points) => {
    if (!points || points.length === 0) return '<p>No data points stored.</p>';
    if (isInverter) {
      let html = `<table class="data-table"><thead><tr><th>RPM</th><th>TE (°C)</th><th>TC (°C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
      points.forEach(dp => {
        html += `<tr><td>${dp.RPM?.toFixed(0) ?? '—'}</td><td>${dp.TE?.toFixed(2) ?? '—'}</td><td>${dp.TC?.toFixed(2) ?? '—'}</td><td>${dp.W?.toFixed(2) ?? '—'}</td><td>${dp.Q?.toFixed(2) ?? '—'}</td></tr>`;
      });
      html += `</tbody></table><p>${points.length} points.</p>`;
      return html;
    }
    let html = `<table class="data-table"><thead><tr><th>TE (°C)</th><th>TC (°C)</th><th>W (W)</th><th>Q (W)</th></tr></thead><tbody>`;
    points.forEach(dp => {
      html += `<tr><td>${dp.TE?.toFixed(2) ?? '—'}</td><td>${dp.TC?.toFixed(2) ?? '—'}</td><td>${dp.W?.toFixed(2) ?? '—'}</td><td>${dp.Q?.toFixed(2) ?? '—'}</td></tr>`;
    });
    html += `</tbody></table><p>${points.length} points.</p>`;
    return html;
  };

  document.getElementById('addCompressorContent').innerHTML = `
    <span class="close-btn" id="closeEditModal">&times;</span>
    <h2>Edit Compressor</h2>
    <fieldset>
      <legend>Basic Information</legend>
      <label>Name: <input id="acName" type="text" value="${comp.name}"></label>
      <label>Refrigerant:
        <select id="acRef">
          <option value="1" ${comp.refrigerantIndex === 1 ? 'selected' : ''}>R-134a</option>
          <option value="2" ${comp.refrigerantIndex === 2 ? 'selected' : ''}>R-600a</option>
        </select>
      </label>
      ${isInverter ? '' : `
        <label>Cyl. Volume (cm³): <input id="acCyl" type="number" step="any" value="${comp.cylinderVolumeCm3}"></label>
        <label>Speed (rpm): <input id="acRpm" type="number" step="any" value="${comp.speedRpm}"></label>
      `}
      ${isInverter ? `
        <label>Cyl. Volume (cm³) (for reference): <input id="acCyl" type="number" step="any" value="${comp.cylinderVolumeCm3 || ''}"></label>
      ` : ''}
    </fieldset>
    <fieldset>
      <legend>Current Data Points (${existingPoints.length} points)</legend>
      <div id="acDataContainer">${buildDataTableHTML(existingPoints)}</div>
    </fieldset>
    <fieldset>
      <legend>Replace with New Excel File</legend>
      <input type="file" id="acFileInput" accept=".xlsx,.xls,.csv">
      <button id="acLoadBtn" type="button">Load & Replace</button>
      <div id="acError" class="error-msg"></div>
    </fieldset>
    <div class="settings-actions">
      <button id="fitAndSaveBtn">Fit & Save</button>
      <button id="cancelEditCompressor">Cancel</button>
    </div>
  `;

  modal.classList.remove('hidden');

  let loadedDataPoints = existingPoints.length ? existingPoints : null;

  document.getElementById('acLoadBtn').onclick = async () => {
    const file = document.getElementById('acFileInput').files[0];
    if (!file) { document.getElementById('acError').textContent = 'Please select a file.'; return; }
    try {
      const points = await parseCompressorDataFile(file, isInverter);
      loadedDataPoints = points;
      document.getElementById('acDataContainer').innerHTML = buildDataTableHTML(points);
      document.getElementById('acError').textContent = '';
    } catch (err) {
      document.getElementById('acError').textContent = err.message;
      loadedDataPoints = null;
    }
  };

  document.getElementById('cancelEditCompressor').onclick = () => modal.classList.add('hidden');
  document.getElementById('closeEditModal').onclick = () => modal.classList.add('hidden');

  document.getElementById('fitAndSaveBtn').onclick = () => {
    const errorDiv = document.getElementById('acError');
    errorDiv.textContent = '';
    if (!loadedDataPoints || loadedDataPoints.length < 5) {
      errorDiv.textContent = 'At least 5 data points required. Load a file or keep existing points.';
      return;
    }

    const newName = document.getElementById('acName').value.trim();
    const newRefIdx = parseInt(document.getElementById('acRef').value);
    if (!newName) { errorDiv.textContent = 'Name is required.'; return; }

    if (isInverter) {
      try {
        const normalizeRPM = Math.max(...loadedDataPoints.map(d => d.RPM));
        const centerTE = loadedDataPoints.reduce((s, d) => s + d.TE, 0) / loadedDataPoints.length;
        const centerTC = loadedDataPoints.reduce((s, d) => s + d.TC, 0) / loadedDataPoints.length;
        const compressorModel = fitInverterCoefficients(
          loadedDataPoints, normalizeRPM, centerTE, centerTC, 3.0
        );
        const actualRpmMin = Math.min(...loadedDataPoints.map(d => d.RPM));
        const actualRpmMax = Math.max(...loadedDataPoints.map(d => d.RPM));

        const updated = {
          ...comp, id: comp.id, name: newName, model: newName, refrigerantIndex: newRefIdx,
          cylinderVolumeCm3: parseFloat(document.getElementById('acCyl')?.value) || comp.cylinderVolumeCm3 || 0,
          isInverter: true, normalizeRPM, centerTE, centerTC, compressorModel, dataPoints: loadedDataPoints,
          rpmMin: actualRpmMin, rpmMax: actualRpmMax
        };  
        deleteCompressor(comp.id); addCompressor(updated); setSelectedCompressor(comp.id);
      } catch (err) { errorDiv.textContent = 'Fitting failed: ' + err.message; return; }
    } else {
      const newCyl = parseFloat(document.getElementById('acCyl').value);
      const newRpm = parseFloat(document.getElementById('acRpm').value);
      if (isNaN(newCyl) || newCyl <= 0) { errorDiv.textContent = 'Invalid cylinder volume.'; return; }
      if (isNaN(newRpm) || newRpm <= 0) { errorDiv.textContent = 'Invalid speed.'; return; }

      const needRefit = (loadedDataPoints !== existingPoints) || (newCyl !== comp.cylinderVolumeCm3) ||
                        (newRpm !== comp.speedRpm) || (newRefIdx !== comp.refrigerantIndex);

      let wCoeffs, etaCoeffs;
      if (needRefit) {
        try {
          const coeffs = computeCompressorCoefficients({
            cylinderVolumeCm3: newCyl, speedRpm: newRpm, refrigerantIndex: newRefIdx, dataPoints: loadedDataPoints,
          });
          wCoeffs = coeffs.wCoeffs; etaCoeffs = coeffs.etaCoeffs;
        } catch (err) { errorDiv.textContent = 'Fitting failed: ' + err.message; return; }
      } else {
        wCoeffs = comp.wCoeffs; etaCoeffs = comp.etaCoeffs;
      }

      const updated = {
        id: comp.id, name: newName, model: newName, voltage: comp.voltage || 100, frequency: comp.frequency || 50,
        cylinderVolumeCm3: newCyl, speedRpm: newRpm, refrigerantIndex: newRefIdx, wCoeffs, etaCoeffs, dataPoints: loadedDataPoints,
      };
      deleteCompressor(comp.id); addCompressor(updated); setSelectedCompressor(comp.id);
    }
    modal.classList.add('hidden');
    openThermalSettings();
  };

  modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
}


/**
 * Triggers the Constant-Speed thermal simulation.
 * Constructs the configuration payload and delegates to the engine solver.
 */
function handleRun() {
  clearMessages();
  if (!getGeometryFn) { showError('Geometry source not available.'); return; }
  const cabinetGeom = getGeometryFn();
  const geom = toThermalFormat(cabinetGeom);
  const evapDepthMain = parseFloat(document.getElementById('evapDepth')?.value) ;

  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) { showError('Please fill all temperatures.'); return; }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';

  const fanParam = settings.fanParam || {};
  const evapParam = settings.evaporator || {}; // Grab the evaporator settings
  let fanFlow, fanAirSpeed; // Declare both variables here
  try {
    // Calculate airflow and explicitly calculate physical heat transfer area
    const fanResult = airSpeed(fanParam, evapParam);
    fanFlow = fanResult.fanAirflow_m3h; 
    fanAirSpeed = fanResult.fanAirSpeed; // Assign it here
    evapParam.evapArea_m2 = computeEvaporatorArea(evapParam);
  } catch (e) {
    showError(e.message, 'inverterErrors');
    return;
  }
  if (!Number.isFinite(thermalAdvanced.fanInputPower) || thermalAdvanced.fanInputPower < 0) {
    showError('Fan input power must be a non‑negative number. Set it in Advanced Settings.', 'inverterErrors');
    return;
  }

  const comps = cabinetGeom._compartments;
  const nComps = comps?.length || 0;
  const hasFreezer = comps && comps[0].type === 'freezer';
  const freezerPosition = nComps === 1 ? 'top' : hasFreezer ? 'top' : 'bottom';
  
  const config = buildDefaultConfig({
    geom, freezerPosition, refrigerant, subcool: thermalAdvanced.subcool,
    dischargeTemp: thermalAdvanced.dischargeTemp, fixedTemps: { T0, TF, TR, TE: SJ54H_COMPONENTS.initialTE },
    fan: { fanAirflow_m3h: fanFlow, totalAirflow: fanFlow, inputPower_W: thermalAdvanced.fanInputPower },
    electrical: { 
      defrostHeater_W: thermalAdvanced.defHeater, 
      defrostOn_min: thermalAdvanced.defOnMin,
      pwbOn_W: thermalAdvanced.pwbOn,
      pwbOff_W: thermalAdvanced.pwbOff,
      timerPeriod_h: thermalAdvanced.timerPeriod,
      Damp: thermalAdvanced.Damp
    },
    evapGeom: evapParam // Pass the validated and calculated geometry explicitly
  });
  if (settings.condenser) {
    config.condenserConfig = {
      ...config.condenserConfig,
      sidePipePitch_mm: settings.condenser.sidePipePitch_mm,
      backPipePitch_mm: settings.condenser.backPipePitch_mm,
    };
  }
  
  // REMOVE the old, duplicated line: config.evapGeom = settings.evaporator || {};
  config.fanParam = fanParam;

  const defaultCompParams = config.compParams;
  loadCompressors();
  const compressor = getCurrentCompressor();
  let compressorWarning = null;
  if (compressor) {
    const toArray = (coeffs, keys) => {
      if (Array.isArray(coeffs)) return coeffs;
      if (coeffs && typeof coeffs === 'object') return keys.map(k => coeffs[k]).filter(v => v !== undefined);
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
      compressorWarning = `Compressor “${compressor.name}” is missing valid coefficients. Using default compressor (EGX80CLC) instead.`;
      console.warn(compressorWarning);
    }
  }
  config.solverOptions = config.solverOptions || {};
  config.solverOptions.innerOptions = config.solverOptions.innerOptions || {};
  config.solverOptions.innerOptions.debug = true;

  const result = runThermoAnalysis(config);
  if (result.results && result.results.compressor) {
    if (config.compParams) {
      result.results.compressor.wCoeffs = config.compParams.wCoeffs;
      result.results.compressor.etaCoeffs = config.compParams.etaCoeffs;
    }
  }
  if (!result.success) { showError(result.errors.join('; ')); return; }
  if (compressorWarning) {
    result.warnings = result.warnings || [];
    result.warnings.unshift(compressorWarning);
  }

  let energy = null;
  if (result.results && (result.results.converged !== false)) {
    try { energy = EnergyConsumption(result.results); } catch (e) { console.warn('EnergyConsumption failed:', e); }
  }

  let evapDetails = null;
  const evap = settings.evaporator;
  const fanP = settings.fanParam;
  if (evap && fanP && result.results && result.results.converged !== false) {
    try {
      const area = computeEvaporatorArea(evap);
      const fanResult = airSpeed(fanP, evap);
      const fanAirSpeed = fanResult.fanAirSpeed;
      const v = fanResult.v_ms;      const alpha = evaporatorAlpha(v);
      const TF_ = parseFloat(document.getElementById('thermoTF')?.value);
      const TR_ = parseFloat(document.getElementById('thermoTR')?.value);
      const MR = result.results.MR;
      const MF = result.results.MF;
      const totalFlow = MR + MF;
      const T1 = totalFlow > 0 ? (MF * TF_ + MR * TR_) / totalFlow : TF_;
      const T2 = result.results.T2;
      const TE = result.results.TE;
      const LMTD = lmtd(T1, T2, TE);
      const Qevap = evaporatorCapacity(alpha, area, LMTD);
      evapDetails = { area, v, alpha, LMTD, Qevap, T1 };
    } catch (e) { console.warn('Evaporator calculation failed:', e); }
  }
  if (evapDetails) result.results.evapDetails = evapDetails;
  result.results.fanAirflow = fanFlow;
  result.results.fanAirSpeed = fanAirSpeed;
  document.getElementById('tabThermal').click();
  const thermoRight = document.getElementById('thermoRightPanel');
  if (thermoRight) thermoRight.innerHTML = '';
  result.results.configLabel =
    (comps && comps.length === 1 ? `Single ${comps[0].type}` :
     freezerPosition === 'top' ? 'Top Freezer' : 'Bottom Freezer');
  setLastCalcThermalState(result.results, energy);
  displayResults(result.results, energy);
  if (result.warnings.length) showWarnings(result.warnings);
}

/**
 * Triggers the Inverter thermal simulation.
 * Calculates variable RPM requirements given a user-fixed running ratio (PR).
 */
function handleInverterRun() {
  clearMessages('inverterErrors');
  if (!getGeometryFn) { showError('Geometry source not available.', 'inverterErrors'); return; }
  const cabinetGeom = getGeometryFn();
  const geom = toThermalFormat(cabinetGeom);

  const PR = parseFloat(document.getElementById('inverterPR')?.value);
  if (isNaN(PR) || PR <= 0 || PR > 1) { showError('Please enter a valid Running Ratio (0.01–1).', 'inverterErrors'); return; }

  const T0 = parseFloat(document.getElementById('inverterT0')?.value);
  const TF = parseFloat(document.getElementById('inverterTF')?.value);
  const TR = parseFloat(document.getElementById('inverterTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) { showError('Please fill all temperatures.', 'inverterErrors'); return; }
  const refrigerant = document.getElementById('inverterRefrigerant')?.value || 'R-600a';

  const fanParam = settings.fanParam || {};
  let fanFlow, fanAirSpeed; // Declare both variables here
  const evapParam = settings.evaporator || {};
  try { 
    // Calculate airflow and explicitly calculate physical heat transfer area
    const fanResult = airSpeed(fanParam, evapParam);
    fanFlow = fanResult.fanAirflow_m3h; 
    fanAirSpeed = fanResult.fanAirSpeed; // Assign it here
    evapParam.evapArea_m2 = computeEvaporatorArea(evapParam);
  } catch (e) { 
    showError(e.message, 'inverterErrors'); 
    return; 
  }
  if (!Number.isFinite(thermalAdvanced.fanInputPower) || thermalAdvanced.fanInputPower < 0) {
    showError('Fan input power must be a non‑negative number. Set it in Advanced Settings.', 'inverterErrors'); return;
  }
  const compartments = cabinetGeom._compartments;
  const freezerPos = (compartments?.length === 1) ? 'top' : (compartments && compartments[0].type === 'freezer' ? 'top' : 'bottom');

  const config = buildDefaultConfig({
    geom, freezerPosition: freezerPos, refrigerant, subcool: thermalAdvanced.subcool,
    dischargeTemp: thermalAdvanced.dischargeTemp, fixedTemps: { T0, TF, TR, TE: SJ54H_COMPONENTS.initialTE },
    fan: { fanAirflow_m3h: fanFlow, totalAirflow: fanFlow, inputPower_W: thermalAdvanced.fanInputPower },
    electrical: { 
      defrostHeater_W: thermalAdvanced.defHeater, 
      defrostOn_min: thermalAdvanced.defOnMin,
      pwbOn_W: thermalAdvanced.pwbOn,
      pwbOff_W: thermalAdvanced.pwbOff,
      timerPeriod_h: thermalAdvanced.timerPeriod,
      Damp: thermalAdvanced.Damp
    },
    condenserConfig: {
      sidePipePitch_mm: settings.condenser?.sidePipePitch_mm ?? 150,
      backPipePitch_mm: settings.condenser?.backPipePitch_mm ?? 200,
      backCondenserEfficiency: 0.7, backCondenser: 'Yes',
    },
    evapGeom: evapParam // Pass the validated and calculated geometry explicitly
  });

  loadCompressors();
  let comp = getCurrentCompressor();
  if (!comp || !comp.isInverter) { showError('Selected compressor is not an inverter type.', 'inverterErrors'); return; }

  const pts = comp.dataPoints?.length >= 5 ? comp.dataPoints : INVERTER_EXAMPLE_COMPONENTS?.compressor?.dataPoints;
  if (!pts) { showError('No performance data available for inverter compressor.', 'inverterErrors'); return; }

  comp.compressorModel = fitInverterCoefficients(
    pts, comp.normalizeRPM || Math.max(...pts.map(d => d.RPM)),
    comp.centerTE || pts.reduce((s,d) => s + d.TE, 0) / pts.length,
    comp.centerTC || pts.reduce((s,d) => s + d.TC, 0) / pts.length, 3.0
  );
  if (!comp.compressorModel) { showError('Failed to fit inverter model.', 'inverterErrors'); return; }
  saveCompressors();

  config.compParams = {
    name: comp.name, isInverter: true, compressorModel: comp.compressorModel,
    centerTE: comp.centerTE || -25, centerTC: comp.centerTC || 45,
    rpmMin: comp.rpmMin || 1600, rpmMax: comp.rpmMax || 4500,
  };
  config.inverterPR = PR;
  if (!settings.evaporator || settings.evaporator.evapArea_m2 <= 0) {
    showError('Evaporator area is not set. Please configure in Advanced Settings.');
    return;
  }
  const result = runThermoAnalysis(config);
  if (!result.success) { showError(result.errors.join('; '), 'inverterErrors'); return; }
  if (result.warnings.length) showWarnings(result.warnings, 'inverterErrors');
  if (result.success && result.results) {
      result.results.refrigerantIndex = comp.refrigerantIndex;
      result.results.cylinderVolumeCm3 = comp.cylinderVolumeCm3;
      result.results.compressorModel = comp.compressorModel;
  }

let energy = null;
  if (result.results && (result.results.converged !== false))
  energy = EnergyConsumption(result.results);
  result.results.fanAirflow = fanFlow;
  result.results.fanAirSpeed = fanAirSpeed; // Pass it to the results object  result.results.fanAirflow = fanFlow;
  let evapDetails = null;
  const evap = settings.evaporator;
  const fanP = settings.fanParam;
  if (evap && fanP && result.results && result.results.converged !== false) {
    try {
      const area = computeEvaporatorArea(evap);
      const fanResult = airSpeed(fanP, evap);
      const fanAirSpeed = fanResult.fanAirSpeed;
      const v = fanResult.v_ms;      const alpha = evaporatorAlpha(v);
      const MR = result.results.MR;
      const MF = result.results.MF;
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
  result.results.configLabel = (freezerPos === 'top' ? 'Top Freezer' : 'Bottom Freezer') + ' (Inverter)';
  setLastCalcThermalState(result.results, energy);
  displayResults(result.results, energy, true);
}


/**
 * Transforms an Inverter polynomial configuration back into a readable math string.
 */
function buildInverterEquation(model, varName) {
    if (!model) return '';

    const formatEq = (c, form, log) => {
        const prefix = log ? `ln(${varName})` : varName;
        let eq = `${prefix} = ${c[0].toFixed(4)}`;
        const addTerm = (coeff, term) => {
            if (Math.abs(coeff) < 1e-12) return;
            const sign = coeff > 0 ? ' + ' : ' - ';
            eq += `${sign}${Math.abs(coeff).toFixed(4)} * ${term}`;
        };
        
        // Map exact features from makeFeatures() in CompressorPerformance.js
        if (form === 'n_lin') {
            addTerm(c[1], 'n'); addTerm(c[2], 'n*te'); addTerm(c[3], 'n*tc'); addTerm(c[4], 'n*tc*te'); addTerm(c[5], 'n*te²');
        } else if (form === 'n_quad') {
            addTerm(c[1], 'n'); addTerm(c[2], 'n²'); addTerm(c[3], 'n*te'); addTerm(c[4], 'n*tc'); addTerm(c[5], 'n*tc*te'); addTerm(c[6], 'n*te²');
        } else if (form === 'ln_n_lin') {
            addTerm(c[1], 'ln(n)'); addTerm(c[2], 'ln(n)*te'); addTerm(c[3], 'ln(n)*tc'); addTerm(c[4], 'ln(n)*tc*te'); addTerm(c[5], 'ln(n)*te²');
        } else if (form === 'ln_n_quad') {
            addTerm(c[1], 'ln(n)'); addTerm(c[2], 'ln(n)²'); addTerm(c[3], 'ln(n)*te'); addTerm(c[4], 'ln(n)*tc'); addTerm(c[5], 'ln(n)*tc*te'); addTerm(c[6], 'ln(n)*te²');
        }
        
        if (log) eq = `ln(${varName}) = ${eq.substring(eq.indexOf('=') + 1)}`;
        return eq;
    };

    if (model.type === 'global' && model.coeffs) {
        return formatEq(model.coeffs, model.rpmForm, model.logTransform);
    } else if (model.type === 'piecewise') {
        // Piecewise models in this engine strictly use 'n_quad' without log transforms
        const eqLow = model.coeffs_low ? formatEq(model.coeffs_low, 'n_quad', false) : 'N/A';
        const eqMax = model.coeffs_max ? formatEq(model.coeffs_max, 'n_quad', false) : 'N/A';
        
        return `<strong>Piecewise Model</strong><br>
                RPM &le; ${model.splitRPM}: ${eqLow}<br>
                RPM = ${model.maxRPM}: ${eqMax}<br>
                <em style="color:#555;">(Interpolates between ${model.splitRPM} and ${model.maxRPM} RPM)</em>`;
    }
    
    return '';
}

/**
 * Injects the numerical results from the solver into the HTML tables on the right panel.
 * 
 * @param {Object} res - The solver results.
 * @param {Object} energy - The calculated daily/monthly energy estimations.
 * @param {boolean} isInverter - Formatting flag.
 */
function displayResults(res, energy, isInverter = false) {
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
  let TF;
  if(isInverter){
    TF = parseFloat(document.getElementById('inverterTF')?.value);
  }else{
    TF = parseFloat(document.getElementById('thermoTF')?.value);
  }
  const comp = res.compressor || {};
  const pe = (comp.Pe !== undefined ? comp.Pe : res.Pe)?.toFixed(4) ?? '—';
  const pc = (comp.Pc !== undefined ? comp.Pc : res.Pc)?.toFixed(4) ?? '—';
  const qComp = comp.coolingCapacity !== undefined ? fmt(comp.coolingCapacity) : '—';
  const pComp = comp.inputPower       !== undefined ? fmt(comp.inputPower) : '—';
  const COP   = comp.COP !== undefined ? fmt(comp.COP, 2) : '—';
  const mFlow = comp.massFlow         !== undefined ? fmt(comp.massFlow, 4) : '—';
  const eW   = energy ? fmt(energy.EnergyConsumption_kWhDay, 3) : '—';
  const eKWh = energy ? fmt(energy.EnergyConsumption_kWhMonth, 3) : '—';
  const volumes = exportvolume(traverseAndComputePrecise(buildLayoutNodeForPrecise(), readGeometryFromPanel()).leaves, readGeometryFromPanel());  
  const Ann_EC = eW * 365;
  const AV = (volumes.freezerTotal * (25-TF)/21)+volumes.freshTotal;
  const ES_27 = AV * .57 + (800 * 0.9);
  const ES_29 = AV * .57 + (800 * 0.8);
  const ES_31 = AV * .57 + (800 * 0.6);
  const IEE_27 = eKWh * 12 / ES_27;
  const IEE_29 = eKWh * 12 / ES_29;
  const IEE_31 = eKWh * 12 / ES_31;
  let Rank_27, Rank_29, Rank_31;
  if( IEE_27 <= 0.45){
     Rank_27 = "A"
    }else if(IEE_27 <= 0.55){
     Rank_27 = "B"
    }else if(IEE_27 <= 0.65){
     Rank_27 = "C"
    }else if(IEE_27 <= 0.75){
     Rank_27 = "D"
    }else if(IEE_27 <= 0.85){
     Rank_27 = "OUT OF RANKING"
  }
  if( IEE_29 <= 0.45){
     Rank_29 = "A"
    }else if(IEE_29 <= 0.55){
     Rank_29 = "B"
    }else if(IEE_29 <= 0.65){
     Rank_29 = "C"
    }else if(IEE_29 <= 0.75){
     Rank_29 = "D"
    }else if(IEE_29 <= 0.85){
     Rank_29 = "OUT OF RANKING"
  }
  if( IEE_31 <= 0.45){
     Rank_31 = "A"
    }else if(IEE_31 <= 0.55){
     Rank_31 = "B"
    }else if(IEE_31 <= 0.65){
     Rank_31 = "C"
    }else if(IEE_31 <= 0.75){
     Rank_31 = "D"
    }else if(IEE_31 <= 0.85){
     Rank_31 = "OUT OF RANKING"
  }

  
  let etaV = '—';
  if (isInverter && res.RPM !== undefined && res.refrigerantIndex !== undefined && res.cylinderVolumeCm3 && comp.massFlow) {
      try {
          const prop = getRefrigerantProperties(res.refrigerantIndex);
          const suctionTempK = 32.2 + 273.16;
          const Pe = comp.Pe; 
          const vGas = prop.specificVolume(suctionTempK, Pe);
          const displacement_m3h = (res.cylinderVolumeCm3 * res.RPM * 60) / 1e6;
          const theoMassFlow = displacement_m3h / vGas;
          const actualMassFlow = comp.massFlow;
          etaV = (actualMassFlow / theoMassFlow * 100).toFixed(1) + ' %';
      } catch (e) {
          console.warn('etaV computation failed:', e);
          etaV = '—';
      }
  } else {
      etaV = comp.etaV != null ? fmtP(comp.etaV) : '—';
  }

  let etaStr = '—', wStr = '—';
  if (isInverter && res.compressorModel) {
      etaStr = buildInverterEquation(res.compressorModel.Q, 'Q');
      wStr   = buildInverterEquation(res.compressorModel.W, 'W');
  } else {
      if (comp.etaCoeffs && comp.etaCoeffs.length === 3) {
          etaStr = `ηv = A + B·Pc/Pe + C·Pc  (A=${comp.etaCoeffs[0].toFixed(5)}, B=${comp.etaCoeffs[1].toFixed(5)}, C=${comp.etaCoeffs[2].toFixed(5)})`;
      }
      if (comp.wCoeffs && comp.wCoeffs.length === 5) {
          wStr = `W = AW + BW·TE + CW·TC + DW·TC·TE + EW·TE²  (AW=${comp.wCoeffs[0].toFixed(5)}, BW=${comp.wCoeffs[1].toFixed(5)}, CW=${comp.wCoeffs[2].toFixed(5)}, DW=${comp.wCoeffs[3].toFixed(5)}, EW=${comp.wCoeffs[4].toFixed(5)})`;
      }
  }

  const fanAirflow_m3h = res.fanAirflow !== undefined ? res.fanAirflow : 0;
  const fanAirflow_CFM = fanAirflow_m3h * 0.588578;
  const fanAirSpeed = res.fanAirSpeed;
  const FreezerFlowRatio = res.MF !== undefined && res.MR !== undefined ? (100*res.MF / (res.MF + res.MR)) : '—';
  const RefrigeratorFlowRatio = res.MF !== undefined && res.MR !== undefined ? (100*res.MR / (res.MF + res.MR)) : '—';

  const configLabel = res.configLabel || 'Unknown';
  const totalLoad = res.heatLoads?.totalLoad ?? '—';
  const html = `
    <table class="thermo-results-table">
      <thead>
        <tr><th colspan="2">Thermal Analysis Results — ${configLabel}</th></tr>
      </thead>
      <tbody>
        <tr class="section-header"><td colspan="2">Operating Points</td></tr>
        <tr><td>Condensing temp TC</td><td>${fmt(res.TC)} °C</td></tr>
        <tr><td>Subcool temp Tsubcool</td><td>${fmt(res.Tsubcool)}  C</td></tr>
        <tr><td>Evaporating temp TE</td><td>${fmt(res.TE)} °C</td></tr>
        <tr><td>Suction temp Tsuc [fixed]</td><td>30 °C</td></tr>
        <tr><td>Mixed inlet T1</td><td>${fmt(res.evapDetails.T1, 2)} °C</td></tr>
        <tr><td>Evap. outlet T2</td><td>${fmt(res.T2)} °C</td></tr>
        <tr><td>T3</td><td>${fmt(res.T3, 2)} C</td></tr>` +
        `${isInverter
          ? `<tr><td>Running Ratio PR (fixed)</td><td>${fmtP(res.PR)}</td></tr>` +
            `<tr><td>Required Compressor RPM</td><td>${res.RPM !== undefined ? fmt(res.RPM, 0) : '—'} rpm</td></tr>`
          : `<tr><td>Running Ratio PR</td><td>${fmtP(res.PR)}</td></tr>`
        }

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
        <tr><td>energy Rank</td><td>Rank_27 = ${Rank_27} <br> Rank_29 = ${Rank_29} <br> Rank_31 = ${Rank_31}</td></tr>

        <tr class="section-header"><td colspan="2">Heat Loads (W)</td></tr>
        <tr><td>QF — Freezer compartment</td><td>${fmt(res.heatLoads.QF)}</td></tr>
        <tr><td>QR — Refrigerator compartment</td><td>${fmt(res.heatLoads.QR)}</td></tr>
        <tr><td>QEV — Evaporator total</td><td>${fmt(res.heatLoads.QEV)}</td></tr>
        <tr><td>Fan load</td><td>${fmt(res.heatLoads.fanLoad)}</td></tr>
        <tr><td>Defrost load</td><td>${fmt(res.heatLoads.defrostLoad)}</td></tr>
        <tr><td>Total load</td><td>${fmt(res.heatLoads.totalLoad)}</td></tr>

        <tr class="section-header"><td colspan="2">Fan Airflow</td></tr>
        <tr><td>Calculated Fan Air Speed</td><td>${fmt(fanAirSpeed, 1)}  m/s</td></tr>
        <tr><td>Calculated airflow</td><td>${fmt(fanAirflow_CFM, 1)} CFM (${fmt(fanAirflow_m3h, 1)} m³/h)</td></tr>
        <tr><td>Freezer flow (MF)</td><td>${fmt(res.MF, 2)} m³/h [${fmt(FreezerFlowRatio, 2)}%]</td></tr>
        <tr><td>Refrigerator flow (MR)</td><td>${fmt(res.MR, 2)} m³/h [${fmt(RefrigeratorFlowRatio, 2)}%]</td></tr>
        ${
          res.evapDetails ? `
          <tr class="section-header"><td colspan="2">Evaporator Performance</td></tr>
          <tr><td>Surface area</td><td>${fmt(res.evapDetails.area, 4)} m²</td></tr>
          <tr><td>Air speed</td><td>${fmt(res.evapDetails.v, 3)} m/s</td></tr>
          <tr><td>Heat transfer coeff α</td><td>${fmt(res.evapDetails.alpha, 2)} W/(m²·K)</td></tr>
          <tr><td>LMTD</td><td>${fmt(res.evapDetails.LMTD, 2)} °C</td></tr>
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

function clearMessages(errorDivId = 'thermoErrors') {
  const errDiv = document.getElementById(errorDivId);
  if (errDiv) errDiv.innerHTML = '';
  const thermoRight = document.getElementById('thermoRightPanel');
  if (thermoRight) thermoRight.innerHTML = '';
}

function showError(msg, errorDivId = 'thermoErrors') {
  const e = document.getElementById(errorDivId);
  if (e) e.innerHTML = `<p class="error">❌ ${msg}</p>`;
}

function showWarnings(warnings, errorDivId = 'thermoErrors') {
  const e = document.getElementById(errorDivId);
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
    T0: parseFloat(document.getElementById('thermoT0')?.value),
    TF: parseFloat(document.getElementById('thermoTF')?.value),
    TR: parseFloat(document.getElementById('thermoTR')?.value),
    refrigerant: document.getElementById('thermoRefrigerant')?.value,
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
      list[existingIdx] = data.compressor;
      localStorage.setItem('compressorList', JSON.stringify(list));
    }
    setSelectedCompressor(data.compressor.id);
  }
  updateSettings(settings);
}

function refreshInverterCompressorSelect() {
  loadCompressors();
  const select = document.getElementById('inverterCompressorSelect');
  if (!select) return;
  select.innerHTML = '';
  const inverters = getCompressorList().filter(c => c.isInverter);
  inverters.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  if (select.options.length > 0 && !select.value) {
    select.value = inverters[0].id;
  }
}

function populateInverterCompressorSelect() {
  loadCompressors();
  const select = document.getElementById('inverterCompressorSelect');
  if (!select) return;
  select.innerHTML = '';
  getCompressorList().filter(c => c.isInverter).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
  if (select.options.length && !select.value)
    select.value = select.options[0].value;
}

function updateInverterCompressorDisplay() {
  const comp = getCurrentCompressor();
  const nameEl = document.getElementById('currentInverterName');
  if (!nameEl) return;
  if (comp && comp.isInverter) {
    nameEl.textContent = comp.name;
    nameEl.style.color = '#22a55e';
  } else {
    nameEl.textContent = 'No inverter compressor selected';
    nameEl.style.color = '#ef4444';
  }
}

export function ensureInverterModel(comp) {
  if (!comp || !comp.isInverter) return comp;
  if (comp.compressorModel) return comp;

  const pts = comp.dataPoints;
  if (!pts || pts.length < 5) {
    console.warn(
      `Inverter compressor “${comp.name}” has insufficient data points ` +
      `(${pts ? pts.length : 0} provided). The model will NOT be fitted.`
    );
    return comp;
  }

  const normalizeRPM = Math.max(...pts.map(d => d.RPM));
  const centerTE = pts.reduce((s, d) => s + d.TE, 0) / pts.length;
  const centerTC = pts.reduce((s, d) => s + d.TC, 0) / pts.length;
  comp.compressorModel = fitInverterCoefficients(pts, normalizeRPM, centerTE, centerTC);

  saveCompressors();
  return comp;
}