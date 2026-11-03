import { type NextRequest } from 'next/server';
import { registry } from '@/services/tennis/providers/registry';
import { ProviderError, logProviderError } from '@/services/tennis/providers/errors';
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
  const { matchId: rawMatchId } = await context.params;
  // Decode once; a malformed escape (e.g. "%E0") can never match
  let matchId: string | null;
  try {
    matchId = decodeURIComponent(rawMatchId);
  } catch {
    matchId = null;
  }
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
        if (!isClosed && matchId !== null) pollTimer = setTimeout(poll, delayMs, matchId);
      };

      request.signal.addEventListener('abort', cleanup);

      async function poll(id: string) {
        if (isClosed) return;

        try {
          // 1. Fetch current data
          const matchData = await registry.getMatchById(id);

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
          const gameEnded = await detectGameEnd(matchData, id);

          if (gameEnded) {
            send('prediction_start', {});
            try {
              const result = await runAllPredictions(matchData, selectedModels);
              send('prediction_result', result);
            } catch (err) {
              console.error('[Stream] Prediction failed:', err);
              // Its own event: a generic `error` looks like a dropped connection
              send('prediction_failed', {});
            }
          }

          // 4. Schedule next poll dynamically
          schedulePoll(getPollingInterval(matchData));
        } catch (error) {
          if (error instanceof ProviderError) {
            logProviderError(error);
            if (error.kind === 'auth' || error.kind === 'rate_limit') {
              send('source_unavailable', { providerId: error.providerId });
              cleanup();
              return;
            }
          } else {
            console.error('[Stream] Poll failed unexpectedly');
          }
          send('error', { message: 'Poll failed' });
          schedulePoll(RETRY_DELAY_MS); // Backoff
        }
      }

      // The request may already be aborted before the stream starts
      if (request.signal.aborted) {
        cleanup();
        return;
      }

      if (matchId === null) {
        send('error', { message: 'Match not found' });
        cleanup();
        return;
      }

      void poll(matchId);
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
