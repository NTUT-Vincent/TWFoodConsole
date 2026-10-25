# TWFoodConsole Agent Instructions

- The canonical OKF bundle is \`NTUT-Vincent/TWFoodMCP/knowledge/\`.
- Before changing parsing, validation, writing or review behavior, read official \`GoogleCloudPlatform/open-knowledge-format\` README.md and SPEC.md, plus TWFoodMCP/AGENTS.md, docs/MVP_SPEC.md, docs/TRUST_AND_CLASSIFICATION_POLICY.md, and docs/OKF_CONFORMANCE.md.
- Never conflate \`status\`, \`verified\`, source authority, \`quality\`, \`stale_after\`, and \`access\`.
- Never fabricate \`human:*\` verification. A logged-in human reviewer must explicitly confirm exact evidence. This prototype gates review writes behind a server-only admin secret.
- Drafts stay draft after a verification event; do not bypass review / promotion / Cloudflare publishing gates.
- All writes go to a new GitHub branch and PR. GitHub is the source of truth.
- GitHub credentials must remain server-side. Never create a publicly accessible write endpoint without authorization.
- Missing nutrition values are unknown, not zero.
