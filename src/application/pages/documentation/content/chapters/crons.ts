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
  warning,
  type DocChapter,
} from "../types";

/**
 * DOC-06 — Crons. Scheduled agent runs: create/edit/enable/disable, run
 * immediately, run history, the five-field expression and IANA time zone.
 */
const crons: DocChapter = {
  doc: "DOC-06",
  slug: "crons",
  navLabel: "Crons",
  title: "Crons",
  blocks: [
    para(
      txt(
        "Crons run an agent for you at fixed times — no person has to press send. At each occurrence the product starts a conversation with the chosen agent and delivers the saved message. Typical uses are daily briefings, weekly digests and recurring clean-up prompts. The page description states the ground rules: runs that overlap are skipped, and failed runs are not retried.",
      ),
    ),

    sub("Prerequisites"),
    bullets(
      [
        txt("At least one agent exists — you select it from the "),
        lbl("Agent"),
        txt(" list in the dialog."),
      ],
      [
        txt("Your "),
        docLink("/documentation/settings", "LLM provider settings"),
        txt(" are saved; runs are billed to your usage just like chat."),
      ],
    ),

    sub("Create a cron"),
    steps(
      [txt("Open "), lbl("Crons"), txt(" and press "), lbl("New Cron"), txt(".")],
      [txt("Enter the "), lbl("Name"), txt(" (for example "), lbl("daily-digest"), txt(").")],
      [
        txt("Pick the "),
        lbl("Agent"),
        txt(" that receives the runs. If the list shows "),
        lbl("Loading agents…"),
        txt(", wait; if it fails, use "),
        lbl("Retry"),
        txt("; if it says "),
        lbl("No agents available. Create an agent first."),
        txt(" — create one (see "),
        docLink("/documentation/agents", "Agents"),
        txt(")."),
      ],
      [
        txt("Enter the "),
        lbl("Message"),
        txt(" — the fixed text sent to the agent on every run, for example "),
        lbl("Summarize the day's releases."),
        txt("."),
      ],
      [
        txt("Enter the "),
        lbl("Cron expression"),
        txt(
          " — exactly five fields (minute, hour, day of month, month, day of week), no seconds. ",
        ),
        lbl("0 9 * * *"),
        txt(" means every day at 09:00. "),
      ],
      [
        txt("Enter a "),
        lbl("Time Zone"),
        txt(" — a valid IANA time-zone name such as "),
        lbl("UTC"),
        txt(" (the default), "),
        lbl("Europe/Paris"),
        txt(" or "),
        lbl("America/New_York"),
        txt("."),
      ],
      [
        txt("Press "),
        lbl("Create"),
        txt(". Expected outcome: the toast confirms "),
        lbl('Cron "name" created'),
        txt(" and the row appears with "),
        lbl("Enabled"),
        txt(", an "),
        lbl("Expression"),
        txt(", the "),
        lbl("Timezone"),
        txt(", the next run time and the last run time. New crons are enabled by default."),
      ],
    ),
    para(
      txt(
        "Validation messages appear above the buttons if anything is wrong: a name, agent and message are required; the expression must have exactly five fields (six fields or seconds are rejected); the time zone must be a valid IANA name.",
      ),
    ),

    sub("Enable, disable and run immediately"),
    bullets(
      [
        lbl("Disable"),
        txt(
          " pauses a schedule. Its next run time stops being recalculated until you re-enable it.",
        ),
      ],
      [
        lbl("Enable"),
        txt(" activates a schedule again, and the "),
        lbl("Next run"),
        txt(" time is recalculated right away."),
      ],
      [
        lbl("Run now"),
        txt(
          " starts one run immediately, without touching the schedule. It also works while the cron is disabled, so you can test a new message or expression before turning a schedule back on.",
        ),
      ],
    ),
    warning(
      txt(
        "Run now starts a real agent run that consumes tokens and posts to real tools, exactly like a scheduled run. Edit the message before pressing Run now if the wording is not ready for production tools.",
      ),
    ),

    sub("Edit a cron"),
    para(
      txt("Press "),
      lbl("Edit"),
      txt(" on the row to open "),
      lbl("Edit Cron"),
      txt(", change "),
      lbl("Name"),
      txt(", "),
      lbl("Agent"),
      txt(", "),
      lbl("Message"),
      txt(", "),
      lbl("Cron expression"),
      txt(" or "),
      lbl("Time Zone"),
      txt(", and press "),
      lbl("Save"),
      txt(" (the toast confirms "),
      lbl('Cron "name" updated'),
      txt("). The next run time is recalculated after the change."),
    ),

    sub("Run history"),
    steps(
      [txt("Press "), lbl("Run History"), txt(" on the row.")],
      [
        txt("The dialog lists past runs with their trigger (scheduled or "),
        lbl("Run now"),
        txt("), the terminal status such as "),
        lbl("completed"),
        txt(" or "),
        lbl("error"),
        txt(", the run timing, and a safe error summary when a run failed."),
      ],
      [
        txt("Each run also shows its thread-source pill ("),
        lbl("CRON"),
        txt(
          ") — the run's conversation thread exists in Threads history — and a link that opens the run's trace in ",
        ),
        docLink("/documentation/traces", "Traces"),
        txt("."),
      ],
    ),

    sub("Delete a cron"),
    steps(
      [
        txt("Press "),
        lbl("Delete"),
        txt(" on the row; the first press changes it to "),
        lbl("Confirm Delete?"),
        txt(" as a two-step confirmation."),
      ],
      [
        txt("Press "),
        lbl("Confirm Delete?"),
        txt(" to remove the schedule. The toast confirms "),
        lbl('Cron "name" deleted'),
        txt(". Past run threads and traces stay available."),
      ],
    ),

    sub("Example schedules and their meaning"),
    example([
      "0 9 * * *      every day at 09:00            (Timezone: Europe/Paris)",
      "0 9 * * 1      every Monday at 09:00",
      "30 8 1 * *     at 08:30 on the first day of each month",
      "*/15 * * * *   every fifteen minutes",
      "0 22 * * 1-5   every weekday at 22:00",
    ]),

    sub("Interpreting the row"),
    bullets(
      [lbl("Expression"), txt(" — the five-field schedule as saved.")],
      [lbl("Timezone"), txt(" — the time zone used to evaluate the schedule.")],
      [
        lbl("Next run"),
        txt(" — when the next scheduled run will start (stops moving while disabled)."),
      ],
      [lbl("Last run"), txt(" — when the most recent run happened, with a status pill.")],
    ),

    sub("Common problems"),
    bullets(
      [
        txt("The schedule never fires — confirm the status is "),
        lbl("Enabled"),
        txt(
          ", that the expression and time zone are correct, and that the time is still ahead in the selected time zone; press ",
        ),
        lbl("Run now"),
        txt(" once to verify the agent side works."),
      ],
      [
        txt(
          "A run failed and was not retried — this is expected behavior; read the error summary in ",
        ),
        lbl("Run History"),
        txt(", fix the cause (for example an expired key in "),
        docLink("/documentation/settings", "Settings"),
        txt("), then press "),
        lbl("Run now"),
        txt("."),
      ],
      [
        txt(
          "Overlapping occurrences are skipped — if a long run can overlap with the next occurrence, widen the interval or accept that the second start is skipped.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/orchestration-and-chat", text: "Orchestration and Chat" },
      { to: "/documentation/traces", text: "Traces" },
    ),
  ],
};

export default crons;
