# SkyScope - Weather Dashboard

A modern, elegant weather dashboard application that provides real-time weather information, forecasts, and geographic data for cities worldwide.

## Features

### 🌤️ Weather Information
- **Current Weather**: Real-time temperature, weather conditions, and location-based time
- **7-Day Forecast**: Extended weather predictions with high/low temperatures
- **Weather Icons**: Dynamic weather visualization with animated icons
- **Detailed Metrics**: UV index, wind status, humidity, visibility, feels-like temperature, and sunrise/sunset times

### 🗺️ Interactive Maps
- **Location Map**: Interactive map showing the searched city location
- **Country Details Modal**: Comprehensive country information including population, capital, currency, and regional data
- **Dual Map Views**: City-level and country-level map visualization

### 🔍 Search & Navigation
- **City Search**: Quick search functionality for any city worldwide
- **Auto-detection**: Defaults to Colombo, Sri Lanka on initial load
- **Loading Indicators**: Visual feedback during data fetching

## Technologies Used

- **HTML5**: Structure and semantic markup
- **CSS3**: Custom styling with glassmorphism effects
- **JavaScript (ES5)**: Core functionality and API interactions
- **Tailwind CSS**: Utility-first CSS framework
- **Leaflet.js**: Interactive mapping library
- **Lucide Icons**: Modern icon set

## APIs Integrated

1. **Open-Meteo Geocoding API**: City search and coordinate lookup
2. **Open-Meteo Weather API**: Weather data and forecasts
3. **REST Countries API**: Country information and details

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd skyscope-weather-dashboard
```

2. Open the project:
```bash
# Simply open index.html in your browser
# No build process or dependencies required
```

3. Alternatively, use a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

## File Structure

```
skyscope/
├── index.html          # Main HTML structure
├── app.js              # JavaScript logic and API calls
├── styles.css          # Custom CSS styles
└── README.md           # Project documentation
```

## Usage

1. **Search for a City**: Type any city name in the search bar and press Enter
2. **View Weather Details**: Check current conditions and 7-day forecast
3. **Explore Country Info**: Click on the country name to view detailed geographic and demographic information
4. **Navigate Maps**: Interact with the location map to explore the area

## Key Components

### Main Weather Card
Displays the primary weather information including:
- City name and country
- Current time
- Temperature with animated weather icon
- Weather description

### Today's Highlights
Six metric cards showing:
- UV Index with progress bar
- Wind speed and direction
- Sunrise and sunset times
- Humidity percentage
- Visibility distance
- Feels-like temperature

### Location Map
Interactive Leaflet map centered on the searched city with a marker indicator

### Country Modal
Pop-up overlay featuring:
- Country flag and name
- Population statistics
- Capital city
- Currency information
- Regional classification
- Country-level map view

## Customization

### Changing Default Location
Edit the initial values in `app.js`:
```javascript
let city = "Colombo";
let lat = 6.9271;
let lon = 79.8612;
let countryCode = "LK";
```

### Styling
Modify `styles.css` for custom themes or adjust Tailwind classes in `index.html`

### Map Appearance
The map uses a dark theme by default. Modify the CSS filter in `styles.css`:
```css
.dark-map-tiles {
  filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
}
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Opera

## Performance

- Lightweight and fast loading
- Minimal external dependencies
- Efficient API calls with loading states
- Smooth animations and transitions

## Future Enhancements

- [ ] Hourly forecast view
- [ ] Weather alerts and notifications
- [ ] Multiple location favorites
- [ ] Temperature unit toggle (°C/°F)
- [ ] Historical weather data
- [ ] Weather maps overlay
- [ ] Mobile app version

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Country data: [REST Countries](https://restcountries.com/)
- Maps: [Leaflet.js](https://leafletjs.com/) & [OpenStreetMap](https://www.openstreetmap.org/)
- Icons: [Lucide](https://lucide.dev/)
- Fonts: [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)

## License

This project is open source and available under the MIT License.

## Contact

For questions, suggestions, or contributions, please open an issue or submit a pull request.

---

**Enjoy tracking the weather with SkyScope! 🌤️**
