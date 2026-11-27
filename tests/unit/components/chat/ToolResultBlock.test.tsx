import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../../utils/render";
import ToolResultBlock from "@/application/components/chat/ToolResultBlock";

describe("ToolResultBlock", () => {
  it("renders the header with name and source when provided", () => {
    renderWithProviders(<ToolResultBlock name="search" content="result payload" source={null} />);

    expect(screen.getByText(/Tool Result/i)).toBeInTheDocument();
    expect(screen.getByText(/search/i)).toBeInTheDocument();
  });

  it("renders source label for subagent results", () => {
    renderWithProviders(<ToolResultBlock name="search" content="ok" source="subagent-a" />);

    expect(screen.getByText(/subagent-a/i)).toBeInTheDocument();
  });

  it("toggles content visibility on header click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToolResultBlock name="search" content="visible-payload" source={null} />);

    const toggle = screen.getByRole("button", { name: /toggle result/i });
    expect(screen.queryByText("visible-payload")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText("visible-payload")).toBeInTheDocument();
  });

  it("renders gracefully when content is null", () => {
    renderWithProviders(<ToolResultBlock name="noop" content={null} source={null} />);

    expect(screen.getByText(/Tool Result/i)).toBeInTheDocument();
  });
});

describe("ToolResultBlock pretty JSON", () => {
  it("renders JSON payloads pretty-printed with 2-space indentation", async () => {
    const user = userEvent.setup();
    const payload = JSON.stringify({
      query: "vietnam",
      results: [{ url: "https://example.com", truncated: true }],
    });
    renderWithProviders(<ToolResultBlock name="web_search" content={payload} source={null} />);

    await user.click(screen.getByRole("button", { name: /toggle result/i }));

    const rendered = screen.getByText(/vietnam/);
    expect(rendered.textContent).toBe(JSON.stringify(JSON.parse(payload), null, 2));
    // The pretty form is multi-line (each key on its own line, indented).
    expect(rendered.textContent.split("\n").length).toBeGreaterThan(3);
  });

  it("renders non-JSON payloads verbatim", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToolResultBlock name="noop" content="plain text payload" source={null} />);

    await user.click(screen.getByRole("button", { name: /toggle result/i }));

    expect(screen.getByText("plain text payload")).toBeInTheDocument();
  });

  it("keeps every JSON field intact when pretty-printing (base64 PDF payloads)", async () => {
    const user = userEvent.setup();
    const payload = JSON.stringify({
      type: "pdf",
      filename: "doc.pdf",
      path: "/documents/doc.pdf",
      mime_type: "application/pdf",
      content: "JVBERi0xLjQ=",
    });
    renderWithProviders(<ToolResultBlock name="create_pdf" content={payload} source={null} />);

    await user.click(screen.getByRole("button", { name: /toggle result/i }));

    const rendered = screen.getByText(/doc.pdf/);
    // Round-trips: pretty JSON keeps the exact same values (no mutation).
    expect(JSON.parse(rendered.textContent ?? "")).toEqual(JSON.parse(payload));
    expect(rendered.textContent).toContain("JVBERi0xLjQ=");
  });
});
