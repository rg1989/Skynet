"""Configuration settings for the voice service."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class TTSSettings(BaseSettings):
    """Text-to-Speech settings."""

    model_config = SettingsConfigDict(env_prefix="TTS_")

    voice: str = Field(default="af_heart", description="Kokoro voice to use")
    speed: float = Field(default=1.1, description="Speech speed multiplier")
    output_sample_rate: int = Field(default=24000, description="Output audio sample rate")


class WakeWordSettings(BaseSettings):
    """Wake word detection settings."""

    model_config = SettingsConfigDict(env_prefix="WAKEWORD_")

    enabled: bool = Field(default=False, description="Enable wake word detection")
    model: str = Field(default="hey_jarvis", description="Wake word model name")
    threshold: float = Field(default=0.5, description="Detection confidence threshold (0-1)")
    timeout_seconds: int = Field(default=10, description="Seconds to stay active after wake word")
    debounce_ms: int = Field(default=1000, description="Milliseconds before allowing re-trigger")


class ServerSettings(BaseSettings):
    """Server settings."""

    model_config = SettingsConfigDict(env_prefix="VOICE_")

    host: str = Field(default="127.0.0.1", description="Server host")
    port: int = Field(default=4202, description="Server port")


class Settings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    tts: TTSSettings = Field(default_factory=TTSSettings)
    wakeword: WakeWordSettings = Field(default_factory=WakeWordSettings)
    server: ServerSettings = Field(default_factory=ServerSettings)

    debug: bool = Field(default=False, description="Enable debug logging")


# Global settings instance
settings = Settings()
