/**
 * Shared attachment renderer — spec ``chat-pdf-attachments`` (REQ-072..076).
 *
 * Rendered by BOTH the composer (removable draft) and the message timeline
 * (metadata from the trace projection). Images show an inline preview, and
 * documents show a file chip — nothing else: no document content, NO
 * internal RustFS/store path is ever displayed (REQ-075/076).
 */
import { FileText, X } from "lucide-react";
import { cn } from "@/application/lib/utils";
import { fileExtension, type ChatAttachmentDisplay } from "@/domain/entities/chat/attachment";
import { formatFileSize } from "@/application/lib/formatFileSize";

interface ChatAttachmentListProps {
  attachments: ChatAttachmentDisplay[];
  /** Show the remove affordance on each chip (composer only — REQ-068). */
  removable?: boolean;
  onRemove?: (attachmentId: string) => void;
}

function AttachmentImage({ attachment }: Readonly<{ attachment: ChatAttachmentDisplay }>) {
  return (
    <div className="relative border border-border bg-surface-warm">
      <img
        src={attachment.url}
        alt={attachment.filename}
        loading="lazy"
        data-od-id="chat-attachment-image"
        className="block max-w-full max-h-40 md:max-h-48 object-contain"
      />
    </div>
  );
}

function AttachmentFileChip({ attachment }: Readonly<{ attachment: ChatAttachmentDisplay }>) {
  const ext = fileExtension(attachment.filename);
  const kindLabel = ext ? ext.toUpperCase() : attachment.content_type;
  return (
    <div
      data-od-id="chat-attachment-file"
      className="flex max-w-[16rem] items-center gap-2 border border-border bg-surface px-2 py-1.5"
    >
      <FileText className="h-4 w-4 shrink-0 text-fg-2" aria-hidden="true" />
      <span className="min-w-0 truncate font-body text-xs text-fg">{attachment.filename}</span>
      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted">
        <span>{formatFileSize(attachment.size_bytes)}</span>
        <span aria-hidden="true">·</span>
        <span>{kindLabel}</span>
      </span>
    </div>
  );
}

function RemoveButton({
  attachmentId,
  filename,
  onRemove,
  className,
}: Readonly<{
  attachmentId: string;
  filename: string;
  onRemove?: (attachmentId: string) => void;
  className?: string;
}>) {
  return (
    <button
      type="button"
      data-od-id="chat-attachment-remove"
      aria-label={`Remove attachment ${filename}`}
      onClick={() => onRemove?.(attachmentId)}
      className={cn(
        "flex h-5 w-5 items-center justify-center border border-transparent p-0 text-muted transition-colors duration-fast ease-standard hover:border-danger hover:text-danger focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

export default function ChatAttachmentList({
  attachments,
  removable = false,
  onRemove,
}: Readonly<ChatAttachmentListProps>) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div data-od-id="chat-attachment-list" className="flex flex-col items-start gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="group relative flex items-start gap-1">
          {attachment.kind === "image" ? (
            <AttachmentImage attachment={attachment} />
          ) : (
            <AttachmentFileChip attachment={attachment} />
          )}
          {removable && (
            <RemoveButton
              attachmentId={attachment.id}
              filename={attachment.filename}
              onRemove={onRemove}
              className="self-start"
            />
          )}
        </div>
      ))}
    </div>
  );
}
