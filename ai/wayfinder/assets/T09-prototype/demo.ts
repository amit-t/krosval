#!/usr/bin/env bun
/**
 * T09 prototype — end-to-end council session CLI UX, all fake data.
 *
 * No engine, no agents, no network. Every byte is scripted; delays fake the
 * minutes-scale latency honestly (NFR-2) at watchable speed.
 *
 * Run:
 *   bun demo.ts                  # all scenes, paced
 *   bun demo.ts --scene ask      # one scene: first-run | ask | failure | observatory | json
 *   bun demo.ts --fast           # no delays (for capture)
 *   bun demo.ts --plain          # no ANSI color/cursor tricks (for text capture)
 */

// ---------------------------------------------------------------- plumbing

const args = new Set(Bun.argv.slice(2));
const FAST = args.has("--fast");
const PLAIN = args.has("--plain");
const sceneArg = Bun.argv[Bun.argv.indexOf("--scene") + 1];
const SCENE = Bun.argv.includes("--scene") ? sceneArg : "all";

const sleep = (ms: number) => (FAST ? Promise.resolve() : Bun.sleep(ms));
const W = process.stdout.write.bind(process.stdout);

// ANSI helpers; identity functions under --plain
const esc = (open: string, close: string) => (s: string) =>
  PLAIN ? s : `\x1b[${open}m${s}\x1b[${close}m`;
const bold = esc("1", "22");
const dim = esc("2", "22");
const green = esc("32", "39");
const yellow = esc("33", "39");
const red = esc("31", "39");
const cyan = esc("36", "39");
const magenta = esc("35", "39");
const cursorUp = (n: number) => (PLAIN ? "" : `\x1b[${n}A`);
const clearLine = PLAIN ? "" : "\x1b[2K";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function line(s = "") {
  W(s + "\n");
}

async function typeOut(s: string, cps = 400) {
  // stream text like an agent emitting tokens
  if (FAST || PLAIN) {
    W(s);
    return;
  }
  const chunk = 6;
  for (let i = 0; i < s.length; i += chunk) {
    W(s.slice(i, i + chunk));
    await Bun.sleep((1000 / cps) * chunk);
  }
}

// ---------------------------------------------------------------- fake data

// Seats mirror persona zero's machine (T07): three agents + one wrapper profile.
type SeatState = "queued" | "working" | "done" | "timeout" | "failed";
interface Seat {
  name: string;
  state: SeatState;
  tokens: number;
  finalTok: number; // scripted total tokens at completion
  doneAt: number; // seconds into the stage when it finishes (scripted)
  label?: string; // anonymous label, assigned stage 2
}

const QUESTION = "Should krosval store transcripts as JSONL files or in SQLite?";

// One fake stream of thought per seat — feeds gathering previews (grill 2:B),
// observatory panes, and the --json deltas.
const GATHER_STREAMS: Record<string, string[]> = {
  claude: [
    "Reading question + context…",
    "JSONL: append-only, crash-safe,",
    "greppable. SQLite adds query power",
    "but a binary format for an audit",
    "record is a liability…",
  ],
  co: [
    "Considering the audit-trail persona.",
    "A cautious tech lead wants records",
    "that survive partial writes. JSONL",
    "prefix stays valid after a crash.",
  ],
  gemini: [
    "Comparing: SQLite gives indexed",
    "history search and concurrent reads.",
    "JSONL needs a scan per query. For",
    "v1 volume (<10k records) scan is fine.",
  ],
  codex: [
    "grep-ability matters: users will",
    "pipe transcripts into jq. One file",
    "per deliberation keeps blast radius",
    "small. Recommend JSONL + index later.",
  ],
};

const REVIEW_STREAMS: Record<string, string[]> = {
  claude: ["Scoring Response A: accuracy 9…", "Response C thin on crash-safety…", "Ranking: A > B > D > C."],
  co: ["Response B strongest on audit needs…", "Critique for D: index cost unpriced…"],
  gemini: ["Response A cites jq pipelines — apt…", "Scoring completeness across A–D…"],
  codex: ["Comparing B and D on query power…", "Ranking: A > D > B > C."],
};

const mkSeats = (): Seat[] => [
  { name: "claude", state: "queued", tokens: 0, finalTok: 1900, doneAt: 41 },
  { name: "co", state: "queued", tokens: 0, finalTok: 1200, doneAt: 55 },
  { name: "gemini", state: "queued", tokens: 0, finalTok: 2100, doneAt: 34 },
  { name: "codex", state: "queued", tokens: 0, finalTok: 3400, doneAt: 62 },
];

