# Changelog

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