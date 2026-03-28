/* ═══════════════════════════════════════════════════
   HotspotAI — script.js
   Handles: clock, slider, Leaflet map, fetch, UI
═══════════════════════════════════════════════════ */

// ── CLOCK ──────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toTimeString().slice(0, 8);
}
updateClock();
setInterval(updateClock, 1000);

// ── HOUR SLIDER ────────────────────────────────────
const hourSlider = document.getElementById('hour');
hourSlider.addEventListener('input', () => {
  const h = parseInt(hourSlider.value);
  document.getElementById('hour-val').textContent =
    `${String(h).padStart(2, '0')}:00`;
});

// ── MAP INIT ───────────────────────────────────────
let map;
let markersLayer = [];

function initMap() {
  map = L.map('map', {
    center: [40.75, -73.99],
    zoom: 11,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(map);

  // Force resize so tiles fill the flex container on first load
  setTimeout(() => map.invalidateSize(), 200);
}

window.addEventListener('load', initMap);

// ── CUSTOM ICONS ───────────────────────────────────
function makeIcon(color, size = 13, pulse = false) {
  const pulseRing = pulse
    ? `<div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${color};
         opacity:0.4;animation:ripple 1.8s ease-out infinite"></div>`
    : '';
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px">
        ${pulseRing}
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color};border:2.5px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.2)
        "></div>
      </div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4]
  });
}

// ── MARKER HELPERS ─────────────────────────────────
function clearMarkers() {
  markersLayer.forEach(m => m.remove());
  markersLayer = [];
}

function addMarker(lat, lon, icon, html) {
  const m = L.marker([lat, lon], { icon }).addTo(map).bindPopup(html);
  markersLayer.push(m);
  return m;
}

// ── STATUS CHIP ────────────────────────────────────
function setStatus(state) {
  const chip = document.getElementById('status-chip');
  // Reset classes then apply new one
  chip.className = '';
  chip.id = 'status-chip';
  if (state === 'scanning') {
    chip.classList.add('scanning');
    chip.textContent = 'SCANNING';
  } else if (state === 'ready') {
    chip.classList.add('ready');
    chip.textContent = 'READY';
  } else {
    chip.textContent = 'IDLE';
  }
}

// ── TOAST ──────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

// ── SURGE HELPERS ──────────────────────────────────
function surgeColor(level) {
  if (level === 'PEAK')     return '#dc2626';
  if (level === 'HIGH')     return '#d97706';
  if (level === 'MODERATE') return '#2563eb';
  return '#16a34a';
}

function surgeBg(level) {
  if (level === 'PEAK')     return { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' };
  if (level === 'HIGH')     return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' };
  if (level === 'MODERATE') return { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' };
  return { bg: '#dcfce7', border: '#86efac', text: '#15803d' };
}

// ── BUTTON + KEYBOARD LISTENERS ────────────────────
document.getElementById('scan-btn').addEventListener('click', runPrediction);
document.getElementById('location').addEventListener('keydown', e => {
  if (e.key === 'Enter') runPrediction();
});

// ── MAIN PREDICTION ────────────────────────────────
async function runPrediction() {
  const location = document.getElementById('location').value.trim();
  const hour     = parseInt(document.getElementById('hour').value);
  const weekday  = parseInt(document.getElementById('weekday').value);
  const month    = parseInt(document.getElementById('month').value);

  if (!location) {
    showToast('⚠ Please enter your current location');
    document.getElementById('location').focus();
    return;
  }

  // Loading state
  const btn = document.getElementById('scan-btn');
  btn.disabled = true;
  document.getElementById('btn-icon').innerHTML = '<span class="spin">◌</span>';
  document.getElementById('btn-text').textContent = 'Scanning…';
  setStatus('scanning');
  document.querySelector('.map-section').classList.add('scanning-map');

  try {
    const res = await fetch('/predict', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ location, hour, weekday, month })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Location not found. Try a specific NYC area.');
      return;
    }

    renderResults(data);

  } catch (err) {
    // Fallback demo — shows mock NYC data when Flask server is not running
    console.warn('Flask server not reachable, using demo data:', err);
    renderResults(makeMockData(location, hour, weekday));
  } finally {
    btn.disabled = false;
    document.getElementById('btn-icon').textContent = '⬡';
    document.getElementById('btn-text').textContent = 'Scan Hotspots';
    document.querySelector('.map-section').classList.remove('scanning-map');
    setStatus('ready');
  }
}

