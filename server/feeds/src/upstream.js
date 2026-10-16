// What the news and the weather share when they ask a service outside: a request that gives up
// after a set time, a body read only up to a size that cannot cost the Worker its CPU, and a
// short one-line copy of whatever text came back, for an error message.

// An answer bigger than this is not what either service sends (GDELT's 25 articles are about
// 15 KB, MET's compact forecast about 40 KB); reading it would spend CPU on something else.
export const BODY_MAX = 2 * 1024 * 1024;

export class UpstreamError extends Error {
  constructor(message, retryAfterMs = 0) {
    super(message);
    this.name = 'UpstreamError';
    this.retryAfterMs = retryAfterMs;
  }
}

// `name` is the service as a person reads it (GDELT, MET Norway).
export async function upstreamGet(fetchFn, name, url, headers, timeoutMs) {
  try {
    return await fetchFn(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timedOut = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new UpstreamError(
      timedOut ? `${name} did not answer within ${Math.round(timeoutMs / 1000)} s` : `${name} could not be reached`,
    );
  }
}

export async function readBody(res, name) {
  const length = Number(res.headers.get('Content-Length'));
  if (length > BODY_MAX) throw new UpstreamError(`${name} answered with ${length} bytes, more than is read`);
  const text = await res.text();
  if (text.length > BODY_MAX) throw new UpstreamError(`${name} answered with more than is read`);
  return text;
}

// Retry-After as seconds or an HTTP date, in milliseconds from now; 0 when absent or unreadable.
export function retryAfterMs(value, nowMs) {
  if (!value) return 0;
  const s = Number(value);
  if (Number.isFinite(s) && s >= 0) return s * 1000;
  const at = Date.parse(value);
  return Number.isFinite(at) && at > nowMs ? at - nowMs : 0;
}

export function oneLine(text, max = 120) {
  const s = String(text).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export const iso = (ms) => new Date(ms).toISOString();
