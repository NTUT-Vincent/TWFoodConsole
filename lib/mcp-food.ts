import { unstable_cache } from "next/cache";
import { github, readConcept, safeRepo, validConceptPath, type FoodEntry } from "@/lib/github";
import { inspectOkf, type OkfMeta } from "@/lib/okf";

export type DatasetChannel = "stable" | "preview";

type GithubTree = {
  tree: Array<{ path: string; type: string }>;
  truncated?: boolean;
};

type FoodResult = {
  path: string;
  github_url: string;
  sha: string;
  status: string;
  trust_tier: "human-reviewed" | "machine-confirmed" | "unverified";
  stale: boolean;
  stale_after: unknown;
  title: unknown;
  food: unknown;
  serving: unknown;
  nutrition: unknown;
  ingredients: unknown;
  allergens: unknown;
  quality: unknown;
  revision: unknown;
  sources: unknown;
  verified: unknown;
  limitations: unknown;
  warning?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function verificationActors(data: OkfMeta): string[] {
  const events = Array.isArray(data.verified) ? data.verified : data.verified ? [data.verified] : [];
  return events.map((entry) => record(entry).by).filter((actor): actor is string => typeof actor === "string");
}

function trustTier(data: OkfMeta, reviewers: ReadonlySet<string>): FoodResult["trust_tier"] {
  const actors = verificationActors(data);
  if (actors.some((actor) => actor.startsWith("human:") && reviewers.has(actor))) return "human-reviewed";
  return actors.length > 0 ? "machine-confirmed" : "unverified";
}

function isPublicFood(data: OkfMeta, channel: DatasetChannel, reviewers: ReadonlySet<string>): boolean {
  if (record(data.access).classification !== "public") return false;
  if (data.status === "stable") return trustTier(data, reviewers) === "human-reviewed";
  return channel === "preview" && data.status === "draft";
}

function todayTaipei(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [values.year, values.month, values.day].join("-");
}

function staleAfterDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// A tree is an index of *candidates*, not a published dataset. Publication
// eligibility is checked against each document's exact OKF frontmatter.
export const listFoodCandidates = unstable_cache(async (): Promise<FoodEntry[]> => {
  const repo = safeRepo();
  const tree = await github<GithubTree>("/repos/" + repo + "/git/trees/main?recursive=1");
  if (tree.truncated) throw new Error("GitHub tree is truncated; refusing incomplete search results");
  return tree.tree.filter((entry) =>
    entry.type === "blob" &&
    validConceptPath(entry.path) &&
    !entry.path.split("/").some((part) => part.endsWith("-deprecated"))
  ).map(({ path }) => ({
    path,
    brand: path.split("/")[2],
    name: (path.split("/").at(-1) || "").replace(/\.md$/u, "").replace(/_/gu, " ")
  })).sort((a, b) => a.path.localeCompare(b.path, "zh-Hant"));
}, ["twfood-mcp-food-tree-v1"], { revalidate: 300 });

const authorizedReviewers = unstable_cache(async (): Promise<string[]> => {
  const repo = safeRepo();
  const file = await github<{ content: string; encoding: string }>(
    "/repos/" + repo + "/contents/config/authorized-reviewers.json?ref=main"
  );
  if (file.encoding !== "base64") throw new Error("Unexpected reviewers file encoding");
  const data: unknown = JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"));
  const reviewers = record(data).reviewers;
  if (!Array.isArray(reviewers) || !reviewers.length ||
      !reviewers.every((item) => typeof item === "string" && item.startsWith("human:"))) {
    throw new Error("Invalid authorized reviewers configuration");
  }
  return reviewers as string[];
}, ["twfood-mcp-approved-reviewers-v1"], { revalidate: 300 });

const cachedConcept = unstable_cache(
  async (path: string) => readConcept(path),
  ["twfood-mcp-concept-v1"],
  { revalidate: 300 }
);

export async function getPublicFood(path: string, channel: DatasetChannel = "stable"): Promise<FoodResult | null> {
  if (!validConceptPath(path) || path.split("/").some((part) => part.endsWith("-deprecated"))) {
    throw new Error("Invalid food concept path");
  }
  const [concept, reviewerList] = await Promise.all([cachedConcept(path), authorizedReviewers()]);
  const inspected = inspectOkf(concept.content);
  if (inspected.errors.length || !inspected.data) return null;
  const data = inspected.data;
  const reviewers = new Set(reviewerList);
  if (!isPublicFood(data, channel, reviewers)) return null;
  const staleAfter = staleAfterDate(data.stale_after);
  const stale = !!staleAfter && todayTaipei() >= staleAfter;
  const status = String(data.status);
  return {
    path: concept.path,
    github_url: concept.githubUrl,
    sha: concept.sha,
    status,
    trust_tier: trustTier(data, reviewers),
    stale,
    stale_after: staleAfter,
    title: data.title ?? null,
    food: data.food ?? null,
    serving: data.serving ?? null,
    nutrition: data.nutrition ?? [],
    ingredients: data.ingredients ?? [],
    allergens: data.allergens ?? null,
    quality: data.quality ?? null,
    revision: data.revision ?? null,
    sources: data.sources ?? [],
    verified: data.verified ?? [],
    limitations: data.limitations ?? [],
    ...(status === "draft"
      ? { warning: "Unreviewed preview draft: not eligible for deterministic nutrition calculations." }
      : stale
        ? { warning: "This record is stale; check the latest product label and source." }
        : {})
  };
}

function normalized(value: string): string {
  const base = value.normalize("NFKC").toLocaleLowerCase("zh-Hant").replace(/[^\p{L}\p{N}]/gu, "");
  const aliases: Record<string, string> = {
    "711": "7eleven", "7-11": "7eleven", "全家": "familymart",
    "麥當勞": "mcdonalds", "星巴克": "starbucks", "路易莎": "louisa"
  };
  return aliases[base] || base;
}

export async function searchPublicFood(options: {
  query: string;
  brand?: string;
  datasetChannel?: DatasetChannel;
  limit?: number;
  cursor?: number;
}) {
  const { query, brand, datasetChannel = "stable", limit = 5, cursor = 0 } = options;
  const parts = query.trim().split(/\s+/u).map(normalized).filter(Boolean);
  if (parts.length === 0) throw new Error("A non-empty query is required");
  const brandTerm = brand ? normalized(brand) : "";
  const candidates = await listFoodCandidates();
  const matches = candidates.filter((entry) => {
    const path = normalized(entry.path + " " + entry.name);
    return parts.every((part) => path.includes(part)) && (!brandTerm || path.includes(brandTerm));
  });
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  let position = Math.max(0, Math.trunc(cursor));
  let scanned = 0;
  const maxScan = 30;
  const foods: FoodResult[] = [];

  // The repo includes many drafts. Cap GitHub reads per invocation, expose a
  // cursor, and never leak draft values through the default stable channel.
  while (position < matches.length && scanned < maxScan && foods.length < safeLimit) {
    const batch = matches.slice(position, position + Math.min(5, maxScan - scanned, safeLimit - foods.length));
    const resolved = await Promise.all(batch.map((entry) => getPublicFood(entry.path, datasetChannel)));
    for (const food of resolved) if (food && foods.length < safeLimit) foods.push(food);
    position += batch.length;
    scanned += batch.length;
  }
  return {
    dataset_channel: datasetChannel,
    query,
    brand: brand ?? null,
    results: foods,
    scanned_candidates: scanned,
    matching_path_candidates: matches.length,
    next_cursor: position < matches.length ? position : null,
    warning: datasetChannel === "preview"
      ? "Preview may include unreviewed drafts. Do not use drafts for nutrition calculations."
      : "Stable results include only public records with authorized human review. Empty results do not imply the food is unavailable in the repository."
  };
}

export async function listFoodBrands() {
  const candidates = await listFoodCandidates();
  const brands = new Map<string, number>();
  for (const item of candidates) brands.set(item.brand, (brands.get(item.brand) ?? 0) + 1);
  return {
    brands: [...brands].map(([slug, candidate_files]) => ({ slug, candidate_files })),
    warning: "Brand names are directory candidates; counts include unreviewed drafts. Use search_food with dataset_channel=stable to find published records."
  };
}
