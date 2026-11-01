import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { MatchData } from '@/types/tennis.types';

vi.mock('@/services/tennis/providers/registry', () => ({ registry: { getMatchById: vi.fn() } }));
vi.mock('@/services/tennis/game-state.service', () => ({
  detectGameEnd: vi.fn(async () => false),
  getPollingInterval: vi.fn(() => 1000),
}));
vi.mock('@/services/ai/orchestrator', () => ({ runAllPredictions: vi.fn() }));

import { registry } from '@/services/tennis/providers/registry';
import { ProviderError } from '@/services/tennis/providers/errors';
import { GET } from './route';

const mockedGetMatchData = vi.mocked(registry.getMatchById);

function open() {
  const abort = new AbortController();
  const req = new NextRequest('http://localhost/api/stream/x', { signal: abort.signal });
  const res = GET(req, { params: Promise.resolve({ matchId: 'x' }) });
  return { abort, res };
}

async function readAll(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value);
  }
}

/** Let pending promise callbacks run without firing timers. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('GET /api/stream/[matchId]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedGetMatchData.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes once when match is final', async () => {
    mockedGetMatchData.mockResolvedValue({ status: 'final', score: {} } as MatchData);
    const { abort, res } = open();
    const text = await readAll((await res).body!);

    expect(text).toContain('event: match_ended');
    expect(vi.getTimerCount()).toBe(0);
    // A late client disconnect must not close the stream a second time.
    expect(() => abort.abort()).not.toThrow();
  });

  it('does not enqueue after abort mid-poll', async () => {
    let resolve!: (m: MatchData) => void;
    mockedGetMatchData.mockReturnValue(new Promise((r) => (resolve = r)));
    const { abort, res } = open();
    await res;
    await flush();

    abort.abort();
    resolve({ status: 'live', score: {} } as MatchData);
    await flush();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('body cancel without abort cleans up', async () => {
    mockedGetMatchData.mockReturnValue(new Promise(() => {}));
    const { res } = open();
    const body = (await res).body!;
    await flush();

    await body.getReader().cancel();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('abort clears heartbeat', async () => {
    mockedGetMatchData.mockReturnValue(new Promise(() => {}));
    const { abort, res } = open();
    await res;
    await flush();

    abort.abort();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('auth error sends source_unavailable and closes', async () => {
    mockedGetMatchData.mockRejectedValue(new ProviderError('apitennis', 'auth', 'bad key', 401));
    const { res } = open();
    const text = await readAll((await res).body!);

    expect(text).toContain('event: source_unavailable');
    expect(text).toContain('"providerId":"apitennis"');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('transient error keeps retrying', async () => {
    mockedGetMatchData.mockRejectedValue(new ProviderError('apitennis', 'transient', 'boom'));
    const { abort, res } = open();
    const reader = (await res).body!.getReader();
    await flush();

    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('Poll failed');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    abort.abort();
  });

  it('decodes the match id before lookup', async () => {
    mockedGetMatchData.mockResolvedValue({ status: 'final', score: {} } as MatchData);
    const abort = new AbortController();
    const req = new NextRequest('http://localhost/api/stream/x', { signal: abort.signal });
    const res = await GET(req, { params: Promise.resolve({ matchId: 'apitennis%3A123' }) });
    await readAll(res.body!);
    expect(mockedGetMatchData).toHaveBeenCalledWith('apitennis:123');
  });
});
