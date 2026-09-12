# Cape Town Rental Intelligence (CT Rental Intel)

An algorithmic rental intelligence dashboard and decision cockpit for 7 monitored Cape Town residential suburbs: **De Waterkant, Green Point, Sea Point, Gardens, Woodstock, Claremont, and Cape Town CBD**.

Unlike commercial real estate portals optimized for listing agents, CT Rental Intel is engineered for tenants and investors: normalising floor area rates (R/m²), calculating statistical value scores against local benchmarks, tracking price drops across scrape cycles, and offering side-by-side shortlist comparison.

---

## 1. Core Principles & Business Constraints

1. **Strictly On-Demand Scrapes (No Crons)**:
   - Third-party scraper runs (via Apify) are initiated strictly by explicit user request in the UI (`POST /api/scrape`).
   - Background automated cron jobs are intentionally disabled.

2. **48-Hour Cooldown Limit**:
   - Ingestion is rate-limited to at most 1 scrape every 48 hours (2 days) per environment.
   - When cooldown is active, the application serves cached snapshots and indicates the remaining cooldown time.

3. **Data Trust & Explainability**:
   - Sample sizes ($n$) are published alongside all suburb medians.
   - Low sample sizes ($n < 3$) display clear warnings.
   - Value benchmarks distinguish between `Good value` (high/medium confidence), `Potential value` (low confidence), `Typical price`, and `Premium price`.

4. **Electric & Ink Neo-Brutalist Aesthetic**:
   - High-contrast ink borders, cobalt blue (`#2563EB`), electric yellow (`#FFE600`), vibrant lime (`#00E599`), and paper surfaces (`#F7F6F2`).

---

## 2. Architecture & Tech Stack

- **Frontend**:
  - React 19 + Vite 8
  - Tailwind CSS + `@tailwindcss/vite`
  - React Router DOM
  - Recharts (price trends and floor area scatter plots)
  - Leaflet / React Leaflet (spatial price and suburb maps)
  - Vitest + Testing Library
- **Serverless Backend (Vercel API Routes)**:
  - `api/scrape.js`: Initiates on-demand scrapes with 48h cooldown enforcement.
  - `api/launcher.js`: Triggers Apify crawler runs with webhook configuration.
  - `api/ingest.js`: Webhook ingest endpoint with deduplication, atomic suburb tracking, and listing normalisation.
  - `api/listings.js`: Serves active filtered listings with `dataStatus` and suburb `comparables`.
  - `api/history.js`: Serves historical median trends by suburb and bedroom count.
  - `api/analyse.js`: Executive market intelligence via Gemini 2.5 Flash with deterministic fallback.
  - `api/migrate.js`: Idempotent database schema migrations for Postgres.
- **Database**:
  - PostgreSQL (Neon serverless or Supabase) with connection pooling.

---

## 3. Environment Variables

Create a `.env` or `.env.local` file with the following variables:

```env
# PostgreSQL Connection String
DATABASE_URL=postgres://user:password@host/database?sslmode=require

# Apify Actor Crawler Configuration
APIFY_API_TOKEN=your_apify_api_token
APIFY_ACTOR_ID=your_apify_actor_id

# Google Gemini API Key (for AI Market Reports)
GEMINI_API_KEY=your_gemini_api_key

# Webhook Ingestion Secret
WEBHOOK_SECRET=your_secure_webhook_secret

# Optional Carto Maps API Key (falls back to OpenStreetMap)
VITE_CARTO_API_KEY=
```

---

## 4. Local Development

### Prerequisites
- Node.js 20+
- npm 10+

### Installation
```bash
# Navigate to project directory
cd ct-rental-intel

# Install dependencies
npm install
```

### Database Migration
Initialize the database tables and columns:
```bash
# Direct call to migration endpoint (or run via vercel dev)
curl -X POST http://localhost:3000/api/migrate
```

### Running Locally
```bash
# Start Vite development server (frontend only)
npm run dev

# Or run full-stack serverless functions using Vercel CLI:
npx vercel dev
```

---

## 5. Verification & Quality Gates

Run the comprehensive quality check suite before committing any changes:

```bash
# Run all quality checks: lint, domain tests, unit tests, and production build
npm run check

# Run ESLint only
npm run lint

# Run Vitest unit tests only
npm run test:unit

# Run domain normalization test suite only
npm run test:domain

# Build production bundle
npm run build
```

---

## 6. Value Scoring Methodology

The algorithmic value score is calculated as:

$$\text{Value Score} = \frac{\text{Suburb Median Rate (R/m²)}}{\text{Listing Price per m²}}$$

- **Score $\ge 1.20$** with medium/high confidence ($n \ge 8$): **Good value** (at least 15–20% more space per Rand than suburb median).
- **Score $\ge 1.20$** with low confidence ($3 \le n < 8$): **Potential value** (illustrative pending more comparables).
- **Score $0.80 < \text{Score} < 1.20$**: **Typical price** (fair market alignment).
- **Score $\le 0.80$**: **Premium price** (above median per square meter).
- **$n < 3$ comparables**: **Unrated** (insufficient sample size).

Floor area, furnishings, private parking, security, and views can materially affect rents; algorithmic scores serve as initial screening benchmarks.
