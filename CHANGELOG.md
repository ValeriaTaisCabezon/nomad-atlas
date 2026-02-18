# Changelog

## 2026-02-18 — Place autocomplete + structured location data (Nominatim)

### What changed

Replaced the free-text comma-entry destinations input with a full place autocomplete powered by the Nominatim/OpenStreetMap API. Each destination now stores rich structured location data instead of just a plain string.

### New destination data structure

```js
{
  lugar:        "Paris",            // backward-compat primary key
  display_name: "Paris, Île-de-France, France",
  city:         "Paris",
  state:        "Île-de-France",
  country:      "France",
  country_code: "FR",
  lat:          48.8566,
  lng:          2.3522,
  place_id:     "123456",
  coordinates:  { lat: 48.8566, lng: 2.3522 },  // kept for map compat
  fechaInicio:  "...",
  fechaFinal:   "...",
  foto:         null,
}
```

Old trips with string-only destinations remain fully backward compatible.

### Nominatim API integration

- Endpoint: `https://nominatim.openstreetmap.org/search?format=json&q=...&limit=5&addressdetails=1`
- `User-Agent: nomad-atlas-app/1.0` header on all requests (required by ToS)
- **Rate limiting:** `_nominatimThrottle()` ensures ≥ 1100ms between calls (serial queue using `geocodeQueue.lastCall`)
- **400ms debounce** on keystroke input before firing a search
- **LRU-ish cache:** `_nominatimCache` (Map, max 60 entries) stores results per query — repeat searches never hit the API
- Graceful degradation: network error → "Sin conexión" message, no results → "No se encontraron resultados" + free-text fallback
- Free-text fallback: pressing Enter or clicking "Agregar igualmente" adds an ungeocoded destination (coordinates null)

### New `PlaceSearchInput` component

- Search input with 400ms debounce + loading spinner
- Dropdown with flag emoji + "City, State" primary + "Country" secondary
- Flag emojis computed from `country_code` via Unicode regional indicator trick
- Selected destinations shown as removable chips: `🇫🇷 Paris · France ×`
- Outside-click closes dropdown
- Escape closes dropdown
- Enter selects first result (or adds free text)
- Duplicate prevention by `place_id` or `display_name`

### Form changes (`AddTripForm`)

- **Removed:** comma-separated quick-entry text field + `destinationsText` state
- **Added:** `PlaceSearchInput` as the primary destination entry method
- Saved destinations from previous trips shown as quick-add chips (with flag + country)
- `DestinoCard` edit mode: location section removed from edit form (place set via autocomplete); shows locked "place header" badge with city + flag
- `DestinoCard` view mode: shows city, state, country separately with cleaner layout
- `buildDestinos()` helper removed (no longer needed)

### Display updates

| Location | Before | After |
|---|---|---|
| Carousel destinations | `lugar.split(',')[0]` | `d.city \|\| d.lugar` |
| Carousel expanded dests | `d.lugar` | `"City, Country"` |
| Trip detail modal cards | `d.lugar` only | City + `State, Country` on separate line |
| `formatDestinations()` | `lugar.split(',')[0]` | `d.city \|\| d.lugar` |
| Dashboard Most Visited | `d.lugar` | `"City, Country"` |
| Dashboard Top Country | string-parse fallback | real `d.country` field |
| Dashboard Top Continent | `d.continente` (unused) | mapped from `country_code` via `CONTINENT_MAP` |
| Dashboard bento-topcountry | name only | name + "X países · Y ciudades" + country list |

### Continent mapping

Added `CONTINENT_MAP` object (ISO 3166-1 alpha-2 → continent name in Spanish) covering 195 countries. Maps `country_code` to América / Europa / Asia / África / Oceanía.

### Dashboard geography improvements

- `uniqueCountriesCount` — count of distinct countries across all destinations
- `uniqueCitiesCount` — count of distinct cities across all destinations
- Top Country card now shows: country name + "X países · Y ciudades" + comma-list of up to 6 countries visited
- Top Continent computed from `country_code` (was broken — field never populated)

