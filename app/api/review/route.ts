import { NextRequest, NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { parseDocument } from "yaml";
import { FRONTMATTER, inspectOkf } from "@/lib/okf";
import { github, OKF_BRANCH, readConcept, safeRepo, validConceptPath } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.CONSOLE_ADMIN_KEY || "";
  const actual = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (expected.length < 24 || !actual) return false;
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function changeFrontmatter(source: string, action: "verify" | "edit") {
  const match = source.match(FRONTMATTER);
  if (!match) throw new Error("Missing YAML frontmatter");
  const document = parseDocument(match[1]);
  if (document.errors.length) throw new Error("Invalid YAML");
  const reviewer = process.env.CONSOLE_REVIEWER || "ntut-vincent";
  if (!/^[A-Za-z0-9-]+$/.test(reviewer)) throw new Error("Invalid CONSOLE_REVIEWER");
  const actor = "human:" + reviewer;
  const now = new Date().toISOString();
  if (action === "verify") {
    const prior = document.get("verified", true);
    const existing = prior && typeof prior === "object" && "toJSON" in prior
      ? (prior as { toJSON(): unknown }).toJSON() : null;
    const entries = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
    document.set("verified", [...entries, { by: actor, at: now }]);
  } else {
    // Editing invalidates confirmation against the prior exact content.
    document.delete("verified");
    document.set("generated", { by: actor, at: now });
  }
  return "---\n" + document.toString() + "---\n" + source.slice(match[0].length);
}

export async function POST(request: NextRequest) {
  if (!process.env.GITHUB_TOKEN || !process.env.CONSOLE_ADMIN_KEY) {
    return NextResponse.json({ error: "Read-only mode. Configure GITHUB_TOKEN and CONSOLE_ADMIN_KEY on Vercel." }, { status: 503 });
  }
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as {
      path?: string; sha?: string; action?: "edit" | "verify"; content?: string; confirmed?: boolean
    };
    if (!validConceptPath(body.path) || !body.sha || !/^[a-f0-9]{40}$/i.test(body.sha)) {
      return NextResponse.json({ error: "Invalid path or SHA" }, { status: 400 });
    }
    if (body.action !== "edit" && body.action !== "verify") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (body.action === "verify" && body.confirmed !== true) {
      return NextResponse.json({ error: "Explicit source review confirmation required" }, { status: 400 });
    }
    const current = await readConcept(body.path);
    if (current.sha !== body.sha) {
      return NextResponse.json({ error: "File changed on GitHub. Reload to review the latest revision." }, { status: 409 });
    }
    let content: string;
    if (body.action === "verify") {
      const inspection = inspectOkf(current.content);
      if (inspection.errors.length || inspection.warnings.some((w) => w.includes("必須明確"))) {
        return NextResponse.json({ error: "Basic format / lifecycle check failed" }, { status: 422 });
      }
      content = changeFrontmatter(current.content, "verify");
    } else {
      if (!body.content || body.content.length > 250000 || body.content === current.content) {
        return NextResponse.json({ error: "No valid changes" }, { status: 400 });
      }
      const inspection = inspectOkf(body.content);
      if (inspection.errors.length || inspection.warnings.some((w) => w.includes("必須明確"))) {
        return NextResponse.json({ error: "Basic OKF validation failed: " + [...inspection.errors, ...inspection.warnings].join("; ") }, { status: 422 });
      }
      content = changeFrontmatter(body.content, "edit");
    }
    const repo = safeRepo();
    const parent = await github<{ object: { sha: string } }>("/repos/" + repo + "/git/ref/heads/" + OKF_BRANCH);
    const branch = "console/" + body.action + "-" + randomUUID().slice(0, 12);
    await github("/repos/" + repo + "/git/refs", {
      method: "POST",
      body: JSON.stringify({ ref: "refs/heads/" + branch, sha: parent.object.sha })
    });
    const encodedPath = body.path.split("/").map(encodeURIComponent).join("/");
    await github("/repos/" + repo + "/contents/" + encodedPath, {
      method: "PUT",
      body: JSON.stringify({
        message: "docs(okf): " + (body.action === "verify" ? "review " : "edit ") + body.path,
        content: Buffer.from(content, "utf8").toString("base64"),
        sha: current.sha,
        branch
      })
    });
    const pr = await github<{ html_url: string; number: number }>("/repos/" + repo + "/pulls", {
      method: "POST",
      body: JSON.stringify({
        title: (body.action === "verify" ? "Review OKF: " : "Edit OKF: ") + body.path.split("/").at(-1),
        head: branch,
        base: OKF_BRANCH,
        body: "Submitted via TWFoodConsole.\n\n- Action: " + body.action +
          "\n- Concept: \`" + body.path + "\`\n- Base content SHA: \`" + body.sha +
          "\`\n\nPlease run TWFoodMCP's canonical validator, link checks, and publication gates before merge. No automatic stable promotion."
      })
    });
    return NextResponse.json({ pullRequestUrl: pr.html_url, number: pr.number }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 502 });
  }
}
