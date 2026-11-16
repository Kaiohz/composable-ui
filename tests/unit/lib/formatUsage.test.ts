/**
 * Unit contract for the dashboard formatters (spec: Frontend §9/§10) with
 * the QA-observed values from the running stack (bug report BUG-001). A
 * priced run with a sub-cent cost (1 input + 1 output token at $2.5/$10
 * per 1M → 1.25e-05 USD) must NOT read "$0.0000" — visually identical to
 * a free run while the card claims "All models priced".
 */
import { describe, expect, it } from "vitest";
import { formatCostUsd, formatDateTime, formatDurationMs } from "@/application/lib/formatUsage";

describe("formatCostUsd — cost precision (BUG-001 regression)", () => {
  it("keeps the QA-observed 1.25e-05 cost visibly non-zero (never $0.0000)", () => {
    const rendered = formatCostUsd(1.25e-5);
    expect(rendered).not.toBe("$0.0000");
    // The value is human-readable with enough precision to be distinguishable.
    expect(rendered).toBe("$0.00001");
  });

  it("never underflows any non-zero sub-cent cost to $0.0000", () => {
    for (const cost of [0.0000125, 0.00004999, 5e-7, -1.25e-5]) {
      expect(formatCostUsd(cost)).not.toBe("$0.0000");
    }
    // Deep micro-costs widen until the first significant digit appears.
    expect(formatCostUsd(5e-7)).toBe("$0.0000005");
  });

  it("keeps the readable existing forms exact", () => {
    expect(formatCostUsd(0.0042)).toBe("$0.0042");
    expect(formatCostUsd(0.99)).toBe("$0.99");
    expect(formatCostUsd(12.5)).toBe("$12.50");
    // Exact zero and missing values stay indistinguishable from free.
    expect(formatCostUsd(0)).toBe("$0.00");
    expect(formatCostUsd(null)).toBe("$0.00");
    expect(formatCostUsd(undefined)).toBe("$0.00");
    expect(formatCostUsd(Number.NaN)).toBe("$0.00");
  });
});

describe("formatDurationMs / formatDateTime — defensive guards", () => {
  it("formats sub-second as ms and longer spans as seconds", () => {
    expect(formatDurationMs(350)).toBe("350 ms");
    expect(formatDurationMs(1_200)).toBe("1.2 s");
    expect(formatDurationMs(null)).toBe("—");
  });

  it("renders missing timestamps as an em dash", () => {
    expect(formatDateTime(null)).toBe("—");
    // The exact hour depends on the machine timezone; only the shape is contract.
    expect(formatDateTime("2026-11-15T12:00:00Z")).toMatch(/^Nov 15, \d{2}:\d{2} (AM|PM)$/);
  });
});
