const startBtn = document.getElementById("startBtn");
const cancelBtn = document.getElementById("cancelBtn");
const progressText = document.getElementById("progressText");
const elapsedTimeEl = document.getElementById("elapsedTime");
const tbody = document.querySelector("#resultTable tbody");

const dateSelect = document.getElementById("dateSelect");                     // date_ranking 用
const ratioDateSelect = document.getElementById("ratioDateSelect");           // ratio 用
const heuristicsDateSelect = document.getElementById("heuristicsDateSelect"); // heuristics 用

const loadingOverlay = document.getElementById("loadingOverlay");

let abortController = null;
let currentResults = [];
let sortState = {};
let elapsedSeconds = 0;
let timerId = null;

const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

/* ============================
   TECH_* 日本語ラベル
============================ */
const TECH_LABELS = {
  // MA SLOPE
  "TECH_MA_SLOPE_DAILY": "移動平均線の傾き（日足）",
  "TECH_MA_SLOPE_WEEKLY": "移動平均線の傾き（週足）",
  "TECH_MA_SLOPE_MONTHLY": "移動平均線の傾き（月足）",

  // MA POSITION
  "TECH_MA_POSITION_DAILY": "移動平均線の位置（日足）",
  "TECH_MA_POSITION_WEEKLY": "移動平均線の位置（週足）",
  "TECH_MA_POSITION_MONTHLY": "移動平均線の位置（月足）",

  // PERFECT ORDER
  "TECH_PERFECT_ORDER_DAILY": "パーフェクトオーダー（日足）",
  "TECH_PERFECT_ORDER_WEEKLY": "パーフェクトオーダー（週足）",
  "TECH_PERFECT_ORDER_MONTHLY": "パーフェクトオーダー（月足）",

  "TECH_REVERSE_PERFECT_ORDER_DAILY": "逆パーフェクトオーダー（日足）",
  "TECH_REVERSE_PERFECT_ORDER_WEEKLY": "逆パーフェクトオーダー（週足）",
  "TECH_REVERSE_PERFECT_ORDER_MONTHLY": "逆パーフェクトオーダー（月足）",

  // PRE-PO / PRE-RPO
  "TECH_PRE_PERFECT_ORDER_DAILY": "直前PO（日足）",
  "TECH_PRE_PERFECT_ORDER_WEEKLY": "直前PO（週足）",
  "TECH_PRE_PERFECT_ORDER_MONTHLY": "直前PO（月足）",

  "TECH_PRE_REVERSE_PERFECT_ORDER_DAILY": "直前逆PO（日足）",
  "TECH_PRE_REVERSE_PERFECT_ORDER_WEEKLY": "直前逆PO（週足）",
  "TECH_PRE_REVERSE_PERFECT_ORDER_MONTHLY": "直前逆PO（月足）",

  // MA CONGESTION
  "TECH_MA_CONGESTION": "移動平均線の収束",

  // MA SPREAD
  "TECH_MA_SPREAD": "移動平均線の拡散",

  // MA100 TREND
  "TECH_MA100_TREND": "100MAトレンド",

  // 下半身
  "TECH_KAHANSHIN": "下半身",
  "TECH_GYAKU_KAHANSHIN": "逆下半身",

  // 5MA UPDATE
  "TECH_5MA_UPDATE": "5MA更新",

  // 酒田五法
  "TECH_SAKATA_TRIPLE_TOP": "三尊天井",
  "TECH_SAKATA_TRIPLE_BOTTOM": "逆三尊",
  "TECH_SAKATA_SANKU_UP": "三空（上）",
  "TECH_SAKATA_SANKU_DOWN": "三空（下）",
  "TECH_SAKATA_SANPEI_UP": "三兵（上）",
  "TECH_SAKATA_SANPEI_DOWN": "三兵（下）",
  "TECH_SAKATA_SANPO_UP": "三法（上）",
  "TECH_SAKATA_SANPO_DOWN": "三法（下）",

  // パターン
  "TECH_HEAD_AND_SHOULDERS": "ヘッド＆ショルダー",
  "TECH_DOUBLE_BOTTOM": "ダブルボトム",
  "TECH_NICHI_DAI": "日大（上）",
  "TECH_GYAKU_NICHI_DAI": "逆日大（下）",

  // Monowakare
  "TECH_MONOWAKARE": "物別れ",
  "TECH_MONOWAKARE_RED_BLUE_CROSS": "物別れクロス",

  // Rule9
  "TECH_RULE9_DAILY": "Rule9（日足）",
  "TECH_RULE9_WEEKLY": "Rule9（週足）",

  // BB ZONE BREAK
  "TECH_BB_ZONE_BREAK_DAILY": "BBゾーンブレイク（日足）",
  "TECH_BB_ZONE_BREAK_WEEKLY": "BBゾーンブレイク（週足）",
  "TECH_BB_ZONE_BREAK_MONTHLY": "BBゾーンブレイク（月足）",

  // BOX RANGE
  "TECH_BOX_RANGE": "ボックスレンジ",

  // OVERHEAT
  "TECH_OVERHEAT": "過熱",

  // GRANVILLE
  "TECH_GRANVILLE": "グランビル",

  // In-In / ReturnSellEnd / DownTrendEnd / Momiai
  "TECH_IN_IN_HARAMI": "陰の陰はらみ",
  "TECH_RETURN_SELL_END": "戻り待ち売り後",
  "TECH_DOWN_TREND_END": "下降相場の終わり",
  "TECH_MOMIAI": "揉み合い",

  // Cycle Progress
  "TECH_CYCLE_PROGRESS": "サイクル進行度",

  // Fushime
  "TECH_FUSHIME_UP": "節目（上）",
  "TECH_FUSHIME_DOWN": "節目（下）"
};

