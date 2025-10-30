# Frontend Deployment Guide

This folder contains a static site (no build step). You can host it on:
- Render Static Site (recommended)
- GitHub Pages / Netlify / Vercel Static

## Render (Static Site)
- Ensure `render.yaml` at repo root includes the static site service with `publishPath: frontend`.
- Create from Blueprint (recommended) or manually create a Static Site:
  - Build Command: (leave empty)
  - Publish Directory: `frontend`
- No environment variables are required. The app reads API base from `frontend/config.js` which defaults to:
  - `https://ecotwin-energyvis-api.onrender.com`
- To temporarily point to another API without changing code, open the site with:
  - `?api=<FULL_API_BASE_URL>` (e.g. `?api=https://example.com`)

## GitHub Pages
- Push only the contents of `frontend/` to a separate repo (or set Pages to serve from `/frontend`).
- Pages settings: Branch `main`, folder `/ (root)` if the repo only contains these files.

## Local preview
```bash
cd frontend
npx serve -l 8080
# open http://localhost:8080
```

## Notes
- Mapbox assets are loaded via CDN.
- `config.js` auto-picks a production API by default and supports overrides via `?api=...` and `localStorage`.
