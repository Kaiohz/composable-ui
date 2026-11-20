import {
  bullets,
  docLink,
  example,
  lbl,
  links,
  para,
  steps,
  sub,
  txt,
  type DocChapter,
} from "../types";

/**
 * DOC-07 — Traces. The usage dashboard, the runs list and read-only thread
 * views, plus filters, KPI meanings, breakdowns and an investigation flow.
 */
const traces: DocChapter = {
  doc: "DOC-07",
  slug: "traces",
  navLabel: "Traces",
  title: "Traces",
  blocks: [
    para(
      txt(
        "The Traces page answers three questions: how much AI usage and money did I spend (Dashboard), which runs cost or failed the most (Runs), and what happened in a specific conversation (Threads and detail views). Everything here is read-only — you look, filter and open; nothing is executed from this page.",
      ),
    ),

    sub("When to use each view"),
    bullets(
      [
        lbl("Dashboard"),
        txt(
          " (the default tab) — totals for a period: token usage, estimated cost, completed runs, errors, error rate and duration percentiles, with agent and model breakdowns.",
        ),
      ],
      [
        lbl("Runs"),
        txt(" — the same filters, but the focus is the ranked runs table with a "),
        lbl("Limit"),
        txt(" control (Top 10/25/50/100) for finding the biggest individual runs."),
      ],
      [
        lbl("Threads"),
        txt(
          " — the plain execution history across all agents, with source pills and a read-only detail view per thread.",
        ),
      ],
    ),

    sub("Reading the KPI cards"),
    bullets(
      [
        lbl("Tokens"),
        txt(" — total tokens for the period, split into "),
        lbl("IN"),
        txt(" (what you sent) and "),
        lbl("OUT"),
        txt(" (what the models generated), with the top agents listed beneath."),
      ],
      [
        lbl("Cost (USD)"),
        txt(
          " — the estimated dollar cost of all runs in the period. If a model has no price available, the card warns ",
        ),
        lbl("unpriced model"),
        txt(" and those runs are not part of the estimate; "),
        lbl("All models priced"),
        txt(" means nothing is hidden."),
      ],
      [
        lbl("Runs"),
        txt(
          ' — completed runs, shown as "ok · errors" with the error rate beneath. Completed and error runs are separate counts.',
        ),
      ],
      [
        lbl("Latency"),
        txt(" — the median duration (the typical run) and the "),
        lbl("P95"),
        txt(" duration (the slow tail) of runs in the period."),
      ],
    ),
    para(
      txt(
        "Below the cards, two breakdown charts rank agents (top consumers) and models (share of tokens). A model shown as ",
      ),
      lbl("UNPRICED"),
      txt(" appears in the model breakdown because it was used, but contributes no cost estimate."),
    ),

    sub("Filters"),
    bullets(
      [
        lbl("Period"),
        txt(" — "),
        lbl("7 days"),
        txt(", "),
        lbl("30 days"),
        txt(", or "),
        lbl("Custom range"),
        txt(" with "),
        lbl("From"),
        txt(" and "),
        lbl("To"),
        txt(
          " dates. A custom range only applies once both dates are picked; until then the 7-day window stays active and the filter bar says so explicitly.",
        ),
      ],
      [
        lbl("Agent"),
        txt(" — narrows everything to one exact agent name, or "),
        lbl("All agents"),
        txt("."),
      ],
      [
        lbl("Model (runs list)"),
        txt(
          ' — it narrows the runs table client-side only. It does not recompute the Dashboard KPIs or charts, which stay computed for all models; the on-screen label is deliberately "runs list" to avoid misreading the totals.',
        ),
      ],
    ),

    sub("Open a run's details"),
    steps(
      [
        txt("On the "),
        lbl("Dashboard"),
        txt(" or "),
        lbl("Runs"),
        txt(
          " tab, select the run row you need — the rows are ranked by cost, most expensive first.",
        ),
      ],
      [
        txt("The read-only detail view opens with the full activity timeline of that thread; use "),
        lbl("Back to all traces"),
        txt(" to return."),
      ],
      [
        txt("On the "),
        lbl("Threads"),
        txt(" tab, filter by "),
        lbl("Agent"),
        txt(" (exact name, matching the input's "),
        lbl("Exact agent name…"),
        txt(" hint) and press "),
        lbl("Load more"),
        txt(" to page through older history."),
      ],
      [
        txt("Source pills distinguish how the thread started: "),
        lbl("CHAT"),
        txt(" (you), "),
        lbl("CRON"),
        txt(" (a schedule, see "),
        docLink("/documentation/crons", "Crons"),
        txt(") and "),
        lbl("MCP"),
        txt(" (a one-shot external execution)."),
      ],
    ),

    sub("Example investigation flow"),
    example([
      "Goal: find out why this month's cost is higher than expected.",
      " 1. Open Traces, keep the Dashboard tab.",
      " 2. Set Period = 30 days.      → KPIs show tokens, cost, runs.",
      " 3. Read the agent breakdown.  → one agent dominates the tokens.",
      " 4. Select the model filter for the priciest model (Runs tab,",
      '    "Model (runs list)") to rank its top runs.',
      " 5. Open the top run row.      → the read-only detail shows the",
      "    timeline: which turn caused the tokens.",
      "Outcome: a concrete run, agent and turn to talk about.",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt(
          "The Dashboard looks unchanged after selecting a model — expected: the model filter only narrows the runs list, the KPIs stay for all models.",
        ),
      ],
      [
        txt(
          "A custom period shows old data — both dates must be picked for the custom range to apply; look for the on-screen notice.",
        ),
      ],
      [
        lbl("No LLM usage recorded in this period"),
        txt(" — start a conversation or run a cron for the period, or widen the filters."),
      ],
      [
        txt(
          "The Threads filter finds nothing — it matches the exact agent name, character for character; check the spelling or clear it.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/orchestration-and-chat", text: "Orchestration and Chat" },
      { to: "/documentation/crons", text: "Crons" },
      { to: "/documentation/settings", text: "Settings and Account" },
    ),
  ],
};

export default traces;
