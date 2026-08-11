# T06 — Safe discovery of wrapper profiles and agent configs

Resolves [T06 / issue #7](https://github.com/amit-t/krosval/issues/7). Researched 2026-08-11 on persona-zero (macOS arm64, zsh). `[V]` = verified live on persona-zero, `[D]` = docs/knowledge only.

## Headline result

**Three-ring trust model.** Discovery never executes discovered code by default; each ring up requires explicit consent:

- **Ring 0 — parse only (default, no consent):** PATH/dir scanning, static rc-file parsing, read-only config reads. Produces the full registry draft with provenance (`file:line`) per fact.
- **Ring 1 — probe known binaries (one-time confirm):** run `--version` on binaries that resolve into known package-manager prefixes, with timeout, no shell, argv-only. Running `--version` *is* execution — Claude Code runs user hooks even on trivial invocations — so it stays behind a confirm.
- **Ring 2 — interactive-shell introspection (explicit per-run consent, direnv-style):** `zsh -ic` ground-truthing of wrapper functions. Executes the user's entire rc chain; consent copy must say exactly that.
- **Never (no ring):** executing a discovered *wrapper* itself. Persona-zero proof: `cly.prec.sup.cave.boil` side-effects a `git clone` of two plugin repos before ever reaching `claude` [V]. Wrappers are arbitrary code; invoking one to "see what it does" is running the thing discovery promised not to run.

## (a) Binary discovery

Findings on persona-zero [V]:

- Install channels actually in use: Homebrew (`gemini`, `codex`, `herdr`, `tmux` via `brew list`), `~/.local/bin` (`claude` native installer), nvm-scoped npm global (`~/.nvm/versions/node/v24.14.0/lib/node_modules` — contains `bun`, no agents), cargo bin (toolchain only).
- **Shims poison naive PATH scans:** inside cmux, `which -a claude` returns a per-surface temp shim (`$TMPDIR/cmux-cli-shims/<surface-id>/claude`, a bash script) *before* the real binary. Dedupe by `realpath`, classify script-on-PATH separately from binary, and treat `CMUX_*_WRAPPER_SHIM` env vars as authoritative shim markers.
- Recommended approach: union of (1) `which -a` over known agent names, (2) direct stat of known install dirs (`$(brew --prefix)/bin`, npm global bin — resolved per active node, not hardcoded (nvm moves it), `~/.local/bin`, `~/.cargo/bin`, `~/.bun/bin`), (3) env markers. Everything here is Ring 0. Version/auth probing is Ring 1.
- Trust line for Ring 1: execute only files that are executable, resolve (realpath) into a recognized package-manager prefix or were user-confirmed, argv `["--version"]` only, `Bun.spawn` without shell, hermetic env, ~5 s timeout. T04's version-string formats parse the output.

## (b) Wrapper discovery

Persona-zero ground truth [V] — a realistic worst case that static discovery must and does handle:

- `~/.zshenv` sets `ZDOTDIR="$HOME/Profiles"` and the tracked `.zshrc` lives there — **rc-chain resolution must start from `~/.zshenv` and honor `ZDOTDIR`**, not assume `~/.zshrc`.
- `co`/`cf` are one-line functions in `~/Profiles/zsh_functions/.claude-customized.zsh` (52 function definitions in one file): `co() { ANTHROPIC_MODEL="$CLAUDE_MODEL_OPUS" cly.prec.sup.cave.boil "$@"; }` — an **env-injection hop** to a persona function that composes a system prompt from files (`$CLAUDE_PROMPTS_DIR/*.md`), injects flags (`--dangerously-skip-permissions`, `--plugin-dir …`, `--append-system-prompt …`), and only then execs `claude`. Wrapper resolution is therefore **recursive**: alias/function → function → … → known agent binary, accumulating env assignments, flags, and prompt-file references per hop.
- Static extraction (Ring 0) works: plain grep for `name()` / `function name` / `alias name=` across the resolved rc chain found both wrappers and the full chain without executing anything [V]. Extract per wrapper: target agent, env vars set, flags passed, referenced prompt/config files, definition site (`file:line`).
- Interactive introspection (Ring 2) is strictly better *provenance* but executes the rc chain: `zsh -ic` on persona-zero costs 0.7 s and visibly side-effects (nvm switches node, prints output) [V]. When consented, use `zmodload zsh/parameter; $functions_source[co]` for the defining file [V] and `typeset -f co` for the effective body — this catches wrappers created dynamically (loops, eval, autoload) that static parsing misses.
- Wrappers that are scripts on PATH (cmux shims here [V]) are found by category (a) and classified by `file(1)`-style sniffing: script → parse, binary → don't.
- Other shells: fish keeps one function per file in `~/.config/fish/functions/` (most static-friendly); bash chain is `~/.bash_profile`/`~/.bashrc` with the same grep approach. zsh `fpath` autoload dirs are statically scannable (function name = file name). **Recommendation: zsh first-class in v1 (persona zero), bash/fish parse-only best-effort.**

## (c) Agent-native configs (Ring 0, read-only)

What exists on persona-zero [V] and what is signal vs noise:

| Agent | Signal (surface as profile dimensions) | Noise (never read) |
|---|---|---|
| Claude Code `~/.claude` | `settings.json` keys observed: `model`, `enabledPlugins`, `hooks`, `statusLine`, `attribution`, permission-prompt toggles; `CLAUDE.md` (global instructions); `plugins/repos/*` (installed plugin set); `agents/`, `skills/` if present | `history.jsonl`, `projects/`, `sessions/`, `file-history/`, caches, `debug/` |
| Codex `~/.codex` | `config.toml`: model, `[profiles.*]` (**native profile mechanism — maps 1:1 to krosval profile variants, selected via `--profile`** [D]), `[plugins.*]` [V], MCP servers; `AGENTS.md` | `auth.json` (secret — presence only, for auth-health), sqlite state, caches |
| Gemini `~/.gemini` | `config/mcp_config.json`, `config/plugins` [V]; `GEMINI.md`; `settings.json` auth type (overrides env — T04 finding); `oauth_creds.json` **presence/age only** for auth health (expired creds = the T04 hang trap) | `history/`, `projects.json`, tmp files, the creds *content* |

Config reads are `JSON.parse`/TOML-parse only — no agent is invoked. Auth-health facts (creds file present, mtime) matter because T04 showed Gemini headless blocks forever on dead auth.

## Prior art

- **cmux — intercept-and-record [V]:** per-surface temp shim dir prepended to PATH; shims exec `cmux-claude-wrapper`; the exact launch argv is recorded base64 in `CMUX_AGENT_LAUNCH_ARGV_B64`. Highest-fidelity wrapper knowledge available — cmux *is* the parent, so it observes rather than parses. krosval could offer this as an opt-in "high-fidelity capture" mode (`krosval discover --capture` prints a shim path the user runs once), but it can't be the default: it requires the user to launch through us.
- **herdr — cooperate-and-report [V]:** `herdr integration install <agent>` (17+ agents supported) hooks the agent's own extension points; agents then push state via the `pane report-agent` protocol; `herdr agent explain <target>` classifies what's running in a pane. Confirms the ecosystem norm: *ask the agent to identify itself* beats sniffing.
- **direnv — explicit consent unit [D]:** nothing executes until `direnv allow` per directory, re-required when the file changes. This is the consent model Ring 2 copies: consent binds to a content hash, re-prompt on change.
- **mise [D]:** same shape (`mise trust` per config file). **aider [D]:** flat YAML config + env vars, no shell integration — nothing to borrow.

## Recommended discovery pipeline (input to T10)

1. Ring 0 sweep: binaries (PATH + known dirs + env markers) → wrappers (rc-chain static parse, recursive resolution) → configs (read-only parse). Output: draft registry, every fact carrying provenance (`file:line` / path) and a `verified: parsed|probed|introspected` grade.
2. First-run interview (T10's domain) shows the draft and offers Ring 1 (probe versions/auth) and Ring 2 (introspect shell) upgrades with honest consent copy.
3. Re-discovery is cheap and idempotent; staleness = source-file mtime newer than registry entry.

## Open questions for T10

- Registry semantics: pin the **resolved** invocation (snapshot of env+flags at discovery time) or re-resolve the wrapper at council start? (Snapshot is reproducible; re-resolve tracks the user's edits. Staleness detection via mtime makes snapshot-with-warning viable.)
- How much of a wrapper's injected system prompt to surface in the profile UI — full text, digest, or filename?
- Is cmux-style `--capture` shim mode worth building in v1, or a post-v1 fidelity upgrade?
- Do wrapper-injected permission modes (`--dangerously-skip-permissions` observed in every persona-zero wrapper) get honored, warned about, or overridden per seat? (Feeds the "security posture of seats" fog with T08.)
- Cross-shell: confirm zsh-only first-class is acceptable for v1.