### `tripToDb()` improvements

- `countries_visited` now counts by `d.country` (falling back to string parse)
- `cities_visited` now counts unique cities by `d.city` (falling back to `d.lugar`)
- Trip name generation prefers `d.city` over full `d.lugar`

### CSV export

New columns added (backward compatible — old importers see extra columns, not broken):
`lugar, city, state, country, country_code, lat, lng, place_id`

`lugar` column now exports the city name (not the full comma string) for readability.

### CSV import

- Reads new columns: `city`, `state`, `country`, `country_code`, `lat`, `lng`, `place_id`
- If `lat`/`lng` are present, skips geocoding for that destination (fast re-import)
- `geocodeTrips()` now populates full structured fields (`city`, `state`, `country`, `country_code`, `place_id`, `display_name`) not just `coordinates`

### New CSS (styles.css)

`.place-search-wrapper`, `.place-chips`, `.place-chip`, `.place-chip__flag/name/country/remove`, `.place-search-input-row`, `.place-search-input`, `.place-search-spinner`, `.place-dropdown`, `.place-dropdown__item/flag/text/primary/secondary/msg/error/freetext`, `.destino-card-place-set/name/flag`, mobile breakpoints at 600px.

### Files modified

- `js/app.js`
- `css/styles.css`
- `CHANGELOG.md`

---

## 2026-02-18 — Trip name as primary identifier; destinations as subtitle

### What changed

Restructured the trip data model so users give each trip a **custom name** (e.g. "Summer Beach Trip") and destinations become secondary metadata shown as a subtitle.

### Data model

- `trip_name` field is now the primary identifier for every trip
- `destinations` (the `destinos` array) stores per-place data with optional dates and photos as before
- `dbToTrip` now reads `trip_name` from Supabase rows
- `tripToDb` writes the explicit `trip_name` from the form (falls back to joined destinations only when blank)
- New helpers `getTripName(trip)` and `formatDestinations(destinos)` centralise display logic

### Form changes (`AddTripForm`)

- **"Nombre del viaje \*"** — new required text input, shown prominently at the top of the form (larger label, `1.05rem` font)
- **"Destinos"** — new comma-separated quick-entry field below the name (`"París, Londres, Roma"` → three DestinoCard stubs created automatically)
- Quick-entry and DestinoCards are kept in sync: editing a card updates the text field; removing a card removes it from the text field; clicking a saved-destination chip appends to the text field
- Form now validates that `trip_name` is non-empty before submitting

### Display changes

| Location | Before | After |
|---|---|---|
| Carousel collapsed card | destinations as title | `trip_name` as title + destinations as subtitle below |
| Carousel expanded card | destinations as title | `trip_name` as title + destinations as subtitle |
| Trip detail modal | destinations as `<h2>` | `trip_name` as `<h2>` + destinations in muted line below |
| Timeline mini card | destinations joined | `trip_name` + destinations subtitle |
| Map popup | destinations joined | `trip_name` bold + destinations muted |
| TripCard (list) | destinations as `<h3>` | `trip_name` as `<h3>` + destinations muted |
| Dashboard longest trip | destinations joined | `trip_name` |

### Migration (one-time, automatic)

- On first load after this update, any trip with a null/empty `trip_name` in Supabase is back-filled
- Generated name = destinations joined with ` → ` (e.g. `"Bariloche → San Martín → Pampa Linda"`)
- Migration flag stored in `localStorage` as `nomadAtlas_tripname_migrated_<userId>`; runs once per user then never again
- Console logs each updated trip: `[Migration] Trip <id>: trip_name set to "..."`

### CSV changes

- **Export header:** `tripName` added as first column → `tripName,tripId,tripFechaInicio,...`
- **Import:** reads `tripName` / `trip_name` / `nombre` column if present; backwards compatible (old CSVs without the column still import cleanly, with `trip_name` left blank and back-filled from destinations)
- Import preview table now shows a "Nombre" column

