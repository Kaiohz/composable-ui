/**
 * Spec: scope-rag-memories-user-agent.md — REQ-026 (shared wiring contract).
 *
 * Proves that BOTH the RAG page (RagPage) and the Memories page
 * (MemoriesPage) render the ONE shared SpaceSelector module
 * (`src/application/components/shared/SpaceSelector.tsx`) and plumb the
 * currently selected scope through its `value` prop.
 *
 * Technique: ONLY the shared component's module boundary is replaced with a
 * stub (vi.mock) that renders a distinctive marker recording the `value` it
 * received. The real component behavior (options, ordering, a11y) is fully
 * covered by SpaceSelector.test.tsx, and the scoped page wiring by the
 * RagPageSpaces / MemoriesPageSpaces files. The stub is the assertion
 * target here — it verifies the pages delegate to the single shared
 * component (a second, page-local implementation could not satisfy this
 * test, since the marker would never be the one rendered).
 *
 * RED (TDD step 1) failure mode: the pages do not import the shared module
 * yet, so the marker never renders.
 */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RagPage from "@/application/pages/RagPage";
import MemoriesPage from "@/application/pages/MemoriesPage";
import { renderWithProviders } from "../../utils/render";
import { restoreAllNetworks, stubNetwork, route } from "../../utils/network";
import { spacesRoutes, storeRoutes } from "../../fixtures/spaces";

vi.mock("@/application/components/shared/SpaceSelector", () => ({
  default: (props: { value?: string | null }) => (
    <div data-od-id="space-selector-wired" data-space-value={props?.value ?? ""}>
      space-selector-shared-stub
    </div>
  ),
}));

function stubPageNetwork() {
  stubNetwork([
    ...spacesRoutes(),
    ...storeRoutes({}), // memories listing empty — wiring only
    route("rag", "GET", /\/api\/v1\/files\/list$/, () => ({ status: 200, data: [] })),
    route("rag", "GET", /\/api\/v1\/files\/folders$/, () => ({ status: 200, data: [] })),
  ]);
}

afterEach(() => {
  restoreAllNetworks();
});

describe("one shared SpaceSelector module is wired into both pages (REQ-026)", () => {
  it("RagPage renders the shared SpaceSelector with the selected space as its value", async () => {
    stubPageNetwork();
    renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });

    const wired = await screen.findByText("space-selector-shared-stub");
    expect(wired).toHaveAttribute("data-od-id", "space-selector-wired");
    // User × agent directive: the pages default the selection to the FIRST
    // data option (builtin-first catalog agent) once the payloads resolve —
    // never the system-internal personal namespace.
    await waitFor(() => expect(wired).toHaveAttribute("data-space-value", "composable-ai-assistant"));
  });

  it("MemoriesPage renders the same shared SpaceSelector with the selected space as its value", async () => {
    stubPageNetwork();
    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });

    const wired = await screen.findByText("space-selector-shared-stub");
    expect(wired).toHaveAttribute("data-od-id", "space-selector-wired");
    await waitFor(() => expect(wired).toHaveAttribute("data-space-value", "composable-ai-assistant"));
  });

  it("renders exactly ONE space selector per page", async () => {
    stubPageNetwork();

    const rag = renderWithProviders(<RagPage />, { initialEntries: ["/rag"] });
    await screen.findByText("space-selector-shared-stub");
    expect(document.querySelectorAll('[data-od-id="space-selector-wired"]')).toHaveLength(1);
    rag.unmount();

    renderWithProviders(<MemoriesPage />, { initialEntries: ["/memories"] });
    await screen.findByText("space-selector-shared-stub");
    expect(document.querySelectorAll('[data-od-id="space-selector-wired"]')).toHaveLength(1);
  });
});
