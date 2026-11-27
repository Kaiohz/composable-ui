/**
 * Behavioral tests — ToolResultBlock create_pdf actions + PdfPreviewDialog
 * (spec chat-pdf-attachments REQ-077..091, EC-009/010/014, EDG-011/019).
 *
 * Contract:
 *  - a VALID ``create_pdf`` tool result (name=create_pdf, JSON with a path
 *    under /documents/) renders Preview (Eye icon) + Download actions
 *    (REQ-077/078);
 *  - NOTHING is fetched / rendered before the user clicks Preview
 *    (REQ-079, NFR-003): no store API call, no react-pdf, no worker;
 *  - Preview click opens a dialog (pdf-preview-dialog), fetches the PDF
 *    base64 from the store API, lazy-loads react-pdf and renders the canvas
 *    (REQ-080/081) at one page at a time with bounded navigation
 *    (REQ-083..086);
 *  - Download produces an application/pdf blob named after ``filename``
 *    (REQ-088/089);
 *  - 404 store fetch → readable error state + working close (EC-009);
 *  - other tools / malformed JSON keep the GENERIC rendering with NO pdf
 *    actions (REQ-091 / EC-010 / EDG-011).
 *
 * Mocking boundary: ONLY the outbound store API adapter (external HTTP
 * boundary) and the external react-pdf bundle — internal components run real.
 */
import { screen, configure, within } from "@testing-library/dom";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import ToolResultBlock from "@/application/components/chat/ToolResultBlock";
import { createPdfToolResult } from "../../../fixtures/chatAttachments";

configure({ testIdAttribute: "data-od-id" });

// --- external boundary: the store HTTP API (LangGraph store files) ---------
const { mockGetFile } = vi.hoisted(() => ({
  mockGetFile: vi.fn(),
}));

vi.mock("@/infrastructure/api/store/storeApi", () => ({
  storeApi: {
    getFile: mockGetFile,
    putFile: vi.fn(),
    deleteFile: vi.fn(),
    listFiles: vi.fn(),
    listFilePreviews: vi.fn(),
  },
  extractApiMessage: (e: unknown) => String(e),
}));

// --- external bundle: react-pdf (kept OUT of the main bundle: NFR-002) -----
// The probe also captures the <Document> props ``PdfCanvas`` passes (to test
// the C2 non-suspending contract) and can throw during render (simulating
// the malformed/unloadable-PDF failure the real bundle rethrows).
const { PdfProbe } = vi.hoisted(() => {
  let probeState: { numPages: number } = { numPages: 0 };
  let throwOnRender = false;
  let lastDocumentProps: Record<string, unknown> | null = null;
  return {
    PdfProbe: {
      get state() {
        return probeState;
      },
      get throwOnRender() {
        return throwOnRender;
      },
      set throwOnRender(value: boolean) {
        throwOnRender = value;
      },
      get lastDocumentProps() {
        return lastDocumentProps;
      },
      set lastDocumentProps(value: Record<string, unknown> | null) {
        lastDocumentProps = value;
      },
      set(numPages: number) {
        probeState = { numPages };
      },
      reset() {
        probeState = { numPages: 0 };
        throwOnRender = false;
        lastDocumentProps = null;
      },
    },
  };
});

vi.mock("react-pdf", () => ({
  Document: ({
    file,
    onLoadSuccess,
    children,
    ...rest
  }: {
    file: unknown;
    onLoadSuccess?: (payload: { numPages: number }) => void;
    children?: ReactNode;
  } & Record<string, unknown>) => {
    PdfProbe.lastDocumentProps = rest;
    if (file == null) return null;
    if (PdfProbe.throwOnRender) {
      throw new Error("Simulated malformed PDF render error");
    }
    if (onLoadSuccess && PdfProbe.state.numPages > 0) {
      queueMicrotask(() => onLoadSuccess({ numPages: PdfProbe.state.numPages }));
    }
    return <div data-od-id="pdf-preview-document">{children}</div>;
  },
  Page: ({ pageNumber, loading }: { pageNumber: number; loading?: ReactNode }) => {
    if (loading != null) return <div data-od-id="pdf-page-loading">{loading}</div>;
    return <div data-od-id={`pdf-page-${pageNumber}`}>Page {pageNumber}</div>;
  },
}));

async function expandTool() {
  const toggle = screen.getByRole("button", { name: /toggle result/i });
  const user = userEvent.setup();
  await user.click(toggle);
  return toggle;
}

const VALID_PATH = "/documents/thread-123/00000000-0000-0000-0000-000000000001/rapport.pdf";

