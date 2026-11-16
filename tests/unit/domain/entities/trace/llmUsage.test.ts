/**
 * Domain contract for the period-window resolution (spec: Frontend §11)
 * with the QA-observed BUG-005 behavior: selecting "Custom range" without
 * picked dates previously returned an EMPTY window — an unbounded
 * (all-time) query against the aggregation endpoints.
 */
import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  customRangeIncomplete,
  resolveUsagePeriod,
  type UsageWindow,
} from "@/domain/entities/trace/llmUsage";

const NOW = new Date("2026-11-16T12:00:00.000Z");

function closeToNowMinus7Days(from: string | undefined) {
  if (!from) return false;
  return Math.abs(new Date(from).getTime() - (NOW.getTime() - 7 * DAY_MS)) < 1;
}

describe("resolveUsagePeriod", () => {
  it("resolves the 7d / 30d presets as open-ended windows", () => {
    const sevenDays: UsageWindow = resolveUsagePeriod("7d", {}, NOW);
    expect(sevenDays.to).toBeUndefined();
    expect(closeToNowMinus7Days(sevenDays.from)).toBe(true);

    const thirtyDays = resolveUsagePeriod("30d", {}, NOW);
    expect(thirtyDays.from).toBe(new Date(NOW.getTime() - 30 * DAY_MS).toISOString());
  });

  it("applies a custom range over an entire UTC day once BOTH bounds are picked", () => {
    const window = resolveUsagePeriod("custom", { from: "2026-11-01", to: "2026-11-05" }, NOW);
    expect(window.from).toBe("2026-11-01T00:00:00.000Z");
    expect(window.to).toBe("2026-11-05T23:59:59.999Z");
  });

  it("falls back to the bounded 7-day window while the custom range is incomplete (BUG-005)", () => {
    const empty = resolveUsagePeriod("custom", {}, NOW);
    expect(empty).toEqual(resolveUsagePeriod("7d", {}, NOW));
    expect(closeToNowMinus7Days(empty.from)).toBe(true);

    const fromOnly = resolveUsagePeriod("custom", { from: "2026-11-01" }, NOW);
    expect(fromOnly.from).not.toBe("2026-11-01T00:00:00.000Z");
    expect(closeToNowMinus7Days(fromOnly.from)).toBe(true);

    const toOnly = resolveUsagePeriod("custom", { to: "2026-11-05" }, NOW);
    expect(closeToNowMinus7Days(toOnly.from)).toBe(true);
    expect(toOnly.to).toBeUndefined();
  });

  it("reports the incompleteness that drives the filter-bar hint", () => {
    expect(customRangeIncomplete({})).toBe(true);
    expect(customRangeIncomplete({ from: "2026-11-01" })).toBe(true);
    expect(customRangeIncomplete({ to: "2026-11-05" })).toBe(true);
    expect(customRangeIncomplete({ from: "2026-11-01", to: "2026-11-05" })).toBe(false);
  });
});