### New CSS rules (`styles.css`)

- `.carousel-card__subtitle` — destinations subtitle on collapsed card (white, 0.72rem, 65% opacity, single line clamp)
- `.carousel-exp__subtitle` — destinations subtitle in expanded panel (muted, 0.78rem, single line clamp)

### Files modified

- `js/app.js` — `getTripName`, `formatDestinations` helpers; `dbToTrip`/`tripToDb`; `AddTripForm` state + render; migration block; all display locations; CSV export/import
- `css/styles.css` — `.carousel-card__subtitle`, `.carousel-exp__subtitle`
- `CHANGELOG.md`

---

## 2026-02-18 — Supabase auth setup (no data migration)

### What changed

Integrated Supabase authentication so the app requires a logged-in user. localStorage data is untouched — this session only adds auth plumbing, not data migration.

### New files

- **`js/supabase.js`** — Supabase JS v2 client initialised with project URL + anon key; exported as `window.supabase`.
- **`login.html`** — Standalone login/signup page. Email + password auth via Supabase. Toggle between login and signup modes. Friendly Spanish error messages. Matches app color palette and is mobile-responsive. On successful login, redirects to `index.html`.

### Modified files

**`index.html`**
- Added CDN `<script>` for `@supabase/supabase-js@2`
- Added `<script src="js/supabase.js">` (loads before `app.js`)

**`js/app.js`**
- New `authUser` state in `App`
- Auth guard `useEffect`: calls `supabase.auth.getSession()` on mount; redirects to `login.html` if no session. Subscribes to `onAuthStateChange` to catch logouts and token expiry. Cleans up subscription on unmount.
- `handleLogout()`: calls `supabase.auth.signOut()`; the auth state listener handles the redirect.
- Auth bar rendered in the folder nav: shows logged-in user's email + "Salir" button.

**`css/styles.css`**
- `.auth-bar`, `.auth-bar__email`, `.auth-bar__logout` — pill-style user info bar in the nav header. Responsive: email truncated on tablet, hidden on small phone.

### Auth flow

```
Open index.html → auth guard → not logged in → redirect to login.html
login.html → sign up / log in → redirect to index.html
index.html header → "Salir" button → supabase.signOut() → redirect to login.html
```

### What did NOT change

- All trips functionality is identical
- localStorage data format unchanged
- No data migration (next session)

---

## 2026-02-17 — Carousel: expanded card fits viewport (v2 — preserve collapsed size)

### Fix

Reverted the previous attempt that changed collapsed card height. Instead, only the expanded card's internal proportions were adjusted so its content fits within `calc(100% - 2rem)` of track height without scrolling.

**Changes:**
- Collapsed card height restored to `340px` (original, user-approved size)
- Photo hero in expanded state reduced from `48%` → `36%` — gives the info panel much more room
- Info panel height updated from `52%` → `64%` to match
- Panel padding reduced from `1rem 1.4rem 1.1rem` → `0.65rem 1.4rem 0.75rem`
- Panel gap reduced from `0.55rem` → `0.4rem`
- Stats row padding reduced from `0.5rem 0.7rem` → `0.35rem 0.7rem`

### Files modified
- `css/styles.css`
- `CHANGELOG.md`

---

## 2026-02-17 — Carousel: expanded card fits viewport without scrolling

### Fix

The expanded card overflowed the screen vertically, requiring the user to scroll to see the info panel.

**Root cause:** Card height was `min(80vh, 680px)` measured from the card element itself, but the card sat inside a track with `padding: 3rem 0`, which in turn sat inside `.carousel-root` with `padding: 2rem 0 3rem` — both adding to the total height before it even left the content area.

**Solution:** The track is now the single source of truth for vertical sizing:
- `.carousel-track` has `height: calc(100vh - 120px)` (viewport minus navbar + content header), `align-items: center` (vertically centres all cards), `overflow-y: hidden` (hard clip so nothing can bleed out).
- Collapsed cards: `height: 72%` (relative to track height) — always fits with room to breathe above/below.
- Expanded card: `height: calc(100% - 2rem)` (nearly full track height, 1rem margin each side) — guaranteed to fit without any scroll.
- `.carousel-root` padding removed (no longer needed).

