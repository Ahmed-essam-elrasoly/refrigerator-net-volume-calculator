import { settings, updateSettings, resetSettings, getSettings } from '../settings.js';

let modal, closeBtn, settingsForm, saveBtn, exportBtn, importBtn, resetBtn;

export function initSettingsModal() {
  modal = document.getElementById('settingsModal');
  closeBtn = document.getElementById('closeSettings');
  settingsForm = document.getElementById('settingsForm');
  saveBtn = document.getElementById('settingsSave');
  exportBtn = document.getElementById('settingsExport');
  importBtn = document.getElementById('settingsImport');
  resetBtn = document.getElementById('settingsReset');

  closeBtn.addEventListener('click', hide);
  saveBtn.addEventListener('click', () => { collectAndSave(); hide(); });
  exportBtn.addEventListener('click', exportSettings);
  importBtn.addEventListener('click', importSettings);
  resetBtn.addEventListener('click', resetAndClose);
  window.addEventListener('click', (e) => { if (e.target === modal) hide(); });
}

export function showModal() {
  buildForm();
  modal.classList.remove('hidden');
}

function hide() {
  modal.classList.add('hidden');
}

function resetAndClose() {
  if (confirm('Reset all settings to factory defaults?')) {
    resetSettings();
    buildForm();
    hide();
  }
}

function buildForm() {
  const s = getSettings();
  settingsForm.innerHTML = `
    <fieldset>
      <legend>Volume Calculation Constants</legend>
      <label>IEC fixed deduction factor (0‑1): <input type="number" id="setIecFactor" value="${s.iecFactor}" step="0.01" min="0" max="1"></label>
      <label>mm³ → Litre: <input type="number" id="setMm3ToL" value="${s.mm3ToL}" step="0.0000001" min="0"></label>
      <label>Litre → cu.ft: <input type="number" id="setLToCuft" value="${s.lToCuft}" step="0.0000001" min="0"></label>
    </fieldset>
    <fieldset>
      <legend>ES 3794 / IEC Deductions</legend>
      <p><em>Egyptian Net = Gross − User‑removable accessories (shelves, drawers, door bins, and housings if marked removable).</em></p>
      <label><input type="checkbox" id="setIceMakerRemovable" ${s.iceMakerRemovable ? 'checked' : ''}> Ice maker housing is user‑removable</label>
      <label><input type="checkbox" id="setLightRemovable" ${s.lightRemovable ? 'checked' : ''}> Light housing is user‑removable</label>
    </fieldset>
    <fieldset>
      <legend>Display & Canvas</legend>
      <label>Decimal places (Litres): <input type="number" id="setPrecisionL" value="${s.displayPrecisionL}" min="0" max="5"></label>
      <label>Decimal places (cu.ft): <input type="number" id="setPrecisionCuft" value="${s.displayPrecisionCuft}" min="0" max="5"></label>
      <label>Canvas width: <input type="number" id="setCanvasW" value="${s.canvasWidth}" step="10" min="200"></label>
      <label>Canvas height: <input type="number" id="setCanvasH" value="${s.canvasHeight}" step="10" min="200"></label>
    </fieldset>
    <fieldset>
      <legend>Behaviour</legend>
      <label><input type="checkbox" id="setAutoCalculate" ${s.autoCalculate ? 'checked' : ''}> Auto‑calculate on input change</label>
      <label><input type="checkbox" id="setShowDirtyOverlay" ${s.showDirtyOverlay ? 'checked' : ''}> Show “schematic outdated” overlay</label>
    </fieldset>
  `;
}

function collectAndSave() {
  const iceMakerRemovable = document.getElementById('setIceMakerRemovable').checked;
  const lightRemovable = document.getElementById('setLightRemovable').checked;
  const iecFactor = parseFloat(document.getElementById('setIecFactor').value) || 0.97;
  const mm3ToL = parseFloat(document.getElementById('setMm3ToL').value) || 1e-6;
  const lToCuft = parseFloat(document.getElementById('setLToCuft').value) || 0.0353147;
  const displayPrecisionL = parseInt(document.getElementById('setPrecisionL').value) || 2;
  const displayPrecisionCuft = parseInt(document.getElementById('setPrecisionCuft').value) || 3;
  const canvasWidth = parseInt(document.getElementById('setCanvasW').value) || 600;
  const canvasHeight = parseInt(document.getElementById('setCanvasH').value) || 800;
  const autoCalculate = document.getElementById('setAutoCalculate').checked;
  const showDirtyOverlay = document.getElementById('setShowDirtyOverlay').checked;

  updateSettings({
    iceMakerRemovable, lightRemovable, iecFactor, mm3ToL, lToCuft,
    displayPrecisionL, displayPrecisionCuft,
    canvasWidth, canvasHeight,
    autoCalculate, showDirtyOverlay,
  });
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(getSettings(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'refrigerator-calc-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      // Merge with current but override with imported keys
      updateSettings({ ...getSettings(), ...imported });
      buildForm();
      alert('Settings imported. Save & close to apply.');
    } catch (err) {
      alert('Invalid settings file.');
    }
  };
  input.click();
}