describe("ToolResultBlock — create_pdf actions (REQ-077/078)", () => {
  beforeEach(() => {
    mockGetFile.mockReset();
    PdfProbe.reset();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:download-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Preview and Download actions for a valid create_pdf result", async () => {
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    await expandTool();

    expect(screen.getByTestId("pdf-preview-button")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-download-button")).toBeInTheDocument();
  });

  it("does NOT fetch or render anything PDF-related before Preview is clicked (REQ-079)", async () => {
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    // Nothing fetched on mere render (even collapsed):
    expect(mockGetFile).not.toHaveBeenCalled();

    await expandTool(); // expanding the generic tool payload is NOT a preview
    expect(mockGetFile).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pdf-preview-dialog")).not.toBeInTheDocument();

    const previewButton = screen.getByTestId("pdf-preview-button");
    // The preview button is NOT a fetch trigger before the click:
    expect(document.querySelector("canvas")).toBeNull();
    void previewButton;
  });

  it("Preview click opens the dialog, fetches the PDF and lazy-renders react-pdf (REQ-080/081)", async () => {
    mockGetFile.mockResolvedValue({
      path: VALID_PATH,
      content: "JVBERi0xLjcgLi4u",
    });
    PdfProbe.set(3);
    const user = userEvent.setup();
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    await expandTool();
    await user.click(screen.getByTestId("pdf-preview-button"));

    expect(await screen.findByTestId("pdf-preview-dialog")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetFile).toHaveBeenCalledWith(VALID_PATH);
    });
    // react-pdf got lazily rendered INSIDE the dialog.
    expect(await screen.findByTestId("pdf-preview-document")).toBeInTheDocument();
    expect(await screen.findByTestId("pdf-page-1")).toBeInTheDocument();
  });

  it("navigates pages with disabled bounds and a page counter (REQ-083/084/085)", async () => {
    mockGetFile.mockResolvedValue({ path: VALID_PATH, content: "JVBERi0xLjcgLi4u" });
    PdfProbe.set(3);
    const user = userEvent.setup();
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    await expandTool();
    await user.click(screen.getByTestId("pdf-preview-button"));
    await screen.findByTestId("pdf-preview-dialog");
    await screen.findByTestId("pdf-page-1");

    const dialog = screen.getByTestId("pdf-preview-dialog");
    expect(within(dialog).getByText(/page 1 \/ 3/i)).toBeInTheDocument();

    const prev = within(dialog).getByTestId("pdf-preview-previous");
    const next = within(dialog).getByTestId("pdf-preview-next");
    expect(prev).toBeDisabled();

    await user.click(next);
    expect(await within(dialog).findByTestId("pdf-page-2")).toBeInTheDocument();
    expect(prev).toBeEnabled();

    await user.click(next);
    await within(dialog).findByTestId("pdf-page-3");
    expect(within(dialog).getByText(/page 3 \/ 3/i)).toBeInTheDocument();
    expect(next).toBeDisabled();
  });

  it("shows an error state and a working close when the store returns 404 (EC-009)", async () => {
    mockGetFile.mockResolvedValue(null); // storeApi resolves 404 → null
    const user = userEvent.setup();
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    await expandTool();
    await user.click(screen.getByTestId("pdf-preview-button"));

    const dialog = await screen.findByTestId("pdf-preview-dialog");
    expect(within(dialog).getByText(/not found|introuvable|erreur|error|404/i)).toBeInTheDocument();

    const close = within(dialog).getByRole("button", { name: /close/i });
    expect(close).toBeEnabled();
    await user.click(close);
    await waitFor(() => {
      expect(screen.queryByTestId("pdf-preview-dialog")).not.toBeInTheDocument();
    });
  });

  it("Download produces an application/pdf blob named after filename (REQ-088/089)", async () => {
    mockGetFile.mockResolvedValue({ path: VALID_PATH, content: "JVBERi0xLjcgLi4u" });
    const user = userEvent.setup();
    const createElementSpy = vi.spyOn(document, "createElement");

    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);
    await expandTool();
    await user.click(screen.getByTestId("pdf-download-button"));

    await waitFor(() => {
      expect(mockGetFile).toHaveBeenCalledWith(VALID_PATH);
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    const anchor = createElementSpy.mock.results.find((r) => r.value?.tagName === "A")?.value as
      | HTMLAnchorElement
      | undefined;
    expect(anchor).toBeTruthy();
    expect(anchor?.download).toBe("rapport.pdf");
  });

  it("surfaces an explicit toast error when the store fetch fails on Download (EC-014)", async () => {
    mockGetFile.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);
    await expandTool();

    await user.click(screen.getByTestId("pdf-download-button"));

    await waitFor(() => {
      expect(mockGetFile).toHaveBeenCalledTimes(1);
    });
    // An explicit error surface must exist: toast, alert or inline error.
    // NOTE: @testing-library/dom 10 does not support RegExp role queries, so
    // the equivalent literal role is queried here (regex kept in the comment
    // originally: /alert|status/ — ``role="alert"`` also satisfies status).
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
  });
});

