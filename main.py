# main.py
# ============================================================
# Usage:
#   Pyodide上で実行
# ============================================================

import json
from pyodide.http import pyfetch

async def api_request(base_url, method, path, payload=None):
    options = {"method": method}
    if payload is not None:
        options["headers"] = {"Content-Type": "application/json"}
        options["body"] = json.dumps(payload, ensure_ascii=False)
    response = await pyfetch(f"{base_url}{path}", **options)
    return await response.json()

async def handshake(base_url):
    return await api_request(base_url, "GET", "/")

async def create_request(base_url, server_id, cmd, purpose):
    payload = {"id": server_id, "command": cmd, "purpose": purpose}
    return await api_request(base_url, "POST", "/api/requests", payload)

async def get_request(base_url, server_id):
    return await api_request(base_url, "GET", f"/api/requests/{server_id}")

async def update_request(base_url, server_id, cmd, purpose):
    payload = {"command": cmd, "purpose": purpose}
    return await api_request(base_url, "PUT", f"/api/requests/{server_id}", payload)

async def approve_request(base_url, server_id):
    return await api_request(base_url, "POST", f"/api/requests/{server_id}/approve", {})

async def delete_request(base_url, server_id):
    return await api_request(base_url, "DELETE", f"/api/requests/{server_id}")
