# Backend Patches — Railway Deployment Guide

All files in this folder go into the Railway fba-backend repo under `backend/modules/`.

---

## Step 1 — Clone / open backend repo

```bash
git clone <your-railway-backend-repo-url>
cd fba-backend
```

---

## Step 2 — Copy patch files

```bash
cp backend-patches/ai_client.py        backend/modules/ai_client.py
cp backend-patches/brand_generator.py  backend/modules/brand_generator.py
cp backend-patches/supplier_analyzer.py backend/modules/supplier_analyzer.py
```

---

## Step 3 — Register new routers in routes.py

Open `backend/routes.py` (or `backend/main.py` — wherever `app.include_router` calls live) and add:

```python
from modules.brand_generator   import router as brand_router
from modules.supplier_analyzer import router as supplier_router

app.include_router(brand_router)
app.include_router(supplier_router, prefix="/api")
```

---

## Step 4 — Commit and push (Railway auto-deploys on push)

```bash
git add backend/modules/ai_client.py \
        backend/modules/brand_generator.py \
        backend/modules/supplier_analyzer.py \
        backend/routes.py
git commit -m "feat: Sonnet logo generation + brand_generator + supplier_analyzer"
git push origin main
```

---

## What each patch does

| File | What changes |
|------|-------------|
| `ai_client.py` | Adds `chat_creative()` using `claude-sonnet-4-6` (6 000 tokens) for SVG generation. Haiku (`chat()`) unchanged for text/JSON. Adds dual cost tracking. |
| `brand_generator.py` | New `/brand/create` + `/brand/label` endpoints. Logo uses Sonnet when `use_premium=true`, Haiku otherwise. Returns `quality_tier` field. |
| `supplier_analyzer.py` | New `/api/supplier/analyze` endpoint for AI-powered supplier scoring. |

---

## Environment variables (already set in Railway — no action needed)

- `ANTHROPIC_API_KEY` — used by ai_client.py
- `AI_MONTHLY_BUDGET_USD` — soft spend cap (default $60)
- `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` — NOT in code, Railway env only

---

## Verify deployment

After Railway redeploys, test:

```bash
curl -X POST https://fba-backend-production-6c44.up.railway.app/api/brand/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $EXPO_PUBLIC_API_KEY" \
  -d '{"product_type":"water bottle","brand_name":"HydroFlow","use_premium":true}'
```

Response should include `"quality_tier": "premium"` and a full `logo_svg` field.
