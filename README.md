# Orchestrator Manager (Pyodide + PWA)

## 概要
GitHub Pages上で動作する、Flask `server.py` 用のリクエスト管理クライアントです。PythonのAPI呼び出し処理はPyodide上の `main.py` で実行します。

## ファイル
- `index.html`: 画面
- `style.css`: デザイン
- `app.js`: UI、Pyodide起動、画面更新
- `main.py`: Pyodideから実行するAPIクライアント
- `manifest.json`: PWA設定
- `service-worker.js`: アプリシェルのキャッシュ
- `icons/icon.svg`: アプリアイコン

## GitHub Pagesへの配置
1. このフォルダ内のファイルをGitHubリポジトリの公開対象ディレクトリ（例: `docs/`）へ配置します。
2. GitHubリポジトリの Settings → Pages で公開元を設定します。
3. PagesのHTTPS URLを開きます。
4. 初回はインターネット接続下でPyodideを読み込みます。

## サーバー起動

### Cloudflare
```bash
python3 server.py
```
Cloudflare Tunnelは別途起動し、発行されたHTTPS URLをクライアントのCloudflare URL欄に入力します。

### LAN
```bash
python3 server.py --net-port "0.0.0.0:5000"
```
クライアントにはサーバーPCのLANアドレス（例: `192.168.1.10:5000`）を入力します。

## LAN接続時のブラウザ制約
GitHub PagesはHTTPSです。HTTPSページから `http://192.168.x.x:5000` のようなHTTP APIへアクセスすると、ブラウザのMixed Content制約やPrivate Network Access等によりブロックされる場合があります。一般的なブラウザでは、LAN側APIをHTTPS化し、ブラウザが信頼する証明書を設定する必要があります。単にFlaskを `0.0.0.0` で待ち受けるだけでは、GitHub PagesからのLAN接続が必ず成功するわけではありません。

## CORS
現在の `server.py` は `CORS(app)` で全オリジンを許可しています。公開運用ではGitHub Pagesのオリジンに制限し、APIに認証を追加してください。承認・編集・削除APIは認証なしで呼び出せるため、信頼できるネットワーク内に限定してください。

## オフライン動作
Service Workerは画面・CSS・JavaScript・Pythonソースをキャッシュします。オフライン時に画面シェルを開くことはできますが、Pyodide本体はCDNから読み込むため、初回起動やブラウザキャッシュ消去後のオフライン起動は保証されません。またAPI操作にはサーバー接続が必要です。

## API対応
- `GET /api/requests`
- `POST /api/requests`
- `PUT /api/requests/<id>`
- `POST /api/requests/<id>/approve`
- `DELETE /api/requests/<id>`

承認済みリクエストも編集・削除できます。新規登録はサーバー側の仕様どおり「承認待ち」で作成します。要求IDは作成後に変更できません（変更する場合は新しいIDで登録し、旧IDを削除してください）。
