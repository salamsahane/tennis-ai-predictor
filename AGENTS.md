# AGENTS.md: working on Tennis AI Predictor

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Start of every session

1. **Read [context/session.md](context/session.md) first.** It holds the current state, the next steps, and links to the rest of `context/`.
2. Open the other `context/` files when you need depth:
   - [architecture.md](context/architecture.md): how the code fits together;
   - [decisions.md](context/decisions.md): why it is that way. Read it before changing a design;
   - [progress.md](context/progress.md): what's done and what's next;
   - [known-issues.md](context/known-issues.md): read it before "fixing" something that may be a known limitation.
3. Run `git status` and `git log --oneline -5`. Trust git over remembered state.
4. At the end of a session that changes the project's state, update `context/session.md` and the topic files it links to. Keep each fact in one file only.

## Project in one paragraph

A Next.js 16 app that streams a live tennis match over SSE and asks three LLMs (Claude, GPT-4o, Gemini) to predict the winner of the next game, then combines their answers into a weighted verdict. Tennis data comes from pluggable providers with health-based failover: api-tennis.com (primary), SportRadar (key expired), and recorded replays. It serves two purposes: a personal betting and analysis tool, and a portfolio piece. **Honest accuracy** matters, and so do polish, clean code and documentation. The UI is in French; code, comments and commit messages are in English.

## Stack

- **App:** Next.js 16.2.6 (App Router, Turbopack), React 19.2, TypeScript strict.
- **UI:** Tailwind 4, shadcn on **Base UI** (`components/ui/`, not Radix), lucide-react, Recharts 3.
- **Data:** Upstash Redis with an in-memory fallback (`lib/redis.ts`), zod 4 and axios.
- **LLMs:** `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`.
- **Tooling:** Vitest 5 (node environment), ESLint 9 with Prettier 3, npm, Node 24 (`.nvmrc`).

## Commands

```bash
npm install            # install (npm only; package-lock.json is committed)
npm run dev            # dev server on :3000 (only one per folder; see below)
npm run check          # lint + typecheck + tests: must pass before every commit
npm test               # vitest run
npx vitest run <path>  # one test file or folder
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (0 errors expected; 7 known warnings)
npm run format         # prettier --write .
npm run build          # production build: run it before merging
```

**Verification is required.** A change is done only when `npm run check` passes and, for anything a user can see, after you've looked at it in the running app. Use the replay match when no live match is available.

## Layout

```
app/
  page.tsx                     search page
  match/[matchId]/page.tsx     match page (client): score, stats, predictions
  api/search/route.ts          GET ?q= → registry.listLiveMatches + filterMatches
  api/stream/[matchId]/route.ts SSE poll loop: match_update, predictions, errors
components/match/              scoreboard, stats panel, match card, source badge, search
components/predictions/        prediction panel, verdict, AI cards, history chart
components/ui/                 shadcn/Base UI primitives (generated; edit sparingly)
hooks/                         useMatchStream (EventSource), useMatchSearch, useModelSelection, usePredictionHistory
lib/                           pure helpers (stats, prediction-stats, match-search, source-label, utils) + redis
services/tennis/providers/     provider adapters, registry, health, errors, replay, recorder, derive-stats
services/tennis/               game-state (game-end detection, polling interval), SportRadar client/normaliser
services/ai/                   prompt builder, orchestrator, one service per LLM
services/verdict.engine.ts     weighted consensus
constants/                     models.ts (model IDs), prompts.ts (system prompt)
types/                         tennis/ai/verdict types
data/replays/                  committed match recordings (shipped with the API routes)
docs/superpowers/              specs/ and plans/ per sub-project
context/                       project knowledge for agents (start at session.md)
```

## Conventions

- **Formatting:** Prettier with single quotes, semicolons, width 100 and the Tailwind class-sorting plugin. Line endings are LF (`.gitattributes`). Don't reformat files you aren't changing.
- **Imports:** use the `@/` alias for anything outside the current folder.
- **File naming:**

  | Kind      | Pattern                                    |
  | --------- | ------------------------------------------ |
  | Services  | `*.service.ts`                             |
  | Providers | `*.provider.ts`                            |
  | Types     | `types/*.types.ts`                         |
  | Tests     | `*.test.ts(x)`, next to the code they test |

- **File headers:** many files start with a `// path/to/file.ts` comment and a one-line purpose. Keep that pattern.
- **Comments:** short ones that explain _why_. Match the surrounding density.
- **UI copy** is French, including any new message. Use typographic apostrophes as the existing copy does (`l’accueil`, `d’IA`).
- **Model IDs** live only in `constants/models.ts`.
- **Next 16 specifics:**
  - route `params` is a Promise (`await context.params`);
  - client pages read params with `useParams()`;
  - check `node_modules/next/dist/docs/` for anything else.
