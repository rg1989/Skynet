"""
Google Calendar API Integration
Fetches today's calendar events with comprehensive error handling
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import pytz

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class GoogleCalendarFetcher:
    """Fetches and processes Google Calendar events for morning briefing"""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
    
    def __init__(self, credentials_file: str = 'google_credentials.json', 
                 token_file: str = 'token_calendar.json',
                 timezone: str = 'America/New_York'):
        """
        Initialize the Google Calendar fetcher
        
        Args:
            credentials_file: Path to Google OAuth credentials JSON file
            token_file: Path to store OAuth tokens
            timezone: Timezone for date filtering
        """
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.timezone = pytz.timezone(timezone)
        self.service = None
        self.logger = logging.getLogger(__name__)
        
    def authenticate(self) -> bool:
        """
        Authenticate with Google Calendar API
        
        Returns:
            bool: True if authentication successful, False otherwise
        """
        try:
            creds = None
            
            # Load existing token
            if os.path.exists(self.token_file):
                creds = Credentials.from_authorized_user_file(self.token_file, self.SCOPES)
            
            # If no valid credentials, get new ones
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    try:
                        creds.refresh(Request())
                    except Exception as e:
                        self.logger.warning(f"Token refresh failed: {e}")
                        creds = None
                
                if not creds:
                    if not os.path.exists(self.credentials_file):
                        self.logger.error(f"Credentials file not found: {self.credentials_file}")
                        return False
                    
                    flow = InstalledAppFlow.from_client_secrets_file(
                        self.credentials_file, self.SCOPES)
                    creds = flow.run_local_server(port=0)
                
                # Save credentials for next run
                with open(self.token_file, 'w') as token:
                    token.write(creds.to_json())
            
            self.service = build('calendar', 'v3', credentials=creds)
            self.logger.info("Google Calendar authentication successful")
            return True
            
        except Exception as e:
            self.logger.error(f"Calendar authentication failed: {e}")
            return False
    
    def get_todays_events(self, calendar_ids: List[str] = None, 
                         max_events: int = 20) -> Dict[str, Any]:
        """
        Fetch today's calendar events
        
        Args:
            calendar_ids: List of calendar IDs to fetch from (None for primary)
            max_events: Maximum number of events to fetch per calendar
            
        Returns:
            Dict containing events and metadata
        """
        if not self.service:
            if not self.authenticate():
                return {"events": [], "error": "Authentication failed"}
        
        if not calendar_ids:
            calendar_ids = ['primary']
        
        all_events = []
        errors = []
        
        # Get today's date range in the specified timezone
        now = datetime.now(self.timezone)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        start_time = start_of_day.isoformat()
        end_time = end_of_day.isoformat()
        
        for calendar_id in calendar_ids:
            try:
                self.logger.info(f"Fetching events from calendar: {calendar_id}")
                
                events_result = self.service.events().list(
                    calendarId=calendar_id,
                    timeMin=start_time,
                    timeMax=end_time,
                    maxResults=max_events,
                    singleEvents=True,
                    orderBy='startTime'
                ).execute()
                
                events = events_result.get('items', [])
                
                for event in events:
                    processed_event = self._process_event(event, calendar_id)
                    if processed_event:
                        all_events.append(processed_event)
                        
                self.logger.info(f"Fetched {len(events)} events from {calendar_id}")
                
            except HttpError as e:
                error_msg = f"HTTP error fetching from {calendar_id}: {e}"
                self.logger.error(error_msg)
                errors.append(error_msg)
                
            except Exception as e:
                error_msg = f"Unexpected error fetching from {calendar_id}: {e}"
                self.logger.error(error_msg)
                errors.append(error_msg)
        
        # Sort all events by start time
        all_events.sort(key=lambda x: x.get('start_datetime', datetime.min))
        
        return {
            "events": all_events,
            "total_events": len(all_events),
            "calendars_checked": len(calendar_ids),
            "errors": errors,
            "fetched_at": now.isoformat(),
            "date": now.strftime("%A, %B %d, %Y")
        }
    
    def _process_event(self, event: Dict, calendar_id: str) -> Optional[Dict[str, Any]]:
        """
        Process and structure a calendar event
        
        Args:
            event: Raw event from Google Calendar API
            calendar_id: ID of the calendar this event belongs to
            
        Returns:
            Processed event dictionary or None if processing fails
        """
        try:
            processed = {
                "id": event.get('id', ''),
                "title": event.get('summary', 'No Title'),
                "calendar_id": calendar_id,
                "description": event.get('description', ''),
                "location": event.get('location', ''),
                "created": event.get('created', ''),
                "updated": event.get('updated', ''),
                "status": event.get('status', 'confirmed'),
                "html_link": event.get('htmlLink', ''),
                "attendees": [],
                "attachments": [],
                "meeting_link": None,
                "is_all_day": False,
                "start_datetime": None,
                "end_datetime": None,
                "duration_minutes": 0
            }
            
            # Process start and end times
            start = event.get('start', {})
            end = event.get('end', {})
            
            if 'dateTime' in start and 'dateTime' in end:
                # Timed event
                start_dt = datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end['dateTime'].replace('Z', '+00:00'))
                
                processed['start_datetime'] = start_dt
                processed['end_datetime'] = end_dt
                processed['start_time'] = start_dt.strftime("%I:%M %p")
                processed['end_time'] = end_dt.strftime("%I:%M %p")
                processed['duration_minutes'] = int((end_dt - start_dt).total_seconds() / 60)
                
            elif 'date' in start and 'date' in end:
                # All-day event
                processed['is_all_day'] = True
                processed['start_time'] = "All Day"
                processed['end_time'] = "All Day"
                processed['start_date'] = start['date']
                processed['end_date'] = end['date']
            
            # Process attendees
            attendees = event.get('attendees', [])
            for attendee in attendees:
                processed_attendee = {
                    "email": attendee.get('email', ''),
                    "display_name": attendee.get('displayName', ''),
                    "response_status": attendee.get('responseStatus', 'needsAction'),
                    "is_organizer": attendee.get('organizer', False),
                    "is_self": attendee.get('self', False)
                }
                processed['attendees'].append(processed_attendee)
            
            # Extract meeting links from description or location
            description = processed['description'].lower()
            location = processed['location'].lower()
            
            for text in [description, location]:
                if 'zoom.us' in text or 'meet.google.com' in text or 'teams.microsoft.com' in text:
                    # Extract the URL (simplified)
                    import re
                    urls = re.findall(r'https?://[^\s<>"]+', event.get('description', '') + ' ' + event.get('location', ''))
                    for url in urls:
                        if any(domain in url.lower() for domain in ['zoom.us', 'meet.google.com', 'teams.microsoft.com']):
                            processed['meeting_link'] = url
                            break
                    if processed['meeting_link']:
                        break
            
            # Process attachments
            attachments = event.get('attachments', [])
            for attachment in attachments:
                processed['attachments'].append({
                    "file_id": attachment.get('fileId', ''),
                    "title": attachment.get('title', ''),
                    "mime_type": attachment.get('mimeType', ''),
                    "icon_link": attachment.get('iconLink', '')
                })
            
            return processed
            
        except Exception as e:
            self.logger.error(f"Error processing event: {e}")
            return None
    
    def format_for_briefing(self, events_data: Dict[str, Any]) -> str:
        """
        Format calendar events for morning briefing display
        
        Args:
            events_data: Events data from get_todays_events()
            
        Returns:
            Formatted string for briefing display
        """
        events = events_data.get('events', [])
        errors = events_data.get('errors', [])
        
        if not events and not errors:
            return "📅 **NO EVENTS SCHEDULED TODAY** ✅"
        
        briefing = [f"📅 **TODAY'S CALENDAR** ({len(events)} events)"]
        briefing.append("─" * 40)
        
        if errors:
            briefing.append("⚠️ **CALENDAR ERRORS:**")
            for error in errors[:3]:  # Limit to 3 errors
                briefing.append(f"• {error}")
            briefing.append("")
        
        if events:
            current_time = datetime.now(self.timezone)
            conflicts = []
            
            for i, event in enumerate(events):
                # Format basic event info
                if event['is_all_day']:
                    time_str = "All Day"
                else:
                    time_str = f"{event['start_time']} - {event['end_time']}"
                
                title = event['title']
                location = event['location']
                
                # Add location info
                location_info = ""
                if location:
                    if event['meeting_link']:
                        location_info = f" ({location} - Virtual)"
                    else:
                        location_info = f" ({location})"
                elif event['meeting_link']:
                    location_info = " (Virtual Meeting)"
                
                # Mark if event is currently happening
                status_icon = ""
                if not event['is_all_day'] and event['start_datetime'] and event['end_datetime']:
                    if event['start_datetime'] <= current_time <= event['end_datetime']:
                        status_icon = " 🔴"
                
                briefing.append(f"• **{time_str}** - {title}{location_info}{status_icon}")
                
                # Check for conflicts (overlapping events)
                if not event['is_all_day'] and i < len(events) - 1:
                    next_event = events[i + 1]
                    if (not next_event['is_all_day'] and 
                        event['end_datetime'] and next_event['start_datetime'] and
                        event['end_datetime'] > next_event['start_datetime']):
                        conflicts.append(f"{title} overlaps with {next_event['title']}")
            
            # Add conflict warnings
            if conflicts:
                briefing.append("")
                briefing.append("⚠️ **SCHEDULE CONFLICTS:**")
                for conflict in conflicts:
                    briefing.append(f"• {conflict}")
            
            # Add summary stats
            briefing.append("")
            total_duration = sum(e.get('duration_minutes', 0) for e in events if not e['is_all_day'])
            meetings_with_attendees = sum(1 for e in events if len(e['attendees']) > 1)
            virtual_meetings = sum(1 for e in events if e['meeting_link'])
            
            briefing.append(f"📊 **SUMMARY:** {total_duration} minutes scheduled, {meetings_with_attendees} meetings with others, {virtual_meetings} virtual")
        
        return "\n".join(briefing)
    
    def export_to_json(self, events_data: Dict[str, Any], filepath: str) -> bool:
        """
        Export events data to JSON file
        
        Args:
            events_data: Events data to export
            filepath: Path to save JSON file
            
        Returns:
            bool: True if export successful
        """
        try:
            # Convert datetime objects to strings for JSON serialization
            export_data = json.loads(json.dumps(events_data, default=str))
            
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Calendar events exported to {filepath}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export calendar events: {e}")
            return False


# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Initialize calendar fetcher
    calendar = GoogleCalendarFetcher()
    
    # Fetch today's events
    events_data = calendar.get_todays_events(['primary'])
    
    if events_data['events']:
        # Display formatted briefing
        print(calendar.format_for_briefing(events_data))
        
        # Export to JSON
        calendar.export_to_json(events_data, 'calendar_events.json')
    else:
        print("No events found or authentication failed")
        if events_data.get('errors'):
            for error in events_data['errors']:
                print(f"Error: {error}")