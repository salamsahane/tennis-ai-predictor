# Known issues, limitations and risks

This file was checked against the code on 2026-11-03. When you fix an item, remove it here and record the fix in [progress.md](progress.md).

## Blocking right now (environment)

- **No LLM works:**
  - `ANTHROPIC_API_KEY` is empty in `.env.local`.
  - OpenAI returns 429 "You have no credits remaining".
  - Gemini (`gemini-3.8-flash`) returned 503 "high demand" on 2026-11-02 and 2026-11-03, which may be temporary.
  - Result: every prediction ends in `prediction_failed`, and a successful prediction hasn't been seen end to end since 3a.
- **SportRadar:** its trial key is expired and every call returns 403. The registry skips it, and search reports `unavailableSources: ["SportRadar"]`.
- **api-tennis.com:** it runs on a 14-day trial whose exact start date wasn't recorded (around 2026-10-31). Once the trial ends, only replays remain.

## Functional gaps (for sub-project 3b)

- **Real accuracy:** nothing sets `PredictionEvent.actual_winner` or `was_correct`, so accuracy is always "en attente". `MatchData.gameWinners` exists, but nothing consumes it.
- **Polling:** each SSE connection runs its own poll loop and its own LLM calls, so N viewers cost N× the provider and LLM calls.
- **The game-end key is shared between viewers.** `detectGameEnd` reads and then writes `match:<id>:lastGamesCount` on every poll ([game-state.service.ts](../services/tennis/game-state.service.ts)). With two viewers, the first poll after a game end updates the key, and the other stream never sees the increase, so it gets no prediction.
- **History:** the prediction history lives only in React state and is lost on reload.
- **LLM output:** it is parsed with `safeJsonParse` and not validated by a schema. The three AI services are near-duplicates. Verdict votes compare `predicted_winner` as raw trimmed strings, so name variants split the vote.

## Bugs (small, known)

- **Malformed match URL:** the match page calls `decodeURIComponent(params.matchId)` without a guard ([app/match/[matchId]/page.tsx](../app/match/[matchId]/page.tsx)), so a malformed escape crashes the page. The API route handles it.
- **"Pts gagnés s/ 2e serv.":** it showed 100% for both players after 7 games in the 2026-11-02 live test. That's possible this early, but it could be a mapping error in `STAT_NAME_MAP`. **Unverified.**

## Unverified assumptions (api-tennis)

- **Tiebreaks:** tiebreak point parsing was never tested on real data, because no recording has a tiebreak. A tiebreak is inferred when the set is at 6–6.
- **Finished and unknown matches:** what `get_livescore&match_key=` returns for them is unknown. Every non-1004 error body is treated as `not_found` in `getMatch`.
- **"Last 10 balls":** assumed to mean points won in the last 10.
- **Error codes:** the real codes for quota or "no such match" are unknown, because the `cod` isn't logged.
- **2nd-serve %:** there is no 2nd-serve-percentage stat, so it stays null.

## Deferred minor findings (3a final review)

None of these affects normal use.

- **Quota:**
  - search calls api-tennis `get_livescore` every time, with no cache;
  - provider errors are logged twice in some paths;
  - the api-tennis `cod` isn't logged.
- **Tiebreaks and parsing:**
  - points past 14–14 in a tiebreak can be credited to the wrong player (rank collision);
  - a missing server defaults to home;
  - the direct match lookup doesn't exclude doubles.
- **Health:**
  - the transient counter is read-then-write, not atomic, so concurrent failures can be undercounted;
  - a short cool-down can overwrite an active 1 h auth cool-down;
  - `Retry-After` is parsed only in its number form, not as an HTTP date.
- **Registry and config:**
  - an empty native ID or a duplicated ID in `TENNIS_PROVIDERS` isn't rejected;
  - the provider ID list is written twice (`KNOWN_PROVIDER_IDS` and `factories` in [registry.ts](../services/tennis/providers/registry.ts)).
- **Replay and recorder:**
  - recordings are read once per process;
  - snapshots are assumed to be sorted by `t`;
  - two concurrent recordings of the same match can clash (local dev only);
  - recorder tests leave temp directories behind;
  - the only recording is short (4 games, about 20 minutes).
- **UI:**
  - the "Sources indisponibles" notice isn't announced to screen readers;
  - the replay badge has redundant styling.
- **Build:** the route key in `outputFileTracingIncludes` (`'/api/stream/\[matchId\]'`) works but isn't in the documented form. If it stops matching, replays disappear from deployed builds.
- **Missing tests:**
  - the SportRadar stale-cache fallback;
  - some 429 and Retry-After cases;
  - the search route's `unavailableSources`;
  - the match page header text;
  - the `useMatchStream` hook. There is no React test environment; see [architecture.md](architecture.md#stack).

## Technical debt and hygiene

- **Lint:** 7 `no-unused-vars` warnings, which existed before this work (unused icons, `idx`, `bgClass`, catch parameters). `npm run check` still passes.
- **Hook lint exceptions:** two `react-hooks/set-state-in-effect` exceptions (in `useMatchStream` and `useModelSelection`) are planned to move in sub-project 3/4.
- **Untracked folders:** `.superpowers/` (superpowers skill workspaces) and `.playwright-mcp/` (browser test output) are **not ignored by git**. Delete them after use, or add them to `.gitignore`; that's a code change, so ask first.
- **`.env.local`:** it still has `POLL_INTERVAL_MS`, which the code no longer reads.
- **Docs:** `README.md` is still the create-next-app default (sub-project 5). [tennis-ai-predictor-spec.md](../tennis-ai-predictor-spec.md) is the original French product spec. It's outdated on data sources (SportRadar only) and on `/api/predict`, which was deleted.
- **Gemini SDK:** Gemini still uses the older `@google/generative-ai` SDK.

## Environment gotchas (Windows)

- **Only one dev server per project folder.** `next dev` refuses to start a second one ("Another next dev server is already running") and names the existing PID. Reuse it. Don't kill the user's server.
- **Leftover processes:** background dev servers started by an agent can survive their task being stopped, and keep holding the port. Check with `netstat -ano | grep LISTEN` and kill only the processes you started.
