/**
 * @file defaultComponents.js
 * @description Stores pre-configured baseline components and parameters.
 * Used for fallback calculations and initial application bootstrapping.
 */

/**
 * Baseline parameters for a standard top-freezer constant-speed configuration.
 */
export const SJ54H_COMPONENTS = Object.freeze({
  compressor: {
    name: 'EGX80CLC 100V 50Hz',
    rpm: 2900,
    rpm0: 2900,
    Vc: 11.14,          // Displacement in cc
    T_suction: 30,      // Fixed suction temperature (°C)
    volEffCoeffs: {     // Volumetric efficiency polynomial
      A: 0.9260142251566365,
      B: -0.01221312333322575,
      C: -0.0023789273042382304,
    },
    kEtaV: { a: 1, b: 0, c: 0 },
    powerCoeffs: {      // Input power polynomial
      AW: 135.175,
      BW: 2.6366666666666667,
      CW: 0.975,
      DW: 0.02,
      EW: 0.016666666666666666,
    },
    powerKw: { a: 1, b: 0, c: 0 },
  },

  fan: {
    diameter_mm: 100,
    speed_rpm: 2550,
    inputPower_W: 2.1,
    totalAirflow_m3h: 59.5,
    fanAirflow_CFM: 59.5 / 1.699,
  },

  electrical: {
    pwbOn_W: 2,
    pwbOff_W: 1,
    defrostHeater_W: 140,
    timerPeriod_h: 10.5,
    defrostOn_min: 20,
  },

  condenser: {
    sidePipePitch_mm: 150,
    backPipePitch_mm: 200,
    K_side_kcalhm2C: 5.395,
    K_back_kcalhm2C: 4.17,
    backCondenserEfficiency: 0.7,
    k_RFront1: 0.3405,
    k_RFront2: 0.03322,
    k_FRPartition1: 0.1984,
    k_FRPartition2: 0.1219,
    k_FFront1: 0.3395,
    k_FFront2: 0.0344,
  },

  dischargeTemp_C: 60,
  evapGeom: {
    evapWidth_mm: 460,    
    evapDepth_mm: 60,     
    evapArea_m2: 1.754,   
  },
  initialTE: -25.7,
});

/**
 * Baseline parameters for an advanced bottom-freezer inverter configuration.
 */
export const SJ_PV73K_COMPONENTS = Object.freeze({
  compressor: {
    name: 'DZ90A1X Inverter',
    isInverter: true,
    rpmMin: 1600,
    rpmMax: 4500,
    normalizeRPM: 4320,
    centerTE: -25.0,
    centerTC: 45.0,
    refrigerantIndex: 2,
    compressorModel: null, // Generated dynamically via ridge regression
    dataPoints: [
      { RPM: 4320, TE: -35.0, TC: 35, W: 90.3, Q: 126.1 },
      { RPM: 4320, TE: -25.0, TC: 35, W: 121.1, Q: 188.4 },
      { RPM: 4320, TE: -15.0, TC: 35, W: 152.0, Q: 279.7 },
      { RPM: 4320, TE: -35.0, TC: 45, W: 83.4, Q: 117.5 },
      { RPM: 4320, TE: -25.0, TC: 45, W: 109.6, Q: 179.8 },
      { RPM: 4320, TE: -15.0, TC: 45, W: 134.0, Q: 271.0 },
      { RPM: 4320, TE: -35.0, TC: 55, W: 75.8, Q: 108.9 },
      { RPM: 4320, TE: -25.0, TC: 55, W: 96.9, Q: 171.1 },
      { RPM: 4320, TE: -15.0, TC: 55, W: 114.5, Q: 262.3 },
      { RPM: 3000, TE: -35.0, TC: 35, W: 53.3, Q: 101.7 },
      { RPM: 3000, TE: -25.0, TC: 35, W: 68.1, Q: 150.1 },
      { RPM: 3000, TE: -15.0, TC: 35, W: 80.5, Q: 220.9 },
      { RPM: 3000, TE: -35.0, TC: 45, W: 58.6, Q: 93.1 },
      { RPM: 3000, TE: -25.0, TC: 45, W: 77.0, Q: 141.4 },
      { RPM: 3000, TE: -15.0, TC: 45, W: 94.2, Q: 212.3 },
      { RPM: 3000, TE: -35.0, TC: 55, W: 63.4, Q: 84.5 },
      { RPM: 3000, TE: -25.0, TC: 55, W: 85.1, Q: 132.8 },
      { RPM: 3000, TE: -15.0, TC: 55, W: 106.8, Q: 203.7 },
      { RPM: 1620, TE: -35.0, TC: 35, W: 28.4, Q: 62.0 },
      { RPM: 1620, TE: -25.0, TC: 35, W: 36.3, Q: 87.8 },
      { RPM: 1620, TE: -15.0, TC: 35, W: 42.9, Q: 125.5 },
      { RPM: 1620, TE: -35.0, TC: 45, W: 31.2, Q: 53.4 },
      { RPM: 1620, TE: -25.0, TC: 45, W: 41.0, Q: 79.2 },
      { RPM: 1620, TE: -15.0, TC: 45, W: 50.2, Q: 116.9 },
      { RPM: 1620, TE: -35.0, TC: 55, W: 33.8, Q: 44.8 },
      { RPM: 1620, TE: -25.0, TC: 55, W: 45.4, Q: 70.5 },
      { RPM: 1620, TE: -15.0, TC: 55, W: 56.9, Q: 108.3 },
      { RPM: 1320, TE: -35.0, TC: 35, W: 23.0, Q: 53.3 },
      { RPM: 1320, TE: -25.0, TC: 35, W: 29.4, Q: 74.2 },
      { RPM: 1320, TE: -15.0, TC: 35, W: 34.7, Q: 104.7 },
      { RPM: 1320, TE: -35.0, TC: 45, W: 25.3, Q: 44.7 },
      { RPM: 1320, TE: -25.0, TC: 45, W: 33.2, Q: 65.6 },
      { RPM: 1320, TE: -15.0, TC: 45, W: 40.6, Q: 96.1 },
      { RPM: 1320, TE: -35.0, TC: 55, W: 27.4, Q: 36.1 },
      { RPM: 1320, TE: -25.0, TC: 55, W: 36.7, Q: 57.0 },
      { RPM: 1320, TE: -15.0, TC: 55, W: 46.0, Q: 87.5 }
    ]
  },
  fan: {
    diameter_mm: 100,
    speed_rpm: 2850,
    inputPower_W: 2.4,
    totalAirflow_m3h: 146.4,
  },
  electrical: {
    pwbOn_W: 2,
    pwbOff_W: 1,
    defrostHeater_W: 112,
    timerPeriod_h: 10.5,
    defrostOn_min: 0,
  },
  condenser: {
    sidePipePitch_mm: 150,
    backPipePitch_mm: 200,
    K_side_kcalhm2C: 5.395,
    K_back_kcalhm2C: 4.17,
    backCondenserEfficiency: 0.7,
    k_RFront1: 0.3405,
    k_RFront2: 0.03322,
    k_FRPartition1: 0.1984,
    k_FRPartition2: 0.1219,
    k_FFront1: 0.3395,
    k_FFront2: 0.0344,
  },
  dischargeTemp_C: 60,
  evapGeom: {
    evapWidth_mm: 440.5,
    evapDepth_mm: 58,
    evapArea_m2: 1.2985,
  },
  freezerPosition: 'bottom',
  initialTE: -22.7,
});

export const INVERTER_EXAMPLE_COMPONENTS = Object.freeze(SJ_PV73K_COMPONENTS);