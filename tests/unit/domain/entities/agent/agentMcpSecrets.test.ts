/**
 * Spec: agent-resource-import.md — domain-owned MCP secret redaction
 * (`src/domain/entities/agent/agentMcpSecrets.ts`).
 *
 * REQ-LEGACY-004 / §5 Security (reviews C2/C3/J1/J4): an exported agent
 * document — top level OR sub-agent — never carries credential material.
 * Every exported inline MCP definition must be produced through the ONE pure
 * domain rule; no exporter may re-encode it.
 */
import { describe, it, expect } from "vitest";
import {
  redactSecretHeaders,
  redactSecretEnv,
  redactMcpServerForExport,
  resolveMcpExportSelection,
} from "@/domain/entities/agent/agentMcpSecrets";
import { McpTransportType, type McpServerConfig } from "@/domain/entities/agent/mcpServerConfig";

const FULL_SERVER: McpServerConfig = {
  name: "legacy-http",
  transport: McpTransportType.HTTP,
  args: ["-y", "@mcp/toolkit"],
  url: "https://example.com/mcp",
  headers: {
    Authorization: "Bearer plaintext-token",
    Cookie: "session=abc",
    "X-Api-Key": "sk-key-123",
    Accept: "application/json",
  },
  env: {
    GITHUB_TOKEN: "ghp-abc",
    AWS_SECRET_ACCESS_KEY: "aws-secret",
    DB_PASSWORD: "hunter2",
    CACHE_DIR: "/tmp/cache",
  },
  auth_token: "the-auth-bearing-token",
};

describe("redactSecretHeaders", () => {
  it("drops credential-bearing headers and keeps transport headers", () => {
    expect(redactSecretHeaders(FULL_SERVER.headers)).toEqual({ Accept: "application/json" });
    expect(redactSecretHeaders({ "Proxy-Authorization": "basic xyz", Accept: "*/*" })).toEqual({
      Accept: "*/*",
    });
  });

  it("matches case-insensitively and handles empty input", () => {
    expect(redactSecretHeaders({ authorization: "Bearer x" })).toEqual({});
    expect(redactSecretHeaders({})).toEqual({});
  });
});

describe("redactSecretEnv", () => {
  it("drops credential-named variables and keeps behavior variables", () => {
    expect(redactSecretEnv(FULL_SERVER.env)).toEqual({ CACHE_DIR: "/tmp/cache" });
  });

  it("matches name variants and handles empty input", () => {
    expect(
      redactSecretEnv({
        API_KEY: "k",
        MY_SERVICE_PRIVATE_KEY: "pem",
        USER_CREDENTIALS: "c",
        LOG_LEVEL: "debug",
      }),
    ).toEqual({ LOG_LEVEL: "debug" });
    expect(redactSecretEnv({})).toEqual({});
  });
});

describe("redactMcpServerForExport", () => {
  it("keeps the readable non-secret shape and never emits credential material", () => {
    const exported = redactMcpServerForExport(FULL_SERVER);

    expect(exported).toEqual({
      name: "legacy-http",
      transport: McpTransportType.HTTP,
      args: ["-y", "@mcp/toolkit"],
      headers: { Accept: "application/json" },
      env: { CACHE_DIR: "/tmp/cache" },
      url: "https://example.com/mcp",
    });
    expect(JSON.stringify(exported)).not.toContain("auth_token");
    expect(JSON.stringify(exported)).not.toContain("the-auth-bearing-token");
    expect(JSON.stringify(exported)).not.toContain("Bearer plaintext-token");
    expect(JSON.stringify(exported)).not.toContain("ghp-abc");
    expect(JSON.stringify(exported)).not.toContain("hunter2");
  });

  it("omits command/url absent for the transport", () => {
    const server: McpServerConfig = {
      name: "stdio-server",
      transport: McpTransportType.STDIO,
      command: "npx",
      args: [],
      headers: {},
      env: {},
      auth_token: undefined,
    };
    const exported = redactMcpServerForExport(server);
    expect(exported).toEqual({
      name: "stdio-server",
      transport: McpTransportType.STDIO,
      args: [],
      headers: {},
      env: {},
      command: "npx",
    });
    expect(exported).not.toHaveProperty("url");
    expect(exported).not.toHaveProperty("auth_token");
  });
});

describe("resolveMcpExportSelection — the legacy vs resource-only discriminator (BUG-001)", () => {
  const REDACTED_FULL_SERVER = [
    {
      name: "legacy-http",
      transport: McpTransportType.HTTP,
      args: ["-y", "@mcp/toolkit"],
      headers: { Accept: "application/json" },
      env: { CACHE_DIR: "/tmp/cache" },
      url: "https://example.com/mcp",
    },
  ];

  it("a non-empty reference selection wins: identities plus an explicitly empty inline list", () => {
    expect(resolveMcpExportSelection(["weather"], [{ ...FULL_SERVER }])).toEqual({
      mcp_refs: ["weather"],
      mcp_servers: [],
    });
  });

  it("an EMPTY reference list with inline definitions is a LEGACY document: definitions survive, redacted", () => {
    // The backend never returns `mcp_refs: null` — an empty list is exactly
    // what a legacy agent carries (Bug report BUG-001).
    const selection = resolveMcpExportSelection([], [FULL_SERVER]);
    expect(selection).toEqual({ mcp_refs: [], mcp_servers: REDACTED_FULL_SERVER });
    expect(JSON.stringify(selection)).not.toContain("auth_token");
    expect(JSON.stringify(selection)).not.toContain("Bearer plaintext-token");
    expect(JSON.stringify(selection)).not.toContain("ghp-abc");
  });

  it("an explicit resource-only EMPTY selection echoes back mcp_refs: [] and mcp_servers: []", () => {
    expect(resolveMcpExportSelection([], [])).toEqual({ mcp_refs: [], mcp_servers: [] });
  });

  it("a hand-built legacy object without the key omits mcp_refs and keeps its redacted definitions", () => {
    expect(resolveMcpExportSelection(undefined, [FULL_SERVER])).toEqual({
      mcp_refs: undefined,
      mcp_servers: REDACTED_FULL_SERVER,
    });
    expect(resolveMcpExportSelection(undefined, [])).toEqual({
      mcp_refs: undefined,
      mcp_servers: [],
    });
  });
});
