let map;
let countryMap;
let marker;
let city = "Colombo";
let lat = 6.9271;
let lon = 79.8612;
let countryCode = "LK";

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
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&hourly=visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto')
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
            document.getElementById('modal-population').innerText = info.population;

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
