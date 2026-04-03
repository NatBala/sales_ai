from __future__ import annotations

from threading import Lock

from .schemas import ScenarioRecord, TranscriptTurn


class InMemoryScenarioStore:
    def __init__(self) -> None:
        self._records: dict[str, ScenarioRecord] = {}
        self._lock = Lock()

    def create(self, record: ScenarioRecord) -> ScenarioRecord:
        with self._lock:
            self._records[record.id] = record
        return record

    def get(self, scenario_id: str) -> ScenarioRecord | None:
        return self._records.get(scenario_id)

    def append_turn(self, scenario_id: str, turn: TranscriptTurn) -> ScenarioRecord:
        with self._lock:
            record = self._records[scenario_id]
            record.transcript.append(turn)
            self._records[scenario_id] = record
            return record

    def upsert_transcript(self, scenario_id: str, turns: list[TranscriptTurn]) -> ScenarioRecord:
        with self._lock:
            record = self._records[scenario_id]
            existing_by_external: dict[str, TranscriptTurn] = {
                t.external_id: t for t in record.transcript if t.external_id
            }
            existing_by_id: dict[str, TranscriptTurn] = {t.id: t for t in record.transcript}

            for turn in turns:
                if turn.external_id and turn.external_id in existing_by_external:
                    existing = existing_by_external[turn.external_id]
                    existing.text = turn.text
                elif turn.id in existing_by_id:
                    existing_by_id[turn.id].text = turn.text
                else:
                    record.transcript.append(turn)

            record.transcript.sort(key=lambda t: t.created_at)
            self._records[scenario_id] = record
            return record

    def set_report(self, scenario_id: str, report: dict) -> ScenarioRecord:
        with self._lock:
            record = self._records[scenario_id]
            record.coach_report = report
            self._records[scenario_id] = record
            return record


store = InMemoryScenarioStore()
