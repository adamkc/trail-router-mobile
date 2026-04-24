# Trail Router — Mobile

Mobile companion to the [Trail Route Editor](https://github.com/adamkc/trail-route-editor) desktop app. Record, edit, and optimize trails with real terrain data — in your pocket.

Built from the `design_handoff_trail_router/` Figma export as a React + Vite web app. All 13 artboards are ported pixel-faithfully; the golden path (Home → Record → Review → Library) is wired, and library entries persist across reloads.

## Run locally

```bash
npm install
npm run dev
```

Opens at [http://127.0.0.1:5173](http://127.0.0.1:5173). On desktop you'll see the design canvas with all 13 artboards framed in an Android bezel. On a phone-sized viewport (≤ 480 px wide) the canvas becomes a simple directory and individual screens render full-bleed without the bezel.

## Stack

- React 19 + TypeScript + Vite
- `react-router-dom` (HashRouter — works on static hosts without server config)
- `maplibre-gl@4.7.1` (same version as the desktop editor) with Carto's free dark-matter basemap
- `zustand` for recording + library state (library persisted to `localStorage`)

## Install on your phone

Once deployed (see below), open the site URL on your phone and use your browser's **Add to Home Screen** option. The app will launch in standalone mode (no browser chrome) with its own icon — roughly the experience of a native app, without a Play Store listing.

- **Android / Chrome:** tap the three-dot menu → *Install app* (or *Add to Home screen*).
- **iOS / Safari:** tap the share button → *Add to Home Screen*.

The service worker pre-caches the app shell, fonts, and recently-viewed map tiles, so the app opens instantly and works reasonably offline after the first load.

A real installable Android APK (via Capacitor) is the next step — see `src/components/MapCanvas.tsx` for the MapLibre integration that'll carry over.

## Deploy to GitHub Pages

The repo ships a workflow that builds and deploys to Pages on every push to `main`. To use it:

1. Initialize git in this folder and create a public repo:
   ```bash
   cd trail-router-mobile
   git init
   git add .
   git commit -m "Initial import"
   gh repo create trail-router-mobile --public --source=. --push
   ```
2. In the new repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — the `deploy.yml` workflow builds with `VITE_BASE=/<repo-name>/` and publishes `dist/` to Pages.
4. Your site goes live at `https://<your-user>.github.io/trail-router-mobile/`.

If you rename the repo, the workflow picks the new name up automatically from `github.event.repository.name` — nothing to change in `vite.config.ts`.

## Project layout

```
src/
  components/   shared primitives: Icon, MapCanvas, TopoMap, TrailLine,
                ElevChart, SlopeRibbon, BottomTabBar, AndroidDevice, ...
  screens/      13 screen components + registry.ts (route + metadata)
  store/        zustand stores: recording, library
  hooks/        useIsMobile
  styles/       tokens.css (CSS variables), globals.css
```

See the design handoff's own README for the product model, interactions, and the rest of the design system — this repo is an implementation of that spec.
