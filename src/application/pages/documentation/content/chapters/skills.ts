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
 * DOC-08 — Skills. Named, reusable instruction resources for agents:
 * create, view, edit, export, rename behavior and deletion confirmation.
 */
const skills: DocChapter = {
  doc: "DOC-08",
  slug: "skills",
  navLabel: "Skills",
  title: "Skills",
  blocks: [
    para(
      txt(
        "A skill is a named instruction pack: a short name, a one-line description, and a markdown body with the actual guidance. Agents can use the skills they are given when a task matches them — for example a skill that explains how to query your knowledge base, or how to format weekly reports. Skills let you keep specialist know-how out of prompts and share it between agents.",
      ),
    ),
    para(
      txt("Choose a skill rather than a "),
      docLink("/documentation/prompts", "prompt"),
      txt(
        " when the content is reusable procedure knowledge rather than the agent's main role, and rather than a ",
      ),
      docLink("/documentation/memories", "memory"),
      txt(" when it is instructions instead of reference information."),
    ),

    sub("Create a skill"),
    steps(
      [txt("Open "), lbl("Skills"), txt(" and press "), lbl("Create Skill"), txt(".")],
      [
        txt("In the "),
        lbl("Create Skill"),
        txt(" dialog, enter "),
        lbl("Name"),
        txt(" (a short identifier, for example "),
        lbl("rag"),
        txt(") and "),
        lbl("Description"),
        txt(" (for example "),
        lbl("RAG queries"),
        txt(")."),
      ],
      [
        txt("Enter the "),
        lbl("Content"),
        txt(" — the markdown instructions the agent will follow."),
      ],
      [
        txt("Press "),
        lbl("Create Skill"),
        txt(
          ". Expected outcome: the skill card appears in the grid; the name and description became the skill's header, and the content is its markdown body.",
        ),
      ],
    ),

    sub("View and edit a skill"),
    steps(
      [
        txt("Open "),
        lbl("Skills"),
        txt(" and press "),
        lbl("Configure"),
        txt(
          " on the skill's card. A dialog titled with the skill's path opens and shows the name, description and rendered markdown body.",
        ),
      ],
      [
        txt("The description says it directly: use "),
        lbl("Edit"),
        txt(" to modify or "),
        lbl("Export"),
        txt(" to download the markdown."),
      ],
      [
        txt("Press "),
        lbl("Edit"),
        txt(" and update "),
        lbl("Name"),
        txt(", "),
        lbl("Description"),
        txt(" and "),
        lbl("Content"),
        txt(
          ". Saving a renamed skill applies the new name to future agent references — agents that were attached under the old name must be re-pointed (see ",
        ),
        docLink("/documentation/agents", "Agents"),
        txt(")."),
      ],
      [
        txt("Press "),
        lbl("Save Changes"),
        txt(
          ". Expected outcome: the toast confirms the skill was saved and the dialog switches back to reading mode.",
        ),
      ],
    ),
    warning(
      txt(
        "Renaming a skill changes the name an agent refers to. Renaming is safe for future use, but re-open each agent that used the skill and re-select it if the attachment list no longer shows it.",
      ),
    ),

    sub("Export a skill"),
    steps(
      [txt("Press "), lbl("Configure"), txt(" on the card, then press "), lbl("Export"), txt(".")],
      [
        txt("Expected outcome: a markdown file whose name matches the skill (for example "),
        lbl("SKILL.md"),
        txt(") is downloaded with the name, description and body as stored."),
      ],
    ),

    sub("Delete a skill"),
    steps(
      [
        txt("In the skill dialog press "),
        lbl("Delete"),
        txt(" — it changes to "),
        lbl("Confirm Delete?"),
        txt(" as a two-step confirmation."),
      ],
      [
        txt("Press "),
        lbl("Confirm Delete?"),
        txt(" to remove the skill. The toast confirms the deletion and the dialog closes."),
      ],
    ),
    warning(
      txt("Deleting a skill does not warn you which agents referenced it, so check "),
      docLink("/documentation/agents", "Agents"),
      txt(" and re-point any agent that relied on it before deleting."),
    ),

    sub("Practical example"),
    example([
      "Name        : report-format",
      "Description : Weekly report structure and tone",
      "Content     : (markdown)",
      "  # Weekly report",
      "  1. Start with a one-paragraph summary in plain language.",
      "  2. List incidents with dates and outcomes.",
      "  3. End with the three biggest risks for next week.",
      "",
      "Use: attach to any agent that writes weekly reports.",
    ]),

    sub("Selecting a skill for an agent"),
    para(
      txt("In the agent form, the "),
      lbl("Memory & Skills"),
      txt(
        " section lists the skills the agent may use. Pick the skills whose procedures this agent should follow; leave the rest unselected so the agent does not follow unrelated rules.",
      ),
    ),

    sub("Common problems"),
    bullets(
      [
        txt("The dialog shows "),
        lbl("Failed to load skill: …"),
        txt(
          " — the underlying file could not be read; close and retry, or recreate the skill if it stays broken.",
        ),
      ],
      [
        txt(
          "An agent ignores new skill wording — the agent still references the previous state of the skill list; re-open its configuration, remove and re-add the skill, and save.",
        ),
      ],
      [
        txt(
          "Two skills with overlapping names confuse agents — keep names unique and descriptive; the count badge ",
        ),
        lbl("N skills"),
        txt(" at the top of the page helps to notice surprises after a rename."),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/prompts", text: "Prompts" },
      { to: "/documentation/memories", text: "Memories" },
    ),
  ],
};

export default skills;
