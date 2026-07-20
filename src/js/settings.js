/**
 * @file settings.js
 * Global application settings manager.
 * Handles the persistence of UI preferences and default thermal parameters
 * to the browser's localStorage. Acts as a central state store.
 */

const DEFAULTS = {
  mm3ToL: 1e-6,
  lToCuft: 0.0353147,
  displayPrecisionL: 2,
  displayPrecisionCuft: 3,
  canvasWidth: 600,
  canvasHeight: 800,
  autoCalculate: false,
  showDirtyOverlay: true,
  evaporator: {
    width_mm: 460,
    height_mm: 150,
    depth_mm: 60,
    rows: 2,
    tubeOD_mm: 8,
    finPitch_mm: 4,
    finHeight_mm: 150,
    finLength_mm: 460,
    numFins: 32,
    sidePlateNo: 0,
  },
  fanParam: {
    fanDiam: 100,
    fanRPM: 2200,
    fanThick: 25,
  },
};

const STORAGE_KEY = 'refrigerator-calc-settings';

/**
 * Loads settings from localStorage, falling back to DEFAULTS if missing or corrupt.
 * @returns {Object} The active settings configuration.
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (e) { /* ignore parse errors and return defaults */ }
  return { ...DEFAULTS };
}

/**
 * Internal helper to sync settings object to localStorage.
 * @param {Object} s - The settings object to save.
 */
function saveToStorage(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// The singleton settings instance exported to the rest of the app
export const settings = loadSettings();

/**
 * Updates the global settings object and persists to localStorage.
 * Dispatches a 'settings-changed' event to notify UI components.
 * 
 * @param {Object} newSettings - Partial or full settings object to merge.
 */
export function updateSettings(newSettings) {
  Object.assign(settings, newSettings);
  saveToStorage(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

/**
 * Reverts all settings back to their factory DEFAULTS.
 */
export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  saveToStorage(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

/**
 * Returns a shallow copy of the current settings.
 * @returns {Object}
 */
export function getSettings() {
  return { ...settings };
}