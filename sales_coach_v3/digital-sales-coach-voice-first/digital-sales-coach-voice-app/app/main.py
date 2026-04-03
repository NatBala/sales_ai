from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .knowledge import build_knowledge_context, get_enabled_personas, get_topics
from .openai_api import OpenAIAPIError, OpenAIClient
from .prompts import (
    COACH_REPORT_SCHEMA,
    END_SIGNAL_SCHEMA,
    SCENARIO_SCHEMA,
    build_advisor_messages,
    build_coach_messages,
    build_coach_preview_messages,
    build_end_signal_messages,
    build_realtime_instructions,
    build_scenario_messages,
)
from .schemas import (
    CatalogPersona,
    CatalogResponse,
    ChatTurnRequest,
    ChatTurnResponse,
    CoachReportResponse,
    EndSignalRequest,
    EndSignalResponse,
    HealthResponse,
    ScenarioPublic,
    ScenarioRecord,
    ScenarioRequest,
    TranscriptTurn,
    TranscriptUpsertRequest,
)
from .settings import get_settings
from .store import store

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


settings = get_settings()
app = FastAPI(title=settings.app_name)
app.mount("/static", NoCacheStaticFiles(directory=str(STATIC_DIR)), name="static")


def _get_client() -> OpenAIClient:
    try:
        return OpenAIClient()
    except OpenAIAPIError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.exception_handler(OpenAIAPIError)
async def openai_error_handler(_: Request, exc: OpenAIAPIError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/", response_class=FileResponse)
async def index() -> FileResponse:
    response = FileResponse(STATIC_DIR / "index.html")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        openai_configured=bool(settings.openai_api_key),
    )


@app.get("/api/catalog", response_model=CatalogResponse)
async def catalog() -> CatalogResponse:
    personas = [
        CatalogPersona(
            id=p["id"],
            persona_type=p["persona_type"],
            name=p["name"],
            firm=p["firm"],
            firm_type=p["firm_type"],
            enabled=p.get("enabled", True),
        )
        for p in get_enabled_personas()
    ]
    return CatalogResponse(
        app_name=settings.app_name,
        personas=personas,
        topics=get_topics() or ["Active ETF Models"],
        modes=["voice"],
        default_voice=settings.realtime_voice,
        default_coach_voice=settings.realtime_coach_voice,
    )


@app.post("/api/scenarios", response_model=ScenarioPublic)
async def create_scenario(request: ScenarioRequest) -> ScenarioPublic:
    client = _get_client()
    enabled_personas = get_enabled_personas()
    messages = build_scenario_messages(
        knowledge_context=build_knowledge_context(),
        request=request,
        enabled_personas=enabled_personas,
    )
    scenario_data = await client.create_structured_response(
        model=settings.scenario_model,
        messages=messages,
        schema_name="sales_coach_scenario",
        schema=SCENARIO_SCHEMA,
    )

    scenario_id = str(uuid4())
    record = ScenarioRecord(
        id=scenario_id,
        title=scenario_data["title"],
        topic=request.topic,
        mode=request.mode,
        difficulty=request.difficulty,
        visible_persona=scenario_data.get("visible_persona") if request.coach_visible_persona else None,
        trainer_preview=scenario_data["trainer_preview"],
        hidden_brief=scenario_data["hidden_brief"],
        advisor_prompt="",
        realtime_prompt="",
        transcript=[],
    )
    record.advisor_prompt = build_realtime_instructions(record)
    record.realtime_prompt = record.advisor_prompt
    store.create(record)

    return ScenarioPublic(
        id=record.id,
        title=record.title,
        topic=record.topic,
        mode=record.mode,
        difficulty=record.difficulty,
        salesperson_brief=scenario_data["salesperson_brief"],
        start_instruction=scenario_data["start_instruction"],
        visible_persona=record.visible_persona,
        trainer_preview=record.trainer_preview,
    )


@app.post("/api/scenarios/{scenario_id}/chat", response_model=ChatTurnResponse)
async def send_chat_turn(scenario_id: str, request: ChatTurnRequest) -> ChatTurnResponse:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")

    store.append_turn(
        scenario_id,
        TranscriptTurn(role="salesperson", text=request.message),
    )
    record = store.get(scenario_id)
    assert record is not None

    client = _get_client()
    messages = build_advisor_messages(
        scenario=record,
        transcript=record.transcript,
        latest_salesperson_message=request.message,
    )
    reply = await client.create_text_response(
        model=settings.chat_model,
        messages=messages,
    )
    store.append_turn(
        scenario_id,
        TranscriptTurn(role="advisor", text=reply),
    )
    record = store.get(scenario_id)
    assert record is not None
    return ChatTurnResponse(reply=reply, transcript=record.transcript)


