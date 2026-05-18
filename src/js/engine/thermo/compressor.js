import { getRefrigerantFunctions } from './refrigerant.js';

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

export function calcCoolingCapacity(mdot, h_suction, h_liquid) {
  return mdot * (h_suction - h_liquid);
}

export function calcInputPower(TC, TE, compParams) {
  const { AW, BW, CW, DW, EW } = compParams.powerCoeffs;
  const base = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;
  const { a, b, c } = compParams.powerKw;
  const r = compParams.rpm;
  const Kw = a + b * r + c * r * r;
  const rpmRatio = compParams.rpm / compParams.rpm0;
  return base * Kw * rpmRatio;
}

export function compressorState(TC, TE, refrigerantName, compParams, subcool) {
  const rf = getRefrigerantFunctions(refrigerantName);
  const Pe = rf.satPressure(TE);
  const Pc = rf.satPressure(TC);
  const T_suc = compParams.T_suction;
  const v_suc = rf.specificVolume(T_suc, Pe);
  const etaV = calcVolumetricEfficiency(TC, TE, compParams, rf.satPressure);
  const mdot = calcMassFlow(etaV, compParams.rpm, compParams.Vc, v_suc);
  const h_suction = rf.vaporEnthalpy(T_suc, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);
  const cooling = calcCoolingCapacity(mdot, h_suction, h_liquid);
  const power = calcInputPower(TC, TE, compParams);
  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: cooling,
    inputPower: power,
    h_suction,
    h_liquid,
  };
}