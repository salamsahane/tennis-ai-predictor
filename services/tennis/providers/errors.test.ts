import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, logProviderError, toProviderError } from './errors';

function axiosErr(
  status?: number,
  headers: Record<string, string> = {},
  extra: Record<string, unknown> = {},
) {
  return {
    isAxiosError: true,
    message: 'Request failed',
    response: status === undefined ? undefined : { status, headers },
    ...extra,
  };
}

describe('toProviderError', () => {
  it.each([401, 403])('classifies %i as auth', (status) => {
    const e = toProviderError('p', axiosErr(status));
    expect(e.kind).toBe('auth');
    expect(e.status).toBe(status);
    expect(e.providerId).toBe('p');
  });

  it('classifies 429 with Retry-After as rate_limit', () => {
    const e = toProviderError('p', axiosErr(429, { 'retry-after': '30' }));
    expect(e.kind).toBe('rate_limit');
    expect(e.retryAfterMs).toBe(30000);
  });

  it('classifies 500 as transient', () => {
    expect(toProviderError('p', axiosErr(500)).kind).toBe('transient');
  });

  it('classifies a missing response (ECONNABORTED) as transient', () => {
    expect(toProviderError('p', axiosErr(undefined)).kind).toBe('transient');
  });

  it('classifies 404 as not_found', () => {
    expect(toProviderError('p', axiosErr(404)).kind).toBe('not_found');
  });

  it('classifies non-axios errors as transient', () => {
    expect(toProviderError('p', new Error('boom')).kind).toBe('transient');
    expect(toProviderError('p', 'weird').kind).toBe('transient');
  });

  it('passes ProviderError through unchanged', () => {
    const original = new ProviderError('p', 'auth', 'x', 401);
    expect(toProviderError('other', original)).toBe(original);
  });
});

describe('logProviderError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never prints the api key', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = axiosErr(500, {}, { config: { url: 'https://x/y?APIkey=SECRET' } });
    logProviderError(toProviderError('p', err));
    expect(spy).toHaveBeenCalled();
    const printed = spy.mock.calls.map((c) => JSON.stringify(c)).join('');
    expect(printed).not.toContain('SECRET');
  });
});
