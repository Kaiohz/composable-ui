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
 * DOC-05 — Models. The identity-only model catalog (name + provider model
 * identifier) and how the provider connection differs from — and lives
 * separately in — the LLM Settings.
 */
const models: DocChapter = {
  doc: "DOC-05",
  slug: "models",
  navLabel: "Models",
  title: "Models",
  blocks: [
    para(
      txt(
        "The Models page is a reusable catalog of model identities. Each entry is display metadata: a name you recognize and the provider's model identifier to execute. Agents pick a catalog entry instead of typing raw model strings. How to reach the provider — provider, endpoint URL and API key — is configured once in Settings, not per model.",
      ),
    ),

    sub("Catalog entries and credentials are different things"),
    warning(
      txt(
        'Model entries never store API keys or credentials — the dialog says "Model identity only — no API keys or credentials are stored with models". The connection that actually authorizes requests — the provider, the endpoint URL and the API key — lives in your personal ',
      ),
      lbl("LLM Provider"),
      txt(" card in "),
      docLink("/settings", "Settings"),
      txt(" (see "),
      docLink("/documentation/settings", "Settings and Account"),
      txt(
        "). Changing a model entry never changes who pays for it or where requests are sent; changing your LLM settings does.",
      ),
    ),

    sub("Create a model entry"),
    steps(
      [
        txt("Open "),
        lbl("Models"),
        txt(" and press "),
        lbl("New Model"),
        txt(" (or "),
        lbl("Create Model"),
        txt(" when the catalog is still empty)."),
      ],
      [
        txt("In the "),
        lbl("New Model"),
        txt(" dialog, fill the two fields: "),
        lbl("Name"),
        txt(" (readable, for example "),
        lbl("Fast Haiku"),
        txt(") and "),
        lbl("Provider model"),
        txt(" (the provider's own identifier, for example "),
        lbl("anthropic/claude-haiku-4.5"),
        txt("). Both are required."),
      ],
      [
        txt("Press "),
        lbl("Create"),
        txt(
          ". Expected outcome: the card appears in the grid showing the name and the provider model identifier. No provider, URL or API key is shown there — the connection is a Settings setting.",
        ),
      ],
    ),

    sub("Edit a model entry"),
    para(
      txt("Press "),
      lbl("Edit"),
      txt(" on the card to open "),
      lbl("Edit Model"),
      txt(
        ". Either field may be corrected; agents referencing the entry pick up the change on their next invocation. Press ",
      ),
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
      "Provider model  : anthropic/claude-haiku-4.5",
      "Used by         : release-notes-writer, daily-digest",
      "Connection      : from your LLM Settings (provider, URL, key)",
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
        txt(
          "; model entries carry no provider, endpoint URL or key by design — the connection is resolved from your settings.",
        ),
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
