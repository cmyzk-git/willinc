/**
 * simulator/logic.js
 * 【重要】このファイルは「開発用」としてGitに厳重に保管します。
 * サーバー公開時は、これを難読化ツールに通したものをアップロードします。
 */

document.getElementById('todayDate').innerText = new Date().toLocaleDateString();

// シミュレーション計算ロジック
function sim() {
    // 業態、エリア、給与などの計算処理
    console.log("Simulating...");
}

// 初期実行
window.onload = () => {
    sim();
};
