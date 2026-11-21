/**
 * Shared ResourceCard family contract (spec unify-cards-modals CARD-003..010,
 * review I5). The primitive is the single source of truth for the
 * Agent-reference card treatment, so it is exercised directly with the real
 * `Button` underneath — nothing external to mock.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Cpu, FileText } from "lucide-react";
import {
  RESOURCE_CARD_GRID_CLASS,
  ResourceCard,
  ResourceCardDeleteButton,
  ResourceCardFooter,
} from "@/application/components/ui/resource-card";
import { Badge } from "@/application/components/ui/badge";

describe("ResourceCard", () => {
  it("renders the reference icon block, display title and content slot (CARD-004..006)", () => {
    const { container } = render(
      <ResourceCard odId="shared-card" icon={FileText} title="Support Prompt">
        <p>Card content</p>
      </ResourceCard>,
    );

    const card = container.querySelector('[data-od-id="shared-card"]');
    expect(card).not.toBeNull();
    const iconBlock = card?.querySelector("div[class*='h-12'][class*='w-12']");
    expect(iconBlock).not.toBeNull();
    for (const token of ["h-12", "w-12", "bg-surface-warm", "text-accent"]) {
      expect(iconBlock?.classList.contains(token)).toBe(true);
    }
    expect(iconBlock?.querySelector("svg")).not.toBeNull();

    const title = screen.getByText("Support Prompt");
    expect(title.tagName).toBe("H3");
    expect(title.classList.contains("text-lg")).toBe(true);
    expect(title.classList.contains("truncate")).toBe(true);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies the reference raised/hover treatment and stays a safe grid item (CARD-003, CARD-010, review I4)", () => {
    const { container } = render(
      <ResourceCard odId="shared-card" icon={FileText} title="Support Prompt" />,
    );

    const card = container.querySelector('[data-od-id="shared-card"]');
    // Equal-height rows and track-blowout protection.
    expect(card?.classList.contains("h-full")).toBe(true);
    expect(card?.classList.contains("min-w-0")).toBe(true);
    for (const token of ["block-shadow-raised", "hover:-translate-y-0.5", "hover:border-accent"]) {
      expect(card?.classList.contains(token)).toBe(true);
    }
  });

  it("keeps badges inside a non-shrinking, overflow-safe slot (CARD-005, review I7, BUG-002)", () => {
    render(
      <ResourceCard
        odId="shared-card"
        icon={FileText}
        title="Support Prompt"
        badges={<Badge>v2</Badge>}
      />,
    );

    const title = screen.getByText("Support Prompt");
    const badgeSlot = title.nextElementSibling;
    expect(badgeSlot).not.toBeNull();
    // The primitive enforces the contract; callers cannot forget it.
    expect(badgeSlot?.classList.contains("shrink-0")).toBe(true);
    // BUG-002: the slot can also never starve the title or overflow the
    // card — it is capped at two thirds of the row and clips beyond that.
    expect(badgeSlot?.classList.contains("max-w-2/3")).toBe(true);
    expect(badgeSlot?.classList.contains("min-w-0")).toBe(true);
    expect(badgeSlot?.classList.contains("overflow-hidden")).toBe(true);
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("constrains pathological badge content so the card cannot overflow (BUG-002)", () => {
    const longProvider = "a-very-long-provider-name-that-must-not-break-the-card-layout";
    render(
      <ResourceCard
        odId="shared-card"
        icon={Cpu}
        title="qa-badge-probe"
        badges={<Badge>{longProvider}</Badge>}
      />,
    );

    const title = screen.getByText("qa-badge-probe");
    const card = title.parentElement?.parentElement;
    const badgeSlot = title.nextElementSibling;
    // The badge text must remain in the accessibility tree (A11Y-004)…
    expect(screen.getByText(longProvider)).toBeInTheDocument();
    // …and visually truncatable: the slot enforces an ellipsis-truncating
    // contract on its direct children via scoped utilities (the tokens live
    // on the slot; `truncate` only takes effect when width is capped).
    expect(badgeSlot?.classList.contains("[&>*]:truncate")).toBe(true);
    expect(badgeSlot?.classList.contains("[&>*]:max-w-full")).toBe(true);
    expect(badgeSlot?.classList.contains("[&>*]:min-w-0")).toBe(true);
    // Title truncation never collapses it to zero width: `min-w-0` +
    // `truncate` is the shrink path, while the slot cap keeps the leftover
    // space for it (the title row is not allowed to be fully consumed by
    // the badge slot).
    expect(title.classList.contains("truncate")).toBe(true);
    expect(badgeSlot?.classList.contains("max-w-2/3")).toBe(true);
    // The overflow guard lives on the slot, so the card box itself stays
    // clean (jsdom cannot measure layout — this contract is what the
    // browser e2e `CARD-MODEL-long-badge-no-overflow` validates visually).
    expect(badgeSlot?.classList.contains("overflow-hidden")).toBe(true);
    expect(card?.classList.contains("min-w-0")).toBe(true);
  });

  it("keeps the top-separated footer tokens (CARD-007, CARD-010)", () => {
    const { container } = render(
      <ResourceCard odId="shared-card" icon={FileText} title="Support Prompt">
        <ResourceCardFooter>
          <button type="button">Action</button>
        </ResourceCardFooter>
      </ResourceCard>,
    );

    const card = container.querySelector('[data-od-id="shared-card"]');
    const footer = Array.from(card?.children ?? []).find((child) =>
      child.classList.contains("mt-auto"),
    );
    expect(footer).toBeDefined();
    for (const token of ["mt-auto", "border-t", "border-border-soft", "pt-2"]) {
      expect(footer?.classList.contains(token)).toBe(true);
    }
  });

  it("renders the delete action icon-only with a target-specific accessible name (CARD-008)", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { container } = render(
      <ResourceCard odId="shared-card" icon={FileText} title="Support Prompt">
        <ResourceCardFooter>
          <ResourceCardDeleteButton resourceName="Support Prompt" onActivate={onActivate} />
        </ResourceCardFooter>
      </ResourceCard>,
    );

    const button = screen.getByRole("button", { name: "Delete Support Prompt" });
    // Icon-only treatment: no visible "Delete" text.
    expect(button.textContent).not.toMatch(/delete/i);
    // Right-aligned through ml-auto inside the action row.
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.className).toContain("ml-auto");

    await user.click(button);
    expect(onActivate).toHaveBeenCalledOnce();

    expect(container).toBeDefined();
  });

  it("arms the delete action with an unambiguous confirm state (CARD-008, review I5)", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { rerender } = render(
      <ResourceCardFooter>
        <ResourceCardDeleteButton resourceName="Support Prompt" onActivate={onActivate} />
      </ResourceCardFooter>,
    );

    await user.click(screen.getByRole("button", { name: "Delete Support Prompt" }));
    expect(onActivate).toHaveBeenCalledOnce();

    rerender(
      <ResourceCardFooter>
        <ResourceCardDeleteButton
          resourceName="Support Prompt"
          confirming
          onActivate={onActivate}
        />
      </ResourceCardFooter>,
    );

    // Armed: the visible "Confirm Delete?" label replaces the icon and owns
    // the accessible name, so the required second action is unambiguous.
    const armed = screen.getByRole("button", { name: /confirm delete\?/i });
    expect(armed.textContent).toMatch(/confirm delete\?/i);
    expect(armed.getAttribute("aria-label")).toBeNull();

    await user.click(armed);
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("exports the standard responsive resource grid (CARD-009)", () => {
    for (const token of ["grid", "grid-cols-1", "gap-6", "md:grid-cols-2", "lg:grid-cols-3"]) {
      expect(RESOURCE_CARD_GRID_CLASS.split(" ")).toContain(token);
    }
  });
});
