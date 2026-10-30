// services/ai/claude.service.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MatchData } from '@/types/tennis.types';
import type { AIPrediction, AIRawResponse } from '@/types/ai.types';
import { SYSTEM_PROMPT } from '@/constants/prompts';
import { safeJsonParse } from '@/lib/utils';

// We initialize the client but it won't throw until used if key is missing
const client = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function getClaudePrediction(
  matchData: MatchData,
  prompt: string
): Promise<AIPrediction> {
  const startTime = Date.now();
  
  if (!client) {
    return {
      model: 'claude',
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
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20240620', // Use newer Claude 3.5 Sonnet
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const rawData = safeJsonParse<AIRawResponse>(text);
    
    if (!rawData) {
      throw new Error('Failed to parse Claude JSON response');
    }

    return {
      model: 'claude',
      ...rawData,
      latency_ms: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[AI] Claude prediction failed:', error);
    return {
      model: 'claude',
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
