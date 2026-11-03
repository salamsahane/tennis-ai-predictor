# Session entry point

Read this file first in every new session. It says where the project stands and which context file to open next.

_Last updated: 2026-11-03, after the AI gateway decision (last code commit on `main`: `a69ceaf`)._

## Snapshot

Tennis AI Predictor is a Next.js 16 app that follows a live tennis match and asks three LLMs (Claude, GPT-4o, Gemini) to predict the winner of each next game. It then combines their answers into a weighted verdict. It started as a personal betting and analysis tool and is now also a portfolio piece. Prediction quality, honest accuracy tracking, visual polish, clean code and a good README all matter. Details are in [project-overview.md](project-overview.md).

## Current state

- **Branch:** `main` is the only branch, and it is in sync with `origin/main` (`git@github.com:salamsahane/tennis-ai-predictor.git`). No feature branch is open.
- **Health:** `npm run check` passes: lint has 0 errors (7 known warnings), and all 119 tests in 19 files pass. `npm run build` passes.
- **Roadmap:** sub-projects 1, 2 and 3a are done. 3b, 4 and 5 have not started. See [progress.md](progress.md).
- **Working:**
  - Search across providers, with failover.
  - Live score, server and stats from api-tennis.com.
  - Replay of a recorded match.
  - Source badges ("Live · api-tennis" / "Replay").
  - Game-end detection that triggers predictions.
  - A clear "Prédiction indisponible" state when every model fails.
- **Not working right now (environment, not code):**
  - No LLM produces a prediction:
    - `ANTHROPIC_API_KEY` is empty in `.env.local`.
    - OpenAI answers 429 "no credits".
    - Gemini `gemini-3.8-flash` answered 503 "high demand" during the 2026-11-02 and 2026-11-03 tests.
  - SportRadar's trial key is expired (403), so the registry skips it and reports it as unavailable.
  - The prediction step has therefore **never been seen succeeding end to end** since sub-project 3a.
- **Accuracy tracking:** it is still "en attente" (pending) by design. Nothing populates `actual_winner` yet, which is sub-project 3b's job.

## Next steps

1. **Sub-project 3b: prediction pipeline, real accuracy and the AI gateway.**
   - Both preparatory tasks are done:
     - the context docs;
     - the UnoRouter evaluation. It was rejected; Vercel AI Gateway was chosen, with a model catalog, built inside 3b. See [decisions.md § AI gateway](decisions.md#ai-gateway-preparatory-task-2-2026-11-03).
   - The objectives and prerequisites are in [progress.md § Next: sub-project 3b](progress.md#next-sub-project-3b).
   - Start with the brainstorming skill, and only after the user gives the go-ahead.

## Where to look next

| Need                                                                          | File                                                                                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| What the product is, its scope, the roadmap                                   | [project-overview.md](project-overview.md)                                                                   |
| How the code fits together (stack, data flow, providers, SSE, AI, file map)   | [architecture.md](architecture.md)                                                                           |
| Why things are the way they are (design decisions and implementation rulings) | [decisions.md](decisions.md)                                                                                 |
| What has been done, and what's next (including 3b)                            | [progress.md](progress.md)                                                                                   |
| Bugs, debt, unverified assumptions, risks                                     | [known-issues.md](known-issues.md)                                                                           |
| Original design specs and task plans                                          | [docs/superpowers/specs/](../docs/superpowers/specs/), [docs/superpowers/plans/](../docs/superpowers/plans/) |
| Initial product spec (French, pre-dates this work, partly outdated)           | [tennis-ai-predictor-spec.md](../tennis-ai-predictor-spec.md)                                                |

Working rules for agents (commands, conventions, constraints) are in [AGENTS.md](../AGENTS.md), and Claude-specific rules are in [CLAUDE.md](../CLAUDE.md).

## Keeping this file current

At the end of a session that changes the project's state, update:

- "Last updated";
- the "Current state" and "Next steps" sections;
- [progress.md](progress.md), and [known-issues.md](known-issues.md) if issues were found or fixed.

Keep this file short. Put details in the topic files.
