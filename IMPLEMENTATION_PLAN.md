# Cape Town Rental Intelligence: UX and Functionality Implementation Plan

## 1. Purpose

This document is the execution plan for improving the Cape Town Rental Intelligence app after the September 2026 product and UX review.

The implementation should move the product from a dense rental-data dashboard to a trustworthy decision workspace that helps a renter answer three questions quickly:

1. Is this data current and credible?
2. Which listings deserve attention?
3. What should I compare or do next?

The implementation must preserve the existing Electric & Ink identity, current React/Vite architecture, Vercel serverless backend, Neon database, Apify ingestion pipeline, Property24 source links, and existing domain behavior unless this plan explicitly changes them.

## 2. Product Direction and Locked Decisions

Read these files before making changes:

- `PRODUCT.md`
- `.impeccable/critique/2026-09-12T12-35-13Z__src.md`
- `CLAUDE.md`
- `ct-rental-intel-build-instructions.md` in the parent directory, while treating `CLAUDE.md` and current source as authoritative where they differ

The following decisions are already made. Do not reopen them unless implementation evidence proves one is infeasible.

### 2.1 Product model

- Treat the app as an on-demand market-intelligence service with user-requested snapshots.
- No automated cron or scheduled background scraping; data updates occur strictly on user request.
- Limit scrape execution to a maximum of once every 2 days (48-hour cooldown) to protect Apify costs and server resources.
- Manual refresh is an intentional user action with a clear cost/expectation disclosure.
- The dashboard defaults to helping a user find one promising listing quickly.
- Charts, maps, suburb comparison, and AI analysis remain available as deeper analysis tools.
- A value recommendation is not trustworthy unless the UI exposes recency, sample size, comparable evidence, and confidence.

### 2.2 Visual direction

- Register: product UI.
- Color strategy: restrained across the dashboard, committed in signature moments.
- Preserve paper, ink, cobalt blue, yellow, lime, and red semantic roles.
- Preserve the dotted paper texture on the landing page and selected dashboard framing.
- Reserve thick outlines and offset shadows for primary actions, selected views, important verdicts, and major containers.
- Flatten tertiary controls, metadata, help, and repeated content.
- Use one familiar sans-serif UI family. Do not add a display font.
- Avoid gradients, glass effects, colored side stripes, decorative motion, and repeated identical card grids.

### 2.3 Physical scene

A renter checks the app on a phone during a commute or on a laptop after work, often under time pressure and with incomplete attention. The default remains a high-contrast light theme, with the existing dark theme retained and brought to parity.

### 2.4 Quality bar

- Production-ready implementation across the landing page and complete dashboard flow.
- WCAG 2.1 AA minimum.
- Keyboard-complete core workflow.
- Responsive from 320px through large desktop.
- No silent failures that appear as legitimate market data.
- No new feature may depend on an account system.
- Preserve useful URL-based filter sharing and local-first shortlist behavior.

## 3. Desired User Journey

### 3.1 Landing page

1. User understands that the app identifies unusually good rental value in selected Cape Town suburbs.
2. User sees whether the market data is live, cached, estimated, or unavailable.
3. User tests a suburb, bedroom count, and budget in the Rent Barometer.
4. User enters the dashboard with those choices already applied.

### 3.2 Dashboard

1. User sees data freshness and coverage before interpreting any score.
2. User chooses suburb, budget, and bedrooms through a compact search-intent control.
3. Results appear in a scan-friendly default view ranked by decision usefulness.
4. User can understand why a listing is labelled good value.
5. User opens details, shortlists candidates, and compares shortlisted options.
6. User can move into map, charts, suburb comparison, or AI analysis without losing the active search context.

### 3.3 Empty and failure journey

1. The app distinguishes first run, no matching results, stale data, partial scrape, and service failure.
2. Each state explains what happened and offers one clear recovery action.
3. The UI never presents baseline estimates as live observations.

## 4. Target Architecture

### 4.1 New frontend modules

Create these modules unless an equivalent abstraction already exists during implementation:

- `src/hooks/useRentalData.js`
  - Own listing and history requests, refresh polling, abort behavior, and normalized request state.
- `src/utils/dataStatus.js`
  - Pure functions for deriving `live`, `cached`, `partial`, `baseline`, `empty`, and `unavailable` presentation states.
- `src/utils/confidence.js`
  - Pure functions for sample-size and comparable-data confidence.
