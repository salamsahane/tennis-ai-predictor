// types/ai.types.ts
// Types for AI prediction responses

export type AIModel = 'claude' | 'gpt4o' | 'gemini';

export interface AIPrediction {
  model: AIModel;
  predicted_winner: string;
  win_probability: number; // 0.5 - 1.0
  serving_player: string;
  is_break_predicted: boolean;
  predicted_score: string; // ex: "40-15"
  key_factors: KeyFactor[];
  reasoning: string;
  latency_ms: number;
  error?: string;
}

export interface KeyFactor {
  factor: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface AIRawResponse {
  predicted_winner: string;
  win_probability: number;
  serving_player: string;
  is_break_predicted: boolean;
  key_factors: KeyFactor[];
  predicted_score: string;
  reasoning: string;
}

export interface OrchestrationResult {
  predictions: AIPrediction[];
  verdict: import('./verdict.types').VerdictResult;
  timestamp: string;
  game_number: number;
  set_number: number;
}
