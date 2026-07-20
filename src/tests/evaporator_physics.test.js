import { describe, it, expect, vi } from 'vitest';
import { evaporatorAlpha, lmtd } from '../js/engine/thermo/evaporator.js';

describe('Evaporator Physics Models', () => {
  it('should correctly calculate the convective heat transfer coefficient (alpha)', () => {
    // Test with a known air velocity, e.g., 2.0 m/s
    // Formula: alpha = 12.93 * (v)^0.415 * 1.16279
    const v = 2.0;
    const expectedAlpha = 12.93 * Math.pow(v, 0.415) * 1.16279;
    expect(evaporatorAlpha(v)).toBeCloseTo(expectedAlpha, 4);
  });

  it('should correctly calculate Log Mean Temperature Difference (LMTD)', () => {
    const T1 = -15; // Air inlet
    const T2 = -20; // Air outlet
    const TE = -25; // Evaporating temp
    
    // dT1 = T1 - TE = 10
    // dT2 = T2 - TE = 5
    // LMTD = (10 - 5) / ln(10 / 5) = 5 / ln(2) ≈ 7.213475
    const expectedLMTD = 5 / Math.log(2);
    expect(lmtd(T1, T2, TE)).toBeCloseTo(expectedLMTD, 4);
  });

  it('should fallback to arithmetic mean if temperatures are physically invalid for cooling', () => {
    // If Evaporating Temp (TE) is warmer than the air, heat transfer direction is reversed
    const T1 = -20;
    const T2 = -25;
    const TE = -15; 
    
    // Fallback logic returns: (dT1 + dT2) / 2 = (-5 + -10) / 2 = -7.5
    expect(lmtd(T1, T2, TE)).toBe(-7.5);
  });
});