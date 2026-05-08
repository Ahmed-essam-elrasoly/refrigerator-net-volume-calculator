import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorState } from './compressor.js';

export function calcQCout(TC, T0, TF, areas) {
  const dT_TC_T0 = TC - T0;
  const dT_TC_TF = TC - TF;
  return (areas.k_RFront1 * dT_TC_T0 + areas.k_RFront2 * dT_TC_TF) * areas.RFrontLength
       + (areas.k_FRPartition1 * dT_TC_T0 + areas.k_FRPartition2 * dT_TC_TF) * areas.FRPartitionLength
       + (areas.k_FFront1 * dT_TC_T0 + areas.k_FFront2 * dT_TC_TF) * areas.FFrontLength
       + areas.sideKA * dT_TC_T0
       + areas.backKA * dT_TC_T0;
}

export function calcQCin(TC, TE, refrigerantName, compParams, subcool, dischargeTemp) {
  const rf = getRefrigerantFunctions(refrigerantName);
  const comp = compressorState(TC, TE, refrigerantName, compParams, subcool);
  const h_dis = rf.vaporEnthalpy(dischargeTemp, rf.satPressure(TC));
  return comp.massFlow * (h_dis - comp.h_liquid);
}

export function computeCondenserAreas(geom, condenserConfig) {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, tRtop, tRleft } = geom;
  const {
    K_side, K_back,
    backCondenserEfficiency,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2
  } = condenserConfig;

  const sideArea = ((H * (D - 30)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6;
  const backAreaRaw = (W * (H - Hb)) / 1e6;
  const backArea = backAreaRaw * backCondenserEfficiency;

  const RFrontLength = (Hr * 2 + D) / 1000;
  const FRPartitionLength = (W - tRtop - tRleft) / 1000;
  const FFrontLength = (Hf * 2) / 1000;

  return {
    RFrontLength, FRPartitionLength, FFrontLength,
    sideKA: K_side * sideArea,
    backKA: K_back * backArea,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2,
  };
}