describe("ToolResultBlock — generic rendering preserved (REQ-091 / EC-010 / EDG-011)", () => {
  beforeEach(() => {
    mockGetFile.mockReset();
  });

  it("does NOT render pdf actions for other tools", async () => {
    render(<ToolResultBlock name="search" content='{"hits": 12}' source="subagent-a" />);
    await expandTool();
    expect(screen.queryByTestId("pdf-preview-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pdf-download-button")).not.toBeInTheDocument();
    // JSON payloads render pretty-printed (indent 2) — no PDF action button.
    expect(screen.getByText(/"hits": 12/)).toBeInTheDocument();
  });

  it("does NOT render pdf actions for a create_pdf result with malformed JSON (EC-010)", async () => {
    render(<ToolResultBlock name="create_pdf" content="not-json{{" source={null} />);
    await expandTool();
    expect(screen.queryByTestId("pdf-preview-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pdf-download-button")).not.toBeInTheDocument();
  });

  it("does NOT render pdf actions when the path is NOT under /documents/ (EDG-011)", async () => {
    render(
      <ToolResultBlock
        name="create_pdf"
        content={createPdfToolResult({
          path: "/chat_attachments/thread-123/att-1/evil.pdf",
        })}
        source={null}
      />,
    );
    await expandTool();
    expect(screen.queryByTestId("pdf-preview-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pdf-download-button")).not.toBeInTheDocument();
  });
});

describe("ToolResultBlock — PdfCanvas resilience (C2: suspense=false + local boundary)", () => {
  beforeEach(() => {
    mockGetFile.mockReset();
    PdfProbe.reset();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:download-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    PdfProbe.reset();
  });

  it("renders react-pdf with suspense=false so loading/errors stay prop-driven (C2)", async () => {
    mockGetFile.mockResolvedValue({ path: VALID_PATH, content: "JVBERi0xLjcgLi4u" });
    PdfProbe.set(2);
    const user = userEvent.setup();
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    await expandTool();
    // I3: actions are visible even collapsed — Preview does not fetch (REQ-079).
    expect(mockGetFile).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("pdf-preview-button"));

    await screen.findByTestId("pdf-preview-dialog");
    await screen.findByTestId("pdf-page-1");

    // C2 contract: the non-suspending mode is requested from react-pdf, so a
    // load failure/error never bubbles to the app-level boundary.
    expect(PdfProbe.lastDocumentProps).toBeTruthy();
    expect(PdfProbe.lastDocumentProps?.suspense).toBe(false);
    // The dialog remains mounted (the app shell did not swap to a fallback).
    expect(screen.getByTestId("pdf-preview-dialog")).toBeInTheDocument();
  });

  it("a malformed-PDF render failure is caught by the LOCAL boundary and never blanks the app (C2)", async () => {
    mockGetFile.mockResolvedValue({ path: VALID_PATH, content: "JVBERi0xLjcgLi4u" });
    PdfProbe.set(2);
    const user = userEvent.setup();
    render(<ToolResultBlock name="create_pdf" content={createPdfToolResult()} source={null} />);

    await expandTool();
    await user.click(screen.getByTestId("pdf-preview-button"));
    await screen.findByTestId("pdf-page-1");

    // Simulate the real react-pdf rethrow for a malformed payload, triggered
    // on the next <Document> render (page navigation re-renders it).
    PdfProbe.throwOnRender = true;
    const dialog = screen.getByTestId("pdf-preview-dialog");
    await user.click(within(dialog).getByTestId("pdf-preview-next"));

    // The failure degrades to the in-dialog alert…
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    // …the application tree around the dialog is intact (no root unmount)…
    expect(screen.getByTestId("tool-result-block")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-preview-button")).toBeInTheDocument();
    // …and closing the dialog still works.
    await user.click(within(dialog).getByRole("button", { name: /close/i }));
    await waitFor(() => {
      expect(screen.queryByTestId("pdf-preview-dialog")).not.toBeInTheDocument();
    });
  });
});