// ---------------------------------------------------------------- widgets

function stateGlyph(s: Seat, tick: number): string {
  switch (s.state) {
    case "queued":
      return dim("·");
    case "working":
      return PLAIN ? "~" : cyan(SPIN[tick % SPIN.length]);
    case "done":
      return green("✓");
    case "timeout":
      return red("✗");
    case "failed":
      return red("✗");
  }
}

function seatRow(s: Seat, tick: number, elapsed: number, extra = "", preview = ""): string {
  const st =
    s.state === "working"
      ? "working"
      : s.state === "queued"
        ? dim("queued")
        : s.state === "done"
          ? "done   "
          : s.state === "timeout"
            ? red("timeout")
            : red("failed");
  const tok = s.tokens > 0 ? `${(s.tokens / 1000).toFixed(1)}k tok` : "";
  const t = s.state === "working" ? `${elapsed}s` : s.state === "done" ? `${s.doneAt}s` : "";
  // rolling one-line preview of the seat's latest output (grill 2:B) — working seats only
  const pv = s.state === "working" && preview ? dim(`  ${preview.slice(0, 38)}`) : "";
  return `  ${stateGlyph(s, tick)} ${s.name.padEnd(8)} ${st.padEnd(PLAIN ? 7 : 16)} ${tok.padStart(8)}  ${t.padStart(4)}${extra}${pv}`;
}

/** Live seat table: redraws itself in place until every seat resolves. */
async function runSeatTable(
  seats: Seat[],
  opts: {
    speedup?: number;
    timeoutAt?: { seat: string; at: number };
    previews?: Record<string, string[]>;
  } = {},
) {
  const speedup = opts.speedup ?? 8; // 1 real tick = `speedup` fake seconds
  let tick = 0;
  let elapsed = 0;
  seats.forEach((s) => (s.state = "working"));
  const maxDone = Math.max(...seats.map((s) => s.doneAt));
  const rows = seats.length;
  const pv = (s: Seat) => {
    const pool = opts.previews?.[s.name];
    return pool ? pool[Math.floor(tick / 6) % pool.length] : "";
  };

  // first paint
  seats.forEach((s) => line(seatRow(s, tick, elapsed, "", pv(s))));

  while (seats.some((s) => s.state === "working")) {
    await sleep(120);
    tick++;
    elapsed = Math.min(elapsed + speedup / 4, maxDone + 120);
    for (const s of seats) {
      if (s.state !== "working") continue;
      s.tokens = Math.min(s.finalTok, s.tokens + 80 + Math.floor((s.name.length * tick * 37) % 160));
      if (opts.timeoutAt && s.name === opts.timeoutAt.seat && elapsed >= opts.timeoutAt.at) {
        s.state = "timeout";
        s.tokens = Math.floor(s.finalTok * 0.4);
      } else if (elapsed >= s.doneAt) {
        s.state = "done";
        s.tokens = s.finalTok;
      }
    }
    if (!PLAIN) {
      W(cursorUp(rows));
      for (const s of seats) {
        const to = opts.timeoutAt && s.name === opts.timeoutAt.seat;
        const extra =
          s.state === "timeout" && to ? dim(`  budget ${opts.timeoutAt!.at}s exhausted`) : "";
        W(clearLine + seatRow(s, tick, Math.floor(elapsed), extra, pv(s)) + "\n");
      }
    }
    if (FAST) {
      // resolve instantly
      for (const s of seats) {
        if (s.state !== "working") continue;
        if (opts.timeoutAt && s.name === opts.timeoutAt.seat) {
          s.state = "timeout";
          s.tokens = Math.floor(s.finalTok * 0.4);
        } else {
          s.state = "done";
          s.tokens = s.finalTok;
        }
      }
    }
  }
  if (PLAIN) {
    // plain mode: print the final table once more instead of in-place redraw
    line(dim("  …"));
    for (const s of seats) {
      const to = opts.timeoutAt && s.name === opts.timeoutAt.seat;
      const extra =
        s.state === "timeout" && to ? `  budget ${opts.timeoutAt!.at}s exhausted` : "";
      line(seatRow(s, 0, 0, extra));
    }
  }
}

function stageHeader(n: number, total: number, title: string, note = "") {
  line();
  line(bold(`▶ ${n}/${total} ${title}`) + (note ? dim(`  ${note}`) : ""));
}

