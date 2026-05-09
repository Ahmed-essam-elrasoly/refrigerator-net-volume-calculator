// tests/debug_comp_dump.mjs
import { satPressureR600a, specificVolumeR600a, vaporEnthalpyR600a, liquidEnthalpyR600a } from '../src/js/engine/thermo/refrigerant.js';
import { calcVolumetricEfficiency } from '../src/js/engine/thermo/compressor.js';
import { SJ54H_COMPONENTS } from '../src/js/engine/thermo/defaultComponents.js';

const comp = SJ54H_COMPONENTS.compressor;
const TC = 54.4;
const TE = -21.2483006297973;   // T2 from Excel

const Pc = satPressureR600a(TC);
const Pe = satPressureR600a(TE);
console.log('Pc:', Pc, 'Pe:', Pe);

const T_suc = comp.T_suction;
const v_suc = specificVolumeR600a(T_suc, Pe);
console.log('v_suc:', v_suc);

const etaV = calcVolumetricEfficiency(TC, TE, comp, satPressureR600a);
console.log('etaV:', etaV);

const rpm = comp.rpm, Vc = comp.Vc;
const mdot = etaV * rpm * Vc * 1e-6 * 60 / v_suc;
console.log('massFlow (kg/h):', mdot);

const h_suc = vaporEnthalpyR600a(T_suc, Pe);
const Tsub = TC - 10;
const h_liq = liquidEnthalpyR600a(Tsub);
console.log('h_suction:', h_suc, 'h_liquid:', h_liq);

const Qc = mdot * (h_suc - h_liq);
console.log('coolingCapacity:', Qc);

const power = (comp.powerCoeffs.AW + comp.powerCoeffs.BW*TE + comp.powerCoeffs.CW*TC + comp.powerCoeffs.DW*TC*TE + comp.powerCoeffs.EW*TE*TE)
  * (comp.powerKw.a + comp.powerKw.b*rpm + comp.powerKw.c*rpm*rpm) * (rpm / comp.rpm0);
console.log('inputPower:', power);