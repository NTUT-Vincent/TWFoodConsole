import { NextResponse } from "next/server";
import { github, safeRepo, validConceptPath, type FoodEntry } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repo = safeRepo();
    const result = await github<{ tree: Array<{ path: string; type: string }>; truncated?: boolean }>(
      "/repos/" + repo + "/git/trees/main?recursive=1"
    );
    const files: FoodEntry[] = result.tree
      .filter((x) => x.type === "blob" && validConceptPath(x.path))
      .map((x) => ({
        path: x.path,
        brand: x.path.split("/")[2],
        group: x.path.split("/")[1],
        name: x.path.split("/").at(-1)!.replace(/\.md$/, "").replace(/_/g, " ")
      }))
      .sort((a, b) => a.path.localeCompare(b.path, "zh-Hant"));
    return NextResponse.json({ files, truncated: !!result.truncated, repo });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 502 });
  }
}