function boolMark(v) {
  return v === true ? "○" : v === false ? "×" : "";
}

function formatRule9(obj) {
  if (!obj || !obj.direction) return "";
  const arrow = obj.direction === "up" ? "↗" :
                obj.direction === "down" ? "↘" : "";
  return `${arrow}（${obj.count} 本目）`;
}

/* ============================
   DOM 完全構築後
============================ */
window.onload = () => {
  initSearchMode();
  loadDates();
  loadHeuristicsDates();
};

/* ============================
   モード切替
============================ */
function initSearchMode() {
  const radios = document.querySelectorAll('input[name="searchMode"]');
  const ratioInputs = document.querySelectorAll("#ratioConditions input, #ratioConditions select");
  const dateInputs = document.querySelectorAll("#dateConditions select");
  const heuristicsInputs = document.querySelectorAll("#heuristicsConditions select");

  function updateMode() {
    const mode = document.querySelector('input[name="searchMode"]:checked').value;

    ratioInputs.forEach(i => i.disabled = (mode !== "ratio"));
    dateInputs.forEach(i => i.disabled = (mode !== "date"));
    heuristicsInputs.forEach(i => i.disabled = (mode !== "heuristics"));
  }

  radios.forEach(r => r.addEventListener("change", updateMode));
  updateMode();
}

/* ============================
   /dates のロード
============================ */
async function loadDates() {
  try {
    dateSelect.innerHTML = "";
    dateSelect.appendChild(new Option("読み込み中...", ""));

    ratioDateSelect.innerHTML = "";
    ratioDateSelect.appendChild(new Option("読み込み中...", ""));

    const res = await fetch(`${API_BASE_URL}/dates`);
    const data = await res.json();

    if (!data.status || data.status !== "ok") {
      console.error("dates API error:", { httpStatus: res.status, body: data });
      dateSelect.innerHTML = `<option value="">取得失敗</option>`;
      ratioDateSelect.innerHTML = `<option value="">取得失敗</option>`;
      return;
    }

    const dates = data.dates;

    // date_ranking 用
    dateSelect.innerHTML = "";
    dates.forEach(d => dateSelect.appendChild(makeOption(d)));

    // ratio 用（最古日除外）
    ratioDateSelect.innerHTML = "";
    if (dates.length >= 2) {
      const ratioDates = dates.slice(0, dates.length - 1); // 最古日を除外
      ratioDates.forEach(d => ratioDateSelect.appendChild(makeOption(d)));
    }

  } catch (e) {
    console.error("日付取得エラー:", e);
  }
}

