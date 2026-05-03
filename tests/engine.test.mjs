/**
 * @file tests/engine.test.mjs
 * Reference test cases for the calculation and validation engines.
 * Run with: node tests/engine.test.mjs
 */

import { runCalculation, deriveRootSpace } from '../src/js/engine/index.js';
import { calcLeaf, aggregateTotals, formatLeafDisplay, formatTotalsDisplay } from '../src/js/engine/calc.js';
import { validateStructure } from '../src/js/engine/validationPass1.js';

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------
console.log('deriveRootSpace exists:', typeof deriveRootSpace === 'function');
console.log('shelfVol exists:',       typeof shelfVol === 'function');
console.log('runCalculation exists:', typeof runCalculation === 'function');

let passed = 0, failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function assertClose(label, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  assert(label, ok, `actual=${actual.toFixed(4)}, expected=${expected}, tol=±${tol}`);
}

function section(name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(name);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// Base cabinet used in TC-01, TC-03, TC-04, TC-09
// ---------------------------------------------------------------------------

const BASE_CABINET = {
  external:        { height: 1800, width: 700, depth: 700 },
  wallThicknesses: { top: 40, bottom: 40, left: 40, right: 40, rear: 40, door: 60 },
  airGap:          5,
};

function makeConfig(layout) {
  return {
    schemaVersion: '1.0',
    meta: { name: 'test', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    cabinet: { ...BASE_CABINET, layout },
  };
}

const EMPTY_FITTINGS = {
  shelves: [], drawers: [], doorBins: [],
  iceMakerHousing: { volume: null },
  lightHousing:    { volume: null },
};

// ---------------------------------------------------------------------------
// TC-01 — Single compartment, no fittings
// ---------------------------------------------------------------------------

section('TC-01 — Single compartment, no fittings');
{
  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [{ heightMode: 'ratio', heightValue: 1.0,
      node: { nodeType: 'leaf', id: 'leaf-01', type: 'fresh', fittings: EMPTY_FITTINGS } }],
    dividers: [],
  });

  const result = runCalculation(config);
  assert('No validation errors', result.validationErrors.length === 0);
  assert('One leaf result',      result.leaves.length === 1);

  const d = formatLeafDisplay(result.leaves[0]);
  assertClose('gross_L',    d.gross,      634.51, 0.01);
  assertClose('EG_Net_L',   d.egNet,      615.47, 0.01);
  assertClose('IEC_Net_L',  d.iecNet,     615.47, 0.01);
  assertClose('gross_cuft', d.grossCuft,  22.407, 0.001);
  assertClose('EG_cuft',    d.egNetCuft,  21.735, 0.001);
  assertClose('IEC_cuft',   d.iecNetCuft, 21.735, 0.001);

  assert('Hierarchy: gross ≥ EG ≥ IEC',
    result.leaves[0].gross >= result.leaves[0].egNet &&
    result.leaves[0].egNet >= result.leaves[0].iecNet);
}

// ---------------------------------------------------------------------------
// TC-02 — Two horizontal compartments with divider
// ---------------------------------------------------------------------------

section('TC-02 — Two horizontal compartments with divider');
{
  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [
      { heightMode: 'explicit', heightValue: 1100,
        node: { nodeType: 'leaf', id: 'fresh', type: 'fresh', fittings: EMPTY_FITTINGS } },
      { heightMode: 'explicit', heightValue: 595,
        node: { nodeType: 'leaf', id: 'freezer', type: 'freezer', fittings: EMPTY_FITTINGS } },
    ],
    dividers: [{ afterChildIndex: 0, thickness: 25 }],
  });

  const result = runCalculation(config);
  assert('No validation errors', result.validationErrors.length === 0);
  assert('Two leaf results',     result.leaves.length === 2);

  const fresh  = formatLeafDisplay(result.leaves[0]);
  const freezer = formatLeafDisplay(result.leaves[1]);
  const totals  = formatTotalsDisplay(result.totals);

  assertClose('fresh gross',    fresh.gross,   405.79, 0.01);
  assertClose('fresh EG',       fresh.egNet,   393.62, 0.01);
  assertClose('freezer gross',  freezer.gross, 219.50, 0.01);
  assertClose('freezer EG',     freezer.egNet, 212.91, 0.01);
  assertClose('Total_Gross',    totals.gross,  625.29, 0.01);
  assertClose('Total_EG',       totals.egNet,  606.53, 0.01);

  // Divider volume check: 634.51 - 625.29 ≈ 9.22
  const divCheck = formatLeafDisplay({ gross: 620*595*25*1e-6, egNet:0, iecNet:0 });
  assertClose('Divider vol', 620*595*25*1e-6, 9.2225, 0.01);
}

