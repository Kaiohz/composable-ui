/**
 * Pure scroll-visibility rules for the thread-tabs strip (header chevrons).
 *
 * The chevrons only exist while a scroll is possible in their direction —
 * a strip whose content fits (or has reached an edge) hides its arrow.
 */

export interface StripScrollMeasurements {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export interface StripScrollFlags {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

/** Tolerance (px) below which the strip is considered at an edge. */
const EDGE_THRESHOLD_PX = 1;

export function stripScrollFlags({
  scrollLeft,
  scrollWidth,
  clientWidth,
}: StripScrollMeasurements): StripScrollFlags {
  const scrollable = scrollWidth - clientWidth > EDGE_THRESHOLD_PX;
  if (!scrollable) {
    return { canScrollLeft: false, canScrollRight: false };
  }
  return {
    canScrollLeft: scrollLeft > EDGE_THRESHOLD_PX,
    canScrollRight: scrollLeft < scrollWidth - clientWidth - EDGE_THRESHOLD_PX,
  };
}
