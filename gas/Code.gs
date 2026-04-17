/**
 * 効果測定クイズ — GASバックエンド
 *
 * ========== デプロイ手順 ==========
 * 1. Google スプレッドシートを新規作成し、スプレッドシートIDをコピーして
 *    下の SPREADSHEET_ID に貼り付ける
 * 2. シートを2つ用意する:
 *    - 「logs」      … 全プレイログ（自動でヘッダーが書き込まれる）
 *    - 「global_bests」 … レベル別の全体ベスト記録（自動でヘッダーが書き込まれる）
 * 3. Slack Incoming Webhook URLを取得して SLACK_WEBHOOK_URL に貼り付ける
 * 4. Apps Script エディタで「デプロイ > 新しいデプロイ > ウェブアプリ」を選択
 *    - 実行ユーザー: 自分
 *    - アクセス権: 全員
 * 5. 発行されたURLを quiz.html の GAS_ENDPOINT に貼り付ける
 * ===================================
 */

// ─── 設定 ───
var SPREADSHEET_ID = 'ここにID';
var SLACK_WEBHOOK_URL = 'ここにWebhook URL';

// ─── エントリポイント ───
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    ensureHeaders(ss);
    appendLog(ss, data);
    var result = checkAndUpdateBest(ss, data);

    if (result.notify) {
      sendSlack(result.message);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── ヘッダー自動挿入 ───
function ensureHeaders(ss) {
  var logsSheet = ss.getSheetByName('logs');
  if (logsSheet && logsSheet.getLastRow() === 0) {
    logsSheet.appendRow([
      'timestamp', 'userName', 'level', 'score', 'totalQuestions',
      'correctRate', 'wrongThemes', 'durationSec'
    ]);
  }

  var bestsSheet = ss.getSheetByName('global_bests');
  if (bestsSheet && bestsSheet.getLastRow() === 0) {
    bestsSheet.appendRow([
      'level', 'bestScore', 'totalQuestions', 'holderName', 'achievedAt'
    ]);
  }
}

// ─── ログ追記 ───
function appendLog(ss, data) {
  var sheet = ss.getSheetByName('logs');
  sheet.appendRow([
    data.timestamp,
    data.userName,
    data.level,
    data.score,
    data.totalQuestions,
    data.correctRate,
    Array.isArray(data.wrongThemes) ? data.wrongThemes.join(', ') : '',
    data.durationSec
  ]);
}

// ─── 全体ベスト比較＆更新 ───
function checkAndUpdateBest(ss, data) {
  var sheet = ss.getSheetByName('global_bests');
  var rows = sheet.getDataRange().getValues();

  // Find existing best for this level (skip header row)
  var bestRowIndex = -1;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.level) {
      bestRowIndex = i;
      break;
    }
  }

  var pct = Math.round(data.correctRate * 100);

  // Case 1: No existing record — first champion
  if (bestRowIndex === -1) {
    sheet.appendRow([
      data.level,
      data.score,
      data.totalQuestions,
      data.userName,
      data.timestamp
    ]);
    return {
      notify: true,
      message: ':crown: *' + data.level + '* の初代チャンピオン誕生！\n' +
        '*' + data.userName + '* さんが *' + data.score + '/' + data.totalQuestions + '点* (' + pct + '%) を記録！'
    };
  }

  var prevBest = rows[bestRowIndex][1];
  var prevHolder = rows[bestRowIndex][3];

  // Case 2: New record — beat the best
  if (data.score > prevBest) {
    var rowNum = bestRowIndex + 1; // 1-indexed
    sheet.getRange(rowNum, 1, 1, 5).setValues([[
      data.level,
      data.score,
      data.totalQuestions,
      data.userName,
      data.timestamp
    ]]);
    return {
      notify: true,
      message: ':fire: *' + data.level + '* の全体ベスト更新！\n' +
        '*' + data.userName + '* さんが *' + data.score + '/' + data.totalQuestions + '点* を達成！\n' +
        '(前記録: ' + prevBest + '点 / 保持者: ' + prevHolder + 'さん)'
    };
  }

  // Case 3: Tie record — matches the best (don't update holder)
  if (data.score === prevBest) {
    return {
      notify: true,
      message: ':handshake: *' + data.level + '* の全体ベストにタイ！\n' +
        '*' + data.userName + '* さんも *' + data.score + '/' + data.totalQuestions + '点* を達成！\n' +
        '(現記録保持者: ' + prevHolder + 'さん)'
    };
  }

  // Case 4: Below best — no notification
  return { notify: false };
}

// ─── Slack通知 ───
function sendSlack(message) {
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL === 'ここにWebhook URL') {
    Logger.log('Slack Webhook未設定。通知スキップ: ' + message);
    return;
  }

  var payload = JSON.stringify({ text: message });
  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: payload
  });
}
