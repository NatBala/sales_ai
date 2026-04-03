from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
KNOWLEDGE_DIR = BASE_DIR / "knowledge"


@lru_cache(maxsize=1)
def load_knowledge() -> dict[str, Any]:
    knowledge: dict[str, Any] = {"json": {}, "markdown": {}}

    for json_file in KNOWLEDGE_DIR.glob("*.json"):
        with json_file.open("r", encoding="utf-8") as f:
            knowledge["json"][json_file.stem] = json.load(f)

    for md_file in KNOWLEDGE_DIR.glob("*.md"):
        knowledge["markdown"][md_file.stem] = md_file.read_text(encoding="utf-8")

    return knowledge


def get_enabled_personas() -> list[dict[str, Any]]:
    data = load_knowledge()["json"]["advisor_personas"]
    return [p for p in data["personas"] if p.get("enabled", True)]


def get_topics() -> list[str]:
    briefs = load_knowledge()["json"].get("product_briefs", {}).get("briefs", [])
    return [brief["title"] for brief in briefs]


def build_knowledge_context() -> str:
    knowledge = load_knowledge()
    parts: list[str] = []

    playbook = knowledge["json"].get("cg_way_playbook")
    if playbook:
        parts.append("ENGAGEMENT FRAMEWORK PLAYBOOK")
        parts.append(json.dumps(playbook, indent=2))

    personas = knowledge["json"].get("advisor_personas")
    if personas:
        parts.append("ADVISOR PERSONAS")
        parts.append(json.dumps(personas, indent=2))

    briefs = knowledge["json"].get("product_briefs")
    if briefs:
        parts.append("PRODUCT BRIEFS")
        parts.append(json.dumps(briefs, indent=2))

    for name, text in knowledge["markdown"].items():
        parts.append(f"MARKDOWN NOTE: {name}")
        parts.append(text)

    return "\n\n".join(parts)
