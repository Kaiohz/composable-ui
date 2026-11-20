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
 * DOC-04 — Prompts. The local prompt registry: create, edit metadata,
 * immutable version history, read a version, add a version, latest-versus-
 * pinned selection and the deletion rules.
 */
const prompts: DocChapter = {
  doc: "DOC-04",
  slug: "prompts",
  navLabel: "Prompts",
  title: "Prompts",
  blocks: [
    para(
      txt(
        "Prompts are reusable instruction texts. You write the wording once, keep its version history, and let any agent reference it. This is the right place for system prompts you would otherwise repeat inside many agents — changing the wording later means editing one entry instead of rewiring several agents.",
      ),
    ),

    sub("How an agent references a prompt"),
    para(
      txt("An agent picks a prompt through its "),
      lbl("Prompt Source"),
      txt(" setting (see "),
      docLink("/documentation/agents", "Agents"),
      txt("): it uses the "),
      lbl("Latest"),
      txt(" version — every saved change reaches the agent on the next run — or a "),
      lbl("Pinned"),
      txt(" version number, which stays fixed until the agent's configuration is edited again."),
    ),

    sub("Create a prompt"),
    steps(
      [txt("Open "), lbl("Prompts"), txt(" and press "), lbl("New Prompt"), txt(".")],
      [
        txt("Enter the "),
        lbl("Name"),
        txt(" (for example "),
        lbl("release-notes"),
        txt(") and an optional "),
        lbl("Description"),
        txt(" that explains what the prompt is for."),
      ],
      [
        txt("Enter the "),
        lbl("Content"),
        txt(
          " — the actual instruction text sent to agents. It is stored verbatim, including whitespace, and becomes version 1.",
        ),
      ],
      [
        txt("Press "),
        lbl("Create"),
        txt(". Expected outcome: the toast confirms "),
        lbl('Prompt "name" created'),
        txt(" and a card appears in the list with "),
        lbl("Version 1"),
        txt(" shown."),
      ],
    ),

    sub("Edit name and description"),
    para(
      txt("Press "),
      lbl("Edit"),
      txt(" on the card. The dialog title is "),
      lbl("Edit Prompt"),
      txt(
        " and its description reminds you that only display metadata is editable here — content changes require a new version from the version history. Change ",
      ),
      lbl("Name"),
      txt(" and/or "),
      lbl("Description"),
      txt(" and press "),
      lbl("Save"),
      txt(". The next toast confirms the update."),
    ),

    sub("Read the version history and a version's content"),
    steps(
      [
        txt("Press "),
        lbl("Version History"),
        txt(" on the card. A dialog titled "),
        lbl("name — Version history"),
        txt(
          " opens and states that versions are immutable: existing content cannot be edited or deleted.",
        ),
      ],
      [
        txt("Select a version chip such as "),
        lbl("v1"),
        txt(", "),
        lbl("v2"),
        txt(
          " — the newest version is preselected. Its date appears above the content box, and the verbatim content of that version loads beneath it.",
        ),
      ],
      [
        txt(
          "Expected outcome: you can read exactly what an agent receives for the version you selected. If the content fails to load, a ",
        ),
        lbl("Retry"),
        txt(" control appears next to the error."),
      ],
    ),

    sub("Add a new version"),
    steps(
      [txt("Inside the version-history dialog, press "), lbl("New Version"), txt(".")],
      [
        txt("A "),
        lbl("Content"),
        txt(" box appears; enter the replacement wording. It must not be empty."),
      ],
      [
        txt("Press "),
        lbl("Add Version"),
        txt(". Expected outcome: the toast says "),
        lbl("Version N created"),
        txt(", the new version is selected automatically, and the card's "),
        lbl("Version N"),
        txt(" badge updates."),
      ],
      [
        txt(
          "Existing versions stay readable exactly as they were — nothing is overwritten. Agents on ",
        ),
        lbl("Latest"),
        txt(
          " start using version N immediately; agents pinned to an older version keep their wording.",
        ),
      ],
    ),

    sub("Delete a prompt"),
    steps(
      [
        txt("Press "),
        lbl("Delete"),
        txt(
          " on the card (or inside the version-history dialog). The first press changes the label to ",
        ),
        lbl("Confirm Delete?"),
        txt(" as a two-step confirmation."),
      ],
      [
        txt("Press "),
        lbl("Confirm Delete?"),
        txt(" to remove the prompt. The toast confirms "),
        lbl('Prompt "name" deleted'),
        txt("."),
      ],
    ),
    warning(
      txt(
        'A prompt referenced by an agent cannot be deleted. The deletion is blocked with a clear reason such as "Prompt is in use by one or more agents" shown next to the card, the list and open dialogs stay where they are, and your in-progress edits are not lost. Safe next step: open the listed agents (in ',
      ),
      docLink("/documentation/agents", "Agents"),
      txt("), re-point their "),
      lbl("Prompt Source"),
      txt(" to another prompt or an inline text, then delete the unused prompt."),
    ),

    sub("Practical example"),
    example([
      "Name    : release-notes",
      "Content : (version 1)",
      "  Write release notes for the merged tickets of the week.",
      "  Audience: customers. Tone: plain, factual.",
      "",
      "Then    : New Version → version 2 published.",
      "Agents on Latest pick version 2 on the next run;",
      "agents pinned to v1 keep the original wording.",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt("Content cannot be typed when editing — metadata edits never carry content; use "),
        lbl("Version History"),
        txt(" and "),
        lbl("New Version"),
        txt("."),
      ],
      [
        txt(
          "An agent ignores updated wording — the agent is pinned to an old version; switch it to ",
        ),
        lbl("Latest"),
        txt(" or raise its pinned number."),
      ],
      [
        txt(
          "Deleting fails with an in-use message — see the warning above; re-point the agents before deleting.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/skills", text: "Skills" },
      { to: "/documentation/memories", text: "Memories" },
    ),
  ],
};

export default prompts;
