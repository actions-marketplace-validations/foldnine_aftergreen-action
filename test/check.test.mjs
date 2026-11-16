import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractError, parseContract, verify } from '../src/check.mjs';
import { escapeCommandData } from '../src/workflow.mjs';

const ok = { url: 'https://deploy.example.invalid/version' };

test('accepts a minimal contract with defaults', () => {
  assert.deepEqual(parseContract(ok), {
    url: 'https://deploy.example.invalid/version', expectedStatus: 200, contains: '', timeoutMs: 10000
  });
});

test('trims numeric inputs and URL but keeps contains literal', () => {
  const c = parseContract({ url: '  https://deploy.example.invalid/v \n', expectedStatus: ' 204 ', timeoutSeconds: '5\n', contains: ' a ' });
  assert.equal(c.url, 'https://deploy.example.invalid/v');
  assert.equal(c.expectedStatus, 204);
  assert.equal(c.timeoutMs, 5000);
  assert.equal(c.contains, ' a ');
});

test('rejects malformed numeric inputs', () => {
  for (const expectedStatus of ['', 'abc', '200.5', '-200', '2e2', '0x0C8', '99', '600'])
    assert.throws(() => parseContract({ ...ok, expectedStatus }), ContractError, expectedStatus);
  for (const timeoutSeconds of ['0', '61', '1.5', '10s', '-1', 'NaN'])
    assert.throws(() => parseContract({ ...ok, timeoutSeconds }), ContractError, timeoutSeconds);
});

test('rejects unsafe URLs without echoing them', () => {
  for (const url of ['', '   ', 'not a url', 'javascript:alert(1)', 'https://:tok@deploy.example.invalid/']) {
    assert.throws(() => parseContract({ url }), err => {
      assert.ok(err instanceof ContractError);
      assert.ok(!err.message.includes('tok'), err.message);
      return true;
    });
  }
});

test('transport failure is UNKNOWN with no observed status', async () => {
  const result = await verify(parseContract(ok), async () => { throw new TypeError('fetch failed'); });
  assert.deepEqual(result, { verdict: 'UNKNOWN', observedStatus: null, reasons: ['HTTP observation unavailable'] });
});

test('sends no credentials and does not follow redirects', async () => {
  let seen;
  await verify(parseContract(ok), async (_url, init) => { seen = init; return new Response('', { status: 200 }); });
  assert.equal(seen.redirect, 'manual');
  assert.equal(seen.credentials, 'omit');
  assert.equal(seen.method, 'GET');
  assert.equal(seen.headers['user-agent'], 'aftergreen-action');
});

test('escapes workflow command data', () => {
  assert.equal(escapeCommandData('50%\r\n::warning::x'), '50%25%0D%0A::warning::x');
});
