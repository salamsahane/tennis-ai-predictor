import type { MatchSearchResult } from '@/types/tennis.types';

/** Keep matches where any whitespace-separated term appears in either player's name. */
export function filterMatches(matches: MatchSearchResult[], query: string): MatchSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return matches.filter((m) => {
    const names = `${m.home_player} ${m.away_player}`.toLowerCase();
    return terms.some((term) => names.includes(term));
  });
}
