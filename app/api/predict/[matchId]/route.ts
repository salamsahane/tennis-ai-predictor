import { type NextRequest } from 'next/server';
import { getMatchData } from '@/services/tennis/match.service';
import { runAllPredictions } from '@/services/ai/orchestrator';
import type { AIModel } from '@/types/ai.types';

export const maxDuration = 60; // Allow longer execution time for AI calls

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await context.params;

    // Parse selected models from query params
    const modelsParam = request.nextUrl.searchParams.get('models');
    const selectedModels: AIModel[] | undefined = modelsParam
      ? (modelsParam.split(',').filter((m): m is AIModel => ['claude', 'gpt4o', 'gemini'].includes(m)))
      : undefined;

    const matchData = await getMatchData(matchId);
    
    if (!matchData) {
      return Response.json(
        { error: 'Match not found or data unavailable' },
        { status: 404 }
      );
    }

    if (matchData.status === 'final') {
      return Response.json(
        { error: 'Match has ended' },
        { status: 400 }
      );
    }

    const result = await runAllPredictions(matchData, selectedModels);

    return Response.json(result);
  } catch (error) {
    console.error('[API] Manual prediction trigger failed:', error);
    return Response.json(
      { error: 'Prediction generation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
