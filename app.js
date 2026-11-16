// app.js
// ============================================================
// Orchestrator Manager UI / Pyodide bridge
//
// Usage:
//   GitHub Pagesでindex.htmlを開く
// ============================================================

const $ = (id) => document.getElementById(id);
const state = { pyodide: null, connected: false, requests: [], mode: "cloudflare", endpoint: "" };
let editingId = null;

function setMessage(message, type = "") {
  const node = $("message");
  node.textContent = message;
  node.className = `message ${type}`;
}

function setPill(node, text, type = "neutral") {
  node.textContent = text;
  node.className = `pill ${type}`;
}

function baseUrl() {
  const value = $("endpoint").value.trim();
  if (state.mode === "lan") return `http://${value}`;
  return value.replace(/\/+$/, "");
}

function validBaseUrl() {
  const value = $("endpoint").value.trim();
  if (!value) return false;
  if (state.mode === "lan") return /^[a-zA-Z0-9.-]+:\d+$/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.host.length > 0;
  } catch {
    return false;
  }
}

function updateConnectionHint() {
  const lan = state.mode === "lan";
  $("endpoint-label").textContent = lan ? "LANサーバー（IP:PORT）" : "Cloudflare URL";
  $("endpoint").type = lan ? "text" : "url";
  $("endpoint").placeholder = lan ? "192.168.1.10:5000" : "https://xxxx.trycloudflare.com";
  $("connection-hint").textContent = lan
    ? "例: 192.168.1.10:5000。サーバー側は 0.0.0.0:5000 で起動してください。HTTPSのGitHub PagesからHTTPのLANサーバーへ接続する場合、ブラウザのMixed Content制約でブロックされることがあります。LAN側もHTTPS化し、信頼された証明書を使用してください。"
    : "Cloudflare TunnelのHTTPS URLを入力してください。末尾のスラッシュはあってもなくても構いません。";
}

function saveConnection() {
  state.mode = $("connection-mode").value;
  state.endpoint = $("endpoint").value.trim();
  localStorage.setItem("orchestrator-connection", JSON.stringify({ mode: state.mode, endpoint: state.endpoint }));
  setMessage("接続設定をこのブラウザに保存しました。", "success");
  updateConnectionHint();
}

function loadConnection() {
  const saved = localStorage.getItem("orchestrator-connection");
  if (saved) {
    const config = JSON.parse(saved);
    state.mode = config.mode || "cloudflare";
    state.endpoint = config.endpoint || "";
  }
  $("connection-mode").value = state.mode;
  $("endpoint").value = state.endpoint;
  updateConnectionHint();
}

async function initPyodide() {
  setPill($("runtime-status"), "Python準備中", "neutral");
  state.pyodide = await loadPyodide();
  await state.pyodide.loadPackage([]);
  const response = await fetch("./main.py");
  const pythonCode = await response.text();
  await state.pyodide.runPythonAsync(pythonCode);
  setPill($("runtime-status"), "Python準備完了", "success");
  $("test-connection").disabled = false;
}

async function callPython(functionName, ...args) {
  const fn = state.pyodide.globals.get(functionName);
  try {
    const result = await fn(...args);
    return JSON.parse(result);
  } finally {
    fn.destroy();
  }
}

function renderRequests() {
  const list = $("request-list");
  $("request-count").textContent = state.requests.length;
  const preview = {};
  state.requests.forEach((item) => {
    preview[item.id] = {
      "実行コマンド": item.command,
      "目的": item.purpose,
      "承認": item.status === "承認済み"
    };
  });
  $("json-preview").textContent = JSON.stringify(preview, null, 2);
  if (!state.requests.length) {
    list.innerHTML = '<div class="empty-state"><strong>リクエストはありません</strong><span>「新規追加」からリクエストを登録できます。</span></div>';
    return;
  }
  list.replaceChildren();
  state.requests.forEach((item) => {
    const card = document.createElement("article");
    card.className = "request-card";
    const top = document.createElement("div");
    top.className = "card-top";
    const id = document.createElement("div");
    id.className = "request-id";
    id.textContent = item.id;
    const status = document.createElement("span");
    const approved = item.status === "承認済み";
    status.className = `pill ${approved ? "success" : "warning"}`;
    status.textContent = approved ? "承認済み" : "未承認";
    top.append(id, status);
    const purposeLabel = document.createElement("span");
    purposeLabel.className = "meta-label";
    purposeLabel.textContent = "目的";
    const purpose = document.createElement("div");
    purpose.className = "purpose";
    purpose.textContent = item.purpose;
    const commandLabel = document.createElement("span");
    commandLabel.className = "meta-label";
    commandLabel.textContent = "実行コマンド";
    const command = document.createElement("pre");
    command.className = "command";
    command.textContent = item.command;
    const actions = document.createElement("div");
    actions.className = "card-actions";
    if (!approved) {
      const approve = document.createElement("button");
      approve.className = "button approve";
      approve.textContent = "承認";
      approve.addEventListener("click", () => approveItem(item.id));
      actions.append(approve);
    }
    const edit = document.createElement("button");
    edit.className = "button secondary";
    edit.textContent = "編集";
    edit.addEventListener("click", () => openEditDialog(item));
    const remove = document.createElement("button");
    remove.className = "button danger";
    remove.textContent = "削除";
    remove.addEventListener("click", () => removeItem(item.id));
    actions.append(edit, remove);
    card.append(top, purposeLabel, purpose, commandLabel, command, actions);
    list.append(card);
  });
}