- **Tailwind:** never build class names at runtime (`` `${x}/15` ``). Tailwind can't see them; add literal classes, as `MODEL_CONFIG` in `lib/utils.ts` does.
- **Match IDs** are always namespaced `<providerId>:<nativeId>`. Encode them in URLs with `encodeURIComponent`, and decode them once on arrival.
- **Missing data:** a missing stat is `null`, shown as `n/d` (`lib/stats.ts`). Never invent a default `0` for data a provider didn't send.
- **Provider errors:**
  - Adapters throw `ProviderError` with kind `auth`, `rate_limit`, `transient` or `not_found` (`services/tennis/providers/errors.ts`).
  - Convert foreign errors with `toProviderError`.
  - Log only through `logProviderError`.
- **SSE events:**
  - Add a **named event** for each new outcome, as `prediction_failed` and `source_unavailable` do.
  - Use the custom `error` event only for "Match not found" and "Poll failed". The client treats any other `error` as a dropped connection.
- **Accuracy must stay honest:** never show a number that isn't computed from real results. Show "en attente" instead.

## Tests

- Vitest runs in the **node** environment. Test components with `renderToStaticMarkup` from `react-dom/server` (see `components/match/MatchCard.test.tsx`). There's no jsdom or Testing Library. Hooks aren't unit-tested, so put the logic in pure functions in `lib/` and test those.
- **Fixing a bug:** write the failing test first, watch it fail for the right reason, then fix the code.
- **Fixtures:**
  - Provider adapters are tested against real JSON fixtures in `services/tennis/providers/__fixtures__/`.
  - Fake time with `vi.useFakeTimers()`.
  - Mock the registry and orchestrator in route tests (see `app/api/stream/[matchId]/route.test.ts`).
- **Reading SSE with fake timers:** a `reader.read()` loop waiting for a future poll will hang. Read in the background, advance the timers, then assert.
- **Network:** tests must never hit a real network or a paid API.

## Workflow and git

- **Each sub-project:** brainstorm with the user → spec in `docs/superpowers/specs/` → plan in `docs/superpowers/plans/` → implementation. The user approves the spec and the plan before any code.
- **Branches:** work on a feature branch (`feat/...`), never directly on `main`. Merge into `main` and push **only when the user asks**. Run `npm run check` and `npm run build` on the merged result before pushing. Never force-push.
- **Commits:**
  - Format: Conventional Commits, `type(scope): subject`, with type one of feat, fix, refactor, chore, docs, style, test.
  - The subject is under 60 characters, imperative and lowercase.
  - Follow `.claude/skills/commit-msg/SKILL.md`. **Never add `Co-Authored-By` or any other attribution line.**
  - Never skip hooks.
- **Remote:** `git@github.com:salamsahane/tennis-ai-predictor.git`, over SSH, with `main` as the default branch.

## Hard constraints

- **Secrets:**
  - Never print, log, commit or paste the contents of `.env.local`.
  - To check whether a key is set, print its length only.
  - api-tennis puts the key in the URL query string, so never log axios errors, request configs or URLs.
- **Paid calls:** LLM calls (including through the AI gateway) and api-tennis requests cost money or trial quota. **Always ask the user before any paid test or call**, even a single smoke test. Don't trigger them in loops or in tests. When you record matches (`RECORD_MATCHES=1`), blank the LLM keys **for that command only**, and never edit `.env.local` to do it.
- **Budget:** tennis data stays on trials and free tiers. Don't add paid providers without the user's agreement.
- **Replay labels:** replays must never be labelled "Live".
- **Dev server:** don't kill the user's dev server. `next dev` allows one server per folder; if one is running, reuse it. Kill only the processes you started (on Windows, child processes can outlive their task).
- **Scratch files:** don't leave test output or scratch files in the repo. `.superpowers/` and `.playwright-mcp/` are **not** git-ignored.

## Navigating the code

| To understand…               | Start with                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| A data problem               | `services/tennis/providers/registry.ts`, then the adapter named by the match ID prefix     |
| Live updates and predictions | `app/api/stream/[matchId]/route.ts` on the server, `hooks/useMatchStream.ts` on the client |
| What the models see          | `services/ai/prompt.builder.ts` and `constants/prompts.ts`                                 |
| How answers are combined     | `services/ai/orchestrator.ts`, then `services/verdict.engine.ts`                           |
| A data shape                 | `types/tennis.types.ts`, `types/ai.types.ts`, `types/verdict.types.ts`                     |

The original French product spec ([tennis-ai-predictor-spec.md](tennis-ai-predictor-spec.md)) explains the product's intent, but it's outdated on data sources and routes. Where they disagree, `context/` and the code win.
