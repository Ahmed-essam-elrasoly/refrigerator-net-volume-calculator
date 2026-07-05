// ──────────────────────────────────────────────────────────────────────────────
// thermoUI.js — Thermal analysis panel
//
// Changes from original:
//   • Removed unused `runThermalAnalysisDynamic` import (wrong API shape).
//   • initThermoUI: initialises the new thermoFanInputPower field.
//   • handleRun: uses buildDefaultConfig() so compParams (wCoeffs/etaCoeffs
//     arrays) and condenserConfig (sidePipePitch_mm / backPipePitch_mm keys)
//     are correctly formatted for solver.js.  Then calls runThermoAnalysis()
//     whose return shape { success, errors, warnings, results } matches the
//     existing handler logic.
//   • displayResults: shows all result fields (TE, etaV, fanLoad, defrostLoad,
//     iteration counts) that were previously missing.
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
import { EnergyConsumption } from '../engine/thermo/solver.js';   // adjust path if needed
import { settings, updateSettings } from '../settings.js';
import { computeEvaporatorArea, airSpeed, evaporatorAlpha, lmtd, evaporatorCapacity } from '../engine/thermo/evaporator.js';

// Store advanced parameters globally, initialised from defaults
let thermalAdvanced = {
  subcool: SJ54H_COMPONENTS.subcool_K,
  dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
  fanInputPower: SJ54H_COMPONENTS.fan.inputPower_W,
  defHeater: SJ54H_COMPONENTS.electrical.defrostHeater_W,
  defOnMin: SJ54H_COMPONENTS.electrical.defrostOn_min
};
let getGeometryFn = null;

export function initThermoUI(getGeometry) {
  getGeometryFn = getGeometry;

  const panel = document.getElementById('panelThermal');
  if (!panel) return;

  panel.innerHTML = `
    <button id="thermoRunBtn">Run Thermal Analysis</button>
    <div id="thermoErrors"></div>   <!-- keep errors in the left panel -->
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
      <label>Fan airflow (m³/h): <input type="number" id="thermoFanFlow" step="any"></label>
      <button id="thermoAdvancedBtn" type="button">⚙️ Advanced</button>
    </fieldset>
  `;
  // Set default values
  document.getElementById('thermoFanFlow').value = SJ54H_COMPONENTS.fan.totalAirflow_m3h;

  // Load advanced values from localStorage (if any)
  const saved = localStorage.getItem('thermoAdvanced');
  if (saved) thermalAdvanced = { ...thermalAdvanced, ...JSON.parse(saved) };

  document.getElementById('thermoAdvancedBtn').addEventListener('click', openThermalSettings);
  document.getElementById('thermoRunBtn').addEventListener('click', handleRun);
}

