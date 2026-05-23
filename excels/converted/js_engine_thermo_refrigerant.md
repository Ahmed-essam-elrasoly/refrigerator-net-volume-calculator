# refrigerant.js

**Original file:** `refrigerant.js`

**File type:** .JS

**Size:** 5,080 bytes

**Last modified:** 2026-05-08 15:11:59


---

## Content

```javascript
/**
 * @file refrigerant.js
 * @description Thermodynamic property functions for R‑600a and R‑134a.
 *   All equations are taken directly from the SJ-54H Excel model (MAIN sheet).
 *   Temperatures in °C, pressures in bar absolute.
 *   Enthalpies in kcal/kg, specific volume in m³/kg.
 */

// ---------------------------------------------------------------------------
//  Saturation pressure (bar)
// ---------------------------------------------------------------------------

/**
 * Saturation pressure for R‑600a (isobutane).
 * Source: MAIN J14/J15.
 * @param {number} t - temperature (°C)
 * @returns {number} pressure (bar)
 */
export function satPressureR600a(t) {
  const Tk = t + 273.16;
  return Math.exp(
    68.322
    - 4401 / Tk
    - 9.8436 * Math.log(Tk)
    + 0.0127711 * Tk
  );
}

/**
 * Saturation pressure for R‑134a.
 * Source: MAIN K14/K15.
 * @param {number} t - temperature (°C)
 * @returns {number} pressure (bar)
 */
export function satPressureR134a(t) {
  const Tk = t + 273.16;
  return Math.exp(
    104.918
    - 5301.3 / Tk
    - 16.2481 * Math.log(Tk)
    + 0.0246593 * Tk
  );
}

// ---------------------------------------------------------------------------
//  Specific volume of saturated vapour (m³/kg)
// ---------------------------------------------------------------------------

/**
 * Specific volume for R‑600a.
 * Source: MAIN J18.
 * @param {number} t   - temperature (°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    v (m³/kg)
 */
export function specificVolumeR600a(t, p) {
  const Tk = t + 273.16;
  return (
    0.015883
    + (0.001455 * Tk) / p
    - 7.2936 / Tk
    - 0.0004645 * p
  );
}

/**
 * Specific volume for R‑134a.
 * Source: MAIN K18.
 * @param {number} t   - temperature (°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    v (m³/kg)
 */
export function specificVolumeR134a(t, p) {
  const Tk = t + 273.16;
  return (
    0.01248
    + (0.0008207 * Tk) / p
    - 4.663 / Tk
    - 0.0002297 * p
  );
}

// ---------------------------------------------------------------------------
//  Superheated vapour enthalpy (kcal/kg)
//  Used for both evaporator outlet (suction) and condenser inlet (discharge).
// ---------------------------------------------------------------------------

/**
 * R‑600a vapour enthalpy.
 * Source: MAIN J16/J17 (identical coefficients).
 * @param {number} t   - temperature (°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    h (kcal/kg)
 */
export function vaporEnthalpyR600a(t, p) {
  const Tk = t + 273.16;
  return (
    104.5
    + 0.049951 * Tk
    + 0.00058822 * Tk * Tk
    - (249.18 * p) / Tk
  );
}

/**
 * R‑134a vapour enthalpy.
 * Source: MAIN K16/K17.
 * @param {number} t   - temperature (°C)
 * @param {number} p   - pressure (bar)
 * @returns {number}    h (kcal/kg)
 */
export function vaporEnthalpyR134a(t, p) {
  const Tk = t + 273.16;
  return (
    119.36
    + 0.023174 * Tk
    + 0.00031297 * Tk * Tk
    - (138.07 * p) / Tk
  );
}

// ---------------------------------------------------------------------------
//  Sub‑cooled liquid enthalpy (kcal/kg)
// ---------------------------------------------------------------------------

/**
 * R‑600a liquid enthalpy (function of sub‑cool temperature in °C).
 * Source: MAIN N47 (Hcond out).
 * @param {number} t_sub - sub‑cool temperature (°C)
 * @returns {number}      h (kcal/kg)
 */
export function liquidEnthalpyR600a(t_sub) {
  return (
    75.545
    + 0.55731 * t_sub
    + 0.0007088 * t_sub * t_sub
    + 0.0000029408 * t_sub * t_sub * t_sub
  );
}

/**
 * R‑134a liquid enthalpy.
 * Source: MAIN O47.
 * @param {number} t_sub - sub‑cool temperature (°C)
 * @returns {number}      h (kcal/kg)
 */
export function liquidEnthalpyR134a(t_sub) {
  return (
    100.019
    + 0.31763 * t_sub
    + 0.00033057 * t_sub * t_sub
    + 0.0000035281 * t_sub * t_sub * t_sub
  );
}

// ---------------------------------------------------------------------------
//  Easy dispatch by refrigerant name
// ---------------------------------------------------------------------------

/**
 * Returns an object with all property functions for a given refrigerant.
 * @param {'R-600a'|'R-134a'} name
 * @returns {{ satPressure, specificVolume, vaporEnthalpy, liquidEnthalpy }}
 */
export function getRefrigerantFunctions(name) {
  switch (name) {
    case 'R-600a':
      return {
        satPressure: satPressureR600a,
        specificVolume: specificVolumeR600a,
        vaporEnthalpy: vaporEnthalpyR600a,
        liquidEnthalpy: liquidEnthalpyR600a,
      };
    case 'R-134a':
      return {
        satPressure: satPressureR134a,
        specificVolume: specificVolumeR134a,
        vaporEnthalpy: vaporEnthalpyR134a,
        liquidEnthalpy: liquidEnthalpyR134a,
      };
    default:
      throw new Error(`Unknown refrigerant: ${name}`);
  }
}
```


---

*Converted from `refrigerant.js` on 2026-05-23 11:54:21*
