// services/tennis/providers/sportradar.provider.ts
// SportRadar behind the TennisDataProvider interface

import type { MatchData, MatchSearchResult, SportRadarSummary } from '@/types/tennis.types';
import { getLiveSummaries, getMatchSummary } from '../sportradar.client';
import { normalizeMatchData } from '../match.service';
import type { SourceInfo, TennisDataProvider } from './types';

const ID = 'sportradar';
const SOURCE: SourceInfo = { providerId: ID, label: 'SportRadar', kind: 'live' };

function numericId(srId: string): string {
  return srId.split(':').pop() ?? srId;
}

function toSearchResult(summary: SportRadarSummary): MatchSearchResult {
  const { sport_event, sport_event_status } = summary;
  const competitors = sport_event.competitors || [];
  const home = competitors.find((c) => c.qualifier === 'home');
  const away = competitors.find((c) => c.qualifier === 'away');

  const periodScores = sport_event_status.period_scores || [];
  const currentSet = periodScores.length || 1;
  const lastPeriod = periodScores[periodScores.length - 1];
  const score = lastPeriod
    ? `${lastPeriod.home_score}-${lastPeriod.away_score} (Set ${currentSet})`
    : `${sport_event_status.home_score}-${sport_event_status.away_score}`;

  return {
    id: `${ID}:${numericId(sport_event.id)}`,
    status:
      sport_event_status.status === 'live'
        ? 'live'
        : sport_event_status.status === 'closed'
          ? 'final'
          : 'scheduled',
    tournament: sport_event.tournament?.name || 'Unknown Tournament',
    surface: sport_event.venue?.court_type || 'unknown',
    home_player: home?.name || 'Unknown',
    away_player: away?.name || 'Unknown',
    score,
    venue: sport_event.venue?.name,
    source: SOURCE,
  };
}

export const sportradarProvider: TennisDataProvider = {
  id: ID,
  label: SOURCE.label,
  kind: SOURCE.kind,

  async listLiveMatches(): Promise<MatchSearchResult[]> {
    const summaries = await getLiveSummaries();
    return summaries.map(toSearchResult);
  },

  async getMatch(nativeId: string): Promise<MatchData | null> {
    // Accept both "123" and "sr:sport_event:123"
    const id = numericId(nativeId);
    const summary = await getMatchSummary(`sr:sport_event:${id}`);
    if (!summary) return null;
    return { ...normalizeMatchData(summary), id: `${ID}:${id}` };
  },
};
