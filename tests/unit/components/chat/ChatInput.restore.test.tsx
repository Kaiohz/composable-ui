/**
 * REQ-071 regression — C1 fix. The composer must survive a BACKEND ERROR
 * with its full draft (text + attachments) intact AND the attachment preview
 * object URLs still live (the restored draft keeps displaying them).
 *
 * This suite runs the REAL ``useChatStore`` and the REAL ``useStreamChat`` —
 * only the OUTBOUND streaming HTTP boundary (``chatApi``) is mocked, closing
 * the blind spot (review I14) that let C1 ship.
 */
import { screen, configure } from "@testing-library/dom";
import { act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ChatInput from "@/application/components/chat/ChatInput";
import { useChatStore } from "@/application/stores/useChatStore";
import { renderWithProviders } from "../../../utils/render";
import { agentWithoutMcp } from "../../../fixtures/chatAttachments";

configure({ testIdAttribute: "data-od-id" });

const { mockStreamMessage } = vi.hoisted(() => ({
  mockStreamMessage: vi.fn(),
}));

vi.mock("@/infrastructure/api/chat/chatApi", () => ({
  chatApi: {
    streamMessage: mockStreamMessage,
  },
}));

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

function pngFile(sizeBytes = 100): File {
  return new File(["A".repeat(sizeBytes)], "capture.png", { type: "image/png" });
}

function resetRealStore(): void {
  useChatStore.setState({
    activeThreadId: null,
    streamingTurn: null,
    isStreaming: false,
    pendingUserMessage: null,
    pendingUserAttachments: null,
    composerBackup: null,
    composerRestoredDraft: null,
    error: null,
  });
}

describe("ChatInput — REQ-071 restore (real store + real useStreamChat)", () => {
  beforeEach(() => {
    mockStreamMessage.mockReset();
    mockStreamMessage.mockImplementation(() => new AbortController());
    resetRealStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRealStore();
  });

  it("restores text + attachments after a stream error and keeps the preview URL alive", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restore-1");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithProviders(<ChatInput threadId="thread-1" agentConfig={agentWithoutMcp()} />);

    const textarea = screen.getByPlaceholderText("Orchestrate your next move...");
    await user.type(textarea, "regarde ça");
    await user.upload(fileInput(), pngFile());
    expect(createObjectURL).toHaveBeenCalledWith(expect.anything());
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledTimes(1);
    });
    // The composer was cleared for the optimistic send…
    expect(textarea).toHaveValue("");
    const request = mockStreamMessage.mock.calls[0][1] as {
      message?: string;
      attachments?: Array<{ filename: string; content_base64: string }>;
    };
    expect(request.message).toBe("regarde ça");
    expect(request.attachments?.[0]).toMatchObject({ filename: "capture.png" });
    expect(request.attachments?.[0].content_base64?.length ?? 0).toBeGreaterThan(0);

    // …then the backend fails: the REAL onError path (setError + restore
    // composer backup) runs inside the real hook.
    const onError = mockStreamMessage.mock.calls[0][4] as (error: Error) => void;
    act(() => {
      onError(new Error("boom"));
    });

    // The optimistic pending bubble is dropped (I6) — the composer owns the draft.
    expect(useChatStore.getState().pendingUserMessage).toBeNull();
    // The draft is back, verbatim.
    await waitFor(() => {
      expect(textarea).toHaveValue("regarde ça");
    });
    const img = (await screen.findByTestId("chat-attachment-image")) as HTMLImageElement;
    expect(img.src).toContain("blob:restore-1");
    // C1: the restored URL was NOT revoked while still displayed.
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:restore-1");

    // Retry works with the restored draft — no re-picking required.
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(mockStreamMessage).toHaveBeenCalledTimes(2);
    });
    const retryRequest = mockStreamMessage.mock.calls[1][1] as typeof request;
    expect(retryRequest.message).toBe("regarde ça");
    expect(retryRequest.attachments?.[0]).toMatchObject({ filename: "capture.png" });
  });

  it("keeps restoring across repeated failures without ever revoking a live URL", async () => {
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restore-1");
    const user = userEvent.setup();
    renderWithProviders(<ChatInput threadId="thread-1" agentConfig={agentWithoutMcp()} />);

    await user.type(screen.getByPlaceholderText("Orchestrate your next move..."), "tentative");
    await user.upload(fileInput(), pngFile());
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(mockStreamMessage).toHaveBeenCalledTimes(1));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const onError = mockStreamMessage.mock.calls[attempt - 1][4] as (error: Error) => void;
      act(() => {
        onError(new Error(`boom ${attempt}`));
      });
      // Re-send the restored draft; the preview URL must survive every cycle.
      if (attempt < 3) {
        await user.click(screen.getByRole("button", { name: /send/i }));
        await waitFor(() => expect(mockStreamMessage).toHaveBeenCalledTimes(attempt + 1));
      }
    }

    await waitFor(() => {
      expect((screen.getByTestId("chat-attachment-image") as HTMLImageElement).src).toContain(
        "blob:restore-1",
      );
    });
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:restore-1");
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("revokes the preview URLs once the turn completes successfully (no leak)", async () => {
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restore-1");
    const user = userEvent.setup();
    renderWithProviders(<ChatInput threadId="thread-1" agentConfig={agentWithoutMcp()} />);

    await user.upload(fileInput(), pngFile());
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(mockStreamMessage).toHaveBeenCalledTimes(1));

    const onComplete = mockStreamMessage.mock.calls[0][3] as () => Promise<void> | void;
    await act(async () => {
      await onComplete();
    });

    // Success path: the backup is dropped and the preview URL is disposable.
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:restore-1");
    });
    expect(useChatStore.getState().composerBackup).toBeNull();
    expect(useChatStore.getState().pendingUserMessage).toBeNull();
  });
});
