/**
 * Behavioral tests — ChatInput attach button (spec chat-pdf-attachments
 * REQ-061..068, EDG-014 client side).
 *
 * Contract introduced by the spec:
 *  - a new ``agentConfig`` prop feeds the attachment policy (REQ-062):
 *    images are ALWAYS accepted, documents only when the agent config
 *    contains an MCP HTTP server whose URL ends with ``/files/mcp``;
 *  - a visual hint is shown when only images are allowed (REQ-063);
 *  - the composer shows removable previews of the selected files
 *    (REQ-067/068, AC-014);
 *  - the send button is active when text OR a valid attachment is present
 *    (REQ-064) and the stream call carries base64-encoded attachments
 *    (REQ-065) — the frontend NEVER uploads to RustFS itself (REQ-066);
 *  - oversized files are rejected client-side before send.
 */
import { screen, configure } from "@testing-library/dom";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatInput from "@/application/components/chat/ChatInput";
import { agentWithFilesMcp, agentWithoutMcp } from "../../../fixtures/chatAttachments";

configure({ testIdAttribute: "data-od-id" });

const { mockStream, mockCancel, mockStoreState } = vi.hoisted(() => {
  const mockStream = vi.fn();
  const mockCancel = vi.fn();
  const mockStoreState = {
    isStreaming: false,
  };
  return { mockStream, mockCancel, mockStoreState };
});

vi.mock("@/application/hooks/chat/useStreamChat", () => ({
  useStreamChat: () => ({
    stream: mockStream,
    cancel: mockCancel,
  }),
}));

vi.mock("@/application/stores/useChatStore", () => {
  const fn = (selector: (state: typeof mockStoreState) => unknown) => {
    return selector(mockStoreState);
  };
  fn.getState = () => mockStoreState;
  return { useChatStore: fn };
});

type ChatInputProps = {
  threadId: string;
  agentConfig?: unknown | null;
};

function renderChatInput(props: Partial<ChatInputProps> = {}) {
  return render(<ChatInput threadId="thread-1" agentConfig={null} {...props} />);
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

function pngFile(sizeBytes = 100): File {
  const content = "A".repeat(sizeBytes);
  return new File([content], "capture.png", { type: "image/png" });
}

function pdfFile(sizeBytes = 200): File {
  const content = "%PDF-1.7 " + "B".repeat(sizeBytes);
  return new File([content], "rapport.pdf", { type: "application/pdf" });
}

describe("ChatInput — attach button (REQ-061)", () => {
  beforeEach(() => {
    mockStream.mockClear();
    mockCancel.mockClear();
    mockStoreState.isStreaming = false;
    vi.clearAllMocks();
  });

  it("renders an attach button", () => {
    renderChatInput();
    expect(screen.getByTestId("chat-attach-button")).toBeInTheDocument();
  });

  it("shows a hidden file input bound to the attach button", () => {
    renderChatInput();
    expect(fileInput()).toBeInTheDocument();
  });

  it("adds a selected image to the composer preview list", async () => {
    const user = userEvent.setup();
    renderChatInput({ agentConfig: agentWithoutMcp() });

    await user.upload(fileInput(), pngFile());

    await waitFor(() => {
      expect(screen.getByTestId("chat-attachment-list")).toBeInTheDocument();
    });
    expect(screen.getByTestId("chat-attachment-image")).toBeInTheDocument();
    expect(screen.getByAltText("capture.png")).toBeInTheDocument();
  });

  it("makes the send submit available with an attachment and EMPTY text (REQ-064)", async () => {
    const user = userEvent.setup();
    renderChatInput({ agentConfig: agentWithoutMcp() });

    await user.upload(fileInput(), pngFile());
    const send = screen.getByRole("button", { name: /send/i });
    expect(send).toBeEnabled();

    await user.click(send);

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledTimes(1);
    });
    const payload = mockStream.mock.calls[0][0] as { attachments?: Array<{ filename: string }> };
    expect(payload.attachments).toEqual([expect.objectContaining({ filename: "capture.png" })]);
  });

  it("encodes attachments as base64 at send time (REQ-065) and clears the composer", async () => {
    const user = userEvent.setup();
    renderChatInput({ agentConfig: agentWithoutMcp() });

    await user.upload(fileInput(), pngFile());
    await user.type(screen.getByPlaceholderText("Orchestrate your next move..."), "regarde ça");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledTimes(1);
    });
    const payload = mockStream.mock.calls[0][0] as {
      message?: string;
      attachments?: Array<{ filename: string; content_type: string; content_base64?: string }>;
    };
    expect(payload.message).toBe("regarde ça");
    expect(payload.attachments?.[0]).toMatchObject({
      filename: "capture.png",
      content_type: "image/png",
    });
    expect(payload.attachments?.[0].content_base64).toBeTruthy();
    expect(payload.attachments?.[0].content_base64).not.toMatch(/^data:/);
  });

  it("lets the user REMOVE a pending attachment before send (REQ-068, AC-014)", async () => {
    const user = userEvent.setup();
    renderChatInput({ agentConfig: agentWithoutMcp() });

    await user.upload(fileInput(), pngFile());
    const remove = screen.getByTestId("chat-attachment-remove");
    await user.click(remove);

    await waitFor(() => {
      expect(screen.queryByTestId("chat-attachment-list")).not.toBeInTheDocument();
    });
    expect(mockStream).not.toHaveBeenCalled();
  });
});

