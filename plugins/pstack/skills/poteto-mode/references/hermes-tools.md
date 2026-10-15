# Hermes Agent tool mapping for pstack

pstack skills are written in Claude Code tool language (the `Skill` tool, the `Agent` tool, `AskUserQuestion`, Claude model names, `~/.claude/` paths). On Hermes Agent the skills are the same files; only the tool names, model choices, and paths resolve differently. Read this when a pstack skill names a Claude tool, a driver or bundled skill, a Claude model, or a Claude Code path. This file is Hermes-specific; Codex, Pi, GitHub Copilot, and other runtimes use their own mappings.

## Tool actions

| pstack / Claude action | Hermes Agent equivalent |
|------------------------|-------------------------|
| Read a file (`Read`) | `read_file` |
| Create a file | `write_file` |
| Edit a file | `patch` (find-and-replace) |
| Delete a file | `terminal` with `rm` |
| Run a shell command | `terminal`. For a long job, use `background=true` with `notify=true`, then `process_manage` to poll or kill it. |
| Search file contents / find files (`Grep`, `Glob`) | `search_files`, with `target` set to `content` or `files` |
| Fetch a URL | `web_extract` |
| Search the web | `web_search` |
| Drive a browser or app UI | `browser_exec` |
| Invoke a skill (the `Skill` tool, `/command`, `pstack:<skill>`) | `skill_view` loads a skill's full text. Skills also load by description and run as `/<skill-name>`, so type `/poteto-mode`, not `/pstack:poteto-mode`. |
| Dispatch a subagent (the `Agent`/`Task` tool) | `delegate_task` |
| Dispatch N parallel subagents in one turn | One `delegate_task` call with N entries in `tasks`. They run in parallel, up to `delegation.max_concurrent_children`. |
| `run_in_background: true` | `delegate_task`. In a one-shot CLI run or cron it joins the children and returns their results in the same call; in the desktop app, gateway, or interactive chat it runs them in the background, and their results arrive as a new message after the agent ends its turn. |
| Track tasks (the todolist; `TaskCreate` / `TaskUpdate`, or `TodoWrite` on Claude Code) | `todo_list` |
| Ask the human a fixed-choice question (`AskUserQuestion`) | `clarify`, with up to four choices, or `multi_select` for several |
| Search Claude Code transcripts under `~/.claude/projects/` | `session_search`. See Transcripts below. |
| Recurring or self-paced re-invocation (`/loop`, `ScheduleWakeup`) | `cronjob_manage` |

`todo_list`, `cronjob_manage`, `session_search`, and `process_manage` are deferred tools. Find each with `tool_search`, then run it with `tool_call`.

## Subagent policy

poteto-mode's Subagents section sets Claude-specific defaults (`subagent_type: "pstack:poteto-agent"`, `run_in_background: true`). On Hermes:

