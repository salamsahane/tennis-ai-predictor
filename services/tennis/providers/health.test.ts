import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from './errors';
import { isHealthy, reportFailure, reportSuccess } from './health';

const T0 = new Date('2026-01-01T00:00:00Z').getTime();
let n = 0;
let id: string;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  id = `test-provider-${n++}`;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('provider health', () => {
  it('is healthy by default', async () => {
    expect(await isHealthy(id)).toBe(true);
  });

  it('auth -> unhealthy for 1h then healthy', async () => {
    await reportFailure(new ProviderError(id, 'auth', 'bad key', 401));
    vi.setSystemTime(T0 + 3_599_999);
    expect(await isHealthy(id)).toBe(false);
    vi.setSystemTime(T0 + 3_600_001);
    expect(await isHealthy(id)).toBe(true);
  });

  it('rate_limit uses retryAfterMs', async () => {
    await reportFailure(new ProviderError(id, 'rate_limit', 'slow', 429, 30_000));
    vi.setSystemTime(T0 + 29_999);
    expect(await isHealthy(id)).toBe(false);
    vi.setSystemTime(T0 + 30_001);
    expect(await isHealthy(id)).toBe(true);
  });

  it('rate_limit default 60s', async () => {
    await reportFailure(new ProviderError(id, 'rate_limit', 'slow', 429));
    vi.setSystemTime(T0 + 59_999);
    expect(await isHealthy(id)).toBe(false);
    vi.setSystemTime(T0 + 60_001);
    expect(await isHealthy(id)).toBe(true);
  });

  it('transient needs 3 consecutive failures', async () => {
    const err = () => new ProviderError(id, 'transient', 'boom', 500);
    await reportFailure(err());
    await reportFailure(err());
    expect(await isHealthy(id)).toBe(true);
    await reportFailure(err());
    expect(await isHealthy(id)).toBe(false);
    vi.setSystemTime(T0 + 15_001);
    expect(await isHealthy(id)).toBe(true);
  });

  it('success resets transient counter', async () => {
    const err = () => new ProviderError(id, 'transient', 'boom', 500);
    await reportFailure(err());
    await reportFailure(err());
    await reportSuccess(id);
    await reportFailure(err());
    await reportFailure(err());
    expect(await isHealthy(id)).toBe(true);
  });

  it('not_found does not affect health', async () => {
    await reportFailure(new ProviderError(id, 'not_found', 'nope', 404));
    expect(await isHealthy(id)).toBe(true);
  });
});