/* ============================
   /heuristics_dates のロード
============================ */
async function loadHeuristicsDates() {
  const select = heuristicsDateSelect;
  if (!select) return;

  select.innerHTML = `<option>読み込み中...</option>`;

  try {
    const res = await fetch(`${API_BASE_URL}/heuristics_dates`);
    const data = await res.json();

    if (!data || data.status !== "ok") {
      console.error("heuristics_dates API error:", {
        httpStatus: res.status,
        body: data
      });
      select.innerHTML = `<option value="">取得失敗</option>`;
      return;
    }

    const dates = data.dates;
    const latest = dates[0];

    select.innerHTML = "";
    select.appendChild(new Option("最新を使用", latest));

    dates.slice(1).forEach(d => select.appendChild(makeOption(d)));

  } catch (e) {
    console.error("heuristics 日付取得エラー:", e);
    select.innerHTML = `<option value="">取得失敗</option>`;
  }
}

/* ============================
   日付 option 生成
============================ */
function makeOption(d) {
  const y = d.substring(0,4);
  const m = d.substring(4,6);
  const day = d.substring(6,8);
  const w = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${day}`).getDay()];
  return new Option(`${y}/${m}/${day}（${w}）`, d);
}

/* ============================
   テーブルヘッダ更新
============================ */
function updateTableHeader(mode, label = "") {
  const sticky = document.getElementById("resultHeaderSticky");
  const body = document.getElementById("resultHeaderBody");

  const ratio = `
    <tr>
      <th class="fixed-col" data-sort-key="コード">コード</th>
      <th class="fixed-col col-2" data-sort-key="銘柄名">銘柄名</th>
      <th data-sort-key="出来高倍率">出来高倍率</th>
      <th data-sort-key="上髭実体比">上髭実体比</th>
      <th data-sort-key="出来高">出来高</th>
      <th data-sort-key="上髭">上髭</th>
      <th data-sort-key="実体">実体</th>
    </tr>
  `;

  const date = `
    <tr>
      <th class="fixed-col" data-sort-key="コード">コード</th>
      <th class="fixed-col col-2" data-sort-key="銘柄名">銘柄名</th>
      <th data-sort-key="値上がり率">値上がり率</th>
      <th data-sort-key="当日終値">${label}終値</th>
      <th data-sort-key="前日終値">前日終値</th>
    </tr>
  `;

  const heuristics = `
    <thead>
      <tr>
        <th class="fixed-col" rowspan="2">コード</th>
        <th class="fixed-col col-2" rowspan="2">銘柄名</th>

        <th colspan="3">移動平均線の傾き</th>
        <th colspan="3">移動平均線の位置</th>
        <th colspan="3">パーフェクトオーダー</th>
        <th colspan="3">逆パーフェクトオーダー</th>
        <th colspan="3">直前PO</th>
        <th colspan="3">直前逆PO</th>

        <th colspan="3">MA 系</th>

        <th colspan="2">ローソク足</th>
        <th colspan="1">5MA更新</th>

        <th colspan="8">酒田五法</th>

        <th colspan="4">パターン認識</th>

        <th colspan="2">物別れ</th>

        <th colspan="2">Rule9</th>

        <th colspan="3">BBゾーンブレイク</th>

        <th colspan="7">その他</th>

        <th rowspan="2">サイクル進行度</th>
        <th colspan="2">節目</th>
      </tr>

      <tr>
        <!-- 移動平均線の傾き -->
        <th data-sort-key="TECH_MA_SLOPE_DAILY">日足</th>
        <th data-sort-key="TECH_MA_SLOPE_WEEKLY">週足</th>
        <th data-sort-key="TECH_MA_SLOPE_MONTHLY">月足</th>

        <!-- 移動平均線の位置 -->
        <th data-sort-key="TECH_MA_POSITION_DAILY">日足</th>
        <th data-sort-key="TECH_MA_POSITION_WEEKLY">週足</th>
        <th data-sort-key="TECH_MA_POSITION_MONTHLY">月足</th>

        <!-- PO -->
        <th data-sort-key="TECH_PERFECT_ORDER_DAILY">日足</th>
        <th data-sort-key="TECH_PERFECT_ORDER_WEEKLY">週足</th>
        <th data-sort-key="TECH_PERFECT_ORDER_MONTHLY">月足</th>

        <!-- 逆PO -->
        <th data-sort-key="TECH_REVERSE_PERFECT_ORDER_DAILY">日足</th>
        <th data-sort-key="TECH_REVERSE_PERFECT_ORDER_WEEKLY">週足</th>
        <th data-sort-key="TECH_REVERSE_PERFECT_ORDER_MONTHLY">月足</th>

        <!-- 直前PO -->
        <th data-sort-key="TECH_PRE_PERFECT_ORDER_DAILY">日足</th>
        <th data-sort-key="TECH_PRE_PERFECT_ORDER_WEEKLY">週足</th>
        <th data-sort-key="TECH_PRE_PERFECT_ORDER_MONTHLY">月足</th>

        <!-- 直前逆PO -->
        <th data-sort-key="TECH_PRE_REVERSE_PERFECT_ORDER_DAILY">日足</th>
        <th data-sort-key="TECH_PRE_REVERSE_PERFECT_ORDER_WEEKLY">週足</th>
        <th data-sort-key="TECH_PRE_REVERSE_PERFECT_ORDER_MONTHLY">月足</th>

        <!-- MA 系 -->
        <th data-sort-key="TECH_MA_CONGESTION">収束</th>
        <th data-sort-key="TECH_MA_SPREAD">拡散</th>
        <th data-sort-key="TECH_MA100_TREND">100MA</th>

        <!-- ローソク足 -->
        <th data-sort-key="TECH_KAHANSHIN">下半身</th>
        <th data-sort-key="TECH_GYAKU_KAHANSHIN">逆下半身</th>

        <!-- 5MA -->
        <th data-sort-key="TECH_5MA_UPDATE">更新</th>

        <!-- 酒田五法 -->
        <th data-sort-key="TECH_SAKATA_TRIPLE_TOP">三尊</th>
        <th data-sort-key="TECH_SAKATA_TRIPLE_BOTTOM">逆三尊</th>
        <th data-sort-key="TECH_SAKATA_SANKU_UP">三空↑</th>
        <th data-sort-key="TECH_SAKATA_SANKU_DOWN">三空↓</th>
        <th data-sort-key="TECH_SAKATA_SANPEI_UP">三兵↑</th>
        <th data-sort-key="TECH_SAKATA_SANPEI_DOWN">三兵↓</th>
        <th data-sort-key="TECH_SAKATA_SANPO_UP">三法↑</th>
        <th data-sort-key="TECH_SAKATA_SANPO_DOWN">三法↓</th>

        <!-- パターン認識 -->
        <th data-sort-key="TECH_HEAD_AND_SHOULDERS">H&S</th>
        <th data-sort-key="TECH_DOUBLE_BOTTOM">DB</th>
        <th data-sort-key="TECH_NICHI_DAI">日大</th>
        <th data-sort-key="TECH_GYAKU_NICHI_DAI">逆日大</th>

        <!-- 物別れ -->
        <th data-sort-key="TECH_MONOWAKARE">物別れ</th>
        <th data-sort-key="TECH_MONOWAKARE_RED_BLUE_CROSS">クロス</th>

        <!-- Rule9 -->
        <th data-sort-key="TECH_RULE9_DAILY">日足</th>
        <th data-sort-key="TECH_RULE9_WEEKLY">週足</th>

        <!-- BB -->
        <th data-sort-key="TECH_BB_ZONE_BREAK_DAILY">日足</th>
        <th data-sort-key="TECH_BB_ZONE_BREAK_WEEKLY">週足</th>
        <th data-sort-key="TECH_BB_ZONE_BREAK_MONTHLY">月足</th>

        <!-- その他 -->
        <th data-sort-key="TECH_BOX_RANGE">箱</th>
        <th data-sort-key="TECH_OVERHEAT">過熱</th>
        <th data-sort-key="TECH_GRANVILLE">グランビル</th>
        <th data-sort-key="TECH_IN_IN_HARAMI">陰の陰</th>
        <th data-sort-key="TECH_RETURN_SELL_END">戻り売り</th>
        <th data-sort-key="TECH_DOWN_TREND_END">下降終わり</th>
        <th data-sort-key="TECH_MOMIAI">揉み合い</th>

        <!-- 節目 -->
        <th data-sort-key="TECH_FUSHIME_UP">上</th>
        <th data-sort-key="TECH_FUSHIME_DOWN">下</th>
      </tr>
    </thead>
  `;

  const html =
    mode === "ratio" ? ratio :
    mode === "date" ? date :
    heuristics;

  sticky.innerHTML = html;
  body.innerHTML = html;
}

/* ============================
   スクリーニング開始
============================ */
async function startScreening() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;

  const volumeRatio = parseFloat(document.getElementById("volumeRatio").value);
  const shadowRatio = parseFloat(document.getElementById("shadowRatio").value);
  const targetDateRanking = dateSelect.value;
  const targetDateRatio = ratioDateSelect.value;
  const targetDateHeuristics = heuristicsDateSelect.value;

  if (mode === "ratio" && !targetDateRatio) {
    alert("日付を選択してください。");
    return;
  }

  if (mode === "date" && !targetDateRanking) {
    alert("日付が選択されていません。");
    return;
  }

  if (mode === "heuristics" && !targetDateHeuristics) {
    alert("日付を選択してください。");
    return;
  }

  let label = "";
  if (mode === "date") {
    const d = targetDateRanking;
    const y = d.substring(0,4);
    const m = d.substring(4,6);
    const day = d.substring(6,8);
    const w = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${day}`).getDay()];
    label = `${y}/${m}/${day}（${w}）`;
  }

  updateTableHeader(mode, label);

  startBtn.disabled = true;
  cancelBtn.disabled = false;

  elapsedSeconds = 0;
  elapsedTimeEl.textContent = "スクリーニング時間：0秒";

  timerId = setInterval(() => {
    elapsedSeconds++;
    elapsedTimeEl.textContent = `スクリーニング時間：${elapsedSeconds}秒`;
  }, 1000);

  abortController = new AbortController();
  loadingOverlay.classList.remove("hidden");

  try {
    const url = new URL("/screening", API_BASE_URL);

    if (mode === "ratio") {
      url.searchParams.set("mode", "ratio");
      url.searchParams.set("volume_ratio", volumeRatio);
      url.searchParams.set("shadow_ratio", shadowRatio);
      url.searchParams.set("target_date", targetDateRatio);

    } else if (mode === "date") {
      url.searchParams.set("mode", "date_ranking");
      url.searchParams.set("target_date", targetDateRanking);

    } else if (mode === "heuristics") {
      url.searchParams.set("mode", "heuristics");
      url.searchParams.set("target_date", targetDateHeuristics);
    }

    const res = await fetch(url.toString(), { signal: abortController.signal });
    const data = await res.json();

    if (!data.status || data.status !== "ok") {
      console.error("screening API error:", {
        httpStatus: res.status,
        body: data
      });
      alert("スクリーニング中にエラーが発生しました（詳細はコンソールを確認）");
      return;
    }

    const results = data.data;
    currentResults = results;
    showResults(results, mode);

    const countLabel = document.getElementById("resultCount");
    if (countLabel) {
      countLabel.textContent = `検索結果：${results.length} 件`;
    }

  } catch (e) {
    if (!abortController.signal.aborted) {
      console.error("screening fetch error:", e);
      alert("エラーが発生しました（詳細はコンソールを確認）");
    }
  } finally {
    clearInterval(timerId);
    loadingOverlay.classList.add("hidden");
    startBtn.disabled = false;
    cancelBtn.disabled = true;
  }
}

