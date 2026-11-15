// Minimal GitHub Actions runner protocol helpers (no @actions/core dependency).
import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// The runner exposes `with:` inputs as INPUT_<NAME> with the name upper-cased and
// spaces replaced by underscores; hyphens are kept (e.g. INPUT_EXPECTED-STATUS).
export function input(name, fallback = '') {
  const value = process.env['INPUT_' + name.replace(/ /g, '_').toUpperCase()];
  return value === undefined || value === '' ? fallback : value;
}

// Workflow command data must escape %, CR and LF or the runner mis-parses it.
export function escapeCommandData(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

export function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const delimiter = `aftergreen_${randomUUID()}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

export function annotate(level, message) {
  console.log(`::${level}::${escapeCommandData(message)}`);
}

export function summary(markdown) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, markdown + '\n');
}
