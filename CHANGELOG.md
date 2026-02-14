# Changelog

## 2026-02-13 — Dashboard bento-grid layout redesign

### What changed

Replaced the old uniform-card dashboard layout with a bento-grid layout matching the wireframe mockup. Uses explicit CSS grid placement (12-col x 6-row) with variable card sizes. All content fits above the fold on desktop.

### Layout (wireframe-matched)

```
R1:  [TRIPS 2x2] [Days 2x1][Dist 2x1][Since 2x1] [LONGEST TRIP 4x2]
R2:  [TRIPS    ] [--- TRAVELED MONTHS line chart 6x2 ---] [          ]
R3:  [MOST VISITED 2x3] [--- chart cont ---] [FURTHEST DEST 4x2   ]
R4:  [                 ] [                  ] [                     ]
R5:  [                 ] [Freq 2x2][Avg 4x2] [TOP COMPANIONS 4x2  ]
R6:  [Country][Continent] [       ][       ] [                     ]
```

### Card inventory (13 cards)

**General (R1-2):** Trips (2x2), Total Travel Days (2x1), Total Distance (2x1), Days Since Last Trip (2x1, NEW), Longest Trip (4x2, with x% del año)

**Geography (R3-6 left+center):** Traveled Months line chart (6x2), Furthest Destination (4x2, with Nx vuelta al mundo), Most Visited Destinations list (2x3, top 5), Top Country (1x1), Top Continent (1x1), Travel Frequency (2x2), Avg Trip Length (4x2)

**Company (R5-6 right):** Top Companions (4x2, up to 3 people with avatars + days together)

### New data computations
- `daysSinceLast` — days between today and most recent trip end date
- `tripsPerMonth` — travel frequency (trips / active month span)
- `topCompanions` — top 3 companions with shared trip count and total days together

### Removed from previous version
- Streak, Revisited Places, New Destinations count, Partners count, Group Size, Motivo bar chart, Season cards, Solo/Group split

### Files modified
- `js/app.js` — Rewrote `DashboardView` component
- `css/styles.css` — Rewrote `.bento-*` grid with explicit placement
- `CHANGELOG.md`

## 2026-02-13 — Code structure refactor

### What changed

Refactored the monolithic `index.html` (1,604 lines) into three separate files:

- **`index.html`** (35 lines) — HTML structure only, loads external CSS/JS
- **`css/styles.css`** (194 lines) — All styling extracted from the inline `<style>` block
- **`js/app.js`** (1,387 lines) — All JavaScript/JSX extracted from the inline `<script>` block

### Why

The single-file architecture made the codebase hard to navigate and maintain. Separating concerns into HTML/CSS/JS files allows:
- Independent caching of CSS and JS by the browser
- Easier code navigation and editing
- Standard project structure

### How the JS loading works

The app uses Babel standalone to transform JSX in the browser. The external `js/app.js` is loaded via `<script type="text/babel" src="js/app.js">`, which Babel fetches via XHR and compiles on the fly.

**Important:** This requires an HTTP server. Opening `index.html` directly from the file system (`file://` protocol) will not work because browsers block XHR from `file://` origins. A `file://` detection fallback shows instructions to run `npx serve`.

### Breaking change for local development

Previously, the single-file `index.html` could be opened directly by double-clicking the file. After this refactor, a local server is required:
```bash
npx serve
```
Production deployment (Vercel) is unaffected.

### What did NOT change

- Zero visual or behavioral changes
- All sections work identically: map, timeline, dashboard, data entry, wrapped, settings
- All features preserved: CSV import, JSON backup/restore, trip CRUD, geocoding, profile management
- localStorage data format unchanged — existing user data is fully compatible
- Same external dependencies (React 18, Leaflet, Babel standalone, Google Fonts)

### Files added
- `css/styles.css`
- `js/app.js`
- `CHANGELOG.md`

### Files modified
- `index.html` (reduced from 1,604 to 35 lines)