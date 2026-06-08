# evaporator.js

**Original file:** `evaporator.js`

**File type:** .JS

**Size:** 1,890 bytes

**Last modified:** 2026-05-17 23:25:51


---

## Content

```javascript
// evaporator.js – exact Excel evaporator model
import { PHYSICAL_CONSTANTS as PC } from './constants.js';

/**
 * Compute evaporator total surface area (m²)
 * Excel SIZE B29-B33: Fin area + Tube area + Side plate area
 */
export function computeEvaporatorArea(evap) {
  const { width_mm, depth_mm, rows, tubeOD_mm, finPitch_mm, finHeight_mm, finLength_mm, numFins } = evap;
  // Fin area (both sides) – Excel: (28*60 - π*(4^2))*2 / 1e6 per fin
  const tubeCrossArea = Math.PI * (tubeOD_mm/2)**2;
  const finAreaPerFin = (finLength_mm * finHeight_mm - tubeCrossArea) * 2 / 1e6; // m²
  const totalFinArea = finAreaPerFin * numFins;
  // Tube outer area – Excel: (π * tubeOD * width) * rows * 2 / 1e6
  const tubeArea = (Math.PI * tubeOD_mm * width_mm) * rows * 2 / 1e6;
  // Side plate area (Excel B32) – usually zero
  const sidePlateArea = 0;
  return totalFinArea + tubeArea + sidePlateArea;
}

/**
 * Air speed over evaporator (m/s) – Excel MAIN E19
 * v = fanAirflow_m3h / (width_m * depth_m) / 3600
 */
export function airSpeed(fanAirflow_m3h, evap) {
  const frontArea_m2 = (evap.width_mm * evap.depth_mm) / 1e6;
  return fanAirflow_m3h / frontArea_m2 / 3600;
}

/**
 * Evaporator heat transfer coefficient (kcal/h·m²·°C) – Excel MAIN E21
 * α = 12.93 * v^0.415
 */
export function evaporatorAlpha(v_ms) {
  return 12.93 * Math.pow(v_ms, 0.415);
}

/**
 * Log mean temperature difference – Excel MAIN E20
 * LMTD = (T1 - T2) / ln((T1 - TE) / (T2 - TE))
 */
export function lmtd(T1, T2, TE) {
  const dT1 = T1 - TE;
  const dT2 = T2 - TE;
  if (Math.abs(dT1 - dT2) < 1e-6) return dT1;
  return (dT1 - dT2) / Math.log(dT1 / dT2);
}

/**
 * Evaporator capacity (kcal/h) – Excel MAIN E23
 * Qevap = α * area * LMTD
 */
export function evaporatorCapacity(alpha, area, LMTD) {
  return alpha * area * LMTD;
}
```


---

*Converted from `evaporator.js` on 2026-05-27 14:13:10*
