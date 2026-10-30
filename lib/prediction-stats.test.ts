import { describe, expect, it } from 'vitest';
import { computeModelPerformance, computeVerdictAccuracy } from './prediction-stats';
import type { AIModel, AIPrediction } from '@/types/ai.types';
import type { PredictionEvent, VerdictResult } from '@/types/verdict.types';

function pred(model: AIModel, winner: string, error?: string): AIPrediction {
  return {
    model,
    predicted_winner: winner,
    win_probability: 0.7,
    serving_player: 'A',
    is_break_predicted: false,
    predicted_score: '40-15',
    key_factors: [],
    reasoning: '',
    latency_ms: 100,
    error,
  };
}

const verdict: VerdictResult = {
  predicted_winner: 'A',
  confidence_score: 70,
  confidence_level: 'MEDIUM',
  agreement: 'MAJORITY',
  vote_breakdown: {},
  is_break_predicted: false,
  predicted_score: '40-15',
  summary: '',
};

function event(
  predictions: AIPrediction[],
  result: Pick<PredictionEvent, 'actual_winner' | 'was_correct'> = {},
): PredictionEvent {
  return {
    game_number: 1,
    set_number: 1,
    timestamp: '2026-10-30T12:00:00Z',
    predictions,
    verdict,
    ...result,
  };
}

describe('prediction stats', () => {
  it('no completed events → null accuracy', () => {
    const history = [event([pred('claude', 'A')]), event([pred('gpt4o', 'B')])];
    expect(computeVerdictAccuracy(history)).toBeNull();
    expect(computeModelPerformance(history).every((m) => m.total === 0)).toBe(true);
  });

  it('counts correct per model', () => {
    const history = [
      event([pred('claude', 'A'), pred('gpt4o', 'B')], { actual_winner: 'A', was_correct: true }),
    ];
    const perf = computeModelPerformance(history);
    expect(perf.map((m) => m.model)).toEqual(['claude', 'gpt4o', 'gemini']);
    expect(perf[0]).toMatchObject({ correct: 1, total: 1, accuracy: 100 });
    expect(perf[1]).toMatchObject({ correct: 0, total: 1, accuracy: 0 });
  });

  it('skips errored predictions', () => {
    const history = [
      event([pred('claude', 'A', 'timeout'), pred('gpt4o', 'A', 'timeout')], {
        actual_winner: 'A',
        was_correct: true,
      }),
    ];
    expect(computeModelPerformance(history).every((m) => m.total === 0)).toBe(true);
  });

  it('verdict accuracy from was_correct', () => {
    const history = [
      event([pred('claude', 'A')], { actual_winner: 'A', was_correct: true }),
      event([pred('claude', 'A')], { actual_winner: 'B', was_correct: false }),
    ];
    expect(computeVerdictAccuracy(history)).toBe(50);
  });
});
