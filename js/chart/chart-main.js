// --------------------------------------
// chart-main.js
// モーダル制御・チャート描画の司令塔
//
// 2026-09 の可読性改修（1チャート3ペイン化）により、本ファイルは
// 「価格・RCI・MACD の3チャートを生成して同期させる」構成から、
// 「1つの chart インスタンスに3ペインを積み、インジケータ記述子を
//   組み立てる合成ルート（composition root）」へ変わった。
//   ・時間軸は最下段に1本だけ描画される（旧：3本重複）
//   ・十字カーソルは3ペインを貫通する（旧：ペインごとに独立）
//   ・価格軸幅・リサイズはライブラリが管理する（旧：手動 resize リスナ）
// --------------------------------------
import { fetchChartData, clearChartDataCache } from "./chart-data.js";
import { PRICE_INDICATORS } from "./chart-price.js";
import { RCI_INDICATORS } from "./chart-rci.js";
import { MACD_INDICATORS } from "./chart-macd.js";
import { createLegend } from "./chart-legend.js";
import { getTheme, formatTickMark } from "./chart-theme.js";
import {
  applyDefaultRange,
  applyInitialBarRange,
  applyPaneStretch,
} from "./chart-sync.js";

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
const chartLoadingOverlay = document.getElementById("chartLoadingOverlay");

const headerLeft = document.getElementById("chartHeaderLeft");
const prevBtn = document.getElementById("prevChartBtn");
const nextBtn = document.getElementById("nextChartBtn");

// 設定 UI
const settingsBtn = document.getElementById("chartSettingsBtn");
const settingsModal = document.getElementById("chartSettingsModal");

// インジケータ表示トグル（data-indicator-group をフックに一括取得する。
// 旧実装はチェックボックスごとに個別の addEventListener と専用セッター
// （setShowCandles / setShowMA / setShowBB / setShowIchimoku）を持っていたため、
// インジケータを1つ増やすたびに index.html・chart-main.js・chart-price.js の
// 3ファイルへ追記する必要があった）
const indicatorToggles = document.querySelectorAll('input[data-indicator-group]');

// 初期表示本数（論理バー番号ベース）
// 日足で直近6ヶ月が収まる本数を基準にする（1ヶ月あたり約21営業日 × 6 ≒ 125本）。
// 週足・月足も同じ本数を表示するため、足種に応じて表示期間は自然に伸びる
// （週足: 約2年5ヶ月 / 月足: 約10年。データがそれより短い場合は
//  fixLeftEdge: true により先頭で止まる）。
const INITIAL_BAR_COUNT = 125;

// 足種ラジオボタン
const timeframeRadios = document.querySelectorAll('input[name="timeframe"]');
let currentTimeframe = "1d";   // 初期値（日足）

// 初期状態ではモーダル非表示
modal.style.display = "none";

// --------------------------------------
// インジケータ記述子の集合（表示順＝ペインの生成順）
// 価格ペイン（0）→ RCIペイン（1）→ MACDペイン（2）の順に
// シリーズを追加することで、ライブラリ側にペインを順番に生成させる。
// --------------------------------------
const INDICATOR_GROUPS = [
  ...PRICE_INDICATORS,
  ...RCI_INDICATORS,
  ...MACD_INDICATORS,
];

// チャートインスタンス（1つ）
let chart = null;
let legend = null;
let builtGroups = new Map();   // groupKey -> { descriptor, series, primitives, legend }
let lastBarTime = null;

let currentIndex = 0;
let screeningResults = [];

// screening.js から結果を受け取る
window.setScreeningResults = function(results) {
  screeningResults = results;
};

// --------------------------------------
// 表示設定の永続化（2026-09 追加）
// トグル状態の「真実」は index.html のチェックボックス1か所に置き、
// localStorage はその復元元としてのみ使う。
// localStorage はプライベートブラウズ等で例外を投げうるため必ず try/catch する。
// --------------------------------------
const VISIBILITY_STORAGE_KEY = "chartIndicatorVisibility";

