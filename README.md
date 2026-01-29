# Morning Briefing System

A comprehensive automated morning briefing system that aggregates information from Google Calendar, Gmail, and weather APIs to provide a structured daily summary.

## 🌟 Features

- **📅 Calendar Integration**: Fetches today's events from Google Calendar
- **📧 Email Summary**: Summarizes unread emails from the last 24 hours
- **🌤️ Weather Updates**: Current conditions and forecast for the day
- **🤖 AI-Powered**: Intelligent summarization and prioritization
- **📱 Flexible Output**: Text, JSON, and HTML formats
- **⚡ Automated**: Ready for scheduling via cron or task scheduler

## 📋 Table of Contents

1. [Installation](#installation)
2. [API Setup](#api-setup)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Scheduling](#scheduling)
6. [Troubleshooting](#troubleshooting)
7. [Sample Output](#sample-output)

## 🚀 Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager
- Internet connection

### Install Dependencies

```bash
pip install -r requirements.txt
```

## 🔧 API Setup

### 1. Google Calendar API Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select existing one
3. **Enable Google Calendar API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. **Create Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Desktop Application"
   - Download the credentials JSON file
   - Rename to `google_credentials.json` and place in project root

5. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Add your email as a test user
   - Add scopes: `https://www.googleapis.com/auth/calendar.readonly`

### 2. Gmail API Setup

1. **Enable Gmail API** in the same Google Cloud project:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

2. **Update OAuth Scopes**:
   - Add scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Re-download credentials if needed

### 3. OpenWeatherMap API Setup

1. **Sign up for free**: https://openweathermap.org/api
2. **Get API Key**:
   - Go to "API Keys" in your account
   - Copy the default API key
   - Note: It may take a few minutes to activate

### 4. OpenAI API Setup (Optional)

1. **Sign up**: https://platform.openai.com/
2. **Get API Key**:
   - Go to "API Keys" section
   - Create new key
   - Note: This is optional for AI-powered summaries

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Weather API
OPENWEATHER_API_KEY=your_openweather_api_key_here

# OpenAI API (Optional - for AI summaries)
OPENAI_API_KEY=your_openai_api_key_here

# Location (Optional - will auto-detect if not provided)
DEFAULT_LOCATION=New York, NY

# Email Settings
MAX_EMAILS_TO_PROCESS=50
EMAIL_SUMMARY_LENGTH=brief  # brief, detailed, or full

# Logging
LOG_LEVEL=INFO
```

### Configuration File

The system uses `config.yaml` for detailed configuration. See [Configuration Template](#configuration-template) below.

## 🎯 Usage

### Basic Usage

```bash
# Run the complete morning briefing
python morning_briefing.py

# Run specific components only
python morning_briefing.py --calendar-only
python morning_briefing.py --email-only
python morning_briefing.py --weather-only

# Output formats
python morning_briefing.py --format json
python morning_briefing.py --format html
python morning_briefing.py --output briefing.txt
```

### Programmatic Usage

```python
from morning_briefing import MorningBriefing

# Initialize
briefing = MorningBriefing()

# Get complete briefing
result = briefing.generate_briefing()
print(result.formatted_output)

# Get individual components
calendar_events = briefing.get_calendar_events()
email_summary = briefing.get_email_summary()
weather_info = briefing.get_weather_info()
```

## ⏰ Scheduling

### Using Cron (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add line for daily 8 AM briefing
0 8 * * * /usr/bin/python3 /path/to/morning_briefing.py >> /var/log/morning_briefing.log 2>&1
```

### Using Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 8:00 AM
4. Action: Start a program
5. Program: `python.exe`
6. Arguments: `C:\path\to\morning_briefing.py`

### Using Python Schedule

```python
import schedule
import time
from morning_briefing import MorningBriefing

def run_briefing():
    briefing = MorningBriefing()
    result = briefing.generate_briefing()
    print(result.formatted_output)

schedule.every().day.at("08:00").do(run_briefing)

while True:
    schedule.run_pending()
    time.sleep(60)
```

## 🔧 Configuration Template

```yaml
# Morning Briefing Configuration
briefing:
  timezone: "America/New_York"
  output_format: "text"  # text, json, html
  include_icons: true
  
calendar:
  enabled: true
  calendars:
    - primary
    - "work@company.com"
  max_events: 20
  include_all_day: true
  
email:
  enabled: true
  max_emails: 50
  time_range_hours: 24
  priority_keywords:
    - "urgent"
    - "asap"
    - "deadline"
  exclude_promotions: true
  
weather:
  enabled: true
  include_forecast: true
  include_alerts: true
  units: "imperial"  # imperial, metric
  
ai:
  enabled: false
  model: "gpt-3.5-turbo"
  summary_style: "brief"  # brief, detailed
  
output:
  save_to_file: true
  file_path: "briefings/briefing_{date}.txt"
  email_briefing: false
  email_recipients: []

logging:
  level: "INFO"
  file: "logs/morning_briefing.log"
  max_size_mb: 10
  backup_count: 5
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem**: `google.auth.exceptions.RefreshError`
**Solution**: 
- Delete existing token files (`token_calendar.json`, `token_gmail.json`)
- Re-run the application to re-authenticate
- Ensure OAuth consent screen is properly configured

#### 2. API Quota Exceeded

**Problem**: `HttpError 403: Rate Limit Exceeded`
**Solution**:
- Reduce `max_emails` in configuration
- Add delays between API calls
- Check Google Cloud Console quotas

#### 3. Weather API Not Working

**Problem**: `Invalid API key` or `City not found`
**Solution**:
- Verify API key is active (may take 10-15 minutes)
- Check spelling of city name
- Use coordinates instead of city name

#### 4. Missing Dependencies

**Problem**: `ModuleNotFoundError`
**Solution**:
```bash
pip install -r requirements.txt --upgrade
```

#### 5. Permission Errors

**Problem**: `Permission denied` when saving files
**Solution**:
- Check file/directory permissions
- Run with appropriate user privileges
- Ensure output directory exists

### Debug Mode

Run with debug logging:
```bash
python morning_briefing.py --debug
```

### Log Files

Check logs for detailed error information:
- `logs/morning_briefing.log` - Application logs
- `logs/api_errors.log` - API-specific errors

## 📊 Sample Output

```
🌅 MORNING BRIEFING - Tuesday, January 16, 2024
═══════════════════════════════════════════════════

📅 TODAY'S CALENDAR (5 events)
───────────────────────────────────────
• 9:00 AM - Team Standup (Conference Room A)
• 10:30 AM - Client Presentation (Zoom)
• 12:00 PM - Lunch with Sarah
• 2:00 PM - Project Review (Teams)
• 4:30 PM - 1:1 with Manager

⚠️  CONFLICTS: None detected

📧 EMAIL SUMMARY (12 unread emails)
───────────────────────────────────────
🔥 HIGH PRIORITY (3 emails):
• [URGENT] Q4 Report Due Today - boss@company.com
• Meeting Reschedule Request - client@bigcorp.com
• Server Alert: High CPU Usage - monitoring@company.com

📋 MEDIUM PRIORITY (6 emails):
• Weekly Newsletter - marketing@company.com
• Code Review Request - developer@company.com
• [Info] Policy Update - hr@company.com

📄 LOW PRIORITY (3 emails):
• LinkedIn notifications and promotional emails

🌤️ WEATHER UPDATE - New York, NY
───────────────────────────────────────
Currently: 28°F | Partly Cloudy ⛅
Feels like: 22°F

TODAY'S FORECAST:
Morning: 25°F - Snow possible ❄️
Afternoon: 32°F - Partly cloudy ⛅
Evening: 29°F - Clear 🌙

⚠️ WEATHER ALERT: Winter weather advisory in effect

💡 RECOMMENDATIONS:
• Dress warmly - temperatures below freezing
• Allow extra travel time due to weather
• Prepare for client presentation at 10:30 AM
• Address urgent Q4 report before EOD

───────────────────────────────────────
Generated at: 8:00 AM EST | Runtime: 2.3 seconds
```

## 📝 Setup Checklist

- [ ] Python 3.8+ installed
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Google Cloud project created
- [ ] Google Calendar API enabled
- [ ] Gmail API enabled
- [ ] OAuth credentials downloaded and renamed
- [ ] OpenWeatherMap API key obtained
- [ ] `.env` file created with API keys
- [ ] `config.yaml` configured for your needs
- [ ] Initial test run successful
- [ ] Scheduling configured (cron/Task Scheduler)
- [ ] Log directory permissions set
- [ ] Backup/monitoring configured (optional)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.