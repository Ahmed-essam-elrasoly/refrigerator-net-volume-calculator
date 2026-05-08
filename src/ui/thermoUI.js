/**
 * @file thermoUI.js
 * UI glue for the thermodynamic solver.
 */

import { runThermoAnalysis, buildDefaultConfig } from '../engine/thermo/index.js';
import { DEFAULT_GEOMETRY } from '../engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../engine/thermo/defaultComponents.js';
import { PHYSICAL_CONSTANTS } from '../engine/thermo/constants.js';

/** @type {HTMLElement} */
let thermoSection, runBtn, resultsDiv, errorDiv;

/** Initialise the thermodynamic UI */
export function initThermoUI() {
  thermoSection = document.getElementById('thermoSection');
  if (!thermoSection) return;

  runBtn = document.getElementById('thermoRunBtn');
  resultsDiv = document.getElementById('thermoResults');
  errorDiv = document.getElementById('thermoErrors');

  runBtn.addEventListener('click', handleRun);

  // Pre-fill advanced defaults from SJ54H
  const adv = document.getElementById('thermoAdvanced');
  if (adv) {
    document.getElementById('thermoHb').value     = DEFAULT_GEOMETRY.Hb;
    document.getElementById('thermoDb1').value    = DEFAULT_GEOMETRY.Db1;
    document.getElementById('thermoDb2').value    = DEFAULT_GEOMETRY.Db2;
    document.getElementById('thermoDoorGap').value = DEFAULT_GEOMETRY.doorGap;
    document.getElementById('thermoPackPos').value = DEFAULT_GEOMETRY.packingPos;
    document.getElementById('thermoSubcool').value  = SJ54H_COMPONENTS.subcool_K;
    document.getElementById('thermoDiscTemp').value = SJ54H_COMPONENTS.dischargeTemp_C;
    document.getElementById('thermoFanFlow').value  = SJ54H_COMPONENTS.fan.totalAirflow_m3h;
    document.getElementById('thermoDefHeater').value = SJ54H_COMPONENTS.electrical.defrostHeater_W;
    document.getElementById('thermoDefOn').value    = SJ54H_COMPONENTS.electrical.defrostOn_min;
  }
}

/**
 * Collect all inputs from the DOM and run the solver.
 */