function box(lines: string[], width = 46): string[] {
  const top = `┌─ consensus ${"─".repeat(width - 14)}┐`;
  const bot = `└${"─".repeat(width - 2)}┘`;
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const body = lines.map((l) => {
    const pad = width - 3 - stripAnsi(l).length;
    return `│ ${l}${" ".repeat(Math.max(0, pad))}│`;
  });
  return [top, ...body, bot];
}

// ---------------------------------------------------------------- scene 1: first run

async function sceneFirstRun() {
  line(dim("$ ") + bold("krosval"));
  await sleep(400);
  line();
  line("No registry found — first run. Scanning this machine " + dim("(read-only, nothing executed)") + "…");
  line();
  const scans = [
    ["PATH + install dirs", "3 agents found"],
    ["zsh config chain", "2 wrapper profiles traced (~/Profiles, 6 files)"],
    ["agent configs", "claude: 2 settings profiles, 1 pinned model env"],
  ];
  for (const [what, result] of scans) {
    if (!PLAIN) {
      W(`  ${cyan("⠿")} ${what.padEnd(22)}`);
      await sleep(500);
      W(`\r${clearLine}`);
    }
    W(`  ${green("✓")} ${what.padEnd(22)} ${result}\n`);
  }
  await sleep(300);
  line();
  line(bold("Agents"));
  line(dim("  NAME     BINARY                     VERSION   VIA"));
  line("  claude   ~/.local/bin/claude        2.1.227   PATH");
  line("  gemini   /opt/homebrew/bin/gemini   0.44.0    PATH");
  line("  codex    ~/.cargo/bin/codex         0.146.0   PATH");
  line();
  line(bold("Wrapper profiles") + dim("  (parsed from zsh source — never executed)"));
  line(dim("  NAME  WRAPS    INJECTS                                SOURCE"));
  line("  co    claude   model opus, skip-permissions           ~/Profiles/functions/co.zsh:12");
  line("  cf    claude   persona \"fast\", model sonnet           ~/Profiles/functions/cf.zsh:8");
  line();
  line(
    yellow("  ⚠ co injects --dangerously-skip-permissions.") +
      " Council seats run read-only by default; this flag is stripped in council runs unless you opt in per-council.",
  );
  line();
  W("Keep all 5? " + bold("[Y]") + "es / " + bold("[e]") + "dit / " + bold("[s]") + "kip some: ");
  await sleep(900);
  line(green("y"));
  line();
  line("Registry written to " + cyan("~/.config/krosval/registry.toml") + dim("  (plain file — edit any time)"));
  await sleep(400);
  line();
  line(bold("Default council ") + magenta("quorum") + bold(" proposed"));
  line("  seats: claude · gemini · codex        chairman: claude");
  line(dim("  (wrappers co/cf registered but not seated — add with `krosval council edit quorum`)"));
  W("Accept? " + bold("[Y/n]") + ": ");
  await sleep(700);
  line(green("y"));
  line();
  // observatory consent, asked once here (grill 12:B) — auto-on in Tier-1 terminals after a yes
  line(bold("Observatory") + " — tmux detected " + dim("(also supported: cmux, herdr, iTerm2, Ghostty)"));
  line("  krosval can mirror each seat's live stream into panes while a council runs.");
  W("Mirror automatically in supported terminals? " + bold("[Y/n]") + ": ");
  await sleep(700);
  line(green("y"));
  line(dim("  auto-on saved. Per-run opt-out: krosval ask --no-observe · flip later: krosval config observatory off"));
  line();
  line("Ready. Try:  " + bold(`krosval ask "your question"`));
}

// ---------------------------------------------------------------- scene 2/3: ask

