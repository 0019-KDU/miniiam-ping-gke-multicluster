# 🔐 Environment Variables Configuration Guide

This project uses `.env` files to manage configuration and sensitive data like API keys.

## 📁 Environment Files

### Root `.env` File
Location: `d:\devops94\miniiam-ping-gke-multicluster\.env`

Contains shared configuration for all services:
```env
# OpenWeather API Configuration
OPENWEATHER_API_KEY=f2f0d40bb2beaf83b396318ee2bb419c
OPENWEATHER_BASE_URL=http://api.openweathermap.org/data/2.5/weather

# Backend Configuration
FLASK_ENV=production
FLASK_DEBUG=False
LOG_LEVEL=INFO

# Asia Backend Configuration
ASIA_REGION=Asia
ASIA_CITY=Tokyo
ASIA_PORT=5001

# EU Backend Configuration
EU_REGION=EU
EU_CITY=Berlin
EU_PORT=5002

# Frontend Configuration
FRONTEND_PORT=8080
```

### Backend-Specific `.env` Files

**Asia Backend** (`backend-asia/.env`):
```env
OPENWEATHER_API_KEY=f2f0d40bb2beaf83b396318ee2bb419c
OPENWEATHER_BASE_URL=http://api.openweathermap.org/data/2.5/weather
REGION=Asia
CITY=Tokyo
PORT=5001
FLASK_ENV=production
LOG_LEVEL=INFO
```

**EU Backend** (`backend-eu/.env`):
```env
OPENWEATHER_API_KEY=f2f0d40bb2beaf83b396318ee2bb419c
OPENWEATHER_BASE_URL=http://api.openweathermap.org/data/2.5/weather
REGION=EU
CITY=Berlin
PORT=5002
FLASK_ENV=production
LOG_LEVEL=INFO
```

## 🚀 Usage

### Local Development (Python)

The backends now automatically load `.env` files using `python-dotenv`:

```bash
cd backend-asia
python app.py  # Automatically loads backend-asia/.env
```

### Docker Compose

Docker Compose uses the `.env` files automatically:

```bash
# Uses backend-asia/.env and backend-eu/.env
docker-compose up
```

### Manual Override

You can override environment variables:

```bash
# Override city for Asia backend
CITY=Seoul python backend-asia/app.py

# Override port for EU backend
PORT=5003 python backend-eu/app.py
```

## 🔧 Customization

### Change API Key

Edit the `.env` files and update:
```env
OPENWEATHER_API_KEY=your_new_api_key_here
```

### Change Cities

**For Asia Backend:**
```env
# In backend-asia/.env
CITY=Seoul
# or
CITY=Singapore
# or
CITY=Mumbai
```

**For EU Backend:**
```env
# In backend-eu/.env
CITY=Paris
# or
CITY=London
# or
CITY=Madrid
```

### Change Ports

```env
# In backend-asia/.env
PORT=5003

# In backend-eu/.env
PORT=5004
```

Then update `weather-dashboard/weather.js`:
```javascript
const BACKEND_ENDPOINTS = {
    asia: 'http://localhost:5003/weather',
    eu: 'http://localhost:5004/weather'
};
```

### Add New Region

1. **Create new backend directory:**
   ```bash
   cp -r backend-asia backend-americas
   ```

2. **Create `.env` file:**
   ```env
   # backend-americas/.env
   OPENWEATHER_API_KEY=f2f0d40bb2beaf83b396318ee2bb419c
   OPENWEATHER_BASE_URL=http://api.openweathermap.org/data/2.5/weather
   REGION=Americas
   CITY=New York
   PORT=5003
   FLASK_ENV=production
   LOG_LEVEL=INFO
   ```

3. **Add to docker-compose.yml:**
   ```yaml
   backend-americas:
     build:
       context: ./backend-americas
     ports:
       - "5003:5003"
     env_file:
       - ./backend-americas/.env
   ```

## 🔒 Security Best Practices

### ✅ DO:
- Keep `.env` files in `.gitignore`
- Use `.env.example` as a template
- Rotate API keys regularly
- Use different keys for dev/prod
- Set restrictive file permissions on `.env` files

### ❌ DON'T:
- Commit `.env` files to Git
- Share `.env` files publicly
- Use production keys in development
- Hardcode secrets in source code

## 📋 Environment Variables Reference

### OpenWeather Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENWEATHER_API_KEY` | Your OpenWeather API key | Required |
| `OPENWEATHER_BASE_URL` | API base URL | `http://api.openweathermap.org/data/2.5/weather` |

### Backend Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `REGION` | Region name for the backend | `Asia` or `EU` |
| `CITY` | City to fetch weather for | `Tokyo` or `Berlin` |
| `PORT` | Port to run the backend on | `5001` or `5002` |
| `FLASK_ENV` | Flask environment | `production` |
| `FLASK_DEBUG` | Enable debug mode | `False` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Docker Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `ASIA_PORT` | Asia backend external port | `5001` |
| `EU_PORT` | EU backend external port | `5002` |
| `FRONTEND_PORT` | Frontend external port | `8080` |

## 🧪 Testing Configuration

### Verify Environment Loading

**Test Asia Backend:**
```bash
cd backend-asia
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(f'City: {os.getenv(\"CITY\")}, Port: {os.getenv(\"PORT\")}')"
```

**Test EU Backend:**
```bash
cd backend-eu
python -c "from dotenv import load_dotenv; import os; load_dotenv(); print(f'City: {os.getenv(\"CITY\")}, Port: {os.getenv(\"PORT\")}')"
```

### View All Environment Variables

```bash
# Linux/Mac
cat backend-asia/.env

# Windows
type backend-asia\.env
```

## 🔄 Migration from Hardcoded Values

Previous hardcoded configuration:
```python
OPENWEATHER_API_KEY = "f2f0d40bb2beaf83b396318ee2bb419c"
CITY = "Tokyo"
```

Now using environment variables:
```python
from dotenv import load_dotenv
load_dotenv()
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
CITY = os.getenv('CITY', 'Tokyo')  # 'Tokyo' is fallback
```

## 📦 Dependencies

Both backends now include `python-dotenv` in `requirements.txt`:
```
flask==3.0.0
flask-cors==4.0.0
requests==2.31.0
python-dotenv==1.0.0  # ← New dependency
```

Install it:
```bash
pip install -r requirements.txt
```

## 🌐 Production Deployment

For production environments, consider:

1. **Use Secret Management:**
   - AWS Secrets Manager
   - Google Secret Manager
   - Azure Key Vault
   - HashiCorp Vault

2. **Environment-Specific Files:**
   - `.env.development`
   - `.env.staging`
   - `.env.production`

3. **Kubernetes Secrets:**
   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: weather-secrets
   type: Opaque
   data:
     OPENWEATHER_API_KEY: <base64-encoded-key>
   ```

---

**All configuration is now externalized!** ✅
