#!/usr/bin/env python3
import requests
import os

# Get bot token from environment
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
if not BOT_TOKEN:
    print("Error: TELEGRAM_BOT_TOKEN not found in environment variables")
    exit(1)

# Photo path
photo_path = "data/media/photo_1769984864013.jpg"

# First, let's get updates to see recent chat activity and find the chat ID
def get_updates():
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        print("Recent updates:")
        for update in data.get('result', [])[-5:]:  # Show last 5 updates
            if 'message' in update:
                chat = update['message']['chat']
                print(f"Chat ID: {chat['id']}, Type: {chat['type']}, Title: {chat.get('title', 'N/A')}")
            elif 'channel_post' in update:
                chat = update['channel_post']['chat']
                print(f"Channel ID: {chat['id']}, Type: {chat['type']}, Title: {chat.get('title', 'N/A')}")
        return data.get('result', [])
    else:
        print(f"Error getting updates: {response.status_code} - {response.text}")
        return []

def send_photo(chat_id):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    
    try:
        with open(photo_path, 'rb') as photo:
            files = {'photo': photo}
            data = {'chat_id': chat_id}
            
            response = requests.post(url, data=data, files=files)
            
            if response.status_code == 200:
                print(f"Photo sent successfully to chat {chat_id}!")
                return True
            else:
                print(f"Error sending photo: {response.status_code} - {response.text}")
                return False
                
    except FileNotFoundError:
        print(f"Error: Photo file not found at {photo_path}")
        return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("Getting recent updates to find chat ID...")
    updates = get_updates()
    
    # Try to find the most recent chat ID
    if updates:
        most_recent = updates[-1]
        chat_id = None
        
        if 'message' in most_recent:
            chat_id = most_recent['message']['chat']['id']
        elif 'channel_post' in most_recent:
            chat_id = most_recent['channel_post']['chat']['id']
            
        if chat_id:
            print(f"Using most recent chat ID: {chat_id}")
            send_photo(chat_id)
        else:
            print("No suitable chat ID found in recent updates")
    else:
        print("No recent updates found")