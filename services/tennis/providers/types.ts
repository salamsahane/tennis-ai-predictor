import type { MatchData, MatchSearchResult } from '@/types/tennis.types';

export type ProviderKind = 'live' | 'replay';

export interface SourceInfo {
  providerId: string;
  label: string;
  kind: ProviderKind;
}

export interface TennisDataProvider {
  id: string;
  label: string;
  kind: ProviderKind;
  listLiveMatches(): Promise<MatchSearchResult[]>;
  getMatch(nativeId: string): Promise<MatchData | null>;
}
