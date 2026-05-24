import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorState } from './compressor.js';

export function calcQCout(TC, T0, TF, TR, areas) {
  const dT_TC_T0 = TC - T0;
  const dT_TC_TF = TC - TF;
  const dT_TC_TR = TC - TR;   // ← add
  return (areas.k_RFront1      * dT_TC_T0 + areas.k_RFront2      * dT_TC_TF) * areas.RFrontLength
       + (areas.k_FRPartition1 * dT_TC_T0 + areas.k_FRPartition2 * dT_TC_TF) * areas.FRPartitionLength
       + (areas.k_FFront1      * dT_TC_T0 + areas.k_FFront2      * dT_TC_TR) * areas.FFrontLength  // ← fix
       + areas.sideKA * dT_TC_T0
       + areas.backKA * dT_TC_T0;
}

export function computeCondenserAreas(geom, condenserConfig) {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, tRtop, tRleft } = geom;
  const {
    K_side_kcalhm2C: K_side, 
    K_back_kcalhm2C: K_back,
    backCondenserEfficiency,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2
  } = condenserConfig;

  const sideArea = ((H * (D - 30)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6;
  const backAreaRaw = (W * (H - Hb)) / 1e6;
  const backArea = backAreaRaw * backCondenserEfficiency;

  const RFrontLength = (Hr * 2 ) / 1000;
  const FRPartitionLength = (W - tRtop - tRleft) / 1000;
  const FFrontLength = (Hf * 2) / 1000;

  return {
    RFrontLength, FRPartitionLength, FFrontLength,
    sideKA: K_side * sideArea,
    backKA: K_back * backArea,
    sideArea,      // raw side area (m²)
    backArea,      // raw back area (m²)
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2,
  };
}