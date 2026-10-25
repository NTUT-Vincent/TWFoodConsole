import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getPublicFood, listFoodBrands, searchPublicFood } from "@/lib/mcp-food";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const;

function asToolResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result as Record<string, unknown>
  };
}

function toolFailure(error: unknown) {
  // Do not expose server environment variables or tokens to clients.
  console.error("TWFood MCP tool failed:", error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: "Food lookup failed. Please retry or contact the service administrator." }]
  };
}

const channel = z.enum(["stable", "preview"]).default("stable")
  .describe("stable: public human-reviewed records only; preview: also include public unreviewed drafts");

const handler = createMcpHandler((server) => {
  server.registerTool(
    "search_food",
    {
      title: "Search Taiwan foods",
      description: "Search TWFoodMCP OKF records by product, brand, or filename. Default stable excludes drafts. Responses include sources, serving basis and verification. Continue with next_cursor when provided.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(120).describe("Food name or keywords, e.g. 全家 霜淇淋"),
        brand: z.string().trim().max(80).optional().describe("Optional brand name"),
        dataset_channel: channel,
        limit: z.number().int().min(1).max(10).default(5),
        cursor: z.number().int().min(0).default(0).describe("Offset into filename-matched candidates, for paging through large sets")
      }).strict(),
      annotations: readOnly
    },
    async ({ query, brand, dataset_channel, limit, cursor }) => {
      try {
        return asToolResult(await searchPublicFood({
          query, brand, datasetChannel: dataset_channel, limit, cursor
        }));
      } catch (error) {
        return toolFailure(error);
      }
    }
  );

  server.registerTool(
    "get_food",
    {
      title: "Get food nutrition and provenance",
      description: "Read one TWFoodMCP OKF food concept returned by search_food. Include serving basis, sources, version, trust and staleness. Drafts are visible only when dataset_channel=preview, and cannot be used for nutrition calculations.",
      inputSchema: z.object({
        path: z.string().min(1).max(512).describe("Repository-relative path returned by search_food"),
        dataset_channel: channel
      }).strict(),
      annotations: readOnly
    },
    async ({ path, dataset_channel }) => {
      try {
        const result = await getPublicFood(path, dataset_channel);
        if (!result) return asToolResult({
          found: false,
          message: "No public eligible record at this path for the chosen dataset channel."
        });
        return asToolResult({ found: true, record: result });
      } catch (error) {
        return toolFailure(error);
      }
    }
  );

  server.registerTool(
    "list_brands",
    {
      title: "List indexed food brand directories",
      description: "List brand directory names in the TWFoodMCP repository. These are unverified discovery candidates, NOT counts of public human-reviewed foods.",
      inputSchema: z.object({}).strict(),
      annotations: readOnly
    },
    async () => {
      try {
        return asToolResult(await listFoodBrands());
      } catch (error) {
        return toolFailure(error);
      }
    }
  );
});

export { handler as GET, handler as POST };
