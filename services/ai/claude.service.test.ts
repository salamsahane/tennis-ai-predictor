import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchData } from '@/types/tennis.types';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const answer = {
  predicted_winner: 'A',
  win_probability: 0.7,
  serving_player: 'A',
  is_break_predicted: false,
  key_factors: [],
  predicted_score: '40-15',
  reasoning: 'Serve dominance.',
};

async function loadService() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.resetModules();
  return import('./claude.service');
}

describe('getClaudePrediction', () => {
  beforeEach(() => create.mockReset());

  it('calls the current Sonnet model without sampling params', async () => {
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(answer) }],
    });
    const { getClaudePrediction } = await loadService();
    await getClaudePrediction({} as MatchData, 'prompt');

    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params).not.toHaveProperty('temperature');
    expect(params.output_config).toEqual({ effort: 'low' });
  });

  it('reads the text block after a thinking block', async () => {
    create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text: JSON.stringify(answer) },
      ],
    });
    const { getClaudePrediction } = await loadService();
    const result = await getClaudePrediction({} as MatchData, 'prompt');

    expect(result.error).toBeUndefined();
    expect(result.predicted_winner).toBe('A');
  });

  it('reports a refusal as an error prediction', async () => {
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    const { getClaudePrediction } = await loadService();
    const result = await getClaudePrediction({} as MatchData, 'prompt');

    expect(result.error).toMatch(/refus/i);
  });
});
