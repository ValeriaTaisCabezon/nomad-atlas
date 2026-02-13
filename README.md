# Nomad Atlas - Tu Diario de Viajes

A travel diary single-page application built with React 18 and Leaflet maps.

## Features
- Interactive world map with trip markers
- Trip timeline and dashboard views
- CSV import for trip data
- Year-in-review "Wrapped" view
- All data stored locally in your browser (localStorage)

## Tech Stack
- React 18 (CDN)
- Leaflet.js for maps
- Babel standalone for JSX transformation
- No build step required - pure static HTML

## Project Structure
```
index.html          → HTML structure + script loader
css/styles.css      → All styling
js/app.js           → All React components and logic
```

## Development
Start a local server in the project folder:
```bash
npx serve
```
Then open http://localhost:3000. Edit files and refresh to see changes.

## Deployment
Auto-deployed to Vercel on every push to `main`.
