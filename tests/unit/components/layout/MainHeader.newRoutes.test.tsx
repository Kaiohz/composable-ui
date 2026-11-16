/**
 * Spec: prompts-models-crons-traces.md §4, §2.1
 * MainHeader TITLE_MAP must expose titles for /prompts, /models, /crons and
 * /traces (list and detail share the Traces title), following the existing
 * page-title presentation (data-od-id="page-title").
 *
 * Step-1 (Red): TITLE_MAP has no entries for the new destinations yet — the
 * fallback title renders instead.
 */
import { screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import MainHeader from "@/application/components/layout/MainHeader";
import { useSidebarStore } from "@/application/stores/useSidebarStore";

describe("MainHeader — registry + trace page titles", () => {
  beforeEach(() => {
    useSidebarStore.setState({ isOpen: false });
  });

  it.each([
    ["/prompts", "Prompts"],
    ["/models", "Models"],
    ["/crons", "Crons"],
    ["/traces", "Traces"],
    ["/traces/55555555-5555-4555-8555-555555555555", "Traces"],
  ])("renders the %s title as %s", (pathname, expected) => {
    renderWithProviders(<MainHeader />, {
      initialEntries: [pathname],
    });

    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toHaveAttribute("data-od-id", "page-title");
    expect(title).toHaveTextContent(expected);
  });
});
