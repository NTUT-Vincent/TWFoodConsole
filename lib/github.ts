const API = "https://api.github.com";
export const OKF_REPO = process.env.OKF_REPO || "NTUT-Vincent/TWFoodMCP";
export const OKF_BRANCH = "main";
const KNOWLEDGE_ROOT = "knowledge/";

export type FoodEntry = { path: string; name: string; brand: string; group: string };

export function validConceptPath(path: unknown): path is string {
  return typeof path === "string" &&
    path.startsWith(KNOWLEDGE_ROOT) &&
    path.split("/").length >= 3 &&
    path.endsWith(".md") &&
    !["index.md", "log.md"].includes(path.split("/").at(-1) || "") &&
    !path.split("/").some((x) => !x || x === "." || x === ".." || x.includes("\\") || x.includes("\0"));
}

export function safeRepo(): string {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(OKF_REPO)) throw new Error("Invalid OKF_REPO");
  return OKF_REPO;
}

export async function github<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(API + path, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { "Authorization": "Bearer " + token } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!response.ok) {
    const msg = typeof data === "object" && data !== null && "message" in data ? String(data.message) : "GitHub API error";
    throw new Error("GitHub " + response.status + ": " + msg);
  }
  return data as T;
}

export async function readConcept(path: string) {
  if (!validConceptPath(path)) throw new Error("Invalid concept path");
  const repo = safeRepo();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await github<{ content: string; encoding: string; sha: string; html_url: string }>(
    "/repos/" + repo + "/contents/" + encodedPath + "?ref=" + OKF_BRANCH
  );
  if (response.encoding !== "base64") throw new Error("Unexpected GitHub encoding");
  return {
    path,
    sha: response.sha,
    content: Buffer.from(response.content.replace(/\s/g, ""), "base64").toString("utf8"),
    githubUrl: response.html_url
  };
}
