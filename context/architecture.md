# Architecture

## Stack

| Layer       | Technology                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework   | **Next.js 16.2.6**, App Router, Turbopack. It has breaking changes compared with older Next.js; read `node_modules/next/dist/docs/` before using a Next API.                  |
| UI          | React 19.2, Tailwind CSS 4, shadcn components on **Base UI** (`components/ui/`), lucide-react icons, Recharts 3                                                               |
| Language    | TypeScript (strict), path alias `@/` → repo root                                                                                                                              |
| Validation  | zod 4 (used in `/api/search` today)                                                                                                                                           |
| Storage     | Upstash Redis (`@upstash/redis`) with an in-memory fallback in [lib/redis.ts](../lib/redis.ts). Rate limiting uses `@upstash/ratelimit` (only when real Redis is configured). |
| Tennis data | api-tennis.com (primary, REST via axios), SportRadar (key expired), recorded replays                                                                                          |
| LLMs        | `@anthropic-ai/sdk` (`claude-sonnet-5-5`), `openai` (`gpt-4o`), `@google/generative-ai` (`gemini-3.8-flash`). The IDs live in [constants/models.ts](../constants/models.ts).  |
| Tests       | Vitest 5, `node` environment. Components are tested with `react-dom/server` `renderToStaticMarkup`; there is no jsdom or Testing Library.                                     |
| Tooling     | ESLint 9 (`eslint-config-next`, plus `eslint-config-prettier` last), Prettier 3 with the Tailwind plugin, Node 24 (`.nvmrc` 24.12.0, `engines >=24`)                          |

## Request flows

### Search: `GET /api/search?q=<3–100 chars>`

[app/api/search/route.ts](../app/api/search/route.ts):

1. Rate limits to 10 requests a minute per IP, only with real Redis.
2. Validates `q` with zod. A query that is too short or too long gets a 400.
3. Calls `registry.listLiveMatches()`.
4. Runs `filterMatches()` ([lib/match-search.ts](../lib/match-search.ts)) on the result.
5. Returns `{ matches, total, unavailableSources }`. `unavailableSources` holds the labels of providers that were skipped or failed.

### Match stream: `GET /api/stream/<encoded matchId>?models=claude,gpt4o,gemini`

[app/api/stream/[matchId]/route.ts](../app/api/stream/[matchId]/route.ts) is an SSE `ReadableStream` that **runs one poll loop per open connection**.

- **Setup:** it decodes the ID once (a malformed escape sends "Match not found" and closes) and starts a 30 s heartbeat.
- **Each poll:**
  1. Calls `registry.getMatchById(id)`.
  2. Sends `match_update`.
  3. If the match is `final`, sends `match_ended` and closes.
  4. Calls `detectGameEnd(match, id)` ([game-state.service.ts](../services/tennis/game-state.service.ts)). It compares total games with the Redis key `match:<id>:lastGamesCount`, and only an increase counts.
  5. When a game ended:
     1. Sends `prediction_start`.
     2. Awaits `runAllPredictions()`.
     3. Sends `prediction_result`, or `prediction_failed` if every model failed.
  6. Schedules the next poll with `getPollingInterval()`: 5 s at deuce or in a tiebreak, otherwise 10 s.
- **Errors:**
  - `ProviderError` of kind `auth` or `rate_limit`: sends `source_unavailable { providerId }` and closes.
  - Any other poll error: sends `error { message: 'Poll failed' }` and retries after 10 s.
- **Cleanup:** one idempotent `cleanup()` runs on abort, on body cancel and on close.

SSE events the client understands, handled in [hooks/useMatchStream.ts](../hooks/useMatchStream.ts):

| Event                | Payload                                           | Client effect                                                                                                         |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `match_update`       | `MatchData`                                       | Updates the score and stats, and sets status "connecté"                                                               |
| `prediction_start`   | `{}`                                              | Shows the "Analyse en cours…" spinner                                                                                 |
| `prediction_result`  | `OrchestrationResult` (= `PredictionEvent` shape) | Prepends it to the history, de-duplicated by game and set number                                                      |
| `prediction_failed`  | `{}`                                              | Stops the spinner and shows "Prédiction indisponible"                                                                 |
| `match_ended`        | `{ final_score }`                                 | Disconnects                                                                                                           |
| `source_unavailable` | `{ providerId }`                                  | Shows the "Source indisponible" error page                                                                            |
| `error`              | `{ message }`                                     | `'Match not found'` shows the error page. Any other message, or a native connection error, sets status "Reconnexion…" |
| `heartbeat`          | `{ timestamp }`                                   | Ignored                                                                                                               |

