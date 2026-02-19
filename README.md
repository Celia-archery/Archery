# Archery Coach (Starter App)

A lightweight, offline-friendly web app to help archers track practice & competition scores, aligned with the NASP® "11 Steps to Archery Success".

## Quick start (local)

1. Unzip the project.
2. Start a local web server in that folder:

   **Python**
   ```bash
   python -m http.server 8000
   ```

   **Node**
   ```bash
   npx serve .
   ```

3. Open `http://localhost:8000` in your browser.

> Note: Service workers (offline install) require the app to be served over http/https (not file://).  
> The app still works without the service worker — it just won’t be “installable.”

## What’s included

- Practice sessions:
  - Bullseye (10m & 15m totals)
  - 2D/3D-style animal round (10–15m with animal name per distance)
  - Focus steps (NASP 11 Steps), mood, physical readiness, tags, notes
- Competitions: separate history + totals
- Progress charts: simple line charts for selected metrics
- Trends: mood/physical correlation + tag-based averages
- Aim maps: click/drag aiming spot per distance; upload your own target images (optional)
- Export/import backup as JSON

## Data

All data is stored in the browser (localStorage) for this device/profile. Use Export/Import in Settings to move to another device.

## Disclaimer

Not an official NASP® product. “NASP” is a registered trademark of the National Archery in the Schools Program.
