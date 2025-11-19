let map;
let countryMap;
let marker;
let city = "Colombo";
let lat = 6.9271;
let lon = 79.8612;
let countryCode = "LK";
let alertIdCounter = 0;
let weatherEffectsInterval;
let activeWeatherEffect = null;

window.onload = function () {
    lucide.createIcons();
    setupMap();
    searchCity();
    document.getElementById('city-search').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchCity();
        }
    });
    document.getElementById('main-country').addEventListener('click', function () {
        showCountryDetails();
    });
    document.getElementById('close-modal').addEventListener('click', function () {
        closeModal();
    });
}

function setupMap() {
    map = L.map('map-container').setView([lat, lon], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        className: 'dark-map-tiles'
    }).addTo(map);

    marker = L.marker([lat, lon]).addTo(map);

    countryMap = L.map('country-map-container').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        className: 'dark-map-tiles'
    }).addTo(countryMap);
}

function searchCity() {
    let input = document.getElementById('city-search').value;
    if (input) {
        city = input;
    }

    document.getElementById('search-loader').classList.remove('hidden');

    fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + city + '&count=1&language=en&format=json')
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (!data.results) {
                alert("City not found");
                document.getElementById('search-loader').classList.add('hidden');
                return;
            }

            let result = data.results[0];
            lat = result.latitude;
            lon = result.longitude;
            countryCode = result.country_code;

            document.getElementById('main-city').innerText = result.name;
            document.getElementById('country-text').innerText = result.country;

            map.setView([lat, lon], 10);
            marker.setLatLng([lat, lon]);

            getWeather(lat, lon);
        });
}

function getWeather(latitude, longitude) {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto')
        .then(function (response) { return response.json(); })
        .then(function (data) {
            document.getElementById('search-loader').classList.add('hidden');

            document.getElementById('main-temp').innerText = Math.round(data.current.temperature_2m);

            let code = data.current.weather_code;
            let iconName = "cloud";
            let color = "text-gray-400";
            let desc = "Unknown";

            if (code === 0) { iconName = "sun"; desc = "Clear Sky"; color = "text-yellow-400"; }
            else if (code === 1 || code === 2 || code === 3) { iconName = "cloud-sun"; desc = "Cloudy"; color = "text-gray-300"; }
            else if (code >= 45 && code <= 48) { iconName = "cloud-fog"; desc = "Fog"; color = "text-gray-400"; }
            else if (code >= 51 && code <= 67) { iconName = "cloud-rain"; desc = "Rain"; color = "text-blue-400"; }
            else if (code >= 71 && code <= 77) { iconName = "snowflake"; desc = "Snow"; color = "text-cyan-200"; }
            else if (code >= 95) { iconName = "cloud-lightning"; desc = "Storm"; color = "text-yellow-500"; }

            document.getElementById('weather-desc').innerText = desc;
            document.getElementById('weather-icon-container').innerHTML = '<i data-lucide="' + iconName + '" class="w-24 h-24 ' + color + '"></i>';

            let date = new Date();
            let min = date.getMinutes();
            if (min < 10) min = "0" + min;
            document.getElementById('main-time').innerText = date.getHours() + ":" + min;

            document.getElementById('uv-val').innerText = data.daily.uv_index_max[0];
            document.getElementById('uv-bar').style.width = (data.daily.uv_index_max[0] * 10) + '%';

            document.getElementById('wind-val').innerText = data.current.wind_speed_10m;
            document.getElementById('wind-dir').innerText = "Angle: " + data.current.wind_direction_10m + "°";

            document.getElementById('humidity-val').innerText = data.current.relative_humidity_2m;

            let vis = data.hourly.visibility[12] / 1000;
            if (!vis) vis = 10;
            document.getElementById('visibility-val').innerText = vis.toFixed(1);

            document.getElementById('feels-val').innerText = Math.round(data.current.apparent_temperature);

            document.getElementById('sunrise-val').innerText = data.daily.sunrise[0].slice(11, 16);
            document.getElementById('sunset-val').innerText = data.daily.sunset[0].slice(11, 16);

            generateHourlyForecast(data);
            checkWeatherAlerts(data);
            updateWeatherBackground(data.current.weather_code);

            let forecastHTML = "";
            let days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            for (let i = 0; i < 7; i++) {
                let max = Math.round(data.daily.temperature_2m_max[i]);
                let min = Math.round(data.daily.temperature_2m_min[i]);
                let dCode = data.daily.weather_code[i];

                let dDate = new Date(data.daily.time[i]);
                let dName = days[dDate.getDay()];
                if (i === 0) dName = "Today";

                let dIcon = "cloud";
                if (dCode === 0) dIcon = "sun";
                else if (dCode > 50) dIcon = "cloud-rain";

                forecastHTML += '<div class="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl">';
                forecastHTML += '<div class="text-gray-300 w-16">' + dName + '</div>';
                forecastHTML += '<i data-lucide="' + dIcon + '" class="w-6 h-6 text-white"></i>';
                forecastHTML += '<div class="text-white">' + max + '° / ' + min + '°</div>';
                forecastHTML += '</div>';
            }
            document.getElementById('forecast-list').innerHTML = forecastHTML;

            lucide.createIcons();
        });
}