async function sceneAsk(withFailure: boolean) {
  const seats = mkSeats();
  line(dim("$ ") + bold(`krosval ask "${QUESTION}"`));
  await sleep(400);
  line();
  line(
    dim("council ") + magenta("quorum") +
      dim(" · mode ") + "consensus-seeker" +
      dim(" · 4 seats · chairman ") + "claude" +
      dim(" · deliberation ") + "d-0811-a3f2",
  );

  // -- stage 1: gathering
  stageHeader(1, 4, "gathering", "4 seats, parallel, tools read-only");
  await runSeatTable(seats, {
    previews: GATHER_STREAMS,
    ...(withFailure ? { timeoutAt: { seat: "gemini", at: 120 } } : {}),
  });

  const alive = seats.filter((s) => s.state === "done");
  if (withFailure) {
    line();
    line(
      yellow("  ⚠ gemini hit the 120s stage budget (recipe override) — seat dropped for this deliberation."),
    );
    line(dim("    quorum: this council sets min_seats 2 — 3/4 satisfies it, continuing. (default: all seats required — abort)"));
  }

  // -- stage 2: review
  const labels = ["A", "B", "C", "D"];
  alive.forEach((s, i) => (s.label = labels[i]));
  const nAns = alive.length;
  stageHeader(
    2, 4, "peer review",
    `answers anonymized as Response A–${labels[nAns - 1]} · reviewers see no names · tools off`,
  );
  const reviewers = alive.map((s) => ({ ...s, state: "queued" as SeatState, tokens: 0, doneAt: 18 + (s.doneAt % 14) }));
  await runSeatTable(reviewers, { speedup: 6, previews: REVIEW_STREAMS });
  line(dim(`  ${nAns}/${nAns} ballots in — rankings + per-answer critiques, self-review included`));

  // -- stage 3: synthesis
  stageHeader(3, 4, "synthesis", "chairman claude · inputs: all answers + all ballots, still anonymized");
  line();
  await typeOut(
    "  Store transcripts as append-only JSONL, one file per deliberation. Every\n" +
      "  reviewer independently valued crash-safety of an appendable log over\n" +
      "  query power; the strongest dissent (Response " + (withFailure ? "C" : "D") + ") wants SQLite for\n" +
      "  history search — satisfiable later as a derived index without changing\n" +
      "  the record format. Recommendation: JSONL now, optional index post-v1.\n",
  );
  await sleep(300);

  // -- stage 4: confidence
  stageHeader(4, 4, "confidence", "computed from ballots — no extra model pass");
  line();
  const card = withFailure
    ? [
        `confidence   ${bold("HIGH")}  0.84   ${dim("(3 seats — quorum, not full council)")}`,
        ``,
        `agreed       JSONL append-only record        ${green("3/3")}`,
        `             one file per deliberation       ${green("3/3")}`,
        `disputed     search needs SQLite index       ${yellow("C vs A,B")}`,
        ``,
        `peer scores  A 8.7 · B 8.1 · C 6.9           ${dim("(mean of others' ballots)")}`,
        `seats        A=codex  B=claude  C=co         ${dim("revealed post-review")}`,
        `dropped      gemini — timeout in gathering   ${red("✗")}`,
      ]
    : [
        `confidence   ${bold("HIGH")}  0.82`,
        ``,
        `agreed       JSONL append-only record        ${green("4/4")}`,
        `             one file per deliberation       ${green("4/4")}`,
        `disputed     search needs SQLite index       ${yellow("D vs rest")}`,
        ``,
        `peer scores  A 8.7 · B 7.9 · C 6.4 · D 8.1   ${dim("(mean of others' ballots)")}`,
        `seats        A=codex B=claude C=co D=gemini  ${dim("revealed post-review")}`,
      ];
  for (const l of box(card, 78)) line(l);
  line();
  line(
    dim("transcript ") + cyan("~/.local/share/krosval/transcripts/d-0811-a3f2.jsonl") +
      dim("   replay: ") + "krosval show d-0811-a3f2",
  );
  line(dim("elapsed 3m12s · est. cost $0.14 (claude seats only — others don't report cost)"));
}

// ---------------------------------------------------------------- scene 4: observatory

