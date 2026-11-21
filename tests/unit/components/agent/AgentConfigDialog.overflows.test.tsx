/**
 * Spec: unify-cards-modals.md — MODAL-005, MODAL-008.
 *
 * Structured Agent dialogs keep their intentional fixed header/footer
 * shells (`overflow-hidden` + `p-0`) while the body must own a reliable
 * scroll region (`min-h-0` + `overflow-y-auto` + `overscroll-contain`).
 * Both the create dialog and the Agent configuration dialog (view AND edit
 * modes) must satisfy this contract.
 *
 * Step-1 (Red): the create-dialog body lacks `min-h-0`, and the Agent
 * configuration dialog edit mode renders the form without any scrollable
 * body region at all — the `overflow-hidden` shell would clip tall content.
 */
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import AgentConfigViewer from "@/application/components/agent/AgentConfigViewer";
import CreateAgentDialog from "@/application/components/agent/CreateAgentDialog";
import type { AgentConfig } from "@/domain/entities/agent/agentConfig";
import { BackendType } from "@/domain/entities/agent/agentConfig";

const { mockAgentConfigData, mockDeleteMutate, mockUpdateMutate, mockResetMutate } = vi.hoisted(
  () => ({
    mockAgentConfigData: {
      data: undefined as AgentConfig | undefined,
      isLoading: false,
    },
    mockDeleteMutate: vi.fn(),
    mockUpdateMutate: vi.fn(),
    mockResetMutate: vi.fn(),
  }),
);

vi.mock("@/application/hooks/agent/useAgentConfig", () => ({
  useAgentConfig: () => mockAgentConfigData,
}));

