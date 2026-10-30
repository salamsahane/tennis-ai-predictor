# Baseline Tooling and Correctness Fixes: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a test, typecheck and format safety net, then fix the confirmed correctness bugs without changing the architecture.

**Architecture:** Pure logic that the fixes touch moves into small, testable modules: stat comparison, prediction performance, and model IDs. Components and routes keep their current shape. The SSE route gets one idempotent send/cleanup path. No new runtime dependencies.

**Tech Stack:** Next 16.2.6 (App Router), React 19.2, TypeScript 5 strict, Tailwind 4 (CSS-first), Recharts 3, Vitest, Prettier, npm.

**Spec:** `docs/superpowers/specs/2026-10-30-baseline-and-fixes-design.md`

## Global Constraints
- Package manager: npm (`package-lock.json`). Node pinned to `24.12.0` (`.nvmrc`, `"engines": { "node": ">=24" }`).
- UI copy stays in French. The new pending-accuracy copy is exactly `en attente`.
- No new runtime dependencies. New dev deps only: `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `eslint-config-prettier`.
- Read `node_modules/next/dist/docs/` for any Next API you touch (AGENTS.md).
- Out of scope: the multi-viewer Redis key, LLM output validation, merging the AI services, the `@google/genai` migration, the server-component restructure, accessibility.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **The client disconnects while `getMatchData` or `runAllPredictions` is still awaiting.** The next `enqueue` must not throw `Invalid state: Controller is already closed`. Pinned in Task 6 (`does not enqueue after abort mid-poll`).
2. **Break points with zero totals** (`0/0` on both sides). It must show `0/0` per player and highlight neither player. Pinned in Task 3.
3. **Equal stat values.** Neither side is highlighted, for both higher-is-better and lower-is-better stats. Pinned in Task 3.
4. **Start of the match** (`periodScores: []`). The prompt must still contain both real player names in the JSON example and no `{player_home | player_away}`. Pinned in Task 2.
5. **Past predictions where every model has `error` set.** Accuracy must be `null` (pending), never `0%` or `100%`. Pinned in Task 5.

---

### Task 1: Tooling baseline

**Files:**
- Modify: `package.json`, `eslint.config.mjs`
- Create: `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `.nvmrc`, `services/verdict.engine.test.ts`

