#!/usr/bin/env python3
"""
Example usage of the Google Calendar Fetcher
Shows different ways to use the calendar fetching functionality.
"""

from google_calendar_fetcher import GoogleCalendarFetcher, generate_summary
from datetime import datetime
import json

def example_basic_usage():
    """Basic example - fetch today's events from primary calendar."""
    print("📅 Basic Usage Example")
    print("-" * 30)
    
    # Create fetcher instance
    fetcher = GoogleCalendarFetcher()
    
    # Authenticate (will use existing token if available)
    if fetcher.authenticate():
        # Fetch today's events
        events = fetcher.get_today_events()
        
        if events is not None:
            summary = generate_summary(events)
            print(f"Found: {summary['summary']}")
            
            # Print first 3 events
            for event in summary['events'][:3]:
                print(f"  • {event['title']} at {event['time']}")
        else:
            print("Failed to fetch events")
    else:
        print("Authentication failed")

def example_multiple_calendars():
    """Example - fetch from multiple calendars."""
    print("\n📅 Multiple Calendars Example")
    print("-" * 35)
    
    fetcher = GoogleCalendarFetcher()
    
    if fetcher.authenticate():
        # First, list available calendars
        calendars = fetcher.list_calendars()
        
        if calendars:
            print("Available calendars:")
            for cal in calendars[:5]:  # Show first 5
                print(f"  • {cal['summary']}")
            
            # Fetch from primary + first secondary calendar
            calendar_ids = ['primary']
            if len(calendars) > 1:
                secondary_cal = next((c for c in calendars if not c.get('primary')), None)
                if secondary_cal:
                    calendar_ids.append(secondary_cal['id'])
            
            # Fetch from multiple calendars
            all_events = fetcher.get_multiple_calendars(calendar_ids)
            
            total_events = sum(len(events) for events in all_events.values())
            print(f"\nTotal events across calendars: {total_events}")
            
            for cal_id, events in all_events.items():
                cal_name = cal_id if cal_id == 'primary' else 'Secondary'
                print(f"  {cal_name}: {len(events)} events")

def example_custom_timezone():
    """Example - fetch events with custom timezone."""
    print("\n📅 Custom Timezone Example")
    print("-" * 32)
    
    fetcher = GoogleCalendarFetcher()
    
    if fetcher.authenticate():
        # Fetch with specific timezone
        events = fetcher.get_today_events(timezone_str='America/New_York')
        
        if events is not None:
            summary = generate_summary(events)
            print(f"Events in Eastern Time: {summary['summary']}")

def example_json_export():
    """Example - export events as structured JSON."""
    print("\n📅 JSON Export Example")
    print("-" * 25)
    
    fetcher = GoogleCalendarFetcher()
    
    if fetcher.authenticate():
        events = fetcher.get_today_events()
        
        if events is not None:
            summary = generate_summary(events)
            
            # Create exportable data
            export_data = {
                'date': datetime.now().isoformat(),
                'timezone': 'UTC',
                'calendar_summary': summary,
                'raw_events': events
            }
            
            # Save to file
            filename = f"calendar_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            with open(filename, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            print(f"Calendar data exported to: {filename}")
            print(f"Summary: {summary['summary']}")

if __name__ == "__main__":
    print("🚀 Google Calendar Fetcher Examples")
    print("=" * 40)
    
    try:
        example_basic_usage()
        example_multiple_calendars()
        example_custom_timezone()
        example_json_export()
        
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"\nError running examples: {e}")
        print("Make sure you have credentials.json in this directory.")