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
 * DOC-02 — Orchestration and Chat. Conversations, streaming activity,
 * human-in-the-loop tool review, attachments, structured responses, PDF
 * results and thread history, based on the current Chat screen labels.
 */
const orchestrationAndChat: DocChapter = {
  doc: "DOC-02",
  slug: "orchestration-and-chat",
  navLabel: "Orchestration and Chat",
  title: "Orchestration and Chat",
  blocks: [
    para(
      txt(
        "The Orchestration screen is where you talk with your agents in real time. Replies stream in as they are generated, you can watch the agent work step by step, approve sensitive tool actions before they run, and attach files when the agent supports them.",
      ),
    ),
    para(
      docLink("/documentation/getting-started", "Getting Started"),
      txt(
        " explains how this screen fits into the whole workflow; this chapter covers the screen itself.",
      ),
    ),

    sub("When to use it"),
    bullets(
      [txt("You want an answer, a draft, a summary or a decision from one of your agents.")],
      [
        txt(
          "You want to watch an agent use tools (search, files, external services) while it works.",
        ),
      ],
      [txt("You want to hand the agent documents or images to reason about.")],
    ),
    para(
      txt("Prerequisites: at least one agent exists, and your "),
      docLink("/documentation/settings", "LLM provider settings"),
      txt(" are saved. The message box stays unavailable until a thread is open."),
    ),

    sub("Start a conversation"),
    steps(
      [txt("Choose "), lbl("Orchestration"), txt(" in the left menu.")],
      [txt("In the thread sidebar, press "), lbl("New Conversation"), txt(".")],
      [
        txt("In the "),
        lbl("Choose an Agent"),
        txt(
          " dialog, select the agent to talk with. The built-in assistant is listed first with its ",
        ),
        lbl("built-in"),
        txt(" badge; your own agents follow with their model names."),
      ],
      [txt("A new thread opens and becomes the active conversation.")],
      [
        txt("Type your message in the box (the example caption is "),
        lbl("Orchestrate your next move..."),
        txt(") and press the send arrow, or press "),
        lbl("Enter"),
        txt(". Use "),
        lbl("Shift+Enter"),
        txt(" for a new line without sending."),
      ],
      [
        txt(
          "Expected outcome: the reply streams in below your message with an activity timeline above it.",
        ),
      ],
    ),

    sub("Following a streaming reply"),
    para(txt("While the agent works you will see some of these blocks in the timeline:")),
    bullets(
      [
        lbl("Thinking"),
        txt(
          " — short reasoning notes the agent produced before answering. Read them to understand why it chose its approach.",
        ),
      ],
      [
        lbl("Calling tool:"),
        txt(" — a request to run an external tool; the block shows the tool's name (for example "),
        lbl("Calling tool: send_email"),
        txt(") and can be expanded to check exactly what was sent."),
      ],
      [
        lbl("Tool Result"),
        txt(
          " — the outcome that came back; expand it to see what the agent received and whether the request succeeded.",
        ),
      ],
      [
        txt(
          "A subagent panel — part of the work was handed to a helper agent; its header names the helper and shows its own thinking, tool requests and content.",
        ),
      ],
      [txt("The message body — the visible answer, which fills in while the reply streams.")],
    ),
    para(
      txt(
        "While a reply is streaming the send button turns into a stop button; press it to stop the run. You can continue the conversation by sending a follow-up message afterwards.",
      ),
    ),

    sub("Reviewing a tool action before it runs"),
    para(
      txt(
        "Agents configured for human review pause before running a tool. Nothing is executed until you decide, which makes them safe to use even when tools send emails or change files:",
      ),
    ),
    steps(
      [txt("Read the review panel: it names the tool and what it is about to do.")],
      [
        txt("Press "),
        lbl("Approve"),
        txt(" (naming the tool) to let it run, or "),
        lbl("Reject"),
        txt(" to block it."),
      ],
      [
        txt("Rejected tools let you type a reason ("),
        lbl("Reason for rejection (optional)"),
        txt("), then press "),
        lbl("Confirm Reject"),
        txt("."),
      ],
      [
        txt(
          "Expected outcome: an approved tool executes and the turn continues; a rejected tool is skipped and the agent receives your reason, so its next answer may differ.",
        ),
      ],
    ),
    warning(
      txt(
        "Approving is an instruction to act. Read the tool name and its details before approving — actions such as sending messages or changing files take effect immediately.",
      ),
    ),

    sub("Attachments"),
    para(
      txt("Press "),
      lbl("Attach files"),
      txt(" (the paperclip) to add files to your next message."),
    ),
    bullets(
      [
        txt(
          "Images are always accepted; a small preview appears above the message box and can be removed before sending.",
        ),
      ],
      [
        txt(
          "Documents (PDF, DOCX, TXT, CSV and similar) are only accepted when the current agent has a Files MCP server. Without one, the composer shows ",
        ),
        lbl("Images only · documents require an agent with Files MCP"),
        txt("."),
      ],
      [
        txt(
          "A message can carry at most 10 attachments and 50 MiB in total; anything larger or additional is refused with a red message above the composer.",
        ),
      ],
    ),
    para(
      txt(
        "Sent attachments travel with your message to the agent; they are shown as file chips (name, size) in the conversation afterwards.",
      ),
    ),

    sub("Structured responses"),
    para(
      txt(
        "When an agent is configured to produce a structured response, the answer is rendered as a structured card instead of plain chat text. If the model produces output that is not valid for the configured format, an inline error says so instead of pretending the payload is fine.",
      ),
    ),

    sub("Previewing and downloading PDF results"),
    para(
      txt("When a tool produces a PDF, the result box offers "),
      lbl("Preview"),
      txt(" and "),
      lbl("Download"),
      txt(" actions. "),
      lbl("Preview"),
      txt(
        " opens a viewer that loads the file on demand and shows one page at a time with previous/next controls and a ",
      ),
      lbl("Page X / N"),
      txt(" counter. "),
      lbl("Download"),
      txt(
        " saves the file using the name reported by the tool result. Other tool results keep their usual collapsed rendering.",
      ),
    ),

    sub("Thread history"),
    para(
      txt(
        "Threads are grouped by agent name in the thread sidebar. Each row shows a short thread identifier, the date it started and a source pill: ",
      ),
      lbl("CHAT"),
      txt(" for conversations you started, "),
      lbl("CRON"),
      txt(" for scheduled runs, and "),
      lbl("MCP"),
      txt(
        " for one-shot executions started by an external API call. Select a row to reopen the read conversation; use the ",
      ),
      lbl("Back to all traces"),
      txt(" link in Traces to reach past runs by a different path."),
    ),

    sub("Examples"),
    example([
      "A basic interaction:",
      "  You: Summarize the risks from the attached release notes.",
      "  Agent: (Thinking) ... streams a summary of the three main risks.",
      "  Outcome: a normal chat answer; no tools were needed.",
      "  ",
      "An interaction that requires tool approval:",
      "  You: Send today's outage summary to the on-call list.",
      "  Agent: Calling tool: send_email   [Approve send_email] [Reject send_email]",
      "  You: press Approve send_email.",
      "  Agent: Tool Result — the message was queued; continue with the answer.",
      "  Outcome: the email action ran only after your approval.",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt("Sending fails and mentions missing LLM configuration — open "),
        docLink("/settings", "Settings"),
        txt(" and save the "),
        lbl("LLM Provider"),
        txt(" card (see "),
        docLink("/documentation/settings", "Settings and Account"),
        txt(")."),
      ],
      [
        lbl("No agents available"),
        txt(" appears in the chooser — create an agent first (see "),
        docLink("/documentation/agents", "Agents"),
        txt(")."),
      ],
      [
        txt(
          "Documents cannot be attached — this agent has no Files MCP server; pick another agent or register one (see ",
        ),
        docLink("/documentation/mcp-registry", "MCP Registry"),
        txt(")."),
      ],
      [txt("Threads cannot be deleted from this interface in the current version.")],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/mcp-registry", text: "MCP Registry" },
      { to: "/documentation/crons", text: "Crons" },
      { to: "/documentation/traces", text: "Traces" },
    ),
  ],
};

export default orchestrationAndChat;
