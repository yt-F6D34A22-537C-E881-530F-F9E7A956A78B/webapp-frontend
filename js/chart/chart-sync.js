// --------------------------------------
// chart-sync.js
// 初期表示範囲・ペイン高さ比の設定
//
// 2026-09 の可読性改修（1チャート3ペイン化）に伴う責務縮小：
//  - bindTimeSync()（価格・RCI・MACD の表示範囲同期）
//      → 3つの独立したチャートを1インスタンス3ペインへ統合したため不要。
//        時間軸はライブラリが1本で管理し、十字カーソルも全ペインを貫通する。
//  - setupResize()（window の resize での再描画）
//      → createChart の autoSize: true（内部で ResizeObserver を使用）へ置換。
//        旧実装は drawChart() のたびに window へ resize リスナを追加し、
//        解除していなかったため、銘柄送り・足種切替のたびにリスナが累積し、
//        remove() 済みのチャートへ applyOptions が走る状態になっていた
//        （2026-09 監査で検出した不具合。autoSize 化により根本解消）。
//  - isSyncing（同期の再帰防止フラグ）
//      → 同期処理自体が無くなったため削除。
//
// 本ファイルには「表示範囲」と「ペイン高さ比」という、
// データ投入後に一度だけ適用する初期化処理のみを残している。
// --------------------------------------
import { PANE_STRETCH } from "./chart-theme.js";

// ------------------------------
// デフォルト表示期間（直近6ヶ月）
// 2026-09 変更：旧「直近4ヶ月」から6ヶ月へ。
// 直後に applyInitialBarRange() が本数ベースで上書きするため、
// 実際の初期表示は本数側が決めるが、両者の基準を揃えておく。
// ------------------------------
export function applyDefaultRange(chart, candleData) {
  if (!chart) return;
  if (!candleData || candleData.length === 0) return;

  const lastTime = candleData[candleData.length - 1].time;
  const sixMonthsSec = 60 * 60 * 24 * 30 * 6;
  const fromTime = lastTime - sixMonthsSec;

  chart.timeScale().setVisibleRange({ from: fromTime, to: lastTime });
}

// ------------------------------
// 初期表示本数（直近 visibleCount 本・論理バー番号ベース）
// 既定の125本は「日足で直近6ヶ月」を基準にした値（1ヶ月 ≒ 21営業日 × 6）。
// 旧実装では chart-main.js の drawChart() に直書きされ、
// 3チャートへ同じ設定を3回適用していた。
// 表示範囲に関する処理として本ファイルへ集約する。
// ------------------------------
export function applyInitialBarRange(chart, candleData, visibleCount = 125) {
  if (!chart) return;
  if (!candleData || candleData.length === 0) return;

  const total = candleData.length;
  const fromIndex = Math.max(0, total - visibleCount);
  const toIndex = total - 1;

  chart.timeScale().setVisibleLogicalRange({ from: fromIndex, to: toIndex });
}

// ------------------------------
// ペイン高さ比
// 旧実装では RCI / MACD の高さを CSS（--rci-macd-height）で固定していたが、
// 3ペイン化に伴い IPaneApi.setStretchFactor による相対指定へ一本化した。
// 比率の値は chart-theme.js の PANE_STRETCH で管理する。
// ------------------------------
export function applyPaneStretch(chart) {
  if (!chart) return;

  const panes = chart.panes();
  const factors = [PANE_STRETCH.price, PANE_STRETCH.rci, PANE_STRETCH.macd];

  panes.forEach((pane, index) => {
    const factor = factors[index];
    if (factor != null) pane.setStretchFactor(factor);
  });
}
