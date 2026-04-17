# Slack通知機能 セットアップガイド

全体ベストスコアが更新・タイされたときに、Slackチャンネルに自動通知する機能です。

---

## セットアップ手順

### 1. Google スプレッドシートの準備

1. [Google スプレッドシート](https://sheets.google.com) で新規スプレッドシートを作成
2. シートを2つ用意する（下部のタブ名を正確に設定）:
   - `logs` — 全プレイログが記録される
   - `global_bests` — レベル別の全体ベスト記録
3. スプレッドシートのURLから **スプレッドシートID** をコピー
   - URL例: `https://docs.google.com/spreadsheets/d/【ここがID】/edit`

### 2. Slack Incoming Webhook の取得

1. [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks) にアクセス
2. 通知先のチャンネルを選択して Webhook URL を取得
   - URL例: `https://hooks.slack.com/services/T.../B.../xxx`

### 3. GAS（Google Apps Script）のデプロイ

1. スプレッドシートを開き、**拡張機能 > Apps Script** をクリック
2. `gas/Code.gs` の内容をエディタに貼り付け
3. 以下の定数を書き換える:
   ```javascript
   var SPREADSHEET_ID = '手順1でコピーしたID';
   var SLACK_WEBHOOK_URL = '手順2で取得したURL';
   ```
4. **デプロイ > 新しいデプロイ** をクリック
   - 種類: **ウェブアプリ**
   - 実行ユーザー: **自分**
   - アクセス権: **全員**
5. 「デプロイ」ボタンを押し、表示された **ウェブアプリURL** をコピー

### 4. フロントエンドの設定

`quiz.html` の冒頭にある定数を書き換える:

```javascript
var GAS_ENDPOINT = 'https://script.google.com/macros/s/xxxxx/exec';
```

---

## global_bests シートの見方

| 列 | 内容 |
|----|------|
| level | レベル名（Lv.1 / Lv.2 / Lv.3 / CC） |
| bestScore | そのレベルの全体ベストスコア |
| totalQuestions | 出題数 |
| holderName | 最初にベストスコアを達成した人の名前 |
| achievedAt | 達成日時（ISO8601） |

### ベスト記録を手動でリセットしたい場合

1. `global_bests` シートを開く
2. リセットしたいレベルの行を **行ごと削除**（内容だけ消すのではなく行を削除）
3. 次回そのレベルのスコアが記録されると「初代チャンピオン誕生」として再登録される

全レベルをリセットしたい場合は、ヘッダー行（1行目）を残して2行目以降を全て削除してください。

---

## 動作確認用 curl コマンド

ターミナルから直接GASにデータを送って動作確認できます。

```bash
curl -L -X POST \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{
    "userName": "テスト太郎",
    "level": "Lv.1",
    "score": 10,
    "totalQuestions": 10,
    "correctRate": 1.0,
    "wrongThemes": [],
    "timestamp": "2026-04-17T12:00:00.000Z",
    "durationSec": 120
  }' \
  "https://script.google.com/macros/s/【GASデプロイURL】/exec"
```

成功すると:
- `logs` シートに1行追加される
- `global_bests` に該当レベルの記録がなければ「初代チャンピオン」通知がSlackに飛ぶ

---

## トラブルシューティング

### Slack に通知が来ない

- **Webhook URLを確認**: `gas/Code.gs` の `SLACK_WEBHOOK_URL` が正しいか確認
- **GASのログを確認**: Apps Script エディタ > 実行数 で、エラーが出ていないか確認
- **チャンネルの確認**: Webhook が投稿先に指定しているチャンネルが存在するか確認

### スプレッドシートに記録が残らない

- **スプレッドシートIDを確認**: `gas/Code.gs` の `SPREADSHEET_ID` が正しいか確認
- **シート名を確認**: `logs` と `global_bests` のタブ名が正確か確認（全角・スペースに注意）
- **GASの権限**: 初回デプロイ時に Google アカウントへのアクセス許可を求められるので、許可する

### quiz.html から送信されない

- **GAS_ENDPOINTを確認**: `quiz.html` の `GAS_ENDPOINT` が `'ここに後で貼る'` のままになっていないか確認
- **ブラウザのNetworkタブで確認**:
  1. 開発者ツール（F12）を開く
  2. Network タブを選択
  3. クイズを完了する
  4. `exec` へのリクエストが飛んでいるか確認
  - `no-cors` モードのため、レスポンスは `opaque` と表示されるが、これは正常

### GAS を再デプロイした後に動かない

- デプロイの **バージョンを「新しいバージョン」** にして再デプロイする
  - 既存バージョンのまま保存しても反映されない
- フロントの `GAS_ENDPOINT` URL が新しいデプロイURLに更新されているか確認

### 「権限がありません」エラー

- デプロイ設定で **アクセス権: 全員** になっているか確認
- **実行ユーザー: 自分** になっているか確認
