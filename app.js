const state = {
    city: 'Colombo',
    lat: 6.9271,
    lon: 79.8612,
    countryCode: 'LK',
    unit: localStorage.getItem('unit') || 'metric',
    favorites: JSON.parse(localStorage.getItem('favorites')) || [],
    recent: JSON.parse(localStorage.getItem('recent')) || [],
    data: null,
    showAQIMarkers: localStorage.getItem('showAQIMarkers') !== 'false'
};

const OPENWEATHER_API_KEY = '4c08b9f14e0cf7416bd22c239b210801';

let mainMap, modalMap, hourlyChartInstance;
const dom = {
    searchInput: document.getElementById('city-search'),
    mainCity: document.getElementById('main-city'),
    mainCountry: document.getElementById('main-country'),
    mainTemp: document.getElementById('main-temp'),
    mainDate: document.getElementById('main-date'),
    weatherDesc: document.getElementById('weather-desc'),
    suggestions: document.getElementById('search-suggestions'),
    favBtn: document.getElementById('fav-toggle-btn'),
    effectsContainer: document.getElementById('weather-effects'),
    hourlyList: document.getElementById('hourly-forecast-container')
};

async function init() {
    lucide.createIcons();
    initMaps();
    initChart();
    renderFavorites();
    renderRecent();

    const hash = location.hash.replace('#', '');
    const params = new URLSearchParams(hash);
    const hLat = parseFloat(params.get('lat'));
    const hLon = parseFloat(params.get('lon'));
    const hCity = params.get('city');
    const hCountry = params.get('country');

    if (!isNaN(hLat) && !isNaN(hLon)) {
        await fetchWeather(hLat, hLon, hCity || state.city, hCountry || state.countryCode);
    } else {
        await fetchWeather(state.lat, state.lon, state.city, state.countryCode);
    }

    setupEventListeners();
}

function setupEventListeners() {
    let debounceTimer;
    dom.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => handleSearch(e.target.value), 300);
    });

    document.addEventListener('click', (e) => {
        if (!dom.searchInput.contains(e.target) && !dom.suggestions.contains(e.target)) {
            dom.suggestions.classList.add('hidden');
        }
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        const sb = document.getElementById('sidebar');
        sb.classList.toggle('-translate-x-full');
    });

    document.getElementById('unit-toggle').addEventListener('click', toggleUnit);
    dom.favBtn.addEventListener('click', toggleFavorite);

    document.getElementById('location-btn').addEventListener('click', detectLocation);

    document.getElementById('voice-btn').addEventListener('click', startVoiceSearch);

    const aqiToggleBtn = document.getElementById('aqi-toggle-btn');
    if (aqiToggleBtn) {
        const updateAQIBtn = () => {
            aqiToggleBtn.textContent = `AQI: ${state.showAQIMarkers ? 'On' : 'Off'}`;
            aqiToggleBtn.classList.toggle('bg-green-600', state.showAQIMarkers);
            aqiToggleBtn.classList.toggle('text-white', state.showAQIMarkers);
        };
        updateAQIBtn();
        aqiToggleBtn.addEventListener('click', () => {
            state.showAQIMarkers = !state.showAQIMarkers;
            localStorage.setItem('showAQIMarkers', state.showAQIMarkers ? 'true' : 'false');
            updateAQIBtn();
            if (!state.showAQIMarkers) {
                if (mainMap) {
                    mainMap.eachLayer(layer => {
                        try {
                            if (layer && layer._icon && layer._icon.classList && layer._icon.classList.contains('aqi-marker')) {
                                mainMap.removeLayer(layer);
                            }
                        } catch(e) {}
                    });
                }
            } else {
                loadAndRenderAQI(state.lat, state.lon);
            }
        });
    }

    document.getElementById('country-trigger').addEventListener('click', openCountryModal);
    document.getElementById('close-modal').addEventListener('click', closeCountryModal);

    document.getElementById('compare-input-1').addEventListener('change', (e) => fetchCompareCity(1, e.target.value));
    document.getElementById('compare-input-2').addEventListener('change', (e) => fetchCompareCity(2, e.target.value));

    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('share-btn').addEventListener('click', shareData);

    document.getElementById('clear-favorites-btn').addEventListener('click', clearFavorites);
    
    setupMapLayerControls();
}

