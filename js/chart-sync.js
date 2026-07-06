// --------------------------------------
// chart-sync.js
// チャート同期・リサイズ処理・初期表示範囲
// --------------------------------------

// 同期用フラグ。旧実装では chart-main.js のトップレベル変数を
// グローバルスコープ共有で参照していたが、本モジュールでのみ使用するため
// ここに閉じ込める（ES Modules化に伴う変更）。
let isSyncing = false;

// ------------------------------
// チャート同期（スクロール・ズーム）
// ------------------------------
export function bindTimeSync(srcChart, targetCharts) {
  if (!srcChart) return;

  srcChart.timeScale().subscribeVisibleTimeRangeChange((range) => {
    if (!range || isSyncing) return;

    isSyncing = true;
    targetCharts.forEach(ch => {
      if (!ch) return;
      ch.timeScale().setVisibleRange(range);
    });
    isSyncing = false;
  });
}

// ------------------------------
// リサイズ処理
// ------------------------------
export function setupResize(priceChart, rciChart, macdChart, chartContainer, rciContainer, macdContainer) {
  window.addEventListener('resize', () => {
    if (priceChart) {
      const r = chartContainer.getBoundingClientRect();
      priceChart.applyOptions({ width: r.width, height: r.height });
    }
    if (rciChart) {
      const r = rciContainer.getBoundingClientRect();
      rciChart.applyOptions({ width: r.width, height: r.height });
    }
    if (macdChart) {
      const r = macdContainer.getBoundingClientRect();
      macdChart.applyOptions({ width: r.width, height: r.height });
    }
  });
}

// ------------------------------
// デフォルト表示期間（直近4ヶ月）
// ------------------------------
export function applyDefaultRange(priceChart, rciChart, macdChart, candleData) {
  if (!candleData || candleData.length === 0) return;

  const lastTime = candleData[candleData.length - 1].time;
  const fourMonthsSec = 60 * 60 * 24 * 30 * 4;
  const fromTime = lastTime - fourMonthsSec;

  priceChart.timeScale().setVisibleRange({ from: fromTime, to: lastTime });
  rciChart.timeScale().setVisibleRange({ from: fromTime, to: lastTime });
  macdChart.timeScale().setVisibleRange({ from: fromTime, to: lastTime });
}
