import { bullets, docLink, lbl, links, para, steps, sub, txt, type DocChapter } from "../types";

/**
 * DOC-01 — Getting Started and Core Concepts (landing chapter).
 * Explains the application purpose and the end-to-end mental model before
 * any per-screen procedures, per the spec information architecture.
 */
const gettingStarted: DocChapter = {
  doc: "DOC-01",
  slug: "getting-started",
  navLabel: "Getting Started",
  title: "Getting Started and Core Concepts",
  blocks: [
    para(
      txt(
        "ComposableUI is a web console for working with AI agents. You use it to chat with agents, give them reusable instructions and knowledge, let them use external tools, run them automatically on a schedule, and check how much each conversation cost. The left menu lists every area: Orchestration, Agents, Prompts, Models, Crons, Traces, Skills, Memories, RAG Storage, MCP Registry, and Settings.",
      ),
    ),
    para(
      txt(
        "This guide is written for everyday users, not programmers. It explains what each area is for, what to prepare before you start, the exact buttons to press, and what you should see when a task worked. The wording always matches the labels you can see in the product.",
      ),
    ),

    sub("How the pieces fit together"),
    para(
      txt(
        "Every conversation runs with exactly one agent. An agent is a named configuration that says which AI model to use, which instructions to follow, and which extra resources it may reach for. Nothing runs until those prerequisites exist, so the setup order below matters:",
      ),
    ),
    bullets(
      [
        txt("The AI service is authorized by your personal "),
        lbl("LLM Provider"),
        txt(" credentials, saved in the "),
        docLink("/documentation/settings", "Settings"),
        txt(" chapter. Without them no agent can answer."),
      ],
      [
        txt("A "),
        docLink("/documentation/models", "Model"),
        txt(
          " entry names the AI service itself, for example a quick or a reasoning model. Entries hold no secrets.",
        ),
      ],
      [
        txt("Reusable instruction resources — "),
        docLink("/documentation/prompts", "Prompts"),
        txt(", "),
        docLink("/documentation/skills", "Skills"),
        txt(" and "),
        docLink("/documentation/memories", "Memories"),
        txt(" — carry knowledge and rules that agents point at instead of retyping them."),
      ],
      [
        txt("An "),
        docLink("/documentation/mcp-registry", "MCP Registry"),
        txt(
          " server entry gives agents access to external tools, such as file handling or other services.",
        ),
      ],
      [
        txt("An "),
        docLink("/documentation/agents", "Agent"),
        txt(
          " assembles the model, one instruction source, tools, skills, memories and response options into one ready-to-use assistant.",
        ),
      ],
      [
        txt("A "),
        docLink("/documentation/orchestration-and-chat", "conversation"),
        txt(" is a chat thread with exactly one agent. A "),
        docLink("/documentation/crons", "Cron"),
        txt(" is a saved schedule that starts a conversation with an agent automatically."),
      ],
      [
        txt("Every run leaves a "),
        docLink("/documentation/traces", "Trace"),
        txt(" so you can see token usage, estimated cost, duration and errors afterwards."),
      ],
    ),

    sub("Recommended first-use sequence"),
    para(
      txt(
        "If you are new, follow these steps once. Each step links to the chapter that explains it in detail:",
      ),
    ),
    steps(
      [
        txt("Open "),
        docLink("/settings", "Settings"),
        txt(" and fill the "),
        lbl("LLM Provider"),
        txt(" card: pick a "),
        lbl("Provider"),
        txt(", optionally adjust the "),
        lbl("Base URL"),
        txt(", paste your "),
        lbl("API Key"),
        txt(", and press "),
        lbl("Save LLM settings"),
        txt("."),
      ],
      [
        txt("Open "),
        docLink("/models", "Models"),
        txt(" and press "),
        lbl("New Model"),
        txt(" to add a reusable model entry that your agents will select."),
      ],
      [
        txt("Optionally prepare resources you plan to reuse: press "),
        lbl("New Prompt"),
        txt(" in "),
        docLink("/prompts", "Prompts"),
        txt(", "),
        lbl("Create Skill"),
        txt(" in "),
        docLink("/skills", "Skills"),
        txt(", "),
        lbl("Create Memory"),
        txt(" in "),
        docLink("/memories", "Memories"),
        txt(", or "),
        lbl("Add MCP Server"),
        txt(" in "),
        docLink("/mcp-registry", "MCP Registry"),
        txt("."),
      ],
      [
        txt("Open "),
        docLink("/agents", "Agents"),
        txt(" and press "),
        lbl("Create Agent"),
        txt(" to assemble the model, instructions, tools and options into an agent."),
      ],
      [
        txt("Open "),
        docLink("/chat", "Orchestration"),
        txt(" and press "),
        lbl("New Conversation"),
        txt(", then pick your agent in the "),
        lbl("Choose an Agent"),
        txt(" dialog and send your first message."),
      ],
      [
        txt("Open "),
        docLink("/traces", "Traces"),
        txt(" and read the "),
        lbl("Dashboard"),
        txt(" tab to confirm the run was recorded with its token usage and cost."),
      ],
    ),

    sub("If your first conversation does not start"),
    para(
      txt(
        "The most common first-run blocker is a missing AI service configuration: sending a message fails with an error that names missing LLM configuration and offers a direct link to Settings. The recovery is quick — open ",
      ),
      docLink("/settings", "Settings"),
      txt(", fill the "),
      lbl("LLM Provider"),
      txt(" card ("),
      lbl("Provider"),
      txt(", "),
      lbl("Base URL"),
      txt(" if your provider is not the standard one, your "),
      lbl("API Key"),
      txt(") and press "),
      lbl("Save LLM settings"),
      txt(". Then send your message again. See "),
      docLink("/documentation/settings", "Settings and Account"),
      txt(" for every appearance and credential control."),
    ),

    sub("The built-in assistant"),
    para(
      lbl("composable-ai-assistant"),
      txt(
        " is supplied with the product. It appears in the Agents list and in every agent chooser with a ",
      ),
      lbl("built-in"),
      txt(
        " badge. You can look at its configuration and personalize the editable fields with Edit; Reset to Default restores the supplied definition. It cannot be deleted, its name stays reserved, and its dynamic tools plus destructive-delete approval rules remain managed by the platform. Even with the built-in assistant available, starting a conversation always requires choosing an agent: there is no default agent that answers without this step.",
      ),
    ),

    sub("Global settings versus reusable resources"),
    para(
      txt(
        "Settings holds things about you: console appearance (theme, accent, typography, reset) and personal credentials (LLM provider settings and personal API keys). Everything else in the left menu is a reusable resource you create once and reuse across agents, conversations and schedules. Changing a reusable resource affects every future run of the agents that reference it, so review before you edit or delete one — the chapters about each resource list what is affected.",
      ),
    ),

    sub("Glossary"),
    para(txt("Short definitions, in the words you will meet in this guide:")),
    bullets(
      [
        lbl("Agent"),
        txt(
          " — a configured AI assistant; selecting one is how you start a conversation or a scheduled run.",
        ),
      ],
      [
        lbl("Prompt"),
        txt(
          " — reusable instruction text with saved versions; agents can use the newest version or a pinned one.",
        ),
      ],
      [
        lbl("Model"),
        txt(
          " — a reusable entry that names a provider and the provider's model identifier for agents to choose.",
        ),
      ],
      [
        lbl("Skill"),
        txt(
          " — a named, reusable instruction pack (markdown) that an agent can follow when the task matches it.",
        ),
      ],
      [
        lbl("Memory"),
        txt(" — a markdown information file, such as team conventions, that agents can read."),
      ],
      [
        lbl("MCP server"),
        txt(
          " — an external service that offers tools (actions) to an agent, registered once in the MCP Registry.",
        ),
      ],
      [
        lbl("RAG"),
        txt(
          " — a searchable knowledge base you upload files into, so answers can be drawn from your documents.",
        ),
      ],
      [
        lbl("Thread"),
        txt(
          " — one conversation with one agent, including everything sent, streamed and executed in it.",
        ),
      ],
      [
        lbl("Cron"),
        txt(" — a saved five-field schedule that sends a fixed message to an agent at set times."),
      ],
      [
        lbl("Trace"),
        txt(" — the recorded activity of a run: events, duration, tokens and estimated cost."),
      ],
    ),

    links(
      "Where to go next",
      { to: "/documentation/orchestration-and-chat", text: "Orchestration and Chat" },
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/crons", text: "Crons" },
      { to: "/documentation/traces", text: "Traces" },
      { to: "/documentation/settings", text: "Settings and Account" },
    ),
  ],
};

export default gettingStarted;
