import { describe, expect, it } from "vitest";
import { stripScrollFlags } from "@/application/lib/stripScroll";

describe("stripScrollFlags", () => {
  it("hides both chevrons when the content fits", () => {
    expect(stripScrollFlags({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it("hides both chevrons when the content fits with a rounding remainder", () => {
    expect(stripScrollFlags({ scrollLeft: 0, scrollWidth: 300, clientWidth: 299 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it("shows only the right chevron at the left edge", () => {
    expect(stripScrollFlags({ scrollLeft: 0, scrollWidth: 900, clientWidth: 300 })).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
    });
  });

  it("shows both chevrons mid-strip", () => {
    expect(stripScrollFlags({ scrollLeft: 400, scrollWidth: 900, clientWidth: 300 })).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });

  it("shows only the left chevron at the right edge", () => {
    expect(stripScrollFlags({ scrollLeft: 600, scrollWidth: 900, clientWidth: 300 })).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });
});
