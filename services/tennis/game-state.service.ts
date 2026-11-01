// services/tennis/game-state.service.ts
// Game state detection — detects when a game ends

import { redis } from '@/lib/redis';
import type { MatchData } from '@/types/tennis.types';

/**
 * Detect if a game just ended: only an increase in total games counts. A drop
 * (e.g. a replay wrapping to its start) just resets the stored count.
 */
export async function detectGameEnd(currentData: MatchData, matchId: string): Promise<boolean> {
  const previousKey = `match:${matchId}:lastGamesCount`;
  const previousCount = await redis.get(previousKey);

  const currentGamesCount = getTotalGamesPlayed(currentData);

  const gameEnded = previousCount !== null && currentGamesCount > Number(previousCount);
  await redis.set(previousKey, currentGamesCount, { ex: 3600 });
  return gameEnded;
}

/**
 * Get the total number of games played across all sets
 */
export function getTotalGamesPlayed(data: MatchData): number {
  return data.score.periodScores.reduce((sum, set) => sum + set.home + set.away, 0);
}

/**
 * Determine the adaptive polling interval based on game state
 */
export function getPollingInterval(data: MatchData): number {
  const { currentGame } = data.score;

  // Deuce situation -> faster polling
  if (currentGame.home === '40' && currentGame.away === '40') {
    return 5000; // 5 seconds
  }

  // Tiebreak -> faster polling
  if (currentGame.tieBreak) {
    return 5000;
  }

  // Normal situation -> standard polling
  return 10000; // 10 seconds
}
