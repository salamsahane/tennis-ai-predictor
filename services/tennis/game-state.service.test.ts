import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchData } from '@/types/tennis.types';

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('@/lib/redis', () => ({
  redis: {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string | number) => {
      store.set(k, String(v));
    },
  },
}));

import { detectGameEnd } from './game-state.service';

function withGames(home: number, away: number): MatchData {
  return {
    score: { periodScores: [{ home, away, type: 'set', number: 1 }] },
  } as unknown as MatchData;
}

beforeEach(() => store.clear());

describe('detectGameEnd', () => {
  it('first poll is not a game end', async () => {
    expect(await detectGameEnd(withGames(1, 1), 'm')).toBe(false);
  });

  it('an increase in total games is a game end', async () => {
    await detectGameEnd(withGames(1, 1), 'm');
    expect(await detectGameEnd(withGames(2, 1), 'm')).toBe(true);
    expect(await detectGameEnd(withGames(2, 1), 'm')).toBe(false);
  });

  it('a decrease (replay wrap) is not a game end but resets the count', async () => {
    await detectGameEnd(withGames(6, 5), 'm');
    expect(await detectGameEnd(withGames(0, 0), 'm')).toBe(false);
    expect(store.get('match:m:lastGamesCount')).toBe('0');
    expect(await detectGameEnd(withGames(1, 0), 'm')).toBe(true);
  });
});
