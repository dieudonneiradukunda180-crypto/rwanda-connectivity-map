# Rwanda Connectivity Map

An interactive Leaflet.js map showing real MTN and Airtel cell tower locations
in Rwanda, sourced from [OpenCelliD](https://opencellid.org) (CC BY-SA 4.0
licensed, crowdsourced open cell tower database).

**Live site:** _add your GitHub Pages link here once published_

## What it shows

- Real MTN tower locations (yellow dots)
- Real Airtel tower locations (red dots)
- A distance-based "connectivity likelihood" layer: for any point you click,
  the map calculates the real straight-line distance to the nearest tower
  and estimates a rough likelihood score from it (closer = higher score).

This is an educational/research proxy, **not** an official operator coverage
map — real signal coverage also depends on terrain, tower power, obstacles,
etc. that this simple model does not account for.

## Project structure

```
index.html              - page layout & sidebar
app.js                  - map logic, data loading, distance calculations
mtn.geojson             - MTN tower points (generated from OpenCelliD CSV)
airtel.geojson          - Airtel tower points (generated from OpenCelliD CSV)
csv_to_geojson.py        - converts a raw OpenCelliD CSV export into the .geojson files above
.github/workflows/refresh-data.yml - optional automation that re-downloads
                           and regenerates the data on a weekly schedule
```

## Running locally

Browsers block `fetch()` from opening local files directly, so you need a
tiny local server:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Keeping the data up to date

Tower data is a snapshot, not live. To refresh it manually:

1. Download a fresh Rwanda (MCC 635) CSV from your OpenCelliD account.
2. Run `python3 csv_to_geojson.py` in this folder.
3. Commit and push the updated `mtn.geojson` / `airtel.geojson`.

Alternatively, set up the included GitHub Actions workflow
(`.github/workflows/refresh-data.yml`) to do this automatically every week —
see the comments inside that file for the one-time setup steps.

## License / attribution

Tower data © OpenCelliD contributors, licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Basemap ©
OpenStreetMap contributors.