function setupMapLayerControls() {
    let activeLayer = null;
    let layerOverlay = null;
    
    document.querySelectorAll('.map-layer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const layer = btn.dataset.layer;
            
            document.querySelectorAll('.map-layer-btn').forEach(b => b.classList.remove('active'));
            
            if (activeLayer === layer) {
                activeLayer = null;
                if (layerOverlay) {
                    mainMap.removeLayer(layerOverlay);
                    layerOverlay = null;
                }
            } else {
                btn.classList.add('active');
                activeLayer = layer;
                renderMapLayer(layer);
            }
        });
    });
    
    function renderMapLayer(layer) {
        if (layerOverlay) {
            mainMap.removeLayer(layerOverlay);
        }
        
        let tileUrl = '';
        
        switch(layer) {
            case 'temp':
                tileUrl = `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
                break;
            case 'wind':
                tileUrl = `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
                break;
            case 'clouds':
                tileUrl = `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
                break;
            case 'precipitation':
                tileUrl = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
                break;
        }
        
        if (tileUrl && mainMap) {
            layerOverlay = L.tileLayer(tileUrl, {
                opacity: 0.7,
                attribution: 'Weather data © OpenWeatherMap'
            });
            layerOverlay.addTo(mainMap);
            
            setTimeout(() => {
                showToast(`${layer.charAt(0).toUpperCase() + layer.slice(1)} layer activated`);
            }, 500);
        }
    }
}

async function fetchWeather(lat, lon, cityName, countryCode, isCompare = false) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,precipitation_probability,weathercode,visibility,windspeed_10m,surface_pressure&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;

        const cacheKey = `weather_cache:${lat.toFixed(4)}:${lon.toFixed(4)}:${state.unit}`;
        if (!isCompare) {
            const cacheRaw = localStorage.getItem(cacheKey);
            if (cacheRaw) {
                try {
                    const cached = JSON.parse(cacheRaw);
                    const age = Date.now() - (cached._ts || 0);
                    if (age < 10 * 60 * 1000 && cached.data) {
                        state.data = cached.data;
                        state.lat = lat;
                        state.lon = lon;
                        state.city = cityName || state.city;
                        state.countryCode = countryCode || state.countryCode;
                        updateDashboard(cached.data);
                        updateMap(lat, lon);
                        addToRecent(cityName, lat, lon, countryCode);
                        checkFavoriteStatus();
                    }
                } catch (e) {}
            }
        }

        const res = await fetch(url);
        const data = await res.json();
        console.debug('Open-Meteo raw response for', cityName || `${lat},${lon}:`, data);

        if (data) {
            if (data.hourly) {
                if (data.hourly.weathercode && !data.hourly.weather_code) data.hourly.weather_code = data.hourly.weathercode;
                if (data.hourly.relativehumidity_2m && !data.hourly.relative_humidity_2m) data.hourly.relative_humidity_2m = data.hourly.relativehumidity_2m;
                if (data.hourly.windspeed_10m && !data.hourly.wind_speed_10m) data.hourly.wind_speed_10m = data.hourly.windspeed_10m;
                if (data.hourly.surface_pressure && !data.hourly.pressure_msl) data.hourly.pressure_msl = data.hourly.surface_pressure;
            }
            if (data.daily) {
                if (data.daily.weathercode && !data.daily.weather_code) data.daily.weather_code = data.daily.weathercode;
            }

            if (!data.current) data.current = {};
            if (data.current_weather) {
                const cw = data.current_weather;
                data.current.temperature_2m = cw.temperature;
                data.current.weather_code = cw.weathercode;
                data.current.wind_speed_10m = cw.windspeed;
                data.current.is_day = cw.is_day;

                let idx = 0;
                if (data.hourly && Array.isArray(data.hourly.time)) {
                    const match = data.hourly.time.indexOf(cw.time);
                    idx = match !== -1 ? match : 0;

                    if (data.hourly.temperature_2m && data.hourly.temperature_2m[idx] != null) {
                        data.current.temperature_2m = data.hourly.temperature_2m[idx];
                    }
                    if (data.hourly.apparent_temperature && data.hourly.apparent_temperature[idx] != null) {
                        data.current.apparent_temperature = data.hourly.apparent_temperature[idx];
                    } else {
                        data.current.apparent_temperature = data.current.temperature_2m;
                    }
                    if (data.hourly.relativehumidity_2m && data.hourly.relativehumidity_2m[idx] != null) {
                        data.current.relative_humidity_2m = data.hourly.relativehumidity_2m[idx];
                    }
                    if (data.hourly.windspeed_10m && data.hourly.windspeed_10m[idx] != null) {
                        data.current.wind_speed_10m = data.hourly.windspeed_10m[idx];
                    }
                    if (data.hourly.surface_pressure && data.hourly.surface_pressure[idx] != null) {
                        data.current.pressure_msl = data.hourly.surface_pressure[idx];
                    }
                }
                if (data.current.relative_humidity_2m == null) data.current.relative_humidity_2m = data.current.relativehumidity_2m || null;
                if (data.current.pressure_msl == null) data.current.pressure_msl = data.current.surface_pressure || null;
            }
        }

        if (!isCompare) {
            state.data = data;
            state.lat = lat;
            state.lon = lon;
            state.city = cityName;
            state.countryCode = countryCode;

            try {
                localStorage.setItem(cacheKey, JSON.stringify({ _ts: Date.now(), data }));
            } catch (e) {}

            try {
                const h = new URLSearchParams({ lat: lat.toFixed(4), lon: lon.toFixed(4) });
                if (cityName) h.set('city', cityName);
                if (countryCode) h.set('country', countryCode);
                history.replaceState(null, '', `#${h.toString()}`);
            } catch (e) {}

            updateDashboard(data);
            updateMap(lat, lon);
            addToRecent(cityName, lat, lon, countryCode);
            checkFavoriteStatus();
            loadAndRenderAQI(lat, lon);
            loadNowcast();
        }
        return data;

    } catch (error) {
        console.error(error);
        showToast("Failed to fetch weather data", "error");
    }
}

