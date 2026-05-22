// --------------------------------------
// chart-main.js
// モーダル制御・チャート描画の司令塔
// --------------------------------------

// iPhone Safari の余白対策
function updateVh() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
updateVh();
window.addEventListener('resize', updateVh);

// 要素取得
const modal = document.getElementById("chartModal");
const closeBtn = document.getElementById("closeChartBtn");
const chartContainer = document.getElementById("chartContainer");
const rciContainer = document.getElementById("rciContainer");
const macdContainer = document.getElementById("macdContainer");
const chartLoadingOverlay = document.getElementById("chartLoadingOverlay");

const headerLeft = document.getElementById("chartHeaderLeft");
const prevBtn = document.getElementById("prevChartBtn");
const nextBtn = document.getElementById("nextChartBtn");

// 設定 UI
const settingsBtn = document.getElementById("chartSettingsBtn");
const settingsModal = document.getElementById("chartSettingsModal");
const toggleCandlesCheckbox = document.getElementById("toggleCandles");
const toggleMACheckbox = document.getElementById("toggleMA");
const toggleBBCheckbox = document.getElementById("toggleBB");
const toggleIchimokuCheckbox = document.getElementById("toggleIchimoku");

// ★ 足種ラジオボタン
const timeframeRadios = document.querySelectorAll('input[name="timeframe"]');
let currentTimeframe = "1d";   // 初期値（日足）

// 初期状態ではモーダル非表示
modal.style.display = "none";

// チャートインスタンス
let priceChart = null;
let rciChart = null;
let macdChart = null;

let currentIndex = 0;
let screeningResults = [];

// screening.js から結果を受け取る
window.setScreeningResults = function(results) {
  screeningResults = results;
};

// モーダルを閉じる
function closeModal() {
  modal.style.display = "none";

  if (priceChart) priceChart.remove();
  if (rciChart) rciChart.remove();
  if (macdChart) macdChart.remove();

  chartContainer.innerHTML = "";
  rciContainer.innerHTML = "";
  macdContainer.innerHTML = "";
}

closeBtn.addEventListener("click", closeModal);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);

// chartContainer の高さが確定するまで待つ
function waitForHeight(callback) {
  const h = chartContainer.getBoundingClientRect().height;
  if (h > 0) callback();
  else setTimeout(() => waitForHeight(callback), 30);
}

// モーダルを開く
window.openChartModal = function(ticker, name, index) {
  currentIndex = index;

  headerLeft.innerHTML = `
    <span class="ticker">${ticker}</span>
    <span class="name">${name}</span>
    <span class="page">（${currentIndex + 1}/${screeningResults.length}）</span>
  `;

  modal.style.display = "flex";
  chartLoadingOverlay.style.display = "flex";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      waitForHeight(() => drawChart(ticker, name));
    });
  });
};

// 前へ・次へ
window.showPrev = function() {
  if (screeningResults.length === 0) return;
  currentIndex = (currentIndex - 1 + screeningResults.length) % screeningResults.length;
  const r = screeningResults[currentIndex];
  window.openChartModal(r.コード, r.銘柄名, currentIndex);
};

window.showNext = function() {
  if (screeningResults.length === 0) return;
  currentIndex = (currentIndex + 1) % screeningResults.length;
  const r = screeningResults[currentIndex];
  window.openChartModal(r.コード, r.銘柄名, currentIndex);
};

prevBtn.onclick = window.showPrev;
nextBtn.onclick = window.showNext;

// キーボード操作
window.addEventListener("keydown", (e) => {
  if (modal.style.display !== "flex") return;
  if (e.key === "ArrowLeft") window.showPrev();
  if (e.key === "ArrowRight") window.showNext();
});

// 歯車アイコン → 子モーダル
settingsBtn.addEventListener("click", () => {
  settingsModal.classList.toggle("hidden");
});

// 子モーダル外クリックで閉じる
document.addEventListener("click", (e) => {
  if (!settingsModal.contains(e.target) && e.target !== settingsBtn) {
    settingsModal.classList.add("hidden");
  }
});

