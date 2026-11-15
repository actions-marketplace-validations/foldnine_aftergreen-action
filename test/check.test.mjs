import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { parseContract, verify } from '../src/check.mjs';

async function server(handler) {
  const app = createServer(handler);
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return { url: `http://127.0.0.1:${app.address().port}`, close: () => new Promise(resolve => app.close(resolve)) };
}
const contract = (url, options = {}) => parseContract({ url, ...options });

test('verifies matching status and body', async () => {
  const app = await server((req, res) => { res.writeHead(200); res.end('version=abc123'); });
  try {
    assert.equal((await verify(contract(app.url, { contains: 'abc123' }))).verdict, 'VERIFIED');
    assert.equal((await verify(contract(app.url, { contains: 'xyz' }))).verdict, 'FAILED');
    assert.equal((await verify(contract(app.url, { expectedStatus: '201' }))).verdict, 'FAILED');
  } finally { await app.close(); }
});
test('does not follow redirect to another endpoint', async () => {
  let targetReached = false;
  const target = await server((_req, res) => { targetReached = true; res.end('secret'); });
  const redirect = await server((_req, res) => { res.writeHead(302, { location: target.url }); res.end(); });
  try {
    const result = await verify(contract(redirect.url));
    assert.equal(result.verdict, 'FAILED');
    assert.equal(result.observedStatus, 302);
    assert.equal(targetReached, false);
  } finally { await redirect.close(); await target.close(); }
});
test('reports unknown on unavailable network', async () => {
  const result = await verify(contract('http://localhost.test.invalid'), async () => { throw Error('offline'); });
  assert.equal(result.verdict, 'UNKNOWN');
});
test('reports unknown on oversized body', async () => {
  const app = await server((_req, res) => { res.writeHead(200); res.end('X'.repeat(1024 * 1024 + 1)); });
  try {
    const result = await verify(contract(app.url, { contains: 'HEALTHY' }));
    assert.equal(result.verdict, 'UNKNOWN');
  } finally { await app.close(); }
});
test('validates contract without echoing secrets', () => {
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com', 'http://', 'https://example.com/path#fragment']) {
    assert.throws(() => contract(url));
  }
  for (const expectedStatus of ['0', '600', 'abc', '200.5']) assert.throws(() => contract('https://example.com', { expectedStatus }));
  for (const timeoutSeconds of ['0', '61', '1.5']) assert.throws(() => contract('https://example.com', { timeoutSeconds }));
});
