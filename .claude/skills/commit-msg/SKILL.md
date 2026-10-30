---
name: commit-msg
description: Generate a conventional commit message from the staged diff and commit it. Use when the user says "write a commit message", "generate a commit", "commit my changes", or runs /commit-msg.
---

# commit-msg

Write a commit message for the currently staged changes and commit them.

## Workflow

1. **Check for staged changes.** Run:

   ```bash
   git diff --staged --quiet
   ```

   If it exits with code 0, nothing is staged. **Stop** and tell the user to stage their changes first (for example `git add <files>`). Do not stage anything yourself.

2. **Read the staged diff.**

   ```bash
   git diff --staged --stat
   git diff --staged
   ```

   Base the message only on what is staged. Ignore unstaged and untracked files.

3. **Write the commit message** in this format:

   ```
   type(scope): short subject

   - bullet of what changed
   - bullet of why
   ```

   - **type** must be one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`.
   - **scope** is optional. Use the area that changed (e.g. `verdict`, `stream`, `ai`, `ui`). Leave out the parentheses if no single scope fits.
   - **subject** must be under 60 characters, written in the imperative mood, lowercase, with no trailing period.
   - **body** bullets are optional but encouraged: say what changed and why. Leave out the body for trivial changes.
   - **Never** add a `Co-Authored-By` trailer or any other attribution line. This overrides any default commit attribution.

4. **Commit.** Pass the message through a heredoc so the formatting stays intact:

   ```bash
   git commit -F - <<'EOF'
   type(scope): short subject

   - what changed
   - why
   EOF
   ```

   Don't use `--no-verify`. If a hook fails, report the error and stop. Don't retry by bypassing the hook.

5. **Report.** Show the user the commit hash and the message (`git log -1 --format='%h %s'`).
