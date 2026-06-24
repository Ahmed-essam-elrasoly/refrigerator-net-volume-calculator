# constants.js

**Original file:** `constants.js`

**File type:** .JS

**Size:** 1,720 bytes

**Last modified:** 2026-05-08 15:10:41


---

## Content

```javascript
/**
 * @file constants.js
 * @description Truly universal constants – physical properties, conversion
 *     factors, and standard heat‑transfer coefficients.
 *     These do NOT depend on the refrigerator model or its components.
 */

export const PHYSICAL_CONSTANTS = Object.freeze({
  // -------------------------------------------------------------------
  // Dry air properties (at approx. -20 °C to +60 °C – constant for modelling)
  // -------------------------------------------------------------------
  air: {
    density: 1.365,  // kg/m³     (Excel: MAIN B20)
    cp: 0.24,        // kcal/kg·°C (Excel: MAIN B21)
  },

  // -------------------------------------------------------------------
  // Insulation materials – thermal conductivity (kcal / (m·h·°C))
  // -------------------------------------------------------------------
  insulation: {
    urethane: 0.0165,   // rigid polyurethane foam (SIZE B33)
    polystyrene: 0.035, // (SIZE B34)
    packing: 0.035,     // door gasket material (SIZE B36)
  },

  // -------------------------------------------------------------------
  // Surface heat‑transfer coefficients (kcal / (m²·h·°C))
  // -------------------------------------------------------------------
  surfaceCoefficients: {
    outside: 6,  // ambient air to cabinet (SIZE B40)
    inside: 10,  // cabinet interior air to wall (SIZE B41)
  },

  // -------------------------------------------------------------------
  // Unit conversions
  // -------------------------------------------------------------------
  conversion: {
    wattToKcalPerH: 0.86,
    // kcal/h → W : multiply by 1/0.86 ≈ 1.16279
  },
});
```


---

*Converted from `constants.js` on 2026-06-22 22:25:35*
