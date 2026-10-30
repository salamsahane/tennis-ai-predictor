// services/verdict.engine.ts
// Calculates the consensus verdict from multiple AI predictions

import type { AIPrediction, AIModel } from '@/types/ai.types';
import type { VerdictResult, Weight } from '@/types/verdict.types';

// Base weights for the weighted voting system
const BASE_WEIGHTS: Weight = {
  claude: 0.35,
  gpt4o: 0.35,
  gemini: 0.30,
};

function getWeight(model: AIModel): number {
  return BASE_WEIGHTS[model];
}

export function computeVerdict(predictions: AIPrediction[]): VerdictResult {
  if (predictions.length === 0) {
    throw new Error('Cannot compute verdict without predictions');
  }

  // 1. Count weighted votes per player
  const votes: Record<string, number> = {};
  const totalWeight = predictions.reduce((sum, p) => sum + getWeight(p.model), 0);

  for (const pred of predictions) {
    const weight = getWeight(pred.model) / totalWeight;
    // Normalize player name (sometimes models add variations)
    const winner = pred.predicted_winner.trim();
    votes[winner] = (votes[winner] ?? 0) + weight;
  }

  // 2. Determine the predicted winner
  const predictedWinner = Object.entries(votes)
    .sort(([, a], [, b]) => b - a)[0][0];
  
  const winnerVoteShare = votes[predictedWinner];

  // 3. Calculate composite confidence score
  const winningPredictions = predictions.filter(p => p.predicted_winner.trim() === predictedWinner);
  
  const avgProbability = winningPredictions.length > 0
    ? winningPredictions.reduce((sum, p) => sum + p.win_probability, 0) / winningPredictions.length
    : 0.5;

  // Consensus factor: how many models agreed vs total valid models
  // 1.0 = unanimous, 0.66 = majority, 0.33 = single model (if 3 available)
  const consensusFactor = winnerVoteShare;

  // Final confidence score (0-100)
  // Weighted: 60% based on model confidence, 40% based on agreement
  let confidenceScore = Math.round((avgProbability * 0.6 + consensusFactor * 0.4) * 100);

  // Penalty if we didn't have all 3 models
  if (predictions.length < 3) {
    // Cap confidence if we are missing data
    const maxConfidence = predictions.length === 1 ? 60 : 80;
    confidenceScore = Math.min(confidenceScore, maxConfidence);
  }

  // 4. Qualitative confidence level
  const confidenceLevel =
    confidenceScore >= 80 ? 'HIGH' :
    confidenceScore >= 60 ? 'MEDIUM' : 'LOW';

  // 5. Agreement level
  let agreement: 'UNANIMOUS' | 'MAJORITY' | 'SPLIT' = 'SPLIT';
  
  if (winningPredictions.length === predictions.length && predictions.length > 1) {
    agreement = 'UNANIMOUS';
  } else if (winningPredictions.length >= 2) {
    agreement = 'MAJORITY';
  } else if (predictions.length === 1) {
    agreement = 'UNANIMOUS'; // Only 1 model responded, so technically unanimous
  }

  // 6. Break prediction consensus (needs >= 50% agreement)
  const breakVotes = predictions.filter(p => p.is_break_predicted).length;
  const isBreakPredicted = breakVotes >= (predictions.length / 2);

  // 7. Most common predicted score
  const scoreCounts: Record<string, number> = {};
  for (const p of predictions) {
    scoreCounts[p.predicted_score] = (scoreCounts[p.predicted_score] ?? 0) + 1;
  }
  const mostCommonScore = Object.entries(scoreCounts)
    .sort(([, a], [, b]) => b - a)[0][0];

  return {
    predicted_winner: predictedWinner,
    confidence_score: Math.max(0, Math.min(100, confidenceScore)), // Clamp 0-100
    confidence_level: confidenceLevel,
    agreement,
    vote_breakdown: votes,
    is_break_predicted: isBreakPredicted,
    predicted_score: mostCommonScore,
    summary: buildSummary(predictedWinner, confidenceScore, agreement, predictions.length),
  };
}

function buildSummary(
  winner: string,
  score: number,
  agreement: string,
  modelCount: number
): string {
  if (modelCount < 3) {
    return `Analyse partielle (${modelCount}/3 modèles) : ${winner} favori.`;
  }
  
  if (agreement === 'UNANIMOUS') {
    return `Consensus total pour ${winner} avec une forte certitude.`;
  } else if (score >= 70) {
    return `Majorité des modèles en faveur de ${winner}.`;
  } else {
    return `Situation indécise, léger avantage à ${winner}.`;
  }
}
