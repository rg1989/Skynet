"""Voice service WebSocket server for Skynet.

Handles TTS synthesis and wake word detection, communicating with
the main Node.js backend via WebSocket.
"""

import asyncio
import base64
import json
from typing import Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import settings
from .tts import TextToSpeech, get_tts
from .wakeword import WakeWordDetector, WakeWordState, get_detector
from .sentencizer import StreamingSentencizer, split_into_sentences
from .markdown_filter import TTSMarkdownFilter

app = FastAPI(title="Skynet Voice Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VoiceSession:
    """Manages a voice session for a WebSocket connection."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.tts = get_tts()
        self.wakeword = get_detector()
        self.markdown_filter = TTSMarkdownFilter()
        self.sentencizer = StreamingSentencizer()
        
        # Session state
        self.tts_enabled = True
        self.tts_muted = False
        self._speaking = False
        self._current_message_id: Optional[str] = None

    async def send_json(self, data: dict) -> None:
        """Send JSON message to client."""
        try:
            await self.websocket.send_json(data)
        except Exception as e:
            print(f"[VOICE] Failed to send message: {e}")

    async def handle_message(self, message: dict) -> None:
        """Handle incoming message from Node.js backend."""
        msg_type = message.get("type")

        if msg_type == "synthesize":
            await self.handle_synthesize(message)

        elif msg_type == "set_tts_enabled":
            self.tts_enabled = message.get("enabled", True)
            print(f"[VOICE] TTS enabled: {self.tts_enabled}")

        elif msg_type == "set_tts_muted":
            self.tts_muted = message.get("muted", False)
            print(f"[VOICE] TTS muted: {self.tts_muted}")

        elif msg_type == "set_voice":
            voice = message.get("voice")
            if voice:
                try:
                    self.tts.set_voice(voice)
                    await self.send_json({
                        "type": "voice_changed",
                        "voice": voice,
                    })
                except ValueError as e:
                    await self.send_json({
                        "type": "error",
                        "error": str(e),
                    })

        elif msg_type == "set_speed":
            speed = message.get("speed", 1.0)
            self.tts.set_speed(speed)

        elif msg_type == "set_wakeword_settings":
            self.wakeword.update_settings(
                enabled=message.get("enabled"),
                model=message.get("model"),
                threshold=message.get("threshold"),
                timeout_seconds=message.get("timeoutSeconds"),
            )
            if message.get("enabled"):
                await asyncio.get_event_loop().run_in_executor(
                    None, self.wakeword.preload_model
                )
            await self.send_json({
                "type": "wakeword_settings",
                **self.wakeword.get_settings(),
            })

        elif msg_type == "get_settings":
            await self.send_json({
                "type": "settings",
                "tts": {
                    "enabled": self.tts_enabled,
                    "muted": self.tts_muted,
                    "voice": self.tts.voice,
                    "speed": self.tts.speed,
                    "voices": TextToSpeech.list_voices(),
                },
                "wakeword": self.wakeword.get_settings(),
            })

        elif msg_type == "get_voices":
            await self.send_json({
                "type": "voices",
                "voices": TextToSpeech.list_voices(),
            })

        elif msg_type == "get_wakeword_models":
            await self.send_json({
                "type": "wakeword_models",
                "models": WakeWordDetector.get_available_models(),
            })

        elif msg_type == "stop_speaking":
            self._speaking = False
            self.wakeword.set_speaking(False)

        elif msg_type == "set_processing":
            self.wakeword.set_processing(message.get("processing", False))

        elif msg_type == "set_listening":
            self.wakeword.set_listening()
            await self.send_json({
                "type": "wake_status",
                "state": self.wakeword.state.value,
            })

    async def handle_audio_chunk(self, audio_data: bytes) -> None:
        """Handle incoming audio chunk for wake word detection."""
        if not self.wakeword.enabled:
            return

        # Convert bytes to numpy array (expecting Int16 PCM)
        audio_chunk = np.frombuffer(audio_data, dtype=np.int16)

        # Process through wake word detector
        result = self.wakeword.process(audio_chunk)

        # If state changed, notify
        if result.detected:
            print(f"[VOICE] Wake word detected: {result.model_name} (confidence: {result.confidence:.3f})")
            await self.send_json({
                "type": "wake_status",
                "state": "active",
                "detected": True,
                "confidence": result.confidence,
            })

    async def handle_synthesize(self, message: dict) -> None:
        """Handle TTS synthesis request."""
        text = message.get("text", "")
        message_id = message.get("messageId")
        is_final = message.get("isFinal", False)

        # Skip if TTS disabled or muted
        if not self.tts_enabled or self.tts_muted:
            if is_final:
                await self.send_json({
                    "type": "tts_complete",
                    "messageId": message_id,
                })
            return

        if not text.strip():
            if is_final:
                await self.send_json({
                    "type": "tts_complete",
                    "messageId": message_id,
                })
            return

        self._current_message_id = message_id
        self._speaking = True
        self.wakeword.set_speaking(True)

        # Notify TTS started
        await self.send_json({
            "type": "tts_start",
            "messageId": message_id,
        })

        try:
            # Reset filter for new message
            if message_id != self._current_message_id:
                self.markdown_filter.reset()
                self.sentencizer.reset()

            # Split into sentences
            sentences = split_into_sentences(text)

            for sentence in sentences:
                if not self._speaking:
                    break

                # Filter markdown
                filtered = self.markdown_filter.filter_for_tts(sentence)
                if not filtered:
                    continue

                # Synthesize
                segment = await self.tts.synthesize_async(filtered)

                if segment.audio.size == 0:
                    continue

                # Send audio to client
                await self.send_json({
                    "type": "tts_audio",
                    "audio": segment.to_base64(),
                    "sampleRate": segment.sample_rate,
                    "duration": segment.duration_seconds,
                    "messageId": message_id,
                })

                # Small delay to prevent overwhelming the client
                await asyncio.sleep(0.01)

        except Exception as e:
            print(f"[VOICE] TTS error: {e}")
            await self.send_json({
                "type": "error",
                "error": f"TTS failed: {str(e)}",
            })

        finally:
            self._speaking = False
            self.wakeword.set_speaking(False)
            self.wakeword.set_listening()

            if is_final:
                await self.send_json({
                    "type": "tts_complete",
                    "messageId": message_id,
                })


# Active sessions
sessions: dict[str, VoiceSession] = {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for voice service."""
    await websocket.accept()
    session_id = str(id(websocket))
    session = VoiceSession(websocket)
    sessions[session_id] = session

    print(f"[VOICE] Client connected: {session_id}")

    # Send initial settings
    await session.send_json({
        "type": "connected",
        "sessionId": session_id,
    })

    try:
        while True:
            # Receive message (can be text or binary)
            message = await websocket.receive()

            if "text" in message:
                # JSON message
                try:
                    data = json.loads(message["text"])
                    await session.handle_message(data)
                except json.JSONDecodeError as e:
                    print(f"[VOICE] Invalid JSON: {e}")

            elif "bytes" in message:
                # Binary audio data
                await session.handle_audio_chunk(message["bytes"])

    except WebSocketDisconnect:
        print(f"[VOICE] Client disconnected: {session_id}")

    except Exception as e:
        print(f"[VOICE] WebSocket error: {e}")

    finally:
        if session_id in sessions:
            del sessions[session_id]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "voice"}


@app.get("/api/voices")
async def get_voices():
    """Get available TTS voices."""
    return {"voices": TextToSpeech.list_voices()}


@app.get("/api/wakeword/models")
async def get_wakeword_models():
    """Get available wake word models."""
    return {"models": WakeWordDetector.get_available_models()}


def main():
    """Run the voice service server."""
    print(f"[VOICE] Starting voice service on {settings.server.host}:{settings.server.port}")
    uvicorn.run(
        app,
        host=settings.server.host,
        port=settings.server.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
