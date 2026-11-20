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
 * DOC-10 — RAG Storage. Browse/Query tabs, workspace directory, uploads,
 * indexing and querying, and the recursive-deletion warning.
 */
const ragStorage: DocChapter = {
  doc: "DOC-10",
  slug: "rag-storage",
  navLabel: "RAG Storage",
  title: "RAG Storage",
  blocks: [
    para(
      txt(
        "RAG Storage is a searchable knowledge base. You upload documents into folders, then ask questions in the Query tab so answers are drawn from your own files. The page has two tabs: ",
      ),
      lbl("Browse"),
      txt(" manages folders, files and uploads, and "),
      lbl("Query"),
      txt(" searches the indexed content."),
    ),

    sub("Browse your storage"),
    bullets(
      [lbl("New Folder"), txt(" — creates a folder at your current location.")],
      [lbl("Upload"), txt(" — opens the file picker; select one or several files at once.")],
      [
        txt(
          "Drag-and-drop — drag files, several files, or a whole folder onto the file list; a folder keeps its internal structure.",
        ),
      ],
      [
        txt(
          "The breadcrumb navigation at the top shows the current path; select a level to move back up.",
        ),
      ],
      [
        txt("Select a file's row action to inspect it: a "),
        lbl("File Content"),
        txt(" dialog shows the extracted text and its metadata (for example page count)."),
      ],
    ),

    sub("Supported file types"),
    para(
      txt("Uploads accept documents and images such as "),
      lbl(".pdf"),
      txt(", "),
      lbl(".doc"),
      txt(", "),
      lbl(".docx"),
      txt(", "),
      lbl(".txt"),
      txt(", "),
      lbl(".md"),
      txt(", "),
      lbl(".csv"),
      txt(", "),
      lbl(".xlsx"),
      txt(", "),
      lbl(".xls"),
      txt(", "),
      lbl(".ppt"),
      txt(", "),
      lbl(".pptx"),
      txt(", "),
      lbl(".png"),
      txt(", "),
      lbl(".jpg"),
      txt(" and similar formats. Other extensions are refused."),
    ),

    sub("Upload files"),
    steps(
      [txt("Use the breadcrumb to open the folder where the files should live.")],
      [
        txt("Press "),
        lbl("Upload"),
        txt(
          " — or drag the files directly onto the file list. A drop overlay confirms the drop target while dragging.",
        ),
      ],
      [
        txt("Expected outcome: a toast reports how many files uploaded, for example "),
        lbl("3 files uploaded successfully"),
        txt(", and the list refreshes."),
      ],
    ),

    sub("Understand partial upload failures"),
    para(
      txt(
        "When an upload of several files only partly succeeds, the toast reports the exact split — for example ",
      ),
      lbl("5 uploaded, 2 failed"),
      txt(
        " — so you know which state the folder is in. Open the file list and re-upload the missing files; files that already uploaded successfully are not lost.",
      ),
    ),

    sub("Index files so they can be searched"),
    para(
      txt(
        "Before a file's content can be found by queries, it must be indexed. Indexing happens from the ",
      ),
      lbl("Browse"),
      txt(" tab: every file and folder row carries an "),
      lbl("Index"),
      txt(" action."),
    ),
    para(
      txt("The working directory indexing uses can be set with the "),
      lbl("Workspace (working directory)"),
      txt(" selector — that selector lives on the "),
      lbl("Query"),
      txt(" tab in the same bottom row as the "),
      lbl("Search"),
      txt(" button — immediately to its left, with the "),
      lbl("Advanced Options"),
      txt(
        " disclosure above that row — and its value is reused by indexing too. If you index without choosing one, the run still starts: it covers the folder you are currently browsing, and the default workspace (",
      ),
      lbl("default-composable"),
      txt(
        ") when you are at the top level. You are never blocked — you simply do not control which space the index covers, which is why selecting the workspace first is the recommended sequence.",
      ),
    ),
    steps(
      [
        txt("Open the "),
        lbl("Browse"),
        txt(" tab and open the folder that contains the documents."),
      ],
      [
        txt("Optional but recommended: open the "),
        lbl("Query"),
        txt(" tab and choose the space the index should cover in the "),
        lbl("Workspace (working directory)"),
        txt(" selector — the control in the same bottom row as "),
        lbl("Search"),
        txt(", immediately to its left — then return to the "),
        lbl("Browse"),
        txt(
          " tab. Leaving it empty indexes the folder you are currently browsing (or the default workspace at the top level).",
        ),
      ],
      [
        txt("Press "),
        lbl("Index"),
        txt(
          " on a single file's row — or index the whole folder — to make its content searchable.",
        ),
      ],
      [
        txt(
          "Expected outcome: the request is accepted; the Query tab can now find passages from the indexed content.",
        ),
      ],
    ),

    sub("Ask a question"),
    steps(
      [txt("Open the "), lbl("Query"), txt(" tab.")],
      [
        txt("Type the question in the search box (the example caption is "),
        lbl("Ask a question about your documents..."),
        txt(")."),
      ],
      [
        txt("Check the query options under the "),
        lbl("Advanced Options"),
        txt(" disclosure: "),
        lbl("Mode"),
        txt(" ("),
        lbl("Vector"),
        txt(" or "),
        lbl("Hybrid"),
        txt(" — how strictly the search matches the meaning of your question), "),
        lbl("Top K"),
        txt(" (how many passages are returned), "),
        lbl("Variations"),
        txt(" (how many reformulations of your question the search tries), the "),
        lbl("Relevance Threshold"),
        txt(" and "),
        lbl("Vector Distance"),
        txt(" cutoffs, and "),
        lbl("LLM Judge"),
        txt(" ("),
        lbl("Enabled"),
        txt(" lets a secondary model re-rank the results)."),
      ],
      [
        txt("Confirm the working directory in the "),
        lbl("Workspace (working directory)"),
        txt(" selector — the control in the bottom row, immediately to the left of "),
        lbl("Search"),
        txt(" — then press "),
        lbl("Search"),
        txt("."),
      ],
      [
        txt(
          "Expected outcome: the results pane lists matching passages from the indexed files, each with a copy control; ",
        ),
        lbl("Run a query to search your indexed documents"),
        txt(" appears until your first search."),
      ],
    ),

    sub("Delete files and folders"),
    steps(
      [
        txt("In the "),
        lbl("Browse"),
        txt(" tab, use the delete action on a file's or folder's row."),
      ],
      [
        txt("A "),
        lbl("Delete <name>"),
        txt(" dialog opens, warns that the action cannot be undone, and offers "),
        lbl("Cancel"),
        txt(" and "),
        lbl("Delete"),
        txt("."),
      ],
      [
        txt("Press "),
        lbl("Delete"),
        txt(" to confirm; the toast reports "),
        lbl("File deleted"),
        txt(" or "),
        lbl("Folder deleted"),
        txt("."),
      ],
    ),
    warning(
      txt(
        "Folder deletion is recursive: deleting a folder removes the folder and every file inside it, including nested subfolders, together with their indexed content. Delete files individually when you only want to remove specific documents.",
      ),
    ),

    sub("Example workflow"),
    example([
      '1. Browse tab → New Folder → "policies"',
      "2. Upload → choose all PDFs of the policy pack        (toast: 4 files",
      "   uploaded successfully)",
      '3. Query tab → Workspace → "policies"   (sets the working directory',
      "   used by indexing and querying)",
      "4. Browse tab → Index → the folder is indexed for search",
      '5. Query tab → "Travel reimbursement thresholds?" → Search',
      "Outcome: passages from the policy PDFs are listed with copy controls.",
    ]),

    sub("Common problems"),
    bullets(
      [
        txt(
          "A search returns nothing and no error appears — no working directory is selected, so ",
        ),
        lbl("Search"),
        txt(" stays inactive. On the "),
        lbl("Query"),
        txt(" tab, choose a workspace in the "),
        lbl("Workspace (working directory)"),
        txt(" selector — the control immediately to the left of "),
        lbl("Search"),
        txt(
          " in the bottom row, or follow the workspace-and-index sequence above with the folder you indexed.",
        ),
      ],
      [
        txt(
          "A query finds nothing — confirm the working directory matches the folder you indexed, and that the files finished uploading.",
        ),
      ],
      [
        txt(
          "A file upload failed while others succeeded — see the partial-failure note above, then re-upload only the missing files.",
        ),
      ],
      [
        txt(
          "A deleted folder still affects searches — indexed content of deleted items is removed during deletion; re-index the folder if it was recreated.",
        ),
      ],
    ),

    links(
      "Related chapters",
      { to: "/documentation/agents", text: "Agents" },
      { to: "/documentation/crons", text: "Crons" },
      { to: "/documentation/mcp-registry", text: "MCP Registry" },
    ),
  ],
};

export default ragStorage;
