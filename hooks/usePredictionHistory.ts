import { useMemo } from 'react';
import type { PredictionEvent } from '@/types/verdict.types';
import { computeModelPerformance, computeVerdictAccuracy } from '@/lib/prediction-stats';

/**
 * Accuracy stats over the prediction history.
 * Accuracy stays pending (null) until real game winners are recorded.
 */
export function usePredictionHistory(predictions: PredictionEvent[]) {
  const performance = useMemo(() => computeModelPerformance(predictions), [predictions]);
  const verdictAccuracy = useMemo(() => computeVerdictAccuracy(predictions), [predictions]);

  return {
    history: predictions,
    performance,
    verdictAccuracy,
    totalPredictions: predictions.length,
    completedPredictions: predictions.filter((p) => p.actual_winner !== undefined).length,
  };
}
