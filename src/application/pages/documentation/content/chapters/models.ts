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
 * DOC-05 — Models. The metadata-only model catalog and how it differs from
 * the LLM credentials saved in Settings.
 */
const models: DocChapter = {
  doc: "DOC-05",
  slug: "models",
  navLabel: "Models",
  title: "Models",
  blocks: [
    para(
      txt(
        "The Models page is a reusable catalog of model configurations. Each entry is display metadata: a name you recognize, the provider, the provider's model identifier, and an optional base URL. Agents pick a catalog entry instead of typing raw model strings, which keeps provider details in one place.",
      ),
    ),

    sub("Catalog entries and credentials are different things"),
    warning(
      txt(
        'Model entries never store API keys or credentials — the dialog says "Model metadata only — no API keys or credentials are stored with models". The key that actually authorizes requests lives in your personal ',
      ),
      lbl("LLM Provider"),
      txt(" card in "),
      docLink("/settings", "Settings"),
      txt(" (see "),
      docLink("/documentation/settings", "Settings and Account"),
      txt(
        "). Changing a model entry never changes who pays for it; changing your LLM settings does.",
      ),
    ),

    sub("Create a model entry"),
    steps(
      [
        txt("Open "),
        lbl("Models"),
        txt(" and press "),
        lbl("New Model"),
        txt(". The dashed tile in the grid opens the same dialog."),
      ],
      [
        txt("In the "),
        lbl("New Model"),
        txt(" dialog, fill "),
        lbl("Name"),
        txt(" (readable, for example "),
        lbl("Fast Haiku"),
        txt("), "),
        lbl("Provider"),
        txt(" (for example "),
        lbl("anthropic"),
        txt("), "),
        lbl("Provider model"),
        txt(" (the provider's own identifier, for example "),
        lbl("anthropic/claude-haiku-4.5"),
        txt("), and optionally "),
        lbl("Base URL"),
        txt(" for a provider reachable at a custom address."),
      ],
      [
        txt("Press "),
        lbl("Create"),
        txt(
          ". Expected outcome: the card appears in the grid showing the provider badge (for example ",
        ),
        lbl("anthropic"),
        txt("), the provider model and the base URL when set."),
      ],
    ),

    sub("Edit a model entry"),
    para(
      txt("Press "),
      lbl("Edit"),
      txt(" on the card to open "),
      lbl("Edit Model"),
      txt(". Any field may be corrected; the existing "),
      lbl("Base URL"),
      txt(" is preserved unless you explicitly clear it. Press "),
      lbl("Save"),
      txt(" and the card reflects the change immediately."),
    ),

    sub("Delete a model entry"),
    steps(
      [
        txt("Press "),
        lbl("Delete"),
        txt(" on the card — the first press changes it to "),
        lbl("Confirm Delete?"),
        txt("."),
      ],
      [
        txt("Press "),
        lbl("Confirm Delete?"),
        txt(" to remove the entry. The toast confirms "),
        lbl('Model "name" deleted'),
        txt("."),
      ],
    ),
    warning(
      txt(
        'An entry used by one or more agents cannot be deleted. A red message such as "Model is in use by one or more agents" appears next to the affected card and the page keeps its state. Safe next step: open ',
      ),
      docLink("/documentation/agents", "Agents"),
      txt(
        ", search for agents whose model is this entry, re-point them to another entry, then delete afterwards.",
      ),
    ),

    sub("Practical example"),
    example([
      "Name            : Fast Haiku",
      "Provider        : anthropic",
      "Provider model  : anthropic/claude-haiku-4.5",
      "Base URL        : (empty — use the provider default)",
      "Used by         : release-notes-writer, daily-digest",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt(
          "An agent shows a raw identifier instead of a name — its catalog reference can no longer be resolved (the entry was deleted or renamed); re-point the agent in ",
        ),
        docLink("/documentation/agents", "Agents"),
        txt("."),
      ],
      [
        txt("Requests fail although the entry looks right — verify the "),
        lbl("LLM Provider"),
        txt(" card in "),
        docLink("/settings", "Settings"),
        txt("; the entry carries no key by design."),
      ],
      [
        txt(
          "Deletion reports an in-use conflict — re-point dependent agents first (see the warning above).",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/settings", text: "Settings and Account" },
    ),
  ],
};

export default models;