- `src/utils/storage.js`
  - Versioned parsing and writing for shortlist notes and saved searches.
- `src/components/DataStatusBar.jsx`
  - Visible source, freshness, coverage, and confidence summary.
- `src/components/FirstRunState.jsx`
  - Guided first-run and refresh explanation.
- `src/components/SearchIntentBar.jsx`
  - Primary suburb, budget, bedroom, and submit/reset controls.
- `src/components/ResultsToolbar.jsx`
  - Result count, active view, sort summary, export, and secondary-filter entry.
- `src/components/ValueExplanation.jsx`
  - Reusable accessible explanation of score, benchmark, sample size, and confidence.
- `src/components/ShortlistWorkspace.jsx`
  - Comparison, notes, remove, export, and direct listing actions.
- `src/components/SavedSearches.jsx`
  - Local saved searches with restore, rename, and delete behavior.
- `src/components/StatusMessage.jsx`
  - Shared live region for success, warning, and error feedback.
- `src/components/AppIcon.jsx` or a small icon module
  - Consistent inline SVG icons replacing platform-dependent emoji.

### 4.2 Existing frontend modules to change

- `src/App.jsx`
- `src/AppRoutes.jsx`
- `src/components/Landing.jsx`
- `src/components/FilterBar.jsx`
- `src/components/ListingsTable.jsx`
- `src/components/ListingDrawer.jsx`
- `src/components/ValueBadge.jsx`
- `src/components/MapView.jsx`
- `src/components/PriceChart.jsx`
- `src/components/SuburbComparison.jsx`
- `src/components/AIPanel.jsx`
- `src/index.css`
- `tailwind.config.js`

`FilterBar.jsx` may be decomposed or replaced by `SearchIntentBar`, `SecondaryFilters`, and active-filter chips. Remove it only after all existing filter behavior has migrated.

### 4.3 Backend modules to change

- `api/listings.js`
- `api/history.js`
- `api/scrape.js`
- `api/ingest.js`
- `api/launcher.js`
- `api/analyse.js`
- `api/verdict.js`
- `api/migrate.js`

Consider adding:

- `api/status.js` only if the enriched `api/listings.js` response becomes too expensive or conceptually overloaded.
- `api/scrape-event.js` if failed, timed-out, or aborted Apify events cannot be handled cleanly by `api/ingest.js`.

Prefer enriching `api/listings.js` first so initial dashboard rendering needs one fewer request.

## 5. Shared Data Contracts

Define and document one response contract before changing UI components.

### 5.1 Listings response

Extend `GET /api/listings` to return:

```json
{
  "listings": [],
  "medians": {},
  "totalCount": 0,
  "dataStatus": {
    "state": "live",
    "source": "Property24 via Apify",
    "scrapeId": 123,
    "startedAt": "ISO timestamp",
    "completedAt": "ISO timestamp or null",
    "lastSuccessfulScrapeAt": "ISO timestamp or null",
    "ageHours": 2.5,
    "expectedSuburbs": 7,
    "completedSuburbs": 7,
    "failedSuburbs": [],
    "listingCount": 284,
    "isRefreshing": false
  },
  "comparables": {
    "Sea Point": {
      "sampleSize": 34,
      "medianPrice": 22000,
      "medianPpm2": 295,
      "confidence": "high"
    }
  }
}
```

Valid `dataStatus.state` values:

- `live`: latest successful data is inside the freshness target and all expected suburbs completed.
- `cached`: last successful data exists but is older than the freshness target.
- `partial`: a scrape completed for only some suburbs or is still ingesting.
- `empty`: a successful completed scrape produced no usable listings.
- `unavailable`: the service request failed and no credible data can be shown.
- `baseline`: frontend-only fallback estimates used for demonstration on the landing page.

Do not infer `empty` from a failed network request. Do not infer `live` solely from the existence of listings.

### 5.2 Scrape persistence

Add idempotent columns to `scrapes` through `api/migrate.js`:

- `status TEXT NOT NULL DEFAULT 'pending'`
- `completed_suburbs TEXT[] DEFAULT '{}'`
- `failed_suburbs TEXT[] DEFAULT '{}'`
- `completed_at TIMESTAMPTZ`
- `error_summary TEXT`

Allowed persisted status values:

- `pending`
- `running`
- `partial`
- `succeeded`
- `failed`

