// tests/debug_final_test.mjs
import { compressorState } from '../src/js/engine/thermo/compressor.js';
import { computeCondenserAreas, calcQCout, calcQCin } from '../src/js/engine/thermo/condenser.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

// ── Corrected heat load calculation (exact Excel replica) ──────────────
function calcK(thickness_mm, lambda) {
  const thk_m = thickness_mm / 1000;
  return 1 / (1/PC.surfaceCoefficients.outside + 1/PC.surfaceCoefficients.inside + thk_m / lambda);
}

const PC = PHYSICAL_CONSTANTS;
const kUrethaneCache = new Map();
function kUrethane(t_mm) {
  if (!kUrethaneCache.has(t_mm))
    kUrethaneCache.set(t_mm, calcK(t_mm, PC.insulation.urethane));
  return kUrethaneCache.get(t_mm);
}

function correctedCalcHeatLoads(geom, temps, electrical, condenserRises, fanAirflow_m3h, evapParams, fanInputPower_W) {
  const {
    H, W, D, Hf, Hr, Hb, Db1, Db2, doorGap, packingPos,
    tFtop, tFleft, tFright, tFbottom, tFdoor, tEvaBack,
    tRtop, tRleft, tRright, tRback, tRbottom1, tRbottom2, tRbottom3, tRdoor,
  } = geom;

  const { T0, TF, TR, T2, TC, PR, TE } = temps;
  const T_side = T0 + condenserRises.side;
  const T_back = T0 + condenserRises.back;

  // ---- Freezer areas ----
  const AFtop    = (W - (tFleft + tFright)/2) * (D - tEvaBack/2) / 1e6;
  const AFleft   = (D - tEvaBack/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const AFright  = AFleft;
  const AFbottom = (D - tEvaBack/2) * (W - (tFleft + tFright)/2) / 1e6;
  const AFdoor   = (Hf - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  const AFpackin = ((Hf - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  // Freezer heat transfers (with corrected ΔT)
  let QF = kUrethane(tFtop)    * AFtop    * (T0 - TF)
         + kUrethane(tFleft)   * AFleft   * (T_side - TF)
         + kUrethane(tFright)  * AFright  * (T_side - TF)
         + kUrethane(tFbottom) * AFbottom * (TR - TF)          // ← corrected
         + kUrethane(tFdoor)   * AFdoor   * (T0 - TF)
         + PC.insulation.packing * AFpackin * (T0 - TF);

  // Partition losses
const DPCON1 = (0.1219 * (TC - TF) * PR + 0.1219 * (((0.1984 * T0 + 0.1219 * TF) / (0.1984 + 0.1219)) - TF) * (1 - PR))
             * (W - tFleft - tFright) / 1000;
  const DPCON2 = (0.0791 * (TC - TF) - 0.072 * (T0 - TF)) * PR * (Hf * 2 + W) / 1000;
  QF += DPCON1 + DPCON2;

  // ---- Refrigerator areas ----
  const ARtop     = (W - (tRleft + tRright)/2) * (D - tRback/2) / 1e6;
  const ARleftBase = (Hr - (tRtop + tRbottom1)/2) * (D - tRback/2) - (Db1 + Db2) * Hb / 2;
  const ARleft    = ARleftBase / 1e6;
  const ARright   = ARleft;
  const ARback    = (Hr - (tRtop + tRbottom1)/2 - Hb) * (W - (tRleft + tRright)/2) / 1e6;
  const ARbottom1 = (W - (tRleft + tRright)/2) * Db1 / 1e6;
  const ARbottom2 = (W - (tRleft + tRright)/2) * Math.sqrt(Hb*Hb + (Db2-Db1)**2) / 1e6;
  const ARbottom3 = (W - (tRleft + tRright)/2) * Db2 / 1e6;
  const ARdoor    = (Hr - doorGap/2 - 2*packingPos) * (W - 2*packingPos) / 1e6;
  const ARpackin  = ((Hr - 2*packingPos) + (W - 2*packingPos)) * 2 / 1000;

  let QR = kUrethane(tRtop)      * ARtop      * (TF - TR)        // ← corrected
         + kUrethane(tRleft)     * ARleft     * (T_side - TR)
         + kUrethane(tRright)    * ARright    * (T_side - TR)
         + kUrethane(tRback)     * ARback     * (T_back - TR)
         + kUrethane(tRbottom1)  * ARbottom1  * (T_back - TR)    // ← corrected
         + kUrethane(tRbottom2)  * ARbottom2  * (T_back - TR)    // ← corrected
         + kUrethane(tRbottom3)  * ARbottom3  * (T0 - TR)
         + kUrethane(tRdoor)     * ARdoor     * (T0 - TR)
         + PC.insulation.packing * ARpackin   * (T0 - TR);

  const DPCON_R = (0.0546 * (TC - TF) - 0.0491 * (T0 - TF)) * PR * (Hr * 2 + W) / 1000;
  QR += DPCON_R;

  // ---- Evaporator ----
  const A_evaBack = (W - (tFleft + tFright)/2) * (Hf - (tFtop + tFbottom)/2) / 1e6;
  const QEV_conduction = kUrethane(tEvaBack) * A_evaBack * (T_back - T2);
  const fanLoad = (fanInputPower_W ?? 2.1) * PC.conversion.wattToKcalPerH * PR;
  const defrostLoad = electrical.defrostHeater_W * (electrical.defrostOn_min / 60 / 24) * PC.conversion.wattToKcalPerH;
  const QEV = QEV_conduction + fanLoad + defrostLoad;

  return { QF, QR, QEV, fanLoad, defrostLoad };
}

// ── Inner solver with dynamic condenser rises ─────────────────────────
function newtonSolve2x2(F, x0, dx, tol, maxIter) {
  let x = [x0[0], x0[1]];
  for (let iter = 0; iter < maxIter; iter++) {
    const f = F(x);
    if (Math.max(Math.abs(f[0]), Math.abs(f[1])) <= tol) return { x, converged: true, iterations: iter+1 };
    const J = [[0,0],[0,0]];
    for (let j=0; j<2; j++) {
      const xP = [x[0], x[1]]; xP[j] += dx;
      const fP = F(xP);
      J[0][j] = (fP[0]-f[0])/dx; J[1][j] = (fP[1]-f[1])/dx;
    }
    const det = J[0][0]*J[1][1]-J[0][1]*J[1][0];
    if (Math.abs(det)<1e-12) return {x, converged:false, iterations:iter+1, error:'Singular Jacobian'};
    x[0] = Math.max(-80, Math.min(20, x[0] + (-f[0]*J[1][1]+f[1]*J[0][1])/det));
    x[1] = Math.max(0.001, Math.min(0.999, x[1] + (J[0][0]*(-f[1])+J[1][0]*f[0])/det));
  }
  return {x, converged:false, iterations:maxIter, error:'Max iterations'};
}

function solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, innerOpts={}) {
  const {dx=0.001, tol=1e-4, maxIter=100} = innerOpts;
  const {T0, TF, TR, TE} = fixedTemps;
  const rho=1.365, cp=0.24;
  let T2g=-21.2483, PRg=0.59056;
  const F = (x) => {
    const T2=x[0], PR=x[1];
    const sideRise = PR * (condenserConfig.K_side/10) * (TC-T0);
    const backRise = PR * (condenserConfig.K_back/10) * (TC-T0);
    const cr = {side:sideRise, back:backRise};
    const temps = {T0,TF,TR,T2,TC,PR,TE};
    const loads = correctedCalcHeatLoads(geom, temps, electrical, cr, fan.totalAirflow, geom.evap, fan.inputPower_W);
    const comp = compressorState(TC, TE, refrigerant, compParams, subcool);
    if (isNaN(loads.QF+loads.QR+loads.QEV)) throw Error('NaN loads');
    if (isNaN(comp.coolingCapacity)) throw Error('NaN comp');
    const Qtot = loads.QF+loads.QR+loads.QEV;
    const F2 = Qtot - comp.coolingCapacity*PR;
    const denom = fan.totalAirflow*rho*cp*PR;
    let F1;
    if (Math.abs(denom)<1e-12) {
      F1 = loads.QF;
    } else {
      const T3 = T2 + loads.QEV/denom;
      const MR = loads.QR / (rho*cp*(TR-T3)*PR);
      const MF = fan.totalAirflow - MR;
      const QFp = MF*rho*cp*(TF-T2)*PR;
      F1 = loads.QF - QFp;
    }
    return [F1, F2];
  };
  try {
    const res = newtonSolve2x2(F, [T2g,PRg], dx, tol, maxIter);
    if (!res.converged) return {T2:res.x[0], PR:res.x[1], converged:false, error:res.error};
    const fT2=res.x[0], fPR=res.x[1];
    const sr = fPR*(condenserConfig.K_side/10)*(TC-T0);
    const br = fPR*(condenserConfig.K_back/10)*(TC-T0);
    const fTemps = {T0,TF,TR,T2:fT2,TC,PR:fPR,TE};
    const fLoads = correctedCalcHeatLoads(geom, fTemps, electrical, {side:sr, back:br}, fan.totalAirflow, geom.evap, fan.inputPower_W);
    const fComp = compressorState(TC, TE, refrigerant, compParams, subcool);
    return {T2:fT2, PR:fPR, converged:true, iterations:res.iterations, heatLoads:fLoads, compressor:fComp};
  } catch(e) {
    return {T2:NaN, PR:NaN, converged:false, error:e.message};
  }
}

// ── Outer solver ──────────────────────────────────────────────────────
function solveThermalSystem(config) {
  const {geom, compParams, condenserConfig, refrigerant, subcool, dischargeTemp, fixedTemps, fan, electrical, TC0=54.4, DH=0.001, tolOuter=0.0005, maxIterOuter=100, innerOptions={}} = config;
  const areas = computeCondenserAreas(geom, condenserConfig);
  const T0 = fixedTemps.T0;
  let TC = TC0, totalInner=0;
  for (let iter=0; iter<maxIterOuter; iter++) {
    const inner = solveInner(TC, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, innerOptions);
    if (!inner.converged) return {TC, T2:NaN, PR:NaN, converged:false, error:'Inner failed'};
    totalInner += inner.iterations;
    const QCout = calcQCout(TC, T0, fixedTemps.TF, fixedTemps.TR, areas);
    const QCin  = calcQCin(TC, fixedTemps.TE, refrigerant, compParams, subcool, dischargeTemp);
    const F3 = QCout - QCin;
    if (Math.abs(F3) < tolOuter) return {TC, T2:inner.T2, PR:inner.PR, converged:true, outerIterations:iter+1, innerTotalIterations:totalInner, heatLoads:inner.heatLoads, compressor:inner.compressor};
    const innerPert = solveInner(TC+DH, geom, compParams, refrigerant, subcool, fixedTemps, fan, electrical, condenserConfig, innerOptions);
    if (!innerPert.converged) return {TC, T2:NaN, PR:NaN, converged:false, error:'Perturb inner failed'};
    totalInner += innerPert.iterations;
    const dF3dTC = ((calcQCout(TC+DH, T0, fixedTemps.TF, fixedTemps.TR, areas) - calcQCin(TC+DH, fixedTemps.TE, refrigerant, compParams, subcool, dischargeTemp)) - F3) / DH;
    if (Math.abs(dF3dTC)<1e-9) return {TC, T2:NaN, PR:NaN, converged:false, error:'Zero derivative'};
    TC -= Math.max(-2, Math.min(2, F3/dF3dTC));
  }
  return {TC, T2:NaN, PR:NaN, converged:false, error:'Outer max iters'};
}

// ── SJ-540 configuration ──────────────────────────────────────────────
const geom = {
  H:1680, W:800, D:630, Hf:550, Hr:1130, Hb:260, Db1:210, Db2:230, doorGap:10, packingPos:15,
  tFtop:59.4, tFleft:59.4, tFright:59.4, tFbottom:70, tFdoor:59.4, tEvaBack:60,
  tRtop:70, tRleft:40, tRright:40, tRback:60, tRbottom1:40, tRbottom2:40, tRbottom3:40, tRdoor:40,
};
const compParams = { ...SJ54H_COMPONENTS.compressor };
const condenserConfig = {
  K_side:5.395, K_back:4.17, backCondenserEfficiency:0.7,
  k_RFront1:0.3405, k_RFront2:0.03322, k_FRPartition1:0.1984, k_FRPartition2:0.1219, k_FFront1:0.3395, k_FFront2:0.0344,
};
const config = {
  geom, compParams, condenserConfig,
  refrigerant:'R-600a', subcool:10, dischargeTemp:60,
  fixedTemps:{T0:30, TF:-18, TR:3, TE:-25.27 },
  fan:{totalAirflow:59.5, inputPower_W:2.1},
  electrical:{defrostHeater_W:140, defrostOn_min:0, pwbOn_W:2, pwbOff_W:1, timerPeriod_h:10.5},
  TC0:45, DH:0.001, tolOuter:0.001, maxIterOuter:50,
  innerOptions:{dx:0.001, tol:1e-4, maxIter:100},
};

console.log('=== SJ-540 SOLVER (fully corrected heat loads + dynamic rises) ===');
const res = solveThermalSystem(config);
if (res.converged) {
  console.log('✅ Converged:');
  console.log(`TC = ${res.TC.toFixed(2)} °C`);
  console.log(`T2 = ${res.T2.toFixed(2)} °C`);
  console.log(`PR = ${(res.PR*100).toFixed(1)} %`);
  console.log(`QF = ${res.heatLoads.QF.toFixed(2)} kcal/h`);
  console.log(`QR = ${res.heatLoads.QR.toFixed(2)} kcal/h`);
  console.log(`QEV = ${res.heatLoads.QEV.toFixed(2)} kcal/h`);
  console.log(`Comp cooling = ${res.compressor.coolingCapacity.toFixed(2)} kcal/h`);
  console.log(`Input power = ${res.compressor.inputPower.toFixed(2)} W`);
} else {
  console.log('❌ Failed:', res.error);
}