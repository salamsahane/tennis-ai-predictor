# Progress

## Completed

### Sub-project 1: baseline tooling (merged)

Spec: [2026-10-30-baseline-and-fixes-design.md](../docs/superpowers/specs/2026-10-30-baseline-and-fixes-design.md). Plan: [2026-10-30-baseline-and-fixes.md](../docs/superpowers/plans/2026-10-30-baseline-and-fixes.md).

- `git init`, with an initial snapshot commit, then a separate Prettier-only commit. `.gitignore` keeps `.env*` ignored but allows `.env.example`.
- Scripts: `typecheck`, `test`, `test:watch`, `format`, `format:check`, `check` (lint, then typecheck, then test).
- Dev tools: Vitest, Prettier with the Tailwind plugin, `eslint-config-prettier`. `@types/node` was bumped to ^24, because Vitest 5 needs at least 22.
- Node is pinned in `.nvmrc` (24.12.0) and in `engines` (>=24). `.gitattributes` sets `eol=lf`.
- The first tests cover the verdict engine, the prompt builder and the StatsPanel helpers.

### Sub-project 2: correctness fixes (merged)

All 10 bugs listed in the spec above were fixed:

1. The green primary colour now shows in the dark theme.
2. Model tint classes are literal strings, so Tailwind generates them.
3. Recharts gets valid colours (no more `hsl()` wrapped around oklch values).
4. The **fake 100% accuracy was removed**; accuracy is pending instead.
5. StatsPanel fixes:
   - unforced errors count as lower-is-better;
   - each break-point column shows its own player's values;
   - `StatRow` was hoisted out of render.
6. Model IDs were updated and centralised in [constants/models.ts](../constants/models.ts).
7. Prompt placeholders are filled with the real player names.
8. SSE cleanup is idempotent and abort-safe.
9. ConfidenceMeter uses a Tailwind easing class and a keyframe in `globals.css`.
10. Dead code was removed, including the `/api/predict` route.

Afterwards, at the user's request, local `master` was renamed to `main` (the remote's default branch) and pushed to `origin` over SSH.

### Sub-project 3a: tennis data providers (merged 2026-11-03)

Spec: [2026-10-30-tennis-data-providers-design.md](../docs/superpowers/specs/2026-10-30-tennis-data-providers-design.md). Plan: [2026-11-01-tennis-data-providers.md](../docs/superpowers/plans/2026-11-01-tennis-data-providers.md) (11 tasks). It ran subagent-driven, with a final whole-branch review that raised findings F1–F8; all eight were fixed.

Built:

- the provider contract and errors;
- the model changes (nullable stats, source info);
- health cool-downs;
- the SportRadar adapter;
- derived stats and game winners;
- the replay provider and recorder;
- the registry with failover;
- the api-tennis adapter;
- search and stream routed through the registry;
- source badges and the unavailable-source states;
- one real recorded match: [data/replays/apitennis-12176323.json](../data/replays/apitennis-12176323.json). It's A. Huertas Del Pino Cordova vs M. Del Pino at Villa Maria: 69 snapshots, about 19.8 minutes, roughly 4 games.

The architecture is described in [architecture.md](architecture.md), and the rulings are in [decisions.md](decisions.md#implementation-rulings-3a).

### After 3a: end-to-end test and fix (2026-11-02 and 2026-11-03)

- **Live run on a real match:** D. Merida Aguilar vs S. Baez, `apitennis:12176544`, Paris. Search, the match page, the live score and server, stats, live updates and game-end detection all worked. Predictions failed because no LLM was available (see [session.md](session.md#current-state)).
- **Bug found and fixed** (`a69ceaf`): when every model failed, the page was stuck on "Analyse en cours…". The fix is the `prediction_failed` event, with a stream route test. It was checked in the browser using the replay.
- `feat/data-providers` was merged into `main` (fast-forward) and pushed. The branch was deleted.

## Next: sub-project 3b

The planned objectives come from the roadmap, the 3a spec's "out of scope" list and the code. None of this has a spec yet. **Brainstorm it with the user, write the spec, then write the plan, before any code.**

- **One poller per match:** today every open stream runs its own poll loop and its own LLM calls.
- **Fix the shared game-end key:** `match:<id>:lastGamesCount` is shared between viewers, so with two viewers only one of them sees the increase; see [known-issues.md](known-issues.md).
- **A prediction cache per game:** a game is predicted once, and every viewer gets that result.
- **Real accuracy:** compare predictions with the real game winners from `MatchData.gameWinners`, filling `actual_winner` and `was_correct` in `PredictionEvent`. Today nothing fills them, so accuracy is always pending.
- **Validated LLM output:** zod-validated output, a single shared `callModel` helper instead of three near-duplicate services, and normalised player names (verdict votes match names as raw strings).
- **Possibly:** move `@google/generative-ai` to `@google/genai`, and persist the prediction history (today it lives only in React state).

Prerequisites and open points for 3b:

- **A working LLM key.** Right now none works; see [session.md](session.md#current-state). Without one, predictions can only be tested with mocks.
- **The api-tennis trial:** it's 14 days long and its start date wasn't recorded (around 2026-10-31). Record more matches while it lasts. A longer match **with a tiebreak** is needed to check tiebreak parsing and `gameWinners` across sets.
- **Game winners from SportRadar and replays:** `gameWinners` is only produced by api-tennis. Replays carry it only because their snapshots were recorded from api-tennis; the committed recording has it for every finished game. SportRadar doesn't produce it.

## Later

- **Sub-project 4, design and UX:**
  - server-component shells;
  - `loading` / `error` / `not-found` pages;
  - skeletons;
  - accessibility;
  - a mobile model selector;
  - metadata.
  - The two `react-hooks/set-state-in-effect` lint exceptions (`useMatchStream`, `useModelSelection`) are marked to move to a store or to `useSyncExternalStore`.
- **Sub-project 5, portfolio:** a real README with screenshots and architecture, and GitHub Actions CI running `npm run check` and the build.
