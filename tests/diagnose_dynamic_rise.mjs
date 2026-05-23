// tests/diagnose_dynamic_rise.mjs
// SJ-540
const K_side = 10.57 - 0.042*150 + 0.00005*150**2; // 5.395
const rise54 = (40.91-30)/10 * K_side;               // 5.88 (matches Excel)
console.log('SJ-540 side rise:', rise54.toFixed(2), '°C (Excel 5.88)');

// PV73K
const rise73 = (48-25)/10 * K_side;                  // 12.41
const T_wallSide73 = 25 + rise73 * 0.77977;          // 34.7 °C (Excel 27.2)
console.log('PV73K side rise:', rise73.toFixed(2), '°C, T_side=', T_wallSide73.toFixed(1), '(Excel 2.22, 27.2)');