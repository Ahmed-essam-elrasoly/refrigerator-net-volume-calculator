/**
 * @file graphUI.js
 * Parametric sweep and charting engine using Chart.js.
 * Integrates direct state manipulation to sweep deep backend variables.
 */

import { settings } from '../settings.js';
import { getThermalState, setThermalState } from './thermoUI.js';

let parametricChartInstance = null;

// --- UTILITY EXTRACTORS ---
const extractSpan = (id) => parseFloat(document.getElementById(id)?.textContent) || 0;

const extractTable = (rowLabel, secondaryRegex = null) => {
  const tds = Array.from(document.querySelectorAll('.thermo-results-table td'));
  const targetTd = tds.find(td => td.textContent.includes(rowLabel));
  if (targetTd && targetTd.nextElementSibling) {
    const text = targetTd.nextElementSibling.textContent;
    if (secondaryRegex) {
      const match = text.match(secondaryRegex);
      return match ? parseFloat(match[1]) : 0;
    }
    return parseFloat(text) || 0;
  }
  return 0;
};

// --- STATE INJECTORS ---
const domInput = (id) => ({
  get: () => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) || 0 : 0;
  },
  set: (val) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input'));
      el.dispatchEvent(new Event('change')); // Critical for compartment heights to trigger ratio recalc
    }
  }
});

const advancedSetting = (category, key) => ({
  get: () => {
    const state = getThermalState();
    return state[category][key];
  },
  set: (val) => {
    const state = getThermalState();
    state[category][key] = val;
    setThermalState(state);
  }
});

