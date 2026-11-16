/**
 * Spec: prompts-models-crons-traces.md §4 (Navigation), §2.1
 * Requires independent lazy routes for /prompts, /models, /crons and
 * /traces (+ /traces/:threadId detail deep-link from cron run history).
 *
 * Step-1 (Red): the four page modules do not exist yet, so these tests fail
 * until Step 2 wires the lazy imports in `src/application/App.tsx`.
 */
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../../utils/render";

// Mock the four new page modules so this suite only validates App route
// wiring (repo convention: App.test.tsx mocks page modules the same way).
vi.mock("@/application/pages/PromptsPage", () => ({
  default: () => <div>PromptsPage</div>,
}));
vi.mock("@/application/pages/ModelsPage", () => ({
  default: () => <div>ModelsPage</div>,
}));
vi.mock("@/application/pages/CronsPage", () => ({
  default: () => <div>CronsPage</div>,
}));
vi.mock("@/application/pages/TracesPage", () => ({
  default: () => <div>TracesPage</div>,
}));

import AppDefault from "@/application/App";

describe("App routing — new registries + traces", () => {
  it("renders the /prompts route", async () => {
    renderWithProviders(<AppDefault />, { initialEntries: ["/prompts"] });

    await waitFor(() => {
      expect(screen.getByText("PromptsPage")).toBeInTheDocument();
    });
  });

  it("renders the /models route", async () => {
    renderWithProviders(<AppDefault />, { initialEntries: ["/models"] });

    await waitFor(() => {
      expect(screen.getByText("ModelsPage")).toBeInTheDocument();
    });
  });

  it("renders the /crons route", async () => {
    renderWithProviders(<AppDefault />, { initialEntries: ["/crons"] });

    await waitFor(() => {
      expect(screen.getByText("CronsPage")).toBeInTheDocument();
    });
  });

  it("renders the /traces route (list)", async () => {
    renderWithProviders(<AppDefault />, { initialEntries: ["/traces"] });

    await waitFor(() => {
      expect(screen.getByText("TracesPage")).toBeInTheDocument();
    });
  });

  it("renders /traces/:threadId as the read-only trace detail deep link", async () => {
    renderWithProviders(<AppDefault />, {
      initialEntries: ["/traces/55555555-5555-4555-8555-555555555555"],
    });

    await waitFor(() => {
      expect(screen.getByText("TracesPage")).toBeInTheDocument();
    });
  });
});
