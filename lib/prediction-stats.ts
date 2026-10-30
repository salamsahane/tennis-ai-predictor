import type { ModelPerformance, PredictionEvent } from '@/types/verdict.types';

/** Events whose real game winner is known. */
function completed(history: PredictionEvent[]): PredictionEvent[] {
  return history.filter((p) => p.actual_winner !== undefined);
}

/**
 * Per-model accuracy over completed events. Errored predictions are not counted;
 * a model with nothing evaluated has null accuracy (pending), not 0%.
 */
export function computeModelPerformance(history: PredictionEvent[]): ModelPerformance[] {
  const models: ModelPerformance[] = [
    { model: 'claude', correct: 0, total: 0, accuracy: null },
    { model: 'gpt4o', correct: 0, total: 0, accuracy: null },
    { model: 'gemini', correct: 0, total: 0, accuracy: null },
  ];

  for (const event of completed(history)) {
    const actualWinner = event.actual_winner!.trim();
    for (const pred of event.predictions) {
      if (pred.error) continue;
      const modelStats = models.find((m) => m.model === pred.model);
      if (!modelStats) continue;
      modelStats.total++;
      if (pred.predicted_winner.trim() === actualWinner) modelStats.correct++;
    }
  }

  for (const m of models) {
    m.accuracy = m.total > 0 ? Math.round((m.correct / m.total) * 100) : null;
  }
  return models;
}

/** Verdict accuracy in percent, or null while no real result is known yet. */
export function computeVerdictAccuracy(history: PredictionEvent[]): number | null {
  const done = completed(history);
  if (done.length === 0) return null;
  const correct = done.filter((p) => p.was_correct).length;
  return Math.round((correct / done.length) * 100);
}
