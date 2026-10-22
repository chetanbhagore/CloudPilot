import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_name: str = "CloudPilot Backend"
    version: str = "1.0.0"
    env: str = os.getenv("ENV", "development")
    port: int = int(os.getenv("PORT", "8000"))
    host: str = os.getenv("HOST", "0.0.0.0")
    
    # Default AWS Operator Configuration
    default_region: str = os.getenv("AWS_DEFAULT_REGION", "ap-south-1")
    operator_account_id: str = os.getenv("OPERATOR_ACCOUNT_ID", "123456789012")
    
    # CORS Origins allowed
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
