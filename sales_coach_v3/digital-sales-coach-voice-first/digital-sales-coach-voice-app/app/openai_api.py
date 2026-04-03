from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .settings import get_settings


class OpenAIAPIError(RuntimeError):
    pass


class OpenAIClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.openai_api_key:
            raise OpenAIAPIError(
                "OPENAI_API_KEY is not set. Add it to your environment before starting the app."
            )
        self.base_url = self.settings.openai_base_url.rstrip("/")
        self._client_options = {
            "timeout": 120.0,
            "verify": self.settings.openai_verify_ssl,
        }

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.openai_api_key}",
            "Content-Type": "application/json",
        }

    async def create_text_response(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": model,
            "input": messages,
        }
        if temperature is not None:
            payload["temperature"] = temperature

        async with httpx.AsyncClient(**self._client_options) as client:
            response = await client.post(
                f"{self.base_url}/responses",
                headers=self._headers,
                json=payload,
            )
        if response.status_code >= 400:
            raise OpenAIAPIError(self._format_error(response))

        data = response.json()
        text = self._extract_response_text(data)
        if not text:
            raise OpenAIAPIError("OpenAI returned an empty text response.")
        return text

    async def create_structured_response(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        schema_name: str,
        schema: dict[str, Any],
    ) -> dict[str, Any]:
        payload = {
            "model": model,
            "input": messages,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                }
            },
        }
        async with httpx.AsyncClient(**self._client_options) as client:
            response = await client.post(
                f"{self.base_url}/responses",
                headers=self._headers,
                json=payload,
            )
        if response.status_code >= 400:
            raise OpenAIAPIError(self._format_error(response))

        data = response.json()
        text = self._extract_response_text(data)
        if not text:
            raise OpenAIAPIError("OpenAI returned an empty structured response.")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise OpenAIAPIError(f"Structured output was not valid JSON: {text}") from exc

    async def create_realtime_answer(
        self,
        *,
        sdp_offer: str,
        session_config: dict[str, Any],
    ) -> str:
        files = {
            "sdp": (None, sdp_offer),
            "session": (None, json.dumps(session_config)),
        }
        headers = {
            "Authorization": f"Bearer {self.settings.openai_api_key}",
        }
        async with httpx.AsyncClient(**self._client_options) as client:
            response = await client.post(
                f"{self.base_url}/realtime/calls",
                headers=headers,
                files=files,
            )
        if response.status_code >= 400:
            raise OpenAIAPIError(self._format_error(response))
        return response.text

    async def stream_text_response(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float | None = None,
    ) -> AsyncIterator[str]:
        payload: dict[str, Any] = {
            "model": model,
            "input": messages,
            "stream": True,
        }
        if temperature is not None:
            payload["temperature"] = temperature

        async with httpx.AsyncClient(**self._client_options) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/responses",
                headers=self._headers,
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    text = body.decode("utf-8", errors="ignore")
                    raise OpenAIAPIError(self._format_error_response(response.status_code, text))

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue

                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue

                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type", "")
                    if event_type == "response.output_text.delta":
                        delta = event.get("delta")
                        if delta:
                            yield delta
                    elif event_type == "error":
                        message = event.get("error", {}).get("message") or "Unknown streaming error."
                        raise OpenAIAPIError(message)

    def _extract_response_text(self, data: dict[str, Any]) -> str:
        if isinstance(data.get("output_text"), str) and data["output_text"].strip():
            return data["output_text"].strip()

        parts: list[str] = []
        for item in data.get("output", []):
            for content in item.get("content", []) or []:
                content_type = content.get("type")
                if content_type in {"output_text", "text"} and content.get("text"):
                    parts.append(content["text"])
                elif content_type in {"output_audio", "audio"} and content.get("transcript"):
                    parts.append(content["transcript"])
                elif content_type == "refusal" and content.get("refusal"):
                    parts.append(content["refusal"])
        return "\n".join(part.strip() for part in parts if part and part.strip()).strip()

    def _format_error(self, response: httpx.Response) -> str:
        try:
            payload = response.json()
        except Exception:
            payload = response.text
        return f"OpenAI API error ({response.status_code}): {payload}"

    def _format_error_response(self, status_code: int, response_text: str) -> str:
        try:
            payload = json.loads(response_text)
        except Exception:
            payload = response_text
        return f"OpenAI API error ({status_code}): {payload}"
