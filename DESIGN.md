# Electric & Ink Design System

Design tokens, visual hierarchy, and component vocabulary for Cape Town Rental Intelligence.

---

## 1. Palette Tokens

| Token | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `ink` | `#111111` | Primary text, heavy brutalist borders, header bars, card drop shadows |
| `paper` | `#F7F6F2` | Dashboard background, card fills, high-contrast surfaces |
| `blue` | `#2563EB` | Primary brand accent, selected tabs, interactive callouts |
| `yellow` | `#FFE600` | Highlights, active filters, attention badges, Deal Barometer hero |
| `lime` | `#00E599` / `#A3E635` | "Good Value" badges, positive savings, successful statuses |
| `bred` | `#FF5436` | Price increases, negative indicators |
| `bgrey` | `#E5E5E5` | Muted controls, secondary backgrounds |

---

## 2. Visual Emphasis Scale

To avoid competing visual weight and maintain clear hierarchy:

- **Level 1 (Primary Call to Action / Selected Verdict)**:
  - 3px ink border (`border-[3px] border-ink`), hard offset shadow (`shadow-[4px_4px_0_#111111]`), bold uppercase typography.
  - Used for: Primary scrape trigger, active view tab, Good Value badge.
- **Level 2 (Major Content Panels)**:
  - 2px or 3px ink border, subtle or no offset shadow (`shadow-[2px_2px_0_#111111]`).
  - Used for: Search Intent Bar, Data Status Bar, Suburb Comparison table.
- **Level 3 (Standard Controls & Inputs)**:
  - 2px ink border, no offset shadow, clear `:focus-visible` ring.
  - Used for: Suburb pills, bed selector, search input, sort headers.
- **Level 4 (Metadata & Footnotes)**:
  - No frame, muted text (`text-ink/60` or `text-neutral-500`), tabular monospace for numbers.
  - Used for: Sample sizes ($n=38$), crawl timestamps, disclaimers.

---

## 3. Typography & Formats

- **Headings**: Heavy sans-serif, uppercase tracking (`tracking-tight` or `tracking-wider`), tight line-heights.
- **Prices & Numeric Metrics**: Tabular monospace numbers (`font-mono tabular-nums`) with `R` prefix and South African grouping: `R18 500`.
- **Square Metres**: Formatted as `m²` (never `sqm` or `m2`).

---

## 4. Interaction Semantics

- **Keyboard Focus**: Every interactive control possesses a high-contrast focus indicator (`focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none`).
- **Touch Targets**: Minimum 44px height/width on mobile touchpoints.
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` by bypassing animated typing and transitions.
- **Tablist Navigation**: Arrow-key cycling (`ArrowRight`, `ArrowLeft`, `Home`, `End`) across Results Toolbar tabs.