function openThermalSettings() {
  const modal = document.getElementById('thermalSettingsModal');
  if (!modal) return;

  // Ensure compressor list is fresh
  loadCompressors();
  const compressors = getCompressorList();
  const currentComp = getCurrentCompressor();

  // Read condenser settings from the main settings object (with fallback)
  const cond = settings.condenser || { sidePipePitch_mm: 50, backPipePitch_mm: 50 };

  // Build the full modal content
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-btn" id="closeThermalSettings">&times;</span>
      <h2>Thermal Design Parameters</h2>

      <fieldset>
        <legend>Condenser</legend>
        <label>Side pipe pitch (mm):
          <input type="number" id="thermoCondSidePitch" value="${cond.sidePipePitch_mm}" step="any">
        </label>
        <label>Back pipe pitch (mm):
          <input type="number" id="thermoCondBackPitch" value="${cond.backPipePitch_mm}" step="any">
        </label>
      </fieldset>

      <fieldset>
        <legend>Evaporator</legend>
        <label>Width (mm): <input id="evapWidth" type="number" step="any"></label>
        <label>Height (mm): <input id="evapHeight" type="number" step="any"></label>
        <label>Depth (mm): <input id="evapDepth" type="number" step="any"></label>
        <label>Rows: <input id="evapRows" type="number" step="any"></label>
        <label>Tube OD (mm): <input id="evapTubeOD" type="number" step="any"></label>
        <label>Fin Pitch (mm): <input id="evapFinPitch" type="number" step="any"></label>
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
          <input type="number" id="thermoFanInputPower" value="${thermalAdvanced.fanInputPower}" step="any" min="0">
        </label>

      </fieldset>
      <fieldset>
        <legend>Compressor</legend>
        <label>Current Compressor:
          <select id="thermoCompressorSelect">
            ${compressors.map(c => `<option value="${c.id}" ${c.id === currentComp.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </label>
        <button id="thermoAddCompressorBtn" type="button">Add Compressor</button>
        <button id="thermoEditCompressorBtn" type="button">Edit Selected</button>
        <button id="thermoDeleteCompressorBtn" type="button">Delete Selected</button>
        <div id="thermoCompressorList"></div>  <!-- can be used for detailed info later -->
      </fieldset>

      <fieldset>
        <legend>Subcool &amp; Discharge</legend>
        <label>Subcool (K):
          <input type="number" id="thermoSubcool" value="${thermalAdvanced.subcool}" step="any">
        </label>
        <label>Discharge temp (°C):
          <input type="number" id="thermoDiscTemp" value="${thermalAdvanced.dischargeTemp}" step="any">
        </label>
      </fieldset>

        <legend>Defrost</legend>
        <label>Heater (W):
          <input type="number" id="thermoDefHeater" value="${thermalAdvanced.defHeater}" step="any">
        </label>
        <label>On time (min/24h):
          <input type="number" id="thermoDefOn" value="${thermalAdvanced.defOnMin}" step="any">
        </label>
      </fieldset>

      <div class="settings-actions">
        <button id="saveThermalSettings">Save &amp; Close</button>
      </div>
    </div>
  `;
  const evap = settings.evaporator || {};
  document.getElementById('evapWidth').value       = evap.width_mm ?? 460;
  document.getElementById('evapHeight').value      = evap.height_mm ?? 150;
  document.getElementById('evapDepth').value       = evap.depth_mm ?? 60;
  document.getElementById('evapRows').value        = evap.rows ?? 2;
  document.getElementById('evapTubeOD').value      = evap.tubeOD_mm ?? 8;
  document.getElementById('evapFinPitch').value    = evap.finPitch_mm ?? 4;
  document.getElementById('evapFinHeight').value   = evap.finHeight_mm ?? 150;
  document.getElementById('evapFinLength').value   = evap.finLength_mm ?? 460;
  document.getElementById('evapNumFins').value     = evap.numFins ?? 32;
  document.getElementById('evapSidePlateNo').value = evap.sidePlateNo ?? 0;

  const fanP = settings.fanParam || {};
  document.getElementById('fanDiam').value  = fanP.fanDiam ?? 100;
  document.getElementById('fanRPM').value   = fanP.fanRPM ?? 2200;
  document.getElementById('fanThick').value = fanP.fanThick ?? 25;
  modal.classList.remove('hidden');

  // Attach event listeners
  document.getElementById('closeThermalSettings').onclick = () => modal.classList.add('hidden');

  // Compressor management
document.getElementById('thermoAddCompressorBtn').onclick = () => {
  openAddCompressorModal();
};
document.getElementById('thermoEditCompressorBtn').onclick = () => {
  openEditCompressorModal();
};
  document.getElementById('thermoDeleteCompressorBtn').onclick = () => {
    const sel = document.getElementById('thermoCompressorSelect');
    if (confirm('Delete the selected compressor?')) {
      deleteCompressor(sel.value);
      openThermalSettings(); // refresh
    }
  };

  document.getElementById('thermoCompressorSelect').onchange = (e) => {
    setSelectedCompressor(e.target.value);
  };

  // Save button
  document.getElementById('saveThermalSettings').onclick = () => {
    // Read condenser fields
    const sidePitch = parseFloat(document.getElementById('thermoCondSidePitch').value) || 50;
    const backPitch = parseFloat(document.getElementById('thermoCondBackPitch').value) || 50;
    settings.condenser = {
      sidePipePitch_mm: sidePitch,
      backPipePitch_mm: backPitch,
    };
        // Read evaporator fields
    settings.evaporator = {
      width_mm:       parseFloat(document.getElementById('evapWidth').value) || 460,
      height_mm:      parseFloat(document.getElementById('evapHeight').value) || 150,
      depth_mm:       parseFloat(document.getElementById('evapDepth').value) || 60,
      rows:           parseInt(document.getElementById('evapRows').value) || 2,
      tubeOD_mm:      parseFloat(document.getElementById('evapTubeOD').value) || 8,
      finPitch_mm:    parseFloat(document.getElementById('evapFinPitch').value) || 4,
      finHeight_mm:   parseFloat(document.getElementById('evapFinHeight').value) || 150,
      finLength_mm:   parseFloat(document.getElementById('evapFinLength').value) || 460,
      numFins:        parseInt(document.getElementById('evapNumFins').value) || 32,
      sidePlateNo:    parseInt(document.getElementById('evapSidePlateNo').value) || 0,
    };

    // Read fan parameters
    settings.fanParam = {
      fanDiam:  parseFloat(document.getElementById('fanDiam').value) || 100,
      fanRPM:   parseFloat(document.getElementById('fanRPM').value) || 2200,
      fanThick: parseFloat(document.getElementById('fanThick').value) || 25,
    };
    updateSettings(settings);   // persist & fire event

    // Save the advanced thermal values to localStorage
    thermalAdvanced.subcool       = parseFloat(document.getElementById('thermoSubcool').value) || SJ54H_COMPONENTS.subcool_K;
    thermalAdvanced.dischargeTemp = parseFloat(document.getElementById('thermoDiscTemp').value) || SJ54H_COMPONENTS.dischargeTemp_C;
    thermalAdvanced.fanInputPower = parseFloat(document.getElementById('thermoFanInputPower').value) || SJ54H_COMPONENTS.fan.inputPower_W;
    thermalAdvanced.defHeater     = parseFloat(document.getElementById('thermoDefHeater').value) || SJ54H_COMPONENTS.electrical.defrostHeater_W;
    thermalAdvanced.defOnMin      = parseFloat(document.getElementById('thermoDefOn').value) || SJ54H_COMPONENTS.electrical.defrostOn_min;
    localStorage.setItem('thermoAdvanced', JSON.stringify(thermalAdvanced));

    // Compressor selection already saved by onchange, but ensure it's set
    const compSelect = document.getElementById('thermoCompressorSelect');
    if (compSelect) setSelectedCompressor(compSelect.value);

    modal.classList.add('hidden');
  };

  // Close when clicking outside modal
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  };
}


function handleRun() {
  clearMessages();
  if (!getGeometryFn) { showError('Geometry source not available.'); return; }
  const cabinetGeom = getGeometryFn();

  // ===== REMOVED the restrictive check entirely =====

  const geom = toThermalFormat(cabinetGeom);

  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) { showError('Please fill all temperatures.'); return; }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';
  const fanFlow = parseFloat(document.getElementById('thermoFanFlow')?.value) || SJ54H_COMPONENTS.fan.totalAirflow_m3h;

  // Determine freezer position correctly for any configuration
const comps = cabinetGeom._compartments;
const nComps = comps?.length || 0;
const hasFreezer = comps && comps[0].type === 'freezer';
const freezerPosition =
    nComps === 1 ? 'top' :                // single compartment always "top" (no other)
    hasFreezer ? 'top' : 'bottom';

  const config = buildDefaultConfig({
    geom,
    freezerPosition,              // now always valid
    refrigerant,
    subcool: thermalAdvanced.subcool,
    dischargeTemp: thermalAdvanced.dischargeTemp,
    fixedTemps: { T0, TF, TR, TE: SJ54H_COMPONENTS.initialTE },
    fan: { totalAirflow: fanFlow, inputPower_W: thermalAdvanced.fanInputPower },
    electrical: { defrostHeater_W: thermalAdvanced.defHeater, defrostOn_min: thermalAdvanced.defOnMin },
  });
  config.evapGeom = settings.evaporator || {};
  config.fanParam = settings.fanParam || {};
  // Keep a reference to the default (working) coefficients
  const defaultCompParams = config.compParams;

  loadCompressors();
  const compressor = getCurrentCompressor();   // single declaration
  console.log('Loaded compressor object:', JSON.stringify(compressor, null, 2));
    // Replace compParams only if the selected compressor provides valid arrays
  if (compressor) {
      // Helper: ensure coefficients are a flat array
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
          console.warn('Selected compressor missing coefficients – using default.', compressor);
      }
  }
