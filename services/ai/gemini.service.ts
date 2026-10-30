// services/ai/gemini.service.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { MatchData } from '@/types/tennis.types';
import type { AIPrediction, AIRawResponse } from '@/types/ai.types';
import { SYSTEM_PROMPT } from '@/constants/prompts';
import { safeJsonParse } from '@/lib/utils';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export async function getGeminiPrediction(
  matchData: MatchData,
  prompt: string,
): Promise<AIPrediction> {
  const startTime = Date.now();

  if (!genAI) {
    return {
      model: 'gemini',
      predicted_winner: 'Unknown',
      win_probability: 0.5,
      serving_player: 'Unknown',
      is_break_predicted: false,
      predicted_score: 'unknown',
      key_factors: [],
      reasoning: 'API Key not configured',
      latency_ms: 0,
      error: 'API Key not configured',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const result = await model.generateContent([prompt]);
    const text = result.response.text();
    const rawData = safeJsonParse<AIRawResponse>(text);

    if (!rawData) {
      throw new Error('Failed to parse Gemini JSON response');
    }

    return {
      model: 'gemini',
      ...rawData,
      latency_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[AI] Gemini prediction failed:', error);
    return {
      model: 'gemini',
      predicted_winner: 'Unknown',
      win_probability: 0.5,
      serving_player: 'Unknown',
      is_break_predicted: false,
      predicted_score: 'unknown',
      key_factors: [],
      reasoning: 'Prediction failed',
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