function updateWeatherBackground(weatherCode) {
    const body = document.body;
    body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rain', 'weather-snow', 'weather-storm', 'weather-fog');
    stopWeatherEffects();
    if (weatherCode === 0) {
        body.classList.add('weather-clear');
        startCloudEffect();
    } else if (weatherCode >= 1 && weatherCode <= 3) {
        body.classList.add('weather-cloudy');
        startCloudEffect();
    } else if (weatherCode >= 45 && weatherCode <= 48) {
        body.classList.add('weather-fog');
        startFogEffect();
    } else if (weatherCode >= 51 && weatherCode <= 67) {
        body.classList.add('weather-rain');
        startRainEffect();
    } else if (weatherCode >= 71 && weatherCode <= 77) {
        body.classList.add('weather-snow');
        startSnowEffect();
    } else if (weatherCode >= 95) {
        body.classList.add('weather-storm');
        startStormEffect();
    }
}

function stopWeatherEffects() {
    if (weatherEffectsInterval) {
        clearInterval(weatherEffectsInterval);
        weatherEffectsInterval = null;
    }
    
    const effectsContainer = document.getElementById('weather-effects');
    if (effectsContainer) {
        effectsContainer.innerHTML = '';
    }
    
    activeWeatherEffect = null;
}

function startRainEffect() {
    activeWeatherEffect = 'rain';
    const effectsContainer = document.getElementById('weather-effects');
    
    function createRaindrop() {
        if (activeWeatherEffect !== 'rain') return;
        
        const raindrop = document.createElement('div');
        raindrop.classList.add('raindrop');
        raindrop.style.left = Math.random() * 100 + 'vw';
        raindrop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
        raindrop.style.animationDelay = Math.random() * 0.5 + 's';
        effectsContainer.appendChild(raindrop);
        
        setTimeout(() => {
            raindrop.remove();
        }, 2000);
    }
    
    for (let i = 0; i < 50; i++) {
        setTimeout(createRaindrop, i * 20);
    }
    
    weatherEffectsInterval = setInterval(createRaindrop, 50);
}

function startSnowEffect() {
    activeWeatherEffect = 'snow';
    const effectsContainer = document.getElementById('weather-effects');
    
    function createSnowflake() {
        if (activeWeatherEffect !== 'snow') return;
        
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');
        snowflake.style.left = Math.random() * 100 + 'vw';
        snowflake.style.width = (Math.random() * 5 + 5) + 'px';
        snowflake.style.height = snowflake.style.width;
        snowflake.style.animationDuration = (Math.random() * 3 + 3) + 's';
        snowflake.style.animationDelay = Math.random() * 2 + 's';
        effectsContainer.appendChild(snowflake);
        
        setTimeout(() => {
            snowflake.remove();
        }, 6000);
    }
    
    for (let i = 0; i < 30; i++) {
        setTimeout(createSnowflake, i * 100);
    }
    
    weatherEffectsInterval = setInterval(createSnowflake, 200);
}

function startStormEffect() {
    activeWeatherEffect = 'storm';
    const effectsContainer = document.getElementById('weather-effects');
    
    const lightning = document.createElement('div');
    lightning.classList.add('lightning');
    effectsContainer.appendChild(lightning);
    
    startRainEffect();
}

function startFogEffect() {
    activeWeatherEffect = 'fog';
    const effectsContainer = document.getElementById('weather-effects');
    
    for (let i = 0; i < 3; i++) {
        const fogLayer = document.createElement('div');
        fogLayer.classList.add('fog-layer');
        fogLayer.style.top = (i * 33) + '%';
        fogLayer.style.animationDuration = (20 + i * 5) + 's';
        fogLayer.style.animationDelay = (i * 2) + 's';
        effectsContainer.appendChild(fogLayer);
    }
}

function startCloudEffect() {
    activeWeatherEffect = 'clouds';
    const effectsContainer = document.getElementById('weather-effects');
    
    function createCloud() {
        if (activeWeatherEffect !== 'clouds') return;
        
        const cloud = document.createElement('div');
        cloud.classList.add('cloud-drift');
        cloud.style.top = Math.random() * 50 + '%';
        cloud.style.animationDuration = (Math.random() * 20 + 30) + 's';
        cloud.style.animationDelay = Math.random() * 5 + 's';
        effectsContainer.appendChild(cloud);
        
        setTimeout(() => {
            cloud.remove();
        }, 60000);
    }
    
    for (let i = 0; i < 5; i++) {
        setTimeout(createCloud, i * 2000);
    }
}

