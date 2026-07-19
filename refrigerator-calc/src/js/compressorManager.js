// js/compressorManager.js

import { SJ54H_COMPONENTS } from './engine/thermo/defaultComponents.js';

// Default compressor – store coefficients as arrays from the start
const DEFAULT_COMPRESSORS = [
  {
    id: 'EGX80CLC',
    name: 'EGX80CLC 100V 50Hz',
    model: 'EGX80CLC',
    voltage: 100,
    frequency: 50,
    cylinderVolumeCm3: SJ54H_COMPONENTS.compressor.cylinderVolumeCm3,
    speedRpm:         SJ54H_COMPONENTS.compressor.speedRpm,
    wCoeffs: [
      SJ54H_COMPONENTS.compressor.powerCoeffs.AW,
      SJ54H_COMPONENTS.compressor.powerCoeffs.BW,
      SJ54H_COMPONENTS.compressor.powerCoeffs.CW,
      SJ54H_COMPONENTS.compressor.powerCoeffs.DW,
      SJ54H_COMPONENTS.compressor.powerCoeffs.EW,
    ],
    etaCoeffs: [
      SJ54H_COMPONENTS.compressor.volEffCoeffs.A,
      SJ54H_COMPONENTS.compressor.volEffCoeffs.B,
      SJ54H_COMPONENTS.compressor.volEffCoeffs.C,
    ],
    // ─── Store original test data ─────────────────
    dataPoints: [
      { TE: -34.4, TC: 37.8, Q:  70.554507 * 1.16279, W:  49.7 },
      { TE: -34.4, TC: 46.1, Q:  67.112824 * 1.16279, W:  51.3 },
      { TE: -34.4, TC: 54.4, Q:  61.950299 * 1.16279, W:  72.0 },
      { TE: -23.3, TC: 37.8, Q: 129.063122 * 1.16279, W:  67.6 },
      { TE: -23.3, TC: 46.1, Q: 126.481860 * 1.16279, W:  72.4 },
      { TE: -23.3, TC: 54.4, Q: 121.319335 * 1.16279, W: 141.0 },
      { TE: -12.2, TC: 37.8, Q: 215.105204 * 1.16279, W:  86.2 },
      { TE: -12.2, TC: 46.1, Q: 210.803100 * 1.16279, W:  93.5 },
      { TE: -12.2, TC: 54.4, Q: 203.919733 * 1.16279, W: 237.0 },
    ]
  },
  {
  id: 'DZ90A1X',
  name: 'DZ90A1X Inverter',
  model: 'DZ90A1X',
  voltage: 220, frequency: 50,
  isInverter: true,
  rpmMin: 1600, rpmMax: 4500,
  normalizeRPM: 4320,
  centerTE: -25.0, centerTC: 45.0,
  compressorModel: null,   // will be generated on first use
  refrigerantIndex: 2,
  dataPoints: [
    { RPM: 4320, TE: -35.0, TC: 35, W: 90.3, Q: 126.1 },
    { RPM: 4320, TE: -25.0, TC: 35, W: 121.1, Q: 188.4 },
    { RPM: 4320, TE: -15.0, TC: 35, W: 152.0, Q: 279.7 },
    { RPM: 4320, TE: -35.0, TC: 45, W: 83.4, Q: 117.5 },
    { RPM: 4320, TE: -25.0, TC: 45, W: 109.6, Q: 179.8 },
    { RPM: 4320, TE: -15.0, TC: 45, W: 134.0, Q: 271.0 },
    { RPM: 4320, TE: -35.0, TC: 55, W: 75.8, Q: 108.9 },
    { RPM: 4320, TE: -25.0, TC: 55, W: 96.9, Q: 171.1 },
    { RPM: 4320, TE: -15.0, TC: 55, W: 114.5, Q: 262.3 },
    { RPM: 3000, TE: -35.0, TC: 35, W: 53.3, Q: 101.7 },
    { RPM: 3000, TE: -25.0, TC: 35, W: 68.1, Q: 150.1 },
    { RPM: 3000, TE: -15.0, TC: 35, W: 80.5, Q: 220.9 },
    { RPM: 3000, TE: -35.0, TC: 45, W: 58.6, Q: 93.1 },
    { RPM: 3000, TE: -25.0, TC: 45, W: 77.0, Q: 141.4 },
    { RPM: 3000, TE: -15.0, TC: 45, W: 94.2, Q: 212.3 },
    { RPM: 3000, TE: -35.0, TC: 55, W: 63.4, Q: 84.5 },
    { RPM: 3000, TE: -25.0, TC: 55, W: 85.1, Q: 132.8 },
    { RPM: 3000, TE: -15.0, TC: 55, W: 106.8, Q: 203.7 },
    { RPM: 1620, TE: -35.0, TC: 35, W: 28.4, Q: 62.0 },
    { RPM: 1620, TE: -25.0, TC: 35, W: 36.3, Q: 87.8 },
    { RPM: 1620, TE: -15.0, TC: 35, W: 42.9, Q: 125.5 },
    { RPM: 1620, TE: -35.0, TC: 45, W: 31.2, Q: 53.4 },
    { RPM: 1620, TE: -25.0, TC: 45, W: 41.0, Q: 79.2 },
    { RPM: 1620, TE: -15.0, TC: 45, W: 50.2, Q: 116.9 },
    { RPM: 1620, TE: -35.0, TC: 55, W: 33.8, Q: 44.8 },
    { RPM: 1620, TE: -25.0, TC: 55, W: 45.4, Q: 70.5 },
    { RPM: 1620, TE: -15.0, TC: 55, W: 56.9, Q: 108.3 },
    { RPM: 1320, TE: -35.0, TC: 35, W: 23.0, Q: 53.3 },
    { RPM: 1320, TE: -25.0, TC: 35, W: 29.4, Q: 74.2 },
    { RPM: 1320, TE: -15.0, TC: 35, W: 34.7, Q: 104.7 },
    { RPM: 1320, TE: -35.0, TC: 45, W: 25.3, Q: 44.7 },
    { RPM: 1320, TE: -25.0, TC: 45, W: 33.2, Q: 65.6 },
    { RPM: 1320, TE: -15.0, TC: 45, W: 40.6, Q: 96.1 },
    { RPM: 1320, TE: -35.0, TC: 55, W: 27.4, Q: 36.1 },
    { RPM: 1320, TE: -25.0, TC: 55, W: 36.7, Q: 57.0 },
    { RPM: 1320, TE: -15.0, TC: 55, W: 46.0, Q: 87.5 }
    ],
},
];

