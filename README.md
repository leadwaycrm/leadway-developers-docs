# Leadway Developers Docs

Mintlify-hosted documentation site at https://developers.leadwaycrm.com.

## Local development

```bash
npm install -g mintlify
mintlify dev
```

Opens at http://localhost:3000.

## Updating the scopes catalog

The 35 scope category pages under `scopes/` are generated from `data/scopes.json`.

```bash
npm run build-pipeline
```

Pipeline:

1. `fetch-ghl-scopes.mjs` — scrape the upstream Leadway API reference, write `data/scopes.raw.json` (gitignored).
2. `build-scopes-data.mjs` — apply terminology cookbook, write `data/scopes.json` (committed).
3. `generate-scope-pages.mjs` — write `scopes/<slug>.mdx` for each non-`manual` entry.

Pages flagged `"manual": true` in `data/scopes.json` are NOT overwritten — hand-tuned content survives regeneration.

## Deploying

Auto-deploys on push to `main` via Mintlify's GitHub integration. PR branches get preview URLs.