### Files modified
- `css/styles.css` — `.carousel-root` padding removed; `.carousel-track` gets explicit `height`, `align-items: center`, `overflow-y: hidden`; `.carousel-card` height changed to `72%`; `.carousel-card--expanded` height changed to `calc(100% - 2rem)`; responsive breakpoints updated
- `CHANGELOG.md`

---

## 2026-02-17 — Carousel: edge cards can now always reach centre

### Fix

First and last cards could not scroll to the track centre, making them impossible to expand.

**Root cause:** The track had fixed horizontal padding (`4rem` each side), which was never enough for the first/last card to reach the midpoint — especially on wide screens.

**Solution:** Two invisible `div.carousel-spacer` elements placed before the first card and after the last card inside the flex row. Each spacer is `calc(50vw - 120px)` wide (half the viewport minus half a collapsed card), which guarantees any card can be scrolled to the exact horizontal centre regardless of screen width. The fixed horizontal padding on `.carousel-track` was removed and replaced by these spacers.

### Files modified
- `js/app.js` — two `h('div', {className: 'carousel-spacer'})` added around the `sortedTrips.map(...)` output
- `css/styles.css` — `.carousel-spacer` rule added; `.carousel-track` horizontal padding removed
- `CHANGELOG.md`

---

## 2026-02-17 — Carousel: in-track expansion + click-outside collapse

### What changed

1. **Expanded card lives inside the flex row** — removed `position:fixed` popup approach. The card now grows via CSS `width`/`height` transitions while staying a real flex item, pushing adjacent cards to the sides. The card self-centres in the track 60 ms after expansion via a `scrollTo` call.

2. **Click outside to collapse** — `onClick` handler on `.carousel-track` calls `collapse()`. Card and panel use `e.stopPropagation()` so clicks inside the expanded card do not trigger this. Arrow buttons also stop propagation.

3. **Photo hero transitions** — `carousel-card__bg-photo` now transitions its `height` (full card → 48%) as the card expands, instead of being torn out into a separate element.

### Files modified
- `js/app.js` — `TripsCarousel`: removed fixed-card IIFE, content now rendered directly inside each card element; `handleTrackClick` added; `useEffect` re-centres after expansion
- `css/styles.css` — `.carousel-card--expanded` uses `width`/`height` only (no `position:fixed`); `.carousel-card__bg-photo` uses `height` transition; removed `.carousel-expanded-card` and all related rules
- `CHANGELOG.md`

---

## 2026-02-17 — Carousel interaction fixes (4 bugs)

### Fixes

1. **Click-to-center then click-to-expand** — First click on an off-centre card now only scrolls it to the viewport centre (ring highlight appears). Second click (card already centred) expands it. Expanded card can only be closed via the × button or Escape. Logic uses `centeredId` + `isCentered()` tolerance check (32 px).

2. **Removed background overlay** — Dim overlay behind expanded card removed completely (both render and CSS). Expanded card now floats above the carousel with its own box-shadow only.

3. **Expanded card: fixed-position, no scroll** — Expanded card is now `position: fixed; top:50%; left:50%; transform:translate(-50%,-50%)` (lifted fully out of the track flow). Panel height is exactly 52% with `overflow:hidden`; all sections (`stats`, `dests`, `notes`, `actions`) use `flex-shrink` to fit without any internal scroll. Notes truncate to 2 lines, destination labels truncate with `text-overflow:ellipsis`.

4. **Mouse wheel → horizontal scroll** — Added a `wheel` event listener on the track (`passive:false`) that maps vertical `deltaY` to `scrollLeft`. Horizontal trackpad swipes (where `|deltaX| > |deltaY|`) pass through unmodified.