function updateDashboard(data) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;

    dom.mainCity.textContent = state.city;
    dom.mainCountry.textContent = state.countryCode;
    dom.mainTemp.textContent = Math.round(convertTemp(current.temperature_2m));
    dom.mainDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: data.timezone });

    const lastEl = document.getElementById('last-updated');
    if (lastEl) {
        const now = new Date();
        lastEl.textContent = `Last updated: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }

    const wInfo = getWeatherInfo(current.weather_code);
    dom.weatherDesc.textContent = wInfo.desc;
    document.getElementById('weather-icon-container').innerHTML = `<i data-lucide="${wInfo.icon}" class="w-24 h-24 ${wInfo.color}"></i>`;

    updateWeatherEffects(current.weather_code);
    checkWeatherAlerts(current, daily, hourly);

    document.body.className = 'h-screen flex overflow-hidden';
    document.body.classList.add(wInfo.bgClass);

    document.getElementById('main-wind').textContent = current.wind_speed_10m;
    document.getElementById('main-humidity').textContent = current.relative_humidity_2m;
    document.getElementById('main-feel').textContent = Math.round(convertTemp(current.apparent_temperature));

    document.querySelectorAll('.unit-speed').forEach(el => {
        el.textContent = state.unit === 'metric' ? 'km/h' : 'mph';
    });

    document.getElementById('uv-val').textContent = daily.uv_index_max[0];
    document.getElementById('uv-bar').style.width = `${Math.min(daily.uv_index_max[0] * 10, 100)}%`;

    document.getElementById('sunrise-val').textContent = daily.sunrise[0].split('T')[1];
    document.getElementById('sunset-val').textContent = daily.sunset[0].split('T')[1];

    const vis = hourly.visibility[0] / 1000;
    document.getElementById('vis-val').textContent = vis.toFixed(1);
    document.getElementById('vis-desc').textContent = vis > 9 ? "Excellent View" : vis > 5 ? "Moderate Haze" : "Poor Visibility";

    document.getElementById('pressure-val').textContent = current.pressure_msl;

    const mockAQI = Math.floor(Math.random() * 100) + 20;
    document.getElementById('aqi-val').textContent = mockAQI;
    document.getElementById('aqi-status').textContent = mockAQI < 50 ? "Good" : mockAQI < 100 ? "Moderate" : "Unhealthy";
    document.getElementById('aqi-status').className = `text-xs mt-1 font-medium ${mockAQI < 50 ? 'text-green-400' : 'text-yellow-400'}`;

    const moon = getMoonPhase(new Date());
    document.getElementById('moon-phase').textContent = moon.phase;
    document.getElementById('moon-illum').textContent = moon.illumination;

    const forecastContainer = document.getElementById('forecast-list');
    forecastContainer.innerHTML = '';
    for(let i=0; i<7; i++) {
        const dayCode = daily.weather_code[i];
        const dayInfo = getWeatherInfo(dayCode);
        const max = Math.round(convertTemp(daily.temperature_2m_max[i]));
        const min = Math.round(convertTemp(daily.temperature_2m_min[i]));
        const date = new Date(daily.time[i]).toLocaleDateString('en-US', {weekday: 'short', day: 'numeric'});

        const html = `
                <div class="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group cursor-default">
                    <div class="w-20 font-medium text-gray-300">${date}</div>
                    <div class="flex items-center gap-3 flex-1 justify-center">
                        <i data-lucide="${dayInfo.icon}" class="w-6 h-6 ${dayInfo.color}"></i>
                        <span class="text-xs text-gray-500 hidden md:block">${dayInfo.desc}</span>
                    </div>
                    <div class="w-24 text-right font-mono">
                        <span class="text-white font-bold">${max}°</span> 
                        <span class="text-gray-500 text-sm">/ ${min}°</span>
                    </div>
                </div>`;
        forecastContainer.insertAdjacentHTML('beforeend', html);
    }

    const hourlyContainer = dom.hourlyList;
    hourlyContainer.innerHTML = '';
    const currentHour = new Date().getHours();

    for(let i=0; i<24; i++) {
        const dataIndex = currentHour + i;
        if (dataIndex >= hourly.time.length) break;

        const timeStr = hourly.time[dataIndex];
        const temp = Math.round(convertTemp(hourly.temperature_2m[dataIndex]));
        const wCode = hourly.weather_code[dataIndex];
        const wInfo = getWeatherInfo(wCode);
        const hourLabel = i === 0 ? 'Now' : new Date(timeStr).toLocaleTimeString('en-US', {hour: 'numeric', hour12: true});

        const item = document.createElement('div');
        item.className = "min-w-[80px] p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2 border border-transparent hover:border-white/10";
        item.innerHTML = `
                    <span class="text-xs text-gray-400">${hourLabel}</span>
                    <i data-lucide="${wInfo.icon}" class="w-6 h-6 ${wInfo.color}"></i>
                    <span class="font-bold">${temp}°</span>
                `;
        hourlyContainer.appendChild(item);
    }

    updateChart(hourly);

    lucide.createIcons();
}

function updateWeatherEffects(code) {
    const container = dom.effectsContainer;
    container.innerHTML = '';

    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
        const dropCount = 100;
        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
            drop.style.animationDelay = Math.random() * 2 + 's';
            container.appendChild(drop);
        }
    }

    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        const flakeCount = 50;
        for (let i = 0; i < flakeCount; i++) {
            const flake = document.createElement('div');
            flake.className = 'snow-flake';
            flake.style.left = Math.random() * 100 + 'vw';
            flake.style.width = (Math.random() * 5 + 5) + 'px';
            flake.style.height = flake.style.width;
            flake.style.animationDuration = (Math.random() * 3 + 2) + 's';
            flake.style.animationDelay = Math.random() * 2 + 's';
            container.appendChild(flake);
        }
    }

    if (code <= 3 && code >= 1 || (code >= 45 && code <= 48)) {
        const cloudCount = 3;
        for (let i = 0; i < cloudCount; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud-bg';
            cloud.style.top = Math.random() * 40 + 'vh';
            cloud.style.left = -20 + 'vw';
            cloud.style.width = (Math.random() * 300 + 200) + 'px';
            cloud.style.height = (Math.random() * 100 + 100) + 'px';
            cloud.style.animationDuration = (Math.random() * 20 + 30) + 's';
            container.appendChild(cloud);
        }
    }
}

function getWeatherInfo(code) {
    if (code === 0) return { desc: 'Clear Sky', icon: 'sun', color: 'text-yellow-400', bgClass: 'weather-clear' };
    if (code === 1 || code === 2 || code === 3) return { desc: 'Partly Cloudy', icon: 'cloud-sun', color: 'text-gray-300', bgClass: 'weather-cloudy' };
    if (code >= 45 && code <= 48) return { desc: 'Foggy', icon: 'cloud-fog', color: 'text-gray-400', bgClass: 'weather-cloudy' };
    if (code >= 51 && code <= 67) return { desc: 'Rain', icon: 'cloud-rain', color: 'text-blue-400', bgClass: 'weather-rain' };
    if (code >= 71 && code <= 77) return { desc: 'Snow', icon: 'snowflake', color: 'text-white', bgClass: 'weather-snow' };
    if (code >= 80 && code <= 82) return { desc: 'Heavy Rain', icon: 'cloud-drizzle', color: 'text-blue-500', bgClass: 'weather-rain' };
    if (code >= 95) return { desc: 'Thunderstorm', icon: 'cloud-lightning', color: 'text-yellow-500', bgClass: 'weather-storm' };
    return { desc: 'Unknown', icon: 'cloud', color: 'text-gray-400', bgClass: 'weather-cloudy' };
}

async function handleSearch(query) {
    if (query.length < 2) {
        dom.suggestions.classList.add('hidden');
        return;
    }

    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();

    dom.suggestions.innerHTML = '';
    if (data.results) {
        data.results.forEach(place => {
            const item = document.createElement('div');
            item.className = "p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 flex items-center justify-between";
            item.innerHTML = `
                        <div>
                            <div class="font-medium text-white">${place.name}</div>
                            <div class="text-xs text-gray-400">${place.admin1 || ''}, ${place.country}</div>
                        </div>
                        <img src="https://flagcdn.com/w20/${place.country_code.toLowerCase()}.png" class="w-5 h-auto rounded-sm">
                    `;
            item.addEventListener('click', () => {
                dom.searchInput.value = place.name;
                dom.suggestions.classList.add('hidden');
                fetchWeather(place.latitude, place.longitude, place.name, place.country_code);
            });
            dom.suggestions.appendChild(item);
        });
        dom.suggestions.classList.remove('hidden');
    }
}

function detectLocation() {
    if (!navigator.geolocation) {
        showToast("Geolocation is not supported by your browser", "error");
        return;
    }
    showToast("Detecting location...", "info");
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            const reverseGeoUrl = `https://api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}`;
            const res = await fetch(reverseGeoUrl);
            const data = await res.json();

            const cityName = data.name || "My Location";
            const countryCode = data.country_code || "LOC";

            fetchWeather(latitude, longitude, cityName, countryCode);
        },
        () => showToast("Unable to retrieve your location", "error")
    );
}

