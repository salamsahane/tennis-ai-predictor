import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchCard } from './MatchCard';
import type { MatchSearchResult } from '@/types/tennis.types';

function render(source: MatchSearchResult['source'], id: string): string {
  const match = {
    id,
    status: 'live',
    tournament: 'Paris Masters',
    surface: 'hard',
    home_player: 'Sinner, Jannik',
    away_player: 'Alcaraz, Carlos',
    score: '1-0 (Set 1)',
    source,
  } as MatchSearchResult;
  return renderToStaticMarkup(<MatchCard match={match} />);
}

describe('MatchCard', () => {
  it('labels replays as Replay and never LIVE', () => {
    const html = render({ providerId: 'replay', label: 'Replay', kind: 'replay' }, 'replay:demo');
    expect(html).toContain('Replay');
    expect(html).not.toContain('LIVE');
  });

  it('keeps the LIVE status badge for live providers', () => {
    const html = render(
      { providerId: 'apitennis', label: 'api-tennis', kind: 'live' },
      'apitennis:1',
    );
    expect(html).toContain('LIVE');
    expect(html).toContain('Live · api-tennis');
  });
});
