import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/application/components/ui/button";

/**
 * Shared resource-card composition (spec unify-cards-modals CARD-001..013).
 *
 * The Agent card is the visual reference; this family owns that treatment so
 * every resource-management surface (Agents, Prompts, Models, Crons, Skills,
 * Memories, MCP Registry) renders one coherent card language instead of
 * re-declaring approximate class strings:
 *
 * - `ResourceCard` — container + icon block + title/badge row + content slot.
 * - `ResourceCardFooter` — top-separated action row pinned toward the bottom.
 * - `ResourceCardDeleteButton` — Agent-reference icon-only trash action with a
 *   target-specific accessible name and an unambiguous confirm state.
 * - `RESOURCE_CARD_GRID_CLASS` — the standard responsive resource grid.
 */

/** Agent-reference container: sharp corners, surface tokens, raised block
 * shadow, base transition, subtle hover lift + accent border. `h-full` keeps
 * cards in one grid row equal-height so `mt-auto` footers align (CARD-010);
 * `min-w-0` makes the card safe as a direct grid item, whose default
 * `min-width: auto` would otherwise let non-wrapping content widen the track
 * and overflow the page (A11Y-004, review I4). */
const CONTAINER_CLASS =
  "group relative flex h-full min-w-0 flex-col gap-3 border border-border bg-surface p-4 block-shadow-raised transition-[border-color,box-shadow,transform] duration-base ease-standard hover:-translate-y-0.5 hover:border-accent";

/** Agent-reference square icon block (CARD-004). */
const ICON_BLOCK_CLASS =
  "flex h-12 w-12 items-center justify-center border border-border bg-surface-warm font-display text-lg text-accent";

/** Agent-reference title typography: display, uppercase, tracked, truncation-safe (CARD-005). */
const TITLE_CLASS = "min-w-0 truncate font-display text-lg uppercase tracking-[0.06em] text-fg";

/** Standard responsive resource grid shared by all resource surfaces (CARD-009). */
export const RESOURCE_CARD_GRID_CLASS = "grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3";

/** Badge slot (BUG-002): short badges keep their intrinsic width — the slot
 * never shrinks — while pathological badge content can neither widen the card
 * nor starve the title: the slot is capped at two thirds of the title row,
 * clips beyond that, and its direct children are width-capped and
 * ellipsis-truncated so the truncation reads as intentional (CARD-005,
 * A11Y-004). */
const BADGE_SLOT_CLASS =
  "flex min-w-0 max-w-2/3 shrink-0 items-center gap-2 overflow-hidden [&>*]:min-w-0 [&>*]:max-w-full [&>*]:truncate";

interface ResourceCardProps {
  /** Stable QA hook (`data-od-id`). */
  readonly odId: string;
  /** Lucide icon rendered inside the reference icon block (CARD-004). */
  readonly icon: LucideIcon;
  /** Resource title, truncated safely (CARD-005). */
  readonly title: string;
  /** Badges aligned with the title; the primitive enforces the
   * non-shrinking contract (CARD-005, review I7). */
  readonly badges?: ReactNode;
  /** Card content between the title row and the footer (CARD-006). */
  readonly children?: ReactNode;
}

export function ResourceCard({ odId, icon: Icon, title, badges, children }: ResourceCardProps) {
  // `false` and null are both intentional "no badges" signals for callers.
  const hasBadges = badges != null && badges !== false;

  return (
    <div data-od-id={odId} className={CONTAINER_CLASS}>
      <div aria-hidden="true" className={ICON_BLOCK_CLASS}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <h3 className={TITLE_CLASS}>{title}</h3>
        {hasBadges && <div className={BADGE_SLOT_CLASS}>{badges}</div>}
      </div>
      {children}
    </div>
  );
}

interface ResourceCardFooterProps {
  /** Primary resource actions, in the surface's existing order (CARD-007). */
  readonly children?: ReactNode;
}

/** Footer pushed toward the card bottom, separated by a soft top border. */
export function ResourceCardFooter({ children }: ResourceCardFooterProps) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border-soft pt-2">
      {children}
    </div>
  );
}

interface ResourceCardDeleteButtonProps {
  /** Resource name backing the accessible name: "Delete {resourceName}". */
  readonly resourceName: string;
  /**
   * Two-step arm state for surfaces whose list owns the delete confirmation
   * (Prompt, Model, Cron). While armed, the unambiguous "Confirm Delete?"
   * label replaces the icon; MCP/Agent stay one-step (confirming never set).
   */
  readonly confirming?: boolean;
  /** Arm-or-confirm activation, wired by the surface (existing semantics). */
  readonly onActivate: () => void;
}

/**
 * Agent-reference delete action (CARD-008): icon-only, right-aligned through
 * `ml-auto`, ghost treatment; the target-specific accessible name replaces
 * the visible label, so the button content carries no "Delete" text.
 */
export function ResourceCardDeleteButton({
  resourceName,
  confirming = false,
  onActivate,
}: Readonly<ResourceCardDeleteButtonProps>) {
  return (
    <Button
      type="button"
      variant={confirming ? "destructive" : "ghost"}
      size={confirming ? "sm" : "icon"}
      onClick={onActivate}
      aria-label={confirming ? undefined : `Delete ${resourceName}`}
      className={confirming ? "ml-auto" : "ml-auto h-8 w-8"}
    >
      {confirming ? "Confirm Delete?" : <Trash2 className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
