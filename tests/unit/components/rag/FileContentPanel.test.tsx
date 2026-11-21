/**
 * Spec: unify-cards-modals.md — MODAL-002/005/008 (BUG-003).
 *
 * The RAG "File Content" dialog is a structured `overflow-hidden` shell, so
 * its body must be the bounded scroll region itself. The previous Radix
 * ScrollArea root could clip: inside the max-height shell the viewport's
 * percentage height was indefinite and grew to content height, leaving the
 * root to clip the overflow (BUG-003). The body must be a plain
 * `min-h-0 flex-1 overflow-y-auto overscroll-contain` element — not an
 * unbounded Radix viewport.
 *
 * The file also keeps the pre-existing behavioural coverage (close →
 * `onClose`, legacy header/row tables) — restored alongside the scroll
 * contract rather than replaced by it (review C-1).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import FileContentPanel from "@/application/components/rag/FileContentPanel";

const LONG_CONTENT = "A".repeat(40_000);

function renderPanel(content: string = LONG_CONTENT) {
  return render(
    <FileContentPanel
      content={content}
      metadata={{ format_type: "application/pdf", mime_type: "application/pdf" }}
      tables={null}
      onClose={vi.fn()}
    />,
  );
}

describe("FileContentPanel body scroll contract (BUG-003)", () => {
  it("keeps the overflow-hidden shell and gives the body the scroll region", () => {
    renderPanel();

    const dialog = screen.getByRole("dialog");
    expect(dialog.classList.contains("overflow-hidden")).toBe(true);

    const body = document.querySelector("div.overflow-y-auto");
    expect(body).not.toBeNull();
    for (const token of ["min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain"]) {
      expect(body?.classList.contains(token)).toBe(true);
    }
  });

  it("owns scrolling on the body itself — not on an unbounded Radix viewport", () => {
    renderPanel();

    const body = document.querySelector("div.overflow-y-auto");
    // The scrollable region is a plain element, and the content lives
    // inside it (not behind a Radix viewport that can grow to content
    // height inside a max-height shell).
    expect(body?.hasAttribute("data-radix-scroll-area-viewport")).toBe(false);
    expect(body?.querySelector("pre")).not.toBeNull();
  });

  it("renders the long pre content inside the bounded region", () => {
    renderPanel(LONG_CONTENT);

    expect(document.querySelector("div.overflow-y-auto")?.querySelector("pre")?.textContent).toBe(
      LONG_CONTENT,
    );
  });
});

describe("FileContentPanel behaviour", () => {
  it("renders the close button and calls onClose when it is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FileContentPanel
        content="some content"
        metadata={{ format_type: "text", mime_type: "text/plain" }}
        tables={[]}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders legacy header/row tables", () => {
    render(
      <FileContentPanel
        content="content with table"
        metadata={{ format_type: "text", mime_type: "text/plain" }}
        tables={[{ headers: ["Name", "Value"], rows: [["foo", "bar"]] }]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.getByText("bar")).toBeInTheDocument();
  });
});