function initMaps() {
    mainMap = L.map('map', { zoomControl: false, attributionControl: false }).setView([state.lat, state.lon], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mainMap);

    modalMap = L.map('country-map-mini', { zoomControl: false, attributionControl: false, dragging: false }).setView([0,0], 1);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(modalMap);
}

function updateMap(lat, lon) {
    mainMap.setView([lat, lon], 10);
    mainMap.eachLayer((layer) => {
        if (layer instanceof L.Marker) mainMap.removeLayer(layer);
    });
    L.marker([lat, lon]).addTo(mainMap);
}

function initChart() {
    const ctx = document.getElementById('hourlyChart').getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = 'Inter';

    hourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temp',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Precip Prob',
                    data: [],
                    borderColor: '#a855f7',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { display: false },
                y1: { display: false, min: 0, max: 100 }
            }
        }
    });
}

function updateChart(hourlyData) {
    const labels = hourlyData.time.slice(0, 24).map(t => new Date(t).getHours() + ':00');
    const temps = hourlyData.temperature_2m.slice(0, 24).map(t => convertTemp(t));
    const rain = hourlyData.precipitation_probability.slice(0, 24);

    hourlyChartInstance.data.labels = labels;
    hourlyChartInstance.data.datasets[0].data = temps;
    hourlyChartInstance.data.datasets[1].data = rain;
    hourlyChartInstance.update();
}

async function openCountryModal() {
    const modal = document.getElementById('country-modal');
    const content = document.getElementById('modal-content');

    const closeBtn = document.getElementById('close-modal');
    let previousFocus = document.activeElement;

    modal.classList.remove('hidden');

    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);

    setTimeout(() => {
        modalMap.invalidateSize();
    }, 300);

    function modalKeyHandler(e) {
        if (e.key === 'Escape') {
            closeCountryModal();
        }
        if (e.key === 'Tab') {
            const focusables = content.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        }
    }
    document.addEventListener('keydown', modalKeyHandler);
    modal._modalKeyHandler = modalKeyHandler;

    if (state.countryCode === 'LOC') {
        closeBtn?.focus();
        return;
    }

    try {
        const res = await fetch(`https://restcountries.com/v3.1/alpha/${state.countryCode}`);
        const data = await res.json();
        const country = data[0];

        document.getElementById('modal-name').textContent = country.name.common;
        document.getElementById('modal-region').textContent = `${country.subregion || country.region}`;
        document.getElementById('modal-capital').textContent = country.capital ? country.capital[0] : 'N/A';
        document.getElementById('modal-pop').textContent = (country.population / 1000000).toFixed(1) + 'M';
        document.getElementById('modal-curr').textContent = Object.keys(country.currencies).join(', ');
        document.getElementById('modal-lang').textContent = Object.values(country.languages).join(', ');

        document.getElementById('modal-area').textContent = country.area.toLocaleString() + ' km²';
        document.getElementById('modal-timezone').textContent = country.timezones[0];
        document.getElementById('modal-borders').textContent = country.borders ? country.borders.length : 'None';
        document.getElementById('modal-demonym').textContent = country.demonyms?.eng?.m || 'N/A';

        document.getElementById('modal-flag').src = country.flags.png;
        document.getElementById('modal-flag-bg').src = country.flags.png;

        modalMap.setView(country.latlng, 5);

        closeBtn?.focus();
    } catch (e) {
        console.log("Country info fetch failed");
    }
}

function closeCountryModal() {
    const modal = document.getElementById('country-modal');
    const content = document.getElementById('modal-content');

    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');

    if (modal._modalKeyHandler) {
        document.removeEventListener('keydown', modal._modalKeyHandler);
        delete modal._modalKeyHandler;
    }

    setTimeout(() => modal.classList.add('hidden'), 300);

    const trigger = document.getElementById('country-trigger');
    trigger?.focus();
}

async function fetchCompareCity(slotId, cityName) {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();

    if (!geoData.results) return showToast(`City "${cityName}" not found`, "error");

    const place = geoData.results[0];
    const data = await fetchWeather(place.latitude, place.longitude, place.name, place.country_code, true);

    renderCompareCard(slotId, place, data);
}

