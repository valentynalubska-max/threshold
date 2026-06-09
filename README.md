# Threshold — Deployment Guide
## From zero to QR-ready in ~45 minutes

---

## 1. GitHub (5 min)

1. Go to https://github.com and create a free account
2. Click **New repository** → name it `threshold`
3. Keep it **Public**, click **Create repository**
4. On your machine, open a terminal in the `threshold/` folder:

```bash
git init
git add .
git commit -m "initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/threshold.git
git push -u origin main
```

---

## 2. Vercel (5 min)

1. Go to https://vercel.com → sign up with your GitHub account
2. Click **Add New → Project**
3. Import the `threshold` repo
4. Framework preset: **Other**
5. Click **Deploy** — Vercel builds it automatically

Your site is now live at `https://threshold-xxxx.vercel.app`

---

## 3. Environment Variables (5 min)

In Vercel dashboard → your project → **Settings → Environment Variables**

Add these three:

| Name | Value |
|------|-------|
| `FAL_KEY` | your fal.ai API key |
| `ANTHROPIC_API_KEY` | your Anthropic API key (see step 4) |
| `SUPABASE_URL` | your Supabase project URL (see step 5) |
| `SUPABASE_ANON_KEY` | your Supabase anon key (see step 5) |

After adding variables → **Deployments → Redeploy** (top-right, pick latest deployment)

---

## 4. Anthropic API Key (5 min)

1. Go to https://console.anthropic.com
2. Sign up (free — $5 free credit on new accounts, enough for hundreds of enrichments)
3. **API Keys → Create Key** → copy it
4. Paste into Vercel as `ANTHROPIC_API_KEY`

---

## 5. Supabase — Vote Persistence (10 min)

1. Go to https://supabase.com → create free account
2. **New Project** → name it `threshold` → set a password → Create
3. Wait ~2 min for project to spin up
4. Go to **SQL Editor** → paste and run this:

```sql
create table votes (
  id uuid default gen_random_uuid() primary key,
  triple_id text unique not null,
  triple text,
  source text,
  vote text check (vote in ('TRUE', 'FALSE', 'CONTESTED')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- allow anonymous reads and writes (for the demo)
alter table votes enable row level security;
create policy "public read" on votes for select using (true);
create policy "public upsert" on votes for insert with check (true);
create policy "public update" on votes for update using (true);
```

5. Go to **Project Settings → API**
   - Copy **Project URL** → paste as `SUPABASE_URL` in Vercel
   - Copy **anon public** key → paste as `SUPABASE_ANON_KEY` in Vercel

---

## 6. Custom Domain + QR Code (5 min)

1. In Vercel → **Settings → Domains** → add a custom domain OR use the free `.vercel.app` URL
2. Go to https://qr-code-generator.com (or any QR tool)
3. Paste your Vercel URL → generate → download PNG
4. Print or embed in your presentation

---

## 7. Optional: LoRA weights for image generation

If you want the FLUX LoRA trained on your khata images:
1. Upload your LoRA weights to Hugging Face or fal.ai storage
2. Add `FAL_LORA_URL` environment variable in Vercel with the URL
3. The `api/generate.py` will attach it automatically

Without `FAL_LORA_URL`, it runs standard `fal-ai/flux-lora` with no custom weights.

---

## What works on jury day

| Feature | Status |
|---------|--------|
| Archive browsing (Home, Píč, KB tabs) | ✅ Static — always works |
| Image carousel | ✅ Static |
| Validation voting | ✅ Live — saves to Supabase |
| Vote tallies visible to all visitors | ✅ Live |
| Text enrichment (AI annotations) | ✅ Live — Anthropic API |
| Image generation | ✅ Live — fal.ai |
| PDF extraction / pipeline | 🔜 September build |

---

## Local preview before deploying

```bash
pip install vercel
vercel dev
```

Or just open `index.html` directly in a browser — the static parts work,
API features show "offline" dots and fall back to demo data.
