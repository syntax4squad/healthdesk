import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    BASE_DIR = BASE_DIR
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or (
        f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'swasthyasaathi.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@swasthyasaathi.local")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
