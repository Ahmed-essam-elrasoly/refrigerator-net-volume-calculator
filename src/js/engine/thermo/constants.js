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
    density: 1.365,  // kg/m³     
    cp: 1.0048,        // KJ/kg·K 
  },

  // -------------------------------------------------------------------
  // Insulation materials – thermal conductivity (W / (m·°C))
  // -------------------------------------------------------------------
  insulation: {
    urethane: 0.0192,   // rigid polyurethane foam (SIZE B33)
    polystyrene: 0.0407, // (SIZE B34)
    packing: 0.035,     // door gasket material (SIZE B36)
  },

  // -------------------------------------------------------------------
  // Surface heat‑transfer coefficients (W / (m²·°C))
  // -------------------------------------------------------------------
  surfaceCoefficients: {
    outside: 6.977,  // ambient air to cabinet (SIZE B40)
    inside: 11.628,  // cabinet interior air to wall (SIZE B41)
  },
});