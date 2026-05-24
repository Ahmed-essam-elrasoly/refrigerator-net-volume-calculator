// compressor.js – cooling capacity based on evaporator outlet enthalpy (Excel replica)
import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorStateMap, SQ47LAEG_MAP } from './compressorMap.js';

export function calcVolumetricEfficiency(TC, TE, compParams, satPressure) {
  const Pc = satPressure(TC);
  const Pe = satPressure(TE);
  const { A, B, C } = compParams.volEffCoeffs;
  const etaBase = A + B * (Pc / Pe) + C * Pc;
  const kEtaV = compParams.kEtaV;
  const Kw = kEtaV.a + kEtaV.b * compParams.rpm + kEtaV.c * compParams.rpm * compParams.rpm;
  return etaBase * Kw;
}

export function calcMassFlow(etaV, rpm, Vc, v) {
  return etaV * rpm * Vc * 1e-6 * 60 / v;
}

/**
 * Compressor state – uses EVAPORATOR OUTLET enthalpy (saturated vapour at TE)
 * to calculate cooling capacity, matching Excel MAIN H21.
 */
export function compressorState(TC, TE, refrigerantName, compParams, subcool, T0) {
  const rf = getRefrigerantFunctions(refrigerantName);
  const Pe = rf.satPressure(TE);
  const Pc = rf.satPressure(TC);

  // Excel uses T0 (ambient) for specific volume in the refrigerator condition
  const T_vol = T0 ?? compParams.T_suction;   // fall back to 32.2 if T0 not passed
  const v = rf.specificVolume(T_vol, Pe);
  const etaV = calcVolumetricEfficiency(TC, TE, compParams, rf.satPressure);
  const mdot = calcMassFlow(etaV, compParams.rpm, compParams.Vc, v);

  // Use evaporator outlet (saturated vapour) enthalpy, not suction line
  const h_evap_out = rf.vaporEnthalpy(TE, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);
  const cooling = mdot * (h_evap_out - h_liquid);

  // Input power (existing polynomial)
  const { AW, BW, CW, DW, EW } = compParams.powerCoeffs;
  const base = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;
  const { a, b, c } = compParams.powerKw;
  const Kw = a + b * compParams.rpm + c * compParams.rpm * compParams.rpm;
  const rpmRatio = compParams.rpm / compParams.rpm0;
  const power = base * Kw * rpmRatio;

  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: cooling,
    inputPower: power,
    h_evap_out,
    h_liquid,
  };
}
// compressor.js or solver.js dispatch
export function resolveCompressorState(TC, TE, refrigerant, compParams, subcool, T0) {
  if (compParams.useMap) {
    const rf = getRefrigerantFunctions(refrigerant);
    const map = compParams.map ?? SQ47LAEG_MAP;  // allow custom map per model
    return compressorStateMap(TC, TE, map, rf, subcool);
  }
  return compressorState(TC, TE, refrigerant, compParams, subcool, T0);
}
