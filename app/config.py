"""
Application configuration using Pydantic Settings.
Loads configuration from environment variables with validation.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with environment variable validation."""
    
    # Application
    APP_NAME: str = "Azienda in Cloud ERP"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"  # development, staging, production
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = False
    
    # MongoDB Atlas (REQUIRED)
    MONGODB_ATLAS_URI: Optional[str] = None
    DB_NAME: str = "azienda_erp_db"  # Database principale - NON MODIFICARE
    MONGODB_MAX_POOL_SIZE: int = 50
    MONGODB_MIN_POOL_SIZE: int = 10
    MONGODB_TIMEOUT_MS: int = 5000
    
    # Security (REQUIRED)
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS
    ALLOWED_ORIGINS: str = "*"  # Comma-separated list or "*"
    ALLOW_CREDENTIALS: bool = True
    ALLOWED_METHODS: str = "*"
    ALLOWED_HEADERS: str = "*"
    
    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 50
    UPLOAD_FOLDER: Path = Path("uploads")
    ALLOWED_EXTENSIONS: str = ".xml,.xlsx,.xls,.pdf,.csv"
    
    # Email (OPTIONAL - for notifications)
    SMTP_ENABLED: bool = False
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    
    # Gmail IMAP (OPTIONAL - for email parsing)
    GMAIL_IMAP_ENABLED: bool = False
    GMAIL_EMAIL: Optional[str] = None
    GMAIL_APP_PASSWORD: Optional[str] = None
    
    # Document AI (OPTIONAL - for OCR/parsing)
    DOCUMENT_AI_ENABLED: bool = False
    DOCUMENT_AI_API_KEY: Optional[str] = None
    
    # Feature Flags
    ENABLE_SMTP_EMAIL: bool = False
    ENABLE_GMAIL_IMAP: bool = False
    ENABLE_DOCUMENT_AI: bool = False
    ENABLE_ASYNC_IMPORTS: bool = True
    ENABLE_CACHING: bool = True
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text
    LOG_FILE: Optional[Path] = None
    
    # Performance
    REQUEST_TIMEOUT_SECONDS: int = 300
    CACHE_TTL_SECONDS: int = 3600
    MAX_CONCURRENT_IMPORTS: int = 5
    
    # Business Logic
    DEFAULT_USER_ID: str = "admin"
    DEFAULT_USER_EMAIL: str = "ceraldigroupsrl@gmail.com"
    IVA_ALIQUOTE: list[float] = [4.0, 5.0, 10.0, 22.0]
    
    # Paths
    STATIC_FILES_DIR: Path = Path("static")
    TEMPLATES_DIR: Path = Path("templates")
    FONTS_DIR: Path = Path("fonts")
    
    model_config = SettingsConfigDict(
        env_file="/app/backend/.env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    def get_cors_origins(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.ALLOWED_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    def get_allowed_extensions(self) -> set[str]:
        """Parse allowed file extensions."""
        return set(ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(","))
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.ENVIRONMENT == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT == "production"
    
    def validate_required_secrets(self) -> dict[str, bool]:
        """
        Validate required and optional secrets.
        
        Returns:
            dict: Feature availability status
        """
        features = {
            'database': bool(self.MONGODB_ATLAS_URI and self.DB_NAME),
            'auth': bool(self.SECRET_KEY),
            'smtp_email': self.SMTP_ENABLED and all([
                self.SMTP_HOST,
                self.SMTP_USERNAME,
                self.SMTP_PASSWORD,
                self.SMTP_FROM_EMAIL
            ]),
            'gmail_imap': self.GMAIL_IMAP_ENABLED and all([
                self.GMAIL_EMAIL,
                self.GMAIL_APP_PASSWORD
            ]),
            'document_ai': self.DOCUMENT_AI_ENABLED and bool(self.DOCUMENT_AI_API_KEY)
        }
        
        # Core features must be available
        # database config optional; features['database'] indicates availability
        # auth config optional; features['auth'] indicates availability
        
        return features


# Create singleton instance
settings = Settings()

# Feature availability (does not raise on missing secrets)
FEATURES = settings.validate_required_secrets()
def get_settings() -> Settings:
    """Get settings singleton instance."""
    return settings
