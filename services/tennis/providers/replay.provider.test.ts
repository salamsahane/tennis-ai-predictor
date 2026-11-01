import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReplayProvider } from './replay.provider';

const dir = path.join(__dirname, '__fixtures__', 'replays');

describe('replay provider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns snapshot at position', async () => {
    vi.setSystemTime(15000);
    const m = await createReplayProvider({ dir, epoch: 0 }).getMatch('demo-match');
    expect(m?.score.currentSet).toEqual({ home: 3, away: 2 });
    expect(m?.source.kind).toBe('replay');
    expect(m?.id).toBe('replay:demo-match');
  });

  it('wraps around', async () => {
    vi.setSystemTime(25000);
    const m = await createReplayProvider({ dir, epoch: 0 }).getMatch('demo-match');
    expect(m?.score.currentSet).toEqual({ home: 1, away: 0 });
  });

  it('forces live status', async () => {
    vi.setSystemTime(20000 + 1);
    const m = await createReplayProvider({ dir, epoch: 0 }).getMatch('demo-match');
    expect(m?.status).toBe('live');
  });

  it('speed multiplies position', async () => {
    vi.setSystemTime(6000);
    const m = await createReplayProvider({ dir, epoch: 0, speed: 2 }).getMatch('demo-match');
    expect(m?.score.currentSet).toEqual({ home: 3, away: 2 });
  });

  it('unknown id returns null', async () => {
    expect(await createReplayProvider({ dir }).getMatch('nope')).toBeNull();
  });

  it('lists every recording', async () => {
    vi.setSystemTime(15000);
    const list = await createReplayProvider({ dir, epoch: 0 }).listLiveMatches();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: 'replay:demo-match',
      status: 'live',
      surface: 'hard',
      home_player: 'Sinner, Jannik',
      score: '3-2 (Set 1)',
      source: { providerId: 'replay', kind: 'replay' },
    });
  });

  it('handles a missing dir', async () => {
    const p = createReplayProvider({ dir: path.join(dir, 'missing') });
    expect(await p.listLiveMatches()).toEqual([]);
    expect(await p.getMatch('demo-match')).toBeNull();
  });
});
