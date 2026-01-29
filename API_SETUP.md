# API Setup Guide 🔑

This guide walks you through setting up each API service required for the Morning Briefing System.

## 📅 Google Calendar API Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your Project ID

### Step 2: Enable Calendar API
1. Navigate to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click **Enable**

### Step 3: Create Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Configure OAuth consent screen:
   - User Type: **External** (for personal use) or **Internal** (for organization)
   - App name: "Morning Briefing System"
   - Support email: Your email
   - Authorized domains: (leave empty for testing)
4. Create OAuth Client ID:
   - Application type: **Desktop application**
   - Name: "Morning Briefing Calendar"
5. Download credentials JSON file → rename to `calendar_credentials.json`

### Step 4: Set Permissions
Required OAuth scopes:
- `https://www.googleapis.com/auth/calendar.readonly`

### Step 5: Environment Setup
```bash
export GOOGLE_CALENDAR_CREDENTIALS_FILE="path/to/calendar_credentials.json"
```

---

## 📧 Gmail API Setup

### Step 1: Enable Gmail API
1. In the same Google Cloud project
2. Go to **APIs & Services** → **Library**
3. Search for "Gmail API"
4. Click **Enable**

### Step 2: Create Gmail Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Desktop application**
4. Name: "Morning Briefing Gmail"
5. Download credentials JSON file → rename to `gmail_credentials.json`

### Step 3: Set Gmail Permissions
Required OAuth scopes:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify` (for marking as read)

### Step 4: Environment Setup
```bash
export GOOGLE_GMAIL_CREDENTIALS_FILE="path/to/gmail_credentials.json"
```

### ⚠️ Gmail API Limitations
- **Free Quota**: 1 billion quota units/day
- **Rate Limits**: 250 quota units/user/second
- **Batch Requests**: Up to 100 requests per batch

---

## 🌤️ OpenWeatherMap API Setup

### Step 1: Create Account
1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for free account
3. Verify your email

### Step 2: Get API Key
1. Go to **API Keys** tab in your account
2. Copy your default API key
3. **Note**: New keys may take up to 2 hours to activate

### Step 3: Choose Plan
**Free Tier Includes:**
- 1,000 API calls/day
- Current weather data
- 5-day/3-hour forecast
- 16-day daily forecast

**Paid Plans Available:**
- More API calls
- Historical data
- Weather maps
- Higher frequency updates

### Step 4: Environment Setup
```bash
export OPENWEATHER_API_KEY="your-api-key-here"
```

### 📊 API Endpoints Used
- **Current Weather**: `https://api.openweathermap.org/data/2.5/weather`
- **5-Day Forecast**: `https://api.openweathermap.org/data/2.5/forecast`
- **Geocoding**: `https://api.openweathermap.org/geo/1.0/direct`

---

## 🤖 OpenAI API Setup (Optional)

For enhanced email summarization with AI.

### Step 1: Create Account
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up and verify account
3. Add payment method (required for API access)

### Step 2: Get API Key
1. Go to **API Keys** section
2. Click **Create new secret key**
3. Copy and secure your key
4. **Important**: Never commit API keys to version control

### Step 3: Environment Setup
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

### 💰 Pricing (as of 2024)
- **GPT-3.5 Turbo**: $0.0015/1K input tokens, $0.002/1K output tokens
- **GPT-4**: $0.03/1K input tokens, $0.06/1K output tokens
- **Typical Usage**: ~$0.10-0.50 per day for morning briefings

---

## 🛡️ Security Best Practices

### Environment Variables
Create a `.env` file (never commit to git):
```bash
# Google APIs
GOOGLE_CALENDAR_CREDENTIALS_FILE="/path/to/calendar_credentials.json"
GOOGLE_GMAIL_CREDENTIALS_FILE="/path/to/gmail_credentials.json"

# Weather API
OPENWEATHER_API_KEY="your-openweather-key"

# AI APIs (optional)
OPENAI_API_KEY="your-openai-key"
```

### Credential Files
- Store JSON credential files outside of project directory
- Set appropriate file permissions: `chmod 600 *.json`
- Never commit credential files to version control

### API Key Rotation
- Rotate API keys every 90 days
- Monitor API usage for unusual activity
- Use separate keys for development/production

---

## ✅ Verification Steps

### Test Google Calendar API
```bash
python -c "
from src.calendar_fetcher import GoogleCalendarFetcher
cal = GoogleCalendarFetcher()
events = cal.get_todays_events()
print(f'Found {len(events)} events')
"
```

### Test Gmail API
```bash
python -c "
from src.email_summarizer import GmailSummarizer
gmail = GmailSummarizer()
emails = gmail.get_unread_emails_24h()
print(f'Found {len(emails)} unread emails')
"
```

### Test Weather API
```bash
python -c "
from src.weather_checker import WeatherChecker
weather = WeatherChecker()
current = weather.get_current_weather()
print(f'Weather: {current}')
"
```

---

## 🔗 Additional Resources

- [Google Calendar API Documentation](https://developers.google.com/calendar/api)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OpenWeatherMap API Documentation](https://openweathermap.org/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

## ❓ Need Help?

If you encounter issues during API setup:
1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Verify all credentials are properly configured
3. Test each API individually before running the full system
4. Check API quotas and rate limits