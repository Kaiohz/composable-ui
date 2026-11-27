/**
 * Spec: scope-rag-memories-user-agent.md — REQ-026.
 *
 * Behavioral entry point: the REAL shared component rendered with RTL under a
 * real QueryClient; the network boundary (GET /api/v1/spaces, GET
 * /api/v1/agents) is scripted through the real axios clients (repo convention,
 * cf. McpRegistryPage behavioral tests — MSW is not installed in this repo).
 *
 * Contract under test (REQ-026):
 * - lives at `src/application/components/shared/SpaceSelector.tsx`, next to
 *   `ThreadSourceBadge`, as ONE shared component for both pages;
 * - built on the existing design-system primitives
 *   (`src/application/components/ui/select.tsx`) — no new dependency;
 * - WAI-ARIA labelling consistent with `WorkspaceSelector` (`sr-only`,
 *   `aria-*`) with `data-od-id="space-selector"`;
 * - lists all the user's real spaces from `GET /api/v1/spaces`: `Personal`
 *   first, builtin platform agents first among agents, external (lazily
 *   created) scopes as ordinary space entries — exactly one Personal entry.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SpaceSelector from "@/application/components/shared/SpaceSelector";
import { renderWithProviders } from "../../utils/render";
import { restoreAllNetworks, stubNetwork, route } from "../../utils/network";
import {
  AGENTS_CATALOG,
  EXPECTED_SPACE_LABELS,
  SCRAMBLED_SPACES,
  SPACES_WITH_PERSONAL,
  type SpaceRecord,
} from "../../fixtures/spaces";

const SHARED_COMPONENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/application/components/shared",
);

function stubSpaces(spaces: readonly SpaceRecord[] = SCRAMBLED_SPACES, spacesStatus = 200) {
  return stubNetwork([
    // GET /api/v1/spaces is served by mcp-raganything — the "rag" client.
    route("rag", "GET", /\/api\/v1\/spaces$/, () => ({ status: spacesStatus, data: spaces })),
    route("api", "GET", /\/api\/v1\/agents$/, () => ({ status: 200, data: [...AGENTS_CATALOG] })),
  ]);
}

/** Radix Select trigger of the shared space selector (WorkspaceSelector's
 * accessible label never matches /space/i, so no role collision). */
function getTrigger(): HTMLElement {
  return screen.getByRole("combobox", { name: /space/i });
}

function expectWiredDataOdId(trigger: HTMLElement): HTMLElement {
  const root = trigger.closest('[data-od-id="space-selector"]');
  expect(root, 'space selector must carry data-od-id="space-selector"').not.toBeNull();
  return root as HTMLElement;
}

async function openList(): Promise<HTMLElement> {
  const user = userEvent.setup();
  await user.click(getTrigger());
  return screen.getByRole("listbox");
}

afterEach(() => {
  restoreAllNetworks();
});

describe("SpaceSelector (REQ-026 — one shared, design-system-compliant component)", () => {
  it("lives next to ThreadSourceBadge and declares the shared design-system contract", () => {
    const componentPath = path.join(SHARED_COMPONENTS_DIR, "SpaceSelector.tsx");
    expect(existsSync(componentPath)).toBe(true);

    const source = readFileSync(componentPath, "utf8");
    // Built exclusively on the existing select primitives, with the shared
    // QA attribute — no divergent visual language.
    expect(source.includes('from "@/application/components/ui/select"')).toBe(true);
    expect(source).toContain('data-od-id="space-selector"');
  });

  it("renders an accessible select with data-od-id='space-selector' and shows the selected space", async () => {
    stubSpaces();
    renderWithProviders(<SpaceSelector value="personal" onChange={() => {}} />);

    const trigger = await screen.findByRole("combobox", { name: /space/i });
    expectWiredDataOdId(trigger);
    expect(trigger).toHaveTextContent("Personal");
  });

  it("shows every real space in the required order: Personal first, builtin agents first among agents, external scopes last", async () => {
    stubSpaces();
    renderWithProviders(<SpaceSelector value="personal" onChange={() => {}} />);

    const listbox = await openList();
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(labels).toHaveLength(EXPECTED_SPACE_LABELS.length);
    for (const [index, expected] of EXPECTED_SPACE_LABELS.entries()) {
      expect(
        labels[index],
        `space option ${index} must display ${expected} (Personal first + builtin-first agents + external scopes)`,
      ).toContain(expected);
    }
  });

  it("reports the selected space through onChange with its agent slug ('personal' for Personal)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    stubSpaces();
    const view = renderWithProviders(<SpaceSelector value="personal" onChange={onChange} />);

    await user.click(await screen.findByRole("combobox", { name: /space/i }));
    await user.click(await screen.findByRole("option", { name: /agent-zeta/i }));
    expect(onChange).toHaveBeenCalledWith("agent-zeta");

    // Controlled contract: the caller owns the value.
    view.rerender(<SpaceSelector value="agent-zeta" onChange={onChange} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /space/i })).toHaveTextContent("agent-zeta"),
    );

    await user.click(screen.getByRole("combobox", { name: /space/i }));
    await user.click(await screen.findByRole("option", { name: /Personal/i }));
    expect(onChange).toHaveBeenCalledWith("personal");
  });

  it("keeps rendering (no crash, no space options) while the spaces list is still loading", async () => {
    stubNetwork([
      route(
        "rag",
        "GET",
        /\/api\/v1\/spaces$/,
        () => new Promise(() => ({ status: 200, data: [] })),
      ),
      route(
        "api",
        "GET",
        /\/api\/v1\/agents$/,
        () => new Promise(() => ({ status: 200, data: [] })),
      ),
    ]);
    renderWithProviders(<SpaceSelector value="personal" onChange={() => {}} />);

    await screen.findByRole("combobox", { name: /space/i });
    expect(screen.queryByText("composable-ai-assistant")).toBeNull();
  });

  it("surfaces a graceful error state (selector intact) when GET /api/v1/spaces fails", async () => {
    stubSpaces(SPACES_WITH_PERSONAL, 500);
    renderWithProviders(<SpaceSelector value="personal" onChange={() => {}} />);

    const bar = expectWiredDataOdId(await screen.findByRole("combobox", { name: /space/i }));
    await waitFor(() => expect(bar.textContent).toMatch(/failed|unable|error|retry/i));
  });

  it("offers only the Personal space when the user has no other space yet", async () => {
    stubSpaces([]);
    renderWithProviders(<SpaceSelector value="personal" onChange={() => {}} />);

    await screen.findByRole("combobox", { name: /space/i });
    const listbox = await openList();
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(labels).toHaveLength(1);
    expect(labels[0]).toContain("Personal");
  });

  it("renders exactly one Personal entry even when the backend includes a personal record", async () => {
    stubSpaces(SPACES_WITH_PERSONAL);
    renderWithProviders(<SpaceSelector value="personal" onChange={() => {}} />);

    await screen.findByRole("combobox", { name: /space/i });
    const listbox = await openList();
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("Personal");
    // The OTHER spaces must survive the personal row (REQ-021: all real spaces).
    expect(labels[1]).toContain("opencode");
  });
});
