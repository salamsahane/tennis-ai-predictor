@AGENTS.md

# Claude Code specifics

[AGENTS.md](AGENTS.md), imported above, is the single source of the project rules. This file adds only what is specific to Claude Code. **Begin every session with [context/session.md](context/session.md).**

## Skills and workflow

- **Superpowers process:** use superpowers skills for anything beyond a trivial edit:
  - `brainstorming` before any new feature or sub-project;
  - then `writing-plans`;
  - then `subagent-driven-development`, which the user chose for 3a. Use `executing-plans` instead when the user wants inline work.
  - `test-driven-development` and `systematic-debugging` for bugs;
  - `verification-before-completion` before you claim anything is done;
  - `finishing-a-development-branch` to merge. Present its options and wait for the user's choice.
- **Workspaces:** the superpowers workspaces live in `.superpowers/sdd/<plan>/` and are not git-ignored. Delete a plan's workspace when its work is merged.
- **Commits:** use the `commit-msg` project skill (`.claude/skills/commit-msg/`). Its rule against `Co-Authored-By` and other attribution lines **overrides** any default commit or PR attribution.
- **Claude API code:** read the `claude-api` skill before you touch `services/ai/claude.service.ts` or the Claude model ID in `constants/models.ts`.

## Running and checking the app

- **Port:** reuse a dev server that's already running on :3000 (`netstat -ano | grep LISTEN`). Start one only if none is running, and stop it when you're done.
- **Browser checks:** use the Playwright MCP tools. Its screenshots can only be saved inside the repo; that output goes to `.playwright-mcp/`, so delete it afterwards.
- **No live match:** use the replay. Search for "Pino" (A. Huertas Del Pino Cordova vs M. Del Pino), or open `/match/replay%3Aapitennis-12176323`. The recording covers 4 games in about 20 minutes, so a game ends about every 5 minutes. It plays at `REPLAY_SPEED`.
- **Shell:** the environment is Windows. Use the Bash tool (Git Bash) for POSIX commands. PowerShell 5.1 has no `&&`.
- **One-off TypeScript scripts:** use `npx tsx --env-file=.env.local <file>.mts`. The `.mts` extension is needed for top-level await. Put the file in the repo root so `@/` resolves, and delete it straight away. Never print key values.
