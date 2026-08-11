# T07 — Persona-zero machine inventory

Ground truth of Amit's primary machine, captured live 2026-08-11 by an agent session running on it. Sanitized: no tokens, no credential contents, no auth file bodies. This is the day-one dataset the discovery design (T10) must handle, and fixture material for discovery tests.

**Machine:** macOS (Darwin 25.5.0), Apple Silicon (`/opt/homebrew`). Login shell `/bin/zsh`. Node v24.14.0 (nvm), Bun 1.3.11 (npm-global under nvm).

---

## 1. Installed agents

| Agent | Version | Real binary | Install method |
|---|---|---|---|
| Claude Code | 2.1.227 | `~/.local/bin/claude` | native installer |
| Codex CLI | 0.146.0 | `/opt/homebrew/bin/codex` | Homebrew |
| Gemini CLI | 0.44.0 | `/opt/homebrew/bin/gemini` (Cellar `gemini-cli`) | Homebrew |
| Devin CLI | 3000.4.16 | `~/.local/bin/devin` | native installer |
| grok | (not probed) | `/Applications/cmux.app/Contents/Resources/bin/grok` | bundled with cmux |
| aico | (not probed) | on PATH; cmux AI-conductor that spawns `zsh -lc clscb` | project tool |

**Absent:** qwen, opencode, amp, aider, cursor-agent, crush, goose, ollama, llm, aichat. Matches T04's skip-for-v1 calls; persona zero runs exactly the three primaries + Devin.

**PATH shadowing — three layers deep for `claude`:**

1. Interactive zsh: `claude` is a **shell function** (greeting wrapper, §3 layer 1).
2. Under it, PATH hit #1 is a **cmux shim**: `$TMPDIR/cmux-cli-shims/<surface-uuid>/claude` — a bash script that re-execs through `cmux-claude-wrapper` (argv intercept-and-record, per-surface dir keyed by the cmux surface UUID). Same for `codex`.
3. Real binary `~/.local/bin/claude` is PATH hit #2.

`which claude` answers differently in interactive vs non-interactive shells: `Profiles/.zshrc` runs `unfunction claude grok codex` to strip cmux's *shell-integration* shim functions and force-prepends `~/.local/bin` + `hash -r` — but the temp-dir shim still fronts PATH for bare `zsh -c` outside that rc path. **Dedupe by realpath is mandatory** (T06 confirmed; here it's live in every cmux-hosted session).

## 2. Shell + rc chain

Dotfiles are a **git repo**: `~/Profiles` (`ZDOTDIR`). Chain for an interactive shell:

```
/etc/zshenv            (empty)
~/.zshrc               3-line bootstrap: export ZDOTDIR=$HOME/Profiles; source $ZDOTDIR/.zshrc
  ~/Profiles/.zshrc    oh-my-zsh (robbyrussell, ENABLE_CORRECTION, CORRECT_IGNORE='.claude')
    ~/Profiles/.zprofile   guarded by PROFILES_ZPROFILE_LOADED (with stale-export detection)
      .paths_profile, .bash_aliases (36 KB, 361 aliases), .bash_profile
      ~10 external per-project alias files across other repos (EverPlan, ai-devkit, ai-ralph, daemons…)
      zsh_functions/.*.zsh   (~30 hidden function files, incl. all agent wrappers)
~/Profiles/.zshenv     sets ZDOTDIR + minimal PATH for `zsh -c`; sources cargo env
~/.zprofile            exports devkit/ralph env (DEVKIT_DEFAULT_ENGINE=devin, PER_DEVKIT_CLAUDE_CMD=clscb, …)
```

Discovery-relevant properties:

