from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from ..config import settings


class MeshBridgeError(RuntimeError):
    pass


@dataclass(frozen=True)
class MeshDevice:
    node_id: str
    name: str
    group_id: str = ""
    group_name: str = ""
    online: bool = False
    operating_system: str = ""
    ip_address: str = ""
    last_seen_at: datetime | None = None
    agent_version: str = ""


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        if value > 10_000_000_000:
            value = value / 1000
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return None
        if normalized.endswith("Z"):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _device_from_payload(payload: dict[str, Any]) -> MeshDevice:
    return MeshDevice(
        node_id=str(payload.get("node_id") or payload.get("nodeId") or payload.get("id") or "").strip(),
        name=str(payload.get("name") or payload.get("display_name") or payload.get("displayName") or "Sem nome").strip(),
        group_id=str(payload.get("group_id") or payload.get("groupId") or payload.get("meshid") or "").strip(),
        group_name=str(payload.get("group_name") or payload.get("groupName") or payload.get("meshname") or "").strip(),
        online=bool(payload.get("online") or payload.get("connected") or payload.get("conn")),
        operating_system=str(payload.get("operating_system") or payload.get("operatingSystem") or payload.get("os") or "").strip(),
        ip_address=str(payload.get("ip_address") or payload.get("ipAddress") or payload.get("ip") or "").strip(),
        last_seen_at=_parse_datetime(payload.get("last_seen_at") or payload.get("lastSeenAt") or payload.get("lastconnect") or payload.get("lastseen")),
        agent_version=str(payload.get("agent_version") or payload.get("agentVersion") or payload.get("agent") or "").strip(),
    )


class MeshBridgeClient:
    def __init__(self, base_url: str | None = None, shared_secret: str | None = None, timeout_seconds: int = 30) -> None:
        self.base_url = (base_url or settings.mesh_bridge_url).rstrip("/")
        self.shared_secret = settings.mesh_bridge_shared_secret if shared_secret is None else shared_secret
        self.timeout_seconds = timeout_seconds

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def list_devices(self, *, page: int, page_size: int, search: str = "", status: str = "") -> dict[str, Any]:
        params: dict[str, Any] = {"page": page, "page_size": page_size, "search": search, "status": status}
        normalized = status.strip().lower()
        if normalized == "online":
            params["online"] = "true"
        elif normalized == "offline":
            params["online"] = "false"
        query = urlencode({key: value for key, value in params.items() if value not in ("", None)})
        payload = self._request("GET", f"/devices?{query}")
        items = [_device_from_payload(item) for item in payload.get("items", []) if isinstance(item, dict)]
        return {
            "items": items,
            "total": int(payload.get("total") or len(items)),
            "page": int(payload.get("page") or page),
            "page_size": int(payload.get("page_size") or page_size),
            "summary": payload.get("summary") or {},
        }

    def get_device(self, node_id: str) -> MeshDevice:
        payload = self._request("GET", f"/devices/{quote(node_id, safe='')}")
        if not isinstance(payload, dict):
            raise MeshBridgeError("Resposta inválida do Mesh Bridge ao consultar dispositivo.")
        device = _device_from_payload(payload)
        if not device.node_id:
            raise MeshBridgeError("Dispositivo remoto sem identificador válido.")
        return device

    def create_session_url(
        self,
        *,
        session_id: str,
        node_id: str,
        user_id: str,
        user_name: str,
        user_email: str,
        reason: str,
        access_mode: str = "desktop",
    ) -> dict[str, Any]:
        payload = self._request(
            "POST",
            "/session-url",
            {
                "session_id": session_id,
                "node_id": node_id,
                "user_id": user_id,
                "user_name": user_name,
                "user_email": user_email,
                "reason": reason,
                "access_mode": access_mode,
            },
        )
        embed_url = str(payload.get("embed_url") or payload.get("url") or "").strip()
        if not embed_url:
            raise MeshBridgeError("Mesh Bridge não retornou uma URL de sessão.")
        return {
            "embed_url": embed_url,
            "expires_in_seconds": int(payload.get("expires_in_seconds") or settings.mesh_session_ttl_seconds),
            "mesh_user_id": str(payload.get("mesh_user_id") or ""),
        }

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.base_url:
            raise MeshBridgeError("Mesh Bridge não configurado.")
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if self.shared_secret:
            headers["X-Bridge-Token"] = self.shared_secret
        request = Request(f"{self.base_url}{path}", data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                raw = response.read().decode("utf-8")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            try:
                parsed_detail = json.loads(detail).get("detail")
            except Exception:
                parsed_detail = detail
            raise MeshBridgeError(parsed_detail or f"Mesh Bridge respondeu HTTP {exc.code}.") from exc
        except URLError as exc:
            raise MeshBridgeError("Mesh Bridge indisponível.") from exc
        except TimeoutError as exc:
            raise MeshBridgeError("Tempo esgotado ao consultar o Mesh Bridge.") from exc
        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError as exc:
            raise MeshBridgeError("Mesh Bridge retornou uma resposta inválida.") from exc
        if not isinstance(data, dict):
            raise MeshBridgeError("Mesh Bridge retornou uma resposta inesperada.")
        return data
