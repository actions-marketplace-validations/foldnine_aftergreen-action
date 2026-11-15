const MAX_BYTES = 1024 * 1024;

export function parseContract({ url, expectedStatus = '200', contains = '', timeoutSeconds = '10' }) {
  if (typeof url !== 'string' || !url.trim()) throw new Error('url is required');
  let target;
  try { target = new URL(url); } catch { throw new Error('url must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(target.protocol) || !target.hostname ||
      target.username || target.password || target.hash) {
    throw new Error('url must be HTTP(S), with a hostname and without credentials or fragments');
  }
  const status = Number(expectedStatus);
  if (!/^\d{3}$/.test(String(expectedStatus)) || !Number.isInteger(status) || status < 100 || status > 599) {
    throw new Error('expected-status must be an integer between 100 and 599');
  }
  const timeout = Number(timeoutSeconds);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 60) {
    throw new Error('timeout-seconds must be an integer between 1 and 60');
  }
  if (typeof contains !== 'string') throw new Error('contains must be a string');
  return { url: target.toString(), expectedStatus: status, contains, timeoutMs: timeout * 1000 };
}

async function readBoundedBody(stream) {
  if (!stream) return '';
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('response exceeds 1 MiB verification limit');
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function verify(contract, fetchImpl = globalThis.fetch) {
  let response;
  try {
    response = await fetchImpl(contract.url, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      signal: AbortSignal.timeout(contract.timeoutMs),
      headers: { 'accept': '*/*' }
    });
  } catch {
    return { verdict: 'UNKNOWN', observedStatus: null, reasons: ['HTTP observation unavailable'] };
  }

  const reasons = [];
  if (response.status !== contract.expectedStatus) {
    reasons.push(`Expected HTTP ${contract.expectedStatus}, observed ${response.status}`);
  }
  if (contract.contains) {
    try {
      const text = await readBoundedBody(response.body);
      if (!text.includes(contract.contains)) reasons.push('Response body did not contain required text');
    } catch {
      return { verdict: 'UNKNOWN', observedStatus: response.status, reasons: ['HTTP body observation unavailable or too large'] };
    }
  } else {
    await response.body?.cancel().catch(() => {});
  }
  return {
    verdict: reasons.length ? 'FAILED' : 'VERIFIED',
    observedStatus: response.status,
    reasons
  };
}
