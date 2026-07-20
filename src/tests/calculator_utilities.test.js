import { describe, it, expect, vi } from 'vitest';
import { toCuft, roundForDisplay } from '../js/engine/calc.js';

// We mock the settings module because calc.js relies on global settings
// for conversion rates and display precision.
vi.mock('../js/settings.js', () => ({
  settings: {
    lToCuft: 0.0353147,
    displayPrecisionL: 2,
    displayPrecisionCuft: 3
  }
}));

describe('Core Calculation Utilities', () => {
  it('should convert liters to cubic feet accurately', () => {
    const liters = 100;
    // 100 * 0.0353147 = 3.53147
    expect(toCuft(liters)).toBeCloseTo(3.53147, 5);
  });

  it('should round values for display based on configured settings', () => {
    // Expected to round to 2 decimal places for Liters
    expect(roundForDisplay(10.5555, 'L')).toBe(10.56); 
    
    // Expected to round to 3 decimal places for Cubic Feet
    expect(roundForDisplay(10.5555, 'cuft')).toBe(10.556); 
  });
});