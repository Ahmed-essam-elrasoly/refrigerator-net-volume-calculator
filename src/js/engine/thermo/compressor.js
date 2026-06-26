/**
 * compressor.js
 * Polynomial compressor performance model — exact replica of the Excel formulas.
 *
 * ALL coefficients and compressor parameters are supplied by the caller.
 * Use createPolyConfig() to build and validate a config for any compressor.
 *
 * Bug fixes vs. previous version:
 *   1. satPressure was called but never in scope inside calcVolumetricEfficiency.
 *      Fixed: rf is now a required parameter — rf.satPressure() is called explicitly.
 *   2. kEtaV / Kw volumetric correction factor was applied but absent from the Excel.
 *      Removed: ηv = A + B*(Pc/Pe) + C*Pc  (direct polynomial, no RPM multiplier).
 *   3. Kw / rpmRatio power correction factors were applied but absent from the Excel.
 *      Removed: W = AW + BW*TE + CW*TC + DW*TC*TE + EW*TE²  (direct polynomial).
 *   4. coolingCapacity used h_sat_vap_TE − h_liquid_TC  (Excel's QU definition)
 *      but the map stores Q_total.  Both are now computed and returned under
 *      separate keys so the caller chooses the right one for their model.
 *
 * Unit contract (must be consistent across your refrigerant.js):
 *   rf.satPressure(T)          → kgf/cm²   (or any consistent pressure unit)
 *   rf.vaporEnthalpy(T, P)     → kcal/kg
 *   rf.liquidEnthalpy(T)       → kcal/kg
 *   rf.specificVolume(T, P)    → m³/kg
 *   mass flow (calcMassFlow)   → kg/h
 *   coolingCapacity            → kcal/h    (matches Excel rows 43–50)
 *   effectiveCooling           → kcal/h    (matches Excel rows 60–67)
 *   inputPower                 → W         (direct from polynomial)
 *
 * Cooling capacity definitions (two different Excel tables, VBA Record2):
 *
 *   Q_total      = mdot × (h_suction − h_ref)
 *                  h_suction : superheated vapour at T_suction and Pe
 *                  h_ref     : saturated liquid at T_suction
 *                  Excel:    QS = GG*(IG−IIN), rows 43–50
 *                  Use for:  matching compressor datasheets
 *
 *   Q_effective  = mdot × (h_sat_vap_TE − h_liquid_TC)
 *                  h_sat_vap_TE : saturated vapour at TE
 *                  h_liquid_TC  : liquid at (TC − subcool)
 *                  Excel:    QU = G*(IGL−ITC), rows 60–67
 *                  Use for:  cabinet energy balance in the refrigerator model
 */

import { getRefrigerantFunctions } from './refrigerant.js';
import { compressorStateMap }      from './compressorMap.js';

// ─────────────────────────────────────────────────────────────────────────────
// Pure calculation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Volumetric efficiency from the Excel polynomial.
 *   ηv = A + B*(Pc/Pe) + C*Pc
 *
 * @param {number}   TC           condensing temperature (°C)
 * @param {number}   TE           evaporating temperature (°C)
 * @param {{ A: number, B: number, C: number }} coeffs
 * @param {function} satPressure  rf.satPressure — must accept temperature (°C)
 * @returns {number} volumetric efficiency (dimensionless)
 */
export function calcVolumetricEfficiency(TC, TE, coeffs, satPressure) {
  const Pc = satPressure(TC);
  const Pe = satPressure(TE);
  const { A, B, C } = coeffs;
  return A + B * (Pc / Pe) + C * Pc;
}

/**
 * Theoretical mass flow rate (Excel: GK = 60 * RPM * VC / VG / 1e6).
 * Units: kg/h when Vc is in cc, rpm in rev/min, v_suc in m³/kg.
 *
 * Derivation:
 *   rpm [rev/min] × 60 [min/h] × Vc [cm³] × 1e-6 [m³/cm³] / v_suc [m³/kg] = kg/h
 *
 * @param {number} etaV    volumetric efficiency
 * @param {number} rpm     compressor speed (rev/min)
 * @param {number} Vc      cylinder volume (cc)
 * @param {number} v_suc   specific volume at suction (m³/kg)
 * @returns {number}       actual mass flow rate (kg/h)
 */
