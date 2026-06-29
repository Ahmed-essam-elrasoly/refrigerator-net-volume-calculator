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
        <p><i>Evaporator parameters – TBD</i></p>
      </fieldset>

      <fieldset>
        <legend>Compressor</legend>
        <label>Current Compressor:
          <select id="thermoCompressorSelect">
            ${compressors.map(c => `<option value="${c.id}" ${c.id === currentComp.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </label>
        <button id="thermoAddCompressorBtn" type="button">Add Compressor</button>
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

      <fieldset>
        <legend>Fan</legend>
        <label>Input power (W):
          <input type="number" id="thermoFanInputPower" value="${thermalAdvanced.fanInputPower}" step="any" min="0">
        </label>
      </fieldset>

      <fieldset>
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

  modal.classList.remove('hidden');

  // Attach event listeners
  document.getElementById('closeThermalSettings').onclick = () => modal.classList.add('hidden');

  // Compressor management
document.getElementById('thermoAddCompressorBtn').onclick = () => {
  openAddCompressorModal();
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

  if (
    cabinetGeom._compartments &&
    cabinetGeom._compartments.length > 1 &&
    cabinetGeom._compartments[0].type !== 'freezer'
  ) {
    showError('Thermal analysis currently supports only freezer-top configurations.');
    return;
  }

  const geom = toThermalFormat(cabinetGeom);

  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) { showError('Please fill all temperatures.'); return; }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';
  const fanFlow = parseFloat(document.getElementById('thermoFanFlow')?.value) || SJ54H_COMPONENTS.fan.totalAirflow_m3h;

  loadCompressors();
  const compressor = getCurrentCompressor();

  const config = buildDefaultConfig({
    geom,
    freezerPosition: cabinetGeom._compartments?.[0]?.type === 'freezer' ? 'top' : 'bottom',
    refrigerant,
    subcool: thermalAdvanced.subcool,
    dischargeTemp: thermalAdvanced.dischargeTemp,
    fixedTemps: {
      T0, TF, TR,
      TE: SJ54H_COMPONENTS.initialTE,
    },
    fan: {
      totalAirflow: fanFlow,
      inputPower_W: thermalAdvanced.fanInputPower,
    },
    electrical: {
      defrostHeater_W: thermalAdvanced.defHeater,
      defrostOn_min: thermalAdvanced.defOnMin,
    },
    compressor,
  });

  if (compressor) {
    config.compressor.wCoeffs          = compressor.wCoeffs;
    config.compressor.etaCoeffs        = compressor.etaCoeffs;
    config.compressor.cylinderVolumeCm3 = compressor.cylinderVolumeCm3;
    config.compressor.speedRpm         = compressor.speedRpm;
  }

  const result = runThermoAnalysis(config);   // returns { success, errors, warnings, results }
  console.log('results.compressor keys:', Object.keys(result.results.compressor));
console.log('results.compressor.Pe:', result.results.compressor.Pe);
console.log('results.compressor.Pc:', result.results.compressor.Pc);
console.log('Full solver result:', JSON.parse(JSON.stringify(result)));

  if (!result.success) {
    showError(result.errors.join('; '));
    return;
  }

  // Compute energy consumption
  let energy = null;3
  console.log('results.converged:', result.results?.converged);
  console.log('results.fan:', result.results?.fan);
  console.log('results.electrical:', result.results?.electrical);
  if (result.results && result.results.converged) {
    try {
      energy = EnergyConsumption(result.results);   // returns { EnergyConsumption_W, EnergyConsumption_kWhMonth }
    } catch (e) {
      console.warn('EnergyConsumption calculation failed:', e);
    }
  }
// Fallback: if converged flag is missing, assume converged if PR is present
if (result.results && (result.results.converged !== false)) {
  try {
    energy = EnergyConsumption(result.results);
    console.log('Energy result:', energy);
  } catch (e) {
    console.error('EnergyConsumption threw:', e);
  }
}
  displayResults(result.results, energy);
  if (result.warnings.length) showWarnings(result.warnings);
}

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


// ─── Results display ───────────────────────────────────────────────────────

function displayResults(res, energy) {
  if (!res) return;

  const resultsDiv = document.getElementById('thermoRightPanel');
  if (!resultsDiv) return;

  // Show the right panel results, hide the schematics
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

  const html = `
    <table class="thermo-results-table">
      <thead>
        <tr><th colspan="2">Thermal Analysis Results</th></tr>
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