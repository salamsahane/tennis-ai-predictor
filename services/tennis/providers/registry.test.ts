import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchData, MatchSearchResult } from '@/types/tennis.types';
import { ProviderError } from './errors';
import type { ProviderKind, TennisDataProvider } from './types';

vi.mock('./recorder', () => ({ recordSnapshot: vi.fn(async () => {}) }));
vi.mock('./sportradar.provider', () => ({
  sportradarProvider: {
    id: 'sportradar',
    label: 'Sportradar',
    kind: 'live',
    listLiveMatches: vi.fn(),
    getMatch: vi.fn(),
  },
}));

import * as health from './health';
import { recordSnapshot } from './recorder';
import { buildDefaultProviders, createRegistry, parseMatchId } from './registry';

let n = 0;

function fake(
  kind: ProviderKind,
  matches: MatchSearchResult[] = [],
): TennisDataProvider & {
  listLiveMatches: ReturnType<typeof vi.fn>;
  getMatch: ReturnType<typeof vi.fn>;
} {
  const id = `fake-${kind}-${n++}`;
  return {
    id,
    label: `Label ${id}`,
    kind,
    listLiveMatches: vi.fn(async () => matches),
    getMatch: vi.fn(async () => ({ id: 'x' }) as unknown as MatchData),
  };
}

const m = (id: string) => ({ id }) as unknown as MatchSearchResult;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('registry.listLiveMatches', () => {
  it('uses first healthy live provider', async () => {
    const a = fake('live');
    const b = fake('live', [m('b1')]);
    a.listLiveMatches.mockRejectedValue(new ProviderError(a.id, 'auth', 'bad', 401));
    const r = createRegistry([a, b]);
    const out = await r.listLiveMatches();
    expect(out.matches).toEqual([m('b1')]);
    expect(out.unavailableSources).toEqual([a.label]);
  });

  it('skips provider marked unhealthy without calling it', async () => {
    const a = fake('live');
    const b = fake('live', [m('b1')]);
    a.listLiveMatches.mockRejectedValue(new ProviderError(a.id, 'auth', 'bad', 401));
    const r = createRegistry([a, b]);
    await r.listLiveMatches();
    a.listLiveMatches.mockClear();
    const out = await r.listLiveMatches();
    expect(a.listLiveMatches).not.toHaveBeenCalled();
    expect(out.unavailableSources).toEqual([a.label]);
    expect(out.matches).toEqual([m('b1')]);
  });

  it('does not call later live providers after a success', async () => {
    const a = fake('live', [m('a1')]);
    const b = fake('live', [m('b1')]);
    const out = await createRegistry([a, b]).listLiveMatches();
    expect(out.matches).toEqual([m('a1')]);
    expect(b.listLiveMatches).not.toHaveBeenCalled();
  });

  it('replays always appended', async () => {
    const a = fake('live', [m('a1')]);
    const rp = fake('replay', [m('r1')]);
    const out = await createRegistry([a, rp]).listLiveMatches();
    expect(out.matches).toEqual([m('a1'), m('r1')]);
    expect(out.unavailableSources).toEqual([]);
  });

  it('all live down → replays + unavailable', async () => {
    const a = fake('live');
    const b = fake('live');
    a.listLiveMatches.mockRejectedValue(new ProviderError(a.id, 'transient', 'x'));
    b.listLiveMatches.mockRejectedValue(new Error('boom'));
    const rp = fake('replay', [m('r1')]);
    const out = await createRegistry([a, b, rp]).listLiveMatches();
    expect(out.matches).toEqual([m('r1')]);
    expect(out.unavailableSources).toEqual([a.label, b.label]);
  });

  it('a replay failure never throws', async () => {
    const rp = fake('replay');
    rp.listLiveMatches.mockRejectedValue(new Error('boom'));
    const out = await createRegistry([rp]).listLiveMatches();
    expect(out.matches).toEqual([]);
  });
});

describe('parseMatchId', () => {
  it('splits on first colon only', () => {
    expect(parseMatchId('sportradar:sr:sport_event:1')).toEqual({
      providerId: 'sportradar',
      nativeId: 'sr:sport_event:1',
    });
  });

  it('throws not_found for unknown provider', () => {
    expect(() => parseMatchId('nope:1')).toThrow(expect.objectContaining({ kind: 'not_found' }));
  });

  it('throws not_found without a colon', () => {
    expect(() => parseMatchId('bogus')).toThrow(ProviderError);
  });
});

