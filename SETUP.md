# FPI Open Posts — Setup Guide
## Stack: GitHub → Vercel → Vercel Postgres

No n8n. No Google Sheets. No external services.

---

## Repo Structure

```
fpi-open-posts/
├── api/
│   ├── posts.js          ← GET all posts, POST new post
│   └── posts/
│       └── [id].js       ← PUT update, DELETE archive
├── src/
│   ├── App.jsx           ← The full React app
│   └── main.jsx          ← React entry point
├── index.html
├── vite.config.js
└── package.json
```

---

## Step 1 — Create the GitHub Repo

1. Go to **github.com** → sign in as `fpisecurityservices`
2. Click **New Repository**
3. Name: `fpi-open-posts`
4. Visibility: **Public**
5. Click **Create repository**
6. Upload all files matching the structure above

---

## Step 2 — Deploy to Vercel

1. Go to **vercel.com** → Log in with GitHub
2. Click **Add New Project**
3. Import `fpisecurityservices/fpi-open-posts`
4. Framework Preset: **Vite**
5. Click **Deploy**

Your app is now live. It will show a connection error until the database is connected in Step 3.

---

## Step 3 — Create the Vercel Postgres Database

1. In your Vercel project dashboard, click the **Storage** tab
2. Click **Create Database** → choose **Postgres**
3. Name it: `fpi-posts-db`
4. Click **Create**
5. Click **Connect to Project** → select `fpi-open-posts`

Vercel automatically injects all database credentials as environment variables. Nothing to configure manually.

---

## Step 4 — Create the Database Table

1. In the Vercel Storage dashboard, click your new database
2. Click the **Query** tab
3. Paste and run this SQL:

```sql
CREATE TABLE posts (
  id           TEXT PRIMARY KEY,
  client       TEXT NOT NULL,
  location     TEXT,
  type         TEXT,
  priority     TEXT,
  opened_date  TEXT,
  notes        TEXT,
  schedule     TEXT,
  filled_date  TEXT,
  filled_by    TEXT,
  archived     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

## Step 5 — Redeploy Once

After connecting the database, go to your Vercel project →
**Deployments** → three dots on the latest deploy → **Redeploy**.

One-time step. All future deploys pick up the connection automatically.

---

## How Updates Work Going Forward

1. Edit any file on GitHub
2. Commit to `main`
3. Vercel redeploys automatically in ~30 seconds

---

## Local Development (Optional)

```bash
npm i -g vercel     # install Vercel CLI
vercel link         # connect to your Vercel project
vercel dev          # runs app + API locally with live DB credentials
```
