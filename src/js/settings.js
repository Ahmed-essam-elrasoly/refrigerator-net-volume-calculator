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
    rows: 7,
    layers: 2,
    tubeOD_mm: 8,
    finPitch_mm: 4,
    finHeight_mm: 150,
    finLength_mm: 460,
    numFins: 32,
    sidePlateNo: 0,
  },
  fanParam: {
    tipDiam_mm: 220,
    fanRPM: 2200,
    hubDiam_mm: 80,
    PitchAngle_degree: 30,
  },
};

const STORAGE_KEY = 'refrigerator-calc-settings';

// ---------------------------------------------------------------------------
// Deep merge utility
// ---------------------------------------------------------------------------

/**
 * Performs a deep merge of two objects.
 * Properties in `source` override those in `target` for primitive values,
 * but nested objects are merged recursively.
 *
 * @param {Object} target - The base object.
 * @param {Object} source - The override object.
 * @returns {Object} The merged result.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      // If the target has the same key as an object, merge recursively.
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      // Otherwise, copy the value directly.
      result[key] = source[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Settings loading / saving
// ---------------------------------------------------------------------------

/**
 * Loads settings from localStorage, falling back to DEFAULTS if missing or corrupt.
 * Uses deep merge to preserve nested default fields (e.g., fanParam, evaporator).
 *
 * @returns {Object} The active settings configuration.
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Deep merge so that missing nested fields are filled from DEFAULTS.
      return deepMerge(DEFAULTS, parsed);
    }
  } catch (e) {
    // Ignore parse errors and return defaults.
  }
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
  // Use a shallow merge for top-level properties, but keep nested objects intact.
  // This is acceptable because we only ever replace the whole fanParam/evaporator
  // from the UI, never partial updates.
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