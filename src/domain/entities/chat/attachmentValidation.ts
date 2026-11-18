/**
 * Client-side attachment pre-validation — spec ``chat-pdf-attachments``
 * (REQ-006 mirror, REQ-062..065).
 *
 * Pure and structural: operates on ``{ name, size, type }`` so it stays
 * testable without browser APIs. The BACKEND remains the authoritative
 * validator (NFR-010) — this layer only prevents obviously invalid sends.
 */
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  CHAT_ATTACHMENT_MAX_DOCUMENT_BYTES,
  CHAT_ATTACHMENT_MAX_IMAGE_BYTES,
  CHAT_ATTACHMENT_MAX_TOTAL_BYTES,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_DOCUMENT_MIME_PREFIXES,
  SUPPORTED_IMAGE_MIME_TYPES,
  attachmentKindFromContentType,
  fileExtension,
} from "./attachment";

export interface AttachmentFileInput {
  name: string;
  size: number;
  type: string;
}

export interface ChatAttachmentValidationIssue {
  /** Name of the offending file (empty for list-scoped issues). */
  name: string;
  /** Human-readable reason mentioning the limit — surfaced to the user. */
  reason: string;
}

export class ChatAttachmentValidationError extends Error {
  readonly issues: ChatAttachmentValidationIssue[];

  constructor(issues: ChatAttachmentValidationIssue[]) {
    super(
      issues
        .map((issue) => (issue.name ? `${issue.name}: ${issue.reason}` : issue.reason))
        .join(" · "),
    );
    this.name = "ChatAttachmentValidationError";
    this.issues = issues;
  }
}

function isSupportedImage(type: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(type);
}

function isSupportedDocument(file: AttachmentFileInput): boolean {
  const ext = fileExtension(file.name);
  if (!ext || !SUPPORTED_DOCUMENT_EXTENSIONS.has(ext)) return false;
  // A document whose MIME is explicitly set must still belong to the accepted
  // family (REQ-006). An empty MIME falls back to extension-based acceptance.
  if (!file.type || file.type === "application/x-octet-stream") return true;
  return SUPPORTED_DOCUMENT_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

/** Issue attached to an image file, or null when the file passes the image rules. */
function imageAttachmentIssue(file: AttachmentFileInput): ChatAttachmentValidationIssue | null {
  if (!isSupportedImage(file.type)) {
    return { name: file.name, reason: "Unsupported image type (use PNG, JPEG, GIF or WebP)." };
  }
  if (file.size > CHAT_ATTACHMENT_MAX_IMAGE_BYTES) {
    return {
      name: file.name,
      reason: `exceeds the ${CHAT_ATTACHMENT_MAX_IMAGE_BYTES / (1024 * 1024)} MiB limit for images.`,
    };
  }
  return null;
}

/** Issue attached to a document file, or null when the file passes the document rules. */
function documentAttachmentIssue(
  file: AttachmentFileInput,
  documentsAllowed: boolean,
): ChatAttachmentValidationIssue | null {
  if (!documentsAllowed) {
    return {
      name: file.name,
      reason: "cannot be attached: this agent has no Files MCP server (documents unsupported).",
    };
  }
  if (!isSupportedDocument(file)) {
    return { name: file.name, reason: "Unsupported document type." };
  }
  if (file.size > CHAT_ATTACHMENT_MAX_DOCUMENT_BYTES) {
    return {
      name: file.name,
      reason: `exceeds the ${CHAT_ATTACHMENT_MAX_DOCUMENT_BYTES / (1024 * 1024)} MiB limit for documents.`,
    };
  }
  return null;
}

/**
 * Validate a composer draft against the client-mirrored limits. Documents are
 * only reportable when Files MCP is available for the target agent.
 */
export function validateChatAttachments(
  files: AttachmentFileInput[],
  documentsAllowed: boolean,
): ChatAttachmentValidationIssue[] {
  const issues: ChatAttachmentValidationIssue[] = [];

  if (files.length > CHAT_ATTACHMENT_MAX_COUNT) {
    issues.push({
      name: "",
      reason: `Too many files: at most ${CHAT_ATTACHMENT_MAX_COUNT} attachments are allowed.`,
    });
  }

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    const kind = attachmentKindFromContentType(file.type);
    const issue =
      kind === "image"
        ? imageAttachmentIssue(file)
        : documentAttachmentIssue(file, documentsAllowed);
    if (issue) issues.push(issue);
  }

  if (files.length > 0 && totalBytes > CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
    issues.push({
      name: "",
      reason: `Attachments exceed the total ${CHAT_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MiB limit.`,
    });
  }

  return issues;
}
