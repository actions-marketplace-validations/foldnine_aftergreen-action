// GitHub Action entrypoint. Dependency-free: only Node 24 built-ins are used.
import { ContractError, parseContract, verify } from './check.mjs';
import http from 'node:http';
import { annotate, input, setOutput, summary } from './workflow.mjs';

// Honor HTTP_PROXY / HTTPS_PROXY / NO_PROXY like the Go CLI does (self-hosted
// runners behind a proxy). Available from Node 24.14; older runtimes skip it.
if (typeof http.setGlobalProxyFromEnv === 'function') {
  try { http.setGlobalProxyFromEnv(); } catch { /* malformed proxy env: fall back to direct */ }
}

async function main() {
  let contract;
  try {
    contract = parseContract({
      url: input('url'),
      expectedStatus: input('expected-status', '200'),
      contains: input('contains'),
      timeoutSeconds: input('timeout-seconds', '10')
    });
  } catch (err) {
    // Invalid configuration is not a verification result: no verdict output is set.
    const message = err instanceof ContractError ? err.message : 'invalid inputs';
    annotate('error', `AfterGreen configuration invalid: ${message}`);
    summary(`### AfterGreen: configuration invalid\n\n${message}`);
    return 2;
  }

  const result = await verify(contract);
  setOutput('verdict', result.verdict);
  setOutput('observed-status', result.observedStatus ?? '');

  // Never print the URL, the response body or the expected text: any of them may be secret.
  console.log(`AfterGreen verdict: ${result.verdict}`);
  if (result.observedStatus !== null) console.log(`Observed HTTP status: ${result.observedStatus}`);
  for (const reason of result.reasons) console.log(`Reason: ${reason}`);
  summary([
    `### AfterGreen: ${result.verdict}`,
    '',
    `Observed HTTP status: ${result.observedStatus ?? 'none'}`,
    ...result.reasons.map(reason => `- ${reason}`)
  ].join('\n'));

  if (result.verdict === 'VERIFIED') return 0;
  annotate('error', result.verdict === 'FAILED'
    ? `AfterGreen FAILED: ${result.reasons.join('; ')}`
    : `AfterGreen UNKNOWN: outcome could not be verified (${result.reasons.join('; ')})`);
  return 1;
}

try {
  process.exitCode = await main();
} catch {
  setOutput('verdict', 'UNKNOWN');
  annotate('error', 'AfterGreen UNKNOWN: unexpected internal error');
  process.exitCode = 1;
}