Keep migration statements individually executable and safe to rerun.

### 5.3 Confidence model

Start with a deterministic, documented sample-size model:

- `high`: at least 20 usable R/m² comparables in the same suburb.
- `medium`: 8 to 19 comparables.
- `low`: 3 to 7 comparables.
- `insufficient`: fewer than 3 comparables.

Rules:

- Do not label a listing Good Value from an `insufficient` benchmark.
- For `low` confidence, show `Potential value` rather than `Good value`.
- Every benchmark explanation must include the sample size.
- Keep thresholds in `src/utils/confidence.js` and a matching backend utility or shared dependency-free module. Do not duplicate unnamed constants across components.
- Add tests before changing labels.

### 5.4 Local storage model

Replace raw shortlist arrays with a versioned object:

```json
{
  "version": 2,
  "items": {
    "listing-url": {
      "addedAt": "ISO timestamp",
      "note": "Near work, check parking",
      "snapshot": {
        "price": 18000,
        "suburb": "Gardens",
        "address": "..."
      }
    }
  },
  "savedSearches": []
}
```

Add a backward-compatible migration from the current array of URLs. Corrupt storage must fall back safely without crashing the app.

## 6. Implementation Phases

Execute phases in order. Each phase has its own completion gate. Do not start a later feature phase while an earlier phase has failing tests or unresolved P1 regressions.

## Phase 0: Establish a Clean Baseline

### Goal

Make the current repository reliable enough that later regressions are visible.

### Tasks

1. Create a working branch before edits.
2. Record current screenshots at 1440×900, 1024×768, 768×1024, 390×844, and 320×568 for `/` and `/dashboard`.
3. Run and record:
   - `npm run build`
   - `npm run lint`
   - `node test/test_suite.cjs`
4. Fix the five existing lint failures without changing behavior:
   - Unused `jsonErr` in `api/analyse.js`.
   - Empty catch block in `src/App.jsx`.
   - Move `DEFAULT_FILTERS` out of `FilterBar.jsx` to avoid the Fast Refresh export warning.
   - Remove unused `useDeferredValue` in `ListingsTable.jsx`.
   - Replace page-reset state synchronization with event-driven page resets or derived/clamped pagination.
5. Add scripts:
   - `test:unit`
   - `test:ui`
   - `test:e2e`
   - `check` that runs lint, unit tests, and build.
6. Add Vitest and React Testing Library for component and utility tests.
7. Add Playwright tests for the primary user journeys. Keep the existing CommonJS domain suite until its coverage is migrated intentionally.
8. Add a full-stack local command. Recommended scripts:
   - `dev:web`: Vite-only frontend for isolated UI work.
   - `dev`: full Vercel development server with frontend and `/api` routes on one origin.
9. Document required environment variables and local startup steps in `README.md` without exposing values.

### Completion gate

- `npm run check` passes.
- The full local command serves both UI and API routes.
- A failed local API connection displays an explicit unavailable state, not a plausible zero-data dashboard.

## Phase 1: Data Status, Scrape Lifecycle, and Trust

### Goal

Make data provenance and freshness impossible to misunderstand.

### Backend tasks

1. Add scrape lifecycle columns in `api/migrate.js`.
2. Update `api/scrape.js` to create a `running` scrape session and return a stable status payload.
3. Update `api/launcher.js` so supported terminal run events can update success and failure state. Verify current Apify terminal-event names before implementation.
4. Update `api/ingest.js` so completion is atomic:
   - Append a suburb once to `completed_suburbs`.
   - Remove it from pending work.
   - Mark the scrape `succeeded` when all seven suburbs complete.
   - Mark it `partial` when terminal failures exist alongside successful suburbs.
   - Set `completed_at` when no work remains.
   - Prevent duplicate webhook delivery from double-counting listings or suburb completion.
5. Add terminal failure handling that records the suburb and a safe error summary without leaking secrets.
6. Enrich `api/listings.js` with `dataStatus` and `comparables`.
7. Return the last successful dataset while a new scrape is running. Do not replace credible cached data with a partial new session unless the UI labels the mixed state clearly.
8. Add API tests for no scrape, running scrape, complete scrape, stale scrape, partial scrape, failed scrape, and duplicate webhook delivery.

### Frontend tasks