function generateHourlyForecast(data) {
    let hourlyHTML = "";
    let currentHour = new Date().getHours();
    
    for (let i = 0; i < 24; i++) {
        let hour = (currentHour + i) % 24;
        let temp = Math.round(data.hourly.temperature_2m[i]);
        let weatherCode = data.hourly.weather_code[i];
        
        let iconName = "cloud";
        let color = "text-gray-400";
        
        if (weatherCode === 0) { iconName = "sun"; color = "text-yellow-400"; }
        else if (weatherCode === 1 || weatherCode === 2 || weatherCode === 3) { iconName = "cloud-sun"; color = "text-gray-300"; }
        else if (weatherCode >= 45 && weatherCode <= 48) { iconName = "cloud-fog"; color = "text-gray-400"; }
        else if (weatherCode >= 51 && weatherCode <= 67) { iconName = "cloud-rain"; color = "text-blue-400"; }
        else if (weatherCode >= 71 && weatherCode <= 77) { iconName = "snowflake"; color = "text-cyan-200"; }
        else if (weatherCode >= 95) { iconName = "cloud-lightning"; color = "text-yellow-500"; }
        
        let timeLabel = hour + ":00";
        if (i === 0) timeLabel = "Now";
        
        hourlyHTML += '<div class="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-xl min-w-[100px] transition-all">';
        hourlyHTML += '<div class="text-sm text-gray-400 mb-2 font-medium">' + timeLabel + '</div>';
        hourlyHTML += '<i data-lucide="' + iconName + '" class="w-10 h-10 ' + color + ' my-2"></i>';
        hourlyHTML += '<div class="text-xl font-bold text-white">' + temp + '°</div>';
        hourlyHTML += '</div>';
    }
    
    document.getElementById('hourly-forecast').innerHTML = hourlyHTML;
    lucide.createIcons();
}

function checkWeatherAlerts(data) {
    let alerts = [];
    
    let currentTemp = data.current.temperature_2m;
    if (currentTemp > 35) {
        alerts.push({
            type: 'warning',
            icon: 'thermometer-sun',
            title: 'High Temperature Alert',
            message: 'Temperature is extremely high (' + Math.round(currentTemp) + '°C). Stay hydrated and avoid prolonged sun exposure.',
            color: 'red'
        });
    } else if (currentTemp < 0) {
        alerts.push({
            type: 'warning',
            icon: 'snowflake',
            title: 'Freezing Temperature Alert',
            message: 'Temperature is below freezing (' + Math.round(currentTemp) + '°C). Dress warmly and watch for ice.',
            color: 'blue'
        });
    }
    
    let uvIndex = data.daily.uv_index_max[0];
    if (uvIndex >= 8) {
        alerts.push({
            type: 'warning',
            icon: 'sun',
            title: 'Very High UV Index',
            message: 'UV index is ' + uvIndex + '. Take extra precautions - wear sunscreen and protective clothing.',
            color: 'yellow'
        });
    }
    
    let windSpeed = data.current.wind_speed_10m;
    if (windSpeed > 50) {
        alerts.push({
            type: 'danger',
            icon: 'wind',
            title: 'Strong Wind Warning',
            message: 'Wind speed is ' + Math.round(windSpeed) + ' km/h. Secure loose objects and be cautious outdoors.',
            color: 'orange'
        });
    }
    
    let weatherCode = data.current.weather_code;
    if (weatherCode >= 95) {
        alerts.push({
            type: 'danger',
            icon: 'cloud-lightning',
            title: 'Storm Warning',
            message: 'Thunderstorm conditions detected. Stay indoors and avoid open areas.',
            color: 'purple'
        });
    }
    
    if (weatherCode >= 61 && weatherCode <= 67) {
        alerts.push({
            type: 'info',
            icon: 'cloud-rain',
            title: 'Heavy Rain',
            message: 'Expect heavy rainfall. Drive carefully and watch for flooding.',
            color: 'blue'
        });
    }
    
    if (weatherCode >= 71 && weatherCode <= 77) {
        alerts.push({
            type: 'info',
            icon: 'snowflake',
            title: 'Snow Expected',
            message: 'Snow is falling or expected. Roads may be slippery.',
            color: 'cyan'
        });
    }
    
    let visibility = data.hourly.visibility[12] / 1000;
    if (visibility && visibility < 1) {
        alerts.push({
            type: 'warning',
            icon: 'eye-off',
            title: 'Low Visibility',
            message: 'Visibility is very low (' + visibility.toFixed(1) + ' km). Drive with caution and use fog lights.',
            color: 'gray'
        });
    }
    
    displayAlerts(alerts);
}