async function refreshRequests() {
  if (!state.pyodide) return;
  if (!validBaseUrl()) {
    setMessage("接続先を正しく入力してください。", "error");
    return;
  }
  setPill($("connection-status"), "接続中", "neutral");
  $("refresh").disabled = true;
  $("add-request").disabled = true;
  try {
    const result = await callPython("list_requests", baseUrl());
    if (result.error) throw new Error(`HTTP ${result.status_code}: ${JSON.stringify(result.detail)}`);
    state.requests = result.map((item) => ({
      id: item.id,
      command: item.command,
      purpose: item.purpose,
      status: item.status
    }));
    state.connected = true;
    setPill($("connection-status"), "接続済み", "success");
    setMessage(`${state.requests.length}件のリクエストを取得しました。`, "success");
    $("refresh").disabled = false;
    $("add-request").disabled = false;
    renderRequests();
  } catch (error) {
    state.connected = false;
    setPill($("connection-status"), "接続失敗", "error");
    setMessage(`接続または取得に失敗しました: ${error.message}`, "error");
    $("refresh").disabled = false;
    $("add-request").disabled = true;
  }
}

async function runMutation(functionName, ...args) {
  const result = await callPython(functionName, ...args);
  if (result && result.error) throw new Error(`HTTP ${result.status_code}: ${JSON.stringify(result.detail)}`);
  await refreshRequests();
  return result;
}

async function approveItem(id) {
  if (!confirm(`「${id}」を承認しますか？`)) return;
  try {
    await runMutation("approve_request", baseUrl(), id);
    setMessage(`「${id}」を承認しました。`, "success");
  } catch (error) {
    setMessage(`承認に失敗しました: ${error.message}`, "error");
  }
}

async function removeItem(id) {
  if (!confirm(`「${id}」を削除しますか？この操作は取り消せません。`)) return;
  try {
    await runMutation("delete_request", baseUrl(), id);
    setMessage(`「${id}」を削除しました。`, "success");
  } catch (error) {
    setMessage(`削除に失敗しました: ${error.message}`, "error");
  }
}

function openAddDialog() {
  editingId = null;
  $("dialog-eyebrow").textContent = "NEW REQUEST";
  $("dialog-title").textContent = "リクエスト追加";
  $("form-id").disabled = false;
  $("form-id").value = "";
  $("form-purpose").value = "";
  $("form-command").value = "";
  $("form-hint").textContent = "新規リクエストは「承認待ち」で登録されます。";
  $("submit-request").textContent = "登録";
  $("request-dialog").showModal();
}

function openEditDialog(item) {
  editingId = item.id;
  $("dialog-eyebrow").textContent = "EDIT REQUEST";
  $("dialog-title").textContent = "リクエスト編集";
  $("form-id").disabled = true;
  $("form-id").value = item.id;
  $("form-purpose").value = item.purpose;
  $("form-command").value = item.command;
  $("form-hint").textContent = "承認済みのリクエストも編集できます。要求IDは変更できません。";
  $("submit-request").textContent = "変更を保存";
  $("request-dialog").showModal();
}

async function submitRequest(event) {
  event.preventDefault();
  const id = $("form-id").value.trim();
  const purpose = $("form-purpose").value.trim();
  const command = $("form-command").value.trim();
  if (!id || !purpose || !command) return;
  $("submit-request").disabled = true;
  try {
    if (editingId === null) {
      await runMutation("create_request", baseUrl(), id, command, purpose);
      setMessage(`「${id}」を承認待ちで登録しました。`, "success");
    } else {
      await runMutation("update_request", baseUrl(), editingId, command, purpose);
      setMessage(`「${editingId}」を更新しました。`, "success");
    }
    $("request-dialog").close();
  } catch (error) {
    setMessage(`保存に失敗しました: ${error.message}`, "error");
  } finally {
    $("submit-request").disabled = false;
  }
}

function registerEvents() {
  $("connection-mode").addEventListener("change", () => {
    state.mode = $("connection-mode").value;
    updateConnectionHint();
  });
  $("save-connection").addEventListener("click", saveConnection);
  $("test-connection").addEventListener("click", async () => {
    saveConnection();
    await refreshRequests();
  });
  $("refresh").addEventListener("click", refreshRequests);
  $("add-request").addEventListener("click", openAddDialog);
  $("request-form").addEventListener("submit", submitRequest);
  $("close-dialog").addEventListener("click", () => $("request-dialog").close());
  $("cancel-dialog").addEventListener("click", () => $("request-dialog").close());
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("./service-worker.js");
    $("pwa-status").textContent = "PWA登録済み";
  }
}

async function startApp() {
  registerEvents();
  loadConnection();
  $("test-connection").disabled = true;
  try {
    await registerServiceWorker();
    await initPyodide();
  } catch (error) {
    setPill($("runtime-status"), "Python起動失敗", "error");
    setMessage(`Pyodideの起動に失敗しました: ${error.message}`, "error");
  }
}

startApp();
