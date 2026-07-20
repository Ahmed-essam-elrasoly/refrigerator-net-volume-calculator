/**
 * @file js/io/io.js
 * I/O layer — JSON config save/load and CSV export.
 * No DOM dependencies for core parsing. Works in browser (File API) and Node.js.
 */

import { toCuft, roundForDisplay, formatLeafDisplay, formatTotalsDisplay } from '../engine/calc.js';

const SCHEMA_VERSION = '2.0';
const ACCEPTED_VERSIONS = new Set(['1.0', '2.0']);

// ---------------------------------------------------------------------------
// JSON — Save
// ---------------------------------------------------------------------------

/**
 * Serializes the application configuration into a formatted JSON string.
 * Automatically injects schema version and metadata (timestamps).
 * 
 * @param {Object} config - The full application configuration state.
 * @param {string} [name] - Optional name for the configuration.
 * @returns {string} Pretty-printed JSON string.
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
 * Triggers a browser download of the configuration JSON.
 * 
 * @param {Object} config - The configuration state to save.
 * @param {string} [filename] - Optional custom filename.
 */
export function downloadConfigJSON(config, filename) {
  if (typeof document === 'undefined') return; // Guard for non-browser environments
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
 * Parses and validates a JSON string into a configuration object.
 * Checks for supported schema versions and structural integrity.
 * 
 * @param {string} jsonString - The raw JSON file contents.
 * @returns {Object} The validated configuration object.
 * @throws {Error} If JSON is invalid, schema is unsupported, or critical data is missing.
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
 * Reads a File object (from an input element) and parses its JSON configuration.
 * 
 * @param {File} file - The uploaded File object.
 * @returns {Promise<Object>} Resolves with the parsed configuration.
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
 * Converts volumetric calculation results into a CSV formatted string.
 * Includes per-compartment gross volumes, totals, and any engine warnings.
 * 
 * @param {import('../engine/types').CalcResult} result - The engine output.
 * @param {string} [configName] - Name of the configuration for the header.
 * @returns {string} The CSV formatted data.
 */
export function resultToCSV(result, configName) {
  if (!result.leaves || !result.totals) {
    return '# No results available (calculation produced errors)\n';
  }

  const rows = [];
  rows.push(`# Refrigerator Net Storage Volume Calculator`);
  rows.push(`# Configuration: ${configName ?? 'Unnamed'}`);
  rows.push(`# Generated: ${new Date().toISOString()}`);
  rows.push('');

  // Column headers – only gross volumes
  rows.push([
    'Compartment',
    'Gross (L)',
    'Gross (cu.ft)',
  ].join(','));

  // Per‑leaf rows
  for (let i = 0; i < result.leaves.length; i++) {
    const leaf = result.leaves[i];
    const d    = formatLeafDisplay(leaf);
    rows.push([
      `Compartment ${i + 1}`,
      d.gross,
      d.grossCuft,
    ].join(','));
  }

  // Totals row
  const t = formatTotalsDisplay(result.totals);
  rows.push([
    'TOTAL',
    t.gross,
    t.grossCuft,
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
 * Triggers a browser download of the results CSV.
 * 
 * @param {import('../engine/types').CalcResult} result - The engine output.
 * @param {string} [configName] - Name of the configuration.
 * @param {string} [filename] - Optional custom filename.
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