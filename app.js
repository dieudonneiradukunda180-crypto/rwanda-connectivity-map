// Leaflet MVP for Rwanda connectivity map
// Basemap: OpenStreetMap tiles (from Leaflet)

const map = L.map('map', { zoomControl: true });

const RwandaBounds = [
  [-2.660, 29.020], // southwest [lat, lng]
  [-1.050, 30.920]  // northeast [lat, lng]
];

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

map.fitBounds(RwandaBounds);

// =========================================================
// STEP A: Real tower data (MTN + Airtel)
// =========================================================
// We keep every tower's plain {lat, lon} in one combined list. This list is
// what makes the "proxy" layer REAL instead of fake: for any point on the
// map, we can now measure the actual distance to the nearest real tower.
let allTowerPoints = []; // filled in once mtn.geojson + airtel.geojson load

const mtnLayer = L.layerGroup();
const airtelLayer = L.layerGroup();
const tigoLayer = L.layerGroup(); // no free data source yet - stays empty

// Turns one GeoJSON file into colored dots inside the given layer group.
function addTowersToLayer(geojson, targetLayer, color) {
  const geoLayer = L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 4,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1
      }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(
        `<strong>Radio:</strong> ${p.radio ?? 'n/a'}<br>` +
        `<strong>Approx. range:</strong> ${p.range_m ?? 'n/a'} m<br>` +
        `<strong>Samples:</strong> ${p.samples ?? 'n/a'}`
      );
    }
  });
  geoLayer.addTo(targetLayer);
}

// =========================================================
// STEP B: Real-distance math (this replaces the old fake formula)
// =========================================================

// Straight-line distance in METERS between two GPS points on Earth.
// This is the standard "Haversine formula" - it accounts for the Earth
// being a sphere, not a flat grid, so it's accurate over real distances.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Checks EVERY real tower and returns the distance (in meters) to the
// closest one. With ~5,000 towers this runs instantly in the browser.
function nearestTowerDistanceMeters(lat, lng) {
  let min = Infinity;
  for (const t of allTowerPoints) {
    const d = haversineMeters(lat, lng, t.lat, t.lon);
    if (d < min) min = d;
  }
  return min;
}

// FALLOFF_METERS = the distance at which we consider likelihood to have
// dropped to ~0. 3000m (3km) is a reasonable rough assumption for typical
// tower range in a mixed urban/rural country. Feel free to tune this.
const FALLOFF_METERS = 3000;

// Converts a distance into a 0-1 "likelihood" score:
// 0m away = 1.0 (100%), FALLOFF_METERS or farther = 0.0 (0%).
function scoreFromDistance(distanceMeters) {
  return Math.max(0, 1 - distanceMeters / FALLOFF_METERS);
}

// =========================================================
// STEP C: Build the proxy layer using REAL distances
// =========================================================
// This draws a grid of points across Rwanda. For each grid point, we look
// up the real nearest-tower distance and color/size the dot accordingly.
// This is a well-known GIS technique (distance-based proximity estimate),
// NOT an official operator coverage map - but it's now grounded in real
// tower positions instead of a made-up center point.
function makeProxyLayer() {
  const group = L.layerGroup();
  const latMin = RwandaBounds[0][0], latMax = RwandaBounds[1][0];
  const lngMin = RwandaBounds[0][1], lngMax = RwandaBounds[1][1];

  const stepsLat = 22; // increase for finer detail (slower to build)
  const stepsLng = 22;

  for (let i = 0; i <= stepsLat; i++) {
    const lat = latMin + (i / stepsLat) * (latMax - latMin);
    for (let j = 0; j <= stepsLng; j++) {
      const lng = lngMin + (j / stepsLng) * (lngMax - lngMin);

      const distance = nearestTowerDistanceMeters(lat, lng);
      const score = scoreFromDistance(distance);

      const color = `rgba(78,161,255,${0.12 + 0.5 * score})`;
      const radiusPx = 2 + 10 * score;

      const marker = L.circleMarker([lat, lng], {
        radius: radiusPx,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 1
      });

      marker.__proxyScore = score;
      marker.__proxyDistance = distance;
      group.addLayer(marker);
    }
  }
  return group;
}

let proxyLayer = L.layerGroup(); // empty placeholder until real data is ready

// =========================================================
// STEP D: Wire up the sidebar checkboxes
// =========================================================
const layerProxy = document.getElementById('layerProxy');
const layerMTN = document.getElementById('layerMTN');
const layerAirtel = document.getElementById('layerAirtel');
const layerTigo = document.getElementById('layerTigo');
const status = document.getElementById('status');

function toggleLayer(layer, on) {
  if (on) map.addLayer(layer);
  else map.removeLayer(layer);
}

layerProxy.addEventListener('change', () => toggleLayer(proxyLayer, layerProxy.checked));
layerMTN.addEventListener('change', () => toggleLayer(mtnLayer, layerMTN.checked));
layerAirtel.addEventListener('change', () => toggleLayer(airtelLayer, layerAirtel.checked));
layerTigo.addEventListener('change', () => toggleLayer(tigoLayer, layerTigo.checked));

// =========================================================
// STEP E: Load the real tower files, then build everything that depends on them
// =========================================================
status.textContent = 'Loading real tower data (MTN + Airtel)...';

Promise.all([
  fetch('mtn.geojson').then((r) => r.json()),
  fetch('airtel.geojson').then((r) => r.json())
])
  .then(([mtnData, airtelData]) => {
    // Draw the actual tower dots
    addTowersToLayer(mtnData, mtnLayer, '#ffcc00');   // MTN = yellow
    addTowersToLayer(airtelData, airtelLayer, '#ff0000'); // Airtel = red

    // Build one combined list of {lat, lon} used for distance calculations
    allTowerPoints = [
      ...mtnData.features.map((f) => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] })),
      ...airtelData.features.map((f) => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }))
    ];

    // Now that we have real tower positions, build the real proxy layer
    proxyLayer = makeProxyLayer();

    // Respect whatever the checkboxes were already set to in the HTML
    if (layerProxy.checked) map.addLayer(proxyLayer);
    if (layerMTN.checked) map.addLayer(mtnLayer);
    if (layerAirtel.checked) map.addLayer(airtelLayer);

    status.textContent = `Ready. Loaded ${allTowerPoints.length} real towers (MTN + Airtel).`;
  })
  .catch((err) => {
    console.error(err);
    status.textContent =
      'Could not load tower data. Make sure mtn.geojson and airtel.geojson are in the same folder as index.html, and that you are running a local server (not opening the file directly).';
  });

// =========================================================
// STEP F: Click info - now uses the REAL distance calculation live
// =========================================================
map.on('click', (e) => {
  const { lat, lng } = e.latlng;

  if (allTowerPoints.length === 0) {
    status.textContent = 'Tower data is still loading - please wait a moment and click again.';
    return;
  }

  const distance = nearestTowerDistanceMeters(lat, lng);
  const score = scoreFromDistance(distance);

  const label =
    score > 0.75 ? 'Very likely' :
    score > 0.45 ? 'Likely' :
    score > 0.25 ? 'Moderate' :
    'Low (proxy)';

  status.textContent =
    `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n` +
    `Nearest real tower: ${distance.toFixed(0)} m away\n` +
    `Connectivity likelihood (distance-based proxy): ${(score * 100).toFixed(0)}%\n` +
    `Interpretation: ${label}`;
});

document.getElementById('btnFit').addEventListener('click', () => {
  map.fitBounds(RwandaBounds);
});