**Never send a custom `error` event for a non-connection problem.** The client can't tell it apart from a dropped connection; see [decisions.md](decisions.md#post-3a-fix).

## Provider layer: `services/tennis/providers/`

Each data source is an adapter behind one interface ([types.ts](../services/tennis/providers/types.ts)):

```ts
interface TennisDataProvider {
  id: string;
  label: string;
  kind: 'live' | 'replay';
  listLiveMatches(): Promise<MatchSearchResult[]>;
  getMatch(nativeId: string): Promise<MatchData | null>;
}
```

| File                                                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [errors.ts](../services/tennis/providers/errors.ts)                           | `ProviderError(providerId, kind, message, status?, retryAfterMs?)`, with kind `auth`, `rate_limit`, `transient` or `not_found`.<br>`toProviderError()` maps the errors: 401/403 → auth, 429 → rate_limit (numeric `Retry-After`), 404 → not_found, everything else → transient. It builds messages instead of copying them.<br>`logProviderError()` logs only `{providerId, kind, status, message}`, never axios config or URLs, because those contain the API key.                                                                                                                                           |
| [health.ts](../services/tennis/providers/health.ts)                           | Redis keys `provider:<id>:down_until` and `provider:<id>:failures`.<br>Cool-downs: auth 1 h; rate_limit `retryAfterMs` or 60 s; transient 15 s after 3 failures in a row (the counter has a 300 s TTL).<br>A success resets the counter.                                                                                                                                                                                                                                                                                                                                                                      |
| [registry.ts](../services/tennis/providers/registry.ts)                       | Provider order comes from `TENNIS_PROVIDERS` (default `sportradar,apitennis,replay`; unknown IDs are ignored).<br>`listLiveMatches()` uses the **first healthy live** provider and appends **every replay** entry. A failure is caught, reported to health, logged, and added to `unavailableSources`.<br>`getMatchById()`:<ul><li>splits the namespaced ID;</li><li>does **not** consult health;</li><li>records a live snapshot if `RECORD_MATCHES=1`;</li><li>returns `null` for `not_found`, and rethrows the other kinds.</li></ul>Health calls are best-effort: a Redis failure never breaks a request. |
| [sportradar.provider.ts](../services/tennis/providers/sportradar.provider.ts) | Wraps [sportradar.client.ts](../services/tennis/sportradar.client.ts) (a 10 s Redis cache, with the stale cache kept only for transient errors) and `normalizeMatchData` ([match.service.ts](../services/tennis/match.service.ts)). It adds and strips the `sr:sport_event:` prefix internally.                                                                                                                                                                                                                                                                                                               |
| [apitennis.provider.ts](../services/tennis/providers/apitennis.provider.ts)   | api-tennis.com, called as `get_livescore` (all matches, or `match_key=`), with `APIkey` in the query string.<br>`STAT_NAME_MAP` was built from a real response.<br>Point winners come from the score progression, and each game's winning point is appended from `serve_winner`, because the API omits it.<br>The surface comes from `get_draw`, cached 24 h. An unknown surface is cached as the sentinel `'unknown'`.<br>A missing key throws `auth` without a network call.                                                                                                                                |
| [derive-stats.ts](../services/tennis/providers/derive-stats.ts)               | From point-by-point `GameRecord[]` it computes the points won in the last 10, total points, service games won and `gameWinners`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [replay.provider.ts](../services/tennis/providers/replay.provider.ts)         | Reads `REPLAY_DIR` (default `data/replays`) `*.json` recordings, once per process.<br>Stateless shared clock: position = ((now − `REPLAY_EPOCH`) × `REPLAY_SPEED`) mod duration, where duration is the last snapshot's `t`.<br>It forces status `live` and uses IDs `replay:<recording id>`.                                                                                                                                                                                                                                                                                                                  |
| [recorder.ts](../services/tennis/providers/recorder.ts)                       | When `RECORD_MATCHES=1`, it appends `{t, data}` snapshots to `REPLAY_DIR/<providerId>-<nativeId>.json`. It writes to the local filesystem, so it's for **local dev only**.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `__fixtures__/`                                                               | A real api-tennis livescore response (ATP Basel final, event 12176263), a SportRadar summary, and a demo replay.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Match IDs are namespaced everywhere:** `<providerId>:<nativeId>`, for example `apitennis:12176544` or `replay:apitennis-12176323`. They are URL-encoded in links (`/match/apitennis%3A12176544`) and decoded once by the page and the route.

