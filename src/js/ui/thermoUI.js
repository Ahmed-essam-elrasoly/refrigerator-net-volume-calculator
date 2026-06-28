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

let getGeometryFn = null;
let thermoSection, runBtn, resultsDiv, errorDiv;

export function initThermoUI(getGeometry) {
  thermoSection = document.getElementById('thermoSection');
  if (!thermoSection) return;

  runBtn     = document.getElementById('thermoRunBtn');
  resultsDiv = document.getElementById('thermoResults');
  errorDiv   = document.getElementById('thermoErrors');

  if (!runBtn || !resultsDiv || !errorDiv) {
    console.warn('Thermo UI elements missing – thermal analysis disabled.');
    return;
  }

  getGeometryFn = getGeometry;
  runBtn.addEventListener('click', handleRun);

  // Populate defaults from the SJ54H component spec
  document.getElementById('thermoSubcool').value      = SJ54H_COMPONENTS.subcool_K;
  document.getElementById('thermoDiscTemp').value     = SJ54H_COMPONENTS.dischargeTemp_C;
  document.getElementById('thermoFanFlow').value      = SJ54H_COMPONENTS.fan.totalAirflow_m3h;
  document.getElementById('thermoFanInputPower').value = SJ54H_COMPONENTS.fan.inputPower_W;  // Task 2.2
  document.getElementById('thermoDefHeater').value    = SJ54H_COMPONENTS.electrical.defrostHeater_W;
  document.getElementById('thermoDefOn').value        = SJ54H_COMPONENTS.electrical.defrostOn_min;
}

function handleRun() {
  clearMessages();

  if (!getGeometryFn) {
    showError('Geometry source not available.');
    return;
  }
  const cabinetGeom = getGeometryFn();

  // Guard: multi-compartment configurations must have the freezer at the top.
  // (Single-compartment layouts pass through with whatever type is set.)
  if (
    cabinetGeom._compartments &&
    cabinetGeom._compartments.length > 1 &&
    cabinetGeom._compartments[0].type !== 'freezer'
  ) {
    showError('Thermal analysis currently supports only freezer-top configurations.');
    return;
  }

  // Derive freezer position from actual compartment layout
  const firstComp     = cabinetGeom._compartments?.[0];
  const freezerPosition = firstComp?.type === 'freezer' ? 'top' : 'bottom';

  // Convert panel geometry to the flat thermal format (includes Hf and Hr
  // from the compartment heights set by the user)
  const geom = toThermalFormat(cabinetGeom);

  // Read temperatures
  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
    showError('Please fill in ambient, freezer, and refrigerator temperatures.');
    return;
  }

  // Read remaining inputs (|| fallback keeps solver from receiving NaN)
  const refrigerant    = document.getElementById('thermoRefrigerant')?.value     || 'R-600a';
  const subcool        = parseFloat(document.getElementById('thermoSubcool')?.value)        || SJ54H_COMPONENTS.subcool_K;
  const dischargeTemp  = parseFloat(document.getElementById('thermoDiscTemp')?.value)       || SJ54H_COMPONENTS.dischargeTemp_C;
  const fanFlow        = parseFloat(document.getElementById('thermoFanFlow')?.value)        || SJ54H_COMPONENTS.fan.totalAirflow_m3h;
  const fanInputPower  = parseFloat(document.getElementById('thermoFanInputPower')?.value)  || SJ54H_COMPONENTS.fan.inputPower_W;
  const defHeater      = parseFloat(document.getElementById('thermoDefHeater')?.value)      || SJ54H_COMPONENTS.electrical.defrostHeater_W;
  const defOnMin       = parseFloat(document.getElementById('thermoDefOn')?.value)          || SJ54H_COMPONENTS.electrical.defrostOn_min;

  // Build a correctly-formatted config using the SJ54H baseline then override
  // with the UI values.  buildDefaultConfig handles:
  //   • compParams:     maps nested volEffCoeffs / powerCoeffs → flat wCoeffs / etaCoeffs arrays
  //   • condenserConfig: uses sidePipePitch_mm / backPipePitch_mm keys as solver.js expects
  const config = buildDefaultConfig({
    geom,
    freezerPosition,
    refrigerant,
    subcool,
    dischargeTemp,
    fixedTemps: {
      T0,
      TF,
      TR,
      TE: SJ54H_COMPONENTS.initialTE,  // initial evaporator temp guess
    },
    fan: {
      totalAirflow: fanFlow,
      inputPower_W: fanInputPower,
    },
    electrical: {
      defrostHeater_W: defHeater,
      defrostOn_min:   defOnMin,
    },
  });

  // runThermoAnalysis validates the config, calls the nested Newton solver,
  // and returns { success, errors, warnings, results }
  const result = runThermoAnalysis(config);

  if (!result.success) {
    showError(result.errors.join('; '));
  } else {
    displayResults(result.results);
    if (result.warnings.length) showWarnings(result.warnings);
  }
}

// ─── Results display ───────────────────────────────────────────────────────

function displayResults(res) {
  if (!res) return;

  // Helper: format a number or show '—' if it is not finite
  const fmt  = (v, dp = 2)  => (isFinite(v) ? v.toFixed(dp) : '—');
  const fmtP = (v, dp = 1)  => (isFinite(v) ? (v * 100).toFixed(dp) + ' %' : '—');

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

        <tr class="section-header"><td colspan="2">Compressor</td></tr>
        <tr><td>Cooling capacity</td><td>${fmt(res.compressor.coolingCapacity)} kcal/h</td></tr>
        <tr><td>Input power</td><td>${fmt(res.compressor.inputPower)} W</td></tr>
        <tr><td>Mass flow</td><td>${fmt(res.compressor.massFlow, 4)} kg/h</td></tr>
        <tr><td>Vol. efficiency η<sub>v</sub></td><td>${fmtP(res.compressor.etaV)}</td></tr>

        <tr class="section-header"><td colspan="2">Heat Loads (kcal/h)</td></tr>
        <tr><td>QF — Freezer compartment</td><td>${fmt(res.heatLoads.QF)}</td></tr>
        <tr><td>QR — Refrigerator compartment</td><td>${fmt(res.heatLoads.QR)}</td></tr>
        <tr><td>QEV — Evaporator total</td><td>${fmt(res.heatLoads.QEV)}</td></tr>
        <tr><td>Fan load</td><td>${fmt(res.heatLoads.fanLoad)}</td></tr>
        <tr><td>Defrost load</td><td>${fmt(res.heatLoads.defrostLoad)}</td></tr>

        <tr class="section-header"><td colspan="2">Solver</td></tr>
        <tr><td>Outer iterations</td><td>${res.iterations.outer}</td></tr>
        <tr><td>Inner iterations (total)</td><td>${res.iterations.innerTotal}</td></tr>
      </tbody>
    </table>
  `;
  resultsDiv.innerHTML = html;
}

// ─── Message helpers ───────────────────────────────────────────────────────

function clearMessages() {
  resultsDiv.innerHTML = '';
  errorDiv.innerHTML   = '';
}

function showError(msg) {
  errorDiv.innerHTML = `<p class="error">❌ ${msg}</p>`;
}

function showWarnings(warnings) {
  const ul = document.createElement('ul');
  warnings.forEach(w => {
    const li       = document.createElement('li');
    li.textContent = w;
    li.className   = 'warning';
    ul.appendChild(li);
  });
  errorDiv.appendChild(ul);
}