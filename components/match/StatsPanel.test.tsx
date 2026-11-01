import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatsPanel } from './StatsPanel';
import type { MatchData, PlayerStats } from '@/types/tennis.types';

const full: PlayerStats = {
  aces: 3,
  doubleFaults: 1,
  firstServePercentage: 65,
  firstServePointsWon: 72,
  secondServePointsWon: 50,
  secondServePercentage: 50,
  winners: 12,
  unforcedErrors: 8,
  breakPointsWon: 1,
  breakPointsTotal: 3,
  pointsWonLast10: 6,
  serviceGamesWon: 4,
  gamesWon: 5,
  totalPointsWon: 40,
  returnPointsWon: 15,
};

function render(home: PlayerStats, away: PlayerStats): string {
  const match = {
    players: {
      home: { id: 'h', name: 'Sinner, Jannik', country: 'ITA' },
      away: { id: 'a', name: 'Alcaraz, Carlos', country: 'ESP' },
    },
    statistics: { home, away },
  } as MatchData;
  return renderToStaticMarkup(<StatsPanel match={match} />);
}

describe('StatsPanel', () => {
  it('shows n/d without a % suffix on a percentage row', () => {
    const html = render({ ...full, firstServePercentage: null }, full);
    expect(html).toContain('>n/d<');
    expect(html).not.toContain('n/d%');
    expect(html).toContain('>65%<');
  });
});
