# settings.js

**Original file:** `settings.js`

**File type:** .JS

**Size:** 1,371 bytes

**Last modified:** 2026-05-04 14:38:09


---

## Content

```javascript
const DEFAULTS = {
  iceMakerRemovable: true,       // deduct from EG Net if true
  lightRemovable: true,          // deduct from EG Net if true
  iecFactor: 0.97,               // IEC fixed deduction factor
  mm3ToL: 1e-6,
  lToCuft: 0.0353147,
  displayPrecisionL: 2,
  displayPrecisionCuft: 3,
  canvasWidth: 600,
  canvasHeight: 800,
  autoCalculate: false,          // auto‑run calculate on input change
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

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const settings = loadSettings();

export function updateSettings(newSettings) {
  Object.assign(settings, newSettings);
  saveSettings(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  saveSettings(settings);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

export function getSettings() {
  return { ...settings };
}

```


---

*Converted from `settings.js` on 2026-05-27 14:13:09*