1. Move request logic from `App.jsx` and `Landing.jsx` into `useRentalData.js` or equivalent hooks.
2. Model `idle`, `loading`, `success`, `refreshing`, `empty`, and `error` explicitly.
3. Use `AbortController` on route change and component unmount.
4. Build `DataStatusBar` with:
   - State label.
   - Human-readable last update.
   - Completed suburb coverage.
   - Listing count.
   - Source/methodology help.
5. Add an accessible live status region for scrape start, progress changes, completion, partial completion, and failure.
6. Remove silent catches that fall through to baseline or zero states.
7. Label landing fallback figures `Baseline estimate` and explain they are illustrative when live data is unavailable.

### Copy requirements

- First run: `No market snapshot yet`.
- Running: `Updating 4 of 7 suburbs. You can keep using the previous snapshot.`
- Cached: `Last complete snapshot: 11 Sep, 05:14. Cooldown active (available every 2 days).`
- Partial: `5 of 7 suburbs updated. Sea Point and Claremont are temporarily unavailable.`
- Failure: name the failed operation and give a recovery action.

### Completion gate

- No data number is shown without an explicit status source.
- The interface distinguishes all six presentation states.
- Refresh progress survives route/view changes.
- Duplicate webhooks do not corrupt totals.

## Phase 2: First-Run Experience and Refresh Safety

### Goal

Turn the most damaging trust break into a guided, recoverable flow.

### Tasks

1. Replace the empty dashboard shell with `FirstRunState` when there has never been a successful scrape.
2. Explain:
   - Data source.
   - Seven-suburb scope.
   - Approximate completion time.
   - 2-day (48-hour) refresh cooldown.
   - That the action starts paid third-party work.
3. Rename the action from `Refresh` to a precise label based on state:
   - First run: `Create market snapshot`.
   - Existing data: `Update market snapshot`.
4. Add a lightweight confirmation only when the action will start a billable scrape. Do not confirm when the cooldown endpoint returns a non-billable skip.
5. During refresh, keep previous results interactive and show progress in `DataStatusBar`.
6. When the 48-hour cooldown blocks the action, show the remaining cooldown time and keep existing data visible.
7. When a scrape is partial, provide `Retry missing suburbs` only if the backend can perform that action safely and idempotently. Otherwise explain that an update can be run after the 2-day cooldown.
8. Do not show zero KPIs, an empty table, disabled AI, and empty charts simultaneously during first run.

### Completion gate

- A first-time user can explain what the primary action will do before invoking it.
- A scrape never blocks navigation or replaces usable cached data with a blank screen.
- Every refresh outcome has visible, actionable feedback.

## Phase 3: Dashboard Information Architecture and Visual Hierarchy

### Goal

Make the default dashboard immediately useful and reduce visual competition.

### Tasks

1. Refactor the dashboard into this order:
   - Compact brand/header row.
   - `DataStatusBar`.
   - `SearchIntentBar`.
   - Active-filter summary.
   - Results header with result count, sort, view switch, and secondary actions.
   - Results content.
2. Primary search controls:
   - Suburb selector.
   - Maximum monthly rent.
   - Minimum bedrooms.
   - `Find rentals` or immediate-result behavior with a clearly announced update.
3. Move furnishing, availability, good value, price drop, and saved-only controls into a `More filters` disclosure.
4. Replace the eight visible suburb buttons with a compact multi-select or searchable popover on narrow widths. Keep selected suburbs visible as removable chips.
5. Choose one price input model. Recommended: formatted numeric input plus a slider or presets inside a popover, not five presets and a slider simultaneously.
6. Move Table, Map, Charts, Suburbs, AI, and Shortlist into a results-level view selector.
7. Sync the selected view to `?view=` so browser navigation and shared URLs restore it.
8. Keep the default view as `table` on desktop and a listing-card view on narrow screens.
9. Replace the five opening KPI cards with three stable metrics:
   - Matching listings.
   - Potential/good-value matches.
   - Median monthly rent or median R/m², whichever is more meaningful for the active search.
10. Never change a KPI's label or meaning based on shortlist state.
11. Show Best Value Suburb inside suburb comparison, not as a global KPI unless confidence is medium or high.
12. Establish a visual emphasis scale:
   - Level 1: primary CTA or selected verdict, thick border and shadow allowed.
   - Level 2: major panel, strong border with little or no shadow.
   - Level 3: standard control, 1px or 2px border and no offset shadow.
   - Level 4: metadata/help, no frame unless interactive.
