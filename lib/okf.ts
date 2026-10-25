import { parseDocument } from "yaml";

export type OkfMeta = Record<string, unknown>;
export type Inspection = { data: OkfMeta | null; errors: string[]; warnings: string[] };

export const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function inspectOkf(source: string): Inspection {
  const errors: string[] = [];
  const warnings: string[] = [];
  const match = source.match(FRONTMATTER);
  if (!match) return { data: null, errors: ["缺少 YAML Frontmatter（--- 區塊）"], warnings };
  const document = parseDocument(match[1], { uniqueKeys: true });
  for (const error of document.errors) errors.push(error.message);
  if (errors.length) return { data: null, errors, warnings };
  const data = document.toJS();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { data: null, errors: ["Frontmatter 必須是 YAML mapping"], warnings };
  }
  const meta = data as OkfMeta;
  if (typeof meta.type !== "string" || !meta.type.trim()) errors.push("OKF v0.2 必填：非空 type");
  if (!["draft", "stable", "deprecated"].includes(String(meta.status ?? ""))) {
    warnings.push("TWFoodMCP domain profile：必須明確指定 draft / stable / deprecated");
  }
  if (!Array.isArray(meta.sources) || meta.sources.length === 0) {
    warnings.push("TWFoodMCP domain profile：建議至少有一筆可追溯 sources");
  } else if (meta.sources.some((s) => !s || typeof s !== "object" || typeof (s as { resource?: unknown }).resource !== "string")) {
    warnings.push("sources 中有缺少 resource 的紀錄");
  }
  if (meta.trust_tier !== undefined) warnings.push("不應在來源 OKF 手動填寫 trust_tier；此值應由 verified 推導");
  if (meta.quality === undefined) warnings.push("TWFoodMCP domain profile：缺少 quality");
  return { data: meta, errors, warnings };
}

export function humanReviewed(meta: OkfMeta): boolean {
  const entries = meta.verified ? (Array.isArray(meta.verified) ? meta.verified : [meta.verified]) : [];
  return entries.some((entry) => entry && typeof entry === "object" && typeof entry.by === "string" && entry.by.startsWith("human:"));
}

export function machineReviewed(meta: OkfMeta): boolean {
  const entries = meta.verified ? (Array.isArray(meta.verified) ? meta.verified : [meta.verified]) : [];
  return entries.length > 0;
}