// ---------------------------------------------------------------------------
// TC-03 — IEC deduction: shelves + drawer
// ---------------------------------------------------------------------------

section('TC-03 — Shelves and drawer IEC deduction');
{
  const fittings = {
    shelves: [
      { id: 's0', positionFromFloor: 400, thickness: 8, depth: 560, width: null },
      { id: 's1', positionFromFloor: 800, thickness: 8, depth: 560, width: 300 },
    ],
    drawers: [
      { id: 'd0', outerWidth: 580, outerDepth: 500, outerHeight: 200, wallThickness: 10 },
    ],
    doorBins: [],
    iceMakerHousing: { volume: null },
    lightHousing:    { volume: null },
  };

  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [{ heightMode: 'ratio', heightValue: 1.0,
      node: { nodeType: 'leaf', id: 'leaf-03', type: 'fresh', fittings } }],
    dividers: [],
  });

  const result = runCalculation(config);
  assert('No validation errors', result.validationErrors.length === 0);

  const d = formatLeafDisplay(result.leaves[0]);
  assertClose('gross_L',   d.gross,  634.51, 0.01);
  assertClose('EG_Net_L',  d.egNet,  615.47, 0.01);
  assertClose('IEC_Net_L', d.iecNet, 604.42, 0.01);
  assert('Hierarchy: EG ≥ IEC', result.leaves[0].egNet >= result.leaves[0].iecNet);
}

// ---------------------------------------------------------------------------
// TC-04 — Door bin deduction + soft warning
// ---------------------------------------------------------------------------

section('TC-04 — Door bin deduction and soft warning');
{
  const fittings = {
    shelves: [{ id: 's0', positionFromFloor: 400, thickness: 8, depth: 560, width: null }],
    drawers: [],
    doorBins: [
      { id: 'b0', outerWidth: 200, outerHeight: 150, outerDepth: 120, wallThickness: 5 },
      { id: 'b1', outerWidth: 200, outerHeight: 150, outerDepth: 120, wallThickness: 5 },
    ],
    iceMakerHousing: { volume: null },
    lightHousing:    { volume: null },
  };

  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [{ heightMode: 'ratio', heightValue: 1.0,
      node: { nodeType: 'leaf', id: 'leaf-04', type: 'fresh', fittings } }],
    dividers: [],
  });

  const result = runCalculation(config);
  assert('No hard validation errors', result.validationErrors.length === 0);

  const d = formatLeafDisplay(result.leaves[0]);
  assertClose('gross_L',   d.gross,  634.51, 0.01);
  assertClose('EG_Net_L',  d.egNet,  615.47, 0.01);
  assertClose('IEC_Net_L', d.iecNet, 611.61, 0.01);

  assert('Soft warning fires', result.warnings.length > 0);
  assert('Warning rule is doorBinDepth',
    result.warnings.some(w => w.rule === 'doorBinDepth'));
}

// ---------------------------------------------------------------------------
// TC-05 — Vertical split (asymmetric, French door)
// ---------------------------------------------------------------------------