13. Replace arbitrary z-index values with named Tailwind tokens for dropdown, sticky, backdrop, modal, toast, and tooltip.

### Completion gate

- The first viewport contains no more than four primary decisions.
- The user can reach meaningful results without processing the analytical views.
- Low-priority controls no longer resemble primary actions.
- View and filter state restore correctly from the URL.

## Phase 4: Accessibility and Interaction Semantics

### Goal

Make the complete primary workflow usable with keyboard, screen reader, touch, zoom, and reduced motion.

### Tasks

1. Build one visible `:focus-visible` treatment and apply it to every interactive control.
2. Ensure frequent touch controls are at least 44px high where layout permits. Never rely on targets smaller than WCAG minimums.
3. Convert exclusive selectors such as bedrooms and furnishing to radio groups or correct `aria-pressed` buttons.
4. Give the More Filters control `aria-expanded` and `aria-controls`.
5. Implement the tab/view selector according to the ARIA tabs pattern:
   - Arrow-key navigation.
   - Home and End support.
   - `aria-controls` and `aria-labelledby`.
   - One tab stop within the tab list.
   - Proper tab panels.
6. Do not make an entire `<tr>` the only listing-detail trigger. Add a labelled focusable action in the first meaningful cell or convert the row's primary content to a link/button while preserving valid table semantics.
7. Rebuild `ListingDrawer` with native `<dialog>` or an equivalently robust focus-managed dialog:
   - Initial focus on the heading or close button.
   - Focus containment.
   - Escape close.
   - Backdrop click close.
   - Restore focus to the invoking listing.
   - Lock background scrolling.
8. Replace hover-only `title` explanations with accessible popovers or inline disclosure.
9. Give status updates correct `aria-live` behavior without announcing every animated character.
10. Remove the AI typewriter effect for screen readers and reduced-motion users. Prefer rendering complete text with a short state transition.
11. Ensure charts have text summaries and accessible data tables or lists.
12. Ensure map functionality has a non-map equivalent listing view.
13. Do not convey value, price drop, availability, or market direction through color alone.
14. Raise all normal text contrast to at least 4.5:1. Eliminate low-opacity 10px metadata that fails contrast.
15. Test at 200% zoom and Windows high-contrast/forced-colors mode where available.
16. Correct heading hierarchy on both routes.
17. Add automated `jest-axe` coverage for key states and manual keyboard test scripts.

### Completion gate

- The landing-to-filter-to-listing-to-shortlist journey works without a pointer.
- No serious automated accessibility violations remain.
- Focus never disappears behind the drawer or returns to the document root.
- Meaning remains understandable without color.

## Phase 5: Explainable Value and Decision Evidence

### Goal

Make every Good Value recommendation understandable and appropriately cautious.

### Tasks

1. Centralize value classifications and confidence rules.
2. Update `ValueBadge` to support:
   - `Good value` for high/medium confidence.
   - `Potential value` for low confidence.
   - `Typical price` for fair listings where showing a neutral badge helps scanning.
   - `Premium price` instead of the accusatory `Expensive` where the data cannot explain quality differences.
   - No verdict for insufficient comparables.
3. Build `ValueExplanation` and use it in the listing drawer, table help, map popup, AI output, and landing methodology.
4. Explain the formula in plain language before showing the numeric ratio.
5. Show:
   - Listing R/m².
   - Suburb median R/m².
   - Difference in percent.
   - Number of comparable listings.
   - Snapshot date.
   - Confidence label.
6. Add a short limitation: floor area, condition, views, parking, lease terms, and furnishing can materially affect rent.
7. Label approximate map coordinates as suburb-level positions. Do not visually imply precise property locations when `geocode_precise` is false.
8. Remove or substantiate claims such as `100% Unbiased`, `every single unit`, and exact percentage claims generated by fallback AI templates.
9. Ensure the heuristic AI fallback never invents market percentages or furnishing premiums that are not derived from supplied data.
10. Add unit tests for classification thresholds, missing size, small samples, stale data, and rounding.

### Completion gate

- A user can explain why a listing received its label without leaving the listing drawer.
- Insufficient data never produces a high-confidence verdict.
- AI and deterministic UI use the same underlying evidence and terminology.

## Phase 6: Shortlist Comparison and Saved Searches

### Goal

Carry the user from discovery into an actual rental decision.

### Tasks

