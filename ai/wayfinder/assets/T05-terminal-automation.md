# T05 — Automation surfaces of the five target terminals

Resolves [T05 / issue #6](https://github.com/amit-t/krosval/issues/6). Researched 2026-08-11 on persona-zero (macOS arm64, Darwin 25.5.0).

**Provenance.** Everything marked `[V]` was verified live against installed software: tmux **3.6a**, cmux **0.64.22**, herdr **0.7.4**, Ghostty **1.3.1** (standalone app; cmux embeds libghostty 1.3.2-HEAD), iTerm2 **3.6.11**. `[S]` = verified statically (sdef/config/help read from the installed bundle, not exercised). `[D]` = docs-only. iTerm2 was not running and both its automation paths require an in-app human consent dialog on first connection, so it is `[S]`/`[D]` only.

## Headline result

**Read-back is optional.** Observatory mode never needs to scrape pane content: every terminal can spawn a pane running a krosval-owned viewer process (`krosval observe --seat <id>` pulling from engine IPC), so the only universal adapter contract is *create pane/tab with command + title, then clean up*. All five terminals satisfy that. Read-back and status extras are tier bonuses, not requirements.

## Capability matrix

| Capability | tmux 3.6a | cmux 0.64.22 | herdr 0.7.4 | iTerm2 3.6.11 | Ghostty 1.3.1 (macOS) |
|---|---|---|---|---|---|
| Control channel | CLI → server socket [V] | CLI → Unix socket (`~/.local/state/cmux/cmux-<uid>.sock`), typed capability API [V] | CLI → Unix socket (`~/.config/herdr/herdr.sock`), JSON responses, protocol 16 [V] | Python API over websocket (`private/socket`) + legacy AppleScript [S] | AppleScript only (`Ghostty.sdef`, `NSAppleScriptEnabled=true`) [S] |
| Headless (no GUI/consent) | yes [V] | yes — socket auth via `CMUX_SOCKET_PASSWORD`/settings [V] | yes — server runs headless [V] | no — app must run; per-connection consent dialog (or "allow all") [D] | no — TCC Automation grant per controlling app; unattended first call blocks forever [V] |
| Create pane/tab/window with command | `new-session`/`new-window`/`split-window` [V] | `workspace create --command`, `new-pane`, `new-split`, `new-surface` [V] | `tab create`, `pane split`, `agent start -- <argv>` [V] | `async_create` window/tab/split with command [D]; AppleScript `create window` [S] | `new window`/`new tab`/`split` with `surface configuration` record: `command`, `initial working directory`, `environment variables`, `initial input`, `wait after command` [S] |
| Write live stream into pane | `send-keys`; or viewer-process [V] | `send`/`send-key`; viewer-process [V] | `pane send-text`/`pane run` (run = text+Enter); viewer-process [V] | `async_send_text`; viewer-process [D] | `input text` ("as if pasted"), `send key` w/ modifiers; viewer-process [S] |
| Read pane content back | `capture-pane -p`, `pipe-pane -o` (continuous mirror) [V] | `read-screen`/`capture-pane` (`--scrollback --lines`), `pipe-pane`, `events` stream [V] | `pane read` (`visible\|recent\|recent-unwrapped`, `text\|ansi`), `wait output --match --regex --timeout` [V] | screen streamer + `async_get_contents` [D]; AppleScript session `contents` [S] | **weak** — no content property in sdef; only indirect `perform action "write_screen_file:…"` [S] |
| Set title | `rename-window`, `select-pane -T` [V] | `rename-tab`, `rename-workspace` [V] | `tab rename`, `pane rename` [V] | session title/badge API [D] | `perform action "set_tab_title:…"` / `set_surface_title` [S] |
| Detect host from inside | `$TMUX` [V] | `$CMUX_SURFACE_ID` etc. [V] | `$HERDR_TAB_ID` [V] | `TERM_PROGRAM=iTerm.app`, `ITERM_SESSION_ID` [D] | `TERM_PROGRAM=ghostty`, `GHOSTTY_SURFACE_ID` [V] |
| Clean up on completion | `kill-session`/`kill-pane` [V] | `close-workspace`, `close-surface` [V] | `tab close`, `pane close` [V] | close via API [D] | `close`/`close tab`/`close window` [S] |
| Wait/synchronize on output or state | `wait-for` [V] | `wait-for`, `events --reconnect` (cursored event stream), `set-hook` [V] | `wait output --match`, `wait agent-status`, `agent wait --status idle\|working\|blocked` [V] | monitors (screen/prompt) [D] | none |
| Status/notification extras | none | `set-status`, `set-progress`, `notify`, notification feed, todo, diff/markdown viewers [V] | `pane report-metadata` (title, state labels, tokens), `notification` cmds, `api snapshot` (full runtime state JSON) [V] | badges [D] | none |
| Platform | cross-platform | macOS | macOS/Linux | macOS | macOS (Linux GTK build has `+new-window` CLI [D]; macOS binary: "+new-window is not supported on this platform" [V]) |
| **Tier verdict** | **1 — reference** | **1** | **1** | **2** | **2 (floor)** |

## Integration tiers

- **Tier 1 — full headless observatory** (create/title/stream/cleanup + sync, zero human consent): **tmux** (reference implementation, confirmed), **cmux**, **herdr**. All three verified end-to-end live: create surface → run command → match output → read → clean up.
- **Tier 2 — scriptable after one-time human consent:** **iTerm2** (Python API is Tier-1-rich once its consent dialog is accepted and the app is running; also `tmux -CC` control-mode integration as a zero-work fallback), **Ghostty** (AppleScript covers create-with-command/title/input/cleanup — everything observatory needs under the viewer-process pattern — but requires macOS Automation (TCC) grant, app running, and has no read-back).
- **Tier 3 — fallback for unknown terminals:** none needed; unrecognized hosts get either in-process rendering (no observatory) or a spawned tmux session.

## Per-terminal notes

### tmux — Tier 1, reference implementation

Verified loop: `new-session -d -x -y` → `split-window -d` → `pipe-pane -o 'cat >> file'` (continuous one-way mirror) → `capture-pane -p` → `list-panes -F '#{pane_id} #{pane_title}'` → `kill-session`. All headless, no GUI required. `wait-for` for sync; control mode `-CC` matters only as iTerm2's native bridge. Cross-platform, scriptable from any child process. Presumptive default when krosval runs on a server or unknown terminal.

### cmux — Tier 1, integrate

- Socket CLI with a **typed capability list** (`cmux capabilities`: `terminal.bytes.v1`, `terminal.replay.v1`, `events.v1`, `workspace.actions.v1`, …) — version-check the surface instead of sniffing help text.
- Verified live: `workspace create --name --command --focus false` → `capture-pane --workspace <ref> --lines N` → `close-workspace`; `read-screen` on own surface; `rename-tab`.
- Ships a whole **tmux-compat command set** (`capture-pane`, `pipe-pane`, `send-keys`-style `send-key`, `wait-for`, `set-hook`, `respawn-pane`) — the tmux adapter port is nearly free.
- Agent-native extras worth using: `set-status`/`set-progress` (workspace status pills), `notify` + notification feed, `events --reconnect --cursor-file` (durable event stream), `new-surface --type agent-session --provider claude|codex|opencode`.
- Quirks [V]: flag names inconsistent per command (`--focus false` on `workspace create` vs `--no-focus` elsewhere); legacy-alias notices on stdout unless `CMUX_QUIET=1` — always parse JSON lines, not raw stdout; **`$CMUX_TAB_ID` holds the workspace UUID** — pass `--workspace`/`--surface` explicitly from `$CMUX_WORKSPACE_ID`/`$CMUX_SURFACE_ID`.
- Embeds libghostty and **sets `TERM_PROGRAM=ghostty`** (verified from inside cmux: `TERM_PROGRAM_VERSION=1.3.2-HEAD`), so detection must check `CMUX_*` before `TERM_PROGRAM`.

### herdr — Tier 1, integrate

- Client/server over Unix socket; server verified running headless; every response is one JSON object with an id (`{"id":"cli:tab:create","result":{…}}`).
- Verified loop: `tab create --workspace w2 --label X --no-focus` → `pane run <id> '<cmd>'` (text + Enter; `pane send-text` is literal) → `wait output <id> --match <text> --timeout 8000` (returns matched line **and** a pane read in one response) → `pane read --source recent-unwrapped` → `tab close`.
- **Most agent-aware surface of the five**: `agent list/read/send/wait --status idle|working|blocked`, `agent start --cwd --split -- <argv>` (spawn an agent in a managed pane), `pane report-agent`/`report-metadata` (a reporting protocol for state labels, display names, token counters) — krosval seats could report status *into* herdr's own UI.
- `api snapshot` dumps full runtime state (workspaces/tabs/panes/layout/agents) as JSON; `api schema` documents the socket API. Cross-platform, `--remote <ssh>` attach.

### iTerm2 — Tier 2, one-time consent

- Python API enabled on persona-zero (`EnableAPIServer=1`, API socket file present [V-config]); app was not running, and both automation paths gate on human consent, so nothing exercised live.
- Python API (pip `iterm2`, websocket): create window/tab/split with command/profile, send text, **screen streamer** for read-back, prompt monitors, titles/badges — Tier-1-equivalent capability once consented. First connection from a new program pops an in-app approval dialog unless "Allow all apps to connect" is on — onboarding must warn.
- Legacy AppleScript (`iTerm2.sdef` present [S]): create window, `write text`, session `contents` readable — adequate fallback, but the Python API is the real adapter target.
- Zero-work alternative: run the tmux adapter and let the user attach `tmux -CC` for native iTerm2 windows.

### Ghostty — Tier 2 floor, macOS = AppleScript only

- 1.2+ ships a real scripting dictionary; installed 1.3.1 verified [S]: `new window`/`new tab`/`split` each accept a `surface configuration` record (`command`, `initial working directory`, `environment variables` as KEY=VALUE list, `initial input`, `wait after command`) — exactly the create-pane-with-command contract; plus `input text`, `send key`, `focus`, `close`, and `perform action "<any +list-actions string>"` (includes `set_tab_title:…`, `write_screen_file`, `new_split:…`).
- No content read-back in the sdef — harmless under the viewer-process pattern (observatory writes into panes; it never scrapes them).
- **TCC is the real cost [V]:** an unattended `osascript` call to Ghostty blocked indefinitely waiting for the macOS Automation consent prompt (killed after 20 s+). First run must happen with a human present; adapters must wrap AppleScript calls in timeouts and surface "grant Automation permission" guidance.
- macOS CLI actions are config/diagnostic only; `ghostty +new-window` answers "not supported on this platform" [V] — window creation on macOS is AppleScript or `open -na Ghostty.app --args …`. The Linux GTK build does support `+new-window` [D] — Linux Ghostty users likely get the tmux adapter in v1 anyway.

## herdr/cmux positioning: integrate both (and borrow)

Both graduate from "curiosity" to **first-class Tier 1 observatory backends** — their socket CLIs are richer than tmux's for this use case (durable event streams, agent-status waits, status pills/notifications). Also *inspire*: herdr's agent-status model (`idle|working|blocked`) and cmux's status/progress/notification surface are exactly the presentation vocabulary krosval's own observatory should speak, and the `report-agent`/`set-status` channels let krosval feed seat state back into the host terminal's native UI instead of only drawing panes.

## Host-terminal detection recipe (verified inside cmux)

Check in this order; first match wins:

1. `$CMUX_SURFACE_ID` → cmux (must precede TERM_PROGRAM: cmux masquerades as ghostty)
2. `$HERDR_TAB_ID` → herdr
3. `$TMUX` → tmux
4. `$TERM_PROGRAM == "iTerm.app"` (+ `ITERM_SESSION_ID`) → iTerm2
5. `$TERM_PROGRAM == "ghostty"` (+ `GHOSTTY_SURFACE_ID`) → Ghostty standalone
6. else → no observatory host; offer spawned tmux or in-process rendering

## Minimum ObservatoryAdapter contract (input to T12)

```
detect(env)                       -> bool          // recipe above
openPane({title, command, cwd, env}) -> PaneHandle // all five [V/S]
retitle(handle, title)            -> void          // all five
closePane(handle)                 -> void          // all five
// optional capabilities, feature-detected:
setStatus?(state)                                  // cmux set-status, herdr report-metadata
notify?(msg)                                       // cmux notify, herdr notification
waitFor?(pattern|state)                            // tmux wait-for, cmux wait-for, herdr wait
```

Engine stays the source of truth; panes run `krosval observe --seat <id>` viewers fed by engine IPC, so adapter loss/degradation never affects deliberation correctness.