function displayAlerts(alerts) {
    let container = document.getElementById('alerts-container');
    
    if (alerts.length === 0) {
        showAlert({
            type: 'success',
            icon: 'check-circle',
            title: 'All Clear',
            message: 'No weather warnings for your location.',
            color: 'green'
        });
        return;
    }
    
    alerts.forEach(function(alert) {
        showAlert(alert);
    });
}

function showAlert(alert) {
    let alertId = 'alert-' + alertIdCounter++;
    let colorClasses = {
        'red': 'bg-red-500/20 border-red-500/50 text-red-200',
        'blue': 'bg-blue-500/20 border-blue-500/50 text-blue-200',
        'yellow': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200',
        'orange': 'bg-orange-500/20 border-orange-500/50 text-orange-200',
        'purple': 'bg-purple-500/20 border-purple-500/50 text-purple-200',
        'cyan': 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200',
        'gray': 'bg-gray-500/20 border-gray-500/50 text-gray-200',
        'green': 'bg-green-500/20 border-green-500/50 text-green-200'
    };
    
    let iconColors = {
        'red': 'text-red-400',
        'blue': 'text-blue-400',
        'yellow': 'text-yellow-400',
        'orange': 'text-orange-400',
        'purple': 'text-purple-400',
        'cyan': 'text-cyan-400',
        'gray': 'text-gray-400',
        'green': 'text-green-400'
    };
    
    let alertHTML = '<div id="' + alertId + '" class="glass-card border ' + colorClasses[alert.color] + ' p-4 rounded-2xl shadow-lg transform translate-x-full transition-all duration-500 max-w-md">';
    alertHTML += '<div class="flex items-start gap-3">';
    alertHTML += '<div class="p-2 bg-black/20 rounded-lg flex-shrink-0">';
    alertHTML += '<i data-lucide="' + alert.icon + '" class="w-5 h-5 ' + iconColors[alert.color] + '"></i>';
    alertHTML += '</div>';
    alertHTML += '<div class="flex-1">';
    alertHTML += '<h4 class="font-bold text-sm mb-1">' + alert.title + '</h4>';
    alertHTML += '<p class="text-xs opacity-90">' + alert.message + '</p>';
    alertHTML += '</div>';
    alertHTML += '<button onclick="dismissAlert(\'' + alertId + '\')" class="p-1 hover:bg-black/20 rounded transition-colors flex-shrink-0">';
    alertHTML += '<i data-lucide="x" class="w-4 h-4"></i>';
    alertHTML += '</button>';
    alertHTML += '</div>';
    alertHTML += '</div>';
    
    let container = document.getElementById('alerts-container');
    container.innerHTML += alertHTML;
    
    lucide.createIcons();
    
    setTimeout(function() {
        let alertEl = document.getElementById(alertId);
        if (alertEl) {
            alertEl.classList.remove('translate-x-full');
        }
    }, 100);
    
    let dismissTime = alert.type === 'success' ? 10000 : 30000;
    setTimeout(function() {
        dismissAlert(alertId);
    }, dismissTime);
}

function dismissAlert(alertId) {
    let alertEl = document.getElementById(alertId);
    if (alertEl) {
        alertEl.classList.add('translate-x-full', 'opacity-0');
        setTimeout(function() {
            alertEl.remove();
        }, 500);
    }
}

function showCountryDetails() {
    let modal = document.getElementById('country-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(function () {
        modal.classList.add('opacity-100');
        document.getElementById('modal-content').classList.remove('scale-95');
        document.getElementById('modal-content').classList.add('scale-100');
    }, 50);

    fetch('https://restcountries.com/v3.1/alpha/' + countryCode)
        .then(function (res) { return res.json(); })
        .then(function (data) {
            let info = data[0];
            document.getElementById('modal-country-name').innerText = info.name.common;
            document.getElementById('modal-region').innerText = info.region;
            document.getElementById('modal-population').innerText = info.population.toLocaleString();

            if (info.capital) {
                document.getElementById('modal-capital').innerText = info.capital[0];
            }

            let keys = Object.keys(info.currencies);
            if (keys.length > 0) {
                document.getElementById('modal-currency').innerText = info.currencies[keys[0]].name;
            }

            document.getElementById('modal-subregion').innerText = info.subregion;
            document.getElementById('country-flag').src = info.flags.svg;
            document.getElementById('country-flag-bg').src = info.flags.svg;

            setTimeout(function () {
                countryMap.invalidateSize();
                if (info.latlng) {
                    countryMap.setView(info.latlng, 5);
                }
            }, 100);
        });
}

function closeModal() {
    let modal = document.getElementById('country-modal');
    modal.classList.remove('opacity-100');
    document.getElementById('modal-content').classList.remove('scale-100');
    document.getElementById('modal-content').classList.add('scale-95');

    setTimeout(function () {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 300);
}