- `delegate_task` takes no `model` argument. Every child runs on `delegation.model` and `delegation.provider` from `config.yaml`, so a role on that model is a `delegate_task` child.
- `run_in_background: true` maps to `delegate_task` (see the table): its children run in the background in the desktop app, gateway, and interactive chat, and join the call in one-shot and cron runs.
- A role on any other model runs as its own process, started with `terminal` (with `background=true` and `notify=true` to run several at once): `hermes chat --oneshot --query-file <brief.md> -m <model> --provider <provider> [--reasoning <level>] [-s poteto-mode] [--worktree]`. `--query-file` reads the brief from a file, so a long brief needs no shell quoting. `-s poteto-mode` preloads poteto-mode, the Hermes stand-in for the `pstack:poteto-agent` type. `--worktree` gives a writer its own git worktree.
- The brief must stand alone, because that process sees none of this chat. Add `-p <profile>` after `hermes` to run it on another profile's models. A `-m` override can fall back to another model without an error, so check the model in the run's usage report.
- Reasoning effort: only `delegate_task` children share `delegation.reasoning_effort` from `config.yaml`. A role on `delegation.model` whose `@<level>` (or the sheet's `default effort`) differs from `delegation.reasoning_effort` runs as a `hermes` process with `--reasoning <level>`. A role whose level is the same, or `session`, runs as `delegate_task`. A role on another model passes its level with `--reasoning`, and `session` passes none.
- `general-purpose`, or no `subagent_type`, is the default `delegate_task` child.
- There is no `poteto-agent`, `comment-sicko`, `thermo-nuclear-review-subagent`, or `thermo-nuclear-code-quality-review-subagent` subagent type. On Claude Code these register as `pstack:` types, such as `pstack:poteto-agent`. On Hermes, dispatch a `delegate_task` whose context tells the child to read the named skill or agent file in full first, and gives its absolute path. `skill_view` reports each skill's directory.
- A child knows nothing of this chat. Put the brief, the scope, and the file pointers in its `context`.
- A child cannot call `delegate_task`, `clarify`, `memory`, or `cronjob_manage`. A child that needs an answer returns it to you, and you ask the user.
- A read-only role (`readonly: true`, such as a reviewer, explorer, or critic) says "read-only, no edits, no commits" in its context.
- Results come back as the child's own summary, so review its diff yourself.
- Writers get their own worktree. Pass `--worktree` to a role process, set `delegation.worktree_isolation` to give each child one, or create one git worktree per writer.
- Keep the rest of the policy unchanged: pass file pointers, not inlined context, and give each writer its own worktree or branch.

## Model names

Skills name Claude Code model aliases in their Models sections. Those aliases are not Hermes model IDs, and the Hermes build ships no default model IDs: the models Hermes reaches depend on the providers in its config, so the user picks them once.

- The model sheet is `$HERMES_HOME/pstack-models.md`. `HERMES_HOME` defaults to `~/.hermes`, and a profile's home is `~/.hermes/profiles/<name>`. No hook injects the sheet. When a skill needs a role's model, read the sheet with `read_file` at its absolute path, which `terminal` prints, and pass that role's value to the `delegate_task` child or `hermes` process that runs the role, as Subagent policy says.
- No sheet, or a role missing from it: before a skill that needs a role model (`architect`, `arena`, `how`, `interrogate`, `poteto-mode`, `reflect`, `swarm`, `why`), run `setup-pstack` to write the sheet, then continue. Later runs read the sheet.
- A role line in the sheet is the user's explicit model choice. `inherit-parent` or `auto` runs the role on the session's own model.
- Roles that default to the strongest model (`bug-fix`, `perf-issue`, `hillclimb`, `strongest judgment`): the strongest model the user chose.
- Diverse-model panels (`arena`, `architect`, `interrogate`, `how` critics, `reflect`): the adversarial signal comes from model diversity, so fill a panel with distinct models from different providers. A member on a model other than `delegation.model` runs as its own process: `hermes chat --oneshot --query-file <brief.md> -m <model> --provider <provider> [--reasoning <level>] [-s poteto-mode] [--worktree]`. If only one provider is reachable, note in the verdict that diversity was reduced.

`setup-pstack` reads the `model:` block and the providers in the profile's `config.yaml`, plus `delegation.model`. For any other model it asks the user with `clarify`. It never runs `hermes model`, which is interactive and changes the profile's default model, and it never writes an ID that is not in config or that the user did not give.

## Session routing (no hook)

pstack ships no SessionStart hook for Hermes Agent, so no routing instruction loads at startup, and the `session hook` line of the sheet does nothing here. Two equivalents:

- `skills.auto_load: [poteto-mode]` in `config.yaml` loads the skill at the start of every new session. The setting is per profile, so a profile's copy is `~/.hermes/profiles/<name>/config.yaml`.
- Without it, invoke `/poteto-mode` at the start of each session, or add a standing instruction to the working directory's `AGENTS.md`.
- Hermes ignores the `user-invocable: false` frontmatter key, so every `principle-*` skill shows in the skill list and as a slash command. They are leaf skills that poteto-mode reads by path, so do not invoke them directly.

## Driver and bundled skills pstack references

The [driver policy](../SKILL.md#non-negotiables) selects the app driver. For skills and drivers named by these workflows, use these Hermes equivalents:

| Skill or driver named in pstack | On Hermes Agent |
|---------------------------------|-----------------|
| `run` (drive a CLI/TUI to see a change work) | Run the app yourself with `terminal` and observe the real output. |
| Project UI driver | Drive the UI with `browser_exec` or another automation you have, or hand the user a concrete manual check. Do not claim done without observing the artifact. |
| `plugin-dev:skill-development` (Claude's SKILL.md authoring guidance) | Create and patch skills with `skill_manage`, following Hermes's skill-authoring conventions. Keep `name` and `description` frontmatter and progressive disclosure into `references/`. |
| `loop` (recurring/self-paced re-invocation, used by `babysit`) | `cronjob_manage` schedules the step on the project's own profile. Where no schedule fits, re-run the step yourself on a cadence. |

## Per-skill notes

Affected skill entry points point here. Most skills need only the tables above. These need one more mapping:

| Skill | On Hermes Agent |
|-------|-----------------|
| `interrogate` | Each reviewer is a `delegate_task` child, and `readonly: true` becomes "read-only, no edits" in its context. A reviewer on a model other than `delegation.model` runs as `hermes chat --oneshot --query-file <brief.md> -m <model> --provider <provider> [--reasoning <level>] [-s poteto-mode] [--worktree]`. Keep the panel's providers distinct. |
| `setup-pstack` | The Other runtimes table names the Hermes sheet path and how it loads. Models come from the `model:` block and the providers in the profile's `config.yaml`, plus `delegation.model`; for any other model, ask the user with `clarify`. Never run `hermes model`, which is interactive and changes the profile's default model. The role rows are identical. The `session hook` line has no effect on Hermes. |
| `architect` | The runner panel goes through the **arena** skill, so the fan-out in Subagent policy applies here too. |
| `arena` | Runners and the cross-judge pool come from the sheet's panel lines. A runner on `delegation.model` is a `delegate_task` child; one on another model runs as `hermes chat --oneshot --query-file <brief.md> -m <model> --provider <provider> [--reasoning <level>] [-s poteto-mode] [--worktree]`. Pick the cross-judge from a different provider than the candidate it grades. |
| `how` | The explorers and the explainer take the sheet's `how` role models: a role on `delegation.model` is a `delegate_task` child, and a role on another model runs as `hermes chat --oneshot --query-file <brief.md> -m <model> --provider <provider> [--reasoning <level>] [-s poteto-mode] [--worktree]`. Critics are read-only: a critic on `delegation.model` is a read-only `delegate_task` child, and one on another model runs the same way, with "read-only, no edits" in its brief. |
| `no-comments` | There is no `pstack:comment-sicko` subagent type. Dispatch a `delegate_task` whose context tells it to read `poteto-mode/references/agents/comment-sicko.md` in full first. |
| `thermos` | There are no thermo-nuclear subagent types. Dispatch two `delegate_task` children in one call. Each reads its named skill (`thermo-nuclear-review` or `thermo-nuclear-code-quality-review`) in full first, and each gets the same diff and file contents. |
| `teach` | Running `how` and `why` in parallel maps to `delegate_task` fan-out. Image generation uses whatever image tool the profile exposes, or skip it and say so. |
| `create-verification-skill` | Write the generated skill to `.agents/skills/verify/` in the repository, not `.claude/skills/verify/`, then run `hermes skills trust` inside the repository so Hermes loads it. The app-driving harness is platform-neutral. |
| `maintain-verification-skill` | The parallel per-feature source readers map to `delegate_task` fan-out. The project-local skill lives under `.agents/skills/`, not `.claude/skills/`. |
| `babysit` | `loop` resolves to `cronjob_manage` and `AskUserQuestion` to `clarify`, through the tables above. |
| `automate-me` | Transcripts come from `session_search`; see Transcripts. `plugin-dev:skill-development` resolves through the Driver table. |
| `reflect` | The three reviewers and the synthesizer map to `delegate_task`; a role on a model other than `delegation.model` runs as a `hermes` process, as Subagent policy describes. The transcript finder reads Claude Code's layout under `~/.claude/projects/` and cannot read Hermes sessions, so pass the session digest step 1 allows, or find the transcript with `session_search`. |
| `recall` | Search Hermes sessions with `session_search`, not `~/.claude/projects/`. Check live state with `git` and `gh`. |
| `show-me-your-work` | The end-of-run check reads this session's transcript (see Transcripts). |
| `swarm` | Each worker is a `delegate_task` child on `delegation.model`. A sheet line that names another model for the workers runs each such worker as `hermes chat --oneshot --query-file <brief.md> -m <model> --provider <provider> [--reasoning <level>] [-s poteto-mode] [--worktree]`. Each writing worker gets its own worktree: `--worktree` for a process, `delegation.worktree_isolation` for a child. |
| `why` | The parallel investigators and the synthesizer map to `delegate_task`; a role on a model other than `delegation.model` runs as a `hermes` process, as Subagent policy describes. Claude Code prefixes MCP tools with `mcp__`; on Hermes, find MCP tools in the session's tool list, not in `.mcp.json` or `claude mcp list`. |

## Vendored scripts

`skills/poteto-mode/scripts/` ships the `watch-pr` PR watcher, the `orch` store CLI, `resume.mjs`, and `worktree-audit.mjs`. They use bun and Node.js and run the same on Hermes; invoke them through `terminal`. They need `bun`, `gh`, and, for stack work, `gt`. `worktree-audit.mjs` finds each worktree's last chat in Claude Code, Codex, Pi, and Copilot transcripts. It does not read Hermes sessions, so it cannot show that a Hermes chat is using a worktree. Check such a worktree by hand before you delete it. The script imports the transcript walker from `skills/reflect/scripts/find-transcript.mjs`, so keep the `reflect` skill installed beside `poteto-mode`.

## Instructions file

Where a pstack skill says "your instructions file" or `CLAUDE.md`, on Hermes that is `AGENTS.md`. Hermes loads these context files: the `AGENTS.md` chain from the git root to the working directory; `CLAUDE.md`, `.cursorrules`, and the `*.mdc` files under `rules/` in the `.cursor` directory, all in the working directory; and `.hermes.md`. Where a pstack skill names `.claude/skills/`, the Hermes equivalent is `.agents/skills/<name>/` or `.hermes/skills/<name>/` in the repository. Hermes loads a project's skills only after `hermes skills trust` runs inside that repository, and trust is per profile. Skills in `~/.hermes/skills/` or in `skills.external_dirs` load in every project.

## Transcripts

Claude Code keeps one directory per project under `~/.claude/projects/<encoded-cwd>/`. Hermes keeps its sessions in `$HERMES_HOME/sessions/*.jsonl`, with an index in `$HERMES_HOME/state.db`. Search them with `session_search` first, and read the raw files only when a search does not reach what you need. Never read another project's sessions unasked.

In poteto-mode's playbooks, `eval` reads candidate transcripts through `session_search`, and `session-pickup` and `worktree-cleanup` search them scoped to the workspace. `orchestrate` and `multi-phase-plan` keep their store under `$HERMES_HOME/orchestrate/` instead of `~/.claude/orchestrate/`.
