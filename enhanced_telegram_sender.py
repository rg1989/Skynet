#!/usr/bin/env python3
"""
Enhanced Telegram Photo Sender with Permission Management
"""

import os
import requests
import json
import glob
from pathlib import Path

class TelegramSender:
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.base_url = f'https://api.telegram.org/bot{self.bot_token}'
        self.permissions_file = 'telegram_permissions.json'
        self.load_permissions()
    
    def load_permissions(self):
        """Load user permissions from file"""
        try:
            if os.path.exists(self.permissions_file):
                with open(self.permissions_file, 'r') as f:
                    self.permissions = json.load(f)
            else:
                self.permissions = {}
        except:
            self.permissions = {}
    
    def save_permissions(self):
        """Save permissions to file"""
        with open(self.permissions_file, 'w') as f:
            json.dump(self.permissions, f, indent=2)
    
    def set_auto_approve(self, chat_id, enabled=True):
        """Set auto-approve for a specific chat"""
        chat_id = str(chat_id)
        if chat_id not in self.permissions:
            self.permissions[chat_id] = {}
        self.permissions[chat_id]['auto_approve'] = enabled
        self.save_permissions()
        return f"Auto-approve {'enabled' if enabled else 'disabled'} for chat {chat_id}"
    
    def check_permission(self, chat_id):
        """Check if auto-approve is enabled for chat"""
        chat_id = str(chat_id)
        return self.permissions.get(chat_id, {}).get('auto_approve', False)
    
    def get_recent_chat_id(self):
        """Get the most recent chat ID from updates"""
        try:
            response = requests.get(f'{self.base_url}/getUpdates')
            updates = response.json()
            
            if updates.get('result'):
                latest_update = updates['result'][-1]
                chat_id = latest_update['message']['chat']['id']
                
                # Auto-enable permissions for first-time setup
                if not self.check_permission(chat_id):
                    print(f"Setting up auto-approve for chat {chat_id}")
                    self.set_auto_approve(chat_id, True)
                
                return chat_id
            return None
        except Exception as e:
            print(f"Error getting chat ID: {e}")
            return None
    
    def get_latest_photo(self):
        """Get the most recent photo from media directory"""
        photo_pattern = "data/media/photo_*.jpg"
        photos = glob.glob(photo_pattern)
        if photos:
            return max(photos, key=os.path.getctime)
        return None
    
    def send_photo_with_permission(self, photo_path=None, chat_id=None):
        """Send photo with automatic permission handling"""
        if not self.bot_token:
            return "❌ No Telegram bot token found in environment"
        
        if not chat_id:
            chat_id = self.get_recent_chat_id()
            if not chat_id:
                return "❌ Could not determine chat ID"
        
        if not photo_path:
            photo_path = self.get_latest_photo()
            if not photo_path:
                return "❌ No photo found to send"
        
        # Check permission
        if not self.check_permission(chat_id):
            return f"❌ Auto-approve not enabled for chat {chat_id}. Use set_auto_approve() first."
        
        # Send photo
        try:
            with open(photo_path, 'rb') as photo:
                files = {'photo': photo}
                data = {
                    'chat_id': chat_id,
                    'caption': f'📸 Auto-sent photo from Skynet'
                }
                
                response = requests.post(f'{self.base_url}/sendPhoto', files=files, data=data)
                result = response.json()
                
                if result.get('ok'):
                    return f"✅ Photo sent successfully to chat {chat_id} (auto-approved)"
                else:
                    return f"❌ Failed to send photo: {result.get('description', 'Unknown error')}"
                    
        except Exception as e:
            return f"❌ Error sending photo: {str(e)}"
    
    def show_permissions(self):
        """Display current permission settings"""
        if not self.permissions:
            return "No permissions configured yet."
        
        result = "📋 Current Telegram Permissions:\n"
        for chat_id, perms in self.permissions.items():
            auto_approve = "✅ Enabled" if perms.get('auto_approve', False) else "❌ Disabled"
            result += f"Chat {chat_id}: Auto-approve {auto_approve}\n"
        return result

# Main execution
if __name__ == "__main__":
    sender = TelegramSender()
    
    # Auto-send latest photo
    result = sender.send_photo_with_permission()
    print(result)
    
    # Show current permissions
    print("\n" + sender.show_permissions())