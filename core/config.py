import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/aura-chat-bot"
    )
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret")

settings = Settings()