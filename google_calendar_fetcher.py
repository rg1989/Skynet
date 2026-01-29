#!/usr/bin/env python3
"""
Google Calendar Event Fetcher
Fetches today's calendar events with proper authentication and error handling.
"""

import os
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any
import logging

# Google API imports
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("Missing required packages. Install with:")
    print("pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
    exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GoogleCalendarFetcher:
    """Handles Google Calendar API authentication and event fetching."""
    
    # If modifying these scopes, delete the file token.json.
    SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
    
    def __init__(self, credentials_file: str = 'credentials.json', token_file: str = 'token.json'):
        """
        Initialize the Calendar Fetcher.
        
        Args:
            credentials_file: Path to Google API credentials JSON file
            token_file: Path to store OAuth2 token
        """
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = None
        
    def authenticate(self) -> bool:
        """
        Authenticate with Google Calendar API.
        
        Returns:
            bool: True if authentication successful, False otherwise
        """
        creds = None
        
        try:
            # Load existing token
            if os.path.exists(self.token_file):
                creds = Credentials.from_authorized_user_file(self.token_file, self.SCOPES)
            
            # If there are no (valid) credentials available, let the user log in.
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    try:
                        creds.refresh(Request())
                        logger.info("Refreshed existing credentials")
                    except Exception as e:
                        logger.warning(f"Failed to refresh credentials: {e}")
                        creds = None
                
                if not creds:
                    if not os.path.exists(self.credentials_file):
                        logger.error(f"Credentials file not found: {self.credentials_file}")
                        logger.error("Download credentials.json from Google Cloud Console")
                        return False
                    
                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.credentials_file, self.SCOPES)
                    creds = flow.run_local_server(port=0)
                    logger.info("Completed OAuth flow")
                
                # Save the credentials for the next run
                with open(self.token_file, 'w') as token:
                    token.write(creds.to_json())
                logger.info(f"Saved credentials to {self.token_file}")
            
            # Build the service
            self.service = build('calendar', 'v3', credentials=creds)
            logger.info("Successfully authenticated with Google Calendar API")
            return True
            
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return False
    
    def get_today_events(self, calendar_id: str = 'primary', 
                        timezone_str: str = 'UTC') -> Optional[List[Dict[str, Any]]]:
        """
        Fetch today's calendar events.
        
        Args:
            calendar_id: Calendar ID to fetch from ('primary' for main calendar)
            timezone_str: Timezone for date filtering (e.g., 'America/New_York', 'UTC')
            
        Returns:
            List of event dictionaries or None if error
        """
        if not self.service:
            logger.error("Not authenticated. Call authenticate() first.")
            return None
        
        try:
            # Get today's date range
            now = datetime.now(timezone.utc)
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = start_of_day + timedelta(days=1)
            
            # Format for API
            time_min = start_of_day.isoformat()
            time_max = end_of_day.isoformat()
            
            logger.info(f"Fetching events from {start_of_day.date()} ({calendar_id})")
            
            # Call the Calendar API
            events_result = self.service.events().list(
                calendarId=calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime',
                timeZone=timezone_str
            ).execute()
            
            events = events_result.get('items', [])
            logger.info(f"Found {len(events)} events for today")
            
            return events
            
        except HttpError as e:
            logger.error(f"Google Calendar API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching events: {e}")
            return None
    
    def get_multiple_calendars(self, calendar_ids: List[str], 
                              timezone_str: str = 'UTC') -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch events from multiple calendars.
        
        Args:
            calendar_ids: List of calendar IDs to fetch from
            timezone_str: Timezone for date filtering
            
        Returns:
            Dictionary mapping calendar ID to list of events
        """
        results = {}
        
        for cal_id in calendar_ids:
            logger.info(f"Fetching from calendar: {cal_id}")
            events = self.get_today_events(cal_id, timezone_str)
            if events is not None:
                results[cal_id] = events
            else:
                results[cal_id] = []
                logger.warning(f"Failed to fetch from calendar: {cal_id}")
        
        return results
    
    def list_calendars(self) -> Optional[List[Dict[str, str]]]:
        """
        List available calendars for the authenticated user.
        
        Returns:
            List of calendar info dictionaries or None if error
        """
        if not self.service:
            logger.error("Not authenticated. Call authenticate() first.")
            return None
        
        try:
            calendar_list = self.service.calendarList().list().execute()
            calendars = []
            
            for calendar in calendar_list.get('items', []):
                calendars.append({
                    'id': calendar['id'],
                    'summary': calendar.get('summary', 'Unknown'),
                    'primary': calendar.get('primary', False),
                    'access_role': calendar.get('accessRole', 'unknown')
                })
            
            return calendars
            
        except HttpError as e:
            logger.error(f"Error listing calendars: {e}")
            return None

def format_event_time(event: Dict[str, Any]) -> str:
    """Format event start/end times for display."""
    start = event['start']
    end = event['end']
    
    # Handle all-day events
    if 'date' in start:
        return "All day"
    
    # Handle timed events
    start_dt = datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
    end_dt = datetime.fromisoformat(end['dateTime'].replace('Z', '+00:00'))
    
    # Format times
    start_time = start_dt.strftime('%I:%M %p').lstrip('0')
    end_time = end_dt.strftime('%I:%M %p').lstrip('0')
    
    # Same day event
    if start_dt.date() == end_dt.date():
        return f"{start_time} - {end_time}"
    else:
        return f"{start_time} - {end_time} (+1 day)"

def extract_event_info(event: Dict[str, Any]) -> Dict[str, Any]:
    """Extract relevant information from a calendar event."""
    return {
        'id': event.get('id', ''),
        'title': event.get('summary', 'No title'),
        'description': event.get('description', ''),
        'location': event.get('location', ''),
        'time': format_event_time(event),
        'attendees': [
            {
                'email': attendee.get('email', ''),
                'name': attendee.get('displayName', attendee.get('email', '')),
                'status': attendee.get('responseStatus', 'unknown')
            }
            for attendee in event.get('attendees', [])
        ],
        'organizer': {
            'email': event.get('organizer', {}).get('email', ''),
            'name': event.get('organizer', {}).get('displayName', '')
        },
        'meeting_link': event.get('hangoutLink', ''),
        'status': event.get('status', 'confirmed'),
        'created': event.get('created', ''),
        'updated': event.get('updated', '')
    }

def generate_summary(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate a structured summary of the day's events."""
    if not events:
        return {
            'total_events': 0,
            'summary': "No events scheduled for today",
            'events': []
        }
    
    # Extract structured event info
    structured_events = [extract_event_info(event) for event in events]
    
    # Generate statistics
    total_events = len(events)
    meetings_with_attendees = sum(1 for e in structured_events if e['attendees'])
    all_day_events = sum(1 for e in events if 'date' in e.get('start', {}))
    
    # Create summary
    summary_parts = [
        f"{total_events} event{'s' if total_events != 1 else ''} today"
    ]
    
    if meetings_with_attendees > 0:
        summary_parts.append(f"{meetings_with_attendees} meeting{'s' if meetings_with_attendees != 1 else ''} with others")
    
    if all_day_events > 0:
        summary_parts.append(f"{all_day_events} all-day event{'s' if all_day_events != 1 else ''}")
    
    return {
        'total_events': total_events,
        'meetings_with_attendees': meetings_with_attendees,
        'all_day_events': all_day_events,
        'summary': ", ".join(summary_parts),
        'events': structured_events
    }

