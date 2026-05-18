import XLSX from 'xlsx';

const wb = XLSX.readFile('Copy of Refrigerator freezer SJ-54H.xlsx');
const sizeSheet = wb.Sheets['SIZE'];

// Helper: get numeric value from cell
function getVal(ref) {
  const cell = sizeSheet[ref];
  return cell ? cell.v : undefined;
}

console.log('Excel SIZE sheet areas (m²) after convergence:\n');
console.log('F TOP     :', getVal('F7'));
console.log('F LEFT    :', getVal('F8'));
console.log('F RIGHT   :', getVal('F9'));
console.log('F BOTTOM  :', getVal('F10'));
console.log('F DOOR    :', getVal('F11'));
console.log('F PACKIN  :', getVal('F12'));
console.log('R TOP     :', getVal('F15'));
console.log('R LEFT    :', getVal('F16'));
console.log('R RIGHT   :', getVal('F17'));
console.log('R BACK    :', getVal('F18'));
console.log('R BOTTOM1 :', getVal('F19'));
console.log('R BOTTOM2 :', getVal('F20'));
console.log('R BOTTOM3 :', getVal('F21'));
console.log('R DOOR    :', getVal('F22'));
console.log('R PACKIN  :', getVal('F23'));
console.log('EVA BACK  :', getVal('F26'));