import { useMemo, useState, useId } from "react";
import { ChevronDown, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/application/lib/utils";
import {
  parseCreatePdfToolResult,
  type CreatePdfToolResult,
} from "@/domain/entities/chat/createPdfToolResult";
import { storeApi, extractApiMessage } from "@/infrastructure/api/store/storeApi";
import PdfPreviewDialog from "@/application/components/chat/PdfPreviewDialog";
import { Button } from "@/application/components/ui/button";

interface ToolResultBlockProps {
  name: string | null;
  content: string | null;
  source: string | null;
}

/**
 * Decodes the base64 payload into bytes. The intermediate binary string is
 * ~2× the file size in memory on top of the decoded bytes — acceptable for
 * tool-generated PDFs (typically small), worth revisiting for very large ones.
 */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function ToolResultBlock({ name, content, source }: Readonly<ToolResultBlockProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const panelId = useId();

  const accentClass = source ? "border-cyan text-cyan" : "border-accent text-accent";

  // REQ-077: PDF actions only for a STRICTLY valid create_pdf JSON result
  // with a path under /documents/ (EDG-011). Everything else keeps the exact
  // generic rendering with no PDF-specific surface (REQ-091 / EC-010).
  const pdfResult = useMemo(() => parseCreatePdfToolResult(name, content), [name, content]);

  // REQ-087/088/089: Download fetches the PDF from the user store and saves
  // it as a real application/pdf blob named after ``filename`` — fully
  // independent from the Preview dialog. Failure surfaces BOTH as the repo's
  // standard sonner toast (EC-014, I12) and as a persistent inline alert.
  async function handleDownload(result: CreatePdfToolResult) {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const file = await storeApi.getFile(result.path);
      if (!file?.content) {
        const message =
          "Download failed: PDF not found (404). It may have been deleted with its thread.";
        setDownloadError(message);
        toast.error(message);
        return;
      }
      const blob = new Blob([base64ToBytes(file.content)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.rel = "noopener";
      // Attach to the DOM so older Safari starts the download (I4), click,
      // then clean up and revoke AFTER the click handler has run.
      anchor.setAttribute("aria-hidden", "true");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      const message = `Download failed: ${extractApiMessage(error)}`;
      setDownloadError(message);
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div
      className={cn("border bg-bg font-mono text-xs", accentClass)}
      data-od-id="tool-result-block"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label="Toggle result"
      >
        <span className="uppercase tracking-[0.1em]">Tool Result</span>
        {name && <span className="normal-case tracking-normal text-muted">{name}</span>}
        {source && (
          <span className="ml-auto font-body text-[10px] normal-case tracking-normal text-muted">
            {source}
          </span>
        )}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {/* AC-007/I3: the Preview/Download actions are visible even when the
          tool payload is collapsed — the JSON detail stays behind the toggle.
          REQ-079 still holds: nothing is FETCHED until Preview is clicked. */}
      {pdfResult && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-bg px-3 py-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-od-id="pdf-preview-button"
            onClick={() => setIsPreviewOpen(true)}
            aria-label={`Preview ${pdfResult.filename}`}
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            <span>Preview</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-od-id="pdf-download-button"
            onClick={() => void handleDownload(pdfResult)}
            disabled={isDownloading}
            aria-label={`Download ${pdfResult.filename}`}
          >
            <Download className="h-3 w-3" aria-hidden="true" />
            <span>Download</span>
          </Button>
          {downloadError && (
            <p
              role="alert"
              data-od-id="pdf-download-error"
              className="font-mono text-xs text-danger"
            >
              {downloadError}
            </p>
          )}
          <PdfPreviewDialog
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
            path={pdfResult.path}
            filename={pdfResult.filename}
            mimeType={pdfResult.mime_type}
          />
        </div>
      )}
      {isExpanded && content && (
        <pre
          id={panelId}
          className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-border bg-bg px-3 py-2 text-xs text-fg-2"
        >
          {content}
        </pre>
      )}
    </div>
  );
}