def main():
    """Main function to demonstrate calendar fetching."""
    # Initialize fetcher
    fetcher = GoogleCalendarFetcher()
    
    # Authenticate
    if not fetcher.authenticate():
        logger.error("Authentication failed. Exiting.")
        return
    
    # Optional: List available calendars
    calendars = fetcher.list_calendars()
    if calendars:
        logger.info("Available calendars:")
        for cal in calendars:
            primary_text = " (PRIMARY)" if cal['primary'] else ""
            logger.info(f"  - {cal['summary']}: {cal['id']}{primary_text}")
    
    # Fetch today's events from primary calendar
    events = fetcher.get_today_events(calendar_id='primary')
    
    if events is None:
        logger.error("Failed to fetch calendar events")
        return
    
    # Generate summary
    summary = generate_summary(events)
    
    # Print results
    print("\n" + "="*60)
    print("📅 MORNING BRIEFING - CALENDAR EVENTS")
    print("="*60)
    print(f"Date: {datetime.now().strftime('%A, %B %d, %Y')}")
    print(f"Summary: {summary['summary']}")
    print()
    
    if summary['events']:
        print("Today's Schedule:")
        print("-" * 40)
        
        for i, event in enumerate(summary['events'], 1):
            print(f"{i}. {event['title']}")
            print(f"   Time: {event['time']}")
            
            if event['location']:
                print(f"   Location: {event['location']}")
            
            if event['attendees']:
                attendee_names = [a['name'] or a['email'] for a in event['attendees']]
                print(f"   Attendees: {', '.join(attendee_names[:3])}")
                if len(attendee_names) > 3:
                    print(f"              ... and {len(attendee_names) - 3} more")
            
            if event['meeting_link']:
                print(f"   Meeting Link: {event['meeting_link']}")
            
            if event['description']:
                # Truncate long descriptions
                desc = event['description'][:100]
                if len(event['description']) > 100:
                    desc += "..."
                print(f"   Note: {desc}")
            
            print()
    else:
        print("🎉 No events scheduled - you have a free day!")
    
    print("="*60)
    
    # Save summary as JSON for other tools to use
    output_file = f"calendar_summary_{datetime.now().strftime('%Y%m%d')}.json"
    try:
        with open(output_file, 'w') as f:
            json.dump(summary, f, indent=2, default=str)
        logger.info(f"Summary saved to {output_file}")
    except Exception as e:
        logger.error(f"Failed to save summary: {e}")

def setup_credentials():
    """Helper function to guide user through credentials setup."""
    print("\n🔧 GOOGLE CALENDAR API SETUP")
    print("="*50)
    print("To use this script, you need to:")
    print()
    print("1. Go to Google Cloud Console (console.cloud.google.com)")
    print("2. Create or select a project")
    print("3. Enable the Google Calendar API")
    print("4. Create credentials (OAuth 2.0 Client ID)")
    print("5. Download the credentials as 'credentials.json'")
    print("6. Place the file in this directory")
    print()
    print("The first run will open a browser for authentication.")
    print("Your token will be saved for future use.")
    print("="*50)

if __name__ == "__main__":
    # Check if credentials exist
    if not os.path.exists('credentials.json'):
        setup_credentials()
        exit(1)
    
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise