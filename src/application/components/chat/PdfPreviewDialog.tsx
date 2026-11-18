/**
 * PDF preview dialog — spec ``chat-pdf-attachments`` (REQ-080, REQ-086,
 * EC-009, EDG-019, AC-016).
 *
 * Deliberately tiny and react-pdf-free: the dialog is statically imported by
 * ToolResultBlock, so nothing loads on mere render (REQ-079 / NFR-003). On
 * open it (1) fetches the base64 content from the existing store API,
 * (2) THEN lazy-imports the react-pdf canvas module, (3) renders the page.
 * A 404/network failure shows a readable error state and the close works
 * even when the document is gone (deleted-thread cascade).
 */
import { useEffect, useState, type ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/application/components/ui/dialog";
import { storeApi, extractApiMessage } from "@/infrastructure/api/store/storeApi";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  filename: string;
  mimeType: string;
}

type PdfPreviewStatus =
  | { kind: "loading" }
  | { kind: "ready"; file: string }
  | { kind: "error"; message: string };

type PdfCanvasComponent = ComponentType<{ file: string }>;

type FetchOutcome =
  | { kind: "ok"; content: string }
  | { kind: "miss" }
  | { kind: "error"; message: string };

const NOT_FOUND_MESSAGE =
  "PDF not found (404): this document no longer exists in your store — it may have been deleted with its thread.";

export default function PdfPreviewDialog({
  open,
  onOpenChange,
  path,
  filename,
  mimeType,
}: Readonly<PdfPreviewDialogProps>) {
  const [status, setStatus] = useState<PdfPreviewStatus>({ kind: "loading" });
  const [PdfCanvas, setPdfCanvas] = useState<PdfCanvasComponent | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus({ kind: "loading" });
      setPdfCanvas(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setStatus({ kind: "loading" });
      setPdfCanvas(null);

      const outcome: FetchOutcome = await loadPdfContent(path);
      if (cancelled) return;
      if (outcome.kind !== "ok") {
        setStatus({
          kind: "error",
          message: outcome.kind === "miss" ? NOT_FOUND_MESSAGE : outcome.message,
        });
        return;
      }

      try {
        // REQ-080 step 2: ONLY now does the react-pdf bundle load (NFR-002).
        const module = await import("./PdfCanvas");
        if (cancelled) return;
        setPdfCanvas(() => module.default);
        // REQ-080 step 3: render with react-pdf.
        setStatus({ kind: "ready", file: `data:${mimeType};base64,${outcome.content}` });
      } catch (error) {
        console.error("[PdfPreviewDialog] viewer module load failed:", error);
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: "An error occurred while loading the PDF viewer module.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, path, mimeType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-od-id="pdf-preview-dialog" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{filename}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Generated PDF document
          </DialogDescription>
        </DialogHeader>
        {status.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 border border-border bg-bg p-6">
            <span
              className="spin inline-block h-4 w-4 border-2 border-accent border-t-transparent"
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-muted">Loading document…</span>
          </div>
        )}
        {status.kind === "error" && (
          <p
            role="alert"
            data-od-id="pdf-preview-error"
            className="border border-danger bg-bg p-4 font-mono text-xs text-danger"
          >
            {status.message}
          </p>
        )}
        {status.kind === "ready" && PdfCanvas && <PdfCanvas file={status.file} />}
      </DialogContent>
    </Dialog>
  );
}

/** REQ-080 step 1 — fetch the persisted document content via the store port. */
async function loadPdfContent(path: string): Promise<FetchOutcome> {
  try {
    const file = await storeApi.getFile(path);
    return file?.content ? { kind: "ok", content: file.content } : { kind: "miss" };
  } catch (error) {
    return {
      kind: "error",
      message: `An error occurred while fetching the PDF document: ${extractApiMessage(error)}`,
    };
  }
}