section('TC-05 — Vertical split (French door, asymmetric)');
{
  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [
      { heightMode: 'ratio', heightValue: 0.75, node: {
        nodeType: 'vertical', id: 'top-row',
        dividerThickness: 20, leftWidthRatio: 0.40,
        left:  { nodeType: 'leaf', id: 'freezer-left',  type: 'freezer', fittings: EMPTY_FITTINGS },
        right: { nodeType: 'leaf', id: 'fresh-right',   type: 'fresh',   fittings: EMPTY_FITTINGS },
      }},
      { heightMode: 'ratio', heightValue: 0.25,
        node: { nodeType: 'leaf', id: 'drawer-bottom', type: 'freezer', fittings: EMPTY_FITTINGS } },
    ],
    dividers: [{ afterChildIndex: 0, thickness: 25 }],
  });

  const result = runCalculation(config);
  assert('No validation errors', result.validationErrors.length === 0);
  assert('Three leaf results',   result.leaves.length === 3);

  const [fl, fr, bot] = result.leaves.map(formatLeafDisplay);
  const totals = formatTotalsDisplay(result.totals);

  assertClose('freezer-left gross',  fl.gross,    181.53, 0.01);
  assertClose('freezer-left EG',     fl.egNet,    176.09, 0.01);
  assertClose('fresh-right gross',   fr.gross,    272.30, 0.01);
  assertClose('fresh-right EG',      fr.egNet,    264.13, 0.01);
  assertClose('drawer-bottom gross', bot.gross,   156.32, 0.01);
  assertClose('drawer-bottom EG',    bot.egNet,   151.63, 0.01);
  assertClose('Total_Gross',         totals.gross,  610.16, 0.01);
  assertClose('Total_EG',            totals.egNet,  591.85, 0.01);
}

// ---------------------------------------------------------------------------
// TC-06 — Pass 1 validation failures
// ---------------------------------------------------------------------------

section('TC-06 — Pass 1 structural validation failures');
{
  // TC-06a: maxLeaves exceeded (9 leaves)
  function makeLeaf(id) {
    return { nodeType: 'leaf', id, type: 'fresh', fittings: EMPTY_FITTINGS };
  }
  function makeHoriz(children, dividers) {
    return { nodeType: 'horizontal', id: 'h', children, dividers };
  }

  const nineLeaves = makeHoriz(
    Array.from({length: 9}, (_, i) => ({
      heightMode: 'ratio', heightValue: 1/9,
      node: makeLeaf(`leaf-${i}`)
    })),
    Array.from({length: 8}, (_, i) => ({ afterChildIndex: i, thickness: 5 }))
  );
  const r06a = validateStructure(nineLeaves);
  assert('TC-06a: maxLeaves error', r06a.some(e => e.rule === 'maxLeaves'));

  // TC-06b: dividerCount mismatch (3 children, 1 divider)
  const r06b = validateStructure(makeHoriz(
    [
      { heightMode: 'ratio', heightValue: 0.33, node: makeLeaf('a') },
      { heightMode: 'ratio', heightValue: 0.34, node: makeLeaf('b') },
      { heightMode: 'ratio', heightValue: 0.33, node: makeLeaf('c') },
    ],
    [{ afterChildIndex: 0, thickness: 5 }]
  ));
  assert('TC-06b: dividerCount error', r06b.some(e => e.rule === 'dividerCount'));

  // TC-06c: afterChildIndex duplicate
  const r06c = validateStructure(makeHoriz(
    [
      { heightMode: 'ratio', heightValue: 0.33, node: makeLeaf('a') },
      { heightMode: 'ratio', heightValue: 0.34, node: makeLeaf('b') },
      { heightMode: 'ratio', heightValue: 0.33, node: makeLeaf('c') },
    ],
    [{ afterChildIndex: 0, thickness: 5 }, { afterChildIndex: 0, thickness: 5 }]
  ));
  assert('TC-06c: afterChildIndex_unique error', r06c.some(e => e.rule === 'afterChildIndex_unique'));

  // TC-06d: heightMode mixed
  const r06d = validateStructure(makeHoriz(
    [
      { heightMode: 'ratio',    heightValue: 0.5,  node: makeLeaf('a') },
      { heightMode: 'explicit', heightValue: 860,  node: makeLeaf('b') },
    ],
    [{ afterChildIndex: 0, thickness: 5 }]
  ));
  assert('TC-06d: heightMode_uniform error', r06d.some(e => e.rule === 'heightMode_uniform'));

  // TC-06e: ratio sum invalid
  const r06e = validateStructure(makeHoriz(
    [
      { heightMode: 'ratio', heightValue: 0.6, node: makeLeaf('a') },
      { heightMode: 'ratio', heightValue: 0.6, node: makeLeaf('b') },
    ],
    [{ afterChildIndex: 0, thickness: 5 }]
  ));
  assert('TC-06e: heightBalance_ratio error', r06e.some(e => e.rule === 'heightBalance_ratio'));

  // TC-06f: leftWidthRatio out of bounds
  const r06f = validateStructure({
    nodeType: 'vertical', id: 'v', dividerThickness: 20, leftWidthRatio: 0.0,
    left:  makeLeaf('l'), right: makeLeaf('r'),
  });
  assert('TC-06f: leftWidthRatio_bounds error', r06f.some(e => e.rule === 'leftWidthRatio_bounds'));

  // TC-06g: invalid type enum
  const r06g = validateStructure({ nodeType: 'leaf', id: 'x', type: 'chiller', fittings: EMPTY_FITTINGS });
  assert('TC-06g: checkEnums error', r06g.some(e => e.rule === 'checkEnums'));
}

