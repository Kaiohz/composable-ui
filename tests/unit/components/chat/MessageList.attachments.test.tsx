/**
 * Behavioral tests — attachments in the chat surfaces (REQ-069/070, AC-002).
 *
 * Contract:
 *  - the PENDING user message shows its attachments during streaming
 *    (REQ-069) — the composer hands them over through the chat store
 *    (``pendingUserAttachments`` state) and MessageList renders them with
 *    the shared ChatAttachmentList;
 *  - the HISTORY renders attachments after reload (REQ-070, AC-002),
 *    metadata-driven from the backend ``Message.attachments`` projection;
 *    images are resolved via the store API (REQ-027) at
 *    /chat_attachments/<thread_id>/<attachment_id>/<filename> and NO base64
 *    travels through the trace/history metadata.
 */
import { screen, configure } from "@testing-library/dom";
import { renderWithProviders } from "../../../utils/render";
import { waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MessageList from "@/application/components/chat/MessageList";
import { useChatStore } from "@/application/stores/useChatStore";
import {
  createAttachmentMeta,
  createDocumentAttachmentMeta,
  PNG_BASE64,
} from "../../../fixtures/chatAttachments";
import { createThreadHistory, createTurn, createMessage } from "../../../fixtures/external";
import { MessageRole, MessageStatus } from "@/domain/entities/chat/message";

configure({ testIdAttribute: "data-od-id" });

// external boundary: the store HTTP API used to resolve stored image bytes
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

const { mockHistory } = vi.hoisted(() => ({
  mockHistory: { current: undefined as ReturnType<typeof createThreadHistory> | undefined },
}));

vi.mock("@/application/hooks/chat/useThreadHistory", () => ({
  useThreadHistory: () => ({
    data: mockHistory.current,
    isLoading: false,
  }),
}));

vi.mock("@/application/hooks/chat/useStreamChat", () => ({
  useStreamChat: () => ({ stream: vi.fn(), cancel: vi.fn() }),
}));

function resetStore() {
  useChatStore.setState({
    activeThreadId: null,
    streamingTurn: null,
    isStreaming: false,
    pendingUserMessage: null,
    error: null,
  });
}

describe("MessageList — pending user message attachments (REQ-069)", () => {
  beforeEach(() => {
    mockGetFile.mockReset();
    resetStore();
  });

  it("renders the pending message attachments during streaming", () => {
    useChatStore.setState({
      isStreaming: true,
      pendingUserMessage: "Analyse cette image et ce document",
      pendingUserAttachments: [createAttachmentMeta(), createDocumentAttachmentMeta()],
    });

    renderWithProviders(<MessageList threadId="thread-1" agentName="test-agent" />);

    expect(screen.getByTestId("chat-attachment-image")).toBeInTheDocument();
    expect(screen.getByTestId("chat-attachment-file")).toBeInTheDocument();
    expect(screen.getByText("Analyse cette image et ce document")).toBeInTheDocument();
  });

  it("clears pending attachments with the pending message on stream completion", () => {
    useChatStore.setState({
      isStreaming: true,
      pendingUserMessage: "with attachments",
      pendingUserAttachments: [createAttachmentMeta()],
    });
    useChatStore.getState().clearStream();
    expect(useChatStore.getState().pendingUserAttachments).toBeNull();
  });
});

describe("MessageList — history attachments (REQ-070 / AC-002)", () => {
  beforeEach(() => {
    mockGetFile.mockReset();
    resetStore();
    mockHistory.current = undefined;
  });

  it("renders history image attachments by resolving them from the store (REQ-027)", async () => {
    const attachment = createAttachmentMeta({ id: "att-stored-1", filename: "capture.png" });
    mockGetFile.mockResolvedValue({
      path: "/chat_attachments/thread-1/att-stored-1/capture.png",
      content: PNG_BASE64,
    });
    mockHistory.current = createThreadHistory({
      thread: { id: "thread-1", agent_name: "test-agent" } as never,
      turns: [
        createTurn({
          human_message: createMessage({
            role: MessageRole.HUMAN,
            content: "Analyse cette image",
            status: MessageStatus.COMPLETED,
            // REQ-022: metadata-only projection, NO base64 payload.
            attachments: [attachment],
          } as never),
          ai_message: createMessage({ role: MessageRole.AI, content: "Voilà." }),
          events: [],
        }),
      ],
    });

    renderWithProviders(<MessageList threadId="thread-1" agentName="test-agent" />);

    await waitFor(() => {
      expect(screen.getByTestId("chat-attachment-image")).toBeInTheDocument();
    });
    expect(mockGetFile).toHaveBeenCalledWith("/chat_attachments/thread-1/att-stored-1/capture.png");
    const img = screen.getByTestId("chat-attachment-image") as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(new RegExp(PNG_BASE64.slice(0, 20)));
  });

  it("renders history document attachments as file chips (no rustfs path, no fetch loop)", () => {
    mockHistory.current = createThreadHistory({
      turns: [
        createTurn({
          human_message: createMessage({
            role: MessageRole.HUMAN,
            content: "Analyse ce document",
            status: MessageStatus.COMPLETED,
            attachments: [createDocumentAttachmentMeta()],
          } as never),
          ai_message: createMessage({ role: MessageRole.AI, content: "OK." }),
          events: [],
        }),
      ],
    });

    renderWithProviders(<MessageList threadId="thread-1" agentName="test-agent" />);

    expect(screen.getByTestId("chat-attachment-file")).toBeInTheDocument();
    expect(screen.getByText("rapport.pdf")).toBeInTheDocument();
    // Documents resolve from the TEMP rustfs which is gone — the UI must NOT
    // attempt to fetch document content for display (REQ-075).
    expect(mockGetFile).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain("chat_tmp/");
  });
});
