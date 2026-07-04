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