function loadVisibilityPreferences() {
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch (e) {
    console.warn("表示設定の読み込みに失敗しました:", e);
    return {};
  }
}

function saveVisibilityPreferences() {
  try {
    const prefs = {};
    indicatorToggles.forEach(input => {
      prefs[input.dataset.indicatorGroup] = input.checked;
    });
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("表示設定の保存に失敗しました:", e);
  }
}

// 保存値があればチェックボックスへ復元する（無ければ HTML の checked を採用）
function restoreTogglesFromPreferences() {
  const prefs = loadVisibilityPreferences();
  indicatorToggles.forEach(input => {
    const key = input.dataset.indicatorGroup;
    if (typeof prefs[key] === "boolean") input.checked = prefs[key];
  });
}
restoreTogglesFromPreferences();

// --------------------------------------
// 表示状態の解決と適用
// --------------------------------------
function isGroupVisible(descriptor) {
  if (!descriptor.toggleId) return descriptor.defaultVisible !== false;

  const input = document.getElementById(descriptor.toggleId);
  return input ? input.checked : (descriptor.defaultVisible !== false);
}

function applyGroupVisibility(groupKey, visible) {
  const built = builtGroups.get(groupKey);
  if (!built) return;

  if (typeof built.descriptor.setVisible === "function") {
    // 既定の visible 切替では都合が悪いグループ（ローソク足）用の差し込み口
    built.descriptor.setVisible(built, visible);
  } else {
    built.series.forEach(s => s.applyOptions({ visible }));
  }

  built.primitives.forEach(p => p.setVisible(visible));

  // 非表示のインジケータの値を HUD 凡例にも残さない
  if (legend) legend.setGroupVisible(groupKey, visible);
}

function applyAllVisibility() {
  builtGroups.forEach((built, key) => {
    applyGroupVisibility(key, isGroupVisible(built.descriptor));
  });
}

// モーダルを閉じる
function closeModal() {
  modal.style.display = "none";

  // ここで一度だけ remove し、必ず null にする（再度 remove されないように）
  if (chart) {
    chart.remove();
    chart = null;
  }

  legend = null;
  builtGroups = new Map();
  lastBarTime = null;

  chartContainer.innerHTML = "";

  // モーダルを開いている間だけ保持していた取得結果を破棄する
  clearChartDataCache();
}

closeBtn.addEventListener("click", closeModal);
document.getElementById("chartModalBackdrop").addEventListener("click", closeModal);

// chartContainer の高さが確定するまで待つ
function waitForHeight(callback) {
  const h = chartContainer.getBoundingClientRect().height;
  if (h > 0) callback();
  else setTimeout(() => waitForHeight(callback), 30);
}

// モーダルを開く
window.openChartModal = function(ticker, name, index) {
  currentIndex = index;

  // 銘柄名は data.json（JPX 由来）の値であり、innerHTML でそのまま
  // 埋め込むと HTML として解釈されうるため textContent で描画する
  // （2026-09、XSS 経路の遮断）
  headerLeft.textContent = "";
  headerLeft.appendChild(makeHeaderSpan("ticker", ticker));
  headerLeft.appendChild(makeHeaderSpan("name", name));
  headerLeft.appendChild(
    makeHeaderSpan("page", `（${currentIndex + 1}/${screeningResults.length}）`)
  );

  modal.style.display = "flex";
  // オーバーレイ制御は drawChart() で一元化

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      waitForHeight(() => drawChart(ticker, name));
    });
  });
};

function makeHeaderSpan(className, text) {
  const span = document.createElement("span");
  span.className = className;   // 見た目の指定のみ（style.css が参照）
  span.textContent = text;
  return span;
}

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

// インジケータ表示トグル（記述子ベースの一括バインド）
indicatorToggles.forEach(input => {
  input.addEventListener("change", (e) => {
    applyGroupVisibility(e.target.dataset.indicatorGroup, e.target.checked);
    saveVisibilityPreferences();
  });
});