// ローソク足の見た目切り替え
toggleCandlesCheckbox.addEventListener("change", (e) => {
  showCandles = e.target.checked;
  if (typeof applyCandleVisibility === "function") applyCandleVisibility();
});

// MA の表示/非表示
toggleMACheckbox.addEventListener("change", (e) => {
  showMA = e.target.checked;
  if (typeof applyMAVisibility === "function") applyMAVisibility();
});

// BB の表示/非表示
toggleBBCheckbox.addEventListener("change", (e) => {
  showBB = e.target.checked;
  if (typeof applyBBVisibility === "function") applyBBVisibility();
});

// 一目均衡表の表示/非表示
toggleIchimokuCheckbox.addEventListener("change", (e) => {
  showIchimoku = e.target.checked;
  if (typeof applyIchimokuVisibility === "function") applyIchimokuVisibility();
});

// ★ 足種切替イベント
timeframeRadios.forEach(radio => {
  radio.addEventListener("change", (e) => {
    currentTimeframe = e.target.value;

    const r = screeningResults[currentIndex];
    if (r) {
      drawChart(r.コード, r.銘柄名);
    }
  });
});

// ------------------------------
// drawChart（司令塔）
// ------------------------------
async function drawChart(ticker, name) {

  // ★ 足種をバックエンドへ渡す
  const data = await fetchChartData(ticker, currentTimeframe);

  if (!data) {
    alert("チャートデータが取得できませんでした。");
    chartLoadingOverlay.style.display = "none";
    return;
  }

  const tradingData = data;

  if (tradingData.length === 0) {
    alert("有効なチャートデータがありません。");
    chartLoadingOverlay.style.display = "none";
    return;
  }

  // 既存チャート破棄
  if (priceChart) priceChart.remove();
  if (rciChart) rciChart.remove();
  if (macdChart) macdChart.remove();

  chartContainer.innerHTML = "";
  rciContainer.innerHTML = "";
  macdContainer.innerHTML = "";

  // ① 価格チャート
  const rect = chartContainer.getBoundingClientRect();
  priceChart = LightweightCharts.createChart(chartContainer, {
    width: rect.width,
    height: rect.height,
    layout: {
      background: { color: '#ffffff' },
      textColor: '#333',
    },
    rightPriceScale: { visible: true, borderVisible: true },
    timeScale: {
      borderVisible: true,
      timeVisible: false,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkSpacing: 50,
    },
    grid: {
      vertLines: { color: '#eee' },
      horzLines: { color: '#eee' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
  });

  priceChart.applyOptions({
    localization: {
      locale: 'ja-JP',
      dateFormat: 'yyyy/MM/dd',
    },
  });

  priceChart.timeScale().applyOptions({
    tickMarkFormatter: (time) => {
      const date = new Date(time * 1000);
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${m}/${d}`;
    },
  });

  // ② 価格チャートシリーズ生成
  createPriceChart(priceChart, tradingData);

  const price = { chart: priceChart };

  // ③ RCI / MACD チャート生成
  const rci = createRciChart(tradingData);
  const macd = createMacdChart(tradingData);

  // ④ 同期処理
  bindTimeSync(price.chart, [rci.chart, macd.chart]);
  bindTimeSync(rci.chart, [price.chart, macd.chart]);
  bindTimeSync(macd.chart, [price.chart, rci.chart]);

  // ⑤ リサイズ処理
  setupResize(price.chart, rci.chart, macd.chart);

  // ⑥ デフォルト表示期間（初期位置調整）
  applyDefaultRange(price.chart, rci.chart, macd.chart, tradingData);

  // ★ 直近80本だけ表示（描画完了後に適用）
  const total = tradingData.length;
  const visibleCount = 80;
  const fromIndex = Math.max(0, total - visibleCount);
  const toIndex = total - 1;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      price.chart.timeScale().setVisibleLogicalRange({
        from: fromIndex,
        to: toIndex
      });
      rci.chart.timeScale().setVisibleLogicalRange({
        from: fromIndex,
        to: toIndex
      });
      macd.chart.timeScale().setVisibleLogicalRange({
        from: fromIndex,
        to: toIndex
      });
    });
  });

  chartLoadingOverlay.style.display = "none";
}
