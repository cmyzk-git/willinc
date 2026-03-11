/**
 * 求人飲食店ドットコム ヒアリングツール - GAS統合スクリプト v2.0
 * =============================================================
 * 対応フォーム：
 *   - 求人ヒアリングフォーム v3.0.0  (formType: "unified") ★メイン
 *   - 店舗情報フォーム v2.0.0        (formType: "store")   ※旧版互換
 *   - 求人原稿フォーム v2.4.0        (formType: "job")     ※旧版互換
 *
 * 【設置手順】
 *  1. https://script.google.com にアクセス
 *  2. 「新しいプロジェクト」を作成し、このコードを貼り付けて保存
 *  3. 下記【設定エリア】を編集する
 *  4. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」を選択
 *     - 実行するユーザー：自分
 *     - アクセスできるユーザー：全員
 *  5. 発行された「ウェブアプリURL」をHTMLファイルの GAS_URL に貼り付ける
 *
 * 【Googleドライブの保存構造】
 *  📁 求人ヒアリング（PARENT_FOLDER_ID で指定）
 *    └── 📁 株式会社〇〇_ビストロ〇〇渋谷店
 *          ├── 店舗情報_2026-03-11.json
 *          └── 求人原稿_2026-03-11.csv
 */

// =============================================================
// 【設定エリア】ここを編集してください
// =============================================================

/** 通知メールの送信先（代理店担当者のメールアドレス） */
const NOTIFY_EMAIL = 'your-email@example.com';

/**
 * Googleドライブの保存先フォルダID
 * 空文字 = マイドライブ直下
 * フォルダIDはドライブURLの末尾: https://drive.google.com/drive/folders/【ここ】
 */
const PARENT_FOLDER_ID = '';

/** 通知メールの送信者名 */
const SENDER_NAME = '求人飲食店ドットコム ヒアリングツール';

// =============================================================
// メインルーター
// =============================================================

function doPost(e) {
    try {
        const payload  = JSON.parse(e.postData.contents);
        const formType = payload.formType || 'unknown';

        if      (formType === 'unified') return handleUnified(payload);
        else if (formType === 'store')   return handleStore(payload);
        else if (formType === 'job')     return handleJob(payload);
        else return jsonResponse({ status: 'error', message: '不明なフォーム種別: ' + formType });

    } catch (err) {
        return jsonResponse({ status: 'error', message: err.toString() });
    }
}

/** 動作確認用（GETリクエスト） */
function doGet() {
    return jsonResponse({ status: 'ok', message: 'GAS WebApp is running. v2.0' });
}

// =============================================================
// unified フォーム処理（v3.0.0統合版）
// =============================================================

function handleUnified(payload) {
    const clientName  = payload.clientName  || '未設定';
    const storeData   = payload.storeData   || {};
    const csvContent  = payload.csvContent  || '';
    const csvFileName = payload.csvFileName || `求人原稿_${clientName}_${formatDate(new Date())}.csv`;

    const folder = getOrCreateFolder(getParentFolder(), clientName);
    const date   = formatDate(new Date());
    const results = {};

    // ---- 店舗情報をJSONで保存（storeDataに中身がある場合のみ）----
    const hasStoreData = Object.keys(storeData).filter(k =>
        !['formType','clientName','submittedAt'].includes(k) && String(storeData[k]).trim() !== ''
    ).length > 0;

    if (hasStoreData) {
        const storeFileName = `店舗情報_${clientName}_${date}.json`;
        deleteIfExists(folder, storeFileName);
        const blob = Utilities.newBlob(JSON.stringify(storeData, null, 2), 'application/json', storeFileName);
        const file = folder.createFile(blob);
        results.storeFileId  = file.getId();
        results.storeFileUrl = file.getUrl();
    }

    // ---- 求人原稿をCSVで保存 ----
    if (csvContent.trim().replace(/^\uFEFF/, '') !== '') {
        deleteIfExists(folder, csvFileName);
        const cleaned = csvContent.replace(/^\uFEFF/, '');
        const blob = Utilities.newBlob(cleaned, 'text/csv; charset=utf-8', csvFileName);
        const file = folder.createFile(blob);
        results.csvFileId  = file.getId();
        results.csvFileUrl = file.getUrl();
    }

    // ---- 通知メール ----
    const subject = `【求人ヒアリング受信】${clientName}`;
    const body    = buildUnifiedEmailBody(clientName, storeData, csvFileName, hasStoreData, folder.getUrl(), results);
    sendNotification(subject, body);

    return jsonResponse({
        status: 'ok',
        folderUrl: folder.getUrl(),
        ...results
    });
}

