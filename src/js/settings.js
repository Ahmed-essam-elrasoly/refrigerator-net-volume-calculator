// js/settings.js

const DEFAULTS = {
  mm3ToL: 1e-6,
  lToCuft: 0.0353147,
  displayPrecisionL: 2,
  displayPrecisionCuft: 3,
  canvasWidth: 600,
  canvasHeight: 800,
  autoCalculate: false,
  showDirtyOverlay: true,
};

const STORAGE_KEY = 'refrigerator-calc-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (e) { /* ignore */ }
  return { ...DEFAULTS };
}

function saveToStorage(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const settings = loadSettings();

export function updateSettings(newSettings) {
  Object.assign(settings, newSettings);
  saveToStorage(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  saveToStorage(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

export function getSettings() {
  return { ...settings };
}