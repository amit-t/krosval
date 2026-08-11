# T04 — Headless invocation contracts of target CLI agents

Resolves [T04 / issue #5](https://github.com/amit-t/krosval/issues/5). Researched 2026-08-11 on persona-zero (macOS arm64, Bun 1.3.11, Node 24.14.0).

**Provenance.** Primaries verified live against installed binaries: Claude Code **2.1.227**, Gemini CLI **0.44.0**, Codex CLI **0.146.0**. Secondaries (opencode, aider, Qwen Code, Amp, Cursor CLI) docs-only — not installed. `[V]` = verified locally, `[D]` = docs-only. Gemini caveat: OAuth creds on this machine are expired, so Gemini was verified up to the API-error path (parsing, events, exit codes) but not a successful reply.

## Comparison matrix

| Capability | Claude Code 2.1.227 | Gemini CLI 0.44.0 | Codex CLI 0.146.0 | Qwen Code | opencode | Amp | aider | Cursor CLI |
|---|---|---|---|---|---|---|---|---|
| Headless entry | `-p/--print` [V] | `-p/--prompt` [V] | `codex exec` [V] | `-p` [D] | `opencode run` [D] | `-x/--execute` [D] | `--message` [D] | `agent -p` [D] |
| Stdin as prompt/context | yes, 10MB cap [V] | yes, `-p` appended to stdin [V] | yes (`-` or appended `<stdin>` block) [V] | yes [D] | undocumented | yes [D] | no | undocumented |
| Structured stream | `--output-format stream-json` (**requires `--verbose`**) [V] | `-o stream-json` [V] | `--json` [V] | `stream-json` [D] | `--format json` (schema undocumented) [D] | `--stream-json` [D] | **none** | `stream-json` (schema undocumented) [D] |
| Framing | NDJSON, `result` last | NDJSON, `result` last | NDJSON, `turn.completed` last | NDJSON (Claude-shaped) | JSON events | NDJSON | plain text | NDJSON |
| Session id source | every event + result [V] | `init` event [V] | `thread.started.thread_id` [V] | `system` event [D] | `--session` flag [D] | thread id [D] | n/a | chatId [D] |
| Headless resume | `--resume <id>` [V]; `--fork-session` branches [V] | `-r <latest\|idx\|uuid>` [V]; cwd-scoped | `codex exec resume <id>/--last` [V]; cwd-scoped picker | `--continue`/`--resume <uuid>` [D] | `-c`/`-s <id>`/`--fork` [D] | `threads continue -x` [D] | weak (`--restore-chat-history`) | `--resume`/`--continue` [D] |
| Pin session id up-front | `--session-id <uuid>` [V] | `--session-id <uuid>` [V] | no (read from first event) | no | no | no | n/a | no |
| Tools fully off | `--tools ""` [V] | policy `deny *` (removes from context) [D] | **impossible** — read-only sandbox still runs shell [V] | approval `plan`? [D] | permission `deny` [D] | permissions config [D] | n/a (edits are the product) | no |
| Read-only mode | `--permission-mode manual`+no allows / `--tools` subset | `--approval-mode plan` [V flag] | `-s read-only` [V] | `--approval-mode plan` [D] | config | config | `--dry-run` | no |
| Full-auto mode | `--permission-mode bypassPermissions` [V] | `--approval-mode yolo` [V] | `--dangerously-bypass-approvals-and-sandbox` [HELP] | `--yolo` [D] | `--auto` [D] | default (in flux) [D] | `--yes-always` [D] | `-f`/`--yolo` [D] |
| Token usage in output | `usage` + per-model `modelUsage` [V] | `stats` (tokens only) [V] | `turn.completed.usage` (5 fields) [V] | in `assistant`/`result` [D] | undocumented | undocumented | text only | undocumented |
| Cost USD | `total_cost_usd` [V] | no | no | no | no | no | printed text | no |
| Exit codes | 0 ok; 1 with result-JSON on stdout [V] | typed fatals 41–55, 130; **API errors = HTTP&0xFF** (400→144) [V] | 0/1/2; SIGINT→1, SIGTERM→143 [V] | 0; 53 turn-cap; 55 budget; 130 [D] | undocumented | undocumented | undocumented | undocumented |
| SIGTERM behavior | 143, **flushes final `result`** [V] | SIGINT emits error `result`, exit 130 [V-source] | truncates stream, no closing event [V] | 130 documented [D] | ? | ? | ? | ? |
| Wall-clock limit flag | none (env `API_TIMEOUT_MS`) | none | none | `--max-wall-time` [D] | none | none | none | none |
| Version cmd/format | `claude --version` → `2.1.227 (Claude Code)` [V] | `gemini --version` → bare `0.44.0` [V] | `codex --version` → `codex-cli 0.146.0` [V] | `qwen --version` [D] | `--version` [D] | `--version` [D] | `--version` [D] | `--version` [D] |
| Adapter verdict | **reference target** | **feasible, auth-fragile** | **feasible, no tools-off** | **trivial** (Claude-shaped) | feasible | feasible (flag flux) | awkward — skip v1 | thin — skip v1 |

## Per-agent notes

### Claude Code 2.1.227 — reference target

- `claude -p '<prompt>' --output-format stream-json --verbose </dev/null`. `stream-json` without `--verbose` = parse error, exit 1, no API call. `json` = single result object (same schema as final `result` line).
- Stream events observed: `system/hook_started|hook_response` (user hooks — precede `init`; `--bare` skips), `system/init` (cwd, session_id, tools[], model), `system/thinking_tokens`, `assistant` (one line per content block; thinking + text share message id), `user` (tool results), `rate_limit_event` (subscription auth), `result` (always last). `--include-partial-messages` adds `stream_event` deltas. Ignore unknown types forward-compatibly.
- `result` schema [V]: `is_error`, `subtype` (`success|error_max_turns|error_during_execution`), `result` (text), `session_id`, `num_turns`, `total_cost_usd`, `duration_ms`, `usage{input_tokens,output_tokens,cache_*}`, `modelUsage{per-model costUSD}`, `permission_denials[]`, `terminal_reason` (`completed|max_turns|aborted_streaming|api_error`), `errors[]`. **`subtype:"success"` can coexist with `is_error:true`** — key off `is_error` + exit code, never `subtype`.
- Sessions: `--resume <id> -p` continues with full memory, same session_id [V]; `--fork-session` continues content under a new id [V] — the safe gather-then-review branch. `--session-id <uuid>` pins up-front; `-c` = latest in cwd; since 2.1.223 resume-by-id works cross-directory.
- Tools: full toolset loads under `-p` but permission-gated; denials recorded in `permission_denials[]`, run ends instead of prompting. `--tools ""` = verified total kill-switch (pure text call, `@file` mentions still inline client-side). `--permission-mode` valid set: `acceptEdits, auto, bypassPermissions, manual, dontAsk, plan` — **`default` rejected by binary despite docs; use `manual`**. `--allowedTools/--disallowedTools` accept permission-rule syntax (`"Bash(git diff *)"`).
- Errors inside a run land **on stdout as result JSON** with exit 1; only parse-time errors hit stderr. SIGTERM → exit 143 with flushed final `result` (`terminal_reason:"aborted_streaming"`) — partial recovery possible, but its `total_cost_usd` is 0 despite tokens spent.
- Quirks: unclosed non-TTY stdin costs a 3s wait (`</dev/null` always); `--max-turns` works but hidden from help (exit 1 + parseable result JSON on cap); `--bare` switches auth to `ANTHROPIC_API_KEY`-only (breaks subscription auth — avoid; docs say it becomes the `-p` default someday, pin behavior); `--max-budget-usd`, `--json-schema` (structured output), `--effort`, `--fallback-model` all print-mode extras. Model via `--model` or `ANTHROPIC_MODEL` env (wrapper-compatible).

### Gemini CLI 0.44.0 — feasible, auth-fragile

- `gemini -p '<prompt>' -o stream-json` (no `--verbose` analog). Events: `init{session_id,model}`, `message{role,content,delta?}`, `tool_use`, `tool_result`, `error{severity}` (non-fatal), `result{status,error?,stats}` last. `-o json` = pretty-printed single object `{session_id,response,stats,error?,warnings?}` — **error objects go to stderr, success to stdout; parse both**.
- Resume [V]: `-r <latest|index|uuid> -p '...'` — first-class headless resume, same session_id. Sessions cwd-scoped under `<GEMINI_CLI_HOME|~>/.gemini/tmp/<project-hash>/chats/`; keep cwd + `GEMINI_CLI_HOME` constant across stages. `--session-id <uuid>` on stage 1 + `-r <uuid>` on stage 2 = deterministic linkage.
- Tools: `--approval-mode <default|auto_edit|yolo|plan>` (`plan` = read-only; headless `default` denies anything that would prompt). Current constraint surface = Policy Engine: `--policy <file.toml>` rules (`allow|deny|ask_user`, wildcards, `interactive=false` scoping); global `deny` removes tool from model context. `--allowed-tools` deprecated.
- Exit codes: typed fatals (41 auth, 42 input, 52 config, 53 turn-cap, 54 tool, 55 untrusted-workspace, 130 SIGINT) **but API errors exit HTTP-status&0xFF** (400→144, 429→173) — not a stable enum; classify from parsed stream, not exit code.
- **Worst quirk [V]: no fail-fast on missing/expired auth** — headless run prints `Opening authentication page in your browser. Do you want to continue? [Y/n]:` to **stdout** and blocks forever, even with stdin at EOF. Adapter must wrap every call in a timeout and pattern-match that string. Also: `settings.json security.auth.selectedType` **overrides** `GEMINI_API_KEY` env; isolate with `GEMINI_CLI_HOME`. Fresh dirs need `--skip-trust` or `GEMINI_CLI_TRUST_WORKSPACE=true` (else exit 55). `init.model` may be an unresolved alias (`"flash"`); resolved name only in `stats.models` keys. No system-prompt flag — only `GEMINI_SYSTEM_MD` full-replacement file. Persona-zero fact: Gemini OAuth expired 2026-05-30 — needs one-time interactive re-login before headless replies work (T07 input).

### Codex CLI 0.146.0 — feasible, no tools-off

- `codex exec '<prompt>' --json </dev/null` (alias `codex e`; `-` reads prompt from stdin). `--experimental-json` still a hidden alias — prefer `--json`. Events: `thread.started{thread_id}`, `turn.started`, `item.started/item.completed` (item types: `agent_message`, `reasoning`, `command_execution{exit_code,status}`, `file_change`, `mcp_tool_call`, `web_search`, `todo_list`, `error`), `turn.completed{usage}` last; `turn.failed`/fatal `error` per docs. Final answer = last `agent_message` item, or `-o/--output-last-message FILE` (exact text, most robust channel [V]).
- Plain mode inverts the split: stdout = answer text only; session id + `tokens used` on **stderr**. In `--json`, stdout is pure NDJSON.
- Resume [V]: `codex exec resume <thread_id|--last> '<prompt>'` — full context preserved (codeword round-trip verified), same thread_id re-emitted. **Resume leg drops `-s/--cd/--profile/--add-dir`** — pass `-c sandbox_mode="read-only"` instead. `--ephemeral` on stage 1 = nothing to resume.
- Tools: `-s <read-only|workspace-write|danger-full-access>`. **Read-only sandbox still executes shell commands** (read-only FS) — no way to disable command execution entirely; council review stages must accept read-only as the floor. `exec` is hardwired `approval: never` (no `-a` flag; sandbox-blocked commands just fail back to the model). Web search: `-c tools.web_search=true` (no `--search` on exec).
- Usage [V]: `turn.completed.usage` = `{input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens, reasoning_output_tokens}` (docs show stale 3-field shape). No cost USD.
- Exit codes [V]: 0 ok; 1 = trust/config fatal **and SIGINT**; 2 = clap parse error; 143 = SIGTERM. SIGINT/SIGTERM truncate the stream with **no closing event** — treat missing `turn.completed` as aborted.
- Quirks: non-git dirs hard-fail without `--skip-git-repo-check` (exit 1, zero JSON); `item.type=="error"` items can be non-fatal startup noise (user hooks) — fail only on `turn.failed`/exit code; `--ignore-user-config` gives hermetic runs (auth preserved); `--strict-config` makes bad `-c` keys fail fast; `--output-schema FILE` = structured final response.

### Secondaries (docs-only)

- **Qwen Code — trivial.** Gemini-CLI fork that stopped syncing upstream and converged on *Claude Code* conventions: `-p`, stdin piping, `--output-format json|stream-json` (`system`/`assistant`/`result` message types), `--continue`/`--resume <uuid>`, `--approval-mode` + `--yolo`, run budgets (`--max-session-turns`, `--max-wall-time`, `--max-tool-calls`), documented exit codes (53 turn-cap, 55 budget, 130 SIGINT). Best-documented secondary; near drop-in against the Claude adapter.
- **opencode — feasible.** `opencode run` + `--format json` + first-class sessions (`-c`, `-s <id>`, `--fork`) + `--attach <server>` for warm starts; permission config in `opencode.json`. JSON event schema undocumented — reverse-engineer at adapter time.
- **Amp — feasible, flag flux.** `-x` + `--stream-json` (+`--stream-json-input`), resume via `amp threads continue -x`. Permission flags recently inverted (allow-all now default for unconfigured users); product rebuilt recently — pin installed version.
- **aider — awkward, skip v1.** No structured output, no session contract; fire-and-forget file-editor (`--message --yes-always`, parse git diffs). Wrong shape for a deliberation seat.
- **Cursor CLI — thin, skip v1.** Right flags on paper (`-p`, `--output-format stream-json`, `--resume`) but schemas/exit codes undocumented and the binary was renamed once (`cursor-agent` → `agent`).

## Wrapper profiles

Persona-zero wrappers (`co`, `cf`) are zsh functions: env var + delegation (`ANTHROPIC_MODEL="$CLAUDE_MODEL_OPUS" cly.prec.sup.cave.boil "$@"`), possibly through further arg-prepending shells. Contract implication: a seat definition needs only **argv prefix + env map** — `{command: [...], env: {...}}` — to represent any wrapper. No PTY, no shell-sourcing needed at invoke time (discovery of wrapper definitions is T06's problem).

## node-pty on Bun — validation (T03 flag)

Verdict: **drop node-pty; use Bun-native PTY.** Verified 2026-08-11, Bun 1.3.11 + node-pty 1.1.0, macOS arm64:

1. `bun install` does not preserve the exec bit on `prebuilds/*/spawn-helper` → `posix_spawnp failed` at spawn.
2. After `chmod +x`: `pty.spawn` returns a pid but **no data and no exit events ever fire** — hangs forever. Identical file under Node 24.14.0 works.
3. Replacement works [V]: `new Bun.Terminal({cols, rows, data(term, chunk){...}})` + `Bun.spawn([...], {terminal})` — child sees a real TTY (`test -t 0` passes, `$COLUMNS` honored), data streams, clean exit. Headless engine needs no PTY at all (`Bun.spawn` pipes suffice — verified); `Bun.Terminal` covers any observatory/PTY need.

## Minimum common adapter contract (proposal)

What every v1 seat adapter must provide, derived from the intersection above:

```ts
interface SeatAdapter {
  /** Detect binary, parse version, and health-check auth. MUST run under a
      timeout: Gemini blocks forever on expired auth instead of failing. */
  probe(): Promise<{binary: string; version: string; authOk: boolean; detail?: string}>;

  /** Stage 1 (gather) and stage N (review) are the same call; `session`
      distinguishes fresh vs continued. */
  invoke(req: InvokeRequest): AsyncIterable<SeatEvent>;

  /** SIGTERM, grace period, SIGKILL. Missing terminal event ⇒ aborted. */
  cancel(handle: InvokeHandle): Promise<void>;
}

interface InvokeRequest {
  prompt: string;
  cwd: string;                       // MUST stay constant across a session (gemini/codex cwd-scope)
  env?: Record<string, string>;      // wrapper profiles = argv prefix + env map
  model?: string;
  session?: {id: string; mode: "resume" | "fork"};  // fork ⇒ resume where unsupported (all but claude)
  toolPolicy: "none" | "readOnly" | "auto";
  timeoutMs: number;                 // enforced by the engine — no CLI has a reliable wall-clock flag
}

type SeatEvent =
  | {kind: "init"; sessionId: string; model?: string}
  | {kind: "text"; text: string; delta: boolean}
  | {kind: "toolUse"; name: string; detail?: unknown}
  | {kind: "result"; ok: boolean; text: string; sessionId: string;
     usage?: {inputTokens: number; outputTokens: number; cachedTokens?: number};
     costUsd?: number;               // claude only
     reason: "completed" | "aborted" | "error" | "capped";
     raw: unknown};                  // untouched final payload for transcripts
```

Contract rules (all verified against ≥1 primary, satisfiable by all three):

1. **Spawn:** plain `Bun.spawn` with piped stdio; **always close/redirect stdin** unless feeding it (claude 3s stall, codex stderr notice, gemini treats it as prompt input).
2. **Parse stdout only** for events (NDJSON line-per-event in every primary's stream mode); stderr is diagnostics/error-extraction only. Skip unparseable and unknown-type lines forward-compatibly (hooks, rate-limit events, startup noise all precede real events).
3. **Success = parsed terminal event says so.** Exit code alone is unreliable everywhere: claude exits 1 with a valid result JSON, gemini exits HTTP&0xFF on API errors, codex uses 1 for both fatals and SIGINT. Exit 0 without a terminal event = aborted.
4. **Sessions:** capture `sessionId` from the earliest event; second stage resumes by id. Engine keeps cwd (and any per-agent home like `GEMINI_CLI_HOME`) constant across stages. `fork` maps to claude `--fork-session`; elsewhere it degrades to `resume` (flag the degradation in the transcript).
5. **Tool policy floor is `readOnly`, not `none`:** codex cannot disable command execution. Recipes that demand tool-free seats (e.g. review stage) get `none` where supported (`claude --tools ""`, gemini policy deny-all) and `readOnly` + a transcript annotation elsewhere.
6. **Cancellation:** SIGTERM → wait grace (5s) → SIGKILL. Claude flushes a final result on SIGTERM (recover it); codex truncates (synthesize `reason:"aborted"`); gemini emits an error result on SIGINT.
7. **Usage:** normalize input/output/cached token counts from each agent's terminal event; `costUsd` optional (claude only). Engine owns budget enforcement — only qwen has native run budgets.
8. **Probe before council start:** version-regex per agent (`^(\d+\.\d+\.\d+) \(Claude Code\)$`, bare semver for gemini, `^codex-cli (\d+\.\d+\.\d+)`) + a timeout-wrapped auth check; a seat failing probe is benched before stage 1, not mid-deliberation.
9. **Pin versions in the registry:** all three primaries churn flags (claude `--permission-mode default`→`manual`, codex `--experimental-json`→`--json` + exec approval flags removed, gemini positional-prompt semantics + `--allowed-tools` deprecation). The registry (T10) records the probed version; adapters gate variant flags on it.

**Open facts fed forward:** T08 (protocol) can assume two-stage resume works on every primary; T07 must record Gemini's expired OAuth; T10's registry needs per-seat `{command, env, version, toolPolicyFloor}`; adapter SDK fog is now specifiable.