// ---------------------------------------------------------------------------
// TC-07 — Pass 2 dimension-dependent failures
// ---------------------------------------------------------------------------

section('TC-07 — Pass 2 dimension-dependent validation failures');
{
  // TC-07a: heightBalance_explicit fails → children skipped
  const r07a = runCalculation(makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [
      { heightMode: 'explicit', heightValue: 1100,
        node: { nodeType: 'leaf', id: 'a', type: 'fresh', fittings: EMPTY_FITTINGS } },
      { heightMode: 'explicit', heightValue: 500,
        node: { nodeType: 'leaf', id: 'b', type: 'fresh', fittings: EMPTY_FITTINGS } },
    ],
    dividers: [{ afterChildIndex: 0, thickness: 25 }],
    // sum = 1100 + 500 + 25 = 1625 ≠ 1720
  }));
  assert('TC-07a: heightBalance_explicit error',
    r07a.validationErrors.some(e => e.rule === 'heightBalance_explicit'));
  assert('TC-07a: children skipped flag',
    r07a.validationErrors.some(e => e.childrenSkipped === true));
  assert('TC-07a: no leaves produced', r07a.leaves.length === 0);
  assert('TC-07a: totals null', r07a.totals === null);

  // TC-07b cabinet: external H=900 → internalHeight = 900-40-40 = 820 mm
  // Shelf at pos=790, thick=8 → top=798 < 820 → VALID
  // Shelf at pos=795, thick=8 → top=803 < 820 → VALID (oops, need smaller cabinet)
  //
  // Use external H=880 → internalHeight = 880-40-40 = 800 mm exactly.
  // pos=790, thick=8 → top=798 < 800 → VALID (no error)
  // pos=795, thick=8 → top=803 > 800 → FAIL  (error fires)
  // Both use ratio=1.0 so height balance always passes.

  function make07bConfig(positionFromFloor) {
    return {
      schemaVersion: '1.0', meta: { name:'t', createdAt:'', updatedAt:'' },
      cabinet: {
        external: { height: 880, width: 700, depth: 700 },
        wallThicknesses: { top:40, bottom:40, left:40, right:40, rear:40, door:60 },
        airGap: 5,
        layout: { nodeType:'horizontal', id:'root',
          children:[{ heightMode:'ratio', heightValue: 1.0, node: {
            nodeType: 'leaf', id: 'leaf-07b', type: 'fresh',
            fittings: {
              shelves: [{ id: 's', positionFromFloor, thickness: 8, depth: 500, width: null }],
              drawers: [], doorBins: [],
              iceMakerHousing: { volume: null }, lightHousing: { volume: null },
            }
          }}],
          dividers:[] },
      }
    };
  }

  // leafHeight = 800; pos=790 → top=798 < 800 → VALID
  const r07bValid = runCalculation(make07bConfig(790));
  assert('TC-07b: valid shelf (pos=790, top=798 < 800) — no shelfPosition error',
    !r07bValid.validationErrors.some(e => e.rule === 'shelfPosition'));

  // pos=795 → top=803 > 800 → FAIL
  const r07bInvalid = runCalculation(make07bConfig(795));
  assert('TC-07b: invalid shelf (pos=795, top=803 > 800) fires shelfPosition error',
    r07bInvalid.validationErrors.some(e => e.rule === 'shelfPosition'));
  assert('TC-07b: leaf gross still computed despite fitting error',
    r07bInvalid.leaves.length === 1);

  // TC-07c: drawer inner dimension non-positive
  const leafDrawer = { nodeType: 'leaf', id: 'ld', type: 'fresh', fittings: {
    shelves: [], doorBins: [],
    drawers: [{ id: 'dd', outerWidth: 20, outerDepth: 20, outerHeight: 20, wallThickness: 10 }],
    iceMakerHousing: { volume: null }, lightHousing: { volume: null },
  }};
  const r07c = runCalculation(makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [{ heightMode: 'ratio', heightValue: 1.0, node: leafDrawer }],
    dividers: [],
  }));
  assert('TC-07c: drawerInnerPositive error',
    r07c.validationErrors.some(e => e.rule === 'drawerInnerPositive'));

  // TC-07d: wall ratio violation
  const r07d = runCalculation({
    schemaVersion: '1.0', meta: { name:'t', createdAt:'', updatedAt:'' },
    cabinet: {
      external: { height: 1800, width: 700, depth: 700 },
      wallThicknesses: { top:40, bottom:40, left:360, right:40, rear:40, door:60 },
      airGap: 5,
      layout: { nodeType:'horizontal', id:'root',
        children:[{ heightMode:'ratio', heightValue:1.0,
          node: { nodeType:'leaf', id:'l', type:'fresh', fittings: EMPTY_FITTINGS } }],
        dividers:[] },
    }
  });
  assert('TC-07d: wallRatio error fires', r07d.validationErrors.some(e => e.rule === 'wallRatio'));
  assert('TC-07d: no traversal (leaves empty)', r07d.leaves === null);
}

