/** * 0. GLOBAL INITIALIZATION & THEME TOGGLE 
 */
let map = null; // Store map globally
const themeToggle = document.querySelector('#checkbox');
const currentTheme = localStorage.getItem('theme');

// Apply saved theme on load
if (currentTheme) {
    document.body.classList.toggle('dark-mode', currentTheme === 'dark-mode');
    themeToggle.checked = currentTheme === 'dark-mode';
}

// Handle theme switch
themeToggle.addEventListener('change', (e) => {
    const isDark = e.target.checked;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark-mode' : 'light-mode');
    
    // Refresh map tiles to apply the CSS filter if map exists
    if (map) {
        map.invalidateSize();
    }
});

/** * 1. AUTOCOMPLETE LOGIC 
 */
const locations = [
    "Times Square", "Central Park", "Empire State Building", "Brooklyn Bridge", 
    "Wall Street", "Greenwich Village", "East Village", "JFK Airport", 
    "LaGuardia Airport", "Harlem", "Upper East Side", "Upper West Side", 
    "Chelsea", "Soho", "Williamsburg", "DUMBO", "Astoria", "Flushing", 
    "Long Island City", "Penn Station", "Grand Central", "Battery Park"
];

const locInput = document.getElementById('location');
const resultsList = document.getElementById('autocomplete-list');

locInput.addEventListener('input', function() {
    const val = this.value;
    resultsList.innerHTML = ''; 
    
    if (!val) {
        resultsList.classList.add('hidden');
        return;
    }

    const matches = locations
        .filter(loc => loc.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 10);

    if (matches.length > 0) {
        resultsList.classList.remove('hidden');
        matches.forEach(match => {
            const item = document.createElement('div');
            item.innerHTML = `<strong>${match.substr(0, val.length)}</strong>${match.substr(val.length)}`;
            item.addEventListener('click', function() {
                locInput.value = match;
                resultsList.classList.add('hidden');
            });
            resultsList.appendChild(item);
        });
    } else {
        resultsList.classList.add('hidden');
    }
});

document.addEventListener('click', (e) => {
    if (e.target !== locInput) resultsList.classList.add('hidden');
});

/** * 2. DIGITAL CLOCK LOGIC 
 */
let currentHour = 12; 
let isPM = false;

const hourDisplay = document.getElementById('display-hour');
const hiddenHourInput = document.getElementById('hour'); 
const amBtn = document.getElementById('toggle-am');
const pmBtn = document.getElementById('toggle-pm');

function updateClock() {
    hourDisplay.innerText = currentHour;
    let modelHour = currentHour % 12; 
    if (isPM) modelHour += 12;
    hiddenHourInput.value = modelHour;
    amBtn.className = isPM ? "" : "active";
    pmBtn.className = isPM ? "active" : "";
}

document.getElementById('hour-up').addEventListener('click', () => {
    currentHour = (currentHour % 12) + 1;
    updateClock();
});

document.getElementById('hour-down').addEventListener('click', () => {
    currentHour = currentHour - 1 < 1 ? 12 : currentHour - 1;
    updateClock();
});

amBtn.addEventListener('click', () => { isPM = false; updateClock(); });
pmBtn.addEventListener('click', () => { isPM = true; updateClock(); });

updateClock();

/** * 3. FORM SUBMISSION, API & MAP LOGIC 
 */
document.getElementById('predict-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const loader = document.getElementById('loader');
    const results = document.getElementById('results-container');
    const welcome = document.getElementById('welcome-msg');
    const btn = document.getElementById('submit-btn');
    const mapContainer = document.getElementById('map'); 

    loader.classList.remove('hidden');
    results.classList.add('hidden');
    welcome.classList.add('hidden');
    if(mapContainer) mapContainer.classList.add('hidden'); 
    btn.disabled = true;

    const payload = {
        location: document.getElementById('location').value,
        hour: document.getElementById('hour').value,
        weekday: document.getElementById('weekday').value
    };

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.status === 'success') {
            // Map Logic
            if(mapContainer) mapContainer.classList.remove('hidden');
            
            if (map === null) {
                map = L.map('map').setView([data.coords.lat, data.coords.lon], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            } else {
                map.setView([data.coords.lat, data.coords.lon], 13);
            }

            map.eachLayer((layer) => {
                if (layer instanceof L.Marker || layer instanceof L.Circle) {
                    map.removeLayer(layer);
                }
            });

            L.marker([data.coords.lat, data.coords.lon])
                .addTo(map)
                .bindPopup(`Currently in ${data.your_zone}`)
                .openPopup();

            const surgeColor = (data.level === 'PEAK' || data.level === 'HIGH') ? '#E11900' : '#276EF1';
            L.circle([data.coords.lat, data.coords.lon], {
                color: surgeColor,
                fillColor: surgeColor,
                fillOpacity: 0.3,
                radius: 1500 
            }).addTo(map);

            // Update UI
            document.getElementById('res-level').innerText = data.level;
            document.getElementById('res-surge').innerText = data.surge;
            document.getElementById('res-zone').innerText = data.your_zone;
            document.getElementById('res-current-rides').innerText = data.current_rides;
            document.getElementById('res-best-hotspot').innerText = data.best_hotspot;
            document.getElementById('res-distance').innerText = data.distance_km;
            document.getElementById('res-hotspot-rides').innerText = data.hotspot_rides;

            const badge = document.getElementById('res-level');
            badge.style.backgroundColor = surgeColor;

            results.classList.remove('hidden');
        } else {
            alert("Error: " + data.message);
            welcome.classList.remove('hidden');
        }
    } catch (err) {
        alert("Server error. Make sure app.py is running!");
    } finally {
        loader.classList.add('hidden');
        btn.disabled = false;
    }
});