@app.post("/api/scenarios/{scenario_id}/transcript")
async def upsert_transcript(scenario_id: str, request: TranscriptUpsertRequest) -> dict[str, Any]:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")
    updated = store.upsert_transcript(scenario_id, request.transcript)
    return {"ok": True, "turns": len(updated.transcript)}


@app.post("/api/scenarios/{scenario_id}/should-end", response_model=EndSignalResponse)
async def should_end_call(scenario_id: str, request: EndSignalRequest) -> EndSignalResponse:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")

    client = _get_client()
    messages = build_end_signal_messages(
        scenario=record,
        transcript=request.transcript,
        latest_utterance=request.latest_utterance,
    )
    result = await client.create_structured_response(
        model=settings.end_detector_model,
        messages=messages,
        schema_name="call_end_signal",
        schema=END_SIGNAL_SCHEMA,
    )
    return EndSignalResponse(**result)


@app.post("/api/scenarios/{scenario_id}/evaluate", response_model=CoachReportResponse)
async def evaluate_scenario(scenario_id: str) -> CoachReportResponse:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if not record.transcript:
        raise HTTPException(status_code=400, detail="No transcript available to evaluate")

    client = _get_client()
    messages = build_coach_messages(scenario=record, transcript=record.transcript)
    report = await client.create_structured_response(
        model=settings.coach_model,
        messages=messages,
        schema_name="cg_way_coach_report",
        schema=COACH_REPORT_SCHEMA,
    )
    updated = store.set_report(scenario_id, report)
    return CoachReportResponse(report=report, transcript=updated.transcript)


@app.get("/api/scenarios/{scenario_id}/evaluate/stream")
async def stream_coach_preview(scenario_id: str) -> StreamingResponse:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if not record.transcript:
        raise HTTPException(status_code=400, detail="No transcript available to evaluate")

    client = _get_client()
    messages = build_coach_preview_messages(scenario=record, transcript=record.transcript)

    async def event_stream():
        try:
            yield "event: preview_start\ndata: {}\n\n"
            async for chunk in client.stream_text_response(
                model=settings.coach_model,
                messages=messages,
            ):
                safe_chunk = json.dumps({"delta": chunk})
                yield f"event: preview_delta\ndata: {safe_chunk}\n\n"
            yield "event: preview_done\ndata: {}\n\n"
        except OpenAIAPIError as exc:
            safe_error = json.dumps({"detail": str(exc)})
            yield f"event: error\ndata: {safe_error}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.post("/api/scenarios/{scenario_id}/realtime/offer")
async def realtime_offer(
    scenario_id: str,
    request: Request,
    voice: str | None = Query(default=None),
) -> PlainTextResponse:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")

    sdp_offer = await request.body()
    if not sdp_offer:
        raise HTTPException(status_code=400, detail="Missing SDP offer")

    session_config = {
        "type": "realtime",
        "model": settings.realtime_model,
        "instructions": record.realtime_prompt,
        "output_modalities": ["audio"],
        "audio": {
            "input": {
                "noise_reduction": {"type": "near_field"},
                "transcription": {"model": "whisper-1", "language": "en"},
                "turn_detection": {
                    "type": "server_vad",
                    "silence_duration_ms": 450,
                    "prefix_padding_ms": 300,
                    "create_response": True,
                    "interrupt_response": True,
                },
            },
            "output": {
                "voice": voice or settings.realtime_voice,
            },
        },
    }

    client = _get_client()
    answer_sdp = await client.create_realtime_answer(
        sdp_offer=sdp_offer.decode("utf-8"),
        session_config=session_config,
    )
    return PlainTextResponse(answer_sdp, media_type="application/sdp")


@app.get("/api/scenarios/{scenario_id}")
async def get_scenario(scenario_id: str) -> dict[str, Any]:
    record = store.get(scenario_id)
    if not record:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {
        "id": record.id,
        "title": record.title,
        "topic": record.topic,
        "mode": record.mode,
        "difficulty": record.difficulty,
        "visible_persona": record.visible_persona,
        "trainer_preview": record.trainer_preview,
        "transcript": record.transcript,
        "coach_report": record.coach_report,
    }
