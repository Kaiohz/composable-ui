import { describe, expect, it } from "vitest";
import {
  prettyToolText,
  toolArgsDisplayText,
  toolResultDisplayText,
} from "@/application/lib/toolResultDisplay";

describe("prettyToolText", () => {
  it("pretty-prints a plain JSON object (indent 2)", () => {
    expect(prettyToolText('{"query":"abc"}')).toBe('{\n  "query": "abc"\n}');
  });

  it("unwraps the MCP content envelope and pretty-prints the nested JSON text", () => {
    const envelope = JSON.stringify([
      { type: "text", text: JSON.stringify({ query: "Pickorp", results: [{ title: "Jo" }] }) },
    ]);
    expect(prettyToolText(envelope)).toBe(
      '{\n  "query": "Pickorp",\n  "results": [\n    {\n      "title": "Jo"\n    }\n  ]\n}',
    );
  });

  it("joins several text blocks of the envelope with a blank line", () => {
    const envelope = JSON.stringify([
      { type: "text", text: "first" },
      { type: "text", text: '{"b":1}' },
    ]);
    expect(prettyToolText(envelope)).toBe('first\n\n{\n  "b": 1\n}');
  });

  it("unwraps a single text-block object (not wrapped in an array)", () => {
    expect(prettyToolText(JSON.stringify({ type: "text", text: "solo" }))).toBe("solo");
  });

  it("renders a JSON envelope with non-text items via plain pretty-print", () => {
    const envelope = JSON.stringify([{ type: "image_url", url: "https://x" }]);
    expect(prettyToolText(envelope)).toBe(
      '[\n  {\n    "type": "image_url",\n    "url": "https://x"\n  }\n]',
    );
  });

  it("renders non-JSON text verbatim", () => {
    expect(prettyToolText("plain body\nwith lines")).toBe("plain body\nwith lines");
  });

  it("keeps an inner non-JSON text verbatim inside the envelope", () => {
    const envelope = JSON.stringify([{ type: "text", text: "not-json {oops" }]);
    expect(prettyToolText(envelope)).toBe("not-json {oops");
  });
});

describe("toolResultDisplayText", () => {
  it("unwraps the trace-event tool result envelope of the web_search tool", () => {
    const trace = JSON.stringify([
      {
        type: "text",
        text: JSON.stringify({
          query: "Pickorp",
          results: [{ title: "Joplin", href: "https://example.com", body: "Joplin notes app." }],
        }),
      },
    ]);
    expect(toolResultDisplayText(trace)).toBe(
      '{\n  "query": "Pickorp",\n  "results": [\n    {\n      "title": "Joplin",\n      "href": "https://example.com",\n      "body": "Joplin notes app."\n    }\n  ]\n}',
    );
  });

  it("delegates to prettyToolText for anything else", () => {
    expect(toolResultDisplayText("hello")).toBe("hello");
  });
});

describe("toolArgsDisplayText", () => {
  it("pretty-prints tool call arguments", () => {
    expect(toolArgsDisplayText('{"working_dir":"d","query":"q"}')).toBe(
      '{\n  "working_dir": "d",\n  "query": "q"\n}',
    );
    expect(toolArgsDisplayText("not json")).toBe("not json");
  });
});
