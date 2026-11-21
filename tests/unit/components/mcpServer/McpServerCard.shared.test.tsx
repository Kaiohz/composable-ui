/**
 * Spec: unify-cards-modals.md — Shared resource cards
 * (CARD-003, CARD-004, CARD-005, CARD-008, CARD-012).
 *
 * MCP server cards must receive the full shared treatment (icon block,
 * normalized title/badge composition, separated footer) and the
 * Agent-reference icon-only delete treatment with a target-specific
 * accessible name, while keeping source, transport, URL, tool count,
 * date and Edit behavior.
 *
 * Step-1 (Red): McpServerCard lacks the icon block and its delete button
 * has a generic "Delete" accessible name.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import { McpServerCard } from "@/application/components/mcpServer/McpServerCard";
import { McpTransportType } from "@/domain/entities/agent/mcpServerConfig";

function makeServer(overrides: Record<string, unknown> = {}) {
  return {
    name: "weather",
    transport: McpTransportType.HTTP,
    url: "https://example.com/mcp",
    headers: {},
    env: {},
    auth_token: null,
    tool_count: 5,
    created_at: "2026-04-06T10:00:00Z",
    updated_at: "2026-04-06T10:00:00Z",
    source_type: "external",
    openapi_url: null,
    ...overrides,
  };
}

const REFERENCE_ICON_BLOCK_TOKENS = ["h-12", "w-12", "bg-surface-warm", "text-accent"] as const;

describe("McpServerCard shared resource-card treatment", () => {
  it("renders the square Agent-reference icon block with a Lucide icon (CARD-004)", () => {
    const { container } = renderWithProviders(
      <McpServerCard server={makeServer() as never} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    const card = container.querySelector('[data-od-id="mcp-server-card-weather"]');
    expect(card).not.toBeNull();
    const iconBlock = card?.querySelector("div[class*='h-12'][class*='w-12']");
    expect(iconBlock).not.toBeNull();
    for (const token of REFERENCE_ICON_BLOCK_TOKENS) {
      expect(iconBlock?.classList.contains(token)).toBe(true);
    }
    expect(iconBlock?.querySelector("svg")).not.toBeNull();
  });

  it("keeps the display text-lg title and the source/transport badges (CARD-005)", () => {
    renderWithProviders(
      <McpServerCard server={makeServer() as never} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    const title = screen.getByText("weather");
    expect(title.tagName).toBe("H3");
    expect(title.classList.contains("text-lg")).toBe(true);
    expect(screen.getByText("External")).toBeInTheDocument();
    expect(screen.getByText(McpTransportType.HTTP)).toBeInTheDocument();
  });

  it("keeps URL, tool count and created date content (CARD-006)", () => {
    renderWithProviders(
      <McpServerCard server={makeServer() as never} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText(/example\.com\/mcp/)).toBeInTheDocument();
    expect(screen.getByText(/5 tools/)).toBeInTheDocument();
    expect(screen.getByText(/created 2026-04-06/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
  });

  it("keeps the raised/hover treatment and the top-separated footer (CARD-003, CARD-007)", () => {
    const { container } = renderWithProviders(
      <McpServerCard server={makeServer() as never} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    const card = container.querySelector('[data-od-id="mcp-server-card-weather"]');
    const tokens = ["block-shadow-raised", "hover:-translate-y-0.5", "hover:border-accent"];
    for (const token of tokens) {
      expect(card?.classList.contains(token)).toBe(true);
    }
    const footer = Array.from(card?.children ?? []).find((child) =>
      child.classList.contains("mt-auto"),
    );
    for (const token of ["mt-auto", "border-t", "border-border-soft", "pt-2"]) {
      expect(footer?.classList.contains(token)).toBe(true);
    }
  });

  it("renders delete as an icon-only trash button with a target-specific accessible name (CARD-008)", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWithProviders(
      <McpServerCard server={makeServer() as never} onEdit={vi.fn()} onDelete={onDelete} />,
    );

    const deleteButton = screen.getByRole("button", { name: /delete weather/i });
    expect(deleteButton.textContent).not.toMatch(/delete/i);

    await user.click(deleteButton);
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith("weather");
  });
});
