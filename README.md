# Orchestrator Manager PWA

## 今回の変更
- Pyodideを通信経路から外し、ブラウザ標準の `fetch()` でHTTP通信する構成に変更
- 接続確認は `GET /` を使用。サーバーが `{"name":"orchestrator_server","status":"ok"}` を返すことを確認
- ハンドシェイク成功後にだけ `GET /api/requests` を実行
- 接続失敗時は画面にエラーと確認項目を表示
- 白背景・濃い文字に変更
- 追加・編集（PUT）・承認・削除に対応
- APIレスポンスはService Workerにキャッシュしない

## 配置
このフォルダーの中身をGitHub Pagesの公開対象へ配置してください。GitHub PagesのHTTPSで利用できます。

## 接続先
- SSHポートフォワードを利用する場合：`http://127.0.0.1:5000`
- LAN直結の場合：`http://サーバーのLAN-IP:5000`（HTTPSページからHTTPのLAN IPへ接続すると、ブラウザに遮断されることがあります）

SSHトンネル例（手元PCで実行）：

```bash
ssh -N -L 5000:127.0.0.1:5000 biostr1@SSH接続先
```

計算サーバー側ではFlaskを `127.0.0.1:5000` で起動します。

## server.py 側で必要な設定

ブラウザからの通信にはCORSが必要です。既に `CORS(app)` を使っている場合でも、Private Network Accessの許可ヘッダーが必要になるブラウザ環境があります。Flaskアプリ作成後に以下を追加してください。

```python
# server.py に追加する設定例
@app.after_request
def add_browser_access_headers(response):
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response
```

既存の `CORS(app)` は残してください。これはブラウザ側の制限を緩和するための設定であり、認証機能ではありません。インターネットに公開する場合は、APIキー等の認証とアクセス元制限を別途実装してください。

## API仕様
- `GET /`：`{"name":"orchestrator_server","status":"ok"}` を返す
- `GET /api/requests`：リクエスト一覧
- `POST /api/requests`：`{"id":"...","purpose":"...","command":"..."}` を追加
- `PUT /api/requests/<id>`：`{"purpose":"...","command":"..."}` を更新
- `POST /api/requests/<id>/approve`：承認
- `DELETE /api/requests/<id>`：削除

## 重要：接続できない場合
`Failed to fetch` は、HTTPエラー応答を受け取る前にブラウザが通信を遮断した場合にも発生します。画面に表示されるハンドシェイク失敗の案内を確認してください。

1. まずPWAを開いて接続先に `http://127.0.0.1:5000` を入力し、「接続確認」を押します。
2. 同じPCのブラウザで `http://127.0.0.1:5000/` を直接開けることを確認します。
3. それでも失敗する場合は、ブラウザ開発者ツールのConsoleでCORS、Private Network Access、Mixed Contentのエラーを確認します。
4. HTTPSのGitHub PagesからHTTPのLAN IPへ接続する構成は、ブラウザによって遮断されることがあります。その場合はAPIサーバーをHTTPS化するか、HTTPS対応の中継を使ってください。

## 注意
この一式はコードを書き直したもので、実際の計算サーバー・ブラウザとの接続試験は行っていません。特にCORS/PNAの挙動はブラウザとサーバー設定に依存します。