// 足種切替イベント
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

  // サーバ通信前に必ずオーバーレイを表示する（共通仕様）
  chartLoadingOverlay.style.display = "flex";

  try {
    // 足種をバックエンドへ渡す
    const data = await fetchChartData(ticker, currentTimeframe);

    if (!data) {
      alert("チャートデータが取得できませんでした。");
      return;
    }

    const tradingData = data;

    if (tradingData.length === 0) {
      alert("有効なチャートデータがありません。");
      return;
    }

    // 既存チャート破棄（closeModal で null にしているので二重 remove は起きない）
    if (chart) {
      chart.remove();
      chart = null;
    }
    legend = null;
    builtGroups = new Map();

    chartContainer.innerHTML = "";

    const T = getTheme();

    // ① チャート本体（1インスタンス・3ペイン）
    chart = LightweightCharts.createChart(chartContainer, {
      // autoSize: 内部の ResizeObserver がコンテナ追従で再描画する。
      // 旧実装の window resize リスナ（多重登録の原因）を置き換える。
      autoSize: true,
      layout: {
        background: { color: T.background },
        textColor: T.textColor,
        panes: {
          separatorColor: T.paneSeparator,
          separatorHoverColor: T.paneSeparator,
          enableResize: true,
        },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
        borderColor: T.border,
        // 3ペインの価格軸幅を揃え、プロット領域の左右をそろえる
        minimumWidth: 64,
      },
      timeScale: {
        borderVisible: true,
        borderColor: T.border,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkSpacing: 50,
      },
      grid: {
        // 縦グリッドはローソク足と干渉するため非表示（chart-theme.js で管理）
        vertLines: { color: T.gridVert },
        horzLines: { color: T.gridHorz },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      localization: {
        locale: 'ja-JP',
        dateFormat: 'yyyy/MM/dd',
      },
    });

    // 年跨ぎ・週足・月足でも粒度が読めるラベル整形（chart-theme.js）
    chart.timeScale().applyOptions({
      tickMarkFormatter: formatTickMark,
    });

    // ② インジケータ記述子からシリーズを生成する
    for (const descriptor of INDICATOR_GROUPS) {
      const built = descriptor.build(chart, tradingData);
      builtGroups.set(descriptor.key, {
        descriptor,
        series: built.series ?? [],
        primitives: built.primitives ?? [],
        legend: built.legend ?? [],
      });
    }

    // ③ ペイン高さ比
    applyPaneStretch(chart);

    // ④ HUD凡例（値表示付き固定凡例）
    legend = createLegend(
      chartContainer,
      INDICATOR_GROUPS.map(d => ({
        key: d.key,
        legend: builtGroups.get(d.key).legend,
      }))
    );

    // ⑤ 表示トグルの状態を反映（チェックボックスが唯一の真実）
    applyAllVisibility();

    // ⑥ 十字カーソル移動で HUD の数値のみを差し替える。
    //    カーソルがチャート外にある場合は最新バーの値へフォールバックし、
    //    常に何らかの値が読める状態を保つ。
    lastBarTime = tradingData[tradingData.length - 1].time;

    chart.subscribeCrosshairMove(param => {
      legend.update(param.time ?? lastBarTime);

      // カーソルがチャート左半分にあるときは凡例を右上へ退避させる
      if (param.point) {
        const halfWidth = chartContainer.clientWidth / 2;
        legend.setSide(param.point.x < halfWidth ? "right" : "left");
      } else {
        legend.setSide("left");
      }
    });

    legend.update(lastBarTime);   // 初期表示

    // ⑦ デフォルト表示期間（直近6ヶ月）→ 直近 INITIAL_BAR_COUNT 本で上書き
    applyDefaultRange(chart, tradingData);
    applyInitialBarRange(chart, tradingData, INITIAL_BAR_COUNT);

  } finally {
    // 必ずオーバーレイを非表示にする（共通仕様）
    chartLoadingOverlay.style.display = "none";
  }
}
