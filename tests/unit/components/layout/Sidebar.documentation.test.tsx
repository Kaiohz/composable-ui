/**
 * Spec: add-user-documentation.md — REQ-001, REQ-002, REQ-006, REQ-014, REQ-015
 * Sidebar must gain a "Documentation" item in the existing System group
 * (alongside Settings), using the existing NavLink/data-od-id/active-state
 * conventions. Selecting it must open the in-app /documentation route (no new
 * tab, no external site). The item must follow the existing keyboard/focus
 * conventions and close the mobile drawer on selection.
 *
 * Step-1 (Red): SYSTEM_ITEMS does not include a Documentation entry yet.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import Sidebar from "@/application/components/layout/Sidebar";
import { useSidebarStore } from "@/application/stores/useSidebarStore";

vi.mock("@/application/hooks/auth/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}));

import { useCurrentUser } from "@/application/hooks/auth/useCurrentUser";

describe("Sidebar — Documentation navigation entry", () => {
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

  it("renders a Documentation nav link pointing to /documentation with a stable data-od-id", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/chat"] });

    const link = screen.getByRole("link", { name: /^documentation$/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/documentation");
    expect(link).toHaveAttribute("data-od-id", "nav-documentation");
  });

  it("groups Documentation with the System navigation alongside Settings", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/chat"] });

    const systemHeading = screen.getByText("System");
    const systemGroup = systemHeading.closest("div")?.parentElement ?? null;
    expect(systemGroup).not.toBeNull();

    const systemScope = within(systemGroup as HTMLElement);
    expect(systemScope.getByRole("link", { name: /^documentation$/i })).toBeInTheDocument();
    expect(systemScope.getByRole("link", { name: /^settings$/i })).toBeInTheDocument();
  });

  it("does not open a new tab or an external site (in-app route only)", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/chat"] });

    const link = screen.getByRole("link", { name: /^documentation$/i });
    expect(link.getAttribute("href")).toMatch(/^\/documentation$/);
    expect(link).not.toHaveAttribute("target", "_blank");
    expect(link).not.toHaveAttribute("rel", /external/);
  });

  it("marks the Documentation entry active on /documentation section routes", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/documentation/agents"] });

    const link = screen.getByRole("link", { name: /^documentation$/i });
    // Active state uses the accent left border + accent text presentation
    // (existing NAV_LINK_ACTIVE convention).
    expect(link.className).toMatch(/accent/);
  });

  it("does not mark the Documentation entry active on unrelated routes", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/chat"] });

    const link = screen.getByRole("link", { name: /^documentation$/i });
    expect(link.className).not.toMatch(/border-l-accent/);
  });

  it("keeps the existing keyboard focus conventions on the Documentation link", () => {
    renderWithProviders(<Sidebar />, { initialEntries: ["/chat"] });

    const link = screen.getByRole("link", { name: /^documentation$/i });

    // Anchor links are natively keyboard-reachable; focusing it must be
    // possible and the existing visible-focus convention must apply.
    link.focus();
    expect(document.activeElement).toBe(link);
    // Existing convention: visible focus via focus-visible shadow utility.
    expect(link.className).toMatch(/focus-visible/);
  });

  it("closes the mobile drawer when the Documentation link is clicked", async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ isOpen: true });

    renderWithProviders(<Sidebar />, { initialEntries: ["/documentation"] });

    expect(useSidebarStore.getState().isOpen).toBe(true);

    await user.click(screen.getByRole("link", { name: /^documentation$/i }));

    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});
