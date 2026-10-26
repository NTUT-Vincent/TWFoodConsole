"use client";

import { useEffect, useMemo, useState } from "react";
import { parseDocument } from "yaml";
import {
  Search, RefreshCw, ChevronRight, ExternalLink, Pencil,
  CheckCircle2, AlertCircle, ClipboardCheck, LockKeyhole, Leaf, X
} from "lucide-react";
import { humanReviewed, inspectOkf, type OkfMeta } from "@/lib/okf";
import type { FoodEntry } from "@/lib/github";

type Concept = { content: string; sha: string; path: string; githubUrl: string };
type FoodIndex = { files: FoodEntry[]; truncated: boolean };
type EditFields = Record<string, string>;

const NUTRIENTS = [
  { key: "energy_kcal", label: "熱量", unit: "大卡" },
  { key: "protein_g", label: "蛋白質", unit: "公克" },
  { key: "fat_g", label: "脂肪", unit: "公克" },
  { key: "saturated_fat_g", label: "飽和脂肪", unit: "公克" },
  { key: "trans_fat_g", label: "反式脂肪", unit: "公克" },
  { key: "carbohydrate_g", label: "碳水化合物", unit: "公克" },
  { key: "sugar_g", label: "糖", unit: "公克" },
  { key: "sodium_mg", label: "鈉", unit: "毫克" },
  { key: "dietary_fiber_g", label: "膳食纖維", unit: "公克" }
] as const;

const BRAND_NAMES: Record<string, string> = {
  "7-eleven": "7-ELEVEN", familymart: "全家", mcdonalds: "麥當勞",
  starbucks: "星巴克", mwd: "麥味登", louisa: "路易莎",
  "mos-burger": "摩斯漢堡", kfc: "肯德基", "burgerking": "漢堡王",
  "pizza-hut": "必勝客", subway: "SUBWAY", sukiya: "すき家",
  sushiro: "壽司郎", bafangyunji: "八方雲集", "50lagu": "50嵐",
  macuteafang: "麻古茶坊", "marugame-seimen": "丸亀製麵",
  okmart: "OK超商", "honger-burger": "弘爺漢堡",
  "laiya-burger": "拉亞漢堡", "generic-recipes": "一般料理",
  "generic-sushi": "一般壽司", "instant-noodles": "泡麵",
  "google-sheet-deprecated": "歷史資料", "dailydietitian-deprecated": "歷史資料",
  "21st-century-flavor-factory": "21風味館", kenshui: "肯水",
  laifu: "來福", dezheng: "得正", "morning-michishiki": "早安美芝城",
  zazengbao: "炸雞大獅"
};
const CATEGORY_NAMES: Record<string, string> = {
  algae: "藻類", "bakery-snacks": "烘焙與點心", beverages: "飲料",
  dairy: "乳品", eggs: "蛋類", "fats-oils": "油脂",
  "fish-shellfish": "魚類與海鮮", fruits: "水果", grains: "穀物",
  legumes: "豆類", meats: "肉類", mushrooms: "菇類",
  "nuts-seeds": "堅果與種子", "processed-prepared-foods": "加工食品",
  "seasonings-spices": "調味料", starches: "澱粉類",
  sugars: "糖類", vegetables: "蔬菜"
};
function groupName(group: string): string {
  return group === "generic-foods" ? "一般食品" : group === "menu-items" ? "餐飲與包裝食品" : group.replace(/-/g, " ");
}
function categoryName(entry: FoodEntry): string {
  const name = entry.group === "generic-foods"
    ? (CATEGORY_NAMES[entry.brand] || entry.brand.replace(/-/g, " "))
    : brandName(entry.brand);
  return entry.group === "menu-items" ? name : groupName(entry.group) + " · " + name;
}
const SOURCE_NAMES: Record<string, string> = {
  primary_label: "商品包裝", primary_government: "政府公開資料",
  primary_official: "品牌官方資料", verifiable_secondary: "其他可查證資料",
  expert_interpretation: "專業人士整理", third_party_dataset: "第三方資料",
  community_submission: "民眾提供", estimated_or_untraceable: "估算或來源待確認"
};
const STATUS_NAMES: Record<string, string> = {
  draft: "待審核", stable: "已發布", deprecated: "已停用"
};
const SERVING_NAMES: Record<string, string> = {
  per_serving: "每份", per_100g: "每 100 公克",
  per_100ml: "每 100 毫升", per_package: "每包裝"
};

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function brandName(slug: string): string {
  return BRAND_NAMES[slug] || slug.replace(/-/g, " ");
}
function documentName(entry: FoodEntry): string {
  return entry.name.replace(/\.md$/i, "").replace(/_/g, " ");
}
function firstNutrition(meta: OkfMeta): Record<string, unknown> {
  return Array.isArray(meta.nutrition) ? obj(meta.nutrition[0]) : {};
}
function buildFields(meta: OkfMeta): EditFields {
  const values = obj(firstNutrition(meta).values);
  const food = obj(meta.food);
  const serving = obj(meta.serving);
  const fields: EditFields = {
    name: str(food.name) || str(meta.title),
    serving: str(serving.description)
  };
  for (const nutrient of NUTRIENTS) {
    fields[nutrient.key] = str(values[nutrient.key] ?? (nutrient.key === "dietary_fiber_g" ? values.fiber_g : undefined));
  }
  return fields;
}
function applyFields(source: string, fields: EditFields): string {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("資料格式無法編輯");
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error("資料格式無法編輯");

  const name = fields.name.trim();
  if (!name) throw new Error("請填寫食品名稱");
  doc.setIn(["food", "name"], name);
  if (doc.has("title")) doc.set("title", name);
  const serving = fields.serving.trim();
  if (serving) doc.setIn(["serving", "description"], serving);
  else doc.deleteIn(["serving", "description"]);

  const original = inspectOkf(source).data || {};
  if (Array.isArray(original.nutrition) && original.nutrition.length > 0) {
    for (const nutrient of NUTRIENTS) {
      const raw = (fields[nutrient.key] || "").trim();
      const originalValues = obj(firstNutrition(original).values);
      const sourceKey = nutrient.key === "dietary_fiber_g" &&
        originalValues.dietary_fiber_g === undefined && originalValues.fiber_g !== undefined
        ? "fiber_g" : nutrient.key;
      if (!raw) {
        doc.deleteIn(["nutrition", 0, "values", sourceKey]);
        continue;
      }
      const number = Number(raw);
      if (!Number.isFinite(number) || number < 0) throw new Error("請檢查「" + nutrient.label + "」的數值");
      doc.setIn(["nutrition", 0, "values", sourceKey], number);
    }
  }
  return "---\n" + doc.toString() + "---\n" + source.slice(match[0].length);
}

