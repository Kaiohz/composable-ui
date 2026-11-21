/**
 * Spec: unify-cards-modals.md — Shared dialog scrolling and sizing
 * (MODAL-001..004, MODAL-006, SPACE-001, SPACE-004).
 *
 * Contract for the shared `DialogContent` primitive. Class assertions are
 * acceptable here because the contract is specifically visual layout
 * (spec §Test strategy item 3): every simple dialog (Prompt, Model, Cron,
 * history, settings, confirmation, …) inherits these defaults, while
 * structured `p-0` dialogs keep overriding only where intentionally designed.
 *
 * Step-1 (Red): the shared primitive imposes no viewport height bound,
 * no default scroll, no overscroll containment and has small-screen-only
 * padding, so the viewport/overflow/padding assertions fail.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/application/components/ui/dialog";

function renderOpenDialog(contentClassName?: string) {
  return renderWithProviders(
    <Dialog open>
      <DialogContent className={contentClassName}>
        <DialogTitle>Simple dialog</DialogTitle>
        <DialogDescription>Dialog primitive contract</DialogDescription>
        <p>Body</p>
      </DialogContent>
    </Dialog>,
  );
}

describe("DialogContent viewport and overflow contract", () => {
  it("constrains content to the available dynamic viewport height (MODAL-001)", () => {
    renderOpenDialog();

    const content = screen.getByRole("dialog");
    expect(content.className).toMatch(/max-h-\S*(dvh|svh)/);
  });

  it("provides default vertical scrolling and overscroll containment (MODAL-002, MODAL-004)", () => {
    renderOpenDialog();

    const content = screen.getByRole("dialog");
    expect(content.classList.contains("overflow-y-auto")).toBe(true);
    expect(content.classList.contains("overscroll-contain")).toBe(true);
  });

  it("keeps a viewport-safe width with a horizontal margin (MODAL-003)", () => {
    renderOpenDialog();

    const content = screen.getByRole("dialog");
    // A fixed element's containing block is the viewport, so `w-full` would
    // place the dialog border flush on both screen edges; the shared
    // primitive reserves a 1rem gutter per side instead (review C2).
    expect(content.classList.contains("w-[calc(100%-2rem)]")).toBe(true);
    expect(content.classList.contains("w-full")).toBe(false);
    expect(content.className).toMatch(/max-w-/);
  });

  it("keeps comfortable responsive padding for simple dialogs (SPACE-001)", () => {
    renderOpenDialog();

    const content = screen.getByRole("dialog");
    expect(content.classList.contains("p-6")).toBe(true);
    expect(content.classList.contains("sm:p-8")).toBe(true);
  });

  it("keeps the close control clear of long titles (SPACE-004)", () => {
    renderOpenDialog();

    const title = screen.getByText("Simple dialog");
    // `pr-12` (48 px) covers the close control's real footprint —
    // `right-4` (16 px) + padding + 16 px icon ≈ 44 px from the right edge.
    expect(title.classList.contains("pr-12")).toBe(true);
  });

  it("still allows consumers to override width for structured dialogs", () => {
    renderOpenDialog("max-w-3xl");

    const content = screen.getByRole("dialog");
    expect(content.classList.contains("max-w-3xl")).toBe(true);
  });
});
