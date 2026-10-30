// types/verdict.types.ts
// Types for the verdict engine

export interface VerdictResult {
  predicted_winner: string;
  confidence_score: number; // 0-100
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  agreement: 'UNANIMOUS' | 'MAJORITY' | 'SPLIT';
  vote_breakdown: Record<string, number>;
  is_break_predicted: boolean;
  predicted_score: string;
  summary: string;
}

export interface PredictionEvent {
  game_number: number;
  set_number: number;
  timestamp: string;
  predictions: import('./ai.types').AIPrediction[];
  verdict: VerdictResult;
  actual_winner?: string;
  was_correct?: boolean;
}

export interface ModelPerformance {
  model: import('./ai.types').AIModel;
  correct: number;
  total: number;
  accuracy: number | null; // null until the model has an evaluated prediction
}

export interface Weight {
  claude: number;
  gpt4o: number;
  gemini: number;
}
