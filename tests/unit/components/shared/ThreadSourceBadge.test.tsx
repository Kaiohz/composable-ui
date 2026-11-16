/**
 * Spec: prompts-models-crons-traces.md §SRC-003 (Source pill)
 * The badge must be a shared, read-only, NONINTERACTIVE presentational
 * component reusing the skills/skills-multi-select pill presentation:
 *  - uppercases CHAT / CRON
 *  - semantic text element, not a button or disabled control
 *  - accessible label "Thread source: chat|cron"
 *  - stable data-od-id="thread-source-badge"
 *  - no new visual variant
 *
 * Component contract Step 2 must implement:
 *  - src/application/components/shared/ThreadSourceBadge.tsx
 *  - props: { source: "chat" | "cron" | null | undefined }
 *
 * Step-1 (Red): the component does not exist yet.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ThreadSourceBadge from "@/application/components/shared/ThreadSourceBadge";

describe("ThreadSourceBadge", () => {
  it("renders CRON uppercase for source cron", () => {
    render(<ThreadSourceBadge source="cron" />);

    const pill = screen.getByLabelText(/thread source: cron/i);
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toBe("CRON");
  });

  it("renders CHAT uppercase for source chat", () => {
    render(<ThreadSourceBadge source="chat" />);

    const pill = screen.getByLabelText(/thread source: chat/i);
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toBe("CHAT");
  });

  it("is a semantic text element — not a button", () => {
    render(<ThreadSourceBadge source="cron" />);

    const pill = screen.getByLabelText(/thread source: cron/i);
    expect(pill.tagName).not.toBe("BUTTON");
    expect(pill).not.toHaveAttribute("role", "button");
    expect(pill).not.toHaveAttribute("aria-pressed");
    expect(pill).not.toHaveAttribute("disabled");
  });

  it("is noninteractive: clicking it changes nothing and it is not focusable", () => {
    render(<ThreadSourceBadge source="cron" />);

    const pill = screen.getByLabelText(/thread source: cron/i);
    expect(pill).not.toHaveAttribute("tabindex", "0");

    const before = pill.outerHTML;
    fireEvent.click(pill);
    expect(pill.outerHTML).toBe(before);
  });

  it("carries the stable data-od-id for source pills", () => {
    render(<ThreadSourceBadge source="chat" />);

    expect(screen.getByLabelText(/thread source: chat/i)).toHaveAttribute(
      "data-od-id",
      "thread-source-badge",
    );
  });

  it("renders nothing gracefully for null/undefined source", () => {
    const { container: empty } = render(<ThreadSourceBadge source={null} />);
    expect(empty).toBeEmptyDOMElement();

    const { container: second } = render(<ThreadSourceBadge source={undefined} />);
    expect(second).toBeEmptyDOMElement();
  });
});