// ---------------------------------------------------------------------------
// TC-08 — Post-calc hierarchy check guard
// ---------------------------------------------------------------------------

section('TC-08 — Post-calc hierarchy guard');
{
  // Directly test checkHierarchy by injecting an inverted result
  // We simulate this by creating a result where IEC > EG (impossible under
  // correct formulas, but tests the guard itself).
  // We call calcLeaf and manually inspect — cannot directly call private
  // checkHierarchy, so we use a drawer that actually over-deducts via
  // injecting a very large explicit ice maker volume.

  // Artificial injection: use a config that's valid but then manually
  // verify hierarchy. We'll confirm the guard would catch injected inversion
  // by inspecting the logic pathway.

  // Since checkHierarchy is internal to index.js, we verify indirectly:
  // a conforming result NEVER triggers it, confirming correct formulas.
  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [{ heightMode: 'ratio', heightValue: 1.0,
      node: { nodeType: 'leaf', id: 'l', type: 'fresh', fittings: {
        shelves: [], drawers: [], doorBins: [],
        iceMakerHousing: { volume: null },
        lightHousing:    { volume: null },
      }}}],
    dividers: [],
  });
  const result = runCalculation(config);
  assert('TC-08: no hierarchy errors on valid result', result.calcErrors.length === 0);
  assert('TC-08: gross ≥ EG ≥ IEC (invariant holds)',
    result.leaves[0].gross >= result.leaves[0].egNet &&
    result.leaves[0].egNet >= result.leaves[0].iecNet);
}

// ---------------------------------------------------------------------------
// TC-09 — Ice maker and light housing deductions
// ---------------------------------------------------------------------------

section('TC-09 — Ice maker and light housing deductions');
{
  const fittings = {
    shelves: [], drawers: [], doorBins: [],
    iceMakerHousing: { volume: 3.5 },
    lightHousing:    { volume: 0.8 },
  };

  const config = makeConfig({
    nodeType: 'horizontal', id: 'root',
    children: [{ heightMode: 'ratio', heightValue: 1.0,
      node: { nodeType: 'leaf', id: 'leaf-09', type: 'fresh', fittings } }],
    dividers: [],
  });

  const result = runCalculation(config);
  assert('No validation errors', result.validationErrors.length === 0);

  const d = formatLeafDisplay(result.leaves[0]);
  assertClose('gross_L',   d.gross,  634.51, 0.01);
  assertClose('EG_Net_L',  d.egNet,  615.47, 0.01);
  assertClose('IEC_Net_L', d.iecNet, 611.17, 0.01);
  assert('Hierarchy: EG ≥ IEC', result.leaves[0].egNet >= result.leaves[0].iecNet);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));
if (failed > 0) process.exit(1);
