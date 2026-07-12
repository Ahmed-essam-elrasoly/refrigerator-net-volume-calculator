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