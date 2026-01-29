# Google Calendar API Setup Instructions

## Prerequisites

1. **Google Cloud Account**: You need a Google account and access to Google Cloud Console
2. **Python 3.7+**: Make sure you have Python installed

## Step 1: Google Cloud Console Setup

### Create a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### Enable Calendar API
1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

### Create Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (unless you're in a Google Workspace)
   - App name: "Morning Briefing Calendar"
   - User support email: Your email
   - Developer contact: Your email
   - Add your email to test users
4. For OAuth client ID:
   - Application type: **Desktop application**
   - Name: "Calendar Fetcher"
5. Download the JSON file and rename it to `credentials.json`

## Step 2: Installation

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Place Credentials
Put your `credentials.json` file in the same directory as the Python scripts.

## Step 3: First Run

### Basic Authentication
```bash
python google_calendar_fetcher.py
```

On first run:
1. A browser window will open
2. Sign in to your Google account
3. Grant permission to access your calendar
4. The token will be saved as `token.json` for future use

## Step 4: Usage Examples

### Basic Fetching
```python
from google_calendar_fetcher import GoogleCalendarFetcher

fetcher = GoogleCalendarFetcher()
if fetcher.authenticate():
    events = fetcher.get_today_events()
    if events:
        print(f"Found {len(events)} events today")
```

### Multiple Calendars
```python
calendar_ids = ['primary', 'your-other-calendar@gmail.com']
all_events = fetcher.get_multiple_calendars(calendar_ids)
```

### Custom Timezone
```python
events = fetcher.get_today_events(timezone_str='America/New_York')
```

## Troubleshooting

### Common Issues

1. **"Credentials file not found"**
   - Ensure `credentials.json` is in the script directory
   - Verify the file was downloaded correctly from Google Cloud Console

2. **"Authentication failed"**
   - Delete `token.json` and run again to re-authenticate
   - Check that the Calendar API is enabled in your project

3. **"Access denied"**
   - Verify your email is added to test users in OAuth consent screen
   - Make sure you granted calendar access during authentication

4. **"No events found"**
   - Check that you have events in your calendar for today
   - Verify the timezone setting matches your calendar's timezone

### Rate Limits
- Google Calendar API has rate limits
- The script includes automatic retry logic
- For production use, implement exponential backoff

## Security Notes

- **credentials.json**: Contains your app credentials - keep secure, don't commit to git
- **token.json**: Contains your access token - keep secure, regenerates automatically
- Add both files to your `.gitignore`

## File Structure
```
project/
├── google_calendar_fetcher.py  # Main fetcher class
├── example_usage.py           # Usage examples
├── requirements.txt           # Dependencies
├── credentials.json           # Google API credentials (you provide)
├── token.json                # OAuth token (generated)
└── setup_instructions.md     # This file
```

## Integration with Morning Briefing

This fetcher can be integrated into your morning briefing workflow:

```python
def morning_briefing_calendar():
    fetcher = GoogleCalendarFetcher()
    if fetcher.authenticate():
        events = fetcher.get_today_events()
        summary = generate_summary(events)
        return summary
    return None
```

The structured output includes all necessary information for briefing generation, including meeting attendees, locations, times, and descriptions.