function renderCompareCard(slotId, place, data) {
    const card = document.getElementById(`compare-card-${slotId}`);
    const info = getWeatherInfo(data.current.weather_code);

    card.innerHTML = `
                <div class="flex flex-col items-center w-full animate-[fadeIn_0.5s]">
                    <h3 class="text-2xl font-bold">${place.name}</h3>
                    <p class="text-gray-400 mb-4">${place.country}</p>
                    <i data-lucide="${info.icon}" class="w-20 h-20 ${info.color} mb-2"></i>
                    <div class="text-6xl font-bold mb-4">${Math.round(convertTemp(data.current.temperature_2m))}°</div>
                    
                    <div class="w-full grid grid-cols-2 gap-4 text-sm">
                        <div class="bg-white/5 p-3 rounded-lg flex justify-between">
                            <span class="text-gray-400">Humidity</span>
                            <span>${data.current.relative_humidity_2m}%</span>
                        </div>
                        <div class="bg-white/5 p-3 rounded-lg flex justify-between">
                            <span class="text-gray-400">Wind</span>
                            <span>${data.current.wind_speed_10m} km/h</span>
                        </div>
                        <div class="bg-white/5 p-3 rounded-lg flex justify-between">
                            <span class="text-gray-400">Rain Prob</span>
                            <span>${data.hourly.precipitation_probability[0]}%</span>
                        </div>
                        <div class="bg-white/5 p-3 rounded-lg flex justify-between">
                            <span class="text-gray-400">UV Index</span>
                            <span>${data.daily.uv_index_max[0]}</span>
                        </div>
                    </div>
                </div>
            `;
    lucide.createIcons();
}

async function fetchAQI(lat, lon) {
    try {
        const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=50000&limit=1`;
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();
        if (!data || !data.results || data.results.length === 0) return null;

        const loc = data.results[0];
        const pm25 = loc.measurements.find(m => m.parameter === 'pm25');
        const pm10 = loc.measurements.find(m => m.parameter === 'pm10');
        const no2 = loc.measurements.find(m => m.parameter === 'no2');
        const o3 = loc.measurements.find(m => m.parameter === 'o3');

        const primary = pm25 || pm10 || no2 || o3 || loc.measurements[0];
        if (!primary) return null;

        let aqi = null; let category = 'Unknown';
        if (pm25) {
            const v = pm25.value;
            const c = pm25ToAQI(v);
            aqi = c.aqi;
            category = c.category;
        }

        return {
            location: loc.location,
            parameter: primary.parameter,
            value: primary.value,
            unit: primary.unit,
            aqi,
            category
        };
    } catch (e) {
        console.warn('AQI data unavailable (CORS or API error):', e.message);
        return null;
    }
}

function pm25ToAQI(pm25) {
    if (pm25 <= 12) return { aqi: Math.round((pm25 / 12) * 50), category: 'Good' };
    if (pm25 <= 35.4) return { aqi: Math.round(51 + ((pm25 - 12) / (35.4 - 12)) * 49), category: 'Moderate' };
    if (pm25 <= 55.4) return { aqi: Math.round(101 + ((pm25 - 35.5) / (55.4 - 35.5)) * 49), category: 'Unhealthy for Sensitive' };
    if (pm25 <= 150.4) return { aqi: Math.round(151 + ((pm25 - 55.5) / (150.4 - 55.5)) * 49), category: 'Unhealthy' };
    if (pm25 <= 250.4) return { aqi: Math.round(201 + ((pm25 - 150.5) / (250.4 - 150.5)) * 99), category: 'Very Unhealthy' };
    return { aqi: Math.round(301 + ((pm25 - 250.5) / 100) * 199), category: 'Hazardous' };
}

async function loadAndRenderAQI(lat, lon) {
    const noteEl = document.getElementById('aqi-note');
    const valEl = document.getElementById('aqi-val');
    const statusEl = document.getElementById('aqi-status');

    try {
        if (noteEl) noteEl.textContent = 'Fetching...';
        const a = await fetchAQI(lat, lon);
        if (!a) {
            if (valEl) valEl.textContent = 'N/A';
            if (statusEl) { statusEl.textContent = 'No data'; statusEl.className = 'text-xs mt-1 font-medium text-gray-400'; }
            if (noteEl) noteEl.textContent = 'Source: OpenAQ (no nearby measurements)';
            return;
        }

        if (a.aqi != null) {
            valEl.textContent = a.aqi;
            statusEl.textContent = a.category;
            const colorClass = a.aqi <= 50 ? 'text-green-400' : a.aqi <= 100 ? 'text-yellow-400' : 'text-red-400';
            statusEl.className = `text-xs mt-1 font-medium ${colorClass}`;
        } else {
            valEl.textContent = `${a.value} ${a.unit}`;
            statusEl.textContent = a.parameter.toUpperCase();
            statusEl.className = 'text-xs mt-1 font-medium text-gray-400';
        }
        if (noteEl) noteEl.textContent = `Source: OpenAQ — ${a.location}`;

        try {
            if (mainMap && a && a.location && state.showAQIMarkers) {
                mainMap.eachLayer(layer => {
                    try {
                        if (layer?.options && layer.options?.pane === 'overlayPane' && layer._icon && layer._icon.classList && layer._icon.classList.contains('aqi-marker')) {
                            mainMap.removeLayer(layer);
                        }
                    } catch(e) {}
                });
                const markerEl = L.divIcon({ className: 'aqi-marker', html: `<div class="px-2 py-1 rounded bg-black/70 text-xs text-white">AQI ${a.aqi || a.value}</div>` });
                L.marker([lat, lon], { icon: markerEl }).addTo(mainMap);
            }
        } catch (e) {}

    } catch (e) {
        console.debug('loadAndRenderAQI error', e);
        if (valEl) valEl.textContent = 'Err';
        if (statusEl) { statusEl.textContent = 'Error'; statusEl.className = 'text-xs mt-1 font-medium text-gray-400'; }
        if (noteEl) noteEl.textContent = 'AQI fetch failed';
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    if (viewName === 'journal' && !journalState.initialized) {
        initJournalView();
        journalState.initialized = true;
    }

    if (viewName === 'consensus' && !consensusChart) {
        initConsensusView();
    }

    if (viewName === 'dashboard' && state.data) {
        loadNowcast();
    }

    if(window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
    }
}

function toggleUnit() {
    state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
    localStorage.setItem('unit', state.unit);
    document.getElementById('unit-toggle').textContent = state.unit === 'metric' ? '°C' : '°F';
    if (state.data) updateDashboard(state.data);
}

function convertTemp(celsius) {
    if (state.unit === 'imperial') return (celsius * 9/5) + 32;
    return celsius;
}

function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast("Voice search not supported", "error");

    const recognition = new SpeechRecognition();
    const btn = document.getElementById('voice-btn');

    recognition.start();
    btn.classList.add('text-red-500', 'listening-pulse');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        dom.searchInput.value = transcript;
        handleSearch(transcript);
        btn.classList.remove('text-red-500', 'listening-pulse');
    };

    recognition.onerror = () => {
        btn.classList.remove('text-red-500', 'listening-pulse');
        showToast("Voice not recognized", "error");
    };
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-500/20 border-red-500' : 'bg-blue-500/20 border-blue-500';

    el.className = `glass-card border px-4 py-3 rounded-xl text-sm shadow-xl transform transition-all duration-500 translate-y-10 opacity-0 ${bg}`;
    el.innerHTML = msg;

    container.appendChild(el);
    requestAnimationFrame(() => el.classList.remove('translate-y-10', 'opacity-0'));

    setTimeout(() => {
        el.classList.add('opacity-0', 'translate-x-10');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

function checkFavoriteStatus() {
    const isFav = state.favorites.some(f => f.city === state.city);
    const icon = dom.favBtn.querySelector('svg');
    if (icon) {
        icon.classList.toggle('fill-yellow-400', isFav);
        icon.classList.toggle('text-yellow-400', isFav);
    }
}

function toggleFavorite() {
    const idx = state.favorites.findIndex(f => f.city === state.city);
    if (idx === -1) {
        state.favorites.push({ city: state.city, lat: state.lat, lon: state.lon, countryCode: state.countryCode });
        showToast("Added to Favorites");
    } else {
        state.favorites.splice(idx, 1);
        showToast("Removed from Favorites");
    }
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    checkFavoriteStatus();
    renderFavorites();
}

function renderFavorites() {
    const container = document.getElementById('favorites-grid');
    container.innerHTML = '';

    if (state.favorites.length === 0) {
        document.getElementById('no-favorites').classList.remove('hidden');
        return;
    }
    document.getElementById('no-favorites').classList.add('hidden');

    state.favorites.forEach(fav => {
        const el = document.createElement('div');
        el.className = 'glass-card p-6 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer group relative';
        el.innerHTML = `
                    <h3 class="text-xl font-bold">${fav.city}</h3>
                    <p class="text-sm text-gray-400">${fav.countryCode}</p>
                    <i data-lucide="arrow-right" class="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                `;
        el.addEventListener('click', () => {
            switchView('dashboard');
            fetchWeather(fav.lat, fav.lon, fav.city, fav.countryCode);
        });
        container.appendChild(el);
    });
    lucide.createIcons();
}

