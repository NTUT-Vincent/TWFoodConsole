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
