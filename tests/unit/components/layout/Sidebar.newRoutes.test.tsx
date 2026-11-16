/**
 * Spec: prompts-models-crons-traces.md §4, §2.1
 * Sidebar must gain four destinations (Prompts, Models, Crons, Traces),
 * ordered after Agents and before the existing workspace/system destinations,
 * following the existing NAV_ITEMS NavLink/data-od-id/active-state patterns
 * and the mobile drawer behavior of AppShell.
 *
 * Step-1 (Red): NAV_ITEMS does not include the new destinations yet.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import Sidebar from "@/application/components/layout/Sidebar";
import { useSidebarStore } from "@/application/stores/useSidebarStore";

vi.mock("@/application/hooks/auth/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}));

import { useCurrentUser } from "@/application/hooks/auth/useCurrentUser";

// Route change must actually resolve the four new pages: mock pages to keep
// the router render minimal (repo convention from App tests).
vi.mock("@/application/pages/ChatPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/SettingsPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/AgentsPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/RagPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/SkillsPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/MemoriesPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/McpRegistryPage", () => ({
  default: () => <div />,
}));
vi.mock("@/application/pages/PromptsPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/ModelsPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/CronsPage", () => ({ default: () => <div /> }));
vi.mock("@/application/pages/TracesPage", () => ({ default: () => <div /> }));

describe("Sidebar — new registry navigation entries", () => {
  beforeEach(() => {
    vi.mocked(useCurrentUser).mockReturnValue({
      profile: {
        userId: "user-123",
        email: "jane@example.com",
        name: "Jane Doe",
        username: "jane",
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    useSidebarStore.setState({ isOpen: false });
  });

  it("renders a Prompts nav link pointing to /prompts with stable data-od-id", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/prompts"] });

    const link = screen.getByRole("link", { name: /prompts/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/prompts");
    expect(link).toHaveAttribute("data-od-id", "nav-prompts");
  });

  it("renders a Models nav link pointing to /models with stable data-od-id", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/models"] });

    const link = screen.getByRole("link", { name: /models/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/models");
    expect(link).toHaveAttribute("data-od-id", "nav-models");
  });

  it("renders a Crons nav link pointing to /crons with stable data-od-id", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/crons"] });

    const link = screen.getByRole("link", { name: /crons/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/crons");
    expect(link).toHaveAttribute("data-od-id", "nav-crons");
  });

  it("renders a Traces nav link pointing to /traces with stable data-od-id", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/traces"] });

    const link = screen.getByRole("link", { name: /traces/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/traces");
    expect(link).toHaveAttribute("data-od-id", "nav-traces");
  });

  it("places the four destinations after Agents and before the workspace/system items", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/chat"] });

    const labels = screen.getAllByRole("link").map((link) => link.textContent ?? "");

    const agentsIndex = labels.findIndex((l) => /agents/i.test(l));
    const settingsIndex = labels.findIndex((l) => /settings/i.test(l));

    const destinations = [
      { name: "Prompts", pattern: /prompts/i },
      { name: "Models", pattern: /models/i },
      { name: "Crons", pattern: /crons/i },
      { name: "Traces", pattern: /traces/i },
    ] as const;

    for (const { name, pattern } of destinations) {
      const index = labels.findIndex((l) => pattern.test(l));
      expect(index, `${name} nav link should exist`).toBeGreaterThan(-1);
      expect(index, `${name} must come after Agents`).toBeGreaterThan(agentsIndex);
      expect(index, `${name} must come before System items`).toBeLessThan(settingsIndex);
    }
  });

  it("marks the Traces entry active when its route matches", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/traces"] });

    const link = screen.getByRole("link", { name: /traces/i });
    // Active state uses the accent left border + accent text (existing
    // NAV_LINK_ACTIVE presentation).
    expect(link.className).toMatch(/accent/);
  });

  it("marks the Crons entry active on /crons and not the Agents entry", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/crons"] });

    expect(screen.getByRole("link", { name: /crons/i }).className).toMatch(/accent/);
    const agents = screen.getAllByRole("link").find((l) => /agents/i.test(l.textContent ?? ""));
    expect(agents?.className).not.toMatch(/accent/);
  });

  it("closes the mobile drawer when a new destination link is clicked", async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ isOpen: true });

    renderWithProviders(<Sidebar />, { initialEntries: ["/prompts"] });

    expect(useSidebarStore.getState().isOpen).toBe(true);

    await user.click(screen.getByRole("link", { name: /prompts/i }));

    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});
