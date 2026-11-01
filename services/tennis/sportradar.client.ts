// services/tennis/sportradar.client.ts
// SportRadar Tennis API client

import axios from 'axios';
import type { SportRadarLiveSummaries, SportRadarSummary } from '@/types/tennis.types';
import { redis } from '@/lib/redis';
import { logProviderError, toProviderError } from './providers/errors';

const PROVIDER_ID = 'sportradar';

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
    const providerError = toProviderError(PROVIDER_ID, error);
    logProviderError(providerError);

    // Stale cache is only acceptable for transient failures
    if (providerError.kind === 'transient' && cached) {
      try {
        return JSON.parse(cached as string) as SportRadarSummary[];
      } catch {
        // Cache unusable
      }
    }
    throw providerError;
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
    const providerError = toProviderError(PROVIDER_ID, error);
    logProviderError(providerError);

    if (providerError.kind === 'transient' && cached) {
      try {
        return JSON.parse(cached as string) as SportRadarSummary;
      } catch {
        // Cache unusable
      }
    }
    throw providerError;
  }
}
