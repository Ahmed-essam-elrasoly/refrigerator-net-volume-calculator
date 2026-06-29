// js/compressorManager.js

import { SJ54H_COMPONENTS } from './engine/thermo/defaultComponents.js';

const DEFAULT_COMPRESSORS = [
  {
    id: 'EGX80CLC',
    name: 'EGX80CLC 100V 50Hz',
    model: 'EGX80CLC',
    voltage: 100,
    frequency: 50,
    cylinderVolumeCm3: SJ54H_COMPONENTS.compressor.cylinderVolumeCm3,  // e.g. 10.17
    speedRpm:         SJ54H_COMPONENTS.compressor.speedRpm,          // e.g. 2220
    wCoeffs:    SJ54H_COMPONENTS.compressor.wCoeffs,
    etaCoeffs:  SJ54H_COMPONENTS.compressor.etaCoeffs,
  }
];

let compressorList = [];
let selectedCompressorId = 'EGX80CLC';

export function loadCompressors() {
  const saved = localStorage.getItem('compressorList');
  if (saved) {
    compressorList = JSON.parse(saved);
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
  compressorList.push(comp);
  saveCompressors();
}

export function deleteCompressor(id) {
  compressorList = compressorList.filter(c => c.id !== id);
  if (selectedCompressorId === id) selectedCompressorId = compressorList[0]?.id || '';
  saveCompressors();
}

// Initial load
loadCompressors();