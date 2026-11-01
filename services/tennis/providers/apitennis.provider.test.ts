import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './__fixtures__/apitennis-livescore.json';

const get = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => new Map<string, string>());

vi.mock('axios', () => ({ default: { get } }));
vi.mock('@/lib/redis', () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v);
    },
  },
}));

import { apitennisProvider } from './apitennis.provider';
import { ProviderError } from './errors';

type Item = (typeof fixture.result)[number];
const base = fixture.result[0] as Item;
const drawBody = (surface: string) => ({
  data: { success: 1, result: { tournament: { tournament_surface: surface } } },
});

function route(match: unknown, draw: unknown = drawBody('Hard (Indoor)')) {
  get.mockImplementation(async (_url: string, cfg: { params: Record<string, string> }) =>
    cfg.params.method === 'get_draw' ? draw : match,
  );
}

function game(set: number, n: number, server: string, winner: string, scores: string[]) {
  return {
    set_number: `Set ${set}`,
    number_game: String(n),
    player_served: server,
    serve_winner: winner,
    points: scores.map((score, i) => ({ number_point: String(i + 1), score })),
  };
}

beforeEach(() => {
  get.mockReset();
  store.clear();
  process.env.APITENNIS_API_KEY = 'test-key';
});

describe('apitennisProvider', () => {
  it('maps fixture to MatchData', async () => {
    route({ data: fixture });
    const m = await apitennisProvider.getMatch('12176263');
    expect(m?.id).toBe('apitennis:12176263');
    expect(m?.status).toBe('live');
    expect(m?.players.home.name).toBe('J. Lehecka');
    expect(m?.players.away.name).toBe('V. Vacherot');
    expect(m?.score.sets).toEqual({ home: 1, away: 1 });
    expect(m?.score.periodScores).toHaveLength(3);
    expect(m?.score.periodScores[0]).toMatchObject({ home: 6, away: 2, number: 1, type: 'set' });
    expect(m?.score.currentSet).toEqual({ home: 3, away: 4 });
    expect(m?.score.currentGame).toEqual({ home: '0', away: '0', tieBreak: false });
    expect(m?.score.serving).toBe('away');
    expect(m?.nextGame.server).toBe('away');
    expect(m?.tournament).toBe('Basel');
    expect(m?.surface).toBe('indoor');
    expect(m?.source).toMatchObject({ providerId: 'apitennis', kind: 'live' });
    expect(m?.statistics.home).toMatchObject({
      aces: 11,
      doubleFaults: 1,
      firstServePercentage: 69,
      firstServePointsWon: 83,
      secondServePointsWon: 44,
      totalPointsWon: 76,
      gamesWon: 12,
    });
    expect(m?.statistics.home.secondServePercentage).toBeNull();
    expect(get.mock.calls[0][1].params).toMatchObject({
      method: 'get_livescore',
      APIkey: 'test-key',
      match_key: '12176263',
    });
  });

  it('unknown stat names -> null', async () => {
    const item = {
      ...base,
      statistics: [
        {
          player_key: base.first_player_key,
          stat_period: 'match',
          stat_type: 'X',
          stat_name: 'Mystery',
          stat_value: '9',
          stat_won: null,
          stat_total: null,
        },
      ],
      pointbypoint: [],
    };
    route({ data: { success: 1, result: [item] } });
    const m = await apitennisProvider.getMatch('1');
    expect(m?.statistics.home.aces).toBeNull();
    expect(m?.statistics.home.winners).toBeNull();
  });

  it('derives last-10 and game winners from pointbypoint', async () => {
    const item = {
      ...base,
      statistics: [],
      pointbypoint: [
        game(1, 1, 'First Player', 'First Player', ['15 - 0', '15 - 15', '30 - 15', '40 - 15']),
        game(1, 2, 'Second Player', 'First Player', ['0 - 15', '15 - 15', '15 - 30', '15 - 40']),
      ],
    };
    route({ data: { success: 1, result: [item] } });
    const m = await apitennisProvider.getMatch('1');
    expect(m?.gameWinners).toEqual([
      { set: 1, game: 1, winner: 'home' },
      { set: 1, game: 2, winner: 'home' },
    ]);
    // game 1: H A H H + final H = 4-1; game 2: A H A A + final H = 2-3
    expect(m?.statistics.home.totalPointsWon).toBe(6);
    expect(m?.statistics.away.totalPointsWon).toBe(4);
    expect(m?.statistics.home.serviceGamesWon).toBe(1);
    expect(m?.statistics.home.returnPointsWon).toBe(2);
    // last 10 points = all of them
    expect(m?.statistics.home.pointsWonLast10).toBe(6);
    expect(m?.statistics.away.pointsWonLast10).toBe(4);
  });

  it('credits advantage-to-deuce to the side without advantage', async () => {
    const item = {
      ...base,
      statistics: [],
      pointbypoint: [
        game(1, 1, 'First Player', 'First Player', [
          '15 - 0',
          '15 - 15',
          '15 - 30',
          '15 - 40',
          '30 - 40',
          '40 - 40',
          'A - 40',
          '40 - 40',
        ]),
      ],
    };
    route({ data: { success: 1, result: [item] } });
    const m = await apitennisProvider.getMatch('1');
    // H A A A H H H A + final H => home 5, away 4
    expect(m?.statistics.home.totalPointsWon).toBe(5);
    expect(m?.statistics.away.totalPointsWon).toBe(4);
    expect(m?.statistics.away.returnPointsWon).toBe(4);
    expect(m?.statistics.home.returnPointsWon).toBe(0);
  });

  it('success 0 body -> auth ProviderError', async () => {
    route({ data: { error: '1', result: [{ msg: 'Wrong login credentials', cod: 1004 }] } });
    await expect(apitennisProvider.getMatch('1')).rejects.toMatchObject({
      providerId: 'apitennis',
      kind: 'auth',
    });
  });

  it('HTTP 429 -> rate_limit', async () => {
    get.mockRejectedValue({ isAxiosError: true, response: { status: 429, headers: {} } });
    await expect(apitennisProvider.listLiveMatches()).rejects.toMatchObject({
      kind: 'rate_limit',
    });
  });

  it('empty result -> not_found', async () => {
    route({ data: { success: 1, result: [] } });
    await expect(apitennisProvider.getMatch('1')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('missing key -> auth without a request', async () => {
    delete process.env.APITENNIS_API_KEY;
    await expect(apitennisProvider.listLiveMatches()).rejects.toBeInstanceOf(ProviderError);
    await expect(apitennisProvider.getMatch('1')).rejects.toMatchObject({ kind: 'auth' });
    expect(get).not.toHaveBeenCalled();
  });

  it('tiebreak at 6-6', async () => {
    const item = {
      ...base,
      scores: [{ score_first: '6', score_second: '6', score_set: '1' }],
      event_game_result: '3 - 2',
    };
    route({ data: { success: 1, result: [item] } });
    const m = await apitennisProvider.getMatch('1');
    expect(m?.score.currentGame).toEqual({ home: '3', away: '2', tieBreak: true });
  });

  it('surface failure -> null; success is cached', async () => {
    get.mockImplementation(async (_u: string, cfg: { params: Record<string, string> }) => {
      if (cfg.params.method === 'get_draw') throw { isAxiosError: true };
      return { data: fixture };
    });
    expect((await apitennisProvider.getMatch('1'))?.surface).toBeNull();

    route({ data: fixture }, drawBody('Clay'));
    expect((await apitennisProvider.getMatch('1'))?.surface).toBe('clay');
    expect(store.get('apitennis:surface:1706')).toBe('clay');
  });

  it('lists live matches with namespaced ids', async () => {
    route({ data: fixture });
    const list = await apitennisProvider.listLiveMatches();
    expect(list[0]).toMatchObject({
      id: 'apitennis:12176263',
      status: 'live',
      tournament: 'Basel',
      home_player: 'J. Lehecka',
      score: '3-4 (Set 3)',
    });
    expect(list[0].source.providerId).toBe('apitennis');
  });
});