describe('registry.getMatchById', () => {
  it('reports success and failure to health', async () => {
    const a = fake('live');
    const r = createRegistry([a]);
    const success = vi.spyOn(health, 'reportSuccess');
    const failure = vi.spyOn(health, 'reportFailure');
    await r.getMatchById(`${a.id}:1`);
    expect(success).toHaveBeenCalledWith(a.id);
    const err = new ProviderError(a.id, 'rate_limit', 'slow', 429, 1000);
    a.getMatch.mockRejectedValue(err);
    await expect(r.getMatchById(`${a.id}:1`)).rejects.toBe(err);
    expect(failure).toHaveBeenCalledWith(err);
  });

  it('records snapshot for live providers but not replay', async () => {
    const a = fake('live');
    const rp = fake('replay');
    const r = createRegistry([a, rp]);
    await r.getMatchById(`${a.id}:1`);
    expect(recordSnapshot).toHaveBeenCalledTimes(1);
    expect(recordSnapshot).toHaveBeenCalledWith(`${a.id}:1`, expect.anything());
    await r.getMatchById(`${rp.id}:1`);
    expect(recordSnapshot).toHaveBeenCalledTimes(1);
  });

  it('rethrows auth/rate_limit ProviderError', async () => {
    const a = fake('live');
    const err = new ProviderError(a.id, 'auth', 'bad', 401);
    a.getMatch.mockRejectedValue(err);
    await expect(createRegistry([a]).getMatchById(`${a.id}:1`)).rejects.toBe(err);
  });

  it('converts non-ProviderError to transient ProviderError', async () => {
    const a = fake('live');
    a.getMatch.mockRejectedValue(new Error('boom'));
    await expect(createRegistry([a]).getMatchById(`${a.id}:1`)).rejects.toMatchObject({
      kind: 'transient',
      providerId: a.id,
    });
  });

  it('returns null on not_found, unknown provider, or bad id', async () => {
    const a = fake('live');
    a.getMatch.mockRejectedValue(new ProviderError(a.id, 'not_found', 'nope', 404));
    const r = createRegistry([a]);
    expect(await r.getMatchById(`${a.id}:1`)).toBeNull();
    expect(await r.getMatchById('bogus')).toBeNull();
    expect(await r.getMatchById('nope:1')).toBeNull();
  });

  it('does not consult isHealthy', async () => {
    const a = fake('live');
    const spy = vi.spyOn(health, 'isHealthy');
    await createRegistry([a]).getMatchById(`${a.id}:1`);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('health failures are best-effort', () => {
  it('listLiveMatches survives isHealthy/reportFailure/reportSuccess rejecting', async () => {
    vi.spyOn(health, 'isHealthy').mockRejectedValue(new Error('redis down'));
    vi.spyOn(health, 'reportFailure').mockRejectedValue(new Error('redis down'));
    vi.spyOn(health, 'reportSuccess').mockRejectedValue(new Error('redis down'));
    const a = fake('live');
    const b = fake('live', [m('b1')]);
    const rp = fake('replay', [m('r1')]);
    a.listLiveMatches.mockRejectedValue(new ProviderError(a.id, 'auth', 'bad', 401));
    const out = await createRegistry([a, b, rp]).listLiveMatches();
    expect(a.listLiveMatches).toHaveBeenCalled();
    expect(out.matches).toEqual([m('b1'), m('r1')]);
    expect(out.unavailableSources).toEqual([a.label]);
  });

  it('getMatchById returns data when reportSuccess rejects', async () => {
    vi.spyOn(health, 'reportSuccess').mockRejectedValue(new Error('redis down'));
    const a = fake('live');
    expect(await createRegistry([a]).getMatchById(`${a.id}:1`)).toEqual({ id: 'x' });
  });

  it('getMatchById rethrows the original error when reportFailure rejects', async () => {
    vi.spyOn(health, 'reportFailure').mockRejectedValue(new Error('redis down'));
    const a = fake('live');
    const err = new ProviderError(a.id, 'auth', 'bad', 401);
    a.getMatch.mockRejectedValue(err);
    await expect(createRegistry([a]).getMatchById(`${a.id}:1`)).rejects.toBe(err);
  });
});

describe('buildDefaultProviders', () => {
  const saved = process.env.TENNIS_PROVIDERS;
  afterEach(() => {
    if (saved === undefined) delete process.env.TENNIS_PROVIDERS;
    else process.env.TENNIS_PROVIDERS = saved;
  });

  it('empty TENNIS_PROVIDERS falls back to the default order', () => {
    process.env.TENNIS_PROVIDERS = '';
    expect(buildDefaultProviders().map((p) => p.id)).toEqual(['sportradar', 'apitennis', 'replay']);
  });

  it('honours an explicit list', () => {
    process.env.TENNIS_PROVIDERS = 'replay, apitennis';
    expect(buildDefaultProviders().map((p) => p.id)).toEqual(['replay', 'apitennis']);
  });
});
