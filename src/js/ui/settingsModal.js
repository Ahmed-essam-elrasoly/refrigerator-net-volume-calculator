// js/ui/settingsModal.js

import { settings, updateSettings } from '../settings.js';

export function initSettingsModal() {
  const modal    = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeSettings');
  const saveBtn  = document.getElementById('settingsSave');
  const exportBtn = document.getElementById('settingsExport');
  const importBtn = document.getElementById('settingsImport');
  const resetBtn  = document.getElementById('settingsReset');
  const gearBtn   = document.getElementById('settingsBtn');

  // Show modal
  gearBtn.addEventListener('click', () => {
    renderSettingsTabs();
    modal.classList.remove('hidden');
  });

  // Hide modal
  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  // Save & Close
  saveBtn.addEventListener('click', () => {
    collectSettingsFromTabs();
    updateSettings(settings);
    modal.classList.add('hidden');
  });

  // Export / Import / Reset
  exportBtn.addEventListener('click', exportSettings);
  importBtn.addEventListener('click', importSettings);
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all settings to factory defaults?')) {
      resetToDefaults();
      updateSettings(settings);
      renderSettingsTabs();
      modal.classList.add('hidden');
    }
  });
}

// ---------------------------------------------------------------------------
// Tab rendering
// ---------------------------------------------------------------------------

function renderSettingsTabs() {
  // Only the General tab exists now
  document.getElementById('stabGeneral').innerHTML = `
    <label>
      <input type="checkbox" id="autoCalculate" ${settings.autoCalculate ? 'checked' : ''}>
      Auto‑calculate
    </label>
    <label>
      <input type="checkbox" id="showDirtyOverlay" ${settings.showDirtyOverlay ? 'checked' : ''}>
      Show “schematic outdated” overlay
    </label>
    <label>mm³ → L: <input type="number" id="mm3ToL" value="${settings.mm3ToL}" step="1e-9"></label>
    <label>L → cu.ft: <input type="number" id="lToCuft" value="${settings.lToCuft}" step="1e-7"></label>
    <label>Decimal places (L): <input type="number" id="displayPrecisionL" value="${settings.displayPrecisionL}" min="0" max="5"></label>
    <label>Decimal places (cu.ft): <input type="number" id="displayPrecisionCuft" value="${settings.displayPrecisionCuft}" min="0" max="5"></label>
    <label>Canvas width: <input type="number" id="canvasWidth" value="${settings.canvasWidth}" step="10" min="200"></label>
    <label>Canvas height: <input type="number" id="canvasHeight" value="${settings.canvasHeight}" step="10" min="200"></label>
  `;
}

// ---------------------------------------------------------------------------
// Collect values
// ---------------------------------------------------------------------------

function collectSettingsFromTabs() {
  settings.autoCalculate       = document.getElementById('autoCalculate').checked;
  settings.showDirtyOverlay    = document.getElementById('showDirtyOverlay').checked;
  settings.mm3ToL              = parseFloat(document.getElementById('mm3ToL').value) || 1e-6;
  settings.lToCuft            = parseFloat(document.getElementById('lToCuft').value) || 0.0353147;
  settings.displayPrecisionL  = parseInt(document.getElementById('displayPrecisionL').value) || 2;
  settings.displayPrecisionCuft = parseInt(document.getElementById('displayPrecisionCuft').value) || 3;
  settings.canvasWidth         = parseInt(document.getElementById('canvasWidth').value) || 600;
  settings.canvasHeight        = parseInt(document.getElementById('canvasHeight').value) || 800;
}

// ---------------------------------------------------------------------------
// Export / Import / Reset helpers – unchanged, they still export everything
// ---------------------------------------------------------------------------

function exportSettings() {
  const data = { ...settings, compressors: getCompressorList() };
  // ... (exactly as before)
}

function importSettings() {
  // ... (same as before but no loadCompressors call needed here)
}

function resetToDefaults() {
  const defaults = {
    autoCalculate: true,
    showDirtyOverlay: true,
    mm3ToL: 1e-6,
    lToCuft: 0.0353147,
    displayPrecisionL: 2,
    displayPrecisionCuft: 3,
    canvasWidth: 600,
    canvasHeight: 800,
  };
  Object.assign(settings, defaults);
}