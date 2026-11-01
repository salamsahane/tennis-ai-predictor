import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/sportradar-summary.json';

const get = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => new Map<string, string>());

vi.mock('axios', () => ({
  default: { create: () => ({ get }) },
}));
vi.mock('@/lib/redis', () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v);
    },
  },
}));

import { sportradarProvider } from './sportradar.provider';
import { ProviderError } from './errors';

beforeEach(() => {
  get.mockReset();
  store.clear();
});

describe('sportradarProvider', () => {
  it('maps fixture to MatchData', async () => {
    get.mockResolvedValue({ data: fixture });
    const m = await sportradarProvider.getMatch('123');
    expect(m?.id).toBe('sportradar:123');
    expect(m?.players.home.name).toBe('Alcaraz, Carlos');
    expect(m?.players.away.name).toBe('Sinner, Jannik');
    expect(m?.score.periodScores).toHaveLength(2);
    expect(m?.score.periodScores[0]).toMatchObject({ home: 6, away: 4 });
    expect(m?.score.serving).toBe('away');
    expect(m?.source.providerId).toBe('sportradar');
  });

  it('getMatch prefixes sr:sport_event', async () => {
    get.mockResolvedValue({ data: fixture });
    await sportradarProvider.getMatch('123');
    expect(get.mock.calls[0][0]).toContain('sr:sport_event:123');
  });

  it('403 throws auth ProviderError', async () => {
    get.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    const err = await sportradarProvider.getMatch('123').catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe('auth');
  });

  it('listLiveMatches ids are namespaced', async () => {
    get.mockResolvedValue({ data: { summaries: [fixture] } });
    const list = await sportradarProvider.listLiveMatches();
    expect(list).toHaveLength(1);
    expect(list[0].id).toMatch(/^sportradar:\d+$/);
    expect(list[0].source?.providerId).toBe('sportradar');
    expect(list[0].score).toBe('2-3 (Set 2)');
  });
});
