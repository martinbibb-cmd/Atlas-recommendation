# Atlas-recommendation
V2 system recommendation engine

---

## Deployment

This repository is connected to **Cloudflare Pages** via the native GitHub integration.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare Pages builds and deploys `dist` automatically on every push to the connected branch.
**Do not run `wrangler pages deploy` inside the build pipeline** — Cloudflare Pages handles the deploy step itself.

The `npm run deploy` script in `package.json` is kept for ad-hoc manual CLI deploys only and must not be used as the Cloudflare Pages build command.

---

## Cloudflare Pages deployment

This project is deployed to **Cloudflare Pages** (not GitHub Pages).  
`wrangler.jsonc` is the single source of truth for all bindings and local/runtime config.

### Required Cloudflare resources

| Resource | Type | Name in Cloudflare |
|---|---|---|
| D1 database | D1 | `atlasreportsd1` |
| KV namespace | KV | `Atlas-kv` |

### Manual steps — Cloudflare dashboard

> These steps must be performed in the Cloudflare dashboard.  
> They cannot be automated from the repository side.

#### 1. Create the Pages project (first deploy only)

1. Push the repository to GitHub.
2. In Cloudflare: **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select this repository and branch.
4. Set the build command to `npm run build` and the output directory to `dist`.
5. Click **Save and Deploy**.

#### 2. Add the D1 binding

1. **Workers & Pages** → select your Pages project → **Settings** → **Bindings**.
2. Click **Add** → **D1 database**.
3. Set:
   - **Variable name**: `ATLAS_REPORTS_D1`
   - **D1 database**: `atlasreportsd1`
4. Click **Save**.

> **Also update `wrangler.jsonc`:** Set `database_id` under `d1_databases` to the full UUID of
> `atlasreportsd1` (find it in Cloudflare dashboard → D1 → `atlasreportsd1` → Settings, or run
> `wrangler d1 list`). The placeholder `00000000-0000-0000-0000-000000000000` must be replaced
> before the binding will work locally with `wrangler pages dev`.

#### 3. Add the KV binding

1. Still in **Settings** → **Bindings**, click **Add** → **KV namespace**.
2. Set:
   - **Variable name**: `ATLAS_CACHE_KV`
   - **KV namespace**: `Atlas-kv`
3. Click **Save**.

#### 4. Redeploy the Pages project

> **Important:** Cloudflare Pages bindings do **not** take effect until after a redeploy.  
> Adding a binding in the dashboard alone is not enough — you must trigger a new deployment.

1. Go to **Workers & Pages** → your project → **Deployments**.
2. Click **Retry deployment** on the latest deployment, **or** push a new commit to trigger a fresh build.

#### Firebase client variables (Cloudflare Pages)

Set Firebase values in **Settings → Variables and Secrets** for your Pages project.

- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- Optional others used by your Firebase project (`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID`)
- API key can be provided as either `VITE_FIREBASE_API_KEY` or `firebase_api_key`

Notes:
- Firebase web API keys are client-side values and will be visible in the built frontend bundle.
- `VITE_FIREBASE_API_KEY` is the primary key used by the app when present.
- `firebase_api_key` is a compatibility fallback for existing Cloudflare Pages deployments that already use that key name.

#### 5. Apply D1 migrations

After the project is deployed, apply the database schema:

```bash
npm run db:migrate:remote
# or directly:
npx wrangler d1 migrations apply ATLAS_REPORTS_D1 --remote
```

#### 6. Verify bindings and schema

Once deployed, hit these endpoints to confirm everything is wired up:

| Endpoint | What it checks |
|---|---|
| `/api/bindings-check` | Both bindings present + a lightweight ping of each |
| `/api/d1-smoke` | D1: `SELECT 1` query |
| `/api/kv-smoke` | KV: write + read-back a test key |
| `/api/health/runtime` | Whether D1 and KV bindings are present |
| `/api/health/schema` | Whether all required tables exist in D1 |

All three smoke endpoints should return `{ "ok": true, ... }` (or `{ "status": "ok", ... }`) after a successful deploy with bindings configured.

**`/api/health/schema` expected response when migrations are applied:**
```json
{
  "ok": true,
  "requiredTables": ["reports", "visits"],
  "missingTables": [],
  "missingColumns": []
}
```

**`/api/health/schema` response when migration 0004 has not been applied (column missing):**
```json
{
  "ok": false,
  "requiredTables": ["reports", "visits"],
  "missingTables": [],
  "missingColumns": ["visits.visit_reference"]
}
```

**`/api/health/schema` response when migrations are _not_ applied (table missing):**
```json
{
  "ok": false,
  "requiredTables": ["reports", "visits"],
  "missingTables": ["visits"],
  "missingColumns": []
}
```

**If a binding shows `"present": false`**, follow steps 2–4 above again and ensure you redeployed.

---

## Deploying schema changes

**Automated guard:** The `.github/workflows/migrate-on-deploy.yml` workflow runs automatically on
every push to `main`. It applies pending D1 migrations and verifies the schema after each deploy,
so the column is never missing from the live database when new code ships.

> **First-time setup:** Add `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret
> (Settings → Secrets and variables → Actions → New repository secret) so the workflow can
> authenticate with Cloudflare. The token must have **Account / D1 / Edit** permission.
> The Cloudflare account ID is already stored in `wrangler.jsonc` and does not need a separate secret.

Follow this checklist whenever a new migration file is added to `migrations/`:

1. Merge (or push) the code change.
2. The GitHub Actions workflow applies migrations automatically. To apply manually:
   ```bash
   npm run db:migrate:remote
   ```
3. Check `/api/health/schema` — confirm `"ok": true`, `"missingTables": []`, and `"missingColumns": []`.
4. Only then test the new feature end-to-end.

**Migration scripts (from `package.json`):**

| Script | What it does |
|---|---|
| `npm run db:migrate:local` | Apply pending migrations to the local D1 SQLite file |
| `npm run db:migrate:remote` | Apply pending migrations to the remote Cloudflare D1 database |
| `npm run db:list` | List all migrations and their applied status |

> **Rule:** migrations under `migrations/` are the single source of truth for the schema.
> Never make ad-hoc schema changes in application code or directly in the Cloudflare dashboard.

---

### Data model

| Concept | Table | Notes |
|---|---|---|
| Visit / case record | `visits` | Top-level record created when a survey starts |
| Report | `reports` | Child output generated from a completed visit |

A _visit_ is the case record; a _report_ is a generated child output of that visit.

---

---

### Local development

```bash
npm install
npx wrangler pages dev dist --d1=ATLAS_REPORTS_D1 --kv=ATLAS_CACHE_KV
```

Local D1 uses a SQLite file automatically; local KV uses an in-memory store.

---

### Binding names reference

All Functions use these exact names — they must match both `wrangler.jsonc` and the Cloudflare dashboard:

| Binding | Type | Used in |
|---|---|---|
| `ATLAS_REPORTS_D1` | D1Database | `context.env.ATLAS_REPORTS_D1` |
| `ATLAS_CACHE_KV` | KVNamespace | `context.env.ATLAS_CACHE_KV` |