/* ============================
   キャンセル
============================ */
function cancelScreening() {
  if (abortController) abortController.abort();
  cancelBtn.disabled = true;
  cancelBtn.textContent = "キャンセル中…";
}

/* ============================
   結果表示
============================ */
function showResults(results, mode) {
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const tr = document.createElement("tr");
    
    if (r.error) {
      if (mode === "heuristics") {
        tr.classList.add("tr-error");
      }
    }

    if (mode === "ratio") {
      tr.innerHTML = `
        <td class="fixed-col">${r.コード}</td>
        <td class="fixed-col col-2">${r.銘柄名}</td>
        <td>${r.出来高倍率}</td>
        <td>${r.上髭実体比}</td>
        <td>${r.出来高.toLocaleString()}</td>
        <td>${r.上髭}</td>
        <td>${r.実体}</td>
      `;

    } else if (mode === "date") {
      tr.innerHTML = `
        <td class="fixed-col">${r.コード}</td>
        <td class="fixed-col col-2">${r.銘柄名}</td>
        <td>${r.値上がり率}%</td>
        <td>${r.当日終値}</td>
        <td>${r.前日終値}</td>
      `;

    } else if (mode === "heuristics") {
      let html = `
        <td class="fixed-col">${r.コード}</td>
        <td class="fixed-col col-2">${r.銘柄名}</td>
      `;

      for (const key in TECH_LABELS) {
        const val = r[key];

        // --- Rule9（オブジェクト） ---
        if (key === "TECH_RULE9_DAILY" || key === "TECH_RULE9_WEEKLY") {
          html += `<td>${formatRule9(val)}</td>`;
          continue;
        }

        // --- Granville（オブジェクト） ---
        if (key === "TECH_GRANVILLE") {
          if (!val || !val.direction) {
            html += `<td></td>`;
          } else {
            const arrow =
              val.direction === "up" ? "↗" :
              val.direction === "down" ? "↘" : "";
            html += `<td>${arrow}（${val.count}）</td>`;
          }
          continue;
        }

        // --- Fushime（オブジェクト） ---
        if (key === "TECH_FUSHIME_UP" || key === "TECH_FUSHIME_DOWN") {
          if (!val || !val.price) {
            html += `<td></td>`;
          } else {
            html += `<td>${val.price}（${val.tryCount}回）</td>`;
          }
          continue;
        }

        // --- Cycle Progress（数値 or null） ---
        if (key === "TECH_CYCLE_PROGRESS") {
          html += `<td>${val ?? ""}</td>`;
          continue;
        }

        // --- 文字列（up/down/flat） ---
        if (typeof val === "string") {
          const arrow =
            val === "up" ? "↗" :
            val === "down" ? "↘" :
            val === "flat" ? "－" : "";
          html += `<td>${arrow}</td>`;
          continue;
        }

        // --- boolean（○/×） ---
        if (typeof val === "boolean") {
          html += `<td>${val ? "○" : "×"}</td>`;
          continue;
        }

        // --- null or undefined ---
        html += `<td></td>`;
      }

      tr.innerHTML = html;
    }

    tr.addEventListener("click", () => {
      openChartModal(r.コード, r.銘柄名, index);
    });

    tbody.appendChild(tr);
  });

  if (typeof window.setScreeningResults === "function") {
    window.setScreeningResults(results);
  }

  // テーブル描画後に列幅＋固定列を同期（2段階遅延）
  afterTableRendered();
}

