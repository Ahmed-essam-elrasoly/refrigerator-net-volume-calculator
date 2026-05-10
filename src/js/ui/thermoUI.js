import { runThermoAnalysis, buildDefaultConfig } from '../engine/thermo/index.js';
import { SJ54H_COMPONENTS } from '../engine/thermo/defaultComponents.js';
import { PHYSICAL_CONSTANTS } from '../engine/thermo/constants.js';
import { DEFAULT_CABINET, toThermalFormat } from '../engine/geometry.js';

let thermoSection, runBtn, resultsDiv, errorDiv;

export function initThermoUI() {
  thermoSection = document.getElementById('thermoSection');
  if (!thermoSection) return;

  runBtn = document.getElementById('thermoRunBtn');
  resultsDiv = document.getElementById('thermoResults');
  errorDiv = document.getElementById('thermoErrors');

  runBtn.addEventListener('click', handleRun);

  // Initialise dedicated geometry panel with DEFAULT_GEOMETRY
  const geo = DEFAULT_GEOMETRY;

  // Other defaults (subcool, discharge temp, fan, etc.)
  document.getElementById('thermoSubcool').value  = SJ54H_COMPONENTS.subcool_K;
  document.getElementById('thermoDiscTemp').value = SJ54H_COMPONENTS.dischargeTemp_C;
  document.getElementById('thermoFanFlow').value  = SJ54H_COMPONENTS.fan.totalAirflow_m3h;
  document.getElementById('thermoDefHeater').value = SJ54H_COMPONENTS.electrical.defrostHeater_W;
  document.getElementById('thermoDefOn').value     = SJ54H_COMPONENTS.electrical.defrostOn_min;
}

function handleRun() {
  clearMessages();

  // ---------- Collect geometry from dedicated panel ----------
  // Build geometry from shared default (will later be replaced by unified app state)
  const geom = toThermalFormat(DEFAULT_CABINET);  }

  // ---------- Fixed temperatures ----------
  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
    showError('Please fill in ambient, freezer, and refrigerator temperatures.');
    return;
  }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';
  const subcool = parseFloat(document.getElementById('thermoSubcool')?.value) || 10;
  const dischargeTemp = parseFloat(document.getElementById('thermoDiscTemp')?.value) || 60;
  const fanFlow = parseFloat(document.getElementById('thermoFanFlow')?.value) || 59.5;
  const defHeater = parseFloat(document.getElementById('thermoDefHeater')?.value) || 140;
  const defOnMin = parseFloat(document.getElementById('thermoDefOn')?.value) || 0;

  const compParams = SJ54H_COMPONENTS.compressor;
  const condenserConfig = {
    K_side: SJ54H_COMPONENTS.condenser.K_side_kcalhm2C,
    K_back: SJ54H_COMPONENTS.condenser.K_back_kcalhm2C,
    backCondenserEfficiency: SJ54H_COMPONENTS.condenser.backCondenserEfficiency,
    k_RFront1: SJ54H_COMPONENTS.condenser.k_RFront1,
    k_RFront2: SJ54H_COMPONENTS.condenser.k_RFront2,
    k_FRPartition1: SJ54H_COMPONENTS.condenser.k_FRPartition1,
    k_FRPartition2: SJ54H_COMPONENTS.condenser.k_FRPartition2,
    k_FFront1: SJ54H_COMPONENTS.condenser.k_FFront1,
    k_FFront2: SJ54H_COMPONENTS.condenser.k_FFront2,
  };

  const config = {
   geom,
    compParams,
    condenserConfig,
    refrigerant,
    subcool,
    dischargeTemp,
    fixedTemps: { T0, TF, TR, TE: -23.3 },   // add TE
    fan: {
      totalAirflow: fanFlow,
      // density and cp will use defaults from constants inside solver if not provided
    },
    electrical: {
      defrostHeater_W: defHeater,
      defrostOn_min: defOnMin,
      pwbOn_W: SJ54H_COMPONENTS.electrical.pwbOn_W,
      pwbOff_W: SJ54H_COMPONENTS.electrical.pwbOff_W,
      timerPeriod_h: SJ54H_COMPONENTS.electrical.timerPeriod_h,
    },
  };

  const result = runThermoAnalysis(config);
  if (!result.success) {
    showError(result.errors.join('; '));
  } else {
    displayResults(result.results);
    if (result.warnings.length) showWarnings(result.warnings);
  }
}

// displayResults, clearMessages, showError, showWarnings remain unchanged
/** Display solver results */
function displayResults(res) {
  if (!res) return;
  const html = `
    <table>
      <tr><td>Condensing temp TC:</td><td>${res.TC.toFixed(2)} °C</td></tr>
      <tr><td>Evap outlet T2:</td><td>${res.T2.toFixed(2)} °C</td></tr>
      <tr><td>Running ratio PR:</td><td>${(res.PR * 100).toFixed(1)} %</td></tr>
      <tr><td>Comp. cooling capacity:</td><td>${res.compressor.coolingCapacity.toFixed(2)} kcal/h</td></tr>
      <tr><td>Comp. input power:</td><td>${res.compressor.inputPower.toFixed(2)} W</td></tr>
      <tr><td>Mass flow:</td><td>${res.compressor.massFlow.toFixed(3)} kg/h</td></tr>
      <tr><td>Heat load QF:</td><td>${res.heatLoads.QF.toFixed(2)} kcal/h</td></tr>
      <tr><td>Heat load QR:</td><td>${res.heatLoads.QR.toFixed(2)} kcal/h</td></tr>
      <tr><td>Heat load QEV:</td><td>${res.heatLoads.QEV.toFixed(2)} kcal/h</td></tr>
    </table>
  `;
  resultsDiv.innerHTML = html;
}

function clearMessages() {
  resultsDiv.innerHTML = '';
  errorDiv.innerHTML = '';
}

function showError(msg) {
  errorDiv.innerHTML = `<p class="error">❌ ${msg}</p>`;
}

function showWarnings(warnings) {
  const ul = document.createElement('ul');
  warnings.forEach(w => {
    const li = document.createElement('li');
    li.textContent = w;
    li.className = 'warning';
    ul.appendChild(li);
  });
  errorDiv.appendChild(ul);
}