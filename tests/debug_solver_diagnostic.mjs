/**
 * Diagnostic script to debug thermal solver inner loop failure.
 * Logs intermediate values to console.
 */

import { solveThermalSystem } from '../src/js/engine/thermo/solver.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

// -------------------------------------------------------------------------
// 1. Geometry object – matches SJ-54H Excel
// -------------------------------------------------------------------------
const geom = {
  H: 1680, W: 800, D: 630,
  Hf: 550, Hr: 1130,
  Hb: 260, Db1: 210, Db2: 230,
  doorGap: 10, packingPos: 15,
  tFtop: 59.4, tFleft: 59.4, tFright: 59.4, tFbottom: 70, tFdoor: 59.4, tEvaBack: 60,
  tRtop: 70, tRleft: 40, tRright: 40, tRback: 60,
  tRbottom1: 40, tRbottom2: 40, tRbottom3: 40, tRdoor: 40,
};

// -------------------------------------------------------------------------
// 2. Configuration
// -------------------------------------------------------------------------
const config = {
  geom,
  compParams: { ...SJ54H_COMPONENTS.compressor },
  condenserConfig: { ...SJ54H_COMPONENTS.condenser },
  refrigerant: 'R-600a',
  subcool: SJ54H_COMPONENTS.subcool_K,
  dischargeTemp: SJ54H_COMPONENTS.dischargeTemp_C,
  fixedTemps: { T0: 30, TF: -18, TR: 3, TE: -23.3 },
  fan: { totalAirflow: SJ54H_COMPONENTS.fan.totalAirflow_m3h },
  electrical: { ...SJ54H_COMPONENTS.electrical },
  solverOptions: {
    TC0: 54.4,
    DH: 0.001,
    tolOuter: 0.0005,
    maxIterOuter: 10,  // limit for debugging
    innerOptions: { dx: 0.001, tol: 1e-4, maxIter: 10 },
  },
};

console.log('🔧 Starting thermal solver with diagnostic logging...\n');

// Override console.log to add timestamps? Not needed.

// We'll run the solver and catch errors.
try {
  const result = solveThermalSystem(config);
  console.log('Result:', result);
} catch (err) {
  console.error('Solver threw exception:', err);
}