function handleRun() {
  clearMessages();

  // ---------- Gather geometry from volume calculator UI ----------
  const extHeight = parseFloat(document.getElementById('extHeight')?.value);
  const extWidth  = parseFloat(document.getElementById('extWidth')?.value);
  const extDepth  = parseFloat(document.getElementById('extDepth')?.value);
  if ([extHeight, extWidth, extDepth].some(isNaN)) {
    showError('Please provide valid external dimensions in the main calculator.');
    return;
  }

  // Determine compartment heights from the current layout
  const numComps = parseInt(document.getElementById('numCompartments')?.value, 10) || 2;
  const compartmentData = [];
  for (let i = 0; i < numComps; i++) {
    const typeSelect = document.querySelector(`select[data-comp="${i}"][data-field="type"]`);
    const ratioInput = document.querySelector(`input[data-comp="${i}"][data-field="heightRatio"]`);
    if (typeSelect && ratioInput) {
      compartmentData.push({
        type: typeSelect.value,
        ratio: parseFloat(ratioInput.value) || 0.5,
      });
    }
  }

  // Build a simple internal layout: assume first compartment is freezer, second is refrigerator
  let Hf = 0, Hr = 0;
  if (compartmentData.length >= 2) {
    // Normalise ratios
    const totalRatio = compartmentData.reduce((s, c) => s + c.ratio, 0);
    const internalHeight = extHeight - /* wall top+bot? we’ll ignore wall for now, use rough */ (DEFAULT_GEOMETRY.tRtop + DEFAULT_GEOMETRY.tRbottom1); // rough
    // Better: we can use the cabinet external height and subtract effective wall thicknesses to get internal height,
    // then assign Hf, Hr proportional to ratios.
    const effTop = Math.max(
      parseFloat(document.getElementById('wall-fresh-top')?.value) || 50,
      parseFloat(document.getElementById('wall-freezer-top')?.value) || 50,
      parseFloat(document.getElementById('wall-flex-top')?.value) || 50
    );
    const effBot = Math.max(
      parseFloat(document.getElementById('wall-fresh-bottom')?.value) || 50,
      parseFloat(document.getElementById('wall-freezer-bottom')?.value) || 50,
      parseFloat(document.getElementById('wall-flex-bottom')?.value) || 50
    );
    const internalH = extHeight - effTop - effBot;
    for (let i = 0; i < compartmentData.length; i++) {
      const compH = internalH * (compartmentData[i].ratio / totalRatio);
      if (compartmentData[i].type === 'freezer') Hf = compH;
      else if (compartmentData[i].type === 'fresh') Hr = compH;
    }
  }
  if (!Hf || !Hr) {
    showError('Could not derive freezer/refrigerator heights. Using default layout (freezer top, refrigerator bottom).');
    Hf = DEFAULT_GEOMETRY.Hf;
    Hr = DEFAULT_GEOMETRY.Hr;
  }

  // Collect wall thicknesses per type and face
  const types = ['fresh', 'freezer', 'flex'];
  const faces = ['top', 'bottom', 'left', 'right', 'rear', 'door'];
  const wallPerType = {};
  for (const type of types) {
    wallPerType[type] = {};
    for (const face of faces) {
      const el = document.getElementById(`wall-${type}-${face}`);
      wallPerType[type][face] = el ? parseFloat(el.value) || 50 : 50;
    }
  }

  // Build geom object: use the freezer type for F walls, fresh for R walls,
  // and map to the specific names needed by heatLoad.js
  const geom = {
    H: extHeight,
    W: extWidth,
    D: extDepth,
    Hf,
    Hr,
    // advanced defaults read from thermoAdvanced fields
    Hb: parseFloat(document.getElementById('thermoHb')?.value) || DEFAULT_GEOMETRY.Hb,
    Db1: parseFloat(document.getElementById('thermoDb1')?.value) || DEFAULT_GEOMETRY.Db1,
    Db2: parseFloat(document.getElementById('thermoDb2')?.value) || DEFAULT_GEOMETRY.Db2,
    doorGap: parseFloat(document.getElementById('thermoDoorGap')?.value) || DEFAULT_GEOMETRY.doorGap,
    packingPos: parseFloat(document.getElementById('thermoPackPos')?.value) || DEFAULT_GEOMETRY.packingPos,
    // map wall thicknesses directly – we use the 'freezer' type for freezer walls, 'fresh' for refrigerator
    tFtop: wallPerType['freezer'].top,
    tFleft: wallPerType['freezer'].left,
    tFright: wallPerType['freezer'].right,
    tFbottom: wallPerType['freezer'].bottom,
    tFdoor: wallPerType['freezer'].door,
    tEvaBack: wallPerType['freezer'].rear,
    tRtop: wallPerType['fresh'].top,
    tRleft: wallPerType['fresh'].left,
    tRright: wallPerType['fresh'].right,
    tRback: wallPerType['fresh'].rear,
    tRbottom1: wallPerType['fresh'].bottom,
    tRbottom2: wallPerType['fresh'].bottom,  // same thickness assumed
    tRbottom3: wallPerType['fresh'].bottom,
    tRdoor: wallPerType['fresh'].door,
    lambdaUrethane: PHYSICAL_CONSTANTS.insulation.urethane,
    lambdaPS: PHYSICAL_CONSTANTS.insulation.polystyrene,
    lambdaPacking: PHYSICAL_CONSTANTS.insulation.packing,
    hOut: PHYSICAL_CONSTANTS.surfaceCoefficients.outside,
    hIn: PHYSICAL_CONSTANTS.surfaceCoefficients.inside,
  };

  // ---------- Fixed temperatures ----------
  const T0 = parseFloat(document.getElementById('thermoT0')?.value);
  const TF = parseFloat(document.getElementById('thermoTF')?.value);
  const TR = parseFloat(document.getElementById('thermoTR')?.value);
  if (isNaN(T0) || isNaN(TF) || isNaN(TR)) {
    showError('Please fill in the ambient, freezer, and refrigerator temperatures.');
    return;
  }

  const refrigerant = document.getElementById('thermoRefrigerant')?.value || 'R-600a';
  const subcool = parseFloat(document.getElementById('thermoSubcool')?.value) || 10;
  const dischargeTemp = parseFloat(document.getElementById('thermoDiscTemp')?.value) || 60;
  const fanFlow = parseFloat(document.getElementById('thermoFanFlow')?.value) || 59.5;
  const defHeater = parseFloat(document.getElementById('thermoDefHeater')?.value) || 140;
  const defOnMin = parseFloat(document.getElementById('thermoDefOn')?.value) || 0;

  // Compressor preset (only EGX80CLC for now)
  const compParams = SJ54H_COMPONENTS.compressor; // you could extend with a selector

  // Condenser config can be taken from default
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
    fixedTemps: { T0, TF, TR },
    fan: { totalAirflow: fanFlow },
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