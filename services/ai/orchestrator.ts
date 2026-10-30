// services/ai/orchestrator.ts
import type { MatchData } from '@/types/tennis.types';
import type { AIPrediction, AIModel, OrchestrationResult } from '@/types/ai.types';
import { buildPrompt } from './prompt.builder';
import { getClaudePrediction } from './claude.service';
import { getGPTPrediction } from './openai.service';
import { getGeminiPrediction } from './gemini.service';
import { computeVerdict } from '@/services/verdict.engine';

const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '15000', 10);

const ALL_MODELS: AIModel[] = ['claude', 'gpt4o', 'gemini'];

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, model: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${model} timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

/** Model -> fetch function mapping */
const MODEL_FETCHERS: Record<AIModel, (matchData: MatchData, prompt: string) => Promise<AIPrediction>> = {
  claude: getClaudePrediction,
  gpt4o: getGPTPrediction,
  gemini: getGeminiPrediction,
};

/**
 * Creates a "disabled" placeholder prediction for a model that wasn't selected.
 */
function createDisabledPrediction(model: AIModel): AIPrediction {
  return {
    model,
    predicted_winner: 'N/A',
    win_probability: 0,
    serving_player: 'N/A',
    is_break_predicted: false,
    predicted_score: 'N/A',
    key_factors: [],
    reasoning: '',
    latency_ms: 0,
    error: 'disabled',
  };
}

/**
 * Creates a fallback error prediction for a model that failed.
 */
function createErrorPrediction(model: AIModel, errorMessage: string): AIPrediction {
  return {
    model,
    predicted_winner: 'Unknown',
    win_probability: 0.5,
    serving_player: 'Unknown',
    is_break_predicted: false,
    predicted_score: 'unknown',
    key_factors: [],
    reasoning: 'Failed due to error or timeout',
    latency_ms: AI_TIMEOUT_MS,
    error: errorMessage,
  };
}

/**
 * Run AI predictions in parallel for selected models and compute the verdict.
 * If no selectedModels array is provided, all models are called.
 */
export async function runAllPredictions(
  matchData: MatchData,
  selectedModels?: AIModel[]
): Promise<OrchestrationResult> {
  const modelsToCall = selectedModels && selectedModels.length > 0 ? selectedModels : ALL_MODELS;
  const prompt = buildPrompt(matchData);
  const { periodScores } = matchData.score;
  
  // Current game number is total games played + 1
  const totalGames = periodScores.reduce((sum, set) => sum + set.home + set.away, 0);
  const gameNumber = totalGames + 1;
  const setNumber = periodScores.length || 1;

  // Run selected AI calls in parallel with timeouts
  const modelEntries = modelsToCall.map((model) => ({
    model,
    promise: withTimeout(MODEL_FETCHERS[model](matchData, prompt), AI_TIMEOUT_MS, model),
  }));

  const results = await Promise.allSettled(modelEntries.map((e) => e.promise));

  // Build predictions array: successful results, error fallbacks, and disabled placeholders
  const predictions: AIPrediction[] = [];

  // Process called models
  for (let i = 0; i < modelEntries.length; i++) {
    const { model } = modelEntries[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      predictions.push(result.value);
    } else {
      predictions.push(createErrorPrediction(model, result.reason?.message || 'Unknown error'));
    }
  }

  // Add disabled placeholders for models that weren't selected
  for (const model of ALL_MODELS) {
    if (!modelsToCall.includes(model)) {
      predictions.push(createDisabledPrediction(model));
    }
  }

  // Filter valid predictions for the verdict engine (exclude errors AND disabled)
  const validPredictions = predictions.filter(p => !p.error && p.predicted_winner !== 'Unknown' && p.predicted_winner !== 'N/A');

  if (validPredictions.length === 0) {
    throw new Error('All AI prediction calls failed');
  }

  const verdict = computeVerdict(validPredictions);

  return {
    predictions, // Return all, including failed and disabled ones for UI display
    verdict,
    timestamp: new Date().toISOString(),
    game_number: gameNumber,
    set_number: setNumber,
  };
}

