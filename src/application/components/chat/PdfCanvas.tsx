/**
 * Lazy-loaded ``react-pdf`` canvas — spec ``chat-pdf-attachments`` (REQ-081,
 * REQ-082, REQ-083..086, EDG-012).
 *
 * This module is the ONLY one importing ``react-pdf`` (NFR-002): it is
 * dynamically imported by {@link PdfPreviewDialog} after the user clicks
 * Preview and the store fetch has succeeded. The PDF.js worker is configured
 * HERE — in the same module that renders the PDF components — following the
 * react-pdf 11 + Vite guidance.
 *
 * ``suspense={false}`` (C2): by default react-pdf 11 suspends on the PDF
 * promise and RETHROWS load errors — the fallback/error would bubble to the
 * app-level boundary and a malformed PDF would blank the whole application.
 * In non-suspending mode loading and errors are prop-driven, and the viewer
 * additionally sits behind a LOCAL error boundary so a render failure can
 * never escape the dialog.
 */
import { Component, Suspense, useState, type ErrorInfo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/application/components/ui/button";

// Worker configured in the same module as <Document>/<Page> (REQ-082).
// Environments that stub react-pdf without the ``pdfjs`` re-export (unit
// tests of the dialog) must not break module evaluation, hence the guard.
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
} catch {
  // react-pdf stubbed in a test harness: worker configuration is a no-op.
}

const PDF_RENDER_ERROR = (
  <p role="alert" className="p-4 text-center font-mono text-xs text-danger">
    An error occurred while rendering the PDF document.
  </p>
);

const PDF_LOADING = <p className="p-4 text-center font-mono text-xs text-muted">Rendering PDF…</p>;

/**
 * Local boundary around the viewer (C2): a malformed/unexpected render error
 * degrades to the in-dialog alert instead of unmounting the application root.
 */
class PdfErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[PdfCanvas] render error:", error, info);
  }

  render(): ReactNode {
    return this.state.failed ? PDF_RENDER_ERROR : this.props.children;
  }
}

interface PdfCanvasProps {
  file: string;
}

export default function PdfCanvas({ file }: Readonly<PdfCanvasProps>) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const totalPages = numPages ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          data-od-id="pdf-preview-previous"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page <= 1 || totalPages === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        {/* REQ-083/084: one page at a time, mono counter. */}
        <span className="font-mono text-xs text-fg-2" aria-live="polite">
          {numPages ? `Page ${page} / ${numPages}` : `Page ${page}`}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          data-od-id="pdf-preview-next"
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={totalPages === 0 || page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {/* Bounded scroll body (BUG-003 audit): the previous Radix ScrollArea
          could clip inside its max-height box (indefinite viewport
          percentage); a plain `max-h` + `overflow-y-auto` region cannot. */}
      <div
        data-od-id="pdf-preview-canvas"
        className="max-h-[60vh] overscroll-contain overflow-y-auto border border-border bg-surface-warm p-4"
      >
        {loadFailed ? (
          PDF_RENDER_ERROR
        ) : (
          <PdfErrorBoundary>
            <Suspense fallback={PDF_LOADING}>
              {/* suspense={false}: loading/errors are prop-driven — the app
                  boundary is never reached for the pdf preview path (C2).
                  onLoadError/onSourceError are the real react-pdf callbacks;
                  ``onError`` would only become a dead DOM listener (I9). */}
              <Document
                file={file}
                suspense={false}
                loading={PDF_LOADING}
                error={PDF_RENDER_ERROR}
                onLoadSuccess={(pdf: { numPages: number }) => setNumPages(pdf.numPages)}
                onLoadError={() => setLoadFailed(true)}
                onSourceError={() => setLoadFailed(true)}
              >
                <Page pageNumber={page} renderTextLayer renderAnnotationLayer={false} />
              </Document>
            </Suspense>
          </PdfErrorBoundary>
        )}
      </div>
    </div>
  );
}
