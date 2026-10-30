import { describe, expect, it } from 'vitest';
import { buildPrompt } from './prompt.builder';
import type { MatchData, PlayerStats } from '@/types/tennis.types';

const stats: PlayerStats = {
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

function makeMatch(overrides: Partial<MatchData> = {}): MatchData {
  return {
    id: 'sr:sport_event:1',
    status: 'live',
    tournament: 'Roland Garros',
    surface: 'clay',
    players: {
      home: { id: 'h', name: 'Sinner, Jannik', country: 'ITA' },
      away: { id: 'a', name: 'Alcaraz, Carlos', country: 'ESP' },
    },
    score: {
      sets: { home: 1, away: 0 },
      currentSet: { home: 3, away: 2 },
      currentGame: { home: '0', away: '0', tieBreak: false },
      periodScores: [
        { home: 6, away: 4, type: 'set', number: 1 },
        { home: 3, away: 2, type: 'set', number: 2 },
      ],
      serving: 'home',
    },
    statistics: { home: stats, away: stats },
    nextGame: { number: 6, server: 'away' },
    ...overrides,
  };
}

const PLACEHOLDER = /\{[a-z_|\s]+\}/;

describe('buildPrompt', () => {
  it('does not leak template placeholders', () => {
    expect(buildPrompt(makeMatch())).not.toMatch(PLACEHOLDER);
  });

  it('JSON example names both players', () => {
    expect(buildPrompt(makeMatch())).toContain(
      '"predicted_winner": "Sinner, Jannik | Alcaraz, Carlos"',
    );
  });

  it('works at match start', () => {
    const base = makeMatch();
    const prompt = buildPrompt(
      makeMatch({
        score: {
          ...base.score,
          sets: { home: 0, away: 0 },
          currentSet: { home: 0, away: 0 },
          periodScores: [],
        },
      }),
    );
    expect(prompt).toContain('Aucun set terminé');
    expect(prompt).not.toMatch(PLACEHOLDER);
  });
});