### Files modified
- `js/app.js` — `TripsCarousel` rewrite (centeredId state, isCentered helper, wheel listener, fixed expanded card outside track)
- `css/styles.css` — removed `.carousel-overlay`, added `.carousel-expanded-card` (fixed + animated), updated `.carousel-card__expanded-panel` (no overflow), `.carousel-card--centered` (ring highlight)
- `CHANGELOG.md`

---

## 2026-02-17 — Trips section: horizontal 3D carousel with expand/collapse

### What changed

Replaced the flat grid (`TripsListView`) with a new `TripsCarousel` component.
Cards now display in a horizontal scrollable row with a perspective 3D tilt effect.
Clicking a card expands it in-place to reveal full trip details.

### SVG icon system

Added a reusable `Icon` component (pure SVG, no emoji) with the following icons:
`placer · negocios · evento · familia · estudio · otro` (motivo icons)
`clock · pin · globe · plane · users · edit · trash · chevronL · chevronR · close · calendar · empty`

Added helpers `getMotivoIcon(motivo)` and `getMotivoLabel(motivo)`.
`getMotivoEmoji` is kept for legacy callers (Timeline, Dashboard).

### Carousel — collapsed card (portrait, 240 × 340 px)
- Full-bleed photo or motivo gradient background
- Frosted-glass pill tag top-left (SVG icon + motivo label)
- Gradient scrim → trip name + date pinned at bottom
- 3D `rotateY` tilt updated live on scroll via scroll listener
- `scroll-snap-type: x mandatory` for native snap behaviour
- Arrow buttons (left / right) scroll by one card width

### Carousel — expanded card (~85 vw × 82 vh)
- Card grows in place; `z-index` elevates above a full-screen dim overlay
- **Top 52%:** hero photo (or gradient)
- **Bottom 52%:** white panel slides up with:
  - Trip name (Exo 2, bold)
  - Date range with calendar icon
  - Stats row: days · locations · countries · motivo type · companions
    (dividers between stats, à la cards-inspo-1)
  - Destination list (when > 1 stop)
  - Notes (italic, if present)
  - Edit + Delete pill buttons
- Close × button (top-right of panel); Escape key also collapses
- Body scroll locked while a card is expanded

### Gradient fallbacks per motivo
`placer` blue-teal · `negocios` charcoal · `evento` terracotta · `familia` sage · `estudio` blue-gray · `otro` sand

### Responsive
- Mobile (≤ 768px): cards 200 × 300 px, arrows hidden (swipe only)
- Small phone (≤ 480px): cards 180 × 270 px, expanded 95 vw × 88 vh

### Files modified
- `js/app.js` — `Icon` component, `getMotivoIcon`, `getMotivoLabel`, `MOTIVO_GRADIENTS`, `TripsCarousel` (new), `TripsListView` (thin wrapper)
- `css/styles.css` — full carousel block (`.carousel-root`, `.carousel-track`, `.carousel-card`, `.carousel-card--expanded`, expanded panel, stat row, arrow buttons, responsive breakpoints)
- `CHANGELOG.md`

---

## 2026-02-17 — Fix: border wraps content box, tab overlap works

### What changed

Moved the border from `.folder-nav-inner` (flat line across the nav) to `.main-content-bg` (full `border: 1.5px solid` on all sides with `border-radius: 16px`). The content box now looks like an outlined rounded page. Active tabs overlap the content box's top border via `bottom: -1.5px` + `z-index`, creating the seamless "tab opens into page" illusion. Added `margin-top: -1.5px` on content box so its top edge aligns precisely with the tab bottoms.

### Files modified

- `css/styles.css` — `.folder-nav-inner` removed `border-bottom`; `.main-content-bg` added `border`, `margin-top: -1.5px`, `position: relative; z-index: 0`
- `CHANGELOG.md`

---

## 2026-02-17 — Folder-tab polish: header padding, contained border, uniform tab color

### What changed

