from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

from pydantic import BaseModel, Field


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings(BaseModel):
    app_name: str = Field(default=os.getenv("APP_NAME", "Digital Sales Coach"))
    openai_api_key: str | None = Field(default=os.getenv("OPENAI_API_KEY"))
    openai_base_url: str = Field(default=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    openai_verify_ssl: bool = Field(default=_env_bool("OPENAI_VERIFY_SSL", False))
    scenario_model: str = Field(default=os.getenv("OPENAI_SCENARIO_MODEL", "gpt-5.4"))
    chat_model: str = Field(default=os.getenv("OPENAI_CHAT_MODEL", "gpt-5.4"))
    coach_model: str = Field(default=os.getenv("OPENAI_COACH_MODEL", "gpt-5.4"))
    end_detector_model: str = Field(default=os.getenv("OPENAI_END_DETECTOR_MODEL", "gpt-5-mini"))
    realtime_model: str = Field(default=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"))
    realtime_voice: str = Field(default=os.getenv("OPENAI_REALTIME_VOICE", "marin"))
    realtime_coach_voice: str = Field(default=os.getenv("OPENAI_REALTIME_COACH_VOICE", "cedar"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
