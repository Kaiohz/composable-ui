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
 * DOC-11 — MCP Registry. Built-in one-click registrations versus manually
 * added remote servers, the form fields, validation and failure guidance.
 */
const mcpRegistry: DocChapter = {
  doc: "DOC-11",
  slug: "mcp-registry",
  navLabel: "MCP Registry",
  title: "MCP Registry",
  blocks: [
    para(
      txt(
        "MCP servers give agents access to external tools and capabilities — for example file handling or other services your organization runs. You register a server once in the registry, with a short name; agents then reference it by that name in their configuration (see ",
      ),
      docLink("/documentation/agents", "Agents"),
      txt(
        "). The page states the essentials up front: each entry stores the endpoint URL and credentials (kept encrypted) so agents can reference it by name.",
      ),
    ),
    warning(
      txt(
        "Never record real credentials in examples, tickets or screenshots. Wherever you see a key field such as ",
      ),
      lbl("Auth Token"),
      txt(", an example value such as "),
      lbl("YOUR_API_KEY"),
      txt(
        " is a stand-in — type your own credential directly into the form instead. Saved secrets are protected and shown only to you, on demand.",
      ),
    ),

    sub("Built-in servers"),
    para(
      txt("The "),
      lbl("Built-in MCP servers"),
      txt(" section lists servers provided by your deployment (each with a "),
      lbl("built-in"),
      txt(" badge). They can be registered in one click: press "),
      lbl("Register"),
      txt(
        " and the create dialog opens already filled with the server's name and address, so you only press ",
      ),
      lbl("Create"),
      txt("."),
    ),

    sub("Add a server manually"),
    steps(
      [
        txt("Press "),
        lbl("Add MCP Server"),
        txt(" (or the dashed "),
        lbl("New MCP Server"),
        txt(" card). The "),
        lbl("Create MCP Server"),
        txt(" dialog notes that secrets are stored encrypted and revealed only on demand."),
      ],
      [
        txt("Choose the "),
        lbl("Type"),
        txt(": "),
        lbl("External"),
        txt(" for a normal remote MCP server, or "),
        lbl("OpenAPI"),
        txt(" to mount one from an OpenAPI description."),
      ],
      [
        txt("For "),
        lbl("External"),
        txt(", enter the "),
        lbl("Name"),
        txt(" (a short handle such as "),
        lbl("weather"),
        txt(") and the server's "),
        lbl("URL"),
        txt("."),
      ],
      [
        txt("For "),
        lbl("OpenAPI"),
        txt(", enter the "),
        lbl("Name"),
        txt(" and the "),
        lbl("OpenAPI URL"),
        txt(" pointing at the description file."),
      ],
      [
        txt("Use "),
        lbl("Headers"),
        txt(" (name/value pairs) for required HTTP headers, "),
        lbl("Env"),
        txt(" for values the server requires, and "),
        lbl("Auth Token"),
        txt(" for the credential when the server asks for one. OpenAPI entries do not use these."),
      ],
      [
        txt("Press "),
        lbl("Test connection"),
        txt(" before saving. A green result reports the number of tools found, such as "),
        lbl("✓ 5 tools"),
        txt(", and a red row prints the connection error."),
      ],
      [
        txt("Press "),
        lbl("Create"),
        txt(
          ". Expected outcome: the toast confirms the server was created and a card appears in the grid.",
        ),
      ],
    ),

    sub("Validate, inspect, edit or delete a server"),
    bullets(
      [
        lbl("Test connection"),
        txt(
          " in the dialog re-checks the endpoint and reports the tool count or the exact connection error.",
        ),
      ],
      [
        txt("The card lists the server's name, transport and creation details; press "),
        lbl("Edit"),
        txt(" to open "),
        lbl("Edit MCP Server"),
        txt(" — the "),
        lbl("Type"),
        txt(" and name are fixed for an existing entry."),
      ],
      [
        txt("Opening "),
        lbl("Edit"),
        txt(
          " reveals the stored values on demand; leave a secret field empty and save if you only changed other fields.",
        ),
      ],
      [
        txt("Pressing "),
        lbl("Delete"),
        txt(
          " on a card removes the registration (the toast reports it). Agents that reference the name must be re-pointed afterwards — see ",
        ),
        docLink("/documentation/agents", "Agents"),
        txt("."),
      ],
    ),

    sub("Practical example"),
    example([
      "Type        : External",
      "Name        : weather",
      "URL         : https://mcp.example.com/mcp",
      "Headers     : (none)",
      "Env         : (none)",
      "Auth Token  : YOUR_API_KEY      ← stand-in; type your own value",
      "Test connection → ✓ 5 tools",
      'Create → the "weather" server is registered',
      'Then: in Agents → MCP Servers, add "weather" to an agent.',
    ]),

    sub("Common problems"),
    bullets(
      [
        lbl("Test connection"),
        txt(
          " fails with a red error — check the URL, required headers and token; if a corporate network blocks the address, ask for access. The error text is the server's response and is the best clue for the next step.",
        ),
      ],
      [
        txt(
          "Saving fails although the test worked — the name may already exist or a required field is empty; the toast names the exact problem.",
        ),
      ],
      [
        txt("An agent has no tools and answers without tool use — its "),
        lbl("MCP Servers"),
        txt(" list in the agent form is empty or the referenced server was deleted; fix it in "),
        docLink("/documentation/agents", "Agents"),
        txt("."),
      ],
      [
        txt(
          "A saved secret seems lost when reopening the form — secrets are revealed only on demand; keep fields empty to keep the stored values.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/orchestration-and-chat", text: "Orchestration and Chat" },
    ),
  ],
};

export default mcpRegistry;
