/**
 * @file validateHeatLoad.js
 * @description Provides sanity checks for thermodynamic inputs and generated heat loads
 * to prevent the solver from running physically impossible scenarios.
 */

/**
 * Validates temperature bounds, insulation viability, and final heat loads.
 * 
 * @param {Object} geom - Flat thermal geometry.
 * @param {Object} temps - Abstract target temperatures.
 * @param {Object} calculatedLoads - Calculated QF, QR, QEV.
 * @returns {{isValid: boolean, errors: string[], warnings: string[]}}
 */
export function validateHeatLoad(geom, temps, calculatedLoads) {
    const errors = [];
    const warnings = [];
    
    // 1. Temperature Logic Checks
    if (typeof temps.T0 !== 'number' || typeof temps.TF !== 'number' || typeof temps.TR !== 'number') {
        errors.push("Missing or invalid temperature inputs. T0, TF, and TR must be numbers.");
    } else {
        if (temps.TF >= temps.TR) {
            errors.push(`Freezer temp (TF: ${temps.TF}°C) is warmer than or equal to Refrigerator temp (TR: ${temps.TR}°C).`);
        }
        if (temps.TR >= temps.T0) {
            errors.push(`Refrigerator temp (TR: ${temps.TR}°C) is warmer than or equal to Ambient temp (T0: ${temps.T0}°C). Heat will flow backwards.`);
        }
    }

    // 2. Geometry & Insulation Sanity Checks
    const minInsulation = 30; // mm
    const criticalInsulations = [
        { name: 'Freezer Top', val: geom.tFtop },
        { name: 'Freezer Left', val: geom.tFleft },
        { name: 'Freezer Right', val: geom.tFright },
        { name: 'Refrigerator Top', val: geom.tRtop },
        { name: 'Refrigerator Left', val: geom.tRleft }
    ];

    criticalInsulations.forEach(insul => {
        if (insul.val === undefined || insul.val === null) {
            errors.push(`Missing insulation thickness for ${insul.name}.`);
        } else if (insul.val < minInsulation) {
            warnings.push(`${insul.name} insulation is extremely thin (${insul.val}mm). Expect massive heat leaks.`);
        }
    });

    // 3. Calculated Load Sanity Checks
    if (calculatedLoads) {
        if (calculatedLoads.QF < 0) errors.push(`Freezer heat load (QF: ${calculatedLoads.QF}W) is negative. Physical impossibility.`);
        if (calculatedLoads.QR < 0) errors.push(`Refrigerator heat load (QR: ${calculatedLoads.QR}W) is negative. Physical impossibility.`);
        
        const totalLoad = calculatedLoads.QF + calculatedLoads.QR + (calculatedLoads.QEV || 0);
        
        // A typical domestic fridge sits between 50W and 120W total load. 
        if (totalLoad > 200) {
            warnings.push(`Total calculated heat load is extremely high (${totalLoad.toFixed(2)}W). Most standard compressors will fail to satisfy this demand.`);
        }
    } else {
        errors.push("No calculated loads provided for validation.");
    }

    if (temps.TE !== undefined && temps.TF !== undefined && temps.TE >= temps.TF) {
        errors.push(`Evaporator temperature (TE: ${temps.TE}°C) must be lower than Freezer temperature (TF: ${temps.TF}°C) for heat extraction.`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}