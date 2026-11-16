// Runs the shared, language-neutral conformance cases (copied from
// foldnine/aftergreen conformance/http/cases.json; see test/conformance/SOURCE)
// against this Action's HTTP engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ContractError, parseContract, verify } from '../src/check.mjs';
import { serveCase, unreachableBase } from './fixture-http.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./conformance/http-cases.json', import.meta.url), 'utf8'));
assert.equal(fixtures.schema_version, 1);

for (const tc of fixtures.cases) {
  test(`conformance: ${tc.name}`, async () => {
    const app = tc.server ? await serveCase(tc.server) : null;
    try {
      let url = tc.url ?? '{base}/check';
      url = url.replace('{base}', app?.base ?? '').replace('{unreachable}', await unreachableBase());
      let contract;
      try {
        contract = parseContract({
          url,
          expectedStatus: String(tc.contract.expected_status),
          contains: tc.contract.contains ?? '',
          timeoutSeconds: String(tc.contract.timeout_seconds)
        });
      } catch (err) {
        assert.ok(err instanceof ContractError, `unexpected error type: ${err}`);
        assert.equal(tc.want.verdict, 'INVALID', `contract rejected: ${err.message}`);
        return;
      }
      assert.notEqual(tc.want.verdict, 'INVALID', 'invalid contract was accepted');
      const result = await verify(contract);
      assert.equal(result.verdict, tc.want.verdict, JSON.stringify(result));
      if ('observed_status' in tc.want) assert.equal(result.observedStatus, tc.want.observed_status);
      if (result.verdict !== 'VERIFIED') assert.ok(result.reasons.length > 0, 'non-verified result needs a reason');
      if (tc.want.redirect_target_requested === false) assert.deepEqual(app.requests, ['/check']);
    } finally {
      await app?.close();
    }
  });
}