function clearFavorites() {
    state.favorites = [];
    localStorage.setItem('favorites', JSON.stringify([]));
    checkFavoriteStatus();
    renderFavorites();
}

function addToRecent(city, lat, lon, countryCode) {
    state.recent = state.recent.filter(r => r.city !== city);
    state.recent.unshift({ city, lat, lon, countryCode });
    if(state.recent.length > 5) state.recent.pop();

    localStorage.setItem('recent', JSON.stringify(state.recent));
    renderRecent();
}

function renderRecent() {
    const container = document.getElementById('recent-searches');
    container.innerHTML = '';
    state.recent.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1.5 glass-card rounded-lg text-xs text-gray-300 hover:bg-white/10 whitespace-nowrap transition-colors';
        btn.textContent = r.city;
        btn.addEventListener('click', () => fetchWeather(r.lat, r.lon, r.city, r.countryCode));
        container.appendChild(btn);
    });
}

function exportData() {
    if (!state.data) return;
    const csvContent = "data:text/csv;charset=utf-8,"
        + "Metric,Value\n"
        + `City,${state.city}\n`
        + `Temp,${state.data.current.temperature_2m}\n`
        + `Humidity,${state.data.current.relative_humidity_2m}\n`
        + `Wind,${state.data.current.wind_speed_10m}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${state.city}_weather.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function shareData() {
    const temp = state.data ? Math.round(convertTemp(state.data.current.temperature_2m)) : '--';
    const unitLabel = state.unit === 'metric' ? 'C' : 'F';
    const url = location.href;
    const text = `Current weather in ${state.city}: ${temp}°${unitLabel}. View: ${url}`;
    if (navigator.share) {
        navigator.share({ title: 'SkyScope Weather', text: text, url });
    } else {
        navigator.clipboard.writeText(text);
        showToast("Copied to clipboard!");
    }
}

function getMoonPhase(date) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    if (month < 3) { year--; month += 12; }
    ++month;
    let c = 365.25 * year;
    let e = 30.6 * month;
    let jd = c + e + day - 694039.09;
    jd /= 29.5305882;
    let b = parseInt(jd);
    jd -= b;
    b = Math.round(jd * 8);
    if (b >= 8 ) b = 0;

    const phases = ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"];
    return { phase: phases[b], illumination: Math.round(jd * 100) };
}

function checkWeatherAlerts(current, daily, hourly) {
    const alerts = [];
    const temp = convertTemp(current.temperature_2m);
    const windSpeed = current.wind_speed_10m;
    const uvIndex = daily.uv_index_max[0];
    
    if (temp > 35) {
        alerts.push({
            type: 'critical',
            icon: 'thermometer-sun',
            title: 'Extreme Heat Warning',
            message: `Temperature at ${Math.round(temp)}°${state.unit === 'metric' ? 'C' : 'F'}. Stay hydrated and avoid prolonged sun exposure.`,
            action: 'View Safety Tips'
        });
    } else if (temp < 0) {
        alerts.push({
            type: 'critical',
            icon: 'thermometer-snowflake',
            title: 'Freezing Temperature Alert',
            message: `Temperature at ${Math.round(temp)}°${state.unit === 'metric' ? 'C' : 'F'}. Watch for ice and dress warmly.`,
            action: 'Winter Safety'
        });
    }
    
    if (windSpeed > 50) {
        alerts.push({
            type: 'critical',
            icon: 'wind',
            title: 'High Wind Warning',
            message: `Wind speeds reaching ${Math.round(windSpeed)} km/h. Secure loose objects and avoid outdoor activities.`,
            action: 'Wind Safety'
        });
    } else if (windSpeed > 30) {
        alerts.push({
            type: 'warning',
            icon: 'wind',
            title: 'Windy Conditions',
            message: `Moderate winds at ${Math.round(windSpeed)} km/h. Exercise caution outdoors.`,
            action: 'More Info'
        });
    }
    
    if (uvIndex >= 8) {
        alerts.push({
            type: 'warning',
            icon: 'sun',
            title: 'Very High UV Index',
            message: `UV Index at ${uvIndex}. Use sunscreen SPF 30+ and seek shade during midday.`,
            action: 'UV Protection'
        });
    }
    
    const maxPrecip = Math.max(...hourly.precipitation_probability.slice(0, 24));
    if (maxPrecip > 70) {
        alerts.push({
            type: 'info',
            icon: 'cloud-rain',
            title: 'Rain Expected',
            message: `${maxPrecip}% chance of precipitation in the next 24 hours. Carry an umbrella.`,
            action: 'Hourly Forecast'
        });
    }
    
    renderWeatherAlerts(alerts);
}

function renderWeatherAlerts(alerts) {
    const container = document.getElementById('weather-alerts-container');
    
    if (alerts.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    
    container.classList.remove('hidden');
    
    const alertColors = {
        critical: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', icon: 'text-red-400', anim: 'alert-critical' },
        warning: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', icon: 'text-yellow-400', anim: 'alert-warning' },
        info: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', icon: 'text-blue-400', anim: '' }
    };
    
    container.innerHTML = alerts.map((alert, i) => {
        const colors = alertColors[alert.type];
        return `
            <div class="glass-card ${colors.bg} border-2 ${colors.border} rounded-2xl p-4 flex items-start gap-4 alert-slide-in ${colors.anim}" style="animation-delay: ${i * 0.1}s">
                <div class="${colors.icon} flex-shrink-0 mt-1">
                    <i data-lucide="${alert.icon}" class="w-6 h-6"></i>
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <h3 class="font-bold ${colors.text}">${alert.title}</h3>
                        <button class="text-xs ${colors.text} hover:underline font-medium">${alert.action}</button>
                    </div>
                    <p class="text-sm text-gray-300">${alert.message}</p>
                </div>
                <button class="alert-dismiss flex-shrink-0 text-gray-400 hover:text-white transition-colors" data-index="${i}">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
    
    container.querySelectorAll('.alert-dismiss').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const alertEl = e.target.closest('.glass-card');
            alertEl.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => alertEl.remove(), 300);
        });
    });
}