- **ZDOTDIR indirection is real** (T06's worst case): `~/.zshrc` exists but is only a bootstrap; canonical config lives in the Profiles repo.
- Alias/function definitions are scattered across **~40 files in ≥6 repos**, not just the rc files. Static parse must follow `source` lines recursively.
- Load-guard variables (`PROFILES_ZPROFILE_LOADED`) mean naive re-sourcing in a probe shell can silently skip definitions.
- bash/fish effectively unused; zsh-only machine. tmux default-shell = zsh (no user tmux.conf found).

## 3. Wrapper profiles (the `co`/`cf` chain)

Three stacked layers, all in `~/Profiles/zsh_functions/`:

**Layer 1 — bare-name pass-through** (`.ai-greeting-wrappers.zsh`): `claude()`, `codex()`, `devin()` are functions wrapping `command <bin>`. Sets `AI_GREETINGS=off` for non-TTY / `--version` / `--help` / `-p` / `exec` / `mcp` calls. Escape hatch: `command claude`. **Gemini is unwrapped** — the only bare agent.

**Layer 2 — persona launcher** (`claudec` in `.claude-customized.zsh`, 843 lines): `claudec --<persona>` maps to `claude_prompts/<persona>.md` (26 persona files: pool, socratic, mad-max, commit, gen-pr, pr-merge, wt-merge, prd-to-beads, prec/boil/cave/super combos…). Composes `--append-system-prompt` from persona + optional `boil.md`; task personas also inject a kick-off *user* prompt. Completion personas force `--dangerously-skip-permissions`.

**Layer 3 — mode-stack family** (`cly.*`): every combination of precision × superpowers × caveman × boil as a function. Common shape:

```zsh
cf() { ANTHROPIC_MODEL="$CLAUDE_MODEL_FABLE" cly.prec.sup.cave.boil "$@"; }
cly.prec.sup.cave.boil() {
  # git clone plugins if missing  <-- side effect on first run
  claude --dangerously-skip-permissions \
    --plugin-dir ~/.claude/plugins/repos/superpowers \
    --plugin-dir ~/.claude/plugins/repos/caveman \
    --append-system-prompt "Start in caveman ${level} mode immediately.\n\n$(ai-mode.sh claude prec-boil)" "$@"
}
```

Facts a discovery engine must extract from this chain:

- **Model pinning via env, not argv**: `ANTHROPIC_MODEL=claude-opus-5|claude-fable-5` (o/f suffix convention: `co`/`cf`, `clbo`/`clbf`, `ccbo`/`ccbf`…). Invisible to argv parsing; visible only in the function body.
- **System prompt assembled at runtime** by `Profiles/scripts/ai-mode.sh <platform> <mode>` from `<platform>_prompts/*.md` — the prompt text is not inline in the wrapper.
- **`--dangerously-skip-permissions` in every yolo-family launcher** (the entire short-alias set). Confirms the T06/T10 honor-warn-override question.
- **First-run side effect**: missing plugin dir triggers `git clone` (verified in T06; source shown here). Never execute wrappers to discover them.
- **Wrapper count**: ~45 Claude launcher functions/aliases + mirrored families for Codex (`codexc`, `cxy.*`, `cx*` — same persona/mode structure over `codex_prompts/`) and Devin (`dey*` family, `DEVIN_DEY_MODEL=gpt-5.6-luna`, strips caller `--model` args). Alias haystack total: 361 aliases in `.bash_aliases` alone.
- `co.w`/`cf.w` inject a full wayfinder work prompt as first positional arg (this session was launched by one).
- `co.aico`/`cf.aico` route through the `aico` daemon which spawns `zsh -lc clscb` — wrapper invocation via nested login shell.

## 4. Claude Code config surface

- `~/.claude/settings.json`: `model: "opus[1m]"`; SessionStart hook `~/.claude/hooks/herdr-agent-state.sh` (herdr status reporting); statusline `gage-statusline.cjs`; `skipDangerousModePermissionPrompt: true`, `skipAutoPermissionPrompt: true`; enabled plugins: claude-powerline (own marketplace), frontend-design, rust-analyzer-lsp (official).
- Plugin clones cached at `~/.claude/plugins/repos/{superpowers,caveman}` (wrapper-managed, re-clone on update).
- **32 user skills** in `~/.claude/skills/` (wayfinder, grill-me/auto, mode combos, graphify, gitnexus×5, code-review, session-handoff pair…).
- No output styles, no user agent definitions.
- CLAUDE.md: global `~/.claude/CLAUDE.md` + per-project files (11+ under `~/Projects`, incl. `~/Profiles/CLAUDE.md` = `AGENTS.md` cross-platform copy).
- MCP: **no global servers**; per-project only (1 of 55 projects: `Profiles` → `gitnexus`). claude-in-chrome arrives via the Chrome extension, not `mcpServers`.
- Per-project memory dirs under `~/.claude/projects/<slug>/memory/`.

## 5. Codex + Gemini + Devin config surface

- `~/.codex/config.toml`: `model = "gpt-5.6-sol"`, `model_reasoning_effort = "xhigh"`, `personality = "pragmatic"`, six OpenAI plugins enabled, `notify` hook to a Computer-Use companion app. Also present: `AGENTS.md`, `hooks.json`, **`herdr-agent-state.sh`** (same herdr hook installed for Codex), `superpowers/` dir, skills, sqlite state/memories.
- `~/.gemini/`: `settings.json` = oauth-personal only; `GEMINI.md`; antigravity + antigravity-cli dirs; `trustedFolders.json`. Effectively stock.
- Devin: prompts in `Profiles/devin_prompts/`, wrapper-pinned model `gpt-5.6-luna`.

## 6. Terminals

| Terminal | Version | Install | Status |
|---|---|---|---|
| cmux | 0.64.22 | .app bundle + bundled CLI | **running** — hosts this session; per-surface CLI shims; shell-integration functions (unfunctioned in zshrc) |
| herdr | 0.7.4 | Homebrew | **running**; agent-state hooks installed into both Claude and Codex config |
| Ghostty | installed | .app | **running**; config at `~/.config/ghostty/` with 6 timestamped backups + `Profiles/zsh_functions/.ghostty-sync.zsh` sync tooling |
| tmux | 3.6a | Homebrew | installed; no user config found (stock) |
| iTerm2 | installed | .app | present, not running at capture; `.iterm-tab-color.zsh` helper exists |

Detection-order hazard from T05 confirmed present: cmux sets `CMUX_*` env and masquerades via `TERM_PROGRAM`; a herdr server answers CLI calls even in cmux-hosted tabs.

## 7. Surprises — discovery edge cases (T10 test fixtures)

1. **Bare name resolves 3 ways**: function (interactive) → cmux temp shim (PATH) → real binary. Any `which`-based discovery is wrong in at least one shell mode.
2. **Per-surface shim dirs** in `$TMPDIR` keyed by cmux surface UUID — PATH contents differ *per tab* and vanish on session end. Realpath dedupe + ignoring temp dirs both required.
3. **`unfunction claude grok codex` + PATH re-order + `hash -r` inside `.zshrc`** — the user actively fights the terminal's own shims; discovery must not re-report shims the rc chain kills.
4. **Model selection lives in env vars** (`ANTHROPIC_MODEL`, `CLAUDE_MODEL_OPUS/FABLE`, `DEVIN_DEY_MODEL`) set inside function bodies — argv parsing alone misses the seat's model identity.
5. **System prompts assembled by a helper script** (`ai-mode.sh`) from prompt-fragment dirs; static wrapper parse must either execute nothing and record the script reference, or parse one level into the script to find the `.md` sources.
6. **Every yolo launcher injects `--dangerously-skip-permissions`**, and Claude settings additionally set `skipDangerousModePermissionPrompt` — the honor/warn/override decision (queued for T10) is not hypothetical; it is every seat on this machine.
7. **First-run `git clone` side effect** inside wrapper functions — live proof of T06's never-execute rule.
8. **Greeting wrappers change behavior on `--version`/`-p`** (set `AI_GREETINGS=off`) — even Ring-1 probes traverse user code when invoked through the function; probe the *real binary path*, not the bare name.
9. **herdr hooks installed inside agent configs** (`~/.claude/hooks/`, `~/.codex/`) — terminal integrations leak into agent config surfaces; discovery must attribute these to the terminal, not the agent.
10. **Load-guard vars with stale-export detection** in rc files — sourcing rc files in a probe subshell can no-op; parse, don't source (T06 Ring 0 confirmed as the only reliable path).
11. **361-alias haystack + ~10 cross-repo sourced alias files** — wrapper discovery must rank/filter candidates, not present everything.
12. **oh-my-zsh autocorrect quirk**: `CORRECT_IGNORE='.claude'` exists because a `.claude/` dir in cwd made zsh propose correcting `claude` → `.claude`. Cosmetic, but shows rc files carry agent-adjacent noise that parsing must not misread as wrappers.
13. **Gemini is the control case**: brew-installed, zero wrappers, near-stock config. Discovery should find it trivially; if the engine over-reports on Gemini, the heuristics are wrong.

## 8. Registry seed for T10

Minimal seat candidates a correct discovery run should produce on this machine:

- `claude` (real: `~/.local/bin/claude`, 2.1.227) + wrapper profiles: `co` (opus, prec+sup+cave+boil, yolo), `cf` (fable, same), `clc`/`clb`/`ccb`/`clsb`/`clscb` family, `claudec --<persona>` ×26 — each with: injected model env, plugin dirs, system-prompt source refs, permission mode = skip.
- `codex` (real: `/opt/homebrew/bin/codex`, 0.146.0) + `cxy.*`/`codexc` family.
- `gemini` (real: `/opt/homebrew/bin/gemini`, 0.44.0), no wrappers.
- `devin` (`~/.local/bin/devin`, 3000.4.16) + `dey*` family — out of v1 target set but present; discovery should surface-and-ignore gracefully.
- Terminals: cmux (running, Tier 1), herdr (running, Tier 1), tmux (installed, Tier 1 reference), Ghostty (running, Tier 2), iTerm2 (installed, Tier 2).