/* ============================
   ソート
============================ */
document.addEventListener("click", e => {
  const th = e.target.closest(".table-header-sticky th[data-sort-key]");
  if (!th) return;

  const key = th.dataset.sortKey;
  const order = sortState[key] === "asc" ? "desc" : "asc";
  sortState[key] = order;

  currentResults.sort((a, b) => {
    const A = a[key];
    const B = b[key];

    return !isNaN(A) && !isNaN(B)
      ? (order === "asc" ? A - B : B - A)
      : (order === "asc"
          ? String(A).localeCompare(String(B))
          : String(B).localeCompare(String(A)));
  });

  const mode = document.querySelector('input[name="searchMode"]:checked').value;
  showResults(currentResults, mode);
});

/* ============================
   固定ヘッダと本体テーブルの列幅同期
============================ */
function syncColumnWidths() {
  const headerTable = document.querySelector(".table-header-sticky table");
  const bodyTable = document.querySelector("#resultTable");

  if (!headerTable || !bodyTable) return;

  const headerTheadCells = headerTable.querySelectorAll("thead th");
  const headerTbodyCells = headerTable.querySelectorAll("tbody td");
  const bodyTheadCells = bodyTable.querySelectorAll("thead th");
  const firstRow = bodyTable.querySelector("tbody tr");

  if (!firstRow) return;

  const bodyCells = firstRow.children;
  const len = bodyCells.length;

  if (
    headerTheadCells.length !== len ||
    bodyTheadCells.length !== len
  ) return;

  for (let i = 0; i < len; i++) {
    const width = bodyCells[i].getBoundingClientRect().width + "px";

    // 固定ヘッダ thead
    headerTheadCells[i].style.width = width;

    // 固定ヘッダ tbody（空行）
    if (headerTbodyCells[i]) {
      headerTbodyCells[i].style.width = width;
    }

    // 本体 thead（visibility:hidden）
    bodyTheadCells[i].style.width = width;

    // 本体 tbody
    bodyCells[i].style.width = width;
  }
}

