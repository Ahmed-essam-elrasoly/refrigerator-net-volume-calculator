export const SJ54H_COMPONENTS = Object.freeze({
  compressor: {
    name: 'EGX80CLC 100V 50Hz',
    rpm: 2900,
    rpm0: 2900,
    Vc: 11.14,  // cc
    volEffCoeffs: {
      A: 0.9260142251566365,
      B: -0.01221312333322575,
      C: -0.0023789273042382304,
    },
    kEtaV: { a: 1, b: 0, c: 0 },
    powerCoeffs: {
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
  },

  electrical: {
    pwbOn_W: 2,
    pwbOff_W: 1,
    defrostHeater_W: 140,
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

  subcool_K: 10,
  dischargeTemp_C: 60,
});