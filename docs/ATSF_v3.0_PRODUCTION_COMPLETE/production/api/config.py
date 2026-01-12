"""
ATSF v3.0 - Configuration Management
=====================================

Centralized configuration for all ATSF components.

Sources (in order of precedence):
1. Environment variables
2. Config file (config.yaml)
3. Default values

Author: ATSF Development Team
Version: 3.0.0
"""

from pydantic import BaseSettings, Field
from typing import Dict, List, Optional, Any
from functools import lru_cache
import os
import yaml


class DatabaseSettings(BaseSettings):
    """Database configuration."""
    
    url: str = Field(
        default="postgresql://atsf:atsf_password@localhost:5432/atsf",
        env="DATABASE_URL"
    )
    pool_size: int = Field(default=10, env="DB_POOL_SIZE")
    max_overflow: int = Field(default=20, env="DB_MAX_OVERFLOW")
    pool_timeout: int = Field(default=30, env="DB_POOL_TIMEOUT")
    echo: bool = Field(default=False, env="DB_ECHO")


class RedisSettings(BaseSettings):
    """Redis configuration for caching."""
    
    url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    ttl_default: int = Field(default=3600, env="REDIS_TTL_DEFAULT")
    ttl_assessment: int = Field(default=300, env="REDIS_TTL_ASSESSMENT")