function buildUnifiedEmailBody(clientName, storeData, csvFileName, hasStore, folderUrl, results) {
    const lines = [
        '求人ヒアリングフォームから新規データを受信しました。',
        '',
        `■ クライアント名：${clientName}`,
        `■ 受信日時：${formatDateTime(new Date())}`,
        '',
    ];

    if (hasStore) {
        lines.push('■ 店舗情報（入力あり）');
        if (storeData.s_companyName) lines.push(`  法人名：${storeData.s_companyName}`);
        if (storeData.s_storeName)   lines.push(`  店舗名：${storeData.s_storeName}`);
        if (storeData.s_staffName)   lines.push(`  担当者：${storeData.s_staffName}${storeData.s_staffTitle ? '（' + storeData.s_staffTitle + '）' : ''}`);
        if (storeData.s_tel_contact) lines.push(`  連絡先：${storeData.s_tel_contact}`);
        if (storeData.s_email_1)     lines.push(`  メール：${storeData.s_email_1}`);
        if (results.storeFileUrl)    lines.push(`  JSONファイル：${results.storeFileUrl}`);
        lines.push('');
    } else {
        lines.push('■ 店舗情報：入力なし（既存顧客のため省略）');
        lines.push('');
    }

    lines.push(`■ 求人原稿ファイル：${csvFileName}`);
    if (results.csvFileUrl) lines.push(`  CSVファイル：${results.csvFileUrl}`);
    lines.push('');
    lines.push(`■ Googleドライブフォルダ：${folderUrl}`);

    return lines.join('\n');
}

// =============================================================
// store フォーム処理（v2.0.0 旧版互換）
// =============================================================

function handleStore(data) {
    const clientName  = data.clientName || '未設定';
    const folder      = getOrCreateFolder(getParentFolder(), clientName);
    const date        = formatDate(new Date());
    const fileName    = `店舗情報_${clientName}_${date}.json`;

    deleteIfExists(folder, fileName);
    const blob = Utilities.newBlob(JSON.stringify(data, null, 2), 'application/json', fileName);
    const file = folder.createFile(blob);

    const subject = `【店舗情報受信】${data.storeName || clientName}`;
    const body = [
        '店舗情報ヒアリングフォームから新規データを受信しました。',
        '',
        `■ 法人名：${data.companyName || ''}`,
        `■ 店舗名：${data.storeName || ''}`,
        `■ 担当者：${data.staffName || ''}`,
        `■ 受信日時：${data.submittedAt || formatDateTime(new Date())}`,
        '',
        `■ JSONファイル：${file.getUrl()}`,
        `■ フォルダ：${folder.getUrl()}`,
    ].join('\n');
    sendNotification(subject, body);

    return jsonResponse({ status: 'ok', fileId: file.getId(), fileUrl: file.getUrl(), folderUrl: folder.getUrl() });
}

// =============================================================
// job フォーム処理（v2.4.0 旧版互換）
// =============================================================

function handleJob(data) {
    const clientName  = data.clientName || '未設定';
    const fileName    = data.fileName   || `求人原稿_${clientName}_${formatDate(new Date())}.csv`;
    const csvContent  = data.csvContent || '';

    if (!csvContent.trim()) {
        return jsonResponse({ status: 'error', message: 'CSVデータが空です。' });
    }

    const folder  = getOrCreateFolder(getParentFolder(), clientName);
    const cleaned = csvContent.replace(/^\uFEFF/, '');
    deleteIfExists(folder, fileName);
    const blob = Utilities.newBlob(cleaned, 'text/csv; charset=utf-8', fileName);
    const file = folder.createFile(blob);

    const subject = `【求人原稿受信】${clientName}`;
    const body = [
        '求人原稿作成フォームから新規データを受信しました。',
        '',
        `■ クライアント名：${clientName}`,
        `■ ファイル名：${fileName}`,
        `■ 受信日時：${formatDateTime(new Date())}`,
        '',
        `■ CSVファイル：${file.getUrl()}`,
        `■ フォルダ：${folder.getUrl()}`,
    ].join('\n');
    sendNotification(subject, body);

    return jsonResponse({ status: 'ok', fileId: file.getId(), fileUrl: file.getUrl(), folderUrl: folder.getUrl() });
}

// =============================================================
// 共通ユーティリティ
// =============================================================

function getParentFolder() {
    return PARENT_FOLDER_ID
        ? DriveApp.getFolderById(PARENT_FOLDER_ID)
        : DriveApp.getRootFolder();
}

function getOrCreateFolder(parent, name) {
    const iter = parent.getFoldersByName(name);
    return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

function deleteIfExists(folder, fileName) {
    const iter = folder.getFilesByName(fileName);
    while (iter.hasNext()) iter.next().setTrashed(true);
}

function sendNotification(subject, body) {
    if (!NOTIFY_EMAIL || NOTIFY_EMAIL === 'your-email@example.com') return;
    MailApp.sendEmail({ to: NOTIFY_EMAIL, subject, body, name: SENDER_NAME });
}

function jsonResponse(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateTime(date) {
    return date.toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