**Interfaces:**
- Produces scripts: `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `test:watch` = `vitest`, `format` = `prettier --write .`, `format:check` = `prettier --check .`, `check` = `npm run lint && npm run typecheck && npm test`.
- Produces: Vitest finds `**/*.test.ts` and resolves `@/` to the repo root.

- [ ] **Step 1: Install and clean deps.** Run `npm i -D prettier prettier-plugin-tailwindcss vitest eslint-config-prettier`, then `npm uninstall tw-animate-css`. It isn't imported; `globals.css` uses `@plugin "tailwindcss-animate"`. Move `shadcn` to devDependencies with `npm uninstall shadcn && npm i -D shadcn`.
- [ ] **Step 2: Add config.** Add the scripts above and `"engines": { "node": ">=24" }`. Write `.nvmrc` containing `24.12.0`.
  - `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "printWidth": 100, "plugins": ["prettier-plugin-tailwindcss"] }`.
  - `.prettierignore`: `.next`, `node_modules`, `package-lock.json`, `tennis-ai-predictor-spec.md`, `docs`.
  - Append `eslint-config-prettier` (its flat export) as the last entry in `eslint.config.mjs`.
  - `vitest.config.ts`: `environment: 'node'`, alias `'@'` → `path.resolve(__dirname, '.')`.
- [ ] **Step 3: Write characterization tests in `services/verdict.engine.test.ts`.** Use a `pred(model, winner, prob, overrides?)` factory for `AIPrediction`.
  - `unanimous with 3 models` → `agreement === 'UNANIMOUS'`, `predicted_winner === 'A'`. With all probabilities `0.8`, `confidence_score === 88`, i.e. round((0.8×0.6 + 1×0.4)×100).
  - `caps confidence at 60 with one model` → a single prediction with prob `0.95` gives `confidence_score === 60`.
  - `caps confidence at 80 with two models`.
  - `majority 2 vs 1` → `agreement === 'MAJORITY'`, and the winner is the player with two votes.
  - `throws on empty input` → `expect(() => computeVerdict([])).toThrow()`.
- [ ] **Step 4: Run `npm test`.** Expected: 5 passing tests. These describe current behaviour. If one fails, fix the test's expectation, not the engine.
- [ ] **Step 5: Run `npm run typecheck` and `npm run lint`.** Expected: both exit 0. Fix only errors caused by this task's new files. Pre-existing errors go in the task report.
- [ ] **Step 6: Commit** `chore: add vitest, prettier, typecheck scripts and verdict engine tests`.
- [ ] **Step 7: Format the repo.** Run `npm run format`, then `npm run check` (expected: passes). Commit only the formatting as `style: format codebase with prettier`.

### Task 2: Fill player names into the prompt's JSON example

**Files:**
- Modify: `constants/prompts.ts:70-76`, `services/ai/prompt.builder.ts`
- Test: `services/ai/prompt.builder.test.ts`

**Interfaces:**
- Consumes: `buildPrompt(matchData: MatchData): string` (unchanged signature).

- [ ] **Step 1: Write failing tests.** Use a `makeMatch(overrides)` fixture with full `MatchData`: home `"Sinner, Jannik"`, away `"Alcaraz, Carlos"`.
  - `does not leak template placeholders` → `expect(prompt).not.toMatch(/\{[a-z_|\s]+\}/)`.
  - `JSON example names both players` → `expect(prompt).toContain('"predicted_winner": "Sinner, Jannik | Alcaraz, Carlos"')`.
  - `works at match start` → `periodScores: []`. The prompt contains `Aucun set terminé` and passes the same no-placeholder assertion.
- [ ] **Step 2: Run `npx vitest run services/ai/prompt.builder.test.ts`.** Expected: FAIL on the placeholder assertions.
- [ ] **Step 3: Implement.** In the template, replace `{player_home | player_away}` (both occurrences) with `{player_choice}`, and add `player_choice: \`${players.home.name} | ${players.away.name}\`` to `replacements`.
  - Pass the replacement as a function, `() => String(value)`, so `$` in names isn't treated as a replacement pattern.
  - Delete the unused `winner` variable in `buildScoreHistory`.
- [ ] **Step 4: Run the test.** Expected: PASS. Then run `npm test`: all pass.
- [ ] **Step 5: Commit** `fix: fill player names in prompt JSON example`.

### Task 3: StatsPanel comparison and break points

**Files:**
- Create: `lib/stats.ts`
- Modify: `components/match/StatsPanel.tsx`
- Test: `lib/stats.test.ts`

**Interfaces:**
- Produces: `compareStat(home: number, away: number, lowerIsBetter?: boolean): 'home' | 'away' | null` and `shareOfTotal(home: number, away: number): [number, number]` (percentages, `[50, 50]` when total is 0).

- [ ] **Step 1: Write failing tests.**
  - `compareStat(5, 3)` → `'home'`. `compareStat(5, 3, true)` → `'away'`.
  - `compareStat(4, 4)` → `null`. `compareStat(4, 4, true)` → `null`.
  - `compareStat(0, 0)` → `null`.
  - `shareOfTotal(1, 3)` → `[25, 75]`. `shareOfTotal(0, 0)` → `[50, 50]`.
- [ ] **Step 2: Run `npx vitest run lib/stats.test.ts`.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/stats.ts`, then refactor `StatsPanel`.**
  - Hoist `StatRow` to module level, with props `{ label, home, away, lowerIsBetter?, formatHome?, formatAway?, isPercentage? }`. It uses `compareStat` and `shareOfTotal`.
  - Pass `lowerIsBetter` on "Double fautes" and "Fautes directes".
  - For "Balles de break", pass `formatHome={() => \`${home.breakPointsWon}/${home.breakPointsTotal}\`}` and `formatAway` with the away values.
  - Remove the `Progress` import.
- [ ] **Step 4: Run `npm test && npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `fix: correct stats panel comparisons and break point display`.

### Task 4: Visual fixes: theme primary, model tints, chart colours, confidence meter

**Files:**
- Modify: `app/globals.css`, `lib/utils.ts` (`MODEL_CONFIG`), `components/predictions/AICard.tsx:44,68`, `components/predictions/ModelSelector.tsx:39`, `components/predictions/PredictionPanel.tsx:54`, `components/predictions/PredictionHistory.tsx:39,76,83,86`, `components/predictions/ConfidenceMeter.tsx`

**Interfaces:**
- Produces: `MODEL_CONFIG[model]` gains literal fields `tint10`, `tint15`, `tint20`, e.g. `'bg-orange-500/10'`. Write them as full literal strings so Tailwind generates them.

- [ ] **Step 1: Theme.** In `.dark`, set `--primary: oklch(0.623 0.17 143.5)` and `--primary-foreground: oklch(0.985 0 0)`. Set `--ring` to the same green. Leave the other tokens alone. The light `:root` theme is unused today but stays valid.
- [ ] **Step 2: Tints.** Add the `tint*` fields for orange, green and blue. Replace each `` `${config.bgClass}/NN` `` with `config.tintNN`. Grep afterwards: `grep -rn 'Class}/' components` must return nothing.
- [ ] **Step 3: Chart.**
  - `stroke="var(--border)"`.
  - `tick={{ fill: 'var(--foreground)', ... }}`.
  - `cursor={{ fill: 'color-mix(in oklch, var(--muted) 50%, transparent)' }}`.
  - Type `CustomTooltip` with Recharts' `TooltipContentProps<number, string>`. If that type isn't exported in the installed version, define a minimal local props interface. No `any`.
  - Move `CustomTooltip` to module scope.
- [ ] **Step 4: ConfidenceMeter.**
  - Replace `cubic-bezier(0.34, 1.56, 0.64, 1)` in `className` with `ease-[cubic-bezier(0.34,1.56,0.64,1)]`.
  - Delete the `<style jsx>` block. Add `@keyframes shimmer { 100% { transform: translateX(100%); } }` to `globals.css`.
  - Delete the unused `.animate-bounce-slow` rule (grep it first).
- [ ] **Step 5: Run `npm run check && npm run build`.** Expected: both succeed. Then grep `.next/static/css` for `bg-orange-500\/15`: it must be present.
- [ ] **Step 6: Commit** `fix: show brand primary, render model tints and valid chart colours`.

### Task 5: Honest accuracy (remove the mock)

**Files:**
- Create: `lib/prediction-stats.ts`
- Modify: `hooks/usePredictionHistory.ts`, `components/predictions/PredictionHistory.tsx`, `app/match/[matchId]/page.tsx:23,116`
- Test: `lib/prediction-stats.test.ts`

**Interfaces:**
- Produces: `computeModelPerformance(history: PredictionEvent[]): ModelPerformance[]` (always the 3 models, in `claude, gpt4o, gemini` order) and `computeVerdictAccuracy(history: PredictionEvent[]): number | null`. The second returns `null` when no event has `actual_winner`.
- Produces: `usePredictionHistory` returns `{ history, performance, verdictAccuracy: number | null, totalPredictions, completedPredictions }`.
- `PredictionHistory` prop `verdictAccuracy` becomes `number | null`, and it gains `completedPredictions: number`.

- [ ] **Step 1: Write failing tests.**
  - `no completed events → null accuracy` → events without `actual_winner` give `computeVerdictAccuracy(...) === null`, and every model has `total === 0`.
  - `counts correct per model` → one event with `actual_winner: 'A'`, claude says A and gpt4o says B, gives claude `{correct: 1, total: 1, accuracy: 100}` and gpt4o `{correct: 0, total: 1, accuracy: 0}`.
  - `skips errored predictions` → an event where every prediction has `error` set gives all model totals `0`.
  - `verdict accuracy from was_correct` → 2 completed events, one `was_correct: true`, gives `50`.
- [ ] **Step 2: Run `npx vitest run lib/prediction-stats.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Move the two `useMemo` bodies from the hook into `lib/prediction-stats.ts`.
  - Delete the mock `useEffect`/`useState` validation entirely. `history` is the `predictions` argument, and `matchData` is no longer a parameter. Update the call site in `page.tsx`.
  - In `PredictionHistory`:
    - When `verdictAccuracy === null`, the header shows `en attente` instead of `NN%`.
    - When `completedPredictions === 0`, show `Précision en attente des résultats réels.` in place of the bar chart.
    - Pass `completedPredictions` from `page.tsx`.
- [ ] **Step 4: Run `npm test && npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `fix: remove mocked 100% accuracy; show pending until real results`.

### Task 6: SSE route lifecycle

**Files:**
- Modify: `app/api/stream/[matchId]/route.ts`
- Test: `app/api/stream/[matchId]/route.test.ts`

**Interfaces:**
- Consumes (mocked with `vi.mock`): `getMatchData` from `@/services/tennis/match.service`, `detectGameEnd` and `getPollingInterval` from `@/services/tennis/game-state.service`, `runAllPredictions` from `@/services/ai/orchestrator`.
- Inside `start()`, define local `send(event: string, data: unknown): void`, a no-op once closed, and `cleanup(): void`, which is idempotent: it sets `isClosed`, clears `pollTimer` and `heartbeatInterval`, and calls `controller.close()` in try/catch at most once.

- [ ] **Step 1: Write failing tests.** Use `vi.useFakeTimers()`. Build a `NextRequest` with an `AbortController` signal, call `GET(req, { params: Promise.resolve({ matchId: 'x' }) })`, and read `res.body`.
  - `closes once when match is final` → `getMatchData` resolves `{ status: 'final', ... }`. The stream ends with a `match_ended` event and no error is thrown.
  - `does not enqueue after abort mid-poll` → `getMatchData` returns a deferred promise. Abort, then resolve it. No unhandled error, and no `setTimeout` is pending (`vi.getTimerCount() === 0`).
  - `abort clears heartbeat` → abort right away. `vi.getTimerCount() === 0`.
- [ ] **Step 2: Run `npx vitest run "app/api/stream"`.** Expected: FAIL (the current code throws, or leaves the timers).
- [ ] **Step 3: Implement.**
  - Route every `controller.enqueue` through `send`.
  - The abort listener, the `final` branch, and future error paths call `cleanup()`.
  - Each `setTimeout(poll, …)` is guarded by `if (!isClosed)`, including the catch-branch backoff.
  - Declare `heartbeatInterval` before `poll()` is first called.
  - Fix the misleading comment "without blocking the next poll" to describe what the code really does.
  - Extract the models-param parsing into `parseModelsParam(param: string | null): AIModel[] | undefined` at module scope in this file (spec scope only).
- [ ] **Step 4: Run `npm test && npm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** `fix: make SSE stream cleanup idempotent and abort-safe`.

### Task 7: Current model IDs in one place

**Files:**
- Create: `constants/models.ts`
- Modify: `services/ai/claude.service.ts:36`, `services/ai/gemini.service.ts:35`, `services/ai/openai.service.ts:35`

**Interfaces:**
- Produces: `export const PROVIDER_MODEL_IDS = { claude: string, gpt4o: 'gpt-4o', gemini: string } as const satisfies Record<AIModel, string>`.

- [ ] **Step 1: Invoke the `claude-api` skill.** Confirm the current Sonnet model ID; it's expected to be `claude-sonnet-5-5`. Confirm the call shape `claude.service.ts` uses still works with `@anthropic-ai/sdk@^0.100`.
- [ ] **Step 2: Check the Gemini ID.** Confirm `gemini-3.5-flash` against Google's current model list (web search, standard mode). If it doesn't exist, use the newest GA Flash model listed for `@google/generative-ai`.
- [ ] **Step 3: Implement.** Create `constants/models.ts` and replace the three hard-coded strings with `PROVIDER_MODEL_IDS.<key>`.
- [ ] **Step 4: Run `npm run check && npm run build`.** Expected: PASS.
  - If `ANTHROPIC_API_KEY` is set locally, also run a one-off smoke call through `analyzeWithClaude` (or whatever the exported function is named) with a fixture prompt, and report the result. Don't commit that script.
  - The key is empty today, so record "Claude not live-tested: no key".
- [ ] **Step 5: Commit** `fix: update model ids and centralise them`.

### Task 8: Remove dead code

**Files:**
- Delete: `app/api/predict/` (directory), `public/{file,globe,next,vercel,window}.svg`
- Modify: `lib/utils.ts` (remove `delay`), `hooks/useModelSelection.ts` (remove `selectAll`, `isSelected`), `.env.example` (remove `POLL_INTERVAL_MS`)

- [ ] **Step 1: Prove each item is unused.** Run `grep -rn "api/predict\|selectAll\|isSelected\|POLL_INTERVAL_MS" app components hooks lib services`. Also grep for each svg name, and for `delay(` with `components/ui/tooltip.tsx` excluded (its `delay` is a prop). Expected: only the definitions themselves match.
- [ ] **Step 2: Delete them.** Remove the items above.
- [ ] **Step 3: Run `npm run check && npm run build`.** Expected: PASS.
- [ ] **Step 4: Commit** `chore: remove dead code and unused assets`.

### Task 9: End-to-end verification

- [ ] **Step 1: Run `npm run check && npm run build`.** Expected: all green.
- [ ] **Step 2: Start `npm run dev` and take screenshots.** Use Playwright MCP if available.
  - Home page: confirm the primary buttons and accents are green.
  - Model selector: confirm the selected models show their tint.
  - A live match from search: the scoreboard and stats arrows (the lower unforced-error count is highlighted), `en attente` in accuracy, and a visible chart grid and labels once completed data exists.
  - If there's no live match or no browser, say so in the report instead of claiming the visual check passed.
- [ ] **Step 3: Check the stream lifecycle.** Open `/api/stream/<id>` in a tab, close it, and confirm the dev-server log has no `Controller is already closed` / `Invalid state` errors.
- [ ] **Step 4: Report.** List the commits, the test count, the screenshots taken, and anything not verified.
