// HTTP outcome verification for the AfterGreen Action.
//
// Semantics are kept equivalent to the Go engine (github.com/foldnine/aftergreen,
// internal/httpcheck) and are checked against the shared conformance fixtures in
// test/conformance/http-cases.json.
//
//   VERIFIED  every assertion was observed to hold
//   FAILED    the response was observed and at least one assertion is false
//   UNKNOWN   the outcome could not be observed or trusted (network error,
//             timeout, truncated or oversized body)
//
// Invalid configuration throws ContractError and never produces a verdict.

export const MAX_BODY_BYTES = 1024 * 1024;
export const USER_AGENT = 'aftergreen-action';

export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractError';
  }
}

function strictInteger(raw, name, min, max) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw new ContractError(`${name} must be a whole number between ${min} and ${max}`);
  const value = Number(text);
  if (value < min || value > max) throw new ContractError(`${name} must be a whole number between ${min} and ${max}`);
  return value;
}

export function parseContract({ url, expectedStatus = '200', contains = '', timeoutSeconds = '10' }) {
  if (typeof url !== 'string' || !url.trim()) throw new ContractError('url is required');
  let target;
  try {
    target = new URL(url.trim());
  } catch {
    // Do not include the URL itself: it may carry a token in its query string.
    throw new ContractError('url must be an absolute http:// or https:// URL');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new ContractError('url must use http:// or https://');
  }
  if (!target.hostname) throw new ContractError('url must include a host');
  if (target.username || target.password) {
    throw new ContractError('url must not contain credentials; credentials in URLs leak into logs');
  }
  if (target.hash || url.includes('#')) throw new ContractError('url must not contain a #fragment; fragments are never sent to the server');
  if (typeof contains !== 'string') throw new ContractError('contains must be a string');
  return {
    url: target.toString(),
    expectedStatus: strictInteger(expectedStatus, 'expected-status', 100, 599),
    contains,
    timeoutMs: strictInteger(timeoutSeconds, 'timeout-seconds', 1, 60) * 1000
  };
}

class BodyTooLarge extends Error {}

async function readBoundedBody(body) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, total);
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new BodyTooLarge();
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function unknown(observedStatus, reason) {
  return { verdict: 'UNKNOWN', observedStatus, reasons: [reason] };
}

export async function verify(contract, fetchImpl = globalThis.fetch) {
  const signal = AbortSignal.timeout(contract.timeoutMs);
  let response;
  try {
    response = await fetchImpl(contract.url, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal,
      headers: { accept: '*/*', 'user-agent': USER_AGENT }
    });
  } catch {
    return unknown(null, signal.aborted ? 'HTTP observation timed out' : 'HTTP observation unavailable');
  }

  const observedStatus = response.status;
  const reasons = [];
  const statusMatches = observedStatus === contract.expectedStatus;
  if (!statusMatches) {
    reasons.push(`expected HTTP status ${contract.expectedStatus}, observed ${observedStatus}`);
  }

  if (contract.contains) {
    let body;
    try {
      body = await readBoundedBody(response.body);
    } catch (err) {
      // A false status assertion is already a definitive FAILED; an unreadable
      // body cannot turn it into UNKNOWN.
      if (!statusMatches) return { verdict: 'FAILED', observedStatus, reasons };
      if (err instanceof BodyTooLarge) return unknown(observedStatus, 'HTTP response body exceeds the 1 MiB verification limit');
      return unknown(observedStatus, signal.aborted ? 'HTTP response body read timed out' : 'HTTP response body unreadable');
    }
    if (body.indexOf(Buffer.from(contract.contains, 'utf8')) === -1) {
      reasons.push('response body did not contain the expected text');
    }
  } else {
    await response.body?.cancel().catch(() => {});
  }

  return { verdict: reasons.length ? 'FAILED' : 'VERIFIED', observedStatus, reasons };
}
