// Configuration for backend endpoints
const BACKEND_ENDPOINTS = {
    asia: 'http://localhost:5001/weather',
    eu: 'http://localhost:5002/weather'
};

// Update interval: 5 minutes (300000 ms)
const UPDATE_INTERVAL = 300000;

/**
 * Fetch weather data from a backend endpoint
 */
async function fetchWeatherData(region, url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        return data;
    } catch (error) {
        console.error(`Error fetching weather for ${region}:`, error);
        throw error;
    }
}

/**
 * Update the UI with weather data
 */
function updateWeatherUI(region, data) {
    const prefix = region.toLowerCase();
    
    // Update status indicator
    document.getElementById(`${prefix}-status`).className = 'status-indicator status-online';
    
    // Update city name
    document.getElementById(`${prefix}-city`).textContent = data.city;
    
    // Update temperature
    document.getElementById(`${prefix}-temp`).innerHTML = 
        `${data.temperature}<span class="temperature-unit">°C</span>`;
    
    // Update description
    document.getElementById(`${prefix}-desc`).textContent = data.description;
    
    // Update details
    document.getElementById(`${prefix}-humidity`).textContent = `${data.humidity}%`;
    document.getElementById(`${prefix}-wind`).textContent = `${data.wind_speed} m/s`;
    
    // Show details section
    document.getElementById(`${prefix}-details`).style.display = 'grid';
    
    // Hide error message
    document.getElementById(`${prefix}-error`).style.display = 'none';
    
    // Remove loading class
    document.getElementById(`${prefix}-card`).classList.remove('loading');
}

/**
 * Display error message in the UI
 */
function displayError(region, message) {
    const prefix = region.toLowerCase();
    
    // Update status indicator
    document.getElementById(`${prefix}-status`).className = 'status-indicator status-offline';
    
    // Show error message
    const errorElement = document.getElementById(`${prefix}-error`);
    errorElement.textContent = `⚠️ ${message}`;
    errorElement.style.display = 'block';
    
    // Update temperature to show error
    document.getElementById(`${prefix}-temp`).textContent = '--';
    document.getElementById(`${prefix}-desc`).textContent = 'Unable to load';
    
    // Hide details section
    document.getElementById(`${prefix}-details`).style.display = 'none';
    
    // Add error class to card
    document.getElementById(`${prefix}-card`).classList.add('error');
    document.getElementById(`${prefix}-card`).classList.remove('loading');
}

/**
 * Update the last update timestamp
 */
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    document.getElementById('lastUpdate').textContent = `${dateString} at ${timeString}`;
}

/**
 * Fetch weather data for all regions
 */
async function fetchAllWeatherData() {
    console.log('Fetching weather data for all regions...');
    
    // Mark cards as loading
    document.getElementById('asia-card').classList.add('loading');
    document.getElementById('eu-card').classList.add('loading');
    
    // Fetch data from both regions in parallel
    const promises = [
        fetchWeatherData('asia', BACKEND_ENDPOINTS.asia)
            .then(data => updateWeatherUI('asia', data))
            .catch(error => displayError('asia', error.message)),
        
        fetchWeatherData('eu', BACKEND_ENDPOINTS.eu)
            .then(data => updateWeatherUI('eu', data))
            .catch(error => displayError('eu', error.message))
    ];
    
    // Wait for all requests to complete
    await Promise.allSettled(promises);
    
    // Update last update time
    updateLastUpdateTime();
    
    console.log('Weather data updated successfully');
}

/**
 * Initialize the dashboard
 */
function initDashboard() {
    console.log('Initializing Global Weather Dashboard...');
    
    // Fetch weather data immediately
    fetchAllWeatherData();
    
    // Set up automatic updates every 5 minutes
    setInterval(fetchAllWeatherData, UPDATE_INTERVAL);
    
    console.log(`Dashboard initialized. Auto-refresh every ${UPDATE_INTERVAL / 1000} seconds.`);
}

// Start the dashboard when the page loads
window.addEventListener('DOMContentLoaded', initDashboard);

// Also refresh when the page becomes visible again
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('Page became visible, refreshing data...');
        fetchAllWeatherData();
    }
});
