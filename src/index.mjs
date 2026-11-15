import { appendFileSync } from 'node:fs';
import { parseContract, verify } from './check.mjs';

function input(name, fallback = '') {
  return process.env['INPUT_' + name.toUpperCase()] ??
         process.env['INPUT_' + name.toUpperCase().replaceAll('-', '_')] ??
         fallback;
}
function output(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${String(value)}\n`);
}
function error(message) {
  // Do not echo the requested URL, response body, or expected substring.
  console.error('::error::' + String(message).replace(/[\r\n]/g, ' '));
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
    output('verdict', 'UNKNOWN');
    error('Invalid AfterGreen configuration: ' + err.message);
    process.exitCode = 2;
    return;
  }
  const result = await verify(contract);
  output('verdict', result.verdict);
  output('observed-status', result.observedStatus ?? '');
  const icon = result.verdict === 'VERIFIED' ? '✓' : '✗';
  console.log(`AfterGreen ${icon} ${result.verdict}`);
  if (result.observedStatus !== null) console.log(`Observed HTTP status: ${result.observedStatus}`);
  for (const reason of result.reasons) console.log(`Reason: ${reason}`);
  if (result.verdict !== 'VERIFIED') {
    error(result.verdict === 'UNKNOWN' ? 'Outcome could not be verified' : 'Outcome assertion failed');
    process.exitCode = 1;
  }
}
await main().catch(() => {
  output('verdict', 'UNKNOWN');
  error('Unexpected verification error');
  process.exitCode = 1;
});