// --- UNIFIED DICTIONARY MAPPING ---
const DICTIONARY = {
volume: {
    inputs: [
      { id: 'geom-H', label: 'Height H (mm)', ...domInput('geom-H') },
      { id: 'geom-W', label: 'Width W (mm)', ...domInput('geom-W') },
      { id: 'geom-D', label: 'Depth D (mm)', ...domInput('geom-D') },
      { id: 'geom-Hb', label: 'Bottom step Hb (mm)', ...domInput('geom-Hb') },
      { id: 'geom-Db1', label: 'Db1 (mm)', ...domInput('geom-Db1') },
      { id: 'geom-Db2', label: 'Db2 (mm)', ...domInput('geom-Db2') },
      { id: 'comp-0-height', label: 'Compartment 1 Height (mm)', ...domInput('comp-0-height') },
      { id: 'comp-1-height', label: 'Compartment 2 Height (mm)', ...domInput('comp-1-height') }
    ],
    outputs: [
      { id: 'v1', label: 'Freezer Gross (L)', extract: () => extractSpan('freezerGrossVol') },
      { id: 'v2', label: 'Fresh Gross (L)', extract: () => extractSpan('fridgeGrossVol') },
      { id: 'v3', label: 'Gross Volume (L)', extract: () => extractSpan('grossVol') },
      { id: 'v4', label: 'Freezer Total (L)', extract: () => extractSpan('freezerTotalVol') },
      { id: 'v5', label: 'Fresh Total (L)', extract: () => extractSpan('fridgeTotalVol') },
      { id: 'v6', label: 'Total Volume (L)', extract: () => extractSpan('totalVol') },
      { id: 'v7', label: 'Cabinet PU Volume (L)', extract: () => extractSpan('cabpuVol') },
      { id: 'v8', label: 'Cabinet PU Weight (kg)', extract: () => extractSpan('cabpuweight') },
      { id: 'v9', label: 'F-Door PU Volume (L)', extract: () => extractSpan('fdoorpuVol') },
      { id: 'v10', label: 'F-Door PU Weight (kg)', extract: () => extractSpan('fdoorpuweight') },
      { id: 'v11', label: 'R-Door PU Volume (L)', extract: () => extractSpan('rdoorpuVol') },
      { id: 'v12', label: 'R-Door PU Weight (kg)', extract: () => extractSpan('rdoorpuweight') }
    ],
    trigger: () => document.getElementById('calculateBtn').click()
  },
  
  thermal: {
    inputs: [
      { id: 'thermoT0', label: 'Ambient T0 (C)', ...domInput('thermoT0') },
      { id: 'thermoTF', label: 'Freezer TF (C)', ...domInput('thermoTF') },
      { id: 'thermoTR', label: 'Refrigerator TR (C)', ...domInput('thermoTR') },
      { id: 'condSidePitch', label: 'Side pipe pitch (mm)', ...advancedSetting('condenser', 'sidePipePitch_mm') },
      { id: 'condBackPitch', label: 'Back pipe pitch (mm)', ...advancedSetting('condenser', 'backPipePitch_mm') },
      { id: 'dischargeTemp', label: 'Discharge temp (C)', ...advancedSetting('advanced', 'dischargeTemp') },
      { id: 'damperRatio', label: 'Damper Ratio', ...advancedSetting('advanced', 'Damp') },
      { id: 'fanRPM', label: 'Fan RPM', ...advancedSetting('fanParam', 'fanRPM') },
      { id: 'fanDiam', label: 'Fan Diameter (mm)', ...advancedSetting('fanParam', 'tipDiam_mm') },
      { id: 'evapW', label: 'Evap Width (mm)', ...advancedSetting('evaporator', 'width_mm') },
      { id: 'evapH', label: 'Evap Height (mm)', ...advancedSetting('evaporator', 'height_mm') },
      { id: 'evapD', label: 'Evap Depth (mm)', ...advancedSetting('evaporator', 'depth_mm') },
      { id: 'evapR', label: 'Evap Rows', ...advancedSetting('evaporator', 'rows') },
      { id: 'evapL', label: 'Evap Layers', ...advancedSetting('evaporator', 'layers') },
      { id: 'evapOD', label: 'Evap Tube OD (mm)', ...advancedSetting('evaporator', 'tubeOD_mm') },
      { id: 'evapFH', label: 'Evap Fin Height (mm)', ...advancedSetting('evaporator', 'finHeight_mm') },
      { id: 'evapFL', label: 'Evap Fin Length (mm)', ...advancedSetting('evaporator', 'finLength_mm') },
      { id: 'evapFN', label: 'Evap Number of Fins', ...advancedSetting('evaporator', 'numFins') },
      { id: 'evapSP', label: 'Evap Side Plates', ...advancedSetting('evaporator', 'sidePlateNo') }
    ],
    outputs: [
      { id: 't1', label: 'Condensing temp TC (C)', extract: () => extractTable('Condensing temp TC') },
      { id: 't2', label: 'Subcool temp Tsubcool (C)', extract: () => extractTable('Subcool temp Tsubcool') },
      { id: 't3', label: 'Evaporating temp TE (C)', extract: () => extractTable('Evaporating temp TE') },
      { id: 't4', label: 'Evap. outlet T2 (C)', extract: () => extractTable('Evap. outlet T2') },
      { id: 't5', label: 'Running Ratio PR (%)', extract: () => extractTable('Running Ratio PR') },
      { id: 't6', label: 'Required Compressor RPM', extract: () => extractTable('Required Compressor RPM') },
      { id: 't7', label: 'Evap. pressure Pe (bar)', extract: () => extractTable('Evap. pressure Pe') },
      { id: 't8', label: 'Cond. pressure Pc (bar)', extract: () => extractTable('Cond. pressure Pc') },
      { id: 't9', label: 'Vol. efficiency (ηv)', extract: () => extractTable('Vol. efficiency') },
      { id: 't10', label: 'Cooling capacity (W)', extract: () => extractTable('Cooling capacity') },
      { id: 't11', label: 'Input power (W)', extract: () => extractTable('Input power') },
      { id: 't12', label: 'COP', extract: () => extractTable('COP') },
      { id: 't13', label: 'Mass flow (kg/h)', extract: () => extractTable('Mass flow') },
      { id: 't14', label: 'Daily energy (kWh)', extract: () => extractTable('Daily energy') },
      { id: 't15', label: 'Monthly energy (kWh)', extract: () => extractTable('Monthly energy') },
      { id: 't16', label: 'QF — Freezer (W)', extract: () => extractTable('QF') },
      { id: 't17', label: 'QR — Refrigerator (W)', extract: () => extractTable('QR') },
      { id: 't18', label: 'Total load (W)', extract: () => extractTable('Total load') },
      { id: 't19', label: 'Fan Air Speed (m/s)', extract: () => extractTable('Calculated Fan Air Speed') },
      { id: 't20', label: 'Airflow (CFM)', extract: () => extractTable('Calculated airflow') },
      { id: 't21', label: 'Airflow (m³/h)', extract: () => extractTable('Calculated airflow', /\(([\d.]+)\s*m/) },
      { id: 't22', label: 'Freezer flow MF (m³/h)', extract: () => extractTable('Freezer flow (MF)') },
      { id: 't23', label: 'Refrigerator flow MR (m³/h)', extract: () => extractTable('Refrigerator flow (MR)') },
      { id: 't24', label: 't3 (C)', extract: () => extractTable('t3') },
      { id: 't25', label: 'Evap Surface area (m²)', extract: () => extractTable('Surface area') },
      { id: 't26', label: 'Evap Air speed (m/s)', extract: () => extractTable('Air speed') },
      { id: 't27', label: 'Heat transfer coeff (α)', extract: () => extractTable('Heat transfer coeff') },
      { id: 't28', label: 'LMTD (C)', extract: () => extractTable('LMTD') },
      { id: 't29', label: 'Mixed inlet T1 (C)', extract: () => extractTable('Mixed inlet T1') },
      { id: 't30', label: 'Evap. capacity (W)', extract: () => extractTable('Evap. capacity') }
    ],
    trigger: () => document.getElementById('thermoRunBtn').click()
  },

  inverter: {
    inputs: [
      { id: 'inverterT0', label: 'Ambient T0 (C)', ...domInput('inverterT0') },
      { id: 'inverterTF', label: 'Freezer TF (C)', ...domInput('inverterTF') },
      { id: 'inverterTR', label: 'Refrigerator TR (C)', ...domInput('inverterTR') },
      { id: 'inverterPR', label: 'Running Ratio (PR)', ...domInput('inverterPR') },
      { id: 'condSidePitchInv', label: 'Side pipe pitch (mm)', ...advancedSetting('condenser', 'sidePipePitch_mm') },
      { id: 'condBackPitchInv', label: 'Back pipe pitch (mm)', ...advancedSetting('condenser', 'backPipePitch_mm') },
      { id: 'dischargeTempInv', label: 'Discharge temp (C)', ...advancedSetting('advanced', 'dischargeTemp') },
      { id: 'damperRatioInv', label: 'Damper Ratio', ...advancedSetting('advanced', 'Damp') },
      { id: 'fanRPMInv', label: 'Fan RPM', ...advancedSetting('fanParam', 'fanRPM') },
      { id: 'fanDiamInv', label: 'Fan Diameter (mm)', ...advancedSetting('fanParam', 'tipDiam_mm') },
      { id: 'evapWInv', label: 'Evap Width (mm)', ...advancedSetting('evaporator', 'width_mm') },
      { id: 'evapHInv', label: 'Evap Height (mm)', ...advancedSetting('evaporator', 'height_mm') },
      { id: 'evapDInv', label: 'Evap Depth (mm)', ...advancedSetting('evaporator', 'depth_mm') },
      { id: 'evapRInv', label: 'Evap Rows', ...advancedSetting('evaporator', 'rows') },
      { id: 'evapLInv', label: 'Evap Layers', ...advancedSetting('evaporator', 'layers') },
      { id: 'evapODInv', label: 'Evap Tube OD (mm)', ...advancedSetting('evaporator', 'tubeOD_mm') },
      { id: 'evapFHInv', label: 'Evap Fin Height (mm)', ...advancedSetting('evaporator', 'finHeight_mm') },
      { id: 'evapFLInv', label: 'Evap Fin Length (mm)', ...advancedSetting('evaporator', 'finLength_mm') },
      { id: 'evapFNInv', label: 'Evap Number of Fins', ...advancedSetting('evaporator', 'numFins') },
      { id: 'evapSPInv', label: 'Evap Side Plates', ...advancedSetting('evaporator', 'sidePlateNo') }
    ],
    // Inverter outputs are identical to thermal structurally within the right panel DOM
    outputs: [
      { id: 'i1', label: 'Condensing temp TC (C)', extract: () => extractTable('Condensing temp TC') },
      { id: 'i2', label: 'Subcool temp Tsubcool (C)', extract: () => extractTable('Subcool temp Tsubcool') },
      { id: 'i3', label: 'Evaporating temp TE (C)', extract: () => extractTable('Evaporating temp TE') },
      { id: 'i4', label: 'Evap. outlet T2 (C)', extract: () => extractTable('Evap. outlet T2') },
      { id: 'i5', label: 'Required Compressor RPM', extract: () => extractTable('Required Compressor RPM') },
      { id: 'i6', label: 'Evap. pressure Pe (bar)', extract: () => extractTable('Evap. pressure Pe') },
      { id: 'i7', label: 'Cond. pressure Pc (bar)', extract: () => extractTable('Cond. pressure Pc') },
      { id: 'i8', label: 'Vol. efficiency (ηv)', extract: () => extractTable('Vol. efficiency') },
      { id: 'i9', label: 'Cooling capacity (W)', extract: () => extractTable('Cooling capacity') },
      { id: 'i10', label: 'Input power (W)', extract: () => extractTable('Input power') },
      { id: 'i11', label: 'COP', extract: () => extractTable('COP') },
      { id: 'i12', label: 'Mass flow (kg/h)', extract: () => extractTable('Mass flow') },
      { id: 'i13', label: 'Daily energy (kWh)', extract: () => extractTable('Daily energy') },
      { id: 'i14', label: 'Monthly energy (kWh)', extract: () => extractTable('Monthly energy') },
      { id: 'i15', label: 'QF — Freezer (W)', extract: () => extractTable('QF') },
      { id: 'i16', label: 'QR — Refrigerator (W)', extract: () => extractTable('QR') },
      { id: 'i17', label: 'Total load (W)', extract: () => extractTable('Total load') },
      { id: 'i18', label: 'Fan Air Speed (m/s)', extract: () => extractTable('Calculated Fan Air Speed') },
      { id: 'i19', label: 'Airflow (CFM)', extract: () => extractTable('Calculated airflow') },
      { id: 'i20', label: 'Airflow (m³/h)', extract: () => extractTable('Calculated airflow', /\(([\d.]+)\s*m/) },
      { id: 'i21', label: 'Freezer flow MF (m³/h)', extract: () => extractTable('Freezer flow (MF)') },
      { id: 'i22', label: 'Refrigerator flow MR (m³/h)', extract: () => extractTable('Refrigerator flow (MR)') },
      { id: 'i23', label: 't3 (C)', extract: () => extractTable('t3') },
      { id: 'i24', label: 'Evap Surface area (m²)', extract: () => extractTable('Surface area') },
      { id: 'i25', label: 'Evap Air speed (m/s)', extract: () => extractTable('Air speed') },
      { id: 'i26', label: 'Heat transfer coeff (α)', extract: () => extractTable('Heat transfer coeff') },
      { id: 'i27', label: 'LMTD (C)', extract: () => extractTable('LMTD') },
      { id: 'i28', label: 'Mixed inlet T1 (C)', extract: () => extractTable('Mixed inlet T1') },
      { id: 'i29', label: 'Evap. capacity (W)', extract: () => extractTable('Evap. capacity') }
    ],
    trigger: () => document.getElementById('inverterRunBtn').click()
  }
};

function getActiveDomain() {
  if (document.getElementById('panelVolume').classList.contains('active')) return 'volume';
  if (document.getElementById('panelThermal').classList.contains('active')) return 'thermal';
  if (document.getElementById('panelInverter').classList.contains('active')) return 'inverter';
  return 'volume';
}

export function initGraphModal() {
  const modal = document.getElementById('graphModal');
  const openBtn = document.getElementById('openGraphBtn');
  const closeBtn = document.getElementById('closeGraphModal');
  const generateBtn = document.getElementById('generateGraphBtn');

  if (!openBtn || !modal) return;

  openBtn.addEventListener('click', () => {
    populateModalFields(getActiveDomain());
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

  generateBtn.addEventListener('click', () => {
    runParametricSweep(getActiveDomain());
  });
}

function populateModalFields(domain) {
  const xSelect = document.getElementById('graphXVar');
  const yChecklist = document.getElementById('graphYChecklist');
  
  xSelect.innerHTML = '';
  yChecklist.innerHTML = '';

  const dict = DICTIONARY[domain];

  // Populate X-Axis options
  dict.inputs.forEach(input => {
    const opt = document.createElement('option');
    opt.value = input.id;
    opt.textContent = input.label;
    xSelect.appendChild(opt);
  });

  // Populate Y-Axis checklist
  dict.outputs.forEach(output => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${output.id}"> ${output.label}`;
    yChecklist.appendChild(label);
  });
}

function runParametricSweep(domain) {
  const dict = DICTIONARY[domain];
  
  const xInputId = document.getElementById('graphXVar').value;
  const inputConfig = dict.inputs.find(i => i.id === xInputId);
  const min = parseFloat(document.getElementById('graphMin').value);
  const max = parseFloat(document.getElementById('graphMax').value);
  const step = parseFloat(document.getElementById('graphStep').value);

  if (!inputConfig || isNaN(min) || isNaN(max) || isNaN(step) || step <= 0) {
    alert("Invalid sweep parameters.");
    return;
  }

  const checkboxes = Array.from(document.querySelectorAll('#graphYChecklist input:checked'));
  const selectedOutputs = checkboxes.map(cb => dict.outputs.find(o => o.id === cb.value));

  if (selectedOutputs.length === 0) {
    alert("Select at least one dependent variable.");
    return;
  }

  // 1. Snapshot original state
  const originalValue = inputConfig.get();
  const graphData = [];

  try {
    // 2. Execution Loop
    for (let x = min; x <= max; x += step) {
      inputConfig.set(x);
      dict.trigger(); // Trigger calculation

      const dataPoint = { x: x };
      selectedOutputs.forEach(out => {
        dataPoint[out.id] = out.extract();
      });
      
      graphData.push(dataPoint);
    }
  } finally {
    // 3. Guaranteed state restoration (runs even if the loop throws an error)
    inputConfig.set(originalValue);
    dict.trigger(); 
  }

  // 4. Render the Graph
  renderChart(graphData, selectedOutputs, document.getElementById('graphXVar').options[document.getElementById('graphXVar').selectedIndex].text);
}

function renderChart(data, outputs, xAxisLabel) {
  const ctx = document.getElementById('parametricChart').getContext('2d');
  
  if (parametricChartInstance) {
    parametricChartInstance.destroy();
  }

  // High contrast palette for dark theme
  const colors = [
    '#7AB3FF', '#7EE29B', '#FF9E9E', '#FCD34D', '#A78BFA', 
    '#F472B6', '#38BDF8', '#4ADE80', '#FB923C', '#E879F9'
  ];
  
  const datasets = outputs.map((out, index) => ({
    label: out.label,
    data: data.map(d => ({ x: d.x, y: d[out.id] })),
    borderColor: colors[index % colors.length],
    backgroundColor: colors[index % colors.length] + '33',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.1
  }));

  parametricChartInstance = new window.Chart(ctx, {
    type: 'line',
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: '#F0F3F7',
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: xAxisLabel, color: '#AEB7C5' },
          grid: { color: '#333C4D' },
          ticks: { color: '#AEB7C5' }
        },
        y: {
          title: { display: true, text: 'Dependent Variables', color: '#AEB7C5' },
          grid: { color: '#333C4D' },
          ticks: { color: '#AEB7C5' }
        }
      },
      plugins: {
        legend: { labels: { color: '#F0F3F7' } },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(20, 25, 35, 0.9)'
        }
      }
    }
  });
}