let compressorList = [];
let selectedCompressorId = 'EGX80CLC';

/** Helper: ensures coefficient fields are flat arrays (handles legacy objects) */
function ensureArrays(comp) {
  const toArray = (val, keys) => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return keys.map(k => val[k]).filter(v => v !== undefined);
    return null;
  };
  return {
    ...comp,
    wCoeffs:   toArray(comp.wCoeffs,   ['AW','BW','CW','DW','EW']),
    etaCoeffs: toArray(comp.etaCoeffs, ['A','B','C']),
  };
}

export function loadCompressors() {
  const saved = localStorage.getItem('compressorList');
  if (saved) {
    compressorList = JSON.parse(saved);
    // Repair any compressor missing essential fields, and convert objects → arrays
    compressorList = compressorList.map(comp => {
      if (comp.id === 'EGX80CLC') {
        return {
          ...DEFAULT_COMPRESSORS[0],
          ...comp,
          cylinderVolumeCm3: comp.cylinderVolumeCm3 ?? DEFAULT_COMPRESSORS[0].cylinderVolumeCm3,
          speedRpm:         comp.speedRpm         ?? DEFAULT_COMPRESSORS[0].speedRpm,
          wCoeffs:          ensureArrays(comp).wCoeffs   || DEFAULT_COMPRESSORS[0].wCoeffs,
          etaCoeffs:        ensureArrays(comp).etaCoeffs || DEFAULT_COMPRESSORS[0].etaCoeffs,
        };
      }
      return ensureArrays(comp);   // also convert any other compressor that may have objects
    });
    localStorage.setItem('compressorList', JSON.stringify(compressorList));
  } else {
    compressorList = [...DEFAULT_COMPRESSORS];
  }
  selectedCompressorId = localStorage.getItem('selectedCompressorId') || 'EGX80CLC';
}

export function saveCompressors() {
  localStorage.setItem('compressorList', JSON.stringify(compressorList));
  localStorage.setItem('selectedCompressorId', selectedCompressorId);
}

export function getCompressorList() {
  return compressorList;
}

export function getCurrentCompressor() {
  return compressorList.find(c => c.id === selectedCompressorId) || compressorList[0];
}

export function setSelectedCompressor(id) {
  selectedCompressorId = id;
  saveCompressors();
}

export function addCompressor(comp) {
  // Always store coefficients as arrays
  compressorList.push(ensureArrays(comp));
  saveCompressors();
}

export function deleteCompressor(id) {
  compressorList = compressorList.filter(c => c.id !== id);
  if (selectedCompressorId === id) selectedCompressorId = compressorList[0]?.id || '';
  saveCompressors();
}

// Initial load
loadCompressors();