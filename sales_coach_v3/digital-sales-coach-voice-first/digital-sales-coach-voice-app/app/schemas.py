from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


TurnRole = Literal["salesperson", "advisor"]
PracticeMode = Literal["voice", "text"]


class ScenarioRequest(BaseModel):
    persona_id: str | None = None
    topic: str = "Active ETF Models"
    mode: PracticeMode = "voice"
    difficulty: Literal["easy", "adaptive", "challenging"] = "adaptive"
    coach_visible_persona: bool = True


class TranscriptTurn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    external_id: str | None = None
    role: TurnRole
    text: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TranscriptUpsertRequest(BaseModel):
    transcript: list[TranscriptTurn]


class EndSignalRequest(BaseModel):
    latest_utterance: str = Field(min_length=1, max_length=2000)
    transcript: list[TranscriptTurn] = Field(default_factory=list)


class EndSignalResponse(BaseModel):
    should_end: bool
    confidence: int
    reason: str


class ChatTurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=6000)


class ScenarioPublic(BaseModel):
    id: str
    title: str
    topic: str
    mode: PracticeMode
    difficulty: str
    salesperson_brief: str
    start_instruction: str
    visible_persona: dict[str, Any] | None = None
    trainer_preview: dict[str, Any]


class ScenarioRecord(BaseModel):
    id: str
    title: str
    topic: str
    mode: PracticeMode
    difficulty: str
    visible_persona: dict[str, Any] | None = None
    trainer_preview: dict[str, Any]
    hidden_brief: dict[str, Any]
    advisor_prompt: str
    realtime_prompt: str
    transcript: list[TranscriptTurn] = Field(default_factory=list)
    coach_report: dict[str, Any] | None = None


class CatalogPersona(BaseModel):
    id: str
    persona_type: str
    name: str
    firm: str
    firm_type: str
    enabled: bool = True


class CatalogResponse(BaseModel):
    app_name: str
    personas: list[CatalogPersona]
    topics: list[str]
    modes: list[str]
    default_voice: str
    default_coach_voice: str


class HealthResponse(BaseModel):
    status: str
    openai_configured: bool


class CoachReportResponse(BaseModel):
    report: dict[str, Any]
    transcript: list[TranscriptTurn]


class ChatTurnResponse(BaseModel):
    reply: str
    transcript: list[TranscriptTurn]


class ErrorResponse(BaseModel):
    detail: str