describe("ChatInput — attachment policy (REQ-062/063)", () => {
  beforeEach(() => {
    mockStream.mockClear();
    mockStoreState.isStreaming = false;
    vi.clearAllMocks();
  });

  it("documents are accepted when the agent config has a /files/mcp server", async () => {
    const user = userEvent.setup();
    const { container } = renderChatInput({ agentConfig: agentWithFilesMcp() });

    const input = fileInput();
    expect(input.accept).toContain("application/pdf");
    // Images remain accepted too.
    expect(input.accept).toContain("image/png");

    await user.upload(input, pdfFile());
    await waitFor(() => {
      expect(screen.getByTestId("chat-attachment-list")).toBeInTheDocument();
    });
    expect(container.querySelector('[data-od-id="chat-attachment-file"]')).not.toBeNull();
    expect(screen.getByText(/rapport\.pdf/)).toBeInTheDocument();
  });

  it("documents are NOT accepted without /files/mcp — with a visual hint (REQ-063)", async () => {
    const user = userEvent.setup();
    const { container } = renderChatInput({ agentConfig: agentWithoutMcp() });

    const input = fileInput();
    expect(input.accept).toContain("image/png");
    expect(input.accept).not.toContain("application/pdf");
    // REQ-063 visual hint explaining that only images are allowed.
    expect(container.querySelector('[data-od-id="chat-attach-hint"]')).not.toBeNull();

    await user.upload(input, pdfFile());

    await waitFor(() => {
      expect(screen.queryByTestId("chat-attachment-list")).not.toBeInTheDocument();
    });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("the classical MCP server does NOT unlock documents (EDG-009 client side)", () => {
    const user = userEvent.setup();
    renderChatInput({
      agentConfig: {
        mcp_servers: [
          {
            name: "classical",
            transport: "http",
            args: [],
            url: "https://x/classical/mcp",
            headers: {},
            env: {},
          },
        ],
      },
    });

    expect(fileInput().accept).not.toContain("application/pdf");
    void user;
  });
});

describe("ChatInput — client-side size guard", () => {
  beforeEach(() => {
    mockStream.mockClear();
    mockStoreState.isStreaming = false;
    vi.clearAllMocks();
  });

  it("rejects an image over 10 MiB client-side and shows an explicit error", async () => {
    const user = userEvent.setup();
    renderChatInput({ agentConfig: agentWithoutMcp() });

    await user.upload(fileInput(), pngFile(10 * 1024 * 1024 + 1));

    await waitFor(() => {
      expect(screen.queryByTestId("chat-attachment-list")).not.toBeInTheDocument();
    });
    // The rejection must be EXPLICIT (an error surface mentions the limit/file).
    const errorText =
      screen.queryByText(/10\s*MiB|trop|too large|exceeds/i) ??
      screen.queryByRole("alert") ??
      document.querySelector('[data-od-id="chat-attach-error"]');
    expect(errorText).not.toBeNull();
    expect(mockStream).not.toHaveBeenCalled();
  });
});

describe("Builtin capabilities + thinking level selector", () => {
  type AgentLike = { capabilities?: { files_mcp?: boolean }; mcp_servers?: unknown[] };

  const builtinAgent: AgentLike = {
    capabilities: { files_mcp: true },
    mcp_servers: [],
  };

  it("documents are accepted when the backend declares capabilities.files_mcp", () => {
    // The built-in assistant mounts its Files MCP SERVER-side: the
    // server-declared capability flag replaces the (forced empty) mcp_servers.
    const { container } = renderChatInput({ agentConfig: builtinAgent as never });

    const input = fileInput();
    expect(input.accept).toContain("application/pdf");
    expect(container.querySelector('[data-od-id="chat-attach-hint"]')).toBeNull();
  });

  it("exposes the thinking-level selector and sends the selected effort", async () => {
    const user = userEvent.setup();
    // Persisted store starts at "off" — reset it for this test's assertion.
    localStorage.setItem(
      "composable-ui-thinking",
      JSON.stringify({ state: { level: "high" }, version: 0 }),
    );
    const { useThinkingLevelStore } = await import("@/application/stores/useThinkingLevelStore");
    useThinkingLevelStore.setState({ level: "high" });

    renderChatInput({ agentConfig: agentWithoutMcp() });

    const trigger = screen.getByTestId("chat-thinking-select");
    expect(trigger.textContent).toContain("Thinking high");

    const textarea = screen.getByRole("textbox", { name: /chat message input/i });
    await user.type(textarea, "hello");
    const send = screen.getByRole("button", { name: /send/i });
    await user.click(send);

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledTimes(1);
    });
    const payload = mockStream.mock.calls[0][0] as { reasoning_effort?: string };
    expect(payload.reasoning_effort).toBe("high");

    // "off" omits the field entirely (backend applies no reasoning payload).
    useThinkingLevelStore.setState({ level: "off" });
    mockStream.mockClear();
    await user.type(textarea, "again");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledTimes(1);
    });
    expect(
      (mockStream.mock.calls[0][0] as { reasoning_effort?: string }).reasoning_effort,
    ).toBeUndefined();
    useThinkingLevelStore.setState({ level: "off" });
  });
});

describe("Thinking selector — real user interaction", () => {
  it("changes level via the Radix dropdown and persists it", async () => {
    const user = userEvent.setup();
    renderChatInput({ agentConfig: agentWithoutMcp() });

    const trigger = screen.getByTestId("chat-thinking-select");
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain("Thinking off");

    // Open the Radix dropdown and pick "medium" like a real user.
    await user.click(trigger);
    const option = await screen.findByRole(
      "option",
      { name: "Thinking medium" },
      { timeout: 2000 },
    );
    await user.click(option);

    const { useThinkingLevelStore } = await import("@/application/stores/useThinkingLevelStore");
    expect(useThinkingLevelStore.getState().level).toBe("medium");
    // Reload the component: the persisted state feeds back the selection.
    useThinkingLevelStore.setState({ level: "off" });
  });
});
