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

/**
 * @param {number} TC          Condensing temperature (°C)
 * @param {number} TE          Evaporating temperature (°C) – used only for pressure Pe
 * @param {string} refrigerantName
 * @param {object} compParams  Must contain T_suction (°C)
 * @param {number} subcool
 */
export function compressorState(TC, TE, refrigerantName, compParams, subcool) {
  const rf = getRefrigerantFunctions(refrigerantName);
  const Pe = rf.satPressure(TE);
  const Pc = rf.satPressure(TC);

  // Suction state uses fixed T_suction, not TE
  const T_suc = compParams.T_suction;          // 32.2 °C
  const v_suc = rf.specificVolume(T_suc, Pe);  // specific volume at suction condition
  const etaV = calcVolumetricEfficiency(TC, TE, compParams, rf.satPressure);
  const mdot = calcMassFlow(etaV, compParams.rpm, compParams.Vc, v_suc);

  const h_suction = rf.vaporEnthalpy(T_suc, Pe);
  const Tsub = TC - subcool;
  const h_liquid = rf.liquidEnthalpy(Tsub);

  return {
    etaV,
    massFlow: mdot,
    coolingCapacity: calcCoolingCapacity(mdot, h_suction, h_liquid),
    inputPower: calcInputPower(TC, TE, compParams),
    h_suction,
    h_liquid,
  };
}