/* ============================
   固定ヘッダと本体の横スクロール同期
============================ */
const stickyHeader = document.querySelector(".table-header-sticky");
const scrollOuter = document.querySelector(".table-scroll-outer");

if (stickyHeader && scrollOuter) {
  // 固定ヘッダ → 本体へ同期
  stickyHeader.addEventListener("scroll", () => {
    scrollOuter.scrollLeft = stickyHeader.scrollLeft;
  });

  // 本体 → 固定ヘッダへ同期
  scrollOuter.addEventListener("scroll", () => {
    stickyHeader.scrollLeft = scrollOuter.scrollLeft;
  });
}

/* ============================
   テーブル描画後に列幅＋固定列を同期
============================ */
function afterTableRendered() {
  setTimeout(() => {
    syncColumnWidths();   // ① 列幅を確定
    setTimeout(() => {
      syncFixedColumns(); // ② 列幅確定後に固定列の left を再計算
    }, 0);
  }, 0);
}

/* ============================
   固定列の left を自動調整
============================ */
function syncFixedColumns() {
  const table = document.getElementById("resultTable");
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");
  if (rows.length === 0) return;

  const firstRow = rows[0];
  const fixedCols = firstRow.querySelectorAll(".fixed-col");

  let left = 0;

  fixedCols.forEach(col => {
    const colIndex = Array.from(firstRow.children).indexOf(col);

    // tbody 側
    document.querySelectorAll(`#resultTable td:nth-child(${colIndex + 1})`)
      .forEach(td => td.style.left = `${left}px`);

    // thead 側
    document.querySelectorAll(`.table-header-sticky th:nth-child(${colIndex + 1})`)
      .forEach(th => th.style.left = `${left}px`);

    left += col.offsetWidth;
  });
}

/* ============================
   イベント登録
============================ */
startBtn.addEventListener("click", startScreening);
cancelBtn.addEventListener("click", cancelScreening);

/* ============================
   リサイズ時にも固定列を再計算
============================ */
window.addEventListener("resize", () => {
  syncColumnWidths();
  syncFixedColumns();
});

/* ============================
   showResults をパッチして固定列同期を保証
============================ */
(function patchShowResults() {
  const original = showResults;
  showResults = function(results, mode) {
    original(results, mode);
    // afterTableRendered() 内で 2段階遅延同期するため、ここでは呼ばない
  };
})();
