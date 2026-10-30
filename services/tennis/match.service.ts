// services/tennis/match.service.ts
// Match data normalization and fetching

import { getMatchSummary } from './sportradar.client';
import type { MatchData, PlayerStats, SportRadarSummary } from '@/types/tennis.types';

/**
 * Fetch and normalize match data by event ID
 */
export async function getMatchData(matchId: string): Promise<MatchData | null> {
  const summary = await getMatchSummary(matchId);
  if (!summary) return null;
  return normalizeMatchData(summary);
}

/**
 * Normalize a SportRadar API response into our MatchData format
 */
export function normalizeMatchData(summary: SportRadarSummary): MatchData {
  const { sport_event, sport_event_status, statistics } = summary;
  const competitors = sport_event.competitors || [];
  const home = competitors.find((c) => c.qualifier === 'home');
  const away = competitors.find((c) => c.qualifier === 'away');

  const periodScores = (sport_event_status.period_scores || []).map((ps) => ({
    home: ps.home_score,
    away: ps.away_score,
    type: 'set' as const,
    number: ps.number,
  }));

  // Calculate total games played to determine next game number
  const totalGames = periodScores.reduce((sum, set) => sum + set.home + set.away, 0);

  // Game state
  const gameState = sport_event_status.game_state;
  const serving = gameState?.serving || 'home';

  // Current set score from the latest period
  const currentPeriod = periodScores[periodScores.length - 1];

  // SportRadar already updates the serving indicator to the new server
  // when a game ends, so we can use it directly for the next game.
  const nextServer = serving;

  // Parse stats
  const homeStats = extractPlayerStats(statistics, 'home');
  const awayStats = extractPlayerStats(statistics, 'away');

  return {
    id: sport_event.id,
    status:
      sport_event_status.status === 'live'
        ? 'live'
        : sport_event_status.status === 'closed'
          ? 'final'
          : 'scheduled',
    tournament: sport_event.tournament?.name || 'Unknown Tournament',
    surface: (sport_event.venue?.court_type as MatchData['surface']) || 'hard',
    players: {
      home: {
        id: home?.id || '',
        name: home?.name || 'Unknown',
        country: home?.country_code || '',
        seed: home?.seed,
      },
      away: {
        id: away?.id || '',
        name: away?.name || 'Unknown',
        country: away?.country_code || '',
        seed: away?.seed,
      },
    },
    score: {
      sets: {
        home: sport_event_status.home_score,
        away: sport_event_status.away_score,
      },
      currentSet: {
        home: currentPeriod?.home || 0,
        away: currentPeriod?.away || 0,
      },
      currentGame: {
        home: String(gameState?.home_score ?? '0'),
        away: String(gameState?.away_score ?? '0'),
        tieBreak: gameState?.tie_break || false,
      },
      periodScores,
      serving: serving as 'home' | 'away',
    },
    statistics: {
      home: homeStats,
      away: awayStats,
    },
    nextGame: {
      number: totalGames + 1,
      server: nextServer as 'home' | 'away',
    },
  };
}

function extractPlayerStats(
  statistics: SportRadarSummary['statistics'],
  qualifier: 'home' | 'away',
): PlayerStats {
  const defaultStats: PlayerStats = {
    aces: 0,
    doubleFaults: 0,
    firstServePercentage: 0,
    firstServePointsWon: 0,
    secondServePointsWon: 0,
    secondServePercentage: 0,
    winners: 0,
    unforcedErrors: 0,
    breakPointsWon: 0,
    breakPointsTotal: 0,
    pointsWonLast10: 0,
    serviceGamesWon: 0,
    gamesWon: 0,
    totalPointsWon: 0,
    returnPointsWon: 0,
  };

  if (!statistics?.totals?.competitors) return defaultStats;

  const comp = statistics.totals.competitors.find((c) => c.qualifier === qualifier);
  if (!comp?.statistics) return defaultStats;

  const s = comp.statistics;

  const firstServePercentage = s.first_serve_total
    ? Math.round(((s.first_serve_successful || 0) / s.first_serve_total) * 100)
    : 0;

  const firstServePointsWon = s.first_serve_points_total
    ? Math.round(((s.first_serve_points_won || 0) / s.first_serve_points_total) * 100)
    : 0;

  const secondServePointsWon = s.second_serve_points_won || 0;

  const secondServeTotal = s.second_serve_points_total || 0;
  const secondServePercentage =
    secondServeTotal > 0
      ? Math.round(((s.second_serve_points_won || 0) / secondServeTotal) * 100)
      : 0;

  const totalPointsWon = s.points_won || 0;
  const servicePointsWon = s.service_points_won || 0;
  const returnPointsWon = totalPointsWon - servicePointsWon;

  return {
    aces: s.aces || 0,
    doubleFaults: s.double_faults || 0,
    firstServePercentage,
    firstServePointsWon,
    secondServePointsWon,
    secondServePercentage,
    winners: (s.forehand_winners || 0) + (s.backhand_winners || 0),
    unforcedErrors: (s.forehand_unforced_errors || 0) + (s.backhand_unforced_errors || 0),
    breakPointsWon: s.breakpoints_won || 0,
    breakPointsTotal: s.total_breakpoints || 0,
    pointsWonLast10: s.points_won_from_last_10 || 0,
    serviceGamesWon: s.service_games_won || 0,
    gamesWon: s.games_won || 0,
    totalPointsWon,
    returnPointsWon: Math.max(0, returnPointsWon),
  };
}