export function calcMassFlow(etaV, rpm, Vc, v_suc) {
  return etaV * rpm * 60 * Vc * 1e-6 / v_suc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory / validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds and validates a polynomial compressor config.
 * Throws with an actionable message on any missing or invalid field.
 *
 * @param {object} opts
 * @param {{ A: number, B: number, C: number }} opts.volEffCoeffs
 *        Volumetric efficiency: ηv = A + B*(Pc/Pe) + C*Pc
 *        Source: Excel DATA row 21 (ηv=)
 *
 * @param {{ AW: number, BW: number, CW: number, DW: number, EW: number }} opts.powerCoeffs
 *        Input power: W = AW + BW*TE + CW*TC + DW*TC*TE + EW*TE²
 *        Source: Excel DATA row 22 (W=)
 *
 * @param {number} opts.Vc          cylinder volume (cc)
 * @param {number} opts.rpm         rated speed (rev/min)
 * @param {number} [opts.T_suction=32.2]  suction line temperature (°C)
 *
 * @returns {object} validated compressor params
 */
export function createPolyConfig({
  volEffCoeffs,
  powerCoeffs,
  Vc,
  rpm,
  T_suction = 32.2,
}) {
  for (const k of ['A', 'B', 'C']) {
    if (!Number.isFinite(volEffCoeffs?.[k]))
      throw new Error(`createPolyConfig: volEffCoeffs.${k} must be a finite number`);
  }
  for (const k of ['AW', 'BW', 'CW', 'DW', 'EW']) {
    if (!Number.isFinite(powerCoeffs?.[k]))
      throw new Error(`createPolyConfig: powerCoeffs.${k} must be a finite number`);
  }
  if (!Number.isFinite(Vc) || Vc <= 0)
    throw new Error('createPolyConfig: Vc must be a positive finite number (cc)');
  if (!Number.isFinite(rpm) || rpm <= 0)
    throw new Error('createPolyConfig: rpm must be a positive finite number (rev/min)');
  if (!Number.isFinite(T_suction))
    throw new Error('createPolyConfig: T_suction must be a finite number (°C)');

  return { volEffCoeffs, powerCoeffs, Vc, rpm, T_suction };
}

// ─────────────────────────────────────────────────────────────────────────────
// Polynomial model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Polynomial compressor model — exact Excel replica.
 *
 * @param {number} TC          condensing temperature (°C)
 * @param {number} TE          evaporating temperature (°C)
 * @param {object} rf          refrigerant functions: { satPressure, vaporEnthalpy,
 *                                                      liquidEnthalpy, specificVolume }
 * @param {object} compParams  from createPolyConfig()
 * @param {number} [subcool=0] condenser subcooling (K)
 *
 * @returns {{
 *   etaV            : number,  volumetric efficiency (dimensionless)
 *   massFlow        : number,  kg/h
 *   coolingCapacity : number,  kcal/h  Q_total  — use for datasheet comparison
 *   effectiveCooling: number,  kcal/h  Q_eff    — use for cabinet energy balance
 *   inputPower      : number,  W
 *   Pe              : number,  evaporating pressure
 *   Pc              : number,  condensing pressure
 *   h_suction       : number,  kcal/kg  vapour enthalpy at T_suction and Pe
 *   h_ref           : number,  kcal/kg  liquid enthalpy at T_suction (IIN in VBA)
 *   h_sat_vap       : number,  kcal/kg  sat. vapour enthalpy at TE  (IGL in VBA)
 *   h_liquid        : number,  kcal/kg  liquid enthalpy at condenser exit (ITC in VBA)
 * }}
 */
export function compressorState(TC, TE, rf, compParams, subcool = 0) {
  const { volEffCoeffs, powerCoeffs, Vc, rpm, T_suction } = compParams;
  const { AW, BW, CW, DW, EW } = powerCoeffs;

  const Pe = rf.satPressure(TE);
  const Pc = rf.satPressure(TC);

  // ── Volumetric efficiency: ηv = A + B*(Pc/Pe) + C*Pc ──────────────────────
  const etaV = calcVolumetricEfficiency(TC, TE, volEffCoeffs, rf.satPressure);

  // ── Specific volume at suction conditions ─────────────────────────────────
  // VBA: VG = specific volume at T_suction and Pe (used in GK formula)
  const v_suc = rf.specificVolume(T_suction, Pe);

  // ── Mass flow (kg/h) ──────────────────────────────────────────────────────
  const massFlow = calcMassFlow(etaV, rpm, Vc, v_suc);

  // ── Enthalpy values ───────────────────────────────────────────────────────
  // h_suction (IG in VBA): superheated vapour at suction temperature and Pe
  const h_suction = rf.vaporEnthalpy(T_suction, Pe);
  // h_ref (IIN in VBA): saturated liquid at T_suction — reference for Q_total
  const h_ref     = rf.liquidEnthalpy(T_suction);
  // h_sat_vap (IGL in VBA): saturated vapour at TE — for effective cooling
  const h_sat_vap = rf.vaporEnthalpy(TE, Pe);
  // h_liquid (ITC in VBA): liquid at condenser exit with subcooling
  const h_liquid  = rf.liquidEnthalpy(TC - subcool);

  // ── Cooling capacities ────────────────────────────────────────────────────
  const dH_total = h_suction - h_ref;
  if (dH_total <= 0)
    throw new Error(
      `compressorState: h_suction (${h_suction}) − h_ref (${h_ref}) = ${dH_total} ≤ 0. ` +
      `Check refrigerant functions and T_suction=${T_suction}°C.`
    );

  const coolingCapacity  = massFlow * dH_total;                      // kcal/h  Q_total
  const effectiveCooling = massFlow * (h_sat_vap - h_liquid);        // kcal/h  Q_eff

  // ── Input power: direct polynomial, no correction factors ─────────────────
  // VBA: W = AW + BW*TE + CW*TC + DW*TC*TE + EW*TE²
  const inputPower = AW + BW * TE + CW * TC + DW * TC * TE + EW * TE * TE;  // W

  return {
    etaV,
    massFlow,
    coolingCapacity,
    effectiveCooling,
    inputPower,
    Pe,
    Pc,
    h_suction,
    h_ref,
    h_sat_vap,
    h_liquid,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Routes to polynomial or map model based on compParams.useMap.
 *
 * For the polynomial model:
 *   compParams = createPolyConfig({ volEffCoeffs, powerCoeffs, Vc, rpm, T_suction })
 *
 * For the map model:
 *   compParams = { useMap: true, map: createMapConfig({ ... }) }
 *   (the map config fields Vc, rpm, T_suction live inside compParams.map)
 *
 * Both paths return the same shape:
 *   { etaV, massFlow, coolingCapacity, effectiveCooling, inputPower,
 *     Pe, Pc, h_suction, h_ref, h_sat_vap, h_liquid }
 *
 * @param {number} TC
 * @param {number} TE
 * @param {object} rf           refrigerant functions
 * @param {object} compParams   poly config or { useMap: true, map: mapConfig }
 * @param {number} [subcool=0]  condenser subcooling (K)
 * @returns {object}
 */
export function resolveCompressorState(TC, TE, rf, compParams, subcool = 0) {
  if (compParams.useMap) {
    if (!compParams.map)
      throw new Error('resolveCompressorState: compParams.map is required when useMap=true');
    return compressorStateMap(TC, TE, compParams.map, rf, subcool);
  }
  return compressorState(TC, TE, rf, compParams, subcool);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference config: SQ47LAEG 220V 50Hz (R-600a), polynomial model
// Source: Excel DATA sheet rows 21–22
// ─────────────────────────────────────────────────────────────────────────────

export const SQ47LAEG_POLY = createPolyConfig({
  volEffCoeffs: {
    A:  0.9302583559597055,
    B: -0.012294405565323853,
    C: -0.0020532051517885733,
  },
  powerCoeffs: {
    AW: -403.45924099760987,
    BW:  -10.669447614327456,
    CW:   13.074324324321825,
    DW:    0.34869206555942833,
    EW:    0.037469902334827346,
  },
  Vc:        10.17,  // cc
  rpm:       2220,   // rev/min
  T_suction: 32.2,   // °C
});