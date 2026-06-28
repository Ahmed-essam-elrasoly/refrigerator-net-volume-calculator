/**
 * @file src/io/io.js
 * I/O layer — JSON config save/load and CSV export.
 * No DOM dependencies. Works in browser (File API) and Node.js.
 */

import { formatLeafDisplay, formatTotalsDisplay, toCuft, roundForDisplay } from '../engine/calc.js';

const SCHEMA_VERSION = '2.0';
const ACCEPTED_VERSIONS = new Set(['1.0', '2.0']);

// ---------------------------------------------------------------------------
// JSON — Save
// ---------------------------------------------------------------------------

/**
 * Serialises a CabinetConfig to a JSON string ready for download.
 * Stamps updatedAt; preserves createdAt from original if present.
 *
 * @param {import('../engine/types').CabinetConfig} config
 * @param {string} [name] - optional label to set in meta.name
 * @returns {string} JSON string
 */
export function configToJSON(config, name) {
  const now = new Date().toISOString();
  const out = {
    ...config,
    schemaVersion: SCHEMA_VERSION,
    meta: {
      name:      name ?? config.meta?.name ?? 'Untitled',
      createdAt: config.meta?.createdAt ?? now,
      updatedAt: now,
    },
  };
  return JSON.stringify(out, null, 2);
}

/**
 * Triggers a browser file download of the config JSON.
 * No-op in Node.js environments.
 *
 * @param {import('../engine/types').CabinetConfig} config
 * @param {string} [filename]
 */
export function downloadConfigJSON(config, filename) {
  if (typeof document === 'undefined') return;
  const json = configToJSON(config);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename ?? `${config.meta?.name ?? 'config'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// JSON — Load
// ---------------------------------------------------------------------------

/**
 * Parses a JSON string into a CabinetConfig.
 * Validates schemaVersion. Throws on parse error or version mismatch.
 *
 * @param {string} jsonString
 * @returns {import('../engine/types').CabinetConfig}
 * @throws {Error}
 */
export function configFromJSON(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }

  if (!parsed.schemaVersion) {
    throw new Error('Missing schemaVersion in config file.');
  }
  if (!ACCEPTED_VERSIONS.has(parsed.schemaVersion)) {
    throw new Error(
      `Unsupported schema version v${parsed.schemaVersion}. ` +
      `Accepted: ${[...ACCEPTED_VERSIONS].join(', ')}.`
    );
  }
  if (!parsed.cabinet?.layout) {
    throw new Error('Config file is missing cabinet.layout.');
  }

  return parsed;
}

/**
 * Reads a File object and resolves with a parsed CabinetConfig.
 * Browser only.
 *
 * @param {File} file
 * @returns {Promise<import('../engine/types').CabinetConfig>}
 */
export function loadConfigFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      try { resolve(configFromJSON(e.target.result)); }
      catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// CSV — Export
// ---------------------------------------------------------------------------

/**
 * Builds a CSV string from a CalcResult.
 * Columns: Compartment, Type, Gross (L), EG Net (L), IEC Net (L),
 *          Gross (cu.ft), EG Net (cu.ft), IEC Net (cu.ft)
 * Final row: TOTAL.
 *
 * @param {import('../engine/types').CalcResult} result
 * @param {string} [configName]
 * @returns {string} CSV string
 */
export function resultToCSV(result, configName) {
  if (!result.leaves || !result.totals) {
    return '# No results available (calculation produced errors)\n';
  }

  const rows = [];

  // Header block
  rows.push(`# Refrigerator Net Storage Volume Calculator`);
  rows.push(`# Configuration: ${configName ?? 'Unnamed'}`);
  rows.push(`# Generated: ${new Date().toISOString()}`);
  rows.push('');

  // Column headers
  rows.push([
    'Compartment',
    'Type',
    'Gross (L)',
    'EG Net (L)',
    'IEC Net (L)',
    'Gross (cu.ft)',
    'EG Net (cu.ft)',
    'IEC Net (cu.ft)',
  ].join(','));

  // Per-leaf rows
  for (let i = 0; i < result.leaves.length; i++) {
    const leaf = result.leaves[i];
    const d    = formatLeafDisplay(leaf);
    rows.push([
      `Compartment ${i + 1}`,
      leaf.leafType,
      d.gross,
      d.egNet,
      d.iecNet,
      d.grossCuft,
      d.egNetCuft,
      d.iecNetCuft,
    ].join(','));
  }

  // Totals row
  const t = formatTotalsDisplay(result.totals);
  rows.push([
    'TOTAL',
    '',
    t.gross,
    t.egNet,
    t.iecNet,
    t.grossCuft,
    t.egNetCuft,
    t.iecNetCuft,
  ].join(','));

  // Warnings block
  if (result.warnings.length > 0) {
    rows.push('');
    rows.push('# Warnings');
    for (const w of result.warnings) {
      rows.push(`# [${w.rule}] ${w.message}`);
    }
  }

  return rows.join('\n');
}

/**
 * Triggers a browser file download of the results CSV.
 * No-op in Node.js environments.
 *
 * @param {import('../engine/types').CalcResult} result
 * @param {string} [configName]
 * @param {string} [filename]
 */
export function downloadResultsCSV(result, configName, filename) {
  if (typeof document === 'undefined') return;
  const csv  = resultToCSV(result, configName);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename ?? `${configName ?? 'results'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}