1. Migrate shortlist storage to the versioned model in Section 5.4.
2. Add a stable Shortlist view to the results view selector.
3. Let users compare two to four listings side by side.
4. Comparison rows should include:
   - Monthly rent.
   - Deposit or fees when available.
   - Bedrooms and bathrooms.
   - Size and R/m².
   - Furnishing.
   - Availability.
   - Price history.
   - Distance/location precision where credible.
   - Value confidence.
   - Agency.
5. Highlight differences with text and weight, not color alone.
6. Allow private local notes per listing.
7. Add `Copy comparison summary` and CSV export. Do not promise a public share link without server-side persistence.
8. Add saved searches:
   - Save current filter set.
   - Name or auto-name it.
   - Restore it.
   - Rename it.
   - Delete it with an undo toast.
9. Compute `new since saved search` and price-drop indicators locally from the current dataset and stored timestamps.
10. Preserve shortlist and notes through page refresh and storage migration.

### Completion gate

- A user can shortlist, compare, annotate, and export options without opening a spreadsheet.
- Corrupt or legacy storage is handled safely.
- Deleting a saved search is recoverable within the current session.

## Phase 7: Landing Page Editing and Visual Restraint

### Goal

Keep the memorable identity while making the page shorter, more credible, and more grounded in Cape Town rentals.

### Tasks

1. Keep the hero and Rent Barometer as the two strongest visual moments.
2. Add `DataStatusBar` or a compact status treatment near the first live claim.
3. Change the hero copy so it does not promise live data when the current state is baseline or unavailable.
4. Label fallback and showcase numbers as estimates or examples.
5. Remove repeated section badges where headings provide enough structure.
6. Replace the seven identical suburb cards with one of:
   - A compact Cape Town coverage map plus a linked neighborhood list.
   - A ranked neighborhood table with region, median, sample size, and freshness.
7. Use one authentic property or Cape Town visual. Prefer a verified project-owned or properly licensed asset. Do not use generic luxury-property stock imagery.
8. Compress or combine the scoring explanation, portal comparison, platform tour, and how-it-works content so the page does not repeat the same value proposition four times.
9. Keep no more than one feature-tour interaction. Label all sample listings as examples.
10. Replace emoji icons with a consistent SVG icon system.
11. Use South African English consistently, including `neighbours` where appropriate.
12. Remove the colored side-stripe callout in `AIPanel.jsx` and use a full border, tint, or leading icon.

### Completion gate

- The landing page reaches the final CTA sooner without losing the barometer or methodology.
- Every live claim reflects actual data state.
- Supporting sections no longer repeat an identical card-and-shadow formula.

## Phase 8: Analytical Views and AI Hardening

### Goal

Make deeper analysis useful, honest, and context-preserving.

### Charts

1. Add sample size to chart tooltips and headings.
2. Visually distinguish insufficient or partial series.
3. Add plain-text summaries beneath each chart.
4. Do not render an empty chart shell when the whole dataset is unavailable. Show one consolidated recovery state.
5. Keep active filters visible in the chart header.
6. Validate color palettes for color-vision deficiencies.

### Map

1. Clearly separate `Suburb overview` from approximate listing pins.
2. Label jittered centroid positions as approximate.
3. Do not imply a precise address position unless `geocode_precise` is true.
4. When no data exists, do not initialize interactive map controls behind the empty overlay if they cannot be used.
5. When filters produce no map results, offer `Clear map filters` or `View all listings`.
6. Keep a synchronized accessible result list beside or below the map on larger screens.

### Suburb comparison

1. Replace seven empty cards with one consolidated empty state.
2. Show sample size and confidence for every median.
3. Do not label a two-listing median Best Value without a warning.
4. Offer drill-down into a suburb with the current bedroom and budget context retained.

### AI analysis

1. Treat AI analysis as interpretation, not evidence.
2. Feed the model summarized, validated statistics rather than up to 150 raw listing objects where practical.
3. Include the snapshot timestamp and data confidence in the prompt and response UI.
4. Clearly label heuristic fallback output as `Automated summary` rather than implying it came from Gemini.
5. Remove invented claims from `generateFallbackAnalysis`, including fixed percentage advantages or furnishing premiums that are not calculated from input.
6. Validate structured AI output before rendering it.
7. Give retry guidance for rate limits, timeouts, and service errors.
8. Cache analysis by data snapshot ID and filter signature, not only component memory.
9. Remove decorative typewriter playback or make instant rendering the default.

