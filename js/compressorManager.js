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
  }
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