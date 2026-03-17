# Atlas-recommendation
V2 system recommendation engine

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

#### 5. Apply D1 migrations

After the project is deployed, apply the database schema:

```bash
npx wrangler d1 migrations apply atlasreportsd1 --remote
```

#### 6. Verify bindings

Once deployed, hit these endpoints to confirm everything is wired up:

| Endpoint | What it checks |
|---|---|
| `/api/bindings-check` | Both bindings present + a lightweight ping of each |
| `/api/d1-smoke` | D1: `SELECT 1` query |
| `/api/kv-smoke` | KV: write + read-back a test key |

All three should return `{ "ok": true, ... }` (or `{ "status": "ok", ... }`) after a successful deploy with bindings configured.

**Example successful response from `/api/bindings-check`:**
```json
{
  "ok": true,
  "bindings": {
    "ATLAS_REPORTS_D1": { "present": true, "ping": "ok" },
    "ATLAS_CACHE_KV":   { "present": true, "ping": "ok" }
  }
}
```

**If a binding shows `"present": false`**, follow steps 2–4 above again and ensure you redeployed.

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