1. **Header top padding** — increased `padding-top` from `1.25rem` → `1.75rem` for more breathing room above the tabs
2. **Border wraps content box** — moved `border-bottom` from `.folder-nav` (full viewport) to `.folder-nav-inner` (max-width 1400px), so the line only spans the content area. Cream background visible on sides.
3. **Content box fully rounded** — `border-radius` changed from `0 0 16px 16px` → `16px` (all corners)
4. **Uniform active tab color** — all four tabs now share `#F5E6D8` (slightly more saturated than `#FBF0E8`) when active, instead of per-section colors. Content area backgrounds remain section-specific (blue, green, violet, orange).

### Files modified

- `css/styles.css` — `:root` tab variables, `.folder-nav`/`.folder-nav-inner` border move + padding, `.main-content-bg` border-radius
- `js/app.js` — Tab inline styles switched from `--bg-*` back to `--tab-*`
- `CHANGELOG.md`

---

## 2026-02-17 — Folder-tab refinements: contained box, color updates, padding

### What changed

Visual polish pass on the folder-tab navigation:

1. **More navbar top padding** — `padding-top` from `0.75rem` → `1.25rem` for breathing room
2. **Content area is now a contained box** — `max-width: 1400px`, centered, with `border-radius: 0 0 16px 16px` and subtle box-shadow. Cream (`--light`) background is visible on the sides, making the content look like a physical page inside a folder.
3. **Tab color = content background** — Active tabs now use the light page tint (not the saturated accent), so the tab seamlessly merges into the content area as one continuous surface.
4. **Color palette update:**
   - Trips: warm yellow → **light blue** (`#E8F0FA`)
   - Timeline: sage green → **light violet** (`#F0ECF5`)
   - Map: green unchanged (`#EFF5F3`)
   - Dashboard: orange unchanged (`#FBF0E8`)

### Files modified

- `css/styles.css` — Updated `:root` variables, `.folder-nav-inner` padding, `.main-content-bg` containment
- `js/app.js` — Tab inline styles changed from `--tab-*` to `--bg-*`
- `CHANGELOG.md`

---

## 2026-02-17 — Menu redesign: folder-tab navigation

### What changed

Replaced the dark teal sticky header with a folder-tab navigation system inspired by physical manila folder dividers. Each tab visually merges into its section's content area below.

### Navigation structure

- **Top-left:** "Nomad Atlas" logo placeholder (text, ready for future logo image)
- **Top-right:** 4 folder tabs in order: **Trips | Map | Timeline | Dashboard**
- **Bottom-left (fixed):** Settings gear button (SVG icon, circular)
- **Bottom-right (fixed):** Year selector dropdown (pill button with chevron)

### Tab behavior

Active tab takes the section's theme color and seamlessly connects to the content area below (no bottom border, overlaps the nav's border line). Inactive tabs appear in muted cream.

| Tab | Active Color | Content Background |
|---|---|---|
| Trips | `#E8C468` (golden yellow) | `#FBF4E0` (light warm yellow) |
| Map | `#89ACA4` (teal sage) | `#EFF5F3` (light teal wash) |
| Timeline | `#B7C4A1` (sage green) | `#F2F5ED` (light sage wash) |
| Dashboard | `#D4956A` (burnt orange) | `#FBF0E8` (light warm peach) |

### Removed from navigation

- **Wrapped tab:** hidden (component remains in codebase for future use)
- **Settings tab:** moved to fixed bottom-left gear button
- **Year selector bar:** replaced by bottom-right dropdown
- **All emoji labels** in nav tabs (per design brief: no emojis)

### New CSS variables

`--tab-trips`, `--tab-map`, `--tab-timeline`, `--tab-dashboard`, `--bg-trips`, `--bg-map`, `--bg-timeline`, `--bg-dashboard`, `--bg-settings`

### Responsive breakpoints

- **Desktop:** Logo left, tabs right in single row
- **Tablet (1024px):** Slightly smaller tabs
- **Mobile (768px):** Nav stacks vertically, tabs horizontally scrollable

### Files modified

