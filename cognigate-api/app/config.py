"""
Application configuration using Pydantic Settings.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Cognigate Engine"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"

    # API
    api_prefix: str = "/v1"
    api_key_header: str = "X-API-Key"

    # Security
    secret_key: str = "CHANGE_ME_IN_PRODUCTION"
    access_token_expire_minutes: int = 30

    # Trust Engine
    default_trust_level: int = 1
    trust_decay_rate: float = 0.01

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # Critic Pattern - AI Provider Configuration
    # Supported: "anthropic" (Claude), "openai" (GPT), "google" (Gemini), "xai" (Grok)
    critic_provider: str = "anthropic"  # Default to Claude

    # API Keys (set the one matching your provider)
    anthropic_api_key: str = ""  # Claude
    openai_api_key: str = ""     # GPT
    google_api_key: str = ""     # Gemini
    xai_api_key: str = ""        # Grok

    # Model settings per provider
    critic_model_anthropic: str = "claude-3-5-sonnet-20241022"
    critic_model_openai: str = "gpt-4o-mini"
    critic_model_google: str = "gemini-1.5-flash"
    critic_model_xai: str = "grok-2-latest"

    critic_temperature: float = 0.3
    critic_enabled: bool = True

    # External Services (future)
    # database_url: str = ""
    # redis_url: str = ""


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
