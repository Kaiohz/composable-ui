import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderWithProviders } from "../../../utils/render";
import ThreadTabs from "@/application/components/layout/ThreadTabs";
import type { Thread } from "@/domain/entities/chat/thread";

const navigateMock = vi.fn();

vi.mock("@/application/hooks/chat/useThreads", () => ({
  useThreads: vi.fn(),
}));
vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: vi.fn(),
}));
vi.mock("@/application/hooks/chat/useCreateThread", () => ({
  useCreateThread: vi.fn(),
}));
vi.mock("@/application/stores/useChatStore", () => ({
  useChatStore: vi.fn((selector: (s: { setActiveThread: unknown }) => unknown) =>
    selector({ setActiveThread: vi.fn() }),
  ),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { useThreads } from "@/application/hooks/chat/useThreads";
import { useAgents } from "@/application/hooks/agent/useAgents";
import { useCreateThread } from "@/application/hooks/chat/useCreateThread";

function makeThread(id: string, source: Thread["source"] = "rustfs_temp"): Thread {
  return {
    id,
    agent_name: "composable-ai-assistant",
    messages: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source,
  } as Thread;
}

describe("ThreadTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one tab per thread with the truncated preview label", () => {
    vi.mocked(useThreads).mockReturnValue({
      data: [makeThread("11111111-aaaa"), makeThread("22222222-bbbb")],
      isLoading: false,
    } as never);
    vi.mocked(useAgents).mockReturnValue({
      data: [{ name: "composable-ai-assistant", model: "glm", is_builtin: true }],
      isLoading: false,
    } as never);
    vi.mocked(useCreateThread).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent("11111111");
    expect(tabs[1]).toHaveTextContent("22222222");
    expect(tabs[0]).toHaveAttribute("data-state", "active");
  });

  it("navigates to the thread when its tab is selected", async () => {
    const user = userEvent.setup();
    vi.mocked(useThreads).mockReturnValue({
      data: [makeThread("11111111-aaaa"), makeThread("22222222-bbbb")],
      isLoading: false,
    } as never);
    vi.mocked(useAgents).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useCreateThread).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    await user.click(screen.getByRole("tab", { name: /22222222/ }));

    expect(navigateMock).toHaveBeenCalledWith("/chat/22222222-bbbb");
  });

  it("opens the agent chooser from the + button and creates a thread", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn((_agent: string, opts: { onSuccess: (t: unknown) => void }) => {
      opts.onSuccess({ id: "33333333-cccc" });
    });
    vi.mocked(useThreads).mockReturnValue({
      data: [makeThread("11111111-aaaa")],
      isLoading: false,
    } as never);
    vi.mocked(useAgents).mockReturnValue({
      data: [{ name: "composable-ai-assistant", model: "glm", is_builtin: true }],
      isLoading: false,
    } as never);
    vi.mocked(useCreateThread).mockReturnValue({
      mutate,
      isPending: false,
    } as never);

    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    await user.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.getByText("Choose an Agent")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /composable-ai-assistant/ }));

    expect(mutate).toHaveBeenCalledWith("composable-ai-assistant", expect.anything());
    expect(navigateMock).toHaveBeenCalledWith("/chat/33333333-cccc");
  });

  it("shows an empty hint when no threads exist yet", () => {
    vi.mocked(useThreads).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    vi.mocked(useAgents).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useCreateThread).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);

    renderWithProvidersAndRoute(<ThreadTabs />, "/chat");

    expect(screen.getByTestId("thread-tabs-empty")).toHaveTextContent("No conversations yet");
  });
});

function renderWithProvidersAndRoute(ui: ReactElement, route: string) {
  return renderWithProviders(ui, { initialEntries: [route] });
}

describe("ThreadTabs strip navigation", () => {
  function stubStripGeometry(clientWidth: number, scrollWidth: number, scrollLeft = 0) {
    const strip = document.querySelector('[data-testid="thread-tabs-strip"]');
    if (!strip) throw new Error("strip not rendered");
    Object.defineProperty(strip, "clientWidth", { configurable: true, value: clientWidth });
    Object.defineProperty(strip, "scrollWidth", { configurable: true, value: scrollWidth });
    Object.defineProperty(strip, "scrollLeft", { configurable: true, value: scrollLeft });
    strip.dispatchEvent(new Event("scroll"));
  }

  beforeEach(() => {
    vi.mocked(useThreads).mockReturnValue({
      data: [makeThread("11111111-aaaa"), makeThread("22222222-bbbb")],
      isLoading: false,
    } as never);
    vi.mocked(useAgents).mockReturnValue({
      data: [{ name: "composable-ai-assistant", model: "glm", is_builtin: true }],
      isLoading: false,
    } as never);
    vi.mocked(useCreateThread).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  });

  it("hides both chevrons while the strip content fits", () => {
    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    expect(screen.queryByRole("button", { name: "Scroll tabs left" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Scroll tabs right" })).toBeNull();
  });

  it("shows only the right chevron at the left edge and scrolls right", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi.fn();
    Object.defineProperty(HTMLDivElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollSpy,
    });
    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    stubStripGeometry(300, 900, 0);
    await screen.findByRole("button", { name: "Scroll tabs right" });
    expect(screen.queryByRole("button", { name: "Scroll tabs left" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Scroll tabs right" }));
    expect(scrollSpy).toHaveBeenCalledWith({ left: 240, behavior: "smooth" });
  });

  it("shows both chevrons mid-strip", async () => {
    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    stubStripGeometry(300, 900, 400);
    await screen.findByRole("button", { name: "Scroll tabs left" });
    await screen.findByRole("button", { name: "Scroll tabs right" });
  });

  it("hides the right chevron at the right edge", async () => {
    renderWithProvidersAndRoute(<ThreadTabs />, "/chat/11111111-aaaa");

    stubStripGeometry(300, 900, 900);
    await screen.findByRole("button", { name: "Scroll tabs left" });
    expect(screen.queryByRole("button", { name: "Scroll tabs right" })).toBeNull();
  });
});
