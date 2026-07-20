/**
 * @file settingsModal.js
 * Manages the global application settings interface.
 * Handles the synchronization of UI inputs with the persistent `settings.js` state,
 * as well as the import, export, and resetting of the user's compressor catalog.
 */

import { settings, updateSettings, resetSettings } from '../settings.js';
import {
  loadCompressors,
  getCompressorList,
  getCurrentCompressor,
  setSelectedCompressor,
  addCompressor,
  deleteCompressor
} from '../compressorManager.js';


/**
 * Initializes the settings modal by binding event listeners to the DOM elements.
 * Called once during application startup.
 */
export function initSettingsModal() {
  const modal    = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeSettings');
  const saveBtn  = document.getElementById('settingsSave');
  const exportBtn = document.getElementById('settingsExport');
  const importBtn = document.getElementById('settingsImport');
  const resetBtn  = document.getElementById('settingsReset');
  const gearBtn   = document.getElementById('settingsBtn');

  gearBtn.addEventListener('click', () => {
    renderSettingsTabs();
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  saveBtn.addEventListener('click', () => {
    collectSettingsFromTabs();
    updateSettings(settings);
    modal.classList.add('hidden');
  });

  exportBtn.addEventListener('click', exportSettings);
  importBtn.addEventListener('click', importSettings);
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all settings to factory defaults? This will also clear your compressor list.')) {
      resetAllSettings();
    }
  });
}

// ---------------------------------------------------------------------------
// Tab rendering (General tab only)
// ---------------------------------------------------------------------------

/**
 * Dynamically injects the HTML for the general settings tab, populating inputs
 * with the current values from the global `settings` object.
 */
function renderSettingsTabs() {
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

/**
 * Scrapes values from the active settings DOM inputs and writes them
 * directly into the mutable `settings` object.
 */
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
// Export / Import / Reset – full implementations
// ---------------------------------------------------------------------------


/**
 * Serializes the current global settings and the full compressor catalog into a JSON file,
 * triggering a browser download.
 */
function exportSettings() {
  loadCompressors();
  const exportData = {
    settings: { ...settings },
    compressorList: getCompressorList(),
    selectedCompressorId: getCurrentCompressor()?.id ?? ''
  };
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'refrigerator-calc-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Opens a file dialog to read a previously exported settings JSON file.
 * Restores global parameters and overwrites the local compressor catalog.
 */
function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.settings) {
        updateSettings(data.settings);
      }
      if (data.compressorList && Array.isArray(data.compressorList)) {
        // Clear existing and replace
        localStorage.setItem('compressorList', JSON.stringify(data.compressorList));
        if (data.selectedCompressorId) {
          localStorage.setItem('selectedCompressorId', data.selectedCompressorId);
        }
        loadCompressors(); // refresh memory
      }
      // Refresh the modal display (if still open)
      renderSettingsTabs();
      alert('Settings imported successfully.');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  input.click();
}

/**
 * Wipes user preferences and the compressor catalog from localStorage,
 * restoring the application to its factory state.
 */
function resetAllSettings() {
  resetSettings();                         // engine settings to defaults
  localStorage.removeItem('compressorList');
  localStorage.removeItem('selectedCompressorId');
  loadCompressors();                       // reloads the default compressor list
  renderSettingsTabs();
  document.getElementById('settingsModal').classList.add('hidden');
  alert('All settings and compressor list have been reset to defaults.');
}