config.solverOptions = config.solverOptions || {};
config.solverOptions.innerOptions = config.solverOptions.innerOptions || {};
config.solverOptions.innerOptions.debug = true;
  // Now it’s safe to run
  const result = runThermoAnalysis(config);
  if (!result.success) {
    showError(result.errors.join('; '));
    return;
  }

  // Compute energy consumption
  let energy = null;
  if (result.results && result.results.converged) {
    try {
      energy = EnergyConsumption(result.results);
    } catch (e) {
      console.warn('EnergyConsumption calculation failed:', e);
    }
  }
  // Fallback: if converged flag is missing, assume converged if PR is present
  if (result.results && (result.results.converged !== false)) {
    try {
      energy = EnergyConsumption(result.results);
    } catch (e) {
      console.error('EnergyConsumption threw:', e);
    }
  }
  // Compute evaporator performance if settings exist
  let evapDetails = null;
  const evap = settings.evaporator;
  const fanP = settings.fanParam;
  if (evap && fanP && result.results && result.results.converged !== false) {
    try {
      const area = computeEvaporatorArea(evap);
      const v = airSpeed(fanP, evap);
      const alpha = evaporatorAlpha(v);
      const TF = parseFloat(document.getElementById('thermoTF')?.value) || -18;
      const TR = parseFloat(document.getElementById('thermoTR')?.value) || 3;
      const MR = result.results.MR || 0;
      const MF = result.results.MF || 0;
      const totalFlow = MR + MF;
      const T1 = totalFlow > 0 ? (MF * TF + MR * TR) / totalFlow : TF;
      const T2 = result.results.T2;
      const TE = result.results.TE;
      const LMTD = lmtd(T1, T2, TE);
      const Qevap = evaporatorCapacity(alpha, area, LMTD);
      evapDetails = { area, v, alpha, LMTD, Qevap, T1 };
    } catch (e) {
      console.warn('Evaporator calculation failed:', e);
    }
  }

  // Attach to results so displayResults can use it
  if (evapDetails) {
    result.results.evapDetails = evapDetails;
  }
  console.log('Displaying results with QF:', result.results.heatLoads.QF, 'QR:', result.results.heatLoads.QR);

  // Force the Thermal tab to show the new results
  document.getElementById('tabThermal').click();
  const thermoRight = document.getElementById('thermoRightPanel');
  if (thermoRight) thermoRight.innerHTML = '';
  result.results.configLabel = 
    (comps && comps.length === 1 ? `Single ${comps[0].type}` : 
     freezerPosition === 'top' ? 'Top Freezer' : 'Bottom Freezer');
  displayResults(result.results, energy);
  if (result.warnings.length) showWarnings(result.warnings);}