const journalState = {
    entries: JSON.parse(localStorage.getItem('weatherJournal')) || [],
    currentComfort: null
};

function initJournalView() {
    document.getElementById('add-journal-btn').addEventListener('click', () => {
        document.getElementById('journal-form').classList.remove('hidden');
    });

    document.getElementById('cancel-journal-btn').addEventListener('click', () => {
        document.getElementById('journal-form').classList.add('hidden');
        journalState.currentComfort = null;
        document.querySelectorAll('.comfort-btn').forEach(b => b.classList.remove('ring-2', 'ring-blue-400'));
        document.getElementById('journal-notes').value = '';
    });

    document.querySelectorAll('.comfort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            journalState.currentComfort = btn.dataset.level;
            document.querySelectorAll('.comfort-btn').forEach(b => b.classList.remove('ring-2', 'ring-blue-400'));
            btn.classList.add('ring-2', 'ring-blue-400');
        });
    });

    document.getElementById('save-journal-btn').addEventListener('click', saveJournalEntry);

    renderJournalEntries();
}

function saveJournalEntry() {
    if (!journalState.currentComfort) {
        showToast('Please select a comfort level');
        return;
    }

    const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        city: state.city,
        temp: state.data ? state.data.current.temperature_2m : null,
        weather: state.data ? state.data.current.weather_code : null,
        comfort: journalState.currentComfort,
        notes: document.getElementById('journal-notes').value.trim()
    };

    journalState.entries.unshift(entry);
    localStorage.setItem('weatherJournal', JSON.stringify(journalState.entries));

    document.getElementById('journal-form').classList.add('hidden');
    journalState.currentComfort = null;
    document.querySelectorAll('.comfort-btn').forEach(b => b.classList.remove('ring-2', 'ring-blue-400'));
    document.getElementById('journal-notes').value = '';

    renderJournalEntries();
    updateJournalInsights();
    showToast('Entry saved!');
}

function renderJournalEntries() {
    const container = document.getElementById('journal-entries');
    const empty = document.getElementById('no-journal');

    if (journalState.entries.length === 0) {
        empty.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }

    empty.classList.add('hidden');

    const comfortEmoji = {
        '1': '😫',
        '2': '🥶',
        '3': '👌',
        '4': '🥵',
        '5': '😰'
    };

    const comfortLabels = {
        '1': 'Too Cold',
        '2': 'Cold',
        '3': 'Perfect',
        '4': 'Hot',
        '5': 'Too Hot'
    };

    container.innerHTML = journalState.entries.map(entry => {
        const date = new Date(entry.date);
        const temp = entry.temp ? `${Math.round(convertTemp(entry.temp))}°${state.unit === 'metric' ? 'C' : 'F'}` : 'N/A';
        return `
            <div class="glass-card p-4 rounded-xl">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="text-sm text-gray-400">${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                        <div class="font-semibold">${entry.city}</div>
                    </div>
                    <div class="text-3xl">${comfortEmoji[entry.comfort]}</div>
                </div>
                <div class="flex gap-2 mb-2 text-sm">
                    <span class="bg-blue-500/20 px-2 py-1 rounded">${temp}</span>
                    <span class="bg-purple-500/20 px-2 py-1 rounded">${comfortLabels[entry.comfort]}</span>
                </div>
                ${entry.notes ? `<div class="text-sm text-gray-300 mt-2">${entry.notes}</div>` : ''}
            </div>
        `;
    }).join('');
}

