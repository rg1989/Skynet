# 🌅 Morning Briefing System - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Setup Instructions for Each API](#setup-instructions-for-each-api)
3. [Installation Requirements](#installation-requirements)
4. [Configuration](#configuration)
5. [Usage Examples](#usage-examples)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Scheduling Options](#scheduling-options)

## Overview

The Morning Briefing System is an automated Python application that aggregates your daily essential information from multiple sources:
- **📅 Google Calendar**: Today's events and meetings
- **📧 Gmail**: Unread emails from the last 24 hours
- **🌤️ Weather**: Current conditions and today's forecast
- **📊 Compiled Report**: Formatted briefing ready for consumption

---

## Setup Instructions for Each API

### 🔐 Google Calendar & Gmail API Setup

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to "APIs & Services" → "Library"

#### Step 2: Enable Required APIs
```bash
# Enable these APIs in Google Cloud Console:
- Google Calendar API
- Gmail API
```

#### Step 3: Create Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Desktop Application"
4. Download the JSON file and rename to `credentials.json`
5. Place in your project root directory

#### Step 4: Set OAuth Scopes
Required scopes for the application:
```python
SCOPES = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly'
]
```

#### Step 5: Security Configuration
1. Add test users in OAuth consent screen
2. For production: Submit for verification
3. Keep `credentials.json` secure and never commit to version control

### 🌤️ OpenWeatherMap API Setup

#### Step 1: Create Free Account
1. Visit [OpenWeatherMap.org](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to "API keys" section

#### Step 2: Generate API Key
1. Create a new API key
2. Copy the key (takes up to 10 minutes to activate)
3. Free tier includes:
   - 1,000 API calls/day
   - Current weather data
   - 5-day forecast
   - Weather alerts

#### Step 3: Test API Access
```bash
curl "https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY"
```

---

## Installation Requirements

### System Requirements
- **Python**: 3.8 or higher
- **Operating System**: Windows, macOS, or Linux
- **Internet Connection**: Required for API access
- **Storage**: ~100MB for dependencies

### Python Package Installation

#### Option 1: Using pip
```bash
pip install -r requirements.txt
```

#### Option 2: Using conda
```bash
conda env create -f environment.yml
conda activate morning-briefing
```

#### Option 3: Using pipenv
```bash
pipenv install
pipenv shell
```

### Required Packages
```txt
google-auth==2.23.4
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
google-api-python-client==2.108.0
requests==2.31.0
python-dateutil==2.8.2
pytz==2023.3
pyyaml==6.0.1
colorama==0.4.6
rich==13.6.0
openai==1.3.0  # Optional: for AI summarization
```

---

## Configuration

### Environment Variables
Create a `.env` file in your project root:

```bash
# Weather API
OPENWEATHER_API_KEY=your_openweather_api_key_here

# Optional: OpenAI for email summarization
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Custom settings
DEFAULT_LOCATION=New York,NY,US
TIMEZONE=America/New_York
DEBUG_MODE=false
LOG_LEVEL=INFO
```

### Configuration File Template
See `config.yaml` for detailed configuration options.

---

## Usage Examples

### Basic Usage
```python
from morning_briefing import MorningBriefing

# Initialize the briefing system
briefing = MorningBriefing()

# Generate complete briefing
report = briefing.generate_briefing()
print(report)
```

### Custom Configuration
```python
from morning_briefing import MorningBriefing

# Custom settings
config = {
    'location': 'San Francisco,CA,US',
    'timezone': 'America/Los_Angeles',
    'email_limit': 20,
    'weather_units': 'metric'
}

briefing = MorningBriefing(config=config)
report = briefing.generate_briefing()
```

### Individual Components
```python
from morning_briefing import WeatherChecker, GmailSummarizer, CalendarFetcher

# Weather only
weather = WeatherChecker()
weather_report = weather.get_morning_briefing()

# Emails only
gmail = GmailSummarizer()
email_summary = gmail.get_unread_summary()

# Calendar only
calendar = CalendarFetcher()
events = calendar.get_today_events()
```

### Command Line Usage
```bash
# Generate full briefing
python morning_briefing.py

# Weather only
python morning_briefing.py --weather-only

# Custom location
python morning_briefing.py --location "Boston,MA,US"

# Save to file
python morning_briefing.py --output briefing.txt

# Debug mode
python morning_briefing.py --debug
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 🔐 Authentication Issues

**Problem**: `google.auth.exceptions.RefreshError`
```bash
Solution:
1. Delete token.json file
2. Re-run authentication flow
3. Ensure credentials.json is valid
4. Check OAuth consent screen configuration
```

**Problem**: Gmail API access denied
```bash
Solution:
1. Verify Gmail API is enabled
2. Check OAuth scopes in credentials
3. Ensure Gmail account has API access
4. Re-authenticate with correct permissions
```

#### 🌤️ Weather API Issues

**Problem**: `401 Unauthorized - Invalid API key`
```bash
Solution:
1. Check API key is correct
2. Wait 10 minutes after creating new key
3. Verify API key is active in OpenWeatherMap dashboard
4. Check environment variable spelling
```

**Problem**: Location not found
```bash
Solution:
1. Use format: "City,StateCode,CountryCode"
2. Example: "New York,NY,US"
3. Try latitude,longitude coordinates
4. Check for typos in city names
```

#### 📧 Email Processing Issues

**Problem**: No emails found (but unread emails exist)
```bash
Solution:
1. Check timezone settings
2. Verify 24-hour time window calculation
3. Check Gmail label filters
4. Ensure proper date formatting
```

**Problem**: Rate limiting errors
```bash
Solution:
1. Implement exponential backoff
2. Reduce API call frequency
3. Use batch requests where possible
4. Check quota limits in Google Console
```

#### 🐛 General Debugging

**Enable Debug Mode**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Check Logs**:
```bash
tail -f logs/morning_briefing.log
```

**Test Components Individually**:
```python
# Test each component separately
briefing = MorningBriefing()
briefing.test_weather()
briefing.test_calendar()
briefing.test_email()
```

### Error Code Reference

| Error Code | Component | Description | Solution |
|------------|-----------|-------------|----------|
| `AUTH_001` | Calendar | Invalid credentials | Re-authenticate |
| `AUTH_002` | Gmail | Scope insufficient | Update OAuth scopes |
| `WEATHER_001` | Weather | API key invalid | Check API key |
| `WEATHER_002` | Weather | Location not found | Fix location format |
| `EMAIL_001` | Gmail | No unread emails | Check filters |
| `CAL_001` | Calendar | No events today | Normal behavior |
| `NET_001` | All | Network timeout | Check internet connection |

### Performance Optimization

#### Caching Strategies
```python
# Enable caching for faster subsequent runs
config = {
    'cache_enabled': True,
    'cache_duration': 300,  # 5 minutes
    'cache_location': '/tmp/briefing_cache'
}
```

#### Parallel Processing
```python
# Enable concurrent API calls
config = {
    'parallel_processing': True,
    'max_workers': 3
}
```

### Security Best Practices

1. **Never commit credentials**: Add to `.gitignore`
2. **Use environment variables**: For API keys
3. **Regular key rotation**: Update API keys monthly
4. **Minimal permissions**: Use least privilege OAuth scopes
5. **Secure storage**: Encrypt sensitive configuration

---

## Scheduling Options

### 🕐 Automated Scheduling

#### Linux/macOS - Cron
```bash
# Edit crontab
crontab -e

# Run every day at 7:00 AM
0 7 * * * /usr/bin/python3 /path/to/morning_briefing.py

# Run every weekday at 6:30 AM
30 6 * * 1-5 /usr/bin/python3 /path/to/morning_briefing.py

# Email results
0 7 * * * /usr/bin/python3 /path/to/morning_briefing.py | mail -s "Morning Briefing" user@example.com
```

#### Windows - Task Scheduler
```powershell
# Create scheduled task
schtasks /create /sc daily /tn "MorningBriefing" /tr "python C:\path\to\morning_briefing.py" /st 07:00

# Run on weekdays only
schtasks /create /sc weekly /d MON,TUE,WED,THU,FRI /tn "MorningBriefing" /tr "python C:\path\to\morning_briefing.py" /st 06:30
```

#### Python APScheduler
```python
from apscheduler.schedulers.blocking import BlockingScheduler
from morning_briefing import MorningBriefing

def run_briefing():
    briefing = MorningBriefing()
    report = briefing.generate_briefing()
    print(report)

scheduler = BlockingScheduler()
scheduler.add_job(run_briefing, 'cron', hour=7, minute=0)
scheduler.start()
```

### 🔄 Advanced Scheduling

#### Weekend vs Weekday Configuration
```python
import datetime

def get_weekend_config():
    if datetime.datetime.now().weekday() >= 5:  # Weekend
        return {'detailed_weather': True, 'include_leisure_calendar': True}
    else:  # Weekday
        return {'focus_work_emails': True, 'meeting_reminders': True}
```

#### Holiday Detection
```python
import holidays

def skip_on_holidays():
    us_holidays = holidays.US()
    today = datetime.date.today()
    return today not in us_holidays
```

---

## Support and Updates

### Getting Help
- 📖 **Documentation**: Check this guide first
- 🐛 **Issues**: Create GitHub issue for bugs
- 💬 **Discussions**: Community support forum
- 📧 **Contact**: support@morningbriefing.com

### Version Updates
```bash
# Check for updates
pip list --outdated

# Update specific packages
pip install --upgrade google-api-python-client

# Update all packages
pip install --upgrade -r requirements.txt
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

---

*Last Updated: November 2024*
*Version: 2.0.0*