- `css/styles.css` — New folder-tab classes, settings button, year dropdown, section color variables, responsive rules; old header/nav-tab hidden
- `js/app.js` — Rewrote App render (folder nav, settings button, year dropdown, dynamic content backgrounds), removed wrapped from nav, changed default tab to trips
- `CHANGELOG.md`

---

## 2026-02-17 — Dashboard reorganization: 10×6 grid, Exo 2 font, new card

### What changed

Reorganized the entire bento grid to a 10-column × 6-row layout based on a user-provided color-block diagram. Added a new "Avg km/trip" metric card. Switched number font to Exo 2 Bold.

### Typography

- **Numbers / headings:** Exo 2 Bold 700 (was Space Grotesk 700) — geometric, bold, modern
- **Labels / body:** Outfit stays unchanged

### New card

- **Avg km/trip** (`.bento-avgkm`) — violet `#A89ABD` background, computes `totalKm / totalTrips`

### Layout changes (desktop — 10-col × 6-row)

| Card | Before | After | Change |
|---|---|---|---|
| Trips | 2×1 | 2×2 | Bigger, value-xl |
| Travel Days | 2×1 | 2×2 | Bigger, value-xl |
| Distance | 2×1 | 2×2 | Bigger, value-xl |
| Frequency | 2×1 | 2×2 | Bigger, value-xl |
| Days Since | 4×2 | 2×1 | Smaller, value-lg |
| Most Visited | 2×2 | 2×2 | Same |
| Longest | 4×1 | 3×2 | Taller, column layout |
| Monthly Chart | 4×2 | 5×2 | Wider |
| Top Country | 2×1 | 2×2 | Bigger |
| Furthest | 4×2 | 3×2 | Narrower |
| Avg Trip | 2×1 | 2×1 | Same |
| Avg km/trip | — | 2×1 | NEW |
| Companions | 4×1 | 3×2 | Taller, column layout |
| Top Continent | 2×1 | 2×1 | Same |

### Responsive breakpoints

- **Tablet (1024px):** 8-col × 7-row grid
- **Mobile (768px):** 4-col × 12-row grid
- **Small phone (480px):** 2-col × 15-row (all full-width stacked)

### Files modified

- `index.html` — Google Fonts import (Exo 2)
- `css/styles.css` — Grid, placements, card overrides, text selectors, 3 breakpoints
- `js/app.js` — avgKmPerTrip computation, new card, value class changes

---

## 2026-02-16 — Dashboard density & typography refinement

### What changed

Compacted the bento grid layout from 6 rows to 5 rows, swapped fonts, and mixed card sizes for a more dynamic visual rhythm.

### Typography

- **Numbers / headings:** Space Grotesk 700 (was DM Sans 800) — geometric, bold, Grotesk-family
- **Labels / body:** Outfit 300-500 (was Inter 400-600) — clean, slightly rounded, Neue Montreal alternative
- Replaced all font references across the entire CSS

### Layout changes (desktop)

**From 6-row to 5-row grid** (`minmax(80px, 1fr)` → `minmax(70px, auto)`, gap `10px` → `8px`):

| Card | Before | After | Change |
|---|---|---|---|
| Travel Days | 2x2 | 2x1 | Shrunk — only number+label |
| Distance | 2x2 | 2x1 | Shrunk |
| Days Since | 2x2 | 2x1 | Shrunk |
| Most Visited | 2x3 | 2x2 | Shrunk — tighter list gaps |
| Furthest | 4x2 | 6x1 | Wider but shorter, horizontal layout |
| Frequency | 2x2 | 2x1 | Shrunk |
| Avg Trip | 4x2 | 2x1 | Shrunk — was massively oversized |
| Trips | 2x2 | 2x2 | Kept (hero stat) |
| Longest | 4x2 | 4x2 | Kept (sub-details) |
| Monthly Chart | 6x2 | 6x2 | Kept (chart) |
| Companions | 4x2 | 4x2 | Kept (people list) |

