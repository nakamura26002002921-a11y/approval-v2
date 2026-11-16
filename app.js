// app.js
// ============================================================
// Usage:
//   PWAの接続確認、ハンドシェイク、リクエスト一覧・編集・承認・削除
// ============================================================
const $ = (id) => document.getElementById(id);
const state = { connected: false, baseUrl: "", requests: [], editingId: null };

function setMessage(id, message, type = "") {
  const element = $(id);
  element.textContent = message;
  element.className = `message ${type}`;
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("接続先は http:// または https:// を指定してください。");
  return url.origin;
}

function setConnected(connected, message) {
  state.connected = connected;
  $("connectionBadge").textContent = connected ? "接続済み" : "未接続";
  $("connectionBadge").className = `badge ${connected ? "badge-online" : "badge-offline"}`;
  $("refreshButton").disabled = !connected;
  $("saveButton").disabled = !connected;
  setMessage("connectionMessage", message, connected ? "success" : "error");
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${state.baseUrl}${path}`, {
      ...options,
      mode: "cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
    return body ? JSON.parse(body) : {};
  } finally {
    clearTimeout(timeout);
  }
}

async function handshake() {
  $("connectButton").disabled = true;
  setConnected(false, "接続を確認しています...");
  try {
    state.baseUrl = normalizeBaseUrl($("serverUrl").value);
    const result = await request("/");
    if (result.status !== "ok") throw new Error(`想定外の応答: ${JSON.stringify(result)}`);
    setConnected(true, `ハンドシェイク成功: ${state.baseUrl}`);
    try {
      await loadRequests();
      setMessage("connectionMessage", `ハンドシェイク成功・一覧取得成功: ${state.baseUrl}`, "success");
    } catch (error) {
      setMessage("connectionMessage", `ハンドシェイク成功。ただし一覧取得に失敗しました: ${error.message}`, "error");
      $("requestList").innerHTML = '<div class="empty-state">接続は成功しましたが、一覧を取得できませんでした。GET /api/requests を確認してください。</div>';
    }
  } catch (error) {
    const detail = error.name === "AbortError" ? "接続がタイムアウトしました。" : error.message;
    setConnected(false, `ハンドシェイク失敗: ${detail}\\n\\n確認事項：URL・サーバー起動・CORS・Private Network Access・HTTPS/HTTP制約`);
    $("requestList").innerHTML = '<div class="empty-state">接続確認に失敗したため、一覧を取得していません。</div>';
  } finally {
    $("connectButton").disabled = false;
  }
}

function normalizeRequests(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.entries(data).map(([id, value]) => ({ id, ...value }));
  return [];
}

async function loadRequests() {
  const data = await request("/api/requests");
  state.requests = normalizeRequests(data);
  renderRequests();
}

function renderRequests() {
  const list = $("requestList");
  list.replaceChildren();
  if (!state.requests.length) {
    list.innerHTML = '<div class="empty-state">リクエストはありません。</div>';
    return;
  }
  for (const item of state.requests) {
    const id = String(item.id ?? item.ID ?? "");
    const purpose = String(item.purpose ?? item["目的"] ?? "");
    const command = String(item.command ?? item["実行コマンド"] ?? "");
    const approved = item.status === "承認済み" || item["承認"] === true || item.approved === true;
    const card = document.createElement("article");
    card.className = "request-card";
    const top = document.createElement("div");
    top.className = "request-top";
    const idNode = document.createElement("span");
    idNode.className = "request-id";
    idNode.textContent = id;
    const status = document.createElement("span");
    status.className = `status ${approved ? "approved" : ""}`;
    status.textContent = approved ? "承認済み" : "承認待ち";
    top.append(idNode, status);
    const purposeNode = document.createElement("p");
    purposeNode.className = "request-purpose";
    purposeNode.textContent = purpose;
    const commandNode = document.createElement("pre");
    commandNode.className = "request-command";
    commandNode.textContent = command;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(makeButton("編集", "button-secondary", () => beginEdit(id, purpose, command)));
    if (!approved) actions.append(makeButton("承認", "button-primary", () => approveRequest(id)));
    actions.append(makeButton("削除", "button-danger", () => deleteRequest(id)));
    card.append(top, purposeNode, commandNode, actions);
    list.append(card);
  }
}

function makeButton(label, style, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button ${style}`;
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function beginEdit(id, purpose, command) {
  state.editingId = id;
  $("requestId").value = id;
  $("requestId").disabled = true;
  $("purpose").value = purpose;
  $("command").value = command;
  $("formTitle").textContent = `リクエスト編集：${id}`;
  $("saveButton").textContent = "変更を保存";
  $("cancelEditButton").hidden = false;
  $("formMessage").textContent = "";
  $("requestForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm() {
  state.editingId = null;
  $("requestForm").reset();
  $("requestId").disabled = false;
  $("formTitle").textContent = "リクエスト追加";
  $("saveButton").textContent = "追加する";
  $("cancelEditButton").hidden = true;
}

async function saveRequest(event) {
  event.preventDefault();
  const id = $("requestId").value.trim();
  const payload = { purpose: $("purpose").value, command: $("command").value };
  try {
    if (state.editingId !== null) {
      await request(`/api/requests/${encodeURIComponent(state.editingId)}`, { method: "PUT", body: JSON.stringify(payload) });
      setMessage("formMessage", "変更を保存しました。", "success");
    } else {
      await request("/api/requests", { method: "POST", body: JSON.stringify({ id, ...payload }) });
      setMessage("formMessage", "リクエストを追加しました。", "success");
    }
    resetForm();
    await loadRequests();
  } catch (error) {
    setMessage("formMessage", error.message, "error");
  }
}

async function approveRequest(id) {
  try {
    await request(`/api/requests/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify({}) });
    await loadRequests();
  } catch (error) {
    setMessage("connectionMessage", `承認に失敗しました: ${error.message}`, "error");
  }
}

async function deleteRequest(id) {
  if (!window.confirm(`リクエスト ${id} を削除しますか？`)) return;
  try {
    await request(`/api/requests/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (state.editingId === id) resetForm();
    await loadRequests();
  } catch (error) {
    setMessage("connectionMessage", `削除に失敗しました: ${error.message}`, "error");
  }
}

$("connectButton").addEventListener("click", handshake);
$("refreshButton").addEventListener("click", async () => {
  try { await loadRequests(); setMessage("connectionMessage", "一覧を更新しました。", "success"); }
  catch (error) { setMessage("connectionMessage", `取得に失敗しました: ${error.message}`, "error"); }
});
$("requestForm").addEventListener("submit", saveRequest);
$("cancelEditButton").addEventListener("click", resetForm);
$("serverUrl").addEventListener("keydown", (event) => { if (event.key === "Enter") handshake(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
