# TWFoodConsole

Next.js web console for the [TWFoodMCP](https://github.com/NTUT-Vincent/TWFoodMCP) **OKF v0.2** source bundle.

## Features

- Reads the actual \`knowledge/menu-items/\` Markdown files from GitHub. No duplicated database.
- Search by file name, brand, and path; inspect frontmatter, nutrition values, sources, and trust.
- Basic YAML/OKF syntax checks with separate TWFoodMCP domain warnings.
- Authorized human reviewers can propose edit or verification commits **as PRs**. No changes are merged automatically.
- Changing content invalidates prior \`verified\` entries and updates \`generated\` metadata in the proposed revision.
- Verifying does **not** promote a \`draft\` to \`stable\`; publishing remains governed by TWFoodMCP's canonical validator and human-review gate.

## Local development

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000.

Public read-only viewing needs no credentials. For editing / submitting verification PRs, copy \`.env.example\` to \`.env.local\` and configure server-side credentials privately.

| Environment variable | Meaning |
| --- | --- |
| \`GITHUB_TOKEN\` | Fine-grained token scoped to \`NTUT-Vincent/TWFoodMCP\`, with Contents read/write and Pull requests read/write |
| \`CONSOLE_ADMIN_KEY\` | Long random administrator secret (24+ bytes), required by write API |
| \`CONSOLE_REVIEWER\` | Known authorized reviewer's GitHub login, e.g. \`ntut-vincent\` |
| \`OKF_REPO\` | Optional override, defaults to \`NTUT-Vincent/TWFoodMCP\` |

In Vercel configure these via **Project Settings → Environment Variables**. Never use \`NEXT_PUBLIC_\` for write credentials or commit secrets to Git.

This is a single-admin MVP: key possession is the review authorization mechanism. Do not share the admin key. Before a multi-reviewer rollout, replace it with individual identity-linked GitHub OAuth or a GitHub App.

## Source of truth and review boundaries

- The canonical official OKF specification is https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md .
- The TWFoodMCP normative policy is https://github.com/NTUT-Vincent/TWFoodMCP/blob/main/docs/TRUST_AND_CLASSIFICATION_POLICY.md .
- This app performs *basic* validation only; source ingestion, identity resolution, provenance checks, link checks, stale detection, and public release eligibility must pass the TWFoodMCP pipeline before any PR is merged.
- The API works from the GitHub Contents / Git Trees APIs and therefore is subject to GitHub API rate limits and tree size.


## Vercel-hosted MCP (read-only)

The same Next.js deployment serves the human review console and a **stateless Streamable HTTP MCP server** at `/api/mcp`. No Cloudflare, Redis, separate MCP server, or external database is required. GitHub TWFoodMCP is still the sole OKF source of truth.

### Tools

| MCP tool | Purpose |
| --- | --- |
| `search_food` | Keyword/brand search, with `stable` (default) or explicit `preview` channel, and a pagination cursor. |
| `get_food` | Read one OKF concept by its repo-relative `path`, returning nutrition, basis, provenance, quality and verification. |
| `list_brands` | List directory-based brand discovery candidates (counts **do not** imply stable/verified data). |

Example MCP server URL after deployment: `https://<your-vercel-domain>/api/mcp`.

### Run and smoke-test

```bash
npm install
npm run dev
npm run test:mcp -- http://localhost:3000/api/mcp
# Or test the Vercel preview deployment:
npm run test:mcp -- https://<your-preview>.vercel.app/api/mcp
```

MCP v2 uses `mcp-handler@^2`, `@modelcontextprotocol/server@^2` and `zod@^4`, requiring Node.js 20+. Attach the URL as an HTTP/Streamable HTTP remote MCP server in a compatible client. The legacy HTTP+SSE transport is not provided.

The endpoint is **public, read-only**: it never exposes the `/api/review` write workflow or server credentials. Set `GITHUB_TOKEN` only in Vercel's server-side environment for higher GitHub API quotas; no token is sent to MCP clients.

### Data eligibility and limits

- Default `stable` returns only `status: stable`, `access.classification: public`, and records with a `verified` actor present in `config/authorized-reviewers.json`. If the reviewer config is unavailable, reads fail closed.
- Explicit `preview` can additionally return **public drafts**, clearly marked as unreviewed; they are never presented as approved or calculation-ready. Deprecated and non-public records are excluded.
- Missing nutrition values stay unknown, not 0. We perform **no unsupported unit conversions or nutrition calculations** in this initial read-only MCP.
- Search uses a filename/path index, then checks eligibility against each matched OKF file. Large queries scan at most 30 candidates per call; use `next_cursor` to continue. A lack of results is not proof of absent food. Trees and individual file reads are cached for up to 5 minutes.
- Source data may be outdated: all responses retain source links, revision, quality and stale warnings. Public clients should not treat old allergen or nutrition values as medical advice.

The MCP migration does **not** change TWFoodMCP OKF records or their publication policy. The independent TWFoodMCP repository still includes historical Cloudflare-specific documentation/workflows; this Console MCP does not depend on them.
