/**
 * Behavioral tests — shared ChatAttachmentList component (REQ-072..076).
 *
 * Contract:
 *  - shared component rendered by BOTH the composer and the messages
 *    (REQ-072), with the spec QA anchors (§9.2): chat-attachment-list,
 *    chat-attachment-image, chat-attachment-file, chat-attachment-remove;
 *  - an IMAGE renders a responsive `<img>` with ``alt`` = filename and
 *    ``loading="lazy"`` (REQ-073);
 *  - a DOCUMENT renders a file chip: FileText icon + filename + size
 *    formatted with formatFileSize (REQ-074);
 *  - NO document content and NO internal RustFS path is ever displayed
 *    (REQ-075/076).
 */
import { screen, configure } from "@testing-library/dom";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatAttachmentList from "@/application/components/chat/ChatAttachmentList";
import {
  createAttachmentMeta,
  createDocumentAttachmentMeta,
} from "../../../fixtures/chatAttachments";

configure({ testIdAttribute: "data-od-id" });

vi.mock("@/application/hooks/chat/useStreamChat", () => ({
  useStreamChat: () => ({ stream: vi.fn(), cancel: vi.fn() }),
}));

describe("ChatAttachmentList", () => {
  it("renders images as lazy, responsive <img> with alt = filename (REQ-073)", () => {
    render(
      <ChatAttachmentList
        attachments={[createAttachmentMeta({ filename: "capture.png", url: "blob:preview-1" })]}
      />,
    );

    const img = screen.getByTestId("chat-attachment-image") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.alt).toBe("capture.png");
    expect(img.loading).toBe("lazy");
    expect(img.src).toContain("blob:preview-1");
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("max-w-full");
  });

  it("renders documents as file chips with FileText icon, name and size (REQ-074)", () => {
    render(
      <ChatAttachmentList
        attachments={[
          createDocumentAttachmentMeta({ filename: "rapport.pdf", size_bytes: 1536000 }),
        ]}
      />,
    );

    const chip = screen.getByTestId("chat-attachment-file");
    expect(chip).toBeInTheDocument();
    // lucide-react FileText icon
    const icon = chip.querySelector("svg.lucide-file-text") ?? chip.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(screen.getByText(/rapport\.pdf/)).toBeInTheDocument();
    expect(screen.getByText("1.5 MB")).toBeInTheDocument();
  });

  it("renders mixed image + document attachments", () => {
    render(
      <ChatAttachmentList attachments={[createAttachmentMeta(), createDocumentAttachmentMeta()]} />,
    );
    expect(screen.getByTestId("chat-attachment-image")).toBeInTheDocument();
    expect(screen.getByTestId("chat-attachment-file")).toBeInTheDocument();
  });

  it("renders nothing visible for an empty attachment list", () => {
    render(<ChatAttachmentList attachments={[]} />);
    expect(screen.queryByTestId("chat-attachment-list")).not.toBeInTheDocument();
    expect(document.querySelector('[data-od-id="chat-attachment-image"]')).toBeNull();
  });

  it("shows the optional remove affordance only when removable is set (REQ-068 / AC-014)", () => {
    const { rerender } = render(
      <ChatAttachmentList attachments={[createAttachmentMeta()]} removable={true} />,
    );
    expect(screen.getByTestId("chat-attachment-remove")).toBeInTheDocument();

    rerender(<ChatAttachmentList attachments={[createAttachmentMeta()]} removable={false} />);
    expect(screen.queryByTestId("chat-attachment-remove")).not.toBeInTheDocument();
  });

  it("never displays the internal RustFS path or document content (REQ-075/076)", () => {
    render(
      <ChatAttachmentList
        attachments={[
          createDocumentAttachmentMeta({
            filename: "rapport.pdf",
          }),
        ]}
      />,
    );

    const html = document.body.innerHTML;
    // Internal storage layout must never leak into the UI.
    expect(html).not.toContain("chat_tmp/");
    expect(html).not.toContain("/documents/");
    expect(html).not.toContain("rustfs");
    expect(html).not.toContain("JVBERi"); // no base64 PDF content either
  });
});
