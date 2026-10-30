import { type NextRequest } from 'next/server';
import { getMatchData } from '@/services/tennis/match.service';
import { detectGameEnd, getPollingInterval } from '@/services/tennis/game-state.service';
import { runAllPredictions } from '@/services/ai/orchestrator';
import type { AIModel } from '@/types/ai.types';

// Vercel config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_MODELS: AIModel[] = ['claude', 'gpt4o', 'gemini'];
const RETRY_DELAY_MS = 10000;
const HEARTBEAT_MS = 30000;

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Parse the `models` query param; undefined means "use the default selection". */
function parseModelsParam(param: string | null): AIModel[] | undefined {
  if (!param) return undefined;
  return param.split(',').filter((m): m is AIModel => ALL_MODELS.includes(m as AIModel));
}

export async function GET(request: NextRequest, context: { params: Promise<{ matchId: string }> }) {
  // Await the params object per Next.js 15 routing conventions
  const { matchId } = await context.params;
  const selectedModels = parseModelsParam(request.nextUrl.searchParams.get('models'));

  const encoder = new TextEncoder();
  // Set in start(); also run when the runtime cancels the body
  let stopStream = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;
      let pollTimer: NodeJS.Timeout | undefined;

      // No-op once the stream is closed (client gone or match over)
      const send = (event: string, data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(formatSSE(event, data)));
        } catch {
          // Body was cancelled before abort fired
          cleanup();
        }
      };

      // Keep-alive heartbeat to prevent the connection from dropping
      const heartbeatInterval = setInterval(
        () => send('heartbeat', { timestamp: Date.now() }),
        HEARTBEAT_MS,
      );

      // Idempotent: safe to call from abort, match end and error paths
      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearTimeout(pollTimer);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime
        }
      };

      stopStream = cleanup;

      const schedulePoll = (delayMs: number) => {
        if (!isClosed) pollTimer = setTimeout(poll, delayMs);
      };

      request.signal.addEventListener('abort', cleanup);

      async function poll() {
        if (isClosed) return;

        try {
          // 1. Fetch current data
          const matchData = await getMatchData(matchId);

          if (!matchData) {
            send('error', { message: 'Match not found' });
            // Try again later in case it was a temporary API failure
            schedulePoll(RETRY_DELAY_MS);
            return;
          }

          // 2. Send match update
          send('match_update', matchData);

          if (matchData.status === 'final') {
            send('match_ended', { final_score: matchData.score });
            cleanup();
            return;
          }

          // 3. Detect game end. Predictions are awaited, so the next poll
          // is scheduled only after they finish.
          const gameEnded = await detectGameEnd(matchData, matchId);

          if (gameEnded) {
            send('prediction_start', {});
            try {
              const result = await runAllPredictions(matchData, selectedModels);
              send('prediction_result', result);
            } catch (err) {
              console.error('[Stream] Prediction failed:', err);
              send('error', { message: 'AI Prediction failed' });
            }
          }

          // 4. Schedule next poll dynamically
          schedulePoll(getPollingInterval(matchData));
        } catch (error) {
          console.error('[Stream] Poll failed:', error);
          send('error', { message: 'Poll failed' });
          schedulePoll(RETRY_DELAY_MS); // Backoff
        }
      }

      // The request may already be aborted before the stream starts
      if (request.signal.aborted) {
        cleanup();
        return;
      }

      void poll();
    },
    cancel() {
      stopStream();
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
