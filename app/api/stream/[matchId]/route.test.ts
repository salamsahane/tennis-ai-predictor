import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { MatchData } from '@/types/tennis.types';

vi.mock('@/services/tennis/match.service', () => ({ getMatchData: vi.fn() }));
vi.mock('@/services/tennis/game-state.service', () => ({
  detectGameEnd: vi.fn(async () => false),
  getPollingInterval: vi.fn(() => 1000),
}));
vi.mock('@/services/ai/orchestrator', () => ({ runAllPredictions: vi.fn() }));

import { getMatchData } from '@/services/tennis/match.service';
import { GET } from './route';

const mockedGetMatchData = vi.mocked(getMatchData);

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

  it('abort clears heartbeat', async () => {
    mockedGetMatchData.mockReturnValue(new Promise(() => {}));
    const { abort, res } = open();
    await res;
    await flush();

    abort.abort();
    expect(vi.getTimerCount()).toBe(0);
  });
});
