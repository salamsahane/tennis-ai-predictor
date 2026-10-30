# Design: baseline tooling and correctness fixes (sub-projects 1 and 2)

Status: draft, waiting for review · Date: 2026-10-30


## Context
The app started as a personal tennis betting and analysis tool and is now also going into the portfolio. So it needs three things:
- prediction quality you can trust, with **honest accuracy tracking**;
- visual polish;
- clean code and a good README.

An exploration of the codebase (about 3.9k lines, Next 16.2, React 19, Tailwind 4, shadcn on Base UI, Upstash Redis, SportRadar, 3 LLMs) turned up real bugs and no safety net: it isn't a git repo, and it has no tests, no typecheck script, no formatter and no CI.

The work is split into 5 sub-projects. Each one gets its own design → spec → plan → implementation cycle:
1. **Baseline tooling** ← this design
2. **Correctness fixes** ← this design
3. Prediction pipeline and real accuracy tracking: one poller per match, predictions cached per game, zod-validated LLM output, a single shared `callModel` helper, player-name normalisation, and stored real game winners.
4. Design and UX polish: server-component shells, `loading`/`error`/`not-found`, skeletons, accessibility, mobile model selector, metadata.
5. Portfolio packaging: README with screenshots and architecture, GitHub Actions CI.

Assumptions: single deployment with low traffic; Upstash Redis and SportRadar stay; the UI stays in French; npm (package-lock.json is present).

---

## Sub-project 1: Baseline tooling
- `git init`, then fix `.gitignore` so it keeps ignoring `.env*` but un-ignores `.env.example` (`!.env.example`). Make an initial commit of the current state before any change.
- `package.json` scripts: `typecheck` (`tsc --noEmit`), `format` / `format:check` (Prettier), `test` / `test:watch` (Vitest), `check` (lint, then typecheck, then test).
- Dev deps: `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `eslint-config-prettier`. Move `shadcn` from dependencies to devDependencies. Remove whichever of `tailwindcss-animate` / `tw-animate-css` isn't imported by `globals.css` (check first).
- `vitest.config.ts` with the `@/` path alias and a node environment. Seed tests for the pure logic that sub-project 2 touches: `services/verdict.engine.ts`, `services/ai/prompt.builder.ts`, and the StatsPanel helper (see below).
- `.nvmrc` and `"engines"` pinned to the Node version currently installed.
- Run Prettier once over the repo as its own commit, so later diffs stay readable.

## Sub-project 2: Correctness fixes (confirmed in code)
| # | Bug | Fix |
|---|-----|-----|
| 1 | `.dark` resets `--primary` to white (`app/globals.css:50`) and `<html>` is always `dark`, so the tennis green never shows | Set the tennis green as `--primary` and a matching `--primary-foreground` in `.dark`. Collapse duplicated tokens that aren't needed |
| 2 | Classes built at runtime, like `` `${config.bgClass}/15` ``, never get generated (`AICard.tsx:44,68`, `ModelSelector.tsx:39`, `PredictionPanel.tsx:54`) | Add literal tint classes to `MODEL_CONFIG` (e.g. `tintClass: 'bg-orange-500/15'`) and use them directly |
| 3 | Recharts gets `hsl(var(--border))`, but the variables hold oklch values (`PredictionHistory.tsx:76,83,86`) | Use `var(--border)`, `var(--foreground)`, `color-mix(in oklch, var(--muted) 50%, transparent)` |
| 4 | Accuracy is mocked to 100% (`hooks/usePredictionHistory.ts:37-42`) | Remove the mock. Past predictions stay "pending" (excluded from accuracy) until sub-project 3 adds real game winners. The UI shows "en attente" instead of a fake 100% |
| 5 | StatsPanel: unforced errors are treated as "higher is better" because the label doesn't match; break points show the home player's values on both sides; `StatRow` is defined inside render; unused `Progress` import | Hoist `StatRow` and pass an explicit `lowerIsBetter` prop instead of matching labels. Give it separate `format1` and `format2`. Remove the unused import. Unit-test the comparison helper |
| 6 | Outdated or unverified model IDs (`claude.service.ts:36` `claude-3-5-sonnet-20240620`, `gemini.service.ts:35` `gemini-3.5-flash`) | Read the claude-api skill before editing Claude, and use the current Sonnet ID. Check the Gemini ID against Google's docs. Keep the IDs in one constants file. (Moving to the `@google/genai` SDK waits for sub-project 3) |
| 7 | Prompt template placeholders like `{player_home \| player_away}` are sent to the models as literal text | Replace them with the real player names in `prompt.builder.ts` and add a test |
| 8 | SSE route: the heartbeat isn't cleared on abort, `controller.close()` can run twice, and the retry `setTimeout` still fires after close (`app/api/stream/[matchId]/route.ts`) | Use one idempotent `cleanup()` that clears the timers and closes once. Guard the retry with `isClosed` |
| 9 | `ConfidenceMeter.tsx` puts `cubic-bezier` in `className` and uses `<style jsx>` | Use a Tailwind `ease-[cubic-bezier(...)]` class and move the keyframe into `globals.css` |
| 10 | Dead code: `/api/predict` route, `delay`, unused `winner` var, `selectAll`/`isSelected`, `POLL_INTERVAL_MS`, default `public/*.svg` | Delete it (check with grep first) |

Out of scope here (left for sub-projects 3 and 4): the multi-viewer Redis key, LLM output validation, refactoring the duplicated AI services, the server-component restructure, accessibility.

## Verification
- `npm run check`: lint, typecheck and Vitest all pass.
- `npm run build` succeeds.
- `npm run dev` and Playwright screenshots of the home page and a live match page. Confirm the green primary shows, the model tint backgrounds render, and the chart grid and labels are visible. Confirm the accuracy shows "en attente", not 100%, and the stats arrows are right for unforced errors and double faults.
- Open the SSE stream, close the tab, and confirm the server logs show no "controller already closed" errors.

## Decisions
- The 2-commit start (an initial snapshot, then a Prettier-only reformat) keeps behaviour changes separate from formatting.
- Accuracy shows "en attente" until sub-project 3 adds real game winners. A missing number is better than a fake one.
