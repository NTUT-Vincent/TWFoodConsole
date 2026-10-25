#!/usr/bin/env node
// End-to-end Streamable HTTP smoke test. No MCP client package is needed.
// Usage: npm run test:mcp -- https://your-deployment.vercel.app/api/mcp

const target = process.argv[2] || "http://localhost:3000/api/mcp";
let nextId = 1;
let sessionId = null;

async function request(method, params) {
  const id = nextId++;
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {})
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  if (!response.ok) throw new Error(method + " returned HTTP " + response.status + ": " + (await response.text()).slice(0, 200));
  sessionId = response.headers.get("mcp-session-id") || sessionId;
  const body = await response.text();
  const data = response.headers.get("content-type")?.includes("text/event-stream")
    ? body.split(/\r?\n/u).filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5).trim()))
    : [JSON.parse(body)];
  const result = data.find((item) => item.id === id);
  if (!result || result.error) throw new Error(method + " returned invalid/error result: " + body.slice(0, 300));
  return result.result;
}

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "twfoodconsole-smoke", version: "1.0" }
  });
  const listed = await request("tools/list", {});
  const toolNames = (listed.tools || []).map((tool) => tool.name);
  for (const name of ["search_food", "get_food", "list_brands"]) {
    if (!toolNames.includes(name)) throw new Error("Missing MCP tool: " + name);
  }
  const result = await request("tools/call", { name: "list_brands", arguments: {} });
  if (result.isError) throw new Error("list_brands returned MCP tool error");
  console.log("MCP smoke passed:", init.serverInfo?.name || "server", toolNames.join(", "));
} catch (error) {
  console.error("MCP smoke failed:", error);
  process.exitCode = 1;
}