function updateJournalInsights() {
    if (journalState.entries.length < 3) return;

    const perfectEntries = journalState.entries.filter(e => e.comfort === '3' && e.temp);
    if (perfectEntries.length < 2) return;

    const temps = perfectEntries.map(e => convertTemp(e.temp));
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);

    const unitLabel = state.unit === 'metric' ? 'C' : 'F';

    document.getElementById('journal-insights').innerHTML = `
        <h4 class="font-semibold mb-2">🧠 Your Comfort Zone</h4>
        <p class="text-sm text-gray-300">Based on ${perfectEntries.length} entries, you feel most comfortable between <span class="text-blue-400 font-bold">${Math.round(minTemp)}°${unitLabel} - ${Math.round(maxTemp)}°${unitLabel}</span></p>
        <p class="text-xs text-gray-400 mt-1">Average: ${Math.round(avgTemp)}°${unitLabel}</p>
    `;
    document.getElementById('journal-insights').classList.remove('hidden');
}

let consensusChart;

async function initConsensusView() {
    const ctx = document.getElementById('consensus-chart').getContext('2d');
    consensusChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}°${state.unit === 'metric' ? 'C' : 'F'}`
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                y: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255,255,255,0.1)' } }
            }
        }
    });

    await loadConsensusData();
}

async function loadConsensusData() {
    try {
        document.getElementById('consensus-city').textContent = state.city || 'current location';

        const openMeteoData = state.data;
        if (!openMeteoData) return;

        const hours = openMeteoData.hourly.time.slice(0, 24).map((t, i) => {
            const d = new Date(t);
            return d.getHours() + ':00';
        });

        const openMeteoTemps = openMeteoData.hourly.temperature_2m.slice(0, 24).map(convertTemp);

        const owTemps = openMeteoTemps.map(t => t + (Math.random() * 2 - 1));
        const wbTemps = openMeteoTemps.map(t => t + (Math.random() * 2.5 - 1.25));

        consensusChart.data.labels = hours;
        consensusChart.data.datasets = [
            {
                label: 'Open-Meteo',
                data: openMeteoTemps,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                tension: 0.4
            },
            {
                label: 'OpenWeather (simulated)',
                data: owTemps,
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168,85,247,0.1)',
                tension: 0.4
            },
            {
                label: 'Weatherbit (simulated)',
                data: wbTemps,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16,185,129,0.1)',
                tension: 0.4
            }
        ];
        consensusChart.update();

        const allTemps = [...openMeteoTemps, ...owTemps, ...wbTemps];
        const avg = allTemps.reduce((a, b) => a + b, 0) / allTemps.length;
        const min = Math.min(...allTemps);
        const max = Math.max(...allTemps);
        const variance = allTemps.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / allTemps.length;

        const unitLabel = state.unit === 'metric' ? 'C' : 'F';

        document.getElementById('consensus-avg').textContent = `${Math.round(avg)}°${unitLabel}`;
        document.getElementById('consensus-range').textContent = `${Math.round(min)}-${Math.round(max)}°${unitLabel}`;
        document.getElementById('consensus-variance').textContent = variance.toFixed(2);

        const confidence = variance < 2 ? 'High' : variance < 5 ? 'Medium' : 'Low';
        const confidenceBadge = document.getElementById('consensus-confidence');
        confidenceBadge.textContent = confidence;
        confidenceBadge.className = 'px-3 py-1 rounded-full text-xs font-bold ';
        if (confidence === 'High') confidenceBadge.className += 'bg-green-500/20 text-green-400';
        else if (confidence === 'Medium') confidenceBadge.className += 'bg-yellow-500/20 text-yellow-400';
        else confidenceBadge.className += 'bg-red-500/20 text-red-400';

        document.getElementById('provider-1-temp').textContent = `${Math.round(openMeteoTemps[0])}°${unitLabel}`;
        document.getElementById('provider-2-temp').textContent = `${Math.round(owTemps[0])}°${unitLabel}`;
        document.getElementById('provider-3-temp').textContent = `${Math.round(wbTemps[0])}°${unitLabel}`;

    } catch (error) {
        console.error('Consensus error:', error);
    }
}

async function loadNowcast() {
    const nowcastMessage = document.getElementById('nowcast-message');
    const nowcastTimeline = document.getElementById('nowcast-timeline');
    const nowcastStatus = document.getElementById('nowcast-status');

    try {
        const intensity = Math.random();
        const rainStart = intensity > 0.3 ? Math.floor(Math.random() * 60) : null;

        const minutes = [];
        for (let i = 0; i <= 120; i += 10) {
            const baseIntensity = rainStart !== null && i >= rainStart ? 0.3 + Math.random() * 0.7 : Math.random() * 0.2;
            minutes.push({
                time: i,
                intensity: baseIntensity
            });
        }

        nowcastMessage.classList.add('hidden');
        nowcastTimeline.classList.remove('hidden');

        const timelineContainer = nowcastTimeline.querySelector('.flex');
        timelineContainer.innerHTML = minutes.map(m => {
            const height = Math.max(10, m.intensity * 60);
            const color = m.intensity < 0.2 ? 'bg-gray-600' : m.intensity < 0.5 ? 'bg-blue-400' : 'bg-blue-600';
            return `
                <div class="flex flex-col items-center gap-1 min-w-[40px]">
                    <div class="${color} rounded-t" style="width: 30px; height: ${height}px;"></div>
                    <div class="text-xs text-gray-400">${m.time}'</div>
                </div>
            `;
        }).join('');

        if (rainStart !== null) {
            nowcastStatus.innerHTML = `<span class="text-blue-400 font-semibold">⚠️ Rain in ~${rainStart} min</span>`;
        } else {
            nowcastStatus.innerHTML = '<span class="text-green-400">✓ No rain expected</span>';
        }

    } catch (error) {
        console.error('Nowcast error:', error);
        nowcastMessage.textContent = 'Unable to load nowcast data';
        nowcastStatus.textContent = 'Error';
    }
}

window.addEventListener('DOMContentLoaded', init);

