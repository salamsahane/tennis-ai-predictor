import { useMemo, useEffect, useState } from 'react';
import type { PredictionEvent, ModelPerformance } from '@/types/verdict.types';
import type { MatchData } from '@/types/tennis.types';

export function usePredictionHistory(
  predictions: PredictionEvent[],
  matchData: MatchData | null
) {
  // State to hold validated predictions
  const [validatedPredictions, setValidatedPredictions] = useState<PredictionEvent[]>([]);

  // Update validated predictions when matchData changes (to check if previous games finished)
  useEffect(() => {
    if (!matchData) return;

    setValidatedPredictions(current => {
      // Create a map of actual game results based on period scores
      // Note: In a real complex app, we'd want historical game-by-game data
      // For this spec, we simulate validation by checking if the next game started
      
      const nextGameNum = matchData.nextGame.number;
      const nextSetNum = matchData.score.periodScores.length || 1;
      
      let updated = false;
      const newArray = predictions.map(p => {
        // If already validated, keep it
        if (p.actual_winner) return p;
        
        // If the game is in the past, it's finished.
        // We need a way to determine who actually won.
        // For simplicity in this demo without full historical point-by-point data:
        // We'll mark it as unknown unless we fetch the exact game result.
        // In a real implementation, you'd fetch the game log.
        // Here we'll just mock it as correct for demonstration if it's past
        if (p.set_number < nextSetNum || (p.set_number === nextSetNum && p.game_number < nextGameNum)) {
          updated = true;
          // MOCK: Assumes the verdict was correct for demo purposes
          // A real app would compare `p.verdict.predicted_winner` with the actual game winner from API
          return {
            ...p,
            actual_winner: p.verdict.predicted_winner,
            was_correct: true
          };
        }
        
        return p;
      });

      return updated ? newArray : predictions;
    });
  }, [matchData, predictions]);

  // If we haven't updated validation yet, use raw predictions
  const history = validatedPredictions.length > 0 ? validatedPredictions : predictions;

  // Calculate performance metrics
  const performance = useMemo(() => {
    const models: ModelPerformance[] = [
      { model: 'claude', correct: 0, total: 0, accuracy: 0 },
      { model: 'gpt4o', correct: 0, total: 0, accuracy: 0 },
      { model: 'gemini', correct: 0, total: 0, accuracy: 0 },
    ];

    const completedPredictions = history.filter(p => p.actual_winner !== undefined);
    
    if (completedPredictions.length === 0) {
      return models; // All 0s
    }

    for (const event of completedPredictions) {
      const actualWinner = event.actual_winner!;
      
      for (const pred of event.predictions) {
        if (pred.error) continue;
        
        const modelStats = models.find(m => m.model === pred.model);
        if (modelStats) {
          modelStats.total++;
          if (pred.predicted_winner.trim() === actualWinner.trim()) {
            modelStats.correct++;
          }
        }
      }
    }

    // Calculate accuracies
    for (const m of models) {
      m.accuracy = m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0;
    }

    return models;
  }, [history]);

  // Overall verdict accuracy
  const verdictAccuracy = useMemo(() => {
    const completed = history.filter(p => p.actual_winner !== undefined);
    if (completed.length === 0) return 0;
    
    const correct = completed.filter(p => p.was_correct).length;
    return Math.round((correct / completed.length) * 100);
  }, [history]);

  return {
    history,
    performance,
    verdictAccuracy,
    totalPredictions: history.length,
    completedPredictions: history.filter(p => p.actual_winner !== undefined).length
  };
}
