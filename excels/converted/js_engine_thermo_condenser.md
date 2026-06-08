# condenser.js

**Original file:** `condenser.js`

**File type:** .JS

**Size:** 1,885 bytes

**Last modified:** 2026-05-27 12:18:20


---

## Content

```javascript
import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorState } from './compressor.js';

export function calcQCout(TC, T0, TF, TR, areas) {
  const dT_TC_T0 = TC - T0;
  const dT_TC_TF = TC - TF;
  const dT_TC_TR = TC - TR;   // ← add
  return (areas.k_RFront1 * dT_TC_T0 + areas.k_RFront2 * dT_TC_TR) * areas.RFrontLength
       + (areas.k_FRPartition1 * dT_TC_T0 + areas.k_FRPartition2 * dT_TC_TF) * areas.FRPartitionLength
       + (areas.k_FFront1      * dT_TC_T0 + areas.k_FFront2      * dT_TC_TR) * areas.FFrontLength  // ← fix
       + areas.sideKA * dT_TC_T0
       + areas.backKA * dT_TC_T0;
}

// FIX in condenser.js:
export function computeCondenserAreas(geom, condenserConfig, freezerPosition = 'top') {
  const { H, W, D, Hf, Hr, Hb, Db1, Db2, tRtop, tRleft, tFtop, tFleft } = geom;
  const {
    K_side_kcalhm2C: K_side,
    K_back_kcalhm2C: K_back,
    backCondenserEfficiency,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2,
  } = condenserConfig;

  const sideArea    = ((H * (D - 30)) - ((Db1 + Db2) * Hb / 2)) * 2 / 1e6;
  const backAreaRaw = (W * (H - Hb)) / 1e6;
  const backArea    = backAreaRaw * backCondenserEfficiency;

  const isTop    = freezerPosition === 'top';
  const H_lower  = isTop ? Hr : Hf;
  const H_upper  = isTop ? Hf : Hr;
  const t_lower_top  = isTop ? tRtop  : tFtop;
  const t_lower_left = isTop ? tRleft : tFleft;

  const RFrontLength      = H_lower * 2 / 1000;
  const FFrontLength      = H_upper * 2 / 1000;
  const FRPartitionLength = (W - t_lower_left - t_lower_top) / 1000;

  return {
    RFrontLength, FRPartitionLength, FFrontLength,
    sideKA: K_side * sideArea,
    backKA:  K_back * backArea,
    sideArea, backArea,
    k_RFront1, k_RFront2,
    k_FRPartition1, k_FRPartition2,
    k_FFront1, k_FFront2,
  };
}
```


---

*Converted from `condenser.js` on 2026-05-27 14:13:10*
