import {
  bullets,
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
 * DOC-12 — Settings and Account. Appearance, LLM provider credentials,
 * personal API keys, reset semantics, missing-LLM-configuration recovery
 * and sign-out.
 */
const settings: DocChapter = {
  doc: "DOC-12",
  slug: "settings",
  navLabel: "Settings",
  title: "Settings and Account",
  blocks: [
    para(
      txt(
        "The Settings page holds everything about you and your console: how it looks (Theme, Typography, Reset) and your personal credentials (LLM Provider, API Keys). The header describes the split: console appearance and chat readability on one side, per-user credentials on the other. A ",
      ),
      lbl("Sign out"),
      txt(" button sits in the page header."),
    ),

    sub("Appearance: Theme and Typography"),
    bullets(
      [
        lbl("Dark mode"),
        txt(
          " — the switch at the bottom of the Theme card toggles between the dark default and the light alternative.",
        ),
      ],
      [
        lbl("Accent color"),
        txt(" — a hue slider plus an exact value box update the accent used across the console."),
      ],
      [
        lbl("Surface shade"),
        txt(" — pick the surface tone from the dropdown (Ink blue, Deep violet or Slate)."),
      ],
      [
        lbl("Font size"),
        txt(" — a slider from 10px to 18px that drives text everywhere, including messages."),
      ],
      [
        lbl("Font family"),
        txt(" — choose among the default "),
        lbl("Press Start 2P (default)"),
        txt(", "),
        lbl("Monospace"),
        txt(", "),
        lbl("Mono"),
        txt(" and "),
        lbl("Georgia"),
        txt("."),
      ],
    ),
    para(
      txt("Reset semantics: the "),
      lbl("Reset"),
      txt(" card's "),
      lbl("Reset to Defaults"),
      txt(
        " button restores the appearance settings only. The on-screen note states it plainly: backend-stored LLM settings and API keys are not touched.",
      ),
    ),

    sub("LLM provider credentials"),
    para(
      txt("The "),
      lbl("LLM Provider"),
      txt(
        " card authorizes every run. Without it, features that call a model show a clear error with a link straight to this page — save your provider settings to get everything working again.",
      ),
    ),
    steps(
      [txt("Choose the "), lbl("Provider"), txt(" from the dropdown.")],
      [
        txt("Fill the "),
        lbl("Base URL"),
        txt(
          " for a custom or self-hosted provider; the provider's standard address is used otherwise.",
        ),
      ],
      [
        txt("Paste your "),
        lbl("API Key"),
        txt(
          ' into the password field. A saved key is never shown in full: the card notes "Stored encrypted on the server. Leave blank to keep the existing key." and displays a masked current key line such as ',
        ),
        lbl("Current key: sk-***1234"),
        txt(" when one exists."),
      ],
      [
        txt("Press "),
        lbl("Save LLM settings"),
        txt(". Expected outcome: the toast confirms the settings were saved."),
      ],
      [
        txt("To remove the credentials entirely, press "),
        lbl("Delete LLM settings"),
        txt(
          ", then save a new provider when you are ready to reconnect. Features that need a model answer stop working while the card is empty — every chat or cron run then fails with the missing-LLM-configuration error until you save again.",
        ),
      ],
    ),
    warning(
      txt(
        "Treat your API key like a password. Do not paste it into chats, prompts, or any example text — an example field should always read ",
      ),
      lbl("YOUR_API_KEY"),
      txt(" until you type the real one into the actual form."),
    ),

    sub("Personal API keys"),
    para(
      txt(
        "API Keys are personal access tokens for API automation — programs that call the API on your behalf use such a key instead of your browser session. The card lists existing keys with their prefixes, creation and last-used times, and a status badge ",
      ),
      lbl("Active"),
      txt(" or "),
      lbl("Revoked"),
      txt("."),
    ),
    steps(
      [
        txt("Enter a "),
        lbl("New API key name"),
        txt(" (for example "),
        lbl("ci-pipeline"),
        txt(") and press "),
        lbl("Create key"),
        txt("."),
      ],
      [
        txt("A dialog titled "),
        lbl("API key created"),
        txt(
          ' shows the full value once: "Copy the key below now — you won\'t see it again. Store it securely." Press ',
        ),
        lbl("Copy key"),
        txt(", store the value in a safe place, and press "),
        lbl("Done"),
        txt("."),
      ],
      [
        txt("Later, from anywhere in the list, press "),
        lbl("Revoke"),
        txt(
          " on a key you no longer trust or use; a dialog warns that the action cannot be undone and any client using the key loses access immediately. Press ",
        ),
        lbl("Confirm revoke"),
        txt(" to finish."),
      ],
    ),
    warning(
      txt(
        "A new key's full value is displayed exactly once — closing the dialog is final. If you lose it, revoke the key and create a new one.",
      ),
    ),

    sub("Sign out"),
    steps(
      [
        txt("Open "),
        lbl("Settings"),
        txt(" and press "),
        lbl("Sign out"),
        txt(" in the page header."),
      ],
      [
        txt(
          "Expected outcome: your session is closed by the platform's sign-in service (the same mechanism that asked you to sign in at the start) and the console keeps no local session state.",
        ),
      ],
      [
        txt(
          "To use the console again, open the console address and sign in again; your resources, agents and schedules are untouched.",
        ),
      ],
    ),

    sub("Example: connecting a new provider"),
    example([
      "Provider   : openai",
      "Base URL   : (empty — standard provider address)",
      "API Key    : YOUR_API_KEY      ← stand-in; type your own value",
      "Save LLM settings → toast: LLM settings saved",
      "Effect     : conversations and crons work for your account again.",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt(
          "A message or run fails and mentions missing LLM configuration — open this page (the error offers a direct link), fill the ",
        ),
        lbl("LLM Provider"),
        txt(" card and press "),
        lbl("Save LLM settings"),
        txt("."),
      ],
      [
        txt(
          "The API key field looks empty although you saved one — the key is stored encrypted and intentionally never displayed in full; only the masked line appears.",
        ),
      ],
      [
        txt(
          "A program stopped working after you revoked its key — revoke was intended for exactly that; create a fresh key and update the program's configuration.",
        ),
      ],
      [
        txt(
          "The theme reverts unexpectedly after Reset to Defaults — that button re-applies the default appearance on purpose; choose your colors again, it did not touch credentials.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/getting-started", text: "Getting Started" },
      { to: "/documentation/models", text: "Models" },
      { to: "/documentation/traces", text: "Traces" },
    ),
  ],
};

export default settings;
