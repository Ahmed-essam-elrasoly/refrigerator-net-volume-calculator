/**
 * @file constants.js
 * @description Truly universal constants – physical properties, conversion
 * factors, and standard heat‑transfer coefficients.
 * These parameters are empirical and do NOT depend on the refrigerator model.
 */

export const PHYSICAL_CONSTANTS = Object.freeze({
  // -------------------------------------------------------------------
  // Dry air properties (at approx. -20°C to +60°C – constant for modelling)
  // -------------------------------------------------------------------
  air: {
    density: 1.365,  // Density in kg/m³     
    cp: 1.0048,      // Specific heat capacity in KJ/(kg·K) 
  },

  // -------------------------------------------------------------------
  // Insulation materials – thermal conductivity (W / (m·°C))
  // -------------------------------------------------------------------
  insulation: {
    urethane: 0.0192,    // Rigid polyurethane foam
    polystyrene: 0.0407, // Expanded polystyrene (EPS)
    packing: 0.035,      // Door gasket/packing material
  },

  // -------------------------------------------------------------------
  // Surface heat‑transfer coefficients (W / (m²·°C))
  // -------------------------------------------------------------------
  surfaceCoefficients: {
    outside: 6.977,  // Ambient exterior air to cabinet outer skin
    inside: 11.628,  // Cabinet interior air to inner liner
  },
});