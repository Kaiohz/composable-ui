import { describe, it, expect } from "vitest";
import { completeBuiltInMcpServers } from "@/domain/entities/config/builtInMcpServers";
import type { AppConfig } from "@/domain/entities/config/appConfig";

const baseConfig: AppConfig = {
  apiBaseUrl: "http://api.test.com",
  wsBaseUrl: "ws://api.test.com",
  ragApiBaseUrl: "http://rag.test.com",
  mcpApiBaseUrl: "",
  oauth2ProxyUrl: "",
  logtoUrl: "",
  logtoAppId: "",
  builtInMcpServers: [],
};

describe("completeBuiltInMcpServers", () => {
  it("appends the built-in composable-agents platform tool", () => {
    const config = completeBuiltInMcpServers(baseConfig);
    expect(config.builtInMcpServers).toContainEqual({
      name: "Composable Agents",
      url: "http://api.test.com/mcp",
      transport: "http",
    });
  });

  it("appends the canonical raganything mounts WITHOUT the removed Memories mount", () => {
    const config = completeBuiltInMcpServers(baseConfig);
    expect(config.builtInMcpServers).not.toContainEqual(
      expect.objectContaining({ name: "Memories" }),
    );
    expect(config.builtInMcpServers).toContainEqual({
      name: "Web Search",
      url: "http://rag.test.com/web/mcp",
      transport: "http",
    });
  });

  it("does not duplicate an explicitly configured composable-agents entry", () => {
    const config = completeBuiltInMcpServers({
      ...baseConfig,
      builtInMcpServers: [
        { name: "Composable Agents", url: "http://custom-agents.test.com/mcp", transport: "http" },
      ],
    });
    expect(config.builtInMcpServers).toEqual([
      { name: "Composable Agents", url: "http://custom-agents.test.com/mcp", transport: "http" },
      { name: "Web Search", url: "http://rag.test.com/web/mcp", transport: "http" },
    ]);
  });

  it("leaves the config untouched when no built-in base URLs are available", () => {
    const config = completeBuiltInMcpServers({ ...baseConfig, apiBaseUrl: "", ragApiBaseUrl: "" });
    expect(config.builtInMcpServers).toEqual([]);
  });
});
