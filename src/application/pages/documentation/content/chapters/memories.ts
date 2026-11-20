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
 * DOC-09 — Memories. Markdown information resources referenced by agents,
 * kept clearly distinct from prompts and skills.
 */
const memories: DocChapter = {
  doc: "DOC-09",
  slug: "memories",
  navLabel: "Memories",
  title: "Memories",
  blocks: [
    para(
      txt(
        "A memory is a markdown information file that agents can read. It holds reference knowledge — standing rules, conventions, facts about your teams or products — that should color every answer without being part of the system prompt. For example, a memory named ",
      ),
      lbl("AGENTS"),
      txt(" could list your team's conventions so a writing agent always respects them."),
    ),

    sub("Memory, prompt or skill?"),
    bullets(
      [
        lbl("Prompt"),
        txt(" — main instructions for a specific agent role; versioned and immutable (see "),
        docLink("/documentation/prompts", "Prompts"),
        txt(")."),
      ],
      [
        lbl("Skill"),
        txt(" — reusable procedure know-how the agent applies when a task matches it (see "),
        docLink("/documentation/skills", "Skills"),
        txt(")."),
      ],
      [
        lbl("Memory"),
        txt(
          " — background information the agent reads as reference; plain markdown, one file per memory.",
        ),
      ],
    ),

    sub("Create a memory"),
    steps(
      [txt("Open "), lbl("Memories"), txt(" and press "), lbl("Create Memory"), txt(".")],
      [
        txt("In the "),
        lbl("Create Memory"),
        txt(" dialog, enter "),
        lbl("Name"),
        txt(" — it becomes the markdown file name (for example "),
        lbl("AGENTS"),
        txt(" creates "),
        lbl("/memories/AGENTS.md"),
        txt(")."),
      ],
      [
        txt("Enter the "),
        lbl("Content"),
        txt(" in markdown, for example "),
        lbl("# Project rules and conventions…"),
        txt("."),
      ],
      [
        txt("Press "),
        lbl("Create Memory"),
        txt(
          ". Expected outcome: the memory card appears in the grid and the counter at the top increases.",
        ),
      ],
    ),

    sub("View and edit a memory"),
    steps(
      [
        txt("Press "),
        lbl("Configure"),
        txt(
          " on the memory's card. A dialog titled with the memory's path opens and renders the markdown.",
        ),
      ],
      [
        txt("Press "),
        lbl("Edit"),
        txt(" to change the "),
        lbl("Content"),
        txt(". The "),
        lbl("Name"),
        txt(
          " field is read-only — a memory's filename cannot be renamed in the current editor, the description states this explicitly.",
        ),
      ],
      [
        txt("Press "),
        lbl("Save Changes"),
        txt(
          ". Expected outcome: the toast confirms the memory was saved and reading mode shows the updated text.",
        ),
      ],
    ),

    sub("Export a memory"),
    steps(
      [txt("In the memory dialog press "), lbl("Export"), txt(".")],
      [
        txt(
          "Expected outcome: a markdown file named after the memory is downloaded, containing exactly the stored content.",
        ),
      ],
    ),

    sub("Delete a memory"),
    steps(
      [
        txt("In the memory dialog press "),
        lbl("Delete"),
        txt(" — it changes to "),
        lbl("Confirm Delete?"),
        txt(" as a two-step confirmation."),
      ],
      [
        txt("Press "),
        lbl("Confirm Delete?"),
        txt(" to remove the memory. The toast confirms the deletion and the card disappears."),
      ],
    ),
    warning(
      txt(
        "Deleting a memory is confirmed but leaves referenced agents behind: agents that listed it keep the reference. Check ",
      ),
      docLink("/documentation/agents", "Agents"),
      txt(" and re-point them before deleting if uncertainty exists."),
    ),

    sub("Practical example"),
    example([
      "Name    : glossary",
      "Content : (markdown)",
      "  # Team glossary",
      '  - "Release" means a production deployment.',
      '  - "Hotfix week" refers to the week after a release.',
      "  - Currency amounts use EUR with two decimals.",
      "",
      "Use: attach to reporting agents so terms stay consistent.",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt(
          "The name cannot be corrected after creation — filenames are fixed in this editor; recreate the memory with the right name and delete the old one.",
        ),
      ],
      [
        txt(
          "An agent does not respect the memory — re-open the agent configuration and confirm the memory is still listed in ",
        ),
        lbl("Memory & Skills"),
        txt("."),
      ],
      [
        txt(
          "Long memories slow answers down — keep each memory focused on one topic and split large reference files into several named memories.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/prompts", text: "Prompts" },
      { to: "/documentation/skills", text: "Skills" },
    ),
  ],
};

export default memories;