### Completion gate

- No analytical surface overstates precision.
- Empty analytical states are consolidated and actionable.
- AI output can be traced to the same visible dataset and snapshot as the dashboard.

## Phase 9: Responsive Layout, Performance, and Theme Parity

### Goal

Make the product fast and comfortable on phones, tablets, and laptops.

### Responsive tasks

1. Test at the target viewports from Phase 0 after every major layout phase.
2. On narrow screens:
   - Use listing cards instead of forcing the 11-column table as the primary view.
   - Keep the table available as an optional horizontally scrollable advanced view.
   - Place shortlist and results actions within easy thumb reach.
   - Use a bottom sheet or full-screen dialog for filters rather than a dense wrapping toolbar.
   - Preserve filter context when the sheet closes.
3. Ensure no heading, badge, agency name, or price causes horizontal page overflow.
4. Make range controls and date inputs comfortably touchable.
5. Respect safe-area insets for fixed mobile UI.

### Performance tasks

1. Keep route-level lazy loading for Recharts and Leaflet.
2. Consider splitting chart types further because the current PriceChart chunk is the largest lazy chunk.
3. Do not initialize Leaflet until the map view is selected and has data worth displaying.
4. Debounce text search only if profiling shows meaningful work; prefer `useDeferredValue` when implemented correctly for large result sets.
5. Virtualize or incrementally render only when realistic listing counts demonstrate a need.
6. Reserve image space and use lazy loading for listing images.
7. Add image fallbacks without layout shift.
8. Measure landing and dashboard bundles before and after changes.
9. Verify `prefers-reduced-motion` for all new transitions.

### Theme tasks

1. Replace broad selectors such as all dark-mode borders with semantic component or token rules.
2. Define semantic colors for surface, elevated surface, text, muted text, border, focus, success, warning, error, and selected state.
3. Verify every state in both themes, especially charts, map popups, disabled buttons, focus rings, and low-emphasis text.

### Completion gate

- No horizontal page overflow at 320px.
- Core mobile actions have comfortable targets and do not require table scrolling.
- Dark mode communicates the same hierarchy and state as light mode.
- Performance does not regress materially from the Phase 0 baseline.

## Phase 10: Documentation, Verification, and Release

### Goal

Ship the complete flow with repeatable evidence.

### Documentation

1. Rewrite `README.md` to explain:
   - Product purpose.
   - Architecture.
   - Environment variables.
   - Full local startup.
   - Database migration.
   - Test commands.
   - Scrape lifecycle.
   - Cost and cooldown behavior.
2. Create `DESIGN.md` after the UI refactor stabilizes, capturing real tokens and component vocabulary.
3. Add a short methodology page or in-app disclosure covering source, calculation, confidence, limitations, and update cadence.

### Automated verification

1. `npm run lint`
2. `npm run test:unit`
3. `node test/test_suite.cjs`
4. `npm run build`
5. `npm run test:e2e`
6. Automated accessibility checks on:
   - Landing live and baseline states.
   - Dashboard first run.
   - Dashboard populated results.
   - Filtered-empty results.
   - Listing drawer.
   - Shortlist comparison.
   - API unavailable state.

### Manual end-to-end stories

1. Landing barometer to prefiltered dashboard.
2. First scrape initiation, progress, completion, and cooldown.
3. Cached data while refresh runs.
4. Partial scrape with failed suburbs.
5. Search, filter, sort, and reset.
6. Open listing, read value evidence, shortlist, close drawer, and verify focus restoration.
7. Compare shortlisted listings and add notes.
8. Save, restore, rename, and delete a saved search.
9. Navigate between table, cards, map, charts, suburbs, AI, and shortlist without losing context.
10. Repeat the core journey using keyboard only.
11. Repeat at 200% zoom.
12. Repeat at 390×844 with simulated slow network.
13. Verify external Property24 links open safely in a new tab.

### Production checks

1. Run migrations in a non-production environment first.
2. Verify required Vercel environment variables by name and scope without printing values.
3. Verify manual user-requested scrape behavior and 2-day (48-hour) cooldown against Apify cost controls (no scheduled/cron scrapes).
4. Confirm security headers remain intact.
5. Confirm no secrets appear in client bundles, logs, URLs, or user-facing errors.
6. Deploy a preview and complete all critical end-to-end stories.
7. Compare new screenshots to the Phase 0 baseline for intentional visual changes.
8. Re-run the Impeccable critique and accessibility audit.

