import { validateHeatLoad } from './src/js/engine/thermo/validateHeatLoad.js';

// Mock data based on your recent error logs
const mockGeom = {
    H: 1800, W: 795, D: 650, Hf: 670, Hr: 945, Hb: 314,
    tFtop: 50, tFleft: 80, tFright: 80, tFbottom: 50, tFdoor: 70, tFback: 80,
    tRtop: 55, tRleft: 55, tRright: 55, tRbottom1: 75, tRdoor: 55, tRback: 55
};

const mockTemps = {
    T0: 30,
    TF: -18,
    TR: 3
};

const mockCalculatedLoads = {
    QF: 191.86,
    QR: 39.51,
    QEV: 7.73
};

const result = validateHeatLoad(mockGeom, mockTemps, mockCalculatedLoads);

console.log("Is Valid?", result.isValid);
if (result.errors.length) console.log("Errors:", result.errors);
if (result.warnings.length) console.log("Warnings:", result.warnings);