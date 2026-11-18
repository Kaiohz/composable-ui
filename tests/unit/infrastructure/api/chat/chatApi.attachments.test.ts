/**
 * Behavioral tests — ChatRequest attachments serialization (REQ-001).
 *
 * The frontend ``ChatRequest`` entity carries an optional ``attachments``
 * array (filename / content_type / content_base64) that MUST be serialized
 * into the POST body of both chat entry points:
 *  - ``POST /api/v1/chat/{thread_id}``          (chatApi.sendMessage)
 *  - ``POST /api/v1/chat/{thread_id}/stream``   (chatApi.streamMessage)
 *
 * The outbound HTTP boundary is mocked at the axios / fetch-event-source
 * module boundary (repo-wide convention; no RustFS upload from the frontend
 * is ever performed — REQ-066).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatApi } from "@/infrastructure/api/chat/chatApi";
import { apiClient } from "@/infrastructure/api/axiosInstance";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { createMessage } from "../../../../fixtures/external";

vi.mock("@/infrastructure/api/axiosInstance", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

vi.mock("@/infrastructure/config/configRepositoryInstance", () => ({
  configRepository: {
    getConfig: vi.fn().mockResolvedValue({ apiBaseUrl: "http://localhost:8010" }),
  },
}));

const ATTACHMENTS = [
  {
    filename: "capture.png",
    content_type: "image/png",
    content_base64: "iVBORw0KGgoAAAANSU=",
  },
  {
    filename: "rapport.pdf",
    content_type: "application/pdf",
    content_base64: "JVBERi0xLjcK",
  },
];

describe("chatApi — ChatRequest attachments serialization (REQ-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes the attachments array in the sendMessage POST body", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: createMessage() });

    await chatApi.sendMessage("thread-123", { message: "Analyse", attachments: ATTACHMENTS });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/chat/thread-123",
      { message: "Analyse", attachments: ATTACHMENTS },
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as Record<string, unknown>;
    expect(body.attachments).toEqual(ATTACHMENTS);
    expect((body.attachments as unknown[]).length).toBe(2);
  });

  it("serializes the attachments array into the streamMessage body (JSON)", async () => {
    vi.mocked(fetchEventSource).mockResolvedValue(undefined);

    chatApi.streamMessage(
      "thread-123",
      { attachments: ATTACHMENTS },
      () => {},
      () => {},
      () => {},
    );

    await vi.waitFor(() => {
      expect(fetchEventSource).toHaveBeenCalled();
    });
    const [, options] = vi.mocked(fetchEventSource).mock.calls[0] as unknown as [
      string,
      { body: string; method: string },
    ];
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body) as Record<string, unknown>;
    expect(body.attachments).toEqual(ATTACHMENTS);
  });

  it("still supports payloads without attachments unchanged (REQ-003 / AC-011)", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: createMessage() });

    await chatApi.sendMessage("thread-123", { message: "plain text" });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/chat/thread-123",
      { message: "plain text" },
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });
});
