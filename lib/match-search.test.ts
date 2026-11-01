import { describe, expect, it } from 'vitest';
import type { MatchSearchResult } from '@/types/tennis.types';
import { filterMatches } from './match-search';

const m = (home: string, away: string) =>
  ({ home_player: home, away_player: away }) as MatchSearchResult;
const matches = [m('Carlos Alcaraz', 'Jannik Sinner'), m('Novak Djokovic', 'Daniil Medvedev')];

describe('filterMatches', () => {
  it('matches on a partial last name', () => {
    expect(filterMatches(matches, 'alcar')).toEqual([matches[0]]);
  });
  it('ignores case', () => {
    expect(filterMatches(matches, 'DJOKOVIC')).toEqual([matches[1]]);
  });
  it('matches any whitespace-separated term', () => {
    expect(filterMatches(matches, 'sinner medvedev')).toHaveLength(2);
  });
  it('returns an empty list for no match', () => {
    expect(filterMatches(matches, 'federer')).toEqual([]);
  });
});
