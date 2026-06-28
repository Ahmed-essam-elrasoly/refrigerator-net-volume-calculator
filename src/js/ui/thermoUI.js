import { runThermoAnalysis } from '../engine/thermo/index.js';
import { buildDefaultConfig } from '../engine/thermo/index.js';
import { runThermalAnalysisDynamic, EnergyConsumption } from '../engine/thermo/solver.js';
import { toThermalFormat } from '../engine/geometry.js';

let getGeometryFn = null;
let thermoSection, runBtn, resultsDiv, errorDiv;

export function initThermoUI(getGeometry) {
  thermoSection = document.getElementById('thermoSection');
  if (!thermoSection) return;

  runBtn = document.getElementById('thermoRunBtn');
  resultsDiv = document.getElementById('thermoResults');
  errorDiv = document.getElementById('thermoErrors');

  if (!runBtn || !resultsDiv || !errorDiv) {
    console.warn('Thermo UI elements missing – thermal analysis disabled.');
    return;
  }

  getGeometryFn = getGeometry;
  runBtn.addEventListener('click', handleRun);

  // Populate defaults
  const base = buildDefaultConfig();
  document.getElementById('thermoSubcool').value = base.subcool;
  document.getElementById('thermoDiscTemp').value = base.dischargeTemp;
  // Fan defaults from base (but base still has totalAirflow; we'll set the three inputs manually)
  document.getElementById('thermoFanDiam').value = 100;   // mm, typical
  document.getElementById('thermoFanRPM').value = 2550;
  document.getElementById('thermoFanThick').value = 60;   // mm, approximate
  document.getElementById('thermoDefHeater').value = base.electrical.defrostHeater_W;
  document.getElementById('thermoDefOn').value = base.electrical.defrostOn_min;
  document.getElementById('thermoTimerPeriod').value = base.electrical.timerPeriod_h ?? 10.5;
}

function handleRun() {
  clearMessages();

  if (!getGeometryFn) {
    showError('Geometry source not available.');
    return;
  }
  const cabinetGeom = getGeometryFn();

  if (cabinetGeom._compartments && cabinetGeom._compartments.length > 1 &&
      cabinetGeom._compartments[0].type !== 'freezer') {
    showError('Thermal analysis currently supports only freezer‑top configurations.');
    return;
  }

  const geom = cabinetGeom;
  const thermalGeom = (geom.tFtop !== undefined) ? geom : toThermalFormat(geom);

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

  // Fan parameters
  const fanDiam = parseFloat(document.getElementById('thermoFanDiam')?.value) || 100;
  const fanRPM = parseFloat(document.getElementById('thermoFanRPM')?.value) || 2550;
  const fanThick = parseFloat(document.getElementById('thermoFanThick')?.value) || 60;
  // Compute total airflow (m³/h) from fan geometry (same formula as evaporator.js)
  const fanArea = Math.PI * (fanDiam / 2) ** 2;               // mm²
  const sweptVolumePerRev_mm3 = fanArea * fanThick;            // mm³
  const sweptVolumePerMin_mm3 = sweptVolumePerRev_mm3 * fanRPM; // mm³/min
  const fanAirflow_m3h = (sweptVolumePerMin_mm3 * 60) / 1e9;   // m³/h

  const defHeater = parseFloat(document.getElementById('thermoDefHeater')?.value) || 140;
  const defOnMin = parseFloat(document.getElementById('thermoDefOn')?.value) || 0;
  const timerPeriod = parseFloat(document.getElementById('thermoTimerPeriod')?.value) || 10.5;

  // Build config
  const baseConfig = buildDefaultConfig();

  const config = {
    ...baseConfig,
    geom: thermalGeom,
    fixedTemps: {
      T0, TF, TR,
      TE: baseConfig.fixedTemps.TE,
    },
    fan: {
      ...baseConfig.fan,
      totalAirflow: fanAirflow_m3h,      // override with computed value
      inputPower_W: baseConfig.fan.inputPower_W, // still from defaults (2.1W)
    },
    electrical: {
      ...baseConfig.electrical,
      defrostHeater_W: defHeater,
      defrostOn_min: defOnMin,
      timerPeriod_h: timerPeriod,
    },
    refrigerant,
    subcool,
    dischargeTemp,
    freezerPosition: 'top',
    initialTE: baseConfig.initialTE,
    solverOptions: {
      ...baseConfig.solverOptions,
      innerOptions: {
        ...baseConfig.solverOptions.innerOptions,
        initialT2: -21.25,
        initialPR: 0.59,
      },
    },
  };

  try {
    const result = runThermalAnalysisDynamic(config);
    if (!result.converged) {
      showError(result.error || 'Thermal solver did not converge.');
    } else {
      displayResults(result, config);
    }
  } catch (err) {
    showError(`Solver error: ${err.message}`);
  }
}

function displayResults(res, config) {
  if (!res) return;

  // Compute energy consumption
  const energy = EnergyConsumption({
    ...res,
    fan: config.fan,
    electrical: config.electrical,
  });

  const html = `
    <table>
      <tr><td>Condensing temp TC:</td><td>${res.TC.toFixed(2)} °C</td></tr>
      <tr><td>Evaporator outlet T2:</td><td>${res.T2.toFixed(2)} °C</td></tr>
      <tr><td>Running ratio PR:</td><td>${(res.PR * 100).toFixed(1)} %</td></tr>
      <tr><td>Comp. cooling capacity:</td><td>${res.compressor.coolingCapacity.toFixed(2)} kcal/h</td></tr>
      <tr><td>Comp. input power:</td><td>${res.compressor.inputPower.toFixed(2)} W</td></tr>
      <tr><td>Mass flow:</td><td>${res.compressor.massFlow.toFixed(3)} kg/h</td></tr>
      <tr><td>Heat load QF:</td><td>${res.heatLoads.QF.toFixed(2)} kcal/h</td></tr>
      <tr><td>Heat load QR:</td><td>${res.heatLoads.QR.toFixed(2)} kcal/h</td></tr>
      <tr><td>Heat load QEV:</td><td>${res.heatLoads.QEV.toFixed(2)} kcal/h</td></tr>
      <tr><td colspan="2"><strong>Energy Consumption</strong></td></tr>
      <tr><td>Per day:</td><td>${energy.EnergyConsumption_W.toFixed(3)} kWh</td></tr>
      <tr><td>Per month:</td><td>${energy.EnergyConsumption_kWhMonth.toFixed(2)} kWh</td></tr>
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