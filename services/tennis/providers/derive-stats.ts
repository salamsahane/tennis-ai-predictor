import type { MatchData } from '@/types/tennis.types';

type Side = 'home' | 'away';

export interface GameRecord {
  set: number;
  game: number;
  server: Side;
  winner: Side;
  pointWinners: Side[];
}

export interface DerivedStats {
  pointsWonLast10: number;
  totalPointsWon: number;
  serviceGamesWon: number;
  returnPointsWon: number;
}

const empty = (): DerivedStats => ({
  pointsWonLast10: 0,
  totalPointsWon: 0,
  serviceGamesWon: 0,
  returnPointsWon: 0,
});

export function deriveStats(games: GameRecord[]): { home: DerivedStats; away: DerivedStats } {
  const out = { home: empty(), away: empty() };
  for (const game of games) {
    if (game.winner === game.server) out[game.server].serviceGamesWon += 1;
    for (const p of game.pointWinners) {
      out[p].totalPointsWon += 1;
      if (p !== game.server) out[p].returnPointsWon += 1;
    }
  }
  for (const p of games.flatMap((game) => game.pointWinners).slice(-10)) {
    out[p].pointsWonLast10 += 1;
  }
  return out;
}

export function gameWinners(games: GameRecord[]): NonNullable<MatchData['gameWinners']> {
  return games.map(({ set, game, winner }) => ({ set, game, winner }));
}