vi.mock("@/application/hooks/agent/useDeleteAgent", () => ({
  useDeleteAgent: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

vi.mock("@/application/hooks/agent/useUpdateAgent", () => ({
  useUpdateAgent: () => ({ mutate: mockUpdateMutate, isPending: false }),
}));

vi.mock("@/application/hooks/agent/useResetBuiltinCustomization", () => ({
  useResetBuiltinCustomization: () => ({ mutate: mockResetMutate, isPending: false }),
}));

vi.mock("@/application/hooks/agent/useAgents", () => ({
  useAgents: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("@/application/hooks/agent/useCreateAgent", () => ({
  useCreateAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/application/hooks/prompt/usePrompts", () => ({
  usePrompts: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/application/hooks/prompt/usePromptVersions", () => ({
  usePromptVersions: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/application/hooks/model/useModels", () => ({
  useModels: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/application/hooks/mcpServer/useMcpRegistry", () => ({
  useMcpRegistry: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/application/lib/yaml", () => ({
  serializeAgentConfig: vi.fn(() => "name: test-agent"),
  agentConfigToYamlFile: vi.fn(() => new File(["yaml"], "test-agent.yaml")),
}));

vi.mock("@/infrastructure/api/store/storeApi", () => ({
  storeApi: {
    listFiles: vi.fn().mockResolvedValue([]),
    getFile: vi.fn().mockResolvedValue(null),
    putFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/application/hooks/store/useStoreFiles", () => ({
  useStoreFiles: () => ({ data: [], isLoading: false, error: null }),
}));

const config: AgentConfig = {
  name: "test-agent",
  model: "openai:gpt-4o",
  system_prompt: "You are a helpful assistant.",
  tools: ["search"],
  backend: {
    type: BackendType.STORE,
    checkpoint_backend: "memory",
  },
  hitl: { rules: {} },
  memory: [],
  skills: [],
  subagents: [],
  mcp_servers: [],
  debug: false,
};

function getDialogContent(): HTMLElement {
  const dialog = screen.getByRole("dialog");
  if (!(dialog instanceof HTMLElement)) throw new Error("dialog is not an HTMLElement");
  return dialog;
}

/** Walks from `el` up to `root` looking for a vertical scroll region. */
function findScrollableAncestor(el: Element, root: Element): HTMLElement | null {
  let node: Element | null = el;
  while (node && node !== root) {
    if (
      node instanceof HTMLElement &&
      (node.classList.contains("overflow-y-auto") ||
        node.hasAttribute("data-radix-scroll-area-viewport"))
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

describe("Agent structured dialog overflow structure", () => {
  beforeEach(() => {
    mockAgentConfigData.data = undefined;
    mockAgentConfigData.isLoading = false;
  });

  it("keeps the create dialog shell structured and its body scrollable with overscroll containment (MODAL-005)", () => {
    renderWithProviders(<CreateAgentDialog open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    const dialog = getDialogContent();
    expect(dialog.classList.contains("overflow-hidden")).toBe(true);

    const body = findScrollableAncestor(
      document.getElementById("agent-config-form") ?? dialog,
      dialog,
    );
    expect(body).not.toBeNull();
    expect(body?.classList.contains("overscroll-contain")).toBe(true);
  });

  it("gives the create dialog body min-h-0 so flex clipping cannot hide content (MODAL-005)", () => {
    renderWithProviders(<CreateAgentDialog open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    const dialog = getDialogContent();
    const body = findScrollableAncestor(
      document.getElementById("agent-config-form") ?? dialog,
      dialog,
    );
    expect(body?.classList.contains("min-h-0")).toBe(true);
  });

  it("view mode scrolls the configuration body in a defined body region (MODAL-005)", () => {
    mockAgentConfigData.data = config;
    renderWithProviders(<AgentConfigViewer agentName="test-agent" open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    const dialog = getDialogContent();
    expect(dialog.classList.contains("overflow-hidden")).toBe(true);
    expect(screen.getByText("openai:gpt-4o")).toBeInTheDocument();

    const scrollRegion = findScrollableAncestor(screen.getByText("openai:gpt-4o"), dialog);
    expect(scrollRegion).not.toBeNull();
    // BUG-003: the BODY itself (a plain element) owns the scroll region —
    // not a Radix ScrollArea viewport, whose percentage height is indefinite
    // inside a max-height shell and grew to content height (clipping).
    expect(scrollRegion?.hasAttribute("data-radix-scroll-area-viewport")).toBe(false);
    expect(scrollRegion?.classList.contains("overflow-y-auto")).toBe(true);
    expect(scrollRegion?.classList.contains("min-h-0")).toBe(true);
    expect(scrollRegion?.classList.contains("overscroll-contain")).toBe(true);
    expect(scrollRegion?.classList.contains("flex-1")).toBe(true);
  });

  it("gives the view body the same bounded pattern as the edit body (BUG-003)", () => {
    mockAgentConfigData.data = config;
    renderWithProviders(<AgentConfigViewer agentName="test-agent" open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    // One bounded scroll body per mode, both with the identical contract:
    // min-h-0 + flex-1 + overflow-y-auto + overscroll-contain inside the
    // overflow-hidden shell.
    const bodies = document.querySelectorAll(
      "div.min-h-0.flex-1.overflow-y-auto.overscroll-contain",
    );
    expect(bodies.length).toBe(1);
    expect(bodies[0].classList.contains("bg-surface")).toBe(true);
  });

  it("renders exactly one submit control and one Cancel in the create dialog (BUG-001)", () => {
    renderWithProviders(<CreateAgentDialog open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    const dialog = getDialogContent();
    // One submit control: the pinned "Create Agent" — the form's internal
    // "Create" row (visible ≥ lg) is suppressed via hideActions.
    const submits = within(dialog).getAllByRole("button", { name: /^create agent$/i });
    expect(submits).toHaveLength(1);
    expect(within(dialog).queryByRole("button", { name: /^create$/i })).toBeNull();
    // One Cancel: the pinned footer's.
    expect(within(dialog).getAllByRole("button", { name: /^cancel$/i })).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Create Agent" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("edit mode renders the form inside an overflow-hidden shell with a functioning scroll region (MODAL-005, MODAL-008)", async () => {
    const user = userEvent.setup();
    mockAgentConfigData.data = config;
    renderWithProviders(<AgentConfigViewer agentName="test-agent" open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    // The Edit button carries paired desktop/mobile text spans; match the
    // visible label loosely.
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const dialog = getDialogContent();
    expect(within(dialog).getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    const form = document.getElementById("agent-config-form");
    expect(form).not.toBeNull();

    const scrollRegion = findScrollableAncestor(form as Element, dialog);
    expect(scrollRegion).not.toBeNull();
    expect(scrollRegion?.classList.contains("min-h-0")).toBe(true);
    // The overflow-hidden shell must never clip the body: the body itself
    // owns the scroll region.
    expect(scrollRegion).not.toBe(dialog);
  });

  it("keeps Cancel and Save reachable from the edit mode footer (MODAL-005)", async () => {
    const user = userEvent.setup();
    mockAgentConfigData.data = config;
    renderWithProviders(<AgentConfigViewer agentName="test-agent" open onOpenChange={vi.fn()} />, {
      initialEntries: ["/agents"],
    });

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });
});
