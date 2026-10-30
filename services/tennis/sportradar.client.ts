// services/tennis/sportradar.client.ts
// SportRadar Tennis API client

import axios from 'axios';
import type {
  SportRadarLiveSummaries,
  SportRadarSummary,
  MatchSearchResult,
} from '@/types/tennis.types';
import { redis } from '@/lib/redis';

const BASE_URL = process.env.SPORTRADAR_BASE_URL || 'https://api.sportradar.com/tennis/trial/v3/en';
const API_KEY = process.env.SPORTRADAR_API_KEY || '';
const CACHE_TTL = 10; // seconds

const client = axios.create({
  baseURL: BASE_URL,
  params: { api_key: API_KEY },
  timeout: 10000,
});

/**
 * Get all live match summaries
 */
export async function getLiveSummaries(): Promise<SportRadarSummary[]> {
  const cacheKey = 'sportradar:live_summaries';

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached as string) as SportRadarSummary[];
    } catch {
      // Cache corrupted, fetch fresh
    }
  }

  try {
    const response = await client.get<SportRadarLiveSummaries>('/schedules/live/summaries.json');
    const summaries = response.data.summaries || [];
    await redis.set(cacheKey, JSON.stringify(summaries), { ex: CACHE_TTL });
    return summaries;
  } catch (error) {
    console.error('[SportRadar] Failed to fetch live summaries:', error);

    // Return cached data if available (even if stale)
    if (cached) {
      try {
        return JSON.parse(cached as string) as SportRadarSummary[];
      } catch {
        // Return empty
      }
    }
    return [];
  }
}

/**
 * Get summary for a specific match
 */
export async function getMatchSummary(eventId: string): Promise<SportRadarSummary | null> {
  const cacheKey = `sportradar:match:${eventId}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      const cachedData = JSON.parse(cached as string) as SportRadarSummary;
      // console.log('[SportRadar] Using cached match summary at:' + Date.now(), cachedData);
      return cachedData;
    } catch {
      // Cache corrupted
    }
  }

  try {
    const response = await client.get<SportRadarSummary>(`/sport_events/${eventId}/summary.json`);
    const summary = response.data;
    await redis.set(cacheKey, JSON.stringify(summary), { ex: CACHE_TTL });
    return summary;
  } catch (error) {
    console.error(`[SportRadar] Failed to fetch match ${eventId}:`, error);

    if (cached) {
      try {
        return JSON.parse(cached as string) as SportRadarSummary;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Search for live matches by player name(s)
 */
export async function searchLiveMatches(query: string): Promise<MatchSearchResult[]> {
  const summaries = await getLiveSummaries();
  const searchTerms = query.toLowerCase().split(/\s+/);

  return summaries
    .filter(summary => {
      const competitors = summary.sport_event.competitors || [];
      const names = competitors.map(c => c.name.toLowerCase()).join(' ');
      return searchTerms.some(term => names.includes(term));
    })
    .map(summary => {
      const { sport_event, sport_event_status } = summary;
      const competitors = sport_event.competitors || [];
      const home = competitors.find(c => c.qualifier === 'home');
      const away = competitors.find(c => c.qualifier === 'away');

      const periodScores = sport_event_status.period_scores || [];
      const currentSet = periodScores.length || 1;
      const lastPeriod = periodScores[periodScores.length - 1];
      const scoreDisplay = lastPeriod
        ? `${lastPeriod.home_score}-${lastPeriod.away_score} (Set ${currentSet})`
        : `${sport_event_status.home_score}-${sport_event_status.away_score}`;

      return {
        id: sport_event.id,
        status: sport_event_status.status === 'live' ? 'live' as const :
          sport_event_status.status === 'closed' ? 'final' as const : 'scheduled' as const,
        tournament: sport_event.tournament?.name || 'Unknown Tournament',
        surface: sport_event.venue?.court_type || 'unknown',
        home_player: home?.name || 'Unknown',
        away_player: away?.name || 'Unknown',
        score: scoreDisplay,
        venue: sport_event.venue?.name,
      };
    });
}
