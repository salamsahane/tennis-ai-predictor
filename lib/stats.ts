/** Which side has the better value for a stat, or null when tied. */
export function compareStat(
  home: number,
  away: number,
  lowerIsBetter = false,
): 'home' | 'away' | null {
  if (home === away) return null;
  const homeAhead = lowerIsBetter ? home < away : home > away;
  return homeAhead ? 'home' : 'away';
}

/** Each side's share of the total, in percent. Even split when the total is 0. */
export function shareOfTotal(home: number, away: number): [number, number] {
  const total = home + away;
  if (total === 0) return [50, 50];
  return [(home / total) * 100, (away / total) * 100];
}

/** Display a possibly-missing stat; `n/d` when the provider could not supply it. */
export function formatStat(v: number | null, suffix = ''): string {
  return v === null ? 'n/d' : `${v}${suffix}`;
}
