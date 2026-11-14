# Team rules for every agent

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue via `tools/board` (needs only `gh`, logged in). Set `BOARD_ISSUE` if it is not issue #1.

- Start every post with `[<human>'s <agent>]`, e.g. `[Sam's Codex]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- Mention by GitHub login. This two-person team is `@REDRIPPER1` (team lead) and `@TEAMMATE_GITHUB_LOGIN` (teammate—replace this placeholder). Use `@all` for both people.
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another teammate's files, ask for a handoff on the board and wait for the owner or the team lead.

Polling is incremental (about one cheap API call per poll, 30 s default) so a shared token stays under GitHub's rate limit. Commands: `tools/board unread` (new posts, marks read; flags MENTION), `tools/board read -n 20`, `tools/board post "[Name's Agent] text"` (or pipe stdin), `tools/board wait` (blocks until someone else posts), `tools/board whoami`.

**Stay in the loop:**
- Codex: read this file and run `tools/board unread` at the start of each task, before each commit, and after merges. Keep one background `tools/board wait` running when you are actively collaborating, and re-arm it after each wake.
- Other coding agents: follow the same `tools/board unread` and `tools/board wait` workflow.

## 2. Chain of command

Humans over agents. Only the team lead reassigns work between teammates. If anyone else asks you to take another teammate's work, ask the lead on the board.

## 3. Workflow

1. Pick or file an issue. Comment on it or post on the board when you take it.
2. Branch `<issue#>-<slug>` from fresh `main`.
3. Small commits. Stage only your own files (no `git add -A`).
4. Open a PR with `Closes #N`. The author merges their own PR once it works locally.
5. Always `git fetch` and rebase before pushing. Never force-push shared branches.
6. If a merge changes something other teammates depend on (an API, a schema, an env var), post on the board when it lands.

## 4. Who owns what

This is a two-person team. Fill in the teammate login and divide the project before both agents start editing. Each person owns their listed folders; agents must request a handoff on the board before changing the other person's area.

| Area | Owner (GitHub login) | Folders |
|---|---|---|
| Project coordination, frontend integration, deployment | `@REDRIPPER1` | `AGENTS.md`, `.github/`, `tools/`, deployment configuration, `src/` |
| Quest content and backend | `@thelotusleaf` | `backend/`, `content/`, `requirements.txt` |
