#!/usr/bin/env python3
import os
import requests
import glob

# Bot token from environment variable
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

if not BOT_TOKEN:
    print("❌ Error: TELEGRAM_BOT_TOKEN environment variable not found!")
    exit(1)

# Find the most recent photo
photo_files = glob.glob('data/media/photo_*.jpg')
if not photo_files:
    print("❌ Error: No photo files found!")
    exit(1)

# Get the most recent photo by filename (which includes timestamp)
photo_path = max(photo_files)
print(f"📸 Preparing to send photo: {photo_path}")

# Get recent updates to find chat ID
url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
response = requests.get(url)

if response.status_code != 200:
    print(f"❌ Error getting updates: {response.status_code}")
    exit(1)

data = response.json()
if not data['result']:
    print("❌ No recent messages found. Please send a message to the bot first.")
    exit(1)

# Get the most recent chat ID
chat_id = data['result'][-1]['message']['chat']['id']
print(f"✅ Found chat ID: {chat_id}")

# Send the photo
url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"

with open(photo_path, 'rb') as photo:
    files = {'photo': photo}
    data = {'chat_id': chat_id}
    
    response = requests.post(url, files=files, data=data)

if response.status_code == 200:
    print("✅ Photo sent successfully!")
    print("🎉 All done!")
else:
    print(f"❌ Error sending photo: {response.status_code}")
    print(response.text)