function NutritionTable({ meta }: { meta: OkfMeta }) {
  const nutrition = firstNutrition(meta);
  const values = obj(nutrition.values);
  const serving = str(obj(meta.serving).description);
  const basisKey = str(nutrition.basis);
  const basis = basisKey === "per_serving"
    ? (serving || "每份")
    : (SERVING_NAMES[basisKey] || "份量未註明");
  return (
    <section className="panel">
      <div className="panel-title"><h3>營養成分</h3><span>{basis}</span></div>
      {serving && basisKey !== "per_serving" && <p className="serving-description">包裝份量：{serving}</p>}
      <div className="nutrient-grid">
        {NUTRIENTS.map(({ key, label, unit }) => {
          const value = values[key] ?? (key === "dietary_fiber_g" ? values.fiber_g : undefined);
          const known = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
          return <div className="nutrient" key={key}>
            <span>{label}</span>
            <strong className={known ? "" : "unknown"}>{known ? String(value) : "—"}</strong>
            <small>{known ? unit : "未提供"}</small>
          </div>;
        })}
      </div>
    </section>
  );
}

export default function Home() {
  const [index, setIndex] = useState<FoodIndex | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [path, setPath] = useState("");
  const [concept, setConcept] = useState<Concept | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<EditFields>({});
  const [reviewKey, setReviewKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  useEffect(() => {
    fetch("/api/access").then((res) => res.json())
      .then((data) => setCanSubmit(data.canSubmit === true))
      .catch(() => setCanSubmit(false));
  }, []);

  async function reload() {
    setIndexError(false);
    try {
      const res = await fetch("/api/foods", { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const body: FoodIndex = await res.json();
      setIndex(body);
    } catch { setIndexError(true); }
  }
  useEffect(() => { void reload(); }, []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setConcept(null);
    setEditing(false);
    setDetailError(false);
    setConfirmed(false);
    setMessage("");
    setResultUrl("");
    setLoading(true);
    fetch("/api/food?path=" + encodeURIComponent(path), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return await res.json() as Concept;
      })
      .then((data) => {
        if (!alive) return;
        setConcept(data);
        setFields(buildFields(inspectOkf(data.content).data || {}));
      })
      .catch(() => { if (alive) setDetailError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path]);

  const brands = useMemo(() => {
    const unique = new Map<string, string>();
    for (const entry of index?.files || []) unique.set(entry.group + "/" + entry.brand, categoryName(entry));
    return [...unique].map(([value, label]) => ({ value, label }))
      .sort((a, b) =>
        Number(a.value.startsWith("generic-foods/")) - Number(b.value.startsWith("generic-foods/")) ||
        a.label.localeCompare(b.label, "zh-Hant")
      );
  }, [index]);

  const filtered = useMemo(() => (index?.files || []).filter((entry) => {
    if (brand !== "all" && entry.group + "/" + entry.brand !== brand) return false;
    const keyword = search.trim().toLocaleLowerCase();
    return !keyword || (documentName(entry) + " " + categoryName(entry)).toLocaleLowerCase().includes(keyword);
  }), [index, brand, search]);

  const inspection = useMemo(() => inspectOkf(concept?.content || ""), [concept]);
  const meta = inspection.data || {};
  const food = obj(meta.food);
  const sources = Array.isArray(meta.sources) ? meta.sources.map(obj) : [];
  const status = str(meta.status);
  const isReviewed = humanReviewed(meta);
  const hasNutrition = Array.isArray(meta.nutrition) && meta.nutrition.length > 0;
  const expired = typeof meta.stale_after === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(meta.stale_after) &&
    new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }) >= meta.stale_after;

  async function submit(action: "edit" | "verify") {
    if (!concept || !reviewKey.trim() || busy) return;
    if (action === "verify" && !confirmed) return;
    let content: string | undefined;
    if (action === "edit") {
      try { content = applyFields(concept.content, fields); }
      catch (error) {
        setMessage(error instanceof Error ? error.message : "請確認填寫的資料");
        return;
      }
      if (content === concept.content) {
        setMessage("沒有需要儲存的變更");
        return;
      }
    }
    setBusy(true);
    setMessage("");
    setResultUrl("");
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + reviewKey },
        body: JSON.stringify({
          action, path: concept.path, sha: concept.sha, content,
          confirmed: action === "verify" ? true : undefined
        })
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("審核密碼不正確");
        if (response.status === 409) throw new Error("資料已被更新，請重新整理再試一次");
        if (response.status === 503) throw new Error("目前尚未開放送出修改，請聯絡管理者");
        if (response.status === 422) throw new Error("資料內容需要進一步檢查，請聯絡管理者");
        throw new Error("送出失敗，請稍後重試");
      }
      const result = await response.json() as { pullRequestUrl?: string };
      setMessage(action === "edit" ? "修改已送出，等待確認後才會更新。" : "審核結果已送出，等待確認。");
      setResultUrl(result.pullRequestUrl || "");
      setEditing(false);
      setConfirmed(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "送出失敗，請稍後重試");
    } finally { setBusy(false); }
  }

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-brand"><div className="site-icon"><Leaf size={21}/></div><strong>TWFood</strong><span>食品營養資料庫</span></div>
      </header>
      <main className="main">
        <div className="page-heading"><h1>食品資料</h1><button className="outline-btn" onClick={() => void reload()}><RefreshCw size={15}/> 重新整理</button></div>
        <div className="columns">
          <section className="list-panel">
            <div className="list-heading"><strong>食品清單</strong><span>{index ? index.files.length.toLocaleString() + " 筆" : ""}</span></div>
            <div className="filters">
              <label className="search-field"><Search size={17}/><input aria-label="搜尋食品名稱或品牌" placeholder="搜尋食品名稱或品牌" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
              <select aria-label="選擇品牌" value={brand} onChange={(event) => setBrand(event.target.value)}>
                <option value="all">全部品牌與類別</option>
                {brands.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
              {index && <span className="filter-count">找到 {filtered.length.toLocaleString()} 筆</span>}
            </div>
            <div className="food-list">
              {!index && !indexError && <p className="quiet-message">正在載入食品資料…</p>}
              {indexError && <p className="quiet-message">目前無法讀取清單，請稍後重試。</p>}
              {index && filtered.length === 0 && <p className="quiet-message">找不到符合的食品。</p>}
              {filtered.slice(0, 100).map((entry) =>
                <button className={"food-item " + (entry.path === path ? "current" : "")} key={entry.path} onClick={() => setPath(entry.path)}>
                  <span><strong>{documentName(entry)}</strong><small>{categoryName(entry)}</small></span><ChevronRight size={16}/>
                </button>
              )}
              {filtered.length > 100 && <p className="list-hint">還有更多結果，請輸入食品名稱搜尋。</p>}
              {index?.truncated && <p className="list-hint">部分資料暫時無法顯示。</p>}
            </div>
          </section>
          <div className="details">
            {!path && <div className="panel empty-state"><Leaf size={32}/><h2>請選擇食品</h2><p>選擇左側食品，即可查看營養成分與資料來源。</p></div>}
            {loading && <div className="panel empty-state">正在載入食品資料…</div>}
            {detailError && <div className="panel empty-state">目前無法取得這項食品資料，請稍後重試。</div>}
            {concept && !loading && <>
              <section className="panel food-summary">
                <div className="food-brand">{str(food.brand) || categoryName({ path, name: "", brand: path.split("/")[2], group: path.split("/")[1] })}</div>
                <h2>{str(food.name) || str(meta.title) || "未命名食品"}</h2>
                <div className="state-tags">
                  <span className={"state-tag " + (status === "stable" ? "published" : status === "deprecated" ? "muted" : "pending")}>{STATUS_NAMES[status] || "狀態待確認"}</span>
                  <span className={"state-tag " + (isReviewed ? "published" : "muted")}>{isReviewed ? "已人工核對" : "尚未人工核對"}</span>
                </div>
                {expired && <div className="notice warning"><AlertCircle size={17}/> 這筆資料可能已過期，請重新確認商品標示。</div>}
                {inspection.errors.length > 0 && <div className="notice warning"><AlertCircle size={17}/> 這筆資料有缺漏，請聯絡管理者協助確認。</div>}
              </section>
              <NutritionTable meta={meta}/>
              <section className="panel">
                <div className="panel-title"><h3>資料來源</h3><span>{sources.length} 筆</span></div>
                {sources.length ? <div className="source-list">{sources.map((source, index) =>
                  <div className="source-row" key={index}>
                    <div className="source-title">{str(source.title) || "來源 " + (index + 1)}</div>
                    {str(source.source_class) && <span className="source-type">{SOURCE_NAMES[str(source.source_class)] || "其他資料來源"}</span>}
                    {typeof source.resource === "string" && /^https?:\/\//.test(source.resource) && <a href={source.resource} target="_blank" rel="noopener noreferrer">查看資料來源 <ExternalLink size={15}/></a>}
                  </div>
                )}</div> : <p className="plain-message">尚未提供資料來源。</p>}
              </section>
              <section className="panel actions-panel">
                <div className="panel-title"><h3>資料審核與修改</h3></div>
                {!canSubmit ? <p className="plain-message">目前提供資料查閱，修改與審核功能尚未開放。</p> : <>
                  {!editing ? <>
                    <button className="outline-btn edit-trigger" onClick={() => { setFields(buildFields(meta)); setEditing(true); setMessage(""); setResultUrl(""); }} disabled={inspection.errors.length > 0}>
                      <Pencil size={16}/> 修改食品資料
                    </button>
                    <div className="review-area">
                      <h4>確認資料正確</h4>
                      <label className="check-control"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/><span>我已比對來源，確認食品名稱、份量與營養數值。</span></label>
                      <label className="password-control"><LockKeyhole size={16}/><input type="password" autoComplete="off" aria-label="審核密碼" placeholder="請輸入審核密碼" value={reviewKey} onChange={(event) => setReviewKey(event.target.value)}/></label>
                      <button className="primary-btn" onClick={() => void submit("verify")} disabled={!confirmed || !reviewKey.trim() || busy || inspection.errors.length > 0}>
                        <ClipboardCheck size={17}/>{busy ? "送出中…" : "送出審核"}
                      </button>
                    </div>
                  </> : <>
                    <div className="edit-head"><h4>修改食品資料</h4><button className="icon-btn" aria-label="取消修改" onClick={() => { setEditing(false); setMessage(""); }}><X size={19}/></button></div>
                    <div className="edit-form">
                      <label className="full">食品名稱<input value={fields.name || ""} onChange={(event) => setFields((old) => ({ ...old, name: event.target.value }))}/></label>
                      <label className="full">份量說明<input placeholder="例如：每份 385 公克" value={fields.serving || ""} onChange={(event) => setFields((old) => ({ ...old, serving: event.target.value }))}/></label>
                      {hasNutrition && NUTRIENTS.map((nutrient) =>
                        <label key={nutrient.key}>{nutrient.label}（{nutrient.unit}）
                          <input type="number" min="0" step="any" placeholder="未提供" value={fields[nutrient.key] || ""} onChange={(event) => setFields((old) => ({ ...old, [nutrient.key]: event.target.value }))}/>
                        </label>
                      )}
                    </div>
                    <label className="password-control"><LockKeyhole size={16}/><input type="password" autoComplete="off" aria-label="審核密碼" placeholder="請輸入審核密碼" value={reviewKey} onChange={(event) => setReviewKey(event.target.value)}/></label>
                    <div className="form-buttons"><button className="primary-btn" disabled={!reviewKey.trim() || busy} onClick={() => void submit("edit")}>{busy ? "送出中…" : "送出修改"}</button><button className="outline-btn" onClick={() => setEditing(false)}>取消</button></div>
                  </>}
                  {message && <div className={"notice " + (resultUrl ? "success" : "warning")} role="status">{resultUrl ? <CheckCircle2 size={17}/> : <AlertCircle size={17}/>}<span>{message}{resultUrl && <> <a href={resultUrl} target="_blank" rel="noopener noreferrer">查看送出結果 <ExternalLink size={14}/></a></>}</span></div>}
                </>}
              </section>
            </>}
          </div>
        </div>
      </main>
    </div>
  );
}
