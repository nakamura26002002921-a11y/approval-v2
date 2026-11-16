# main.py
# ============================================================
# Pyodide上で実行するorchestrator_server APIクライアント
#
# Usage:
#   app.js からPyodide経由で呼び出す
# ============================================================

import json
from urllib.parse import quote
from pyodide.http import pyfetch

async def api_request(base_url: str, method: str, path: str, payload_json: str = "") -> str:
    headers = {"Content-Type": "application/json"}
    kwargs = {"method": method, "headers": headers}
    if payload_json:
        kwargs["body"] = payload_json
    response = await pyfetch(f"{base_url.rstrip('/')}{path}", **kwargs)
    if response.status not in (200, 201):
        detail = await response.json()
        return json.dumps({"error": True, "status_code": response.status, "detail": detail}, ensure_ascii=False)
    if response.status == 204:
        return json.dumps({"success": True}, ensure_ascii=False)
    return json.dumps(await response.json(), ensure_ascii=False)

async def list_requests(base_url: str) -> str:
    return await api_request(base_url, "GET", "/api/requests")

async def create_request(base_url: str, server_id: str, command: str, purpose: str) -> str:
    payload = {"id": server_id, "command": command, "purpose": purpose}
    return await api_request(base_url, "POST", "/api/requests", json.dumps(payload, ensure_ascii=False))

async def update_request(base_url: str, server_id: str, command: str, purpose: str) -> str:
    payload = {"command": command, "purpose": purpose}
    return await api_request(base_url, "PUT", f"/api/requests/{quote(server_id, safe='')}", json.dumps(payload, ensure_ascii=False))

async def approve_request(base_url: str, server_id: str) -> str:
    return await api_request(base_url, "POST", f"/api/requests/{quote(server_id, safe='')}/approve")

async def delete_request(base_url: str, server_id: str) -> str:
    return await api_request(base_url, "DELETE", f"/api/requests/{quote(server_id, safe='')}")
