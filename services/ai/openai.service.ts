// services/ai/openai.service.ts
import OpenAI from 'openai';
import type { MatchData } from '@/types/tennis.types';
import type { AIPrediction, AIRawResponse } from '@/types/ai.types';
import { SYSTEM_PROMPT } from '@/constants/prompts';
import { safeJsonParse } from '@/lib/utils';
import { PROVIDER_MODEL_IDS } from '@/constants/models';

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function getGPTPrediction(
  matchData: MatchData,
  prompt: string,
): Promise<AIPrediction> {
  const startTime = Date.now();

  if (!client) {
    return {
      model: 'gpt4o',
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
    const response = await client.chat.completions.create({
      model: PROVIDER_MODEL_IDS.gpt4o,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      temperature: 0.3,
    });

    const text = response.choices[0].message.content ?? '';
    const rawData = safeJsonParse<AIRawResponse>(text);

    if (!rawData) {
      throw new Error('Failed to parse GPT-4o JSON response');
    }

    return {
      model: 'gpt4o',
      ...rawData,
      latency_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[AI] GPT-4o prediction failed:', error);
    return {
      model: 'gpt4o',
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
