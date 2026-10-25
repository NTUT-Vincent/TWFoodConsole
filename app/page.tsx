"use client";

import { useEffect, useMemo, useState } from "react";
import YAML from "yaml";
import {
  BookOpen, ExternalLink, FileText, Search, ShieldCheck, CheckCircle2,
  AlertCircle, LockKeyhole, GitPullRequest, RefreshCw, ArrowUpRight,
  Database, ChevronRight, Pencil, RotateCcw, ClipboardCheck
} from "lucide-react";
import { humanReviewed, inspectOkf, machineReviewed, type OkfMeta } from "@/lib/okf";
import type { FoodEntry } from "@/lib/github";

type Concept = { content: string; sha: string; path: string; githubUrl: string };
type FoodIndex = { files: FoodEntry[]; truncated: boolean; repo: string };

function field(value: unknown): string {
  return typeof value === "number" || typeof value === "string" ? String(value) : "—";
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function name(path: string) {
  return path.split("/").at(-1)?.replace(/\.md$/, "").replace(/_/g, " ") || path;
}
function Nutrition({ data }: { data: OkfMeta }) {
  const nutrition = Array.isArray(data.nutrition) ? data.nutrition[0] : null;
  const values = object(object(nutrition).values);
  const items = [
    { label: "熱量", value: values.energy_kcal, unit: "kcal" },
    { label: "蛋白質", value: values.protein_g, unit: "g" },
    { label: "脂肪", value: values.fat_g, unit: "g" },
    { label: "碳水化合物", value: values.carbohydrate_g, unit: "g" },
    { label: "糖", value: values.sugar_g, unit: "g" },
    { label: "鈉", value: values.sodium_mg, unit: "mg" }
  ];
  return (
    <section className="panel">
      <div className="section-heading"><h3>營養成分</h3><span className="micro">{field(object(nutrition).basis)} · {field(object(data.serving).description)}</span></div>
      <div className="nutrition-grid">
        {items.map((item) => <div className="nutrition-cell" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value === null || item.value === undefined ? "—" : String(item.value)}</strong>
          <small>{item.value === null || item.value === undefined ? "未提供" : item.unit}</small>
        </div>)}
      </div>
      <p className="subtle note">缺少的營養值保持未知，不會自動視為 0 或進行單位換算。</p>
    </section>
  );
}
export default function Home() {
  const [index, setIndex] = useState<FoodIndex | null>(null);
  const [indexError, setIndexError] = useState("");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [selected, setSelected] = useState("");
  const [concept, setConcept] = useState<Concept | null>(null);
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"detail" | "markdown">("detail");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [prUrl, setPrUrl] = useState("");

  const reload = async () => {
    setIndexError("");
    try {
      const response = await fetch("/api/foods", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Index unavailable");
      setIndex(data);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "載入失敗");
    }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    setDetailError("");
    setConcept(null);
    setEditing(false);
    setConfirmed(false);
    setMessage("");
    setPrUrl("");
    setTab("detail");
    fetch("/api/food?path=" + encodeURIComponent(selected), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load concept");
        if (!cancelled) {
          setConcept(data);
          setDraft(data.content);
        }
      })
      .catch((error) => { if (!cancelled) setDetailError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const brands = useMemo(() => Array.from(new Set(index?.files.map((x) => x.brand) || [])).sort(), [index]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return (index?.files || []).filter((x) =>
      (brand === "all" || x.brand === brand) &&
      (!term || (x.path + " " + x.name).toLocaleLowerCase().includes(term))
    );
  }, [index, query, brand]);
  const visible = filtered.slice(0, 100);
  const source = editing ? draft : concept?.content || "";
  const inspection = useMemo(() => inspectOkf(source), [source]);
  const data = inspection.data || {};
  const food = object(data.food);
  const quality = object(data.quality);
  const sources = Array.isArray(data.sources) ? data.sources.map(object) : [];
  const trust = humanReviewed(data) ? "Human reviewed" : machineReviewed(data) ? "Machine confirmed" : "Unverified";
  const verified = humanReviewed(data);

  async function submit(action: "edit" | "verify") {
    if (!concept || !adminKey || busy) return;
    setBusy(true);
    setMessage("");
    setPrUrl("");
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + adminKey },
        body: JSON.stringify({
          action, path: concept.path, sha: concept.sha,
          content: action === "edit" ? draft : undefined,
          confirmed: action === "verify" ? confirmed : undefined
        })
      });
      const output = await response.json();
      if (!response.ok) throw new Error(output.error || "Unable to create PR");
      setMessage("已建立 Pull Request，等待 GitHub 審核與正式資料檢查。");
      setPrUrl(output.pullRequestUrl);
      setEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Database size={19}/></span>
          <div><strong>TWFood<span>Console</span></strong><small>OKF WORKSPACE</small></div>
        </div>
        <div className="side-section-label">KNOWLEDGE LIBRARY</div>
        <div className="side-nav-active"><BookOpen size={17}/> All food concepts <ChevronRight size={16}/></div>
        <div className="sidebar-bottom">
          <div className="status-dot"><span/> GitHub-backed data</div>
          <a href="https://github.com/NTUT-Vincent/TWFoodMCP" target="_blank" rel="noreferrer">TWFoodMCP Repository <ExternalLink size={13}/></a>
          <a href="https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md" target="_blank" rel="noreferrer">Open Knowledge Format v0.2 <ExternalLink size={13}/></a>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <ChevronRight size={14}/> <span>Food Knowledge</span></div>
          <div className="top-actions"><span className="read-tag"><span/> Live GitHub source</span><a href="https://github.com/NTUT-Vincent/TWFoodMCP/tree/main/knowledge" target="_blank" rel="noreferrer">View bundle <ArrowUpRight size={15}/></a></div>
        </header>
        <div className="page-header">
          <div><div className="eyebrow">TWFOOD MCP / REVIEW WORKSPACE</div><h1>Food knowledge console</h1><p>探索、檢查與審核台灣食品 OKF 文件。GitHub 是唯一正式資料來源。</p></div>
          <button className="ghost refresh" onClick={() => void reload()}><RefreshCw size={15}/> Refresh</button>
        </div>
        <div className="overview">
          <div><span>Knowledge documents</span><strong>{index ? index.files.length.toLocaleString() : "—"}</strong><small>來自 knowledge/menu-items</small></div>
          <div><span>Brands / categories</span><strong>{brands.length || "—"}</strong><small>依照 OKF 目錄層級</small></div>
          <div><span>Source repository</span><strong className="repo-number">TWFoodMCP</strong><small>NTUT-Vincent · main</small></div>
        </div>
        <div className="content-grid">
          <section className="file-panel">
            <div className="panel-header"><div><strong>Concept explorer</strong><small>瀏覽全部原始 OKF 文件</small></div><span className="count">{filtered.length}</span></div>
            <label className="search"><Search size={16}/><input placeholder="搜尋食品、路徑、品牌..." value={query} onChange={(e) => setQuery(e.target.value)}/></label>
            <select className="filter" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Filter by brand">
              <option value="all">所有品牌 / 類別</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="file-list">
              {!index && !indexError && <p className="placeholder">正在讀取 GitHub Index…</p>}
              {indexError && <p className="error-text">{indexError}</p>}
              {visible.length === 0 && index && <p className="placeholder">沒有符合條件的 OKF 文件。</p>}
              {visible.map((entry) => (
                <button key={entry.path} title={entry.path} className={"file-item " + (selected === entry.path ? "active" : "")} onClick={() => setSelected(entry.path)}>
                  <span className="file-icon"><FileText size={16}/></span>
                  <span className="file-content"><strong>{entry.name}</strong><small>{entry.brand}</small></span>
                  <ChevronRight size={14} className="file-chevron"/>
                </button>
              ))}
              {filtered.length > 100 && <p className="file-limit">顯示前 100 筆，請使用搜尋縮小範圍。</p>}
              {index?.truncated && <p className="file-limit">GitHub 回傳的目錄樹已截斷，可能有未列出的文件。</p>}
            </div>
          </section>
          <div className="detail-column">
            {!selected && <div className="empty panel"><div className="empty-icon"><BookOpen size={28}/></div><h2>Select a concept</h2><p>在左側選擇食品，即可檢視其營養資料、來源及 OKF 驗證狀態。</p></div>}
            {loading && <div className="empty panel"><p>讀取 OKF Concept…</p></div>}
            {detailError && <div className="panel error-text">{detailError}</div>}
            {concept && !loading && <>
              <section className="panel concept-panel">
                <div className="concept-top">
                  <div className="concept-meta"><span className="folder-chip">{field(food.brand) !== "—" ? field(food.brand) : concept.path.split("/")[2]}</span><span className="separator">/</span><span className="micro">{field(data.type)}</span></div>
                  <a className="github-link" href={concept.githubUrl} target="_blank" rel="noreferrer">GitHub <ExternalLink size={14}/></a>
                </div>
                <h2>{field(food.name) !== "—" ? field(food.name) : field(data.title) !== "—" ? field(data.title) : name(concept.path)}</h2>
                <p className="description">{field(data.description)}</p>
                <div className="pills"><span className={"pill " + (data.status === "stable" ? "green" : data.status === "deprecated" ? "gray" : "amber")}>{field(data.status)}</span><span className={"pill " + (verified ? "green" : "gray")}>{trust}</span><span className="pill gray">Quality: {field(quality.confidence)}</span></div>
                <div className="tabs"><button className={tab === "detail" ? "selected" : ""} onClick={() => setTab("detail")}>Overview</button><button className={tab === "markdown" ? "selected" : ""} onClick={() => setTab("markdown")}>Raw OKF / Edit</button></div>
                {tab === "detail" ? <div className="overview-detail">
                  <div className="kv"><span>Food ID</span><code>{field(food.id)}</code></div>
                  <div className="kv"><span>Source status</span><strong>{field(data.status)}</strong></div>
                  <div className="kv"><span>Data completeness</span><strong>{field(quality.completeness)}</strong></div>
                  <div className="kv"><span>Calculation allowed</span><strong>{quality.calculation_allowed === true ? "Yes" : "No / Unknown"}</strong></div>
                  <div className="kv"><span>Stale after</span><strong>{field(data.stale_after)}</strong></div>
                </div> : <div className="markdown-tab">
                  <div className="editor-heading"><span>原始 Markdown / YAML</span><button className="mini-btn" onClick={() => { setEditing(!editing); setDraft(concept.content); }}><Pencil size={14}/>{editing ? "取消編輯" : "編輯文件"}</button></div>
                  <textarea aria-label="Raw OKF Markdown" readOnly={!editing} spellCheck={false} value={editing ? draft : concept.content} onChange={(e) => setDraft(e.target.value)} rows={19}/>
                  {editing && <div className="editor-actions"><button className="primary" disabled={busy || inspection.errors.length > 0} onClick={() => void submit("edit")}><GitPullRequest size={15}/> {busy ? "處理中…" : "提出編輯 PR"}</button><button className="ghost" onClick={() => { setEditing(false); setDraft(concept.content); }}><RotateCcw size={14}/> 捨棄修改</button></div>}
                </div>}
              </section>
              {tab === "detail" && <Nutrition data={data}/>}
              <section className="panel sources">
                <div className="section-heading"><h3>Evidence & provenance</h3><span className="micro">{sources.length} sources</span></div>
                {sources.length ? sources.map((s, i) => (
                  <div className="source-item" key={String(s.id ?? i)}>
                    <div className="source-number">{i + 1}</div>
                    <div><strong>{field(s.title) !== "—" ? field(s.title) : field(s.resource)}</strong><div className="micro">{field(s.source_class)}</div>{typeof s.resource === "string" && /^https?:\/\//.test(s.resource) && <a href={s.resource} target="_blank" rel="noreferrer">查看來源 <ExternalLink size={13}/></a>}</div>
                  </div>
                )) : <p className="subtle">這筆資料尚未提供 sources。</p>}
              </section>
              <section className="panel validation">
                <div className="section-heading"><h3>OKF format check</h3><span className="micro">基本驗證 · 非完整發布檢查</span></div>
                <div className="validation-line">{inspection.errors.length ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} {inspection.errors.length ? inspection.errors.length + " 個格式錯誤" : "YAML / OKF v0.2 基本格式通過"}</div>
                {[...inspection.errors, ...inspection.warnings].map((issue, i) => <div className="validation-warning" key={i}><AlertCircle size={14}/>{issue}</div>)}
                <p className="subtle">正式審核仍應執行 TWFoodMCP validator、link check、身份與證據核對。此頁不能單獨證明數值正確。</p>
              </section>
              <section className="panel review">
                <div className="section-heading"><h3><ShieldCheck size={18}/> Human verification</h3><span className="micro">寫入僅建立 GitHub PR</span></div>
                <p>請先查看原始來源，確認食品身分、份量基準、營養值與修訂版本。驗證不會自動將 draft 升為 stable。</p>
                <label className="check-row"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}/><span>我已親自核對此版本的原始證據與資料內容。</span></label>
                <label className="credential"><LockKeyhole size={16}/><input type="password" autoComplete="off" placeholder="Console Admin Key（僅保留於此頁記憶體）" value={adminKey} onChange={(e) => setAdminKey(e.target.value)}/></label>
                <button className="primary verify-btn" disabled={!confirmed || !adminKey || busy || inspection.errors.length > 0 || editing} onClick={() => void submit("verify")}><ClipboardCheck size={16}/> {busy ? "建立 PR 中…" : "Submit verification PR"}</button>
                {message && <div role="status" className={prUrl ? "notice success" : "notice"}>{message}{prUrl && <a href={prUrl} target="_blank" rel="noreferrer">開啟 PR <ExternalLink size={14}/></a>}</div>}
                <p className="subtle">沒有設定 Vercel server-side GITHUB_TOKEN / CONSOLE_ADMIN_KEY 時，網站會保持唯讀。請勿將 token 放在前端。</p>
              </section>
            </>}
          </div>
        </div>
        <footer><span>TWFood Console · Open Knowledge Format v0.2</span><span>Evidence first. Human verified. Git versioned.</span></footer>
      </main>
    </div>
  );
}
