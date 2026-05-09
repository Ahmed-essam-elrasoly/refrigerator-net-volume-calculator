// tests/fixed_te_verify.mjs
import { satPressureR600a, specificVolumeR600a, vaporEnthalpyR600a, liquidEnthalpyR600a } from '../src/js/engine/thermo/refrigerant.js';
import { calcHeatLoads, DEFAULT_GEOMETRY } from '../src/js/engine/thermo/heatLoad.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';
import { PHYSICAL_CONSTANTS } from '../src/js/engine/thermo/constants.js';

const geom = DEFAULT_GEOMETRY;
const comp = SJ54H_COMPONENTS.compressor;
const electrical = SJ54H_COMPONENTS.electrical;
const rho = PHYSICAL_CONSTANTS.air.density;
const cp = PHYSICAL_CONSTANTS.air.cp;
const fanFlow = SJ54H_COMPONENTS.fan.totalAirflow_m3h;

const T0 = 30, TF = -18, TR = 3, TE = -23.3;   // TE FIXED
const TC = 54.4;
const subcool = 10;

function computeCompressor(TE_local) {
  const Pc = satPressureR600a(TC);
  const Pe = satPressureR600a(TE_local);
  const { A, B, C } = comp.volEffCoeffs;
  const etaV = (A + B*(Pc/Pe) + C*Pc) * (comp.kEtaV.a + comp.kEtaV.b*comp.rpm + comp.kEtaV.c*comp.rpm*comp.rpm);
  const T_suc = comp.T_suction;
  const v_suc = specificVolumeR600a(T_suc, Pe);
  const mdot = etaV * comp.rpm * comp.Vc * 1e-6 * 60 / v_suc;
  const h_suc = vaporEnthalpyR600a(T_suc, Pe);
  const h_liq = liquidEnthalpyR600a(TC - subcool);
  const Qc = mdot * (h_suc - h_liq);
  const { AW, BW, CW, DW, EW } = comp.powerCoeffs;
  const power = AW + BW*TE_local + CW*TC + DW*TC*TE_local + EW*TE_local*TE_local;
  return { massFlow: mdot, coolingCapacity: Qc, inputPower: power, h_suction: h_suc, h_liquid: h_liq };
}

// Solve inner loop: F1=0, F2=0  (x = [T2, PR])
function newton(T2_init, PR_init) {
  let T2 = T2_init, PR = PR_init;
  for (let iter=0; iter<50; iter++) {
    const compNow = computeCompressor(TE);
    const loads = calcHeatLoads(geom, { T0, TF, TR, T2, TC, PR }, electrical);
    const Qtotal = loads.QF + loads.QR + loads.QEV;
    const F2 = Qtotal - compNow.coolingCapacity * PR;

    const denom = fanFlow * rho * cp * PR;
    let F1;
    if (denom < 1e-12) {
      F1 = loads.QF;
    } else {
      const T3 = T2 + loads.QEV / denom;
      const MR = (Math.abs(TR - T3) < 1e-9) ? 0 : loads.QR / (rho * cp * (TR - T3) * PR);
      const MF = fanFlow - MR;
      const QF_prime = MF * rho * cp * (TF - T2) * PR;
      F1 = loads.QF - QF_prime;
    }

    if (Math.abs(F1) < 1e-4 && Math.abs(F2) < 1e-4) {
      return { T2, PR, converged: true, iterations: iter+1 };
    }

    // finite diff Jacobian
    const dT2 = 0.001, dPR = 0.001;
    const f0 = [F1, F2];

    // perturb T2
    let fT2;
    {
      const t = T2 + dT2;
      const l = calcHeatLoads(geom, { T0, TF, TR, T2: t, TC, PR }, electrical);
      const Q = l.QF + l.QR + l.QEV;
      const f2t = Q - compNow.coolingCapacity * PR;
      const den = fanFlow * rho * cp * PR;
      let f1t;
      if (den < 1e-12) f1t = l.QF;
      else {
        const T3t = t + l.QEV/den;
        const MRt = (Math.abs(TR-T3t)<1e-9)?0:l.QR/(rho*cp*(TR-T3t)*PR);
        const MFt = fanFlow - MRt;
        f1t = l.QF - MFt*rho*cp*(TF - t)*PR;
      }
      fT2 = [f1t, f2t];
    }

    // perturb PR
    let fPR;
    {
      const p = PR + dPR;
      const l = calcHeatLoads(geom, { T0, TF, TR, T2, TC, PR: p }, electrical);
      const Q = l.QF + l.QR + l.QEV;
      const f2p = Q - compNow.coolingCapacity * p;
      const den = fanFlow * rho * cp * p;
      let f1p;
      if (den < 1e-12) f1p = l.QF;
      else {
        const T3p = T2 + l.QEV/den;
        const MRp = (Math.abs(TR-T3p)<1e-9)?0:l.QR/(rho*cp*(TR-T3p)*p);
        const MFp = fanFlow - MRp;
        f1p = l.QF - MFp*rho*cp*(TF - T2)*p;
      }
      fPR = [f1p, f2p];
    }

    const J = [
      [(fT2[0]-F1)/dT2, (fPR[0]-F1)/dPR],
      [(fT2[1]-F2)/dT2, (fPR[1]-F2)/dPR]
    ];
    const det = J[0][0]*J[1][1] - J[0][1]*J[1][0];
    if (Math.abs(det) < 1e-12) {
      console.log('Singular at iter', iter);
      break;
    }
    const stepT2 = (-F1*J[1][1] + F2*J[0][1]) / det;
    const stepPR = ( J[0][0]*(-F2) + J[1][0]*F1) / det;
    T2 += stepT2;
    PR += stepPR;
    PR = Math.max(0.001, Math.min(0.999, PR));
  }
  return { T2, PR, converged: false };
}

const sol = newton(-21.2483006297973, 0.5905646101665666);
console.log('Result:', sol);
console.log('Q_com at TE=-23.3:', computeCompressor(TE).coolingCapacity);