import { type NextRequest } from 'next/server';
import { getMatchData } from '@/services/tennis/match.service';
import { detectGameEnd, getPollingInterval } from '@/services/tennis/game-state.service';
import { runAllPredictions } from '@/services/ai/orchestrator';
import type { AIModel } from '@/types/ai.types';

// Vercel config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  // Await the params object per Next.js 15 routing conventions
  const { matchId } = await context.params;

  // Parse selected models from query params
  const modelsParam = request.nextUrl.searchParams.get('models');
  const selectedModels: AIModel[] | undefined = modelsParam
    ? modelsParam.split(',').filter((m): m is AIModel => ['claude', 'gpt4o', 'gemini'].includes(m))
    : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let pollTimer: NodeJS.Timeout;

      // Ensure we clean up if the client disconnects
      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearTimeout(pollTimer);
        controller.close();
      });

      const poll = async () => {
        if (isClosed) return;

        try {
          // 1. Fetch current data
          const matchData = await getMatchData(matchId);

          if (!matchData) {
            controller.enqueue(encoder.encode(formatSSE('error', { message: 'Match not found' })));
            // Try again in 10s just in case it was a temporary API failure
            if (!isClosed) pollTimer = setTimeout(poll, 10000);
            return;
          }

          // 2. Send match update
          controller.enqueue(encoder.encode(formatSSE('match_update', matchData)));

          if (matchData.status === 'final') {
            controller.enqueue(
              encoder.encode(formatSSE('match_ended', { final_score: matchData.score })),
            );
            isClosed = true;
            controller.close();
            return;
          }

          // 3. Detect game end
          const gameEnded = await detectGameEnd(matchData, matchId);

          if (gameEnded) {
            controller.enqueue(encoder.encode(formatSSE('prediction_start', {})));

            try {
              // Run predictions without blocking the next poll
              const result = await runAllPredictions(matchData, selectedModels);
              if (!isClosed) {
                controller.enqueue(encoder.encode(formatSSE('prediction_result', result)));
              }
            } catch (err) {
              console.error('[Stream] Prediction failed:', err);
              if (!isClosed) {
                controller.enqueue(
                  encoder.encode(formatSSE('error', { message: 'AI Prediction failed' })),
                );
              }
            }
          }

          // 4. Schedule next poll dynamically
          const interval = getPollingInterval(matchData);
          if (!isClosed) pollTimer = setTimeout(poll, interval);
        } catch (error) {
          console.error('[Stream] Poll failed:', error);
          if (!isClosed) {
            controller.enqueue(encoder.encode(formatSSE('error', { message: 'Poll failed' })));
            pollTimer = setTimeout(poll, 10000); // Backoff
          }
        }
      };

      // Start polling
      poll();

      // Keep-alive heartbeat every 30s to prevent connection dropping
      const heartbeatInterval = setInterval(() => {
        if (!isClosed) {
          controller.enqueue(encoder.encode(formatSSE('heartbeat', { timestamp: Date.now() })));
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Required for some CDNs to flush SSE chunks immediately
      'X-Accel-Buffering': 'no',
    },
  });
}
