import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Paperclip, Send, Square } from "lucide-react";
import { Button } from "@/application/components/ui/button";
import { cn } from "@/application/lib/utils";
import { useStreamChat } from "@/application/hooks/chat/useStreamChat";
import { useChatStore, type ComposerAttachment } from "@/application/stores/useChatStore";
import ChatAttachmentList from "@/application/components/chat/ChatAttachmentList";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import type {
  ChatAttachmentDisplay,
  ChatAttachmentPayload,
} from "@/domain/entities/chat/attachment";
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_ATTACHMENT_MAX_TOTAL_BYTES,
  attachmentKindFromContentType,
  documentsAllowedWithFilesMcp,
  sourceForKind,
  SUPPORTED_IMAGE_MIME_TYPES,
} from "@/domain/entities/chat/attachment";
import { validateChatAttachments } from "@/domain/entities/chat/attachmentValidation";
import type { ChatRequest } from "@/domain/entities/chat/chatRequest";

interface ChatInputProps {
  threadId: string;
  /** Agent config feeds the attachment policy (REQ-062); null ⇒ images only. */
  agentConfig?: AgentConfig | null;
}

const IMAGE_ACCEPT = [...SUPPORTED_IMAGE_MIME_TYPES].join(",");

/**
 * Document accept tokens for the file picker (REQ-062/068): full MIME
 * entries (no prefix wildcards — ``accept`` needs complete tokens), mirroring
 * the REST-upload document family minus the vision-managed images (REQ-008).
 */
const DOCUMENT_ACCEPT = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/xml",
  "application/json",
  "application/rtf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "image/svg+xml",
  "image/bmp",
].join(",");

function generateAttachmentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `att-${Date.now()}-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** object URLs are revoked on remove/unmount/success to avoid leaks (EDG-014). */
function createPreviewObjectUrl(file: File): string | null {
  try {
    if (typeof URL.createObjectURL !== "function") return null;
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function revokePreviewObjectUrl(url: string | null): void {
  if (!url || typeof URL.revokeObjectURL !== "function") return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Revocation failures must never break the composer.
  }
}

function fileExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  xml: "application/xml",
  json: "application/json",
  rtf: "application/rtf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

/** Browser MIME for the payload — falls back to the extension mapping. */
function contentTypesForFile(file: File): string {
  if (file.type) return file.type;
  return EXTENSION_MIME_TYPES[fileExtension(file.name)] ?? "application/octet-stream";
}

/** Encode a file as raw base64 at send time (REQ-065). */
async function fileToBase64(file: File): Promise<string> {
  if (typeof file.arrayBuffer === "function") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const CHUNK = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }
  // Older runtimes (and jsdom) without Blob.arrayBuffer: readAsDataURL then
  // strip the ``data:...;base64,`` prefix. Result is plain base64 (REQ-065).
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const commaIndex = dataUrl.indexOf(",");
      const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";
      if (!base64) {
        reject(new Error("Failed to read the attached files."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read the attached files."));
    reader.readAsDataURL(file);
  });
}

function toComposerAttachment(file: File): ComposerAttachment {
  const contentType = contentTypesForFile(file);
  return {
    id: generateAttachmentId(),
    file,
    filename: file.name,
    content_type: contentType,
    size_bytes: file.size,
    kind: attachmentKindFromContentType(contentType),
    previewUrl: createPreviewObjectUrl(file),
  };
}

function toDisplayAttachment(attachment: ComposerAttachment): ChatAttachmentDisplay {
  return {
    id: attachment.id,
    filename: attachment.filename,
    content_type: attachment.content_type,
    size_bytes: attachment.size_bytes,
    kind: attachment.kind,
    source: sourceForKind(attachment.kind),
    url: attachment.previewUrl ?? undefined,
  };
}

export default function ChatInput({ threadId, agentConfig = null }: Readonly<ChatInputProps>) {
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ComposerAttachment[]>([]);
  const [attachIssues, setAttachIssues] = useState<string[]>([]);
  const [isEncoding, setIsEncoding] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef<ComposerAttachment[]>([]);
  const backupRef = useRef<ComposerAttachment[]>([]);
  const encodingRef = useRef(false);
  /** Preview URLs currently displayed by the composer draft (C1 revoke guard). */
  const livePreviewUrlsRef = useRef<Set<string>>(new Set());
  const { stream, cancel } = useStreamChat(threadId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const composerBackup = useChatStore((s) => s.composerBackup);
  const composerRestoredDraft = useChatStore((s) => s.composerRestoredDraft);

  // REQ-062: images are ALWAYS accepted; documents require a ``/files/mcp``
  // MCP HTTP server on the agent config (client mirror — the backend stays
  // the authority, NFR-010).
  const documentsAllowed = documentsAllowedWithFilesMcp(agentConfig?.mcp_servers);

  // Refs are synced post-commit (never written during render).
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  // ─── REQ-071: restore the draft when a submit failed on the backend ──────
  // Declared BEFORE the live-URL sync and revoke effects: within the same
  // commit it runs first and records which preview object URLs the restored
  // draft is STILL DISPLAYING, so the revoke guard below can never kill one
  // of them (C1: the revoked-but-live blob URL).
  useEffect(() => {
    if (!composerRestoredDraft) return;
    setInput(composerRestoredDraft.text);
    setPendingAttachments(composerRestoredDraft.attachments);
    livePreviewUrlsRef.current = new Set(
      composerRestoredDraft.attachments
        .map((attachment) => attachment.previewUrl)
        .filter((url): url is string => Boolean(url)),
    );
    useChatStore.getState().consumeComposerRestoredDraft?.();
  }, [composerRestoredDraft]);

  // Keep the "currently displayed" URL set in sync with the composer draft —
  // it is the revoke guard's source of truth (C1).
  useEffect(() => {
    livePreviewUrlsRef.current = new Set(
      pendingAttachments
        .map((attachment) => attachment.previewUrl)
        .filter((url): url is string => Boolean(url)),
    );
  }, [pendingAttachments]);

  // When the pre-submit backup is dropped WITHOUT a restore (turn completed
  // successfully), the original preview object URLs are disposable.
  useEffect(() => {
    if (composerBackup != null) {
      backupRef.current = composerBackup.attachments;
      return;
    }
    const previous = backupRef.current;
    backupRef.current = [];
    if (previous.length === 0) return;
    for (const attachment of previous) {
      const url = attachment.previewUrl;
      // Never revoke a URL the composer draft is still displaying (C1).
      if (!url || livePreviewUrlsRef.current.has(url)) continue;
      revokePreviewObjectUrl(url);
    }
  }, [composerBackup]);

  // Final leak guard: any composer-owned object URL is revoked on unmount.
  useEffect(() => {
    return () => {
      for (const attachment of pendingAttachmentsRef.current) {
        revokePreviewObjectUrl(attachment.previewUrl);
      }
    };
  }, []);

  // ─── REQ-067/068: removable previews of the selected files ───────────────
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === attachmentId);
      revokePreviewObjectUrl(removed?.previewUrl ?? null);
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
    setAttachIssues([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ─── REQ-006 client mirror: validate before keeping a picked file ────────
  const handleFilesSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files;
      if (!picked || picked.length === 0) return;
      const incoming = Array.from(picked);
      event.target.value = ""; // allow re-picking the same file

      const issues: string[] = [];
      const candidates: ComposerAttachment[] = [];

      const currentCount = pendingAttachmentsRef.current.length;
      if (currentCount + incoming.length > CHAT_ATTACHMENT_MAX_COUNT) {
        issues.push(
          `Too many files: at most ${CHAT_ATTACHMENT_MAX_COUNT} attachments are allowed.`,
        );
      }
      incoming.forEach((file, index) => {
        if (currentCount + index >= CHAT_ATTACHMENT_MAX_COUNT) return; // overflow rejected
        const validation = validateChatAttachments(
          [{ name: file.name, size: file.size, type: file.type }],
          documentsAllowed,
        );
        const fileIssues = validation.filter((issue) => issue.name !== "");
        if (fileIssues.length > 0) {
          for (const issue of fileIssues) {
            issues.push(`${issue.name}: ${issue.reason}`);
          }
          return;
        }
        candidates.push(toComposerAttachment(file));
      });

      const merged = [...pendingAttachmentsRef.current, ...candidates];
      const totalBytes = merged.reduce((sum, attachment) => sum + attachment.size_bytes, 0);
      if (candidates.length > 0 && totalBytes > CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
        for (const attachment of candidates) revokePreviewObjectUrl(attachment.previewUrl);
        issues.push(
          `Attachments exceed the total ${Math.floor(CHAT_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024))} MiB limit.`,
        );
      } else if (candidates.length > 0) {
        setPendingAttachments(merged);
      }
      setAttachIssues(issues);
    },
    [documentsAllowed],
  );

  async function handleSubmit(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    // Pendant le stream, le bouton devient un Stop : abort du flux en cours.
    if (isStreaming) {
      cancel();
      return;
    }
    // Double-submit guard: encoding a large file is async — never send twice.
    if (encodingRef.current) return;

    const trimmed = input.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    encodingRef.current = true;
    setIsEncoding(true);
    try {
      // REQ-065: base64 is produced only at send time — never upload to
      // RustFS from the frontend (REQ-066): the payload goes to the chat API.
      const payloads: ChatAttachmentPayload[] = [];
      for (const attachment of pendingAttachments) {
        payloads.push({
          filename: attachment.filename,
          content_type: attachment.content_type,
          content_base64: await fileToBase64(attachment.file),
        });
      }

      const request: ChatRequest = payloads.length
        ? { ...(trimmed && { message: trimmed }), attachments: payloads }
        : { message: trimmed };
      const pendingMeta = payloads.length ? pendingAttachments.map(toDisplayAttachment) : undefined;

      // Single-argument call for the plain-text case keeps the legacy
      // contract untouched (REQ-003 / AC-011).
      if (pendingMeta) {
        stream(request, pendingMeta);
      } else {
        stream(request);
      }

      // REQ-071: remember the draft; the hook restores it on backend error.
      useChatStore.getState().backupComposer?.({ text: trimmed, attachments: pendingAttachments });

      setInput("");
      setPendingAttachments([]);
      setAttachIssues([]);
    } catch (encodeError) {
      // Encoding failed BEFORE anything was sent: keep the composer intact.
      setAttachIssues([
        encodeError instanceof Error ? encodeError.message : "Failed to read the attached files.",
      ]);
    } finally {
      encodingRef.current = false;
      setIsEncoding(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface p-4" data-od-id="chat-input">
      <form onSubmit={handleSubmit}>
        {pendingAttachments.length > 0 && (
          <div className="mb-2">
            <ChatAttachmentList
              attachments={pendingAttachments.map(toDisplayAttachment)}
              removable={!isStreaming}
              onRemove={handleRemoveAttachment}
            />
          </div>
        )}
        <div className="flex items-end gap-2 border border-border bg-surface-warm p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Orchestrate your next move..."
            disabled={isStreaming}
            rows={1}
            aria-label="Chat message input"
            className="flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm text-fg placeholder:text-muted focus:outline-none focus-visible:shadow-none disabled:opacity-50"
          />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-od-id="chat-attach-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isEncoding}
              aria-label="Attach files"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={documentsAllowed ? `${IMAGE_ACCEPT},${DOCUMENT_ACCEPT}` : IMAGE_ACCEPT}
              onChange={handleFilesSelected}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <Button
              type="submit"
              variant="default"
              size="icon"
              // Enabled pendant le stream (clic = Stop), disabled seulement
              // si aucun texte ni aucune pièce jointe valide hors stream
              // (REQ-064) — et pendant l'encodage base64.
              disabled={
                !isStreaming &&
                (isEncoding || (input.trim().length === 0 && pendingAttachments.length === 0))
              }
              aria-label={isStreaming ? "Stop streaming" : "Send"}
              className={cn(isStreaming && "btn-pulse")}
            >
              {isStreaming ? (
                <Square className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        {attachIssues.length > 0 && (
          <p
            data-od-id="chat-attach-error"
            role="alert"
            className="mt-2 font-mono text-xs text-danger"
          >
            {attachIssues.join(" · ")}
          </p>
        )}
        {!documentsAllowed && (
          <p data-od-id="chat-attach-hint" className="mt-2 font-mono text-xs text-muted">
            Images only · documents require an agent with Files MCP
          </p>
        )}
      </form>
      <p className="mt-2 text-center font-mono text-xs text-muted">
        <span>Composables v0.1</span>
        <span aria-hidden="true"> · Enter to send · Shift+Enter for newline</span>
      </p>
    </div>
  );
}
