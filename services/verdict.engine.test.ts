import { describe, expect, it } from 'vitest';
import { computeVerdict } from './verdict.engine';
import type { AIModel, AIPrediction } from '@/types/ai.types';

function pred(
  model: AIModel,
  winner: string,
  prob: number,
  overrides: Partial<AIPrediction> = {},
): AIPrediction {
  return {
    model,
    predicted_winner: winner,
    win_probability: prob,
    serving_player: 'A',
    is_break_predicted: false,
    predicted_score: '40-15',
    key_factors: [],
    reasoning: '',
    latency_ms: 100,
    ...overrides,
  };
}

describe('computeVerdict', () => {
  it('unanimous with 3 models', () => {
    const result = computeVerdict([
      pred('claude', 'A', 0.8),
      pred('gpt4o', 'A', 0.8),
      pred('gemini', 'A', 0.8),
    ]);
    expect(result.agreement).toBe('UNANIMOUS');
    expect(result.predicted_winner).toBe('A');
    expect(result.confidence_score).toBe(88);
  });

  it('caps confidence at 60 with one model', () => {
    const result = computeVerdict([pred('claude', 'A', 0.95)]);
    expect(result.confidence_score).toBe(60);
  });

  it('caps confidence at 80 with two models', () => {
    const result = computeVerdict([pred('claude', 'A', 0.95), pred('gpt4o', 'A', 0.95)]);
    expect(result.confidence_score).toBe(80);
  });

  it('majority 2 vs 1', () => {
    const result = computeVerdict([
      pred('claude', 'A', 0.7),
      pred('gpt4o', 'B', 0.7),
      pred('gemini', 'B', 0.7),
    ]);
    expect(result.agreement).toBe('MAJORITY');
    expect(result.predicted_winner).toBe('B');
  });

  it('throws on empty input', () => {
    expect(() => computeVerdict([])).toThrow();
  });
});
