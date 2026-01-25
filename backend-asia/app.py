from flask import Flask, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# OpenWeather API configuration from environment variables
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'f2f0d40bb2beaf83b396318ee2bb419c')
OPENWEATHER_BASE_URL = os.getenv('OPENWEATHER_BASE_URL', 'http://api.openweathermap.org/data/2.5/weather')

# Asia cluster configuration from environment variables
REGION = os.getenv('REGION', 'Asia')
CITY = os.getenv('CITY', 'Tokyo')
PORT = int(os.getenv('PORT', '5001'))
DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

@app.route('/weather', methods=['GET'])
def get_weather():
    """Fetch weather data for Tokyo from OpenWeather API"""
    try:
        # Make request to OpenWeather API
        params = {
            'q': CITY,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'  # Get temperature in Celsius
        }
        
        response = requests.get(OPENWEATHER_BASE_URL, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        # Extract relevant weather information
        weather_info = {
            "region": REGION,
            "city": CITY,
            "temperature": round(data['main']['temp'], 1),
            "description": data['weather'][0]['description'],
            "humidity": data['main']['humidity'],
            "wind_speed": data['wind']['speed']
        }
        
        return jsonify(weather_info), 200
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            "region": REGION,
            "city": CITY,
            "error": f"Failed to fetch weather data: {str(e)}"
        }), 500
    except KeyError as e:
        return jsonify({
            "region": REGION,
            "city": CITY,
            "error": f"Invalid response from weather API: {str(e)}"
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "region": REGION}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=DEBUG)