New grid:
```
R1  : [TRIPS 2x2] [Days 2x1] [Since 2x1] [Dist 2x1] [LONGEST 4x2]
R2  : [TRIPS cnt] [──────── Furthest 6x1 ──────────] [LONGEST cnt ]
R3-4: [MOSTVIS 2x2] [── MONTHLY 6x2 ─────────────] [COMP 4x2   ]
R5  : [Cnt][Cont] [Freq 2x1] [Avg 2x1]
```

### Padding & sizing

- Card padding: `1.25rem` → `0.75rem 1rem`
- `.bento-value-lg`: `2.2rem` → `2.8rem` (bigger numbers in compact cards)
- `.bento-sub`: `0.75rem` → `0.85rem` (bigger text on rich-content cards)
- `.bento-label` margin-top: `0.35rem` → `0.15rem`
- Companions list gap/margin tightened

### Responsive breakpoints

- Tablet (1024px): reduced from 7 to 5 rows
- Mobile (768px): reduced from 10 to 9 rows, tighter gaps
- Small phone (480px): tighter padding and gaps, proportional

### What did NOT change

- Card colors and accent backgrounds preserved
- All functionality unchanged
- No new cards or removed cards

### Files modified

- `index.html` — Google Fonts import (Space Grotesk + Outfit)
- `css/styles.css` — Grid layout, typography, padding, all breakpoints
- `CHANGELOG.md`

## 2026-02-15 — Color palette and typography overhaul

### What changed

Applied a warm, earthy color system and modern typography across the entire app. Layout and card structure remain untouched — this is a purely visual (color + type) update.

### Color palette

- **Page background:** `#F5EDE3` (warm cream)
- **Card surfaces:** `#FEFCF9` (soft warm white, used for non-dashboard cards/modals)
- **Text primary:** `#2C2C2C` (near-black for dominant numbers)
- **Text secondary:** `#6B6259` (warm gray for labels)
- **Text muted:** `#9A9088` (lighter warm gray for sub-details)

### Bento card accent colors (each section has its own background)

| Card | Color | Hex |
|---|---|---|
| Trips | Warm mustard | `#E8C468` |
| Travel Days | Dusty sage | `#B7C4A1` |
| Distance | Soft terracotta | `#D4956A` |
| Days Since | Muted teal | `#89ACA4` |
| Longest Trip | Warm peach | `#E8C9AB` |
| Monthly Chart | Warm white | `#FEFCF9` |
| Furthest Dest | Dusty rose | `#C9A09A` |
| Most Visited | Olive | `#8B9A6D` |
| Top Country | Warm sand | `#D9C4A0` |
| Top Continent | Slate sage | `#7D9590` |
| Frequency | Faded clay | `#C4A882` |
| Avg Trip | Soft blue-gray | `#A3B1B8` |
| Companions | Warm linen | `#DDD0C0` |

### Typography

- **Numbers / headings:** DM Sans (800 weight) — modern, geometric, slightly rounded
- **Labels / body:** Inter (400-600) — clean, legible secondary face
- Replaced Playfair Display (serif) and Work Sans throughout
- Numbers are large + bold as the dominant visual element; labels are small, uppercase, tracked

### Other visual changes

- Removed 2px solid borders from all cards (bento, metric, trip list, timeline, modals)
- Softened box-shadows across all components
- Updated header gradient to warmer teal (`#3D6B5E` to `#2A5448`)
- Updated year-chip active state to terracotta
- Updated chart line/dot colors to match palette
- Applied warm white (`#FEFCF9`) to all card/panel surfaces

### What did NOT change

- Zero layout changes — bento grid placement, card sizes, responsive breakpoints all preserved
- Zero functionality changes — all interactions, data, CRUD operations unchanged
- No illustrations added

### Files modified

- `index.html` — Updated Google Fonts import (DM Sans + Inter, removed Playfair Display + Work Sans)
- `css/styles.css` — Full color and typography update across all components
- `js/app.js` — Updated SVG chart line/dot colors
- `CHANGELOG.md`

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