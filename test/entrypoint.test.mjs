// End-to-end: runs src/index.mjs as a child process with the environment the
// GitHub runner provides (INPUT_* variables with hyphens, GITHUB_OUTPUT files).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveCase, unreachableBase } from './fixture-http.mjs';

const entry = fileURLToPath(new URL('../src/index.mjs', import.meta.url));

function parseOutputs(text) {
  const out = {};
  const re = /^([\w-]+)<<(\S+)\n([\s\S]*?)\n\2$/gm;
  for (const m of text.matchAll(re)) out[m[1]] = m[3];
  return out;
}

async function runAction(inputs) {
  const dir = mkdtempSync(join(tmpdir(), 'aftergreen-'));
  const outputFile = join(dir, 'output'), summaryFile = join(dir, 'summary');
  writeFileSync(outputFile, ''); writeFileSync(summaryFile, '');
  const env = { PATH: process.env.PATH, GITHUB_OUTPUT: outputFile, GITHUB_STEP_SUMMARY: summaryFile };
  for (const [k, v] of Object.entries(inputs)) env['INPUT_' + k.toUpperCase()] = v;
  const child = spawn(process.execPath, [entry], { env });
  let stdout = '', stderr = '';
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });
  const code = await new Promise(resolve => child.on('close', resolve));
  return { code, stdout, stderr, outputs: parseOutputs(readFileSync(outputFile, 'utf8')), summary: readFileSync(summaryFile, 'utf8') };
}

test('VERIFIED exits 0 and sets outputs (hyphenated inputs)', async () => {
  const app = await serveCase({ status: 201, body: 'build=7f3a secret-token-xyz' });
  try {
    const r = await runAction({ url: `${app.base}/version?token=s3cr3t`, 'expected-status': '201', contains: '7f3a', 'timeout-seconds': '5' });
    assert.equal(r.code, 0, r.stdout + r.stderr);
    assert.deepEqual(r.outputs, { verdict: 'VERIFIED', 'observed-status': '201' });
    for (const leak of ['s3cr3t', 'secret-token-xyz', '7f3a', app.base]) assert.ok(!(r.stdout + r.stderr + r.summary).includes(leak), leak);
  } finally { await app.close(); }
});

test('FAILED fails the step with an error annotation', async () => {
  const app = await serveCase({ status: 200, body: 'build=old' });
  try {
    const r = await runAction({ url: app.base, contains: 'build=new' });
    assert.equal(r.code, 1);
    assert.deepEqual(r.outputs, { verdict: 'FAILED', 'observed-status': '200' });
    assert.match(r.stdout, /^::error::AfterGreen FAILED: response body did not contain the expected text$/m);
    assert.ok(!r.stdout.includes('build=new'));
  } finally { await app.close(); }
});

test('UNKNOWN fails the step and leaves observed-status empty', async () => {
  const r = await runAction({ url: await unreachableBase(), 'timeout-seconds': '2' });
  assert.equal(r.code, 1);
  assert.deepEqual(r.outputs, { verdict: 'UNKNOWN', 'observed-status': '' });
  assert.match(r.stdout, /^::error::AfterGreen UNKNOWN: /m);
});

test('invalid configuration fails without a verdict and without echoing the URL', async () => {
  const r = await runAction({ url: 'https://user:hunter2@deploy.example.invalid/', 'expected-status': '200' });
  assert.equal(r.code, 2);
  assert.deepEqual(r.outputs, {});
  assert.match(r.stdout, /^::error::AfterGreen configuration invalid: url must not contain credentials/m);
  assert.ok(!(r.stdout + r.stderr + r.summary).includes('hunter2'));
});

test('missing url is a configuration error', async () => {
  const r = await runAction({});
  assert.equal(r.code, 2);
  assert.match(r.stdout, /configuration invalid: url is required/);
});
