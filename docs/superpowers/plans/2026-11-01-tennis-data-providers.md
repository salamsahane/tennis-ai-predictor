# Tennis Data Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct SportRadar dependency with a provider layer. It has adapters for SportRadar, api-tennis.com and replay; health-based failover; recording and replay of real matches; and stats that may be missing.

**Architecture:**
- Each provider implements `TennisDataProvider` and reports failures as a typed `ProviderError`.
- A registry orders the providers from config, skips unhealthy ones (health state lives in Redis), and resolves namespaced match IDs (`<providerId>:<nativeId>`).
- Routes and UI only talk to the registry.

**Tech Stack:** Next 16.2 App Router, TypeScript strict, axios (already installed), Upstash Redis or the in-memory fallback (`lib/redis.ts`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-tennis-data-providers-design.md`

## Global Constraints
- No new runtime dependencies.
- Env vars:
  - `TENNIS_PROVIDERS`: default `sportradar,apitennis,replay`
  - `APITENNIS_API_KEY`
  - `RECORD_MATCHES`: `1` enables recording
  - `REPLAY_DIR`: default `data/replays`
  - `REPLAY_SPEED`: default `1`
  - `REPLAY_EPOCH`: default `0`
  - Add each one to `.env.example` in the task that introduces it.
- Match ID format: `<providerId>:<nativeId>`. Provider ids are exactly `sportradar`, `apitennis`, `replay`.
- Health cool-downs:
  - `auth` → 3,600,000 ms
  - `rate_limit` → `retryAfterMs` or 60,000 ms
  - `transient` → 15,000 ms after 3 consecutive failures
  - `not_found` → no change
  - Any success resets the counter.
- UI copy, exactly: `Source indisponible`, `Replay`, `Live · <label>`, and `n/d` for a missing stat in prompts.
- Never log an axios error object, request config or URL. Log only `{ providerId, kind, status, message }`.
- Read `node_modules/next/dist/docs/` before touching route or page APIs (AGENTS.md).
- Commits follow the project's `commit-msg` skill format (`type(scope): subject` plus bullets, no attribution trailer).

## Review Focus
1. **A provider returns HTTP 200 with an error body** (api-tennis.com style `{ success: 0 }`). It must become a `ProviderError`, not an empty "no matches" list. Pinned in Task 8 (`success 0 body → auth ProviderError`).
2. **Every live provider is unhealthy.** Search still lists the replays and reports `unavailableSources`, and doesn't return a 500. Pinned in Task 7 (`all live down → replays + unavailable`).
3. **A match ID containing `:` inside the native part** (SportRadar's `sr:sport_event:123`). The registry must split only on the first `:`. Pinned in Task 7 (`splits on first colon only`).
4. **A replay whose position wraps past the end.** It must loop back to the first snapshot, not return `null`. Pinned in Task 6 (`wraps around`).
5. **Point-by-point with fewer than 10 points played.** "Points won in the last 10" must count only the points available, never NaN. Pinned in Task 5 (`fewer than 10 points`).

---

### Task 1: Provider contract and error classification

**Files:**
- Create: `services/tennis/providers/types.ts`, `services/tennis/providers/errors.ts`
- Test: `services/tennis/providers/errors.test.ts`

**Interfaces:**
- Produces from `types.ts`:
  - `type ProviderKind = 'live' | 'replay'`
  - `interface SourceInfo { providerId: string; label: string; kind: ProviderKind }`
  - `interface TennisDataProvider { id: string; label: string; kind: ProviderKind; listLiveMatches(): Promise<MatchSearchResult[]>; getMatch(nativeId: string): Promise<MatchData | null> }`
- Produces from `errors.ts`:
  - `type ProviderErrorKind = 'auth' | 'rate_limit' | 'transient' | 'not_found'`
  - `class ProviderError extends Error { providerId: string; kind: ProviderErrorKind; status?: number; retryAfterMs?: number }`
  - `toProviderError(providerId: string, err: unknown): ProviderError`
  - `logProviderError(e: ProviderError): void`

- [ ] **Step 1: Write the failing tests.** Build fake axios-like errors as `{ isAxiosError: true, response: { status, headers } }`.
  - `401 → auth` and `403 → auth`.
  - `429 with Retry-After: 30 → rate_limit, retryAfterMs 30000`.
  - `500 → transient`. `no response (ECONNABORTED) → transient`.
  - `404 → not_found`.
  - `passes ProviderError through unchanged`.
  - `logProviderError never prints the api key`: build an error whose config URL contains `APIkey=SECRET`, spy on `console.error`, and assert no logged argument contains `SECRET`.
- [ ] **Step 2: Run `npx vitest run services/tennis/providers/errors.test.ts`.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement both files.**
  - `toProviderError` reads `response.status` and the `retry-after` header (seconds → ms).
  - `logProviderError` calls `console.error('[Provider]', { providerId, kind, status, message })`.
- [ ] **Step 4: Run the test, then `npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(providers): add provider contract and error classification`.

### Task 2: Optional stats, source info and game winners in the data model

**Files:**
- Modify:
  - `types/tennis.types.ts`: the `MatchData`, `PlayerStats` and `MatchSearchResult` types
  - `services/ai/prompt.builder.ts`
  - `components/match/StatsPanel.tsx`
  - `lib/stats.ts`
  - every other compile error `npm run typecheck` reports
- Test: `services/ai/prompt.builder.test.ts`, `lib/stats.test.ts`

**Interfaces:**
- Produces:
  - Every number field in `PlayerStats` becomes `number | null`.
  - `MatchData.surface: 'clay' | 'hard' | 'grass' | 'indoor' | null`.
  - `MatchData.source: SourceInfo`.
  - `MatchData.gameWinners?: Array<{ set: number; game: number; winner: 'home' | 'away' }>`.
  - `MatchSearchResult.source: SourceInfo`.
  - `formatStat(v: number | null, suffix?: string): string` in `lib/stats.ts`. It returns `'n/d'` for null.

- [ ] **Step 1: Write the failing tests.**
  - `prompt.builder.test.ts`, `missing stats print n/d`: set `aces: null` for home. The prompt contains `Aces : n/d`. The existing tests' fixture gains `source` and still passes.
  - `stats.test.ts`, `formatStat`: `formatStat(null) === 'n/d'`, `formatStat(65, '%') === '65%'`, `formatStat(0) === '0'`.
- [ ] **Step 2: Run `npx vitest run services/ai lib`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Widen the types.
  - In `prompt.builder.ts`, route every stat replacement through `formatStat`. Momentum lines that need a null value are skipped, not printed with `n/d`.
  - In `StatsPanel`, skip a row when both values are null. For a row where one value is null, `compareStat` and `shareOfTotal` treat null as 0, but the cell shows `n/d`.
  - In the SportRadar normalizer, keep current values and set `source: { providerId: 'sportradar', label: 'SportRadar', kind: 'live' }`.
  - Fix the remaining typecheck errors with the null-aware helpers. Don't change behaviour.
- [ ] **Step 4: Run `npm run typecheck && npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(model): allow missing stats and track data source`.

### Task 3: Provider health

**Files:**
- Create: `services/tennis/providers/health.ts`
- Test: `services/tennis/providers/health.test.ts`

**Interfaces:**
- Consumes: `ProviderError` (Task 1), `redis` from `lib/redis.ts`.
- Produces:
  - `isHealthy(providerId: string): Promise<boolean>`
  - `reportFailure(e: ProviderError): Promise<void>`
  - `reportSuccess(providerId: string): Promise<void>`
- Redis keys: `provider:<id>:down_until` (epoch ms) and `provider:<id>:failures`.

- [ ] **Step 1: Write the failing tests.** Use `vi.useFakeTimers()` and `vi.setSystemTime`, with the in-memory redis (no Upstash env in tests).
  - `auth → unhealthy for 1h then healthy`: unhealthy at +3,599,999 ms, healthy at +3,600,001 ms.
  - `rate_limit uses retryAfterMs`: 30,000 ms. Also `rate_limit default 60s`.
  - `transient needs 3 consecutive failures`: healthy after 2, unhealthy after 3, healthy again after 15,001 ms.
  - `success resets transient counter`.
  - `not_found does not affect health`.
- [ ] **Step 2: Run `npx vitest run services/tennis/providers/health.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Store `down_until` with `ex` set to ceil(cooldown/1000) + 1 seconds, so stale keys expire.
  - `isHealthy` compares `Date.now()` with `down_until`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(providers): track provider health with cool-downs`.

### Task 4: SportRadar adapter

**Files:**
- Create: `services/tennis/providers/sportradar.provider.ts`, `services/tennis/providers/__fixtures__/sportradar-summary.json` (a hand-built `SportRadarSummary`: live, 2 sets, game state, statistics totals for both players)
- Modify: `services/tennis/sportradar.client.ts`. Fetch failures throw `toProviderError('sportradar', err)` instead of logging and returning `[]` or `null`. Replace both `console.error(..., error)` calls with `logProviderError`; today they dump the axios config, including `api_key`. Keep the 10 s cache, and keep the stale-cache fallback only for `transient`. Delete `searchLiveMatches`; filtering moves to Task 9.
- Modify: `services/tennis/match.service.ts`. `normalizeMatchData` stays and is used by the adapter. `getMatchData` is deleted in Task 9, once nothing calls it.
- Test: `services/tennis/providers/sportradar.provider.test.ts`

**Interfaces:**
- Produces: `sportradarProvider: TennisDataProvider` with `id 'sportradar'`, `label 'SportRadar'`, `kind 'live'`.
  - Native IDs are the numeric part. `getMatch('123')` requests `sr:sport_event:123`.
  - `listLiveMatches()` returns results whose `id` is `sportradar:<numeric>` and whose `source` is set.

- [ ] **Step 1: Write the failing tests.** Use `vi.mock('axios')` returning a fake client, and mock `@/lib/redis` with an in-memory map.
  - `maps fixture to MatchData`: players, period scores, serving, and `source.providerId === 'sportradar'`.
  - `getMatch prefixes sr:sport_event`: asserts the requested path contains `sr:sport_event:123`.
  - `403 throws auth ProviderError`.
  - `listLiveMatches ids are namespaced`: `id` matches `/^sportradar:\d+$/`.
- [ ] **Step 2: Run `npx vitest run services/tennis/providers/sportradar.provider.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement** the adapter and the client changes. Move the summary-to-`MatchSearchResult` mapping from the deleted `searchLiveMatches` into the adapter.
- [ ] **Step 4: Run `npm run typecheck && npm test`.** Expected: the new tests PASS. The search route fails to compile until Task 9. Temporarily import the adapter's `listLiveMatches` there and filter inline, so typecheck passes.
- [ ] **Step 5: Commit** `feat(providers): move sportradar behind the provider interface`.

### Task 5: Derived stats from point-by-point data

**Files:**
- Create: `services/tennis/providers/derive-stats.ts`
- Test: `services/tennis/providers/derive-stats.test.ts`

**Interfaces:**
- Produces:
  - `interface GameRecord { set: number; game: number; server: 'home' | 'away'; winner: 'home' | 'away'; pointWinners: Array<'home' | 'away'> }`
  - `deriveStats(games: GameRecord[]): { home: DerivedStats; away: DerivedStats }`, where `DerivedStats = { pointsWonLast10: number; totalPointsWon: number; serviceGamesWon: number; returnPointsWon: number }`
  - `gameWinners(games: GameRecord[]): NonNullable<MatchData['gameWinners']>`

- [ ] **Step 1: Write the failing tests.**
  - `counts last 10 across games`: 3 games of 4 points. The last 10 point winners decide the count.
  - `fewer than 10 points`: 6 points total, with home winning 4, gives `home.pointsWonLast10 === 4` and no NaN.
  - `service games won counts held games only`.
  - `return points = points won on opponent serve`.
  - `gameWinners lists set/game/winner in order`.
- [ ] **Step 2: Run the test.** Expected: FAIL.
- [ ] **Step 3: Implement.** Pure functions. Flatten the point winners in game order for the last 10.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(providers): derive stats and game winners from point-by-point`.

### Task 6: Replay provider and recorder

**Files:**
- Create: `services/tennis/providers/replay.provider.ts`, `services/tennis/providers/recorder.ts`, `services/tennis/providers/__fixtures__/replays/demo-match.json` (3 snapshots at t = 0, 10,000 and 20,000 ms; `id: "demo-match"`)
- Create: `data/replays/.gitkeep`
- Test: `services/tennis/providers/replay.provider.test.ts`, `services/tennis/providers/recorder.test.ts`

**Interfaces:**
- Produces:
  - `interface Recording { id: string; label: string; players: { home: string; away: string }; tournament: string; surface: MatchData['surface']; snapshots: Array<{ t: number; data: MatchData }> }`
  - `createReplayProvider(opts?: { dir?: string; speed?: number; epoch?: number }): TennisDataProvider`, with `id 'replay'`, `label 'Replay'`, `kind 'replay'`. Defaults come from `REPLAY_DIR`, `REPLAY_SPEED` and `REPLAY_EPOCH`.
  - `recordSnapshot(matchId: string, data: MatchData, opts?: { dir?: string; now?: number }): Promise<void>`. It's a no-op unless `process.env.RECORD_MATCHES === '1'`. The file is `<dir>/<matchId with ':' → '-'>.json`, and `t` = now − the first snapshot's timestamp, which is stored as `startedAt`.

- [ ] **Step 1: Write the failing tests.**
  - Replay, `returns snapshot at position`: dir is the fixture dir, epoch is 0. At `vi.setSystemTime(15000)`, `getMatch('demo-match')` returns the t = 10,000 snapshot, with `source.kind === 'replay'` and `id === 'replay:demo-match'`.
  - Replay, `wraps around`: at time 25,000 with duration 20,000, the position is 5,000, so the t = 0 snapshot.
  - Replay, `speed multiplies position`: speed 2 at time 6,000 gives position 12,000, so the t = 10,000 snapshot.
  - Replay, `unknown id → null`, and `listLiveMatches lists every recording` with `source.kind 'replay'`.
  - Recorder, `no-op without RECORD_MATCHES`.
  - Recorder, `appends snapshots with relative t` (tmp dir from `fs.mkdtempSync(os.tmpdir())`, `vi.stubEnv('RECORD_MATCHES','1')`): two calls at now = 1000 and 4000 give snapshots t = 0 and t = 3000.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The replay provider reads the files with `fs.readdirSync` on first use and caches them in memory.
  - Each returned snapshot is the recorded `MatchData` with `status` forced to `'live'` (so a recorded `final` snapshot doesn't end the stream mid-loop), plus `id` and `source` overwritten.
  - Add `RECORD_MATCHES`, `REPLAY_DIR`, `REPLAY_SPEED` and `REPLAY_EPOCH` to `.env.example`.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(providers): add replay provider and match recorder`.

### Task 7: Registry with failover

**Files:**
- Create: `services/tennis/providers/registry.ts`
- Test: `services/tennis/providers/registry.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4 and 6. The api-tennis provider joins in Task 8 via the same factory map.
- Produces:
  - `createRegistry(providers: TennisDataProvider[]): Registry`, plus the default `registry`, built from `TENNIS_PROVIDERS` against `{ sportradar, apitennis, replay }`. Unknown ids are ignored.
  - `interface Registry { listLiveMatches(): Promise<{ matches: MatchSearchResult[]; unavailableSources: string[] }>; getMatchById(matchId: string): Promise<MatchData | null> }`
  - `parseMatchId(matchId: string): { providerId: string; nativeId: string }`. It splits on the first `:` only and throws `ProviderError(kind 'not_found')` when there's no `:` or the provider is unknown.

- [ ] **Step 1: Write the failing tests** with fake providers built from `vi.fn()`.
  - `uses first healthy live provider`: A throws an auth `ProviderError`, so B's matches are returned, and `unavailableSources` contains A's label.
  - `skips provider marked unhealthy without calling it`: after the auth failure above, a second `listLiveMatches()` doesn't call A.
  - `replays always appended`.
  - `all live down → replays + unavailable`.
  - `splits on first colon only`: `parseMatchId('sportradar:sr:sport_event:1')` gives `{ providerId: 'sportradar', nativeId: 'sr:sport_event:1' }`.
  - `getMatchById reports success and failure to health`.
  - `getMatchById records snapshot for live providers`: mock `recordSnapshot`, assert it's called for `live` providers and not for `replay`.
  - `getMatchById rethrows auth/rate_limit ProviderError` (the stream route needs the kind).
- [ ] **Step 2: Run the test.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add `TENNIS_PROVIDERS` to `.env.example`.
- [ ] **Step 4: Run `npm run typecheck && npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(providers): add registry with health-based failover`.

### Task 8: api-tennis.com adapter

**Files:**
- Create: `services/tennis/providers/apitennis.provider.ts`, `services/tennis/providers/__fixtures__/apitennis-livescore.json`
- Test: `services/tennis/providers/apitennis.provider.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3 (indirectly) and 5.
- Produces: `apitennisProvider: TennisDataProvider` with `id 'apitennis'` and `label 'api-tennis'`, registered in the registry's factory map.

**Request and field mapping**
- Requests: `GET https://api.api-tennis.com/tennis/?method=get_livescore&APIkey=<key>[&match_key=<id>]`. The body is `{ success: 1, result: [...] }`.
- Field mapping:
  - `event_key` → native id
  - `event_first_player` / `event_second_player` → home / away
  - `scores[]` (`score_first`, `score_second`, `score_set`) → `periodScores`
  - `event_game_result` (`"30 - 15"`) → `currentGame`
  - `event_serve` (`"First Player"` / `"Second Player"`) → `serving` and `nextGame.server`
  - `event_status` (`"Finished"` → `final`) with `event_live === "1"` → `live`
  - `tournament_name` → `tournament`
  - `statistics[]` → `PlayerStats`, via `STAT_NAME_MAP`, matched on `player_key` against `first_player_key`
- Point-by-point: `pointbypoint[]` → `GameRecord[]`. A point's winner is the player whose side of `score` advanced from the previous point. The game winner is `serve_winner`.
  - Then `deriveStats()` fills `pointsWonLast10`, `totalPointsWon`, `serviceGamesWon` and `returnPointsWon` where `STAT_NAME_MAP` gave null.
  - `MatchData.gameWinners` is set from `gameWinners()`.
- Tiebreak: `currentGame.tieBreak` = the current set is 6–6.
- Surface: `get_draw&tournament_key=…` → `tournament_surface`, cached in Redis for 86,400 s. If that fails, the surface is `null`.

- [ ] **Step 1: Record a real fixture.** With `APITENNIS_API_KEY` set, save one live match's `get_livescore&match_key=…` body, with the key removed, as the fixture. Build `STAT_NAME_MAP` from its actual `stat_name` values. If no key is available, use the sample from https://api-tennis.com/documentation, and ledger that the mapping must be re-checked against real data.
- [ ] **Step 2: Write the failing tests.**
  - `maps fixture to MatchData`: players, sets, game points, server, `source.providerId 'apitennis'`, id `apitennis:<event_key>`.
  - `unknown stat names → null`.
  - `derives last-10 and game winners from pointbypoint`.
  - `success 0 body → auth ProviderError`.
  - `HTTP 429 → rate_limit`.
  - `tiebreak at 6-6`.
- [ ] **Step 3: Run the test.** Expected: FAIL.
- [ ] **Step 4: Implement.** Without `APITENNIS_API_KEY`, every call throws `ProviderError(kind 'auth')`, so the registry skips the provider. Add `APITENNIS_API_KEY` to `.env.example`.
- [ ] **Step 5: Run `npm run typecheck && npm test`.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(providers): add api-tennis.com adapter`.

### Task 9: Routes use the registry

**Files:**
- Modify: `app/api/search/route.ts`, `app/api/stream/[matchId]/route.ts`, `app/api/stream/[matchId]/route.test.ts`
- Create: `lib/match-search.ts`
- Delete: `getMatchData` from `services/tennis/match.service.ts`
- Test: `lib/match-search.test.ts`, the stream route test

**Interfaces:**
- Consumes: `registry` (Task 7).
- Produces:
  - `filterMatches(matches: MatchSearchResult[], query: string): MatchSearchResult[]`. It keeps today's rule: any whitespace-separated term found in either player's name, case-insensitive.
  - The search response is `{ matches, total, unavailableSources }`.
  - A new SSE event, `source_unavailable` with `{ providerId: string }`, sent on `auth` or `rate_limit`, followed by `cleanup()`.

- [ ] **Step 1: Write the failing tests.**
  - `match-search.test.ts`: `filterMatches` matches on a partial last name, ignores case, and returns an empty list for no match.
  - Stream route, which now mocks `@/services/tennis/providers/registry`, with the existing 4 tests switched to `getMatchById`:
    - `auth error sends source_unavailable and closes`: the stream text contains `event: source_unavailable` and `vi.getTimerCount() === 0`.
    - `transient error keeps retrying`: a 10 s timer stays pending.
- [ ] **Step 2: Run `npx vitest run lib app/api`.** Expected: FAIL.
- [ ] **Step 3: Implement both routes.**
  - In the stream route, `poll()` catches `ProviderError`. `auth`/`rate_limit` → `send('source_unavailable', …)` then `cleanup()`. Anything else → the existing error path.
  - Remove the temporary search filter from Task 4.
- [ ] **Step 4: Run `npm run check`.** Expected: PASS (0 lint errors).
- [ ] **Step 5: Commit** `feat(api): route search and stream through the provider registry`.

### Task 10: UI for namespaced IDs, source badge and unavailable states

**Files:**
- Modify:
  - `components/match/MatchCard.tsx`: link to `/match/${encodeURIComponent(match.id)}` and show a source badge.
  - `app/match/[matchId]/page.tsx`: use `decodeURIComponent(params.matchId)` as-is (drop the `sr:sport_event:` building) and show a badge from `matchData.source`.
  - `hooks/useMatchStream.ts`: handle `source_unavailable` by setting `error` to `'Source indisponible'` and closing.
  - `hooks/useMatchSearch.ts` and `components/match/PlayerSearch.tsx`: show `unavailableSources`.
- Create: `components/match/SourceBadge.tsx`
- Test: `lib/source-label.test.ts` for a pure helper in `lib/source-label.ts`

**Interfaces:**
- Produces: `sourceLabel(source: SourceInfo): string`. It returns `'Replay'` when `kind === 'replay'`, otherwise `` `Live · ${source.label}` ``.

- [ ] **Step 1: Write the failing test.** `sourceLabel({ providerId: 'replay', label: 'Replay', kind: 'replay' }) === 'Replay'` and `sourceLabel({ providerId: 'apitennis', label: 'api-tennis', kind: 'live' }) === 'Live · api-tennis'`.
- [ ] **Step 2: Run the test.** Expected: FAIL.
- [ ] **Step 3: Implement the helper, the badge and the UI changes.**
  - The badge uses the primary colour for live and the muted style for replay.
  - The search notice text: `Sources indisponibles : <labels>`, shown only when the list is non-empty.
- [ ] **Step 4: Run `npm run check && npm run build`.** Expected: PASS.
- [ ] **Step 5: Run an end-to-end check in replay mode.**
  - Run `TENNIS_PROVIDERS=replay REPLAY_DIR=services/tennis/providers/__fixtures__/replays npm run dev`.
  - Search for a player name from `demo-match`, then open the match. Confirm the `Replay` badge and that the score changes as the clock moves.
  - Then run with `TENNIS_PROVIDERS=sportradar,replay`. The expired key means search shows `Sources indisponibles : SportRadar` and still lists the replay.
- [ ] **Step 6: Commit** `feat(ui): show data source and handle unavailable providers`.

### Task 11: First real replay recording (needs the api-tennis.com trial key)

- [ ] **Step 1: Record a match.** With `APITENNIS_API_KEY` set and `RECORD_MATCHES=1`, open one live match in the dev app for at least 20 minutes, so several games end.
- [ ] **Step 2: Inspect the recording.** The file in `data/replays/` must have increasing `t` values and contain no API key (`grep -i apikey` returns nothing).
- [ ] **Step 3: Check it replays.** With `TENNIS_PROVIDERS=replay`, confirm it shows up in search and plays back.
- [ ] **Step 4: Commit** `chore(replays): add first recorded match`.
- If no key is available, skip this task and ledger it as pending. The app still works with the fixture recording via `REPLAY_DIR`.
