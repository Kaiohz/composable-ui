/**
 * Spec: unify-cards-modals.md — MODAL-001..004, MODAL-007, SPACE-001.
 *
 * `AlertDialogContent` must receive the same viewport, overflow, width and
 * spacing protection as `DialogContent` so that long confirmation messages
 * keep Cancel and the confirmation action reachable (MODAL-007).
 *
 * Step-1 (Red): the shared alert primitive has no viewport height bound, no
 * default scroll, no overscroll containment and small-screen-only padding.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/application/components/ui/alert-dialog";
import { Button } from "@/application/components/ui/button";

function renderOpenAlertDialog() {
  return renderWithProviders(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Revoke key</AlertDialogTitle>
        <AlertDialogDescription>
          Applications using this key will immediately lose access. This action cannot be undone and
          the full message is long enough to overflow a short viewport at 200% zoom.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant="destructive">
              Revoke
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );
}

describe("AlertDialogContent viewport and overflow contract", () => {
  it("constrains content to the available dynamic viewport height (MODAL-001, MODAL-007)", () => {
    renderOpenAlertDialog();

    const content = screen.getByRole("alertdialog");
    expect(content.className).toMatch(/max-h-\S*(dvh|svh)/);
  });

  it("provides default vertical scrolling and overscroll containment (MODAL-002, MODAL-004, MODAL-007)", () => {
    renderOpenAlertDialog();

    const content = screen.getByRole("alertdialog");
    expect(content.classList.contains("overflow-y-auto")).toBe(true);
    expect(content.classList.contains("overscroll-contain")).toBe(true);
  });

  it("keeps a viewport-safe width (MODAL-003)", () => {
    renderOpenAlertDialog();

    const content = screen.getByRole("alertdialog");
    // Viewport-safe width: 100% minus a 1rem gutter per side (review C2);
    // `w-full` on a fixed element leaves no visible screen margin.
    expect(content.classList.contains("w-[calc(100%-2rem)]")).toBe(true);
    expect(content.classList.contains("w-full")).toBe(false);
    expect(content.className).toMatch(/max-w-/);
  });

  it("keeps comfortable responsive padding (SPACE-001)", () => {
    renderOpenAlertDialog();

    const content = screen.getByRole("alertdialog");
    expect(content.classList.contains("p-6")).toBe(true);
    expect(content.classList.contains("sm:p-8")).toBe(true);
  });

  it("keeps Cancel and the confirmation action reachable in the dialog (MODAL-007)", () => {
    renderOpenAlertDialog();

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
  });
});
