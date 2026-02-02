#!/usr/bin/env python3
"""
Telegram Manager - Easy commands for managing Telegram permissions and sending
"""

from enhanced_telegram_sender import TelegramSender
import sys

def main():
    sender = TelegramSender()
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python telegram_manager.py send                    # Send latest photo")
        print("  python telegram_manager.py enable [chat_id]        # Enable auto-approve")
        print("  python telegram_manager.py disable [chat_id]       # Disable auto-approve") 
        print("  python telegram_manager.py permissions             # Show permissions")
        print("  python telegram_manager.py setup                   # Initial setup")
        return
    
    command = sys.argv[1].lower()
    
    if command == "send":
        result = sender.send_photo_with_permission()
        print(result)
    
    elif command == "enable":
        chat_id = sys.argv[2] if len(sys.argv) > 2 else sender.get_recent_chat_id()
        if chat_id:
            result = sender.set_auto_approve(chat_id, True)
            print(result)
        else:
            print("❌ Could not determine chat ID")
    
    elif command == "disable":
        chat_id = sys.argv[2] if len(sys.argv) > 2 else sender.get_recent_chat_id()
        if chat_id:
            result = sender.set_auto_approve(chat_id, False)
            print(result)
        else:
            print("❌ Could not determine chat ID")
    
    elif command == "permissions":
        print(sender.show_permissions())
    
    elif command == "setup":
        chat_id = sender.get_recent_chat_id()
        if chat_id:
            sender.set_auto_approve(chat_id, True)
            print(f"✅ Auto-approve enabled for your chat ({chat_id})")
            print("You can now use 'python telegram_manager.py send' anytime!")
        else:
            print("❌ Could not detect your chat. Send a message to the bot first.")
    
    else:
        print(f"❌ Unknown command: {command}")

if __name__ == "__main__":
    main()