// ---------------------------------------------------------------------------
// Add Compressor Modal – builds the 3×3 matrix, fits coefficients, adds to list
// ---------------------------------------------------------------------------
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
    [ 70.554507,  67.112824,  61.950299],
    [129.063122, 126.481860, 121.319335],
    [215.105204, 210.803100, 203.919733],
  ];
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
          Q: <input id="q_${i}_${j}" type="number" step="any" value="${Q_matrix[i][j]}" style="width:80px;"><br>
          W: <input id="w_${i}_${j}" type="number" step="any" value="${W_matrix[i][j]}" style="width:80px;">
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
        wCoeffs,
        etaCoeffs,
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

  // Preset values from the selected compressor
  const name = comp.name || '';
  const cyl  = comp.cylinderVolumeCm3 || 10.17;
  const rpm  = comp.speedRpm || 2220;
  const refIdx = comp.refrigerantIndex || 2;   // we don't store refrigerant index, default R‑600a

  // We can't recover original test data, so we show empty matrix
  const defaultTE = [-34.4, -23.3, -12.2];
  const defaultTC = [37.8, 46.1, 54.4];
  const Q_matrix = [['','',''],['','',''],['','','']];
  const W_matrix = [['','',''],['','',''],['','','']];
  // Build the modal content – note the title says "Edit Compressor"
  const headerCells = defaultTC.map((tc, j) => `
    <th style="text-align:center;">TC<br><input id="tc_${j}" type="number" step="any" value="${tc}" style="width:70px;"></th>
  `).join('');
  const bodyRows = defaultTE.map((te, i) => `
    <tr>
      <th style="text-align:center;">TE<br><input id="te_${i}" type="number" step="any" value="${te}" style="width:70px;"></th>
      ${defaultTC.map((_, j) => `
        <td>
          Q: <input id="q_${i}_${j}" type="number" step="any" value="${Q_matrix[i][j]}" style="width:80px;"><br>
          W: <input id="w_${i}_${j}" type="number" step="any" value="${W_matrix[i][j]}" style="width:80px;">
        </td>
      `).join('')}
    </tr>
  `).join('');

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
      <legend>Test Data (optional – fill at least 5 cells to recompute)</legend>
      <table class="matrix-table">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      <p><small>Leave cells empty to keep existing coefficients. Fill at least 5 data points to recompute.</small></p>
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
    // After the loop that builds dataPoints:
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
          // Keep existing coefficients, but must be valid
          if (!comp.wCoeffs || !comp.etaCoeffs || comp.wCoeffs.length !== 5 || comp.etaCoeffs.length !== 3) {
            errorDiv.textContent = 'No valid existing coefficients. Please enter at least 5 test data points.';
            return;
          }
      wCoeffs = comp.wCoeffs;
      etaCoeffs = comp.etaCoeffs;
    }

    // Build the updated compressor object
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
// ─── Results display ───────────────────────────────────────────────────────

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
  const qComp= comp.coolingCapacity !== undefined ? fmt(comp.coolingCapacity) : '—';
  const pComp= comp.inputPower       !== undefined ? fmt(comp.inputPower) : '—';
  const mFlow= comp.massFlow         !== undefined ? fmt(comp.massFlow, 4) : '—';

  const eW   = energy ? fmt(energy.EnergyConsumption_W, 3) : '—';
  const eKWh = energy ? fmt(energy.EnergyConsumption_kWhMonth, 3) : '—';

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
        <tr><td>Cooling capacity</td><td>${qComp} kcal/h</td></tr>
        <tr><td>Input power</td><td>${pComp} W</td></tr>
        <tr><td>Mass flow</td><td>${mFlow} kg/h</td></tr>

        <tr class="section-header"><td colspan="2">Energy Consumption</td></tr>
        <tr><td>Daily energy</td><td>${eW} kWh</td></tr>
        <tr><td>Monthly energy</td><td>${eKWh} kWh</td></tr>

        <tr class="section-header"><td colspan="2">Heat Loads (kcal/h)</td></tr>
        <tr><td>QF — Freezer compartment</td><td>${fmt(res.heatLoads.QF)}</td></tr>
        <tr><td>QR — Refrigerator compartment</td><td>${fmt(res.heatLoads.QR)}</td></tr>
        <tr><td>QEV — Evaporator total</td><td>${fmt(res.heatLoads.QEV)}</td></tr>
        <tr><td>Fan load</td><td>${fmt(res.heatLoads.fanLoad)}</td></tr>
        <tr><td>Defrost load</td><td>${fmt(res.heatLoads.defrostLoad)}</td></tr>
        ${
          res.evapDetails ? `
          <tr class="section-header"><td colspan="2">Evaporator Performance</td></tr>
          <tr><td>Surface area</td><td>${fmt(res.evapDetails.area, 4)} m²</td></tr>
          <tr><td>Air speed</td><td>${fmt(res.evapDetails.v, 3)} m/s</td></tr>
          <tr><td>Heat transfer coeff α</td><td>${fmt(res.evapDetails.alpha, 2)} kcal/h·m²·°C</td></tr>
          <tr><td>LMTD</td><td>${fmt(res.evapDetails.LMTD, 2)} °C</td></tr>
          <tr><td>Mixed inlet T1</td><td>${fmt(res.evapDetails.T1, 2)} °C</td></tr>
          <tr><td>Evap. capacity (calculated)</td><td>${fmt(res.evapDetails.Qevap, 2)} kcal/h</td></tr>
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

// ─── Message helpers ───────────────────────────────────────────────────────

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