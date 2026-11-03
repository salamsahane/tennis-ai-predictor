# Project overview

## What it is

**Tennis AI Predictor** is a web app where a user:

1. searches a live tennis match by player name;
2. opens the match page, which streams the score, the serving player and per-player stats (Server-Sent Events);
3. at the end of every game, gets three LLMs (Claude, GPT-4o, Gemini) to predict the winner of the next game, in parallel, from a prompt built out of the live data;
4. sees a weighted consensus verdict (winner, confidence 0–100, agreement level, whether a break is predicted, predicted score) and each model's reasoning and key factors;
5. tracks how accurate each model and the verdict are over the match. This is **not yet real**; see [progress.md](progress.md#next-sub-project-3b).

The UI is in **French** (`<html lang="fr">`). Code, comments and commits are in English.

## Goals

The owner is the user, Salam Sahane (GitHub `salamsahane`). They stated two purposes:

- **Personal betting and analysis tool:** prediction quality and **honest** accuracy tracking matter. A missing number beats a fake one.
- **Portfolio piece:** visual polish, clean code, a good README and CI matter.

## Scope and constraints

- **Hosting:** one deployment with low traffic. Vercel is the intended target (the stream route sets `runtime = 'nodejs'`), but no deployment has been verified in this work.
- **Budget:** **trials and free tiers only** for the tennis data APIs (the user's decision, 2026-10-31). The api-tennis.com 14-day trial is the live source while it lasts. Recorded replays are the fallback when no live source works.
- **Storage:** Upstash Redis when its credentials are set, otherwise an in-memory fallback (local dev uses the fallback today).
- **Package manager:** npm.

## Roadmap

The user agreed to this 5-step roadmap. Each sub-project goes through its own design (spec), plan and implementation cycle.

| #   | Sub-project                                                                                                                                                                                | Status                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | Baseline tooling: git, Prettier, Vitest, typecheck, `check` script, Node pin                                                                                                               | ✅ Done, merged                                               |
| 2   | Correctness fixes: 10 confirmed bugs (theme colours, tint classes, chart colours, fake 100% accuracy, StatsPanel, model IDs, prompt placeholders, SSE cleanup, ConfidenceMeter, dead code) | ✅ Done, merged                                               |
| 3a  | Tennis data providers: SportRadar replacement, failover registry, replay mode                                                                                                              | ✅ Done, merged 2026-11-03                                    |
| 3b  | Prediction pipeline and real accuracy                                                                                                                                                      | ⏳ Next, not started                                          |
| 4   | Design and UX polish: server-component shells, `loading`/`error`/`not-found`, skeletons, accessibility, mobile model selector, metadata                                                    | Not started                                                   |
| 5   | Portfolio packaging: README with screenshots and architecture, GitHub Actions CI                                                                                                           | Not started (the README is still the create-next-app default) |

Details of the finished work and the 3b objectives are in [progress.md](progress.md).