async function sceneObservatory() {
  line(dim("$ ") + bold(`krosval ask "${QUESTION}"`));
  line(
    dim("  observatory auto-on (tmux, consented at first run) — 4 panes + status bar · opt out: ") +
      "--no-observe" +
      dim(" (presentation only; engine is headless)"),
  );
  await sleep(600);
  line();

  const paneW = 39;
  const paneH = 6;
  const seats = ["claude", "co", "gemini", "codex"];
  const streams = GATHER_STREAMS;
  const states = ["working", "working", "working", "done"];

  const border = (l: string, m: string, r: string) =>
    l + "─".repeat(paneW) + m + "─".repeat(paneW) + r;

  // We fake ~4 progressive frames of a 2x2 tmux layout.
  const frames = FAST ? [4] : [1, 2, 3, 5];
  for (const upto of frames) {
    const grid: string[] = [];
    grid.push(border("┌", "┬", "┐"));
    for (let row = 0; row < 2; row++) {
      const [s1, s2] = [seats[row * 2], seats[row * 2 + 1]];
      const t1 = ` ${s1} [${states[row * 2]}] `, t2 = ` ${s2} [${states[row * 2 + 1]}] `;
      grid.push(
        "│" + cyan(t1) + dim("·".repeat(paneW - t1.length)) +
        "│" + cyan(t2) + dim("·".repeat(paneW - t2.length)) + "│",
      );
      for (let i = 0; i < paneH - 1; i++) {
        const l1 = i < upto ? (streams[s1][i] ?? "") : "";
        const l2 = i < upto ? (streams[s2][i] ?? "") : "";
        grid.push(
          "│ " + l1.padEnd(paneW - 1) + "│ " + l2.padEnd(paneW - 1) + "│",
        );
      }
      grid.push(row === 0 ? border("├", "┼", "┤") : border("└", "┴", "┘"));
    }
    grid.push(
      magenta("[krosval]") +
        ` d-0811-a3f2 · stage 1/4 gathering · 3 ${cyan("working")} 1 ${green("done")} · 0:52`,
    );
    if (!PLAIN && upto !== frames[0]) W(cursorUp(grid.length));
    for (const g of grid) line((PLAIN ? "" : clearLine) + g);
    await sleep(1100);
    if (PLAIN) break; // one frame is enough in plain capture
  }
  line();
  line(dim("panes close when the deliberation ends; add --keep-panes to leave them for scrollback."));
  line(dim("same run, no terminal integration → falls back to the inline seat table (scene: ask)."));
}

// ---------------------------------------------------------------- scene 5: --json

async function sceneJson() {
  line(dim("$ ") + bold(`krosval ask --json "${QUESTION}" | jq -c .event`));
  line(dim("  (NDJSON on stdout, one event per line — sketch of the machine interface)"));
  line();
  const events = [
    { event: "deliberation.start", id: "d-0811-a3f2", council: "quorum", mode: "consensus-seeker", seats: 4 },
    { event: "stage.start", stage: "gather", n: 1, of: 4 },
    { event: "seat.status", seat: "gemini", status: "working" },
    { event: "seat.delta", seat: "gemini", text: "Comparing: SQLite gives indexed…" },
    { event: "seat.result", seat: "gemini", status: "done", tokens: 2140, duration_s: 34 },
    { event: "stage.end", stage: "gather", ok: 4, failed: 0 },
    { event: "stage.start", stage: "review", n: 2, of: 4 },
    { event: "ballot.received", reviewer_label: "B", ranking: ["A", "B", "D", "C"] },
    { event: "stage.start", stage: "synthesize", n: 3, of: 4, chairman: "claude" },
    { event: "synthesis.delta", text: "Store transcripts as append-only…" },
    { event: "stage.start", stage: "confidence", n: 4, of: 4 },
    { event: "consensus", confidence: 0.82, band: "high", agreed: 2, disputed: 1 },
    { event: "deliberation.end", id: "d-0811-a3f2", transcript: "~/.local/share/krosval/transcripts/d-0811-a3f2.jsonl" },
  ];
  for (const e of events) {
    line("  " + dim(JSON.stringify(e)));
    await sleep(150);
  }
  line();
  line(dim("same event stream feeds observatory panes and the transcript — one vocabulary everywhere."));
}

// ---------------------------------------------------------------- main

const scenes: Record<string, [string, () => Promise<void>]> = {
  "first-run": ["Scene 1 — first run: discovery interview", sceneFirstRun],
  ask: ["Scene 2 — ask: full deliberation, happy path", () => sceneAsk(false)],
  failure: ["Scene 3 — ask: one seat times out mid-council", () => sceneAsk(true)],
  observatory: ["Scene 4 — observatory: faked tmux split", sceneObservatory],
  json: ["Scene 5 — --json event stream sketch", sceneJson],
};

const picked = SCENE === "all" ? Object.keys(scenes) : [SCENE];
if (picked.some((p) => !scenes[p])) {
  console.error(`unknown scene "${SCENE}" — one of: ${Object.keys(scenes).join(", ")}, all`);
  process.exit(2);
}

for (const [i, key] of picked.entries()) {
  const [title, fn] = scenes[key];
  if (picked.length > 1) {
    line();
    line(magenta("═".repeat(70)));
    line(magenta(`  ${title}`));
    line(magenta("═".repeat(70)));
    line();
    await sleep(600);
  }
  await fn();
  if (i < picked.length - 1) await sleep(1200);
}
line();
