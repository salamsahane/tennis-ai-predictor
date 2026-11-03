# Decisions

This file explains why the code is the way it is. Each entry gives the decision, its reason, and where relevant what it costs if it turns out wrong. Before reversing any of these, ask the user.

The full reasoning is in the specs:

- [baseline-and-fixes-design](../docs/superpowers/specs/2026-10-30-baseline-and-fixes-design.md)
- [tennis-data-providers-design](../docs/superpowers/specs/2026-10-30-tennis-data-providers-design.md)

## Process and workflow

- **Each sub-project goes through its own cycle:** brainstorm → spec (`docs/superpowers/specs/`) → plan (`docs/superpowers/plans/`) → implementation. The user approves the spec and the plan before any code is written.
- **Execution:** the user chose subagent-driven execution for 3a (one implementer and one reviewer per task, then a final whole-branch review). Sub-projects 1 and 2 ran inline.
- **Branches:** feature work happens on a feature branch, which merges into `main` only when the user says so. The user also says when to push.
- **History:** the repo began with an initial snapshot commit, followed by a separate Prettier-only commit, so behaviour changes are never mixed with formatting.
- **Commits:** Conventional Commits, made with the project `commit-msg` skill. The skill says **never add a `Co-Authored-By` or other attribution line**.
- **Line endings:** `.gitattributes` sets `eol=lf`. The repo is on Windows, and CRLF line endings were breaking Prettier checks.

## Product decisions

- **Accuracy:** it shows "en attente" (pending) until real game winners are recorded. The old code faked 100% accuracy, and it was removed in sub-project 2. A missing number beats a fake one.
- **UI language:** the UI stays in French.
- **Budget:** tennis data comes from trials and free tiers only (2026-10-31).
- **Replay mode:** real matches are recorded during the trial and replayed as the last fallback. A replay is always labelled "Replay", **never "Live"**. The spec requires this, so a replay card showing "🔴 LIVE" counts as an important bug.
- **Failover scope: new requests only.**
  - Search and new streams use the first healthy provider.
  - An open match never switches provider mid-stream. That avoids cross-provider ID matching.
  - If a match's provider dies, its page shows "Source indisponible" with a link back to search.

## Provider research (2026-10-31)

Requirements came from the existing `MatchData`.

| Provider           | Verdict                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **api-tennis.com** | **Primary.** It has the live score, server, game points and point-by-point data. It costs $40–60/month, with a 14-day trial. |
| api.tennis         | A possible later fallback: $19/month, 5–7 s latency, schema unverified. Not built.                                           |
| LSports            | Rejected. It's B2B and sales-only, needs RabbitMQ, and is priced at enterprise level.                                        |
| tennis-api.com     | Rejected. It has no documented live player stats, and the server is only shown on its $99 WebSocket.                         |

**Consequence:** no affordable provider matches SportRadar's stats, so the app must cope with missing stats (`number | null`, shown as `n/d`).

## Architecture decisions (3a)

- **Interface and registry:** each provider is an adapter behind one interface, plus a registry with health state in Redis. Two alternatives were rejected:
  - a provider switch through an environment variable, because it gives no automatic failover;
  - an external aggregator service, because it means extra hosting.
- **Health cool-downs:**
  - auth: 1 h;
  - rate_limit: Retry-After or 60 s;
  - transient: 15 s after 3 failures in a row;
  - not_found: no change.
- **Search containment:** the registry never lets one provider's error escape `listLiveMatches()`.
- **No key leaks:** never log axios error objects, because their config and URL contain `APIkey`. Log only `{providerId, kind, status, message}`.

## Implementation rulings (3a)

These rulings were made during execution and kept after the final review.

1. **IDs:** `MatchData.id` is namespaced everywhere, not only in search results. Cost: one mapping line per adapter.
2. **Replay length:** a replay's duration is its **last snapshot's `t`**, so the final snapshot is almost never shown before the loop restarts.
3. **Fixtures:** the api-tennis fixture is a **real** recorded response, not the vendor's sample, because the key was available.
4. **Not found:** `getMatchById` turns `not_found` into `null`, and the stream shows a normal "Match not found".
5. **Health and streams:** `getMatchById` does **not** consult health. An open stream always calls its provider, so it sees the real error. Cost: one failing call when a stream opens on a dead provider.
6. **Recording:** matches were recorded with only api-tennis enabled and the LLM keys blanked **for the recording command only**, so no paid LLM calls were made. `.env.local` was not edited.
7. **api-tennis error bodies:** api-tennis answers HTTP 200 with `{"error":"1","result":[{"cod":1004,...}]}` for bad credentials.
   - Only `cod 1004` maps to `auth`.
   - Any other error body maps to `transient` in `listLiveMatches`, and to `not_found` in `getMatch`.
   - The real "no such match" code is unknown. Cost: during a quota outage, an open match shows "Match not found" and retries every 10 s.
8. **Build tracing:** a `turbopackIgnore` comment is on the replay `cwd` path, so the build doesn't trace the whole project. The recordings ship through `outputFileTracingIncludes` instead. Cost: recordings go missing if that route key stops matching.
9. **Game-end detection:** only an **increase** in total games counts as a game end. A decrease, such as a replay wrapping back to its start, resets the stored count.
10. **Stats names:** "Last 10 balls" (api-tennis) is assumed to mean "points won in the last 10". This is **unverified**.

## Post-3a fix

`prediction_failed` is its own SSE event. The stream used to send a generic `error` event when every model failed. EventSource can't tell that apart from a dropped connection, so the page stayed on "Analyse en cours…" and showed "Reconnexion…". Rule: send custom `error` events only for connection or match-level problems.

## AI gateway (preparatory task 2, 2026-11-03)

Paying three LLM vendors separately was too expensive, so the user asked whether UnoRouter (one balance for many models) could replace the three integrations. The full evaluation, with sources, was a spike and is not committed. What was decided:

- **UnoRouter is rejected for predictions.**
  - It's a sole proprietorship founded in 2026 that resells third-party capacity at 64–85% below list price.
  - Its terms say requests can go to unnamed providers and "keyless relays", it publishes no SLA, and it doesn't sell paid GPT-4o.
  - Since a model may not be the one it claims to be, the per-model accuracy comparison couldn't be trusted, and that comparison is the point of the app.
- **Vercel AI Gateway is the chosen single credit balance.** OpenRouter is the backup.
  - It charges list prices with no markup on tokens.
  - Each request is pinned to the first-party provider, with fallback disabled (`providerOptions.gateway.only`).
  - Its Anthropic-native `/v1/messages` endpoint lets Claude keep the official Anthropic SDK, with effort and adaptive thinking.
  - It fits the planned Vercel hosting.
- **Models come from a catalog, starting on cheaper tiers.** Each model is one entry: vendor, gateway model ID, transport, pinned providers, parameters, verdict weight and UI config. The starting tiers are, for example, Claude Haiku 5.5, Gemini Flash and a smaller GPT, and each can be switched later in its entry.
  - This replaces the model list hard-coded in 15 files (`AIModel`, `ALL_MODELS`, `MODEL_FETCHERS`, verdict weights, `prediction-stats`, `MODEL_CONFIG`, `PredictionPanel`).
  - Users still choose which models run.
- **It's built inside sub-project 3b.** The gateway becomes the transport of 3b's single `callModel` helper, with zod-validated output, so the AI layer is rewritten only once. A direct-vendor transport stays possible for any model.
- **Cost:** the biggest saving is one poller per match plus a per-game cache, because today each viewer multiplies LLM calls. At list prices, Sonnet, GPT-4o and Gemini Flash cost about $0.025 per predicted game (an estimate, not measured).