### Release gate

- No P0 or P1 usability defects remain.
- Lint, tests, build, accessibility checks, and primary E2E flows pass.
- Production data states have been verified with real success, partial, cooldown, and failure responses.
- The user can identify a listing, understand its evidence, shortlist it, and compare it without ambiguity.

## 7. Testing Matrix

| Area | Unit | Component | E2E | Manual |
|---|---|---|---|---|
| Data status derivation | Required | Required | Required | Required |
| Scrape lifecycle | Required | N/A | Required | Required |
| Confidence and value labels | Required | Required | Required | Required |
| URL filter/view persistence | Required | Required | Required | Required |
| Filter interactions | Required | Required | Required | Required |
| Listing drawer focus | Limited | Required | Required | Required |
| Storage migration | Required | Required | Required | Required |
| Shortlist comparison | Required | Required | Required | Required |
| Charts/map summaries | Required | Required | Required | Required |
| AI fallback claims | Required | Required | Required | Required |
| Mobile layout | N/A | Limited | Required | Required |
| Dark mode and contrast | N/A | Automated a11y | Limited | Required |

## 8. Recommended Pull Request Breakdown

Keep reviewable changes separate. Do not implement the entire plan in one pull request.

1. **PR 1: Baseline quality and local development**
   - Lint fixes, test harness, README startup, full-stack dev command.
2. **PR 2: Scrape lifecycle and data-status API**
   - Migration, backend status, webhook idempotency, tests.
3. **PR 3: Frontend data-state architecture and first run**
   - Hooks, `DataStatusBar`, first-run state, refresh flow.
4. **PR 4: Dashboard information architecture**
   - Search intent, secondary filters, stable KPIs, URL-backed views.
5. **PR 5: Accessibility foundations**
   - Focus system, filters, tabs, drawer, table actions, announcements.
6. **PR 6: Explainable value and methodology**
   - Confidence, comparable evidence, badge language, claims cleanup.
7. **PR 7: Shortlist comparison and saved searches**
   - Storage migration, comparison, notes, export, saved-search undo.
8. **PR 8: Landing-page restraint and content edit**
   - Data labels, shorter structure, coverage redesign, icon consistency.
9. **PR 9: Map, charts, suburb comparison, and AI hardening**
   - Precision labels, accessible summaries, honest fallbacks.
10. **PR 10: Responsive, performance, theme parity, and release QA**
    - Mobile cards/filter sheet, lazy behavior, token cleanup, final E2E.

Each pull request must include:

- Scope summary.
- Before/after screenshots where UI changes.
- Tests added or changed.
- Accessibility notes.
- Data migration and rollback notes where applicable.
- Confirmation that unrelated user changes were preserved.

## 9. Definition of Done

The overall initiative is complete only when all statements below are true:

- Users can always tell whether displayed figures are live, cached, partial, baseline estimates, empty, or unavailable.
- The dashboard's first viewport focuses on finding rentals rather than presenting every analytical control.
- Good Value claims show recency, sample size, comparables, and confidence.
- The complete core workflow is keyboard-usable and screen-reader understandable.
- Mobile users get a purpose-built result and filtering experience.
- Shortlisting leads to comparison, notes, and export.
- Saved searches restore the user's criteria and identify new or changed matches.
- Map, charts, suburb comparison, and AI analysis do not overstate precision.
- Electric & Ink remains recognizable while tertiary interface elements become quieter.
- Local development, linting, testing, build, and full-stack verification are documented and repeatable.

## 10. Agent Start Instructions

An implementation agent should begin as follows:

1. Read the four context files listed in Section 2.
2. Inspect `git status` and preserve unrelated changes.
3. Start at Phase 0 unless the repository already satisfies its completion gate.
4. Work on one pull-request unit from Section 8 at a time.
5. Before editing, state the current phase, intended files, and acceptance criteria.
6. Use existing palette and interaction conventions where they remain fit for purpose.
7. Add or update tests in the same change as behavior.
8. Verify the full affected user story in a browser before declaring a phase complete.
9. Stop at any database, external-cost, or destructive change that is not already authorized by this plan and request confirmation.
10. Do not mark the initiative complete until the Definition of Done is satisfied.
