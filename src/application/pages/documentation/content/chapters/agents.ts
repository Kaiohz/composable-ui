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
 * DOC-03 — Agents. Purpose, built-in assistant, create/inspect/edit/delete
 * procedures and the functional settings (prompt source, model source, MCP
 * tools, subagents, memories and skills, human review, response format).
 */
const agents: DocChapter = {
  doc: "DOC-03",
  slug: "agents",
  navLabel: "Agents",
  title: "Agents",
  blocks: [
    para(
      txt(
        "An agent is a named assistant configuration. It decides which model answers, which instructions it follows, which tools it may call, and how it responds. Every conversation and every scheduled run uses exactly one agent, so agents are the piece you configure once and reuse everywhere.",
      ),
    ),

    sub("The built-in assistant and agent management"),
    bullets(
      [
        lbl("composable-ai-assistant"),
        txt(" is supplied with the product and listed first with a "),
        lbl("built-in"),
        txt(" badge. Pressing "),
        lbl("Configure"),
        txt(" opens its effective definition. You can personalize the editable fields with "),
        lbl("Edit"),
        txt(" and restore the platform default with "),
        lbl("Reset to Default"),
        txt("; the card never offers Delete."),
      ],
      [
        txt(
          "Every other entry in the list is yours to manage: create it, inspect it, edit it, export it, or delete it.",
        ),
      ],
    ),

    sub("When to use it"),
    bullets(
      [
        txt(
          "You want a specialist, for example a release-notes writer with one prompt and a calm model, kept separate from an operations helper that can use tools.",
        ),
      ],
      [
        txt("You need the same configuration available both in chat and in a "),
        docLink("/documentation/crons", "Cron"),
        txt(" schedule."),
      ],
    ),
    para(
      txt("Prerequisites: LLM provider settings saved ("),
      docLink("/documentation/settings", "Settings and Account"),
      txt("), and a "),
      docLink("/documentation/models", "model"),
      txt(" entry if you want to pick from your catalog instead of typing a model string."),
    ),

    sub("Create an agent"),
    steps(
      [txt("Open "), lbl("Agents"), txt(" and press "), lbl("Create Agent"), txt(".")],
      [
        txt("In the dialog choose how to define it: the "),
        lbl("Form"),
        txt(" or "),
        lbl("Upload YAML"),
        txt(" to import an existing configuration file. The dashed "),
        lbl("New Agent Template"),
        txt(" card in the grid opens the same dialog."),
      ],
      [
        txt("In "),
        lbl("General"),
        txt(", enter the "),
        lbl("Agent Name"),
        txt(" and "),
        lbl("Description"),
        txt("."),
      ],
      [
        txt("Still in "),
        lbl("General"),
        txt(", use the "),
        lbl("Model Source"),
        txt(" control to choose "),
        lbl("Catalog model"),
        txt(" and select a "),
        lbl("Model"),
        txt(" entry from your model catalog, or "),
        lbl("Custom model"),
        txt(" and type the provider model string yourself."),
      ],
      [
        txt("In "),
        lbl("Prompt Source"),
        txt(", choose "),
        lbl("Registry prompt"),
        txt(" (select a prompt and a version mode), "),
        lbl("Inline prompt"),
        txt(" (type the system prompt here), or "),
        lbl("Prompt file"),
        txt("."),
      ],
      [
        txt("In "),
        lbl("MCP Servers"),
        txt(
          ", add the server entries that provide this agent's tools. An agent without MCP servers has no tools.",
        ),
      ],
      [
        txt("In "),
        lbl("Subagents"),
        txt(", use "),
        lbl("Add from existing agents"),
        txt(" to let this agent delegate work to another agent; the reference is shown with a "),
        lbl("ref:"),
        txt(" badge."),
      ],
      [
        txt("In "),
        lbl("HITL"),
        txt(", choose whether tool calls need your approval before they run (see "),
        docLink("/documentation/orchestration-and-chat", "reviewing a tool action"),
        txt(")."),
      ],
      [
        txt("In "),
        lbl("Memory & Skills"),
        txt(", attach the memories and skills this agent should be able to use."),
      ],
      [txt("In "), lbl("Response Format"), txt(", optionally define a structured response.")],
      [
        txt("Press "),
        lbl("Create Agent"),
        txt(". Expected outcome: the toast confirms "),
        lbl("Agent created successfully"),
        txt(" and the new agent card appears in the grid."),
      ],
    ),

    sub("Latest or pinned prompt version"),
    para(
      txt("When you select a "),
      lbl("Registry prompt"),
      txt(" in the form, choose between two version modes. "),
      lbl("Latest"),
      txt(
        " always follows the newest version of that prompt — edits take effect on the next run without touching the agent. ",
      ),
      lbl("Pinned"),
      txt(
        " locks a specific version number, so agents keep answering exactly as they did on that version until you change it. Use pinned where stable wording matters; use latest where you want prompt improvements to ship immediately (see ",
      ),
      docLink("/documentation/prompts", "Prompts"),
      txt(")."),
    ),

    sub("Catalog model or custom model string"),
    para(
      txt("A "),
      lbl("Catalog model"),
      txt(
        " points at an entry of your model catalog, so provider details stay in one place and the card name stays readable. A ",
      ),
      lbl("Custom model"),
      txt(
        " is a free-form model identifier used directly; it suits one-off providers you have not catalogued. Entries, never custom strings, are the recommended way to change which model an agent uses later.",
      ),
    ),

    sub("Inspect, edit, export or delete an agent"),
    steps(
      [
        txt("Open "),
        lbl("Agents"),
        txt(" and press "),
        lbl("Configure"),
        txt(
          " on the agent's card. The configuration overview resolves every reference against your registries and shows human-readable names.",
        ),
      ],
      [
        txt("For "),
        lbl("composable-ai-assistant"),
        txt(", press "),
        lbl("Edit"),
        txt(
          " to personalize the editable fields for your account. The name, dynamic toolset, MCP servers and destructive-delete approval rules stay platform-managed. Once saved, the viewer shows a ",
        ),
        lbl("customized"),
        txt(" badge and "),
        lbl("Reset to Default"),
        txt(" returns to the supplied definition."),
      ],
      [
        txt("For a custom agent, press "),
        lbl("Edit"),
        txt(" to change the configuration, then save. The toast confirms "),
        lbl("Agent updated successfully"),
        txt("."),
      ],
      [
        txt("For a custom agent, press "),
        lbl("Export YAML"),
        txt(" to download the current definition as a file you can import later with "),
        lbl("Upload YAML"),
        txt(
          ". The built-in assistant keeps this action hidden because an exported YAML file cannot reproduce its dynamic toolset.",
        ),
      ],
      [
        txt("For a custom agent, press "),
        lbl("Delete"),
        txt(" — it changes to "),
        lbl("Confirm Delete?"),
        txt(" — and press it again to remove the agent."),
      ],
      [
        txt("Expected outcome: the toast reports "),
        lbl('Agent "name" deleted'),
        txt(" and the card disappears from the grid."),
      ],
    ),

    sub("Practical example"),
    example([
      "Agent name     : release-notes-writer",
      "Description    : Writes release notes from merged tickets.",
      'Model source   : Catalog model → "Fast Haiku"',
      "Prompt source  : Registry prompt → release-notes, Latest",
      "MCP servers    : (none)",
      "HITL           : Not required (no tools)",
      "Result         : a read-mostly agent usable in chat and in a cron",
      "                 for weekly release-note drafts.",
    ]),

    warning(
      txt(
        "Changes to an agent take effect for every future conversation and scheduled run that uses it, including ",
      ),
      docLink("/documentation/crons", "Crons"),
      txt(
        " that send fixed messages. If a run suddenly behaves differently, compare the agent's current configuration with your last exported YAML before changing more.",
      ),
    ),

    sub("Common problems"),
    bullets(
      [
        txt("The model dropdown is empty — create an entry in "),
        docLink("/documentation/models", "Models"),
        txt(" first, or switch to "),
        lbl("Custom model"),
        txt("."),
      ],
      [
        lbl("No agents available"),
        txt(" in the Orchestration chooser means none exist yet; press "),
        lbl("Create Agent"),
        txt(" here."),
      ],
      [
        txt("The configuration viewer says "),
        lbl("Registry unavailable — reference could not be verified"),
        txt(
          " — a prompt or model reference could not be resolved; use the Retry control, and fix or replace the reference if it stays unavailable.",
        ),
      ],
      [
        txt("The agent answers without using expected tools — check the "),
        lbl("MCP Servers"),
        txt(" list in its configuration and that the servers validate (see "),
        docLink("/documentation/mcp-registry", "MCP Registry"),
        txt(")."),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/prompts", text: "Prompts" },
      { to: "/documentation/models", text: "Models" },
      { to: "/documentation/mcp-registry", text: "MCP Registry" },
      { to: "/documentation/skills", text: "Skills" },
      { to: "/documentation/memories", text: "Memories" },
    ),
  ],
};

export default agents;