// ── DEMO FALLBACK DATA ─────────────────────────────
// Generates realistic mock results when Flask is not running
function makeMockData(location, hour, weekday) {
  const zones = [
    { name: 'Midtown Manhattan',  lat: 40.7549, lon: -73.9840 },
    { name: 'Times Square',       lat: 40.7580, lon: -73.9855 },
    { name: 'JFK Airport',        lat: 40.6413, lon: -73.7781 },
    { name: 'Lower Manhattan',    lat: 40.7075, lon: -74.0113 },
    { name: 'LaGuardia Airport',  lat: 40.7769, lon: -73.8740 },
    { name: 'Upper East Side',    lat: 40.7736, lon: -73.9566 },
    { name: 'Brooklyn Heights',   lat: 40.6958, lon: -73.9942 },
    { name: 'Williamsburg',       lat: 40.7081, lon: -73.9571 },
  ];

  const surgeByHour = [
    1.0,1.0,1.0,1.2,1.5,1.8,2.0,2.2,
    2.0,1.8,1.5,1.2,1.2,1.0,1.0,1.0,
    1.2,1.5,2.0,2.3,2.5,2.2,1.8,1.5
  ];
  const surge = surgeByHour[hour] ?? 1.2;
  const level = surge >= 2 ? 'PEAK' : surge >= 1.5 ? 'HIGH' : surge >= 1.2 ? 'MODERATE' : 'LOW';

  const driverLat = 40.75 + (Math.random() - 0.5) * 0.05;
  const driverLon = -73.99 + (Math.random() - 0.5) * 0.05;

  const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  const hotspots = zones.map(z => ({
    hotspot_name: z.name,
    rides:        Math.floor(80 + Math.random() * 120),
    distance_km:  haversine(driverLat, driverLon, z.lat, z.lon),
    lat: z.lat,
    lon: z.lon
  })).sort((a, b) => b.rides - a.rides);

  const best = hotspots[0];
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  return {
    driver_lat:    driverLat,
    driver_lon:    driverLon,
    hour_label:    `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`,
    day_label:     days[weekday],
    your_zone:     zones[Math.floor(Math.random() * zones.length)].name,
    current_rides: Math.floor(40 + Math.random() * 60),
    best_hotspot:  best.hotspot_name,
    best_lat:      best.lat,
    best_lon:      best.lon,
    distance_km:   best.distance_km,
    hotspot_rides: best.rides,
    surge,
    level,
    all_hotspots:  hotspots
  };
}

// ── RENDER RESULTS ─────────────────────────────────
function renderResults(data) {
  // Reveal panels
  document.getElementById('results').style.display      = 'flex';
  document.getElementById('table-section').style.display = 'block';

  // Zone card
  document.getElementById('res-zone').textContent  = data.your_zone;
  document.getElementById('res-rides').textContent = data.current_rides;

  // Surge card
  const sc  = surgeColor(data.level);
  const sbg = surgeBg(data.level);

  document.getElementById('res-surge').textContent = data.surge;
  document.getElementById('res-surge').style.color  = sc;

  const lvlEl = document.getElementById('res-level');
  lvlEl.textContent         = data.level;
  lvlEl.style.background    = sbg.bg;
  lvlEl.style.border        = `1px solid ${sbg.border}`;
  lvlEl.style.color         = sbg.text;

  const pct = Math.min(((data.surge - 1.0) / 1.5) * 100, 100);
  setTimeout(() => {
    document.getElementById('surge-bar').style.width = pct + '%';
  }, 80);

  // Best hotspot card
  document.getElementById('res-hotspot').textContent = data.best_hotspot;
  document.getElementById('res-dist').textContent    = data.distance_km;
  document.getElementById('res-hriders').textContent = data.hotspot_rides;

  // Map hint
  document.getElementById('map-hint').textContent =
    `${data.hour_label}, ${data.day_label} — ${data.all_hotspots.length} zones scanned`;

  renderMap(data);
  renderTable(data.all_hotspots, data.best_hotspot);
}

// ── MAP RENDER ─────────────────────────────────────
function renderMap(data) {
  if (!map) return;
  clearMarkers();
  map.invalidateSize(); // ensure tiles fill the flex container

  // Driver marker
  addMarker(
    data.driver_lat, data.driver_lon,
    makeIcon('#2563eb', 18, true),
    `<strong>YOU ARE HERE</strong><br>${data.your_zone}<br>${data.current_rides} rides nearby`
  );

  // Hotspot markers
  data.all_hotspots.forEach(h => {
    const isBest = h.hotspot_name === data.best_hotspot;
    const lat    = h.lat ?? data.best_lat;
    const lon    = h.lon ?? data.best_lon;
    const m = addMarker(
      lat, lon,
      makeIcon(isBest ? '#16a34a' : '#e85d26', isBest ? 18 : 12, isBest),
      `<strong>${isBest ? '★ BEST: ' : ''}${h.hotspot_name}</strong>
       <br>Rides: ${h.rides}<br>Distance: ${h.distance_km} km`
    );
    if (isBest) setTimeout(() => m.openPopup(), 500);
  });

  // Route line: driver → best hotspot
  const line = L.polyline(
    [[data.driver_lat, data.driver_lon], [data.best_lat, data.best_lon]],
    { color: '#16a34a', weight: 2.5, dashArray: '6 5', opacity: 0.7 }
  ).addTo(map);
  markersLayer.push(line);

  // Fit map to show all points
  const coords = [
    [data.driver_lat, data.driver_lon],
    ...data.all_hotspots.map(h => [h.lat ?? data.best_lat, h.lon ?? data.best_lon])
  ];
  map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
}

// ── TABLE RENDER ───────────────────────────────────
function renderTable(hotspots, bestName) {
  const tbody = document.getElementById('zone-tbody');
  tbody.innerHTML = '';

  hotspots.forEach((h, i) => {
    const isBest = h.hotspot_name === bestName;
    const tr = document.createElement('tr');
    if (isBest) tr.className = 'best-row';
    tr.innerHTML = `
      <td style="color:var(--text3);font-size:10px">${i + 1}</td>
      <td>${isBest ? '★ ' : ''}${h.hotspot_name}</td>
      <td>${h.rides}</td>
      <td>${h.distance_km}km</td>
    `;
    tbody.appendChild(tr);
  });
}