class SecuritySettings(BaseSettings):
    """Security configuration."""
    
    api_key_header: str = "X-API-Key"
    jwt_secret: str = Field(default="change-me-in-production", env="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    
    # Rate limiting
    rate_limit_requests: int = Field(default=1000, env="RATE_LIMIT_REQUESTS")
    rate_limit_window: int = Field(default=3600, env="RATE_LIMIT_WINDOW")
    
    # CORS
    cors_origins: List[str] = ["*"]
    cors_methods: List[str] = ["*"]
    cors_headers: List[str] = ["*"]


class TrustSettings(BaseSettings):
    """Trust score configuration."""
    
    # Ceilings by transparency tier
    ceiling_black_box: float = 0.40
    ceiling_gray_box: float = 0.55
    ceiling_white_box: float = 0.75
    ceiling_attested: float = 0.90
    ceiling_transparent: float = 0.95
    
    # Velocity caps
    velocity_cap_per_update: float = 0.10
    velocity_cap_per_hour: float = 0.25
    velocity_cap_per_day: float = 0.50
    
    # Decay
    decay_rate_per_day: float = 0.02
    decay_minimum: float = 0.0
    
    # Initial values
    initial_trust: float = 0.0
    initial_containment: str = "restricted"


class ContainmentSettings(BaseSettings):
    """Containment configuration."""
    
    # Default levels
    default_level: str = "restricted"
    
    # Capabilities by level
    level_capabilities: Dict[str, List[str]] = {
        "isolated": [],
        "sandboxed": ["memory_write"],
        "restricted": ["memory_write", "file_system", "code_execution"],
        "monitored": ["memory_write", "file_system", "code_execution", 
                     "network_access", "external_api", "database"],
        "standard": ["all"]
    }
    
    # Escalation thresholds
    escalation_risk_threshold: float = 0.6
    auto_quarantine_threshold: float = 0.8


class MonitoringSettings(BaseSettings):
    """Monitoring and alerting configuration."""
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_file: Optional[str] = Field(default=None, env="LOG_FILE")
    
    # Metrics
    metrics_enabled: bool = Field(default=True, env="METRICS_ENABLED")
    metrics_port: int = Field(default=9090, env="METRICS_PORT")
    
    # Alerting
    alert_webhook: Optional[str] = Field(default=None, env="ALERT_WEBHOOK")
    alert_email: Optional[str] = Field(default=None, env="ALERT_EMAIL")
    
    # Health checks
    health_check_interval: int = 30


class APISettings(BaseSettings):
    """API server configuration."""
    
    host: str = Field(default="0.0.0.0", env="API_HOST")
    port: int = Field(default=8000, env="API_PORT")
    workers: int = Field(default=4, env="API_WORKERS")
    reload: bool = Field(default=False, env="API_RELOAD")
    
    # Documentation
    docs_enabled: bool = True
    docs_url: str = "/docs"
    redoc_url: str = "/redoc"
    openapi_url: str = "/openapi.json"
    
    # Pagination
    default_page_size: int = 100
    max_page_size: int = 1000


class Settings(BaseSettings):
    """Main settings container."""
    
    # Application
    app_name: str = "ATSF v3.0"
    app_version: str = "3.0.0"
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")
    
    # Sub-settings
    database: DatabaseSettings = DatabaseSettings()
    redis: RedisSettings = RedisSettings()
    security: SecuritySettings = SecuritySettings()
    trust: TrustSettings = TrustSettings()
    containment: ContainmentSettings = ContainmentSettings()
    monitoring: MonitoringSettings = MonitoringSettings()
    api: APISettings = APISettings()
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


def load_yaml_config(path: str) -> Dict[str, Any]:
    """Load configuration from YAML file."""
    if os.path.exists(path):
        with open(path, 'r') as f:
            return yaml.safe_load(f)
    return {}


def export_config_template(path: str = "config.template.yaml"):
    """Export configuration template."""
    template = {
        "app": {
            "name": "ATSF v3.0",
            "version": "3.0.0",
            "environment": "production",
            "debug": False
        },
        "database": {
            "url": "postgresql://user:pass@host:5432/atsf",
            "pool_size": 10,
            "max_overflow": 20
        },
        "redis": {
            "url": "redis://localhost:6379/0",
            "ttl_default": 3600
        },
        "security": {
            "jwt_secret": "your-secret-key-here",
            "rate_limit_requests": 1000,
            "cors_origins": ["https://your-domain.com"]
        },
        "trust": {
            "ceiling_black_box": 0.40,
            "ceiling_gray_box": 0.55,
            "ceiling_white_box": 0.75,
            "velocity_cap_per_hour": 0.25
        },
        "monitoring": {
            "log_level": "INFO",
            "metrics_enabled": True,
            "alert_webhook": "https://hooks.slack.com/..."
        },
        "api": {
            "host": "0.0.0.0",
            "port": 8000,
            "workers": 4
        }
    }
    
    with open(path, 'w') as f:
        yaml.dump(template, f, default_flow_style=False)
    
    return path


# =============================================================================
# ENVIRONMENT-SPECIFIC CONFIGS
# =============================================================================

class DevelopmentSettings(Settings):
    """Development environment settings."""
    
    environment: str = "development"
    debug: bool = True
    
    class Config:
        env_file = ".env.development"


class ProductionSettings(Settings):
    """Production environment settings."""
    
    environment: str = "production"
    debug: bool = False
    
    class Config:
        env_file = ".env.production"


class TestingSettings(Settings):
    """Testing environment settings."""
    
    environment: str = "testing"
    debug: bool = True
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.database.url = "sqlite:///:memory:"
    
    class Config:
        env_file = ".env.testing"


def get_settings_for_env(env: str = None) -> Settings:
    """Get settings for specific environment."""
    env = env or os.getenv("ENVIRONMENT", "development")
    
    if env == "production":
        return ProductionSettings()
    elif env == "testing":
        return TestingSettings()
    else:
        return DevelopmentSettings()


# =============================================================================
# CONFIG VALIDATION
# =============================================================================

def validate_config(settings: Settings) -> List[str]:
    """Validate configuration and return list of issues."""
    issues = []
    
    # Check database URL
    if "change-me" in settings.database.url:
        issues.append("Database URL contains default value")
        
    # Check JWT secret
    if settings.security.jwt_secret == "change-me-in-production":
        if settings.environment == "production":
            issues.append("JWT secret must be changed in production")
            
    # Check trust ceilings
    if settings.trust.ceiling_black_box >= settings.trust.ceiling_white_box:
        issues.append("Black box ceiling should be lower than white box")
        
    # Check velocity caps
    if settings.trust.velocity_cap_per_update > settings.trust.velocity_cap_per_hour:
        issues.append("Per-update velocity cap should not exceed hourly cap")
        
    return issues


if __name__ == "__main__":
    # Print current configuration
    settings = get_settings()
    print(f"Environment: {settings.environment}")
    print(f"Debug: {settings.debug}")
    print(f"API Port: {settings.api.port}")
    
    # Validate
    issues = validate_config(settings)
    if issues:
        print("\nConfiguration issues:")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print("\nConfiguration valid!")
        
    # Export template
    export_config_template()
    print("\nExported config.template.yaml")
