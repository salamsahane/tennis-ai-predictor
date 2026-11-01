import { describe, expect, it } from 'vitest';
import { deriveStats, gameWinners, type GameRecord } from './derive-stats';

const H = 'home' as const;
const A = 'away' as const;

function g(
  server: 'home' | 'away',
  winner: 'home' | 'away',
  pointWinners: Array<'home' | 'away'>,
  set = 1,
  game = 1,
): GameRecord {
  return { set, game, server, winner, pointWinners };
}

describe('deriveStats', () => {
  it('counts last 10 across games', () => {
    const games = [g(H, H, [H, H, H, H]), g(A, A, [A, A, A, A], 1, 2), g(H, H, [H, A, H, H], 1, 3)];
    const s = deriveStats(games);
    // last 10: last two points of game1 (H,H), game2 (A x4), game3 (H,A,H,H)
    expect(s.home.pointsWonLast10).toBe(5);
    expect(s.away.pointsWonLast10).toBe(5);
    expect(s.home.totalPointsWon).toBe(7);
    expect(s.away.totalPointsWon).toBe(5);
  });

  it('fewer than 10 points', () => {
    const s = deriveStats([g(H, H, [H, H, A]), g(A, H, [H, A, A], 1, 2)]);
    expect(s.home.pointsWonLast10).toBe(3);
    expect(s.away.pointsWonLast10).toBe(3);
    const t = deriveStats([g(H, H, [H, H, A, H, A, H])]);
    expect(t.home.pointsWonLast10).toBe(4);
    expect(Number.isNaN(t.away.pointsWonLast10)).toBe(false);
  });

  it('service games won counts held games only', () => {
    const s = deriveStats([
      g(H, H, [H]),
      g(A, H, [H], 1, 2),
      g(H, A, [A], 1, 3),
      g(A, A, [A], 1, 4),
    ]);
    expect(s.home.serviceGamesWon).toBe(1);
    expect(s.away.serviceGamesWon).toBe(1);
  });

  it('return points = points won on opponent serve', () => {
    const s = deriveStats([g(H, H, [H, A, A]), g(A, A, [H, H, A], 1, 2)]);
    expect(s.home.returnPointsWon).toBe(2);
    expect(s.away.returnPointsWon).toBe(2);
  });

  it('handles empty input', () => {
    const z = { pointsWonLast10: 0, totalPointsWon: 0, serviceGamesWon: 0, returnPointsWon: 0 };
    expect(deriveStats([])).toEqual({ home: z, away: z });
    expect(gameWinners([])).toEqual([]);
  });
});

describe('gameWinners', () => {
  it('lists set/game/winner in order', () => {
    expect(gameWinners([g(H, H, [H], 1, 1), g(A, H, [H], 1, 2), g(H, A, [A], 2, 1)])).toEqual([
      { set: 1, game: 1, winner: 'home' },
      { set: 1, game: 2, winner: 'home' },
      { set: 2, game: 1, winner: 'away' },
    ]);
  });
});