**Data model** ([types/tennis.types.ts](../types/tennis.types.ts)):

- `PlayerStats` number fields are `number | null`, and `null` is displayed as `n/d` ([lib/stats.ts](../lib/stats.ts) `formatStat`). StatsPanel hides a row where both values are null.
- `surface` can be `null`.
- `MatchData.source` and `MatchSearchResult.source` are `{providerId, label, kind}`.
- `MatchData.gameWinners?` comes from point-by-point data. It's only produced by api-tennis, and nothing consumes it yet.

## AI layer: `services/ai/` and `services/verdict.engine.ts`

- [prompt.builder.ts](../services/ai/prompt.builder.ts) turns `MatchData` into the user prompt, filling in the real player names and printing missing stats as `n/d`. The system prompt is in [constants/prompts.ts](../constants/prompts.ts).
- `claude.service.ts`, `openai.service.ts` and `gemini.service.ts` are three near-duplicate services.
  - Each returns an `AIPrediction`. When its key is missing or the call fails, it **returns an error-shaped prediction instead of throwing**: `predicted_winner: 'Unknown'` and the `error` field set.
  - Claude uses `max_tokens: 4096` and `output_config: { effort: 'low' }`.
  - The JSON output is parsed with `safeJsonParse` and not validated by a schema yet (planned for 3b).
- [orchestrator.ts](../services/ai/orchestrator.ts) `runAllPredictions(match, selectedModels?)`:
  - runs the selected models in parallel, each with a timeout (`AI_TIMEOUT_MS`, default 15 s), using `Promise.allSettled`;
  - adds `disabled` placeholders for unselected models;
  - **throws `All AI prediction calls failed`** when no valid prediction remains;
  - otherwise returns `{ predictions, verdict, timestamp, game_number, set_number }`.
- [verdict.engine.ts](../services/verdict.engine.ts) `computeVerdict()`:
  - weights claude 0.35, gpt4o 0.35, gemini 0.30, renormalised over the valid predictions;
  - confidence = 60% average win probability + 40% winning vote share;
  - caps confidence at 60 with one model and 80 with two;
  - agreement is UNANIMOUS, MAJORITY or SPLIT.

## Client

- Pages:
  - [app/page.tsx](../app/page.tsx) is search ([PlayerSearch.tsx](../components/match/PlayerSearch.tsx) plus `useMatchSearch`).
  - [app/match/[matchId]/page.tsx](../app/match/[matchId]/page.tsx) is the match page. It's a client component.
- Hooks:
  - `useMatchStream` handles the EventSource.
  - `useModelSelection` keeps the selected models in localStorage key `tennis-ai-selected-models`.
  - `usePredictionHistory` computes accuracy through [lib/prediction-stats.ts](../lib/prediction-stats.ts).
- **The prediction history lives only in React state.** It isn't persisted anywhere and is lost on reload.
- Components:
  - `components/match/`: `LiveScoreBoard`, `StatsPanel`, `MatchCard`, `SourceBadge`, `GameHistory`, `PlayerSearch`.
  - `components/predictions/`: `PredictionPanel`, `VerdictCard`, `AICard`, `ConfidenceMeter`, `ModelSelector`, `PredictionHistory` (Recharts).
- Source labels come from [lib/source-label.ts](../lib/source-label.ts): "Replay" or "Live · <label>". A replay is never labelled live.
- Model colours and names come from `MODEL_CONFIG` in [lib/utils.ts](../lib/utils.ts). The tint classes are literal strings, so Tailwind can see them.

## Configuration

Environment variables are documented in [.env.example](../.env.example). Local values are in `.env.local`, which git ignores; never print or commit it.

| Group                | Variables                                                                            |
| -------------------- | ------------------------------------------------------------------------------------ |
| Tennis data          | `TENNIS_PROVIDERS`, `APITENNIS_API_KEY`, `SPORTRADAR_API_KEY`, `SPORTRADAR_BASE_URL` |
| LLMs                 | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `AI_TIMEOUT_MS`             |
| Redis                | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                 |
| Replay and recording | `RECORD_MATCHES`, `REPLAY_DIR`, `REPLAY_SPEED`, `REPLAY_EPOCH`                       |
| App                  | `NEXT_PUBLIC_APP_URL`                                                                |

In [next.config.ts](../next.config.ts):

- `serverExternalPackages` lists the three LLM SDKs.
- `outputFileTracingIncludes` ships `data/replays/**/*.json` with `/api/search` and `/api/stream/[matchId]`, because the replay files are read with `fs` at runtime.
- `turbopack.root` is `process.cwd()`.
