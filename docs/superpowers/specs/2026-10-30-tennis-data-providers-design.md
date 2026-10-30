# Design: tennis data providers with failover and replay (sub-project 3a)

Status: draft, waiting for review · Date: 2026-10-30

## Context
The SportRadar trial key has expired: every request returns 403, so the app can't show a live match. The goals are:
1. Find a replacement provider.
2. Change the data layer so one failing provider (expired key, rate limit, outage) can't break the app.

This is sub-project **3a**. It goes before **3b**, the prediction pipeline (one poller per match, a prediction cache per game, real accuracy), because real accuracy needs the game winners this layer provides.

## Provider research (summary)
Requirements come from today's `MatchData`:
- **Live matches:** a list of live matches with player names.
- **Live score:** sets, games, the current game's points (including AD), tiebreak, server, and status.
- **Per-player live stats:**
  - aces, double faults
  - 1st-serve %, 1st- and 2nd-serve points won
  - winners, unforced errors
  - break points won/total
  - points won in the last 10
  - service games won, total points won, return points won
- **Context:** tournament and surface.
- **Speed:** updates within seconds.

| Provider | Verdict |
|---|---|
| **api-tennis.com** | **Primary.** It documents a live score, the server (`event_serve`), game points (`event_game_result`) and point-by-point data (`pointbypoint[]`, which gives each game's winner). Its samples confirm aces, double faults and 1st-serve points won; the other stats are unconfirmed. $40–60/month, with a 14-day trial. Auth is `APIkey` in the query string. |
| api.tennis | A possible later fallback ($19/month, 5–7 s latency). Its schema couldn't be verified. Not built in 3a. |
| LSports | Rejected. It has the full stats catalogue, but it's B2B and sales-only, needs a RabbitMQ consumer, and is priced at enterprise level. |
| tennis-api.com | Rejected. No documented live player stats, and the serving player is only in its WebSocket (from $99/month). |

**Consequence:** no affordable provider is guaranteed to supply every stat. The app must work when stats are missing.

## Decisions
- **Budget: trials and free tiers only.** The api-tennis.com trial is the live source while it lasts.
- **Replay mode:** real matches are recorded during the trial, then replayed as the last fallback. The UI always labels replayed data "Replay", never "Live".
- **Failover scope: new requests only.**
  - Search and new match streams use the first healthy provider.
  - If an open match's provider fails, the page shows "Source indisponible" with a link back to search.
  - Matches never switch providers mid-stream, so no cross-provider ID matching is needed.

## Architecture
Approach: one adapter per provider behind a shared interface, plus a registry with health state in Redis.

These alternatives were rejected:
- **An env-var provider switch:** there's no automatic failover.
- **An external aggregator service:** extra hosting for a single app.

### Units (`services/tennis/providers/`)
| File | Responsibility |
|---|---|
| `types.ts` | `TennisDataProvider { id: string; label: string; kind: 'live' \| 'replay'; listLiveMatches(): Promise<MatchSearchResult[]>; getMatch(nativeId: string): Promise<MatchData \| null> }`, plus `class ProviderError extends Error { kind: 'auth' \| 'rate_limit' \| 'transient' \| 'not_found'; retryAfterMs?: number }`. |
| `sportradar.provider.ts` | Today's `sportradar.client.ts` and `normalizeMatchData`, behind the interface. It stays in the chain and works again once its key is renewed. |
| `apitennis.provider.ts` | api-tennis.com, described below. |
| `replay.provider.ts` | Plays recorded matches from `data/replays/*.json`, described below. |
| `recorder.ts` | When `RECORD_MATCHES=1`, appends each snapshot a live provider returns to `data/replays/<providerId>-<nativeId>.json`. It writes to the local filesystem, so it's for local dev only. |
| `health.ts` | Provider health in Redis: `isHealthy(id)`, `reportFailure(id, error)`, `reportSuccess(id)`. |
| `registry.ts` | Provider order from `TENNIS_PROVIDERS` (default `sportradar,apitennis,replay`). Exposes `listLiveMatches()` and `getMatchById(matchId)`. |
| `derive-stats.ts` | Computes points won in the last 10, total points won and service games won from point-by-point data when a provider doesn't supply them. |

### api-tennis.com adapter
- **Live list:** `GET https://api.api-tennis.com/tennis/?method=get_livescore&APIkey=…`. Players come from `event_first_player` and `event_second_player`, and the native ID from `event_key`.
- **One match:** the same method with `match_key=<id>`. Fields map as follows:
  - `scores[]` → `periodScores` and the current set
  - `event_game_result` → game points
  - `event_serve` → `serving` and `nextGame.server`
  - `event_status`, with `event_live` → `status`
  - `tournament_name` → `tournament`
  - `statistics[]` (matched on `stat_name` and `player_key`) → `PlayerStats`
  - `pointbypoint[]` → game winners and derived stats
- **Surface:** `get_draw` for the tournament, cached in Redis for 24 h. If it fails, the surface is `null`.
- **Tiebreak:** inferred when the current set's games are 6–6.
- **Unconfirmed stat names** (beyond the three seen in the docs): the plan's first task records a real trial match and builds the field mapping from the actual `stat_name` values.

### Replay provider
- A recording file holds `{ id, label, players, tournament, surface, snapshots: [{ t: msSinceStart, data: MatchData }] }`.
- **Shared clock:** position = ((now − `REPLAY_EPOCH`) × `REPLAY_SPEED`) mod duration. `getMatch` returns the snapshot at that position.
  - The clock is stateless, so every viewer sees the same replay and it runs on serverless hosting.
  - The default `REPLAY_SPEED` is 1, and the default `REPLAY_EPOCH` is 0 (the Unix epoch).
- `listLiveMatches()` returns every recording, with `source.kind = 'replay'`.

## Data model changes
- **Namespaced match IDs:** `<providerId>:<nativeId>`, e.g. `apitennis:12345` or `replay:sinner-alcaraz-2026-10-31`.
  - The match page passes the ID through as-is and no longer builds `sr:sport_event:${id}`.
  - The SportRadar adapter adds and removes its own `sr:sport_event:` prefix internally.
- **Source info:** `MatchData.source` and `MatchSearchResult.source` = `{ providerId, label, kind }`.
- **Optional stats:** `PlayerStats` number fields become `number | null`.
  - `prompt.builder.ts` prints `n/d` for null.
  - `StatsPanel` hides a row when both players' values are null.
  - `compareStat` and `shareOfTotal` callers skip rows that contain null.
- **Surface:** `MatchData.surface` becomes `... | null`.
- **Game winners:** `MatchData.gameWinners?: Array<{ set: number; game: number; winner: 'home' | 'away' }>` comes from point-by-point data when a provider supplies it. 3b uses it for real accuracy.

## Data flow
- **Search:** `/api/search` → `registry.listLiveMatches()`.
  - Live results come from the first healthy `live` provider in order, plus all `replay` entries.
  - The response is `{ matches, unavailableSources: string[] }`, so a dead provider is reported instead of showing an empty list.
- **Stream:** `/api/stream/[matchId]` → `registry.getMatchById(matchId)` on every poll.
  - The registry splits the prefix, finds the provider, and calls `getMatch(nativeId)`.
  - On an `auth` or `rate_limit` `ProviderError`, it reports the failure to `health.ts` and the route sends the SSE event `source_unavailable { providerId }`, then stops the stream.
  - The client shows "Source indisponible" and a link to `/`.
- **UI:** the match page and search results show a badge, "Live · <label>" or "Replay".

## Error handling and security
- **Error kinds:** each adapter converts HTTP errors to `ProviderError`:
  - 401 or 403 → `auth`
  - 429 → `rate_limit`, with `retryAfterMs` taken from `Retry-After`
  - 5xx, timeouts and network errors → `transient`
  - 404 or an empty result → `not_found`
- **Health cool-downs:**
  - `auth` → 1 h
  - `rate_limit` → `retryAfterMs` or 60 s
  - `transient` → 15 s after 3 failures in a row
  - `not_found` → no change
  - Any success resets the failure counter.
- **Containment:** the registry never lets one provider's error escape `listLiveMatches()`. It skips to the next provider.
- **No key leaks:** adapters log `{ providerId, kind, status, message }` only, never request config or URLs. The whole axios error object can contain `APIkey`, so it must not be logged.
- **Health storage:** health state uses the existing `lib/redis.ts` client, so it falls back to memory in dev.

## Testing
- **Adapter tests:** the api-tennis.com and SportRadar adapters are tested against JSON fixtures in `services/tennis/providers/__fixtures__/`. These are vendor doc samples first, replaced by real trial recordings.
- **Registry and health tests:** fake providers cover:
  - auth failure → skip, then a 1 h cool-down
  - 429 with `Retry-After`
  - 3 transient failures → cool-down
  - recovery after the cool-down (fake timers)
  - replay entries always listed
- **Replay tests:** mocked `Date.now()` checks wrap-around and the speed factor.
- **Derived-stats tests:** point-by-point fixtures check last 10 points, total points and service games won.
- **Existing tests:** the stream route test gets the `source_unavailable` event and namespaced IDs, and the prompt builder test gets null stats → `n/d`.
- **End to end:** with only `replay` enabled, search lists the recordings and a match page streams the replay with the "Replay" badge.

## Out of scope (3b and later)
- One poller per match and the shared Redis game-end key bug.
- A prediction cache per game, and real accuracy built on `gameWinners`.
- The api.tennis adapter, and the WebSocket feeds.
- Moving `@google/generative-ai` to `@google/genai`.

## Prerequisite
Before the api-tennis.com adapter's field mapping is written, sign up for its 14-day trial and add `APITENNIS_API_KEY` to `.env.local`. The first implementation task records one live match's raw JSON as a fixture. The SportRadar, replay, registry and health tasks don't need the key.
