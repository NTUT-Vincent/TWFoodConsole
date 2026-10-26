# TWFoodConsole Agent Instructions

- The canonical OKF bundle is `NTUT-Vincent/TWFoodMCP/knowledge/`.
- Before changing parsing, validation, writing or review behavior, read official `GoogleCloudPlatform/open-knowledge-format` README.md and SPEC.md, plus TWFoodMCP/AGENTS.md, docs/MVP_SPEC.md, docs/TRUST_AND_CLASSIFICATION_POLICY.md, and docs/OKF_CONFORMANCE.md.
- Never conflate `status`, `verified`, source authority, `quality`, `stale_after`, and `access`.
- Never fabricate `human:*` verification. A logged-in human reviewer must explicitly confirm exact evidence. This prototype gates review writes behind a server-only admin secret.
- Drafts stay draft after a verification event; do not bypass review / promotion / Cloudflare publishing gates.
- All writes go to a new GitHub branch and PR. GitHub is the source of truth.
- GitHub credentials must remain server-side. Never create a publicly accessible write endpoint without authorization.
- Missing nutrition values are unknown, not zero.

## Primary users and interface language

- The primary users are Taiwanese dietitians, nutritionists, and food-data reviewers without programming knowledge.
- All user-facing text must be concise, natural Traditional Chinese. Use food terminology: 食品、營養成分、份量、資料來源、修改、審核、送出.
- Never expose technical concepts such as OKF, YAML, Markdown, frontmatter, GitHub, branches, PRs, APIs, runtime, commits, identifiers, repository paths, SDKs, or tokens in the ordinary interface, tooltips, alerts, and error messages.
- Technical internals remain in source code and developer documentation. Preserve all source-of-truth and policy gates.
- Use structured food and nutrient forms, not raw metadata or Markdown editors.
- No marketing slogans, developer dashboards, all-caps section titles, AI-sounding explanatory text, decorative English subtitles, or redundant helper paragraphs.
- Show clearly labeled source evidence, lifecycle state, and *human* review state; never imply an official source has already been human-verified.
- Nutrition basis must match the numeric values (e.g. per-serving vs per-100g). Package serving descriptions are separate when the basis differs.
- Missing nutrients display as 「未提供」 and are never silently converted to zero.

## Discovery and search

- The food explorer must index concept files recursively across all of `knowledge/`, not only `knowledge/menu-items/`. New directories such as `knowledge/generic-foods/` must be searchable without UI changes.
- Treat only `index.md` and `log.md` as reserved documents. Do not hard-code an allowlist of brands or food categories.
- The filter options must be derived from the current repository tree; friendly display-name maps may provide translations but must never gate discovery.
- Preserve source-specific nutrient keys, including `dietary_fiber_g` and legacy `fiber_g`, without silently discarding either.
