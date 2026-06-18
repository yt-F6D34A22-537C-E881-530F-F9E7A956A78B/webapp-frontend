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
  "TECH_MA_SLOPE_UP_DAILY": "移動平均線の傾き↗（日足）",
  "TECH_MA_SLOPE_DOWN_DAILY": "移動平均線の傾き↘（日足）",
  "TECH_MA_SLOPE_UP_WEEKLY": "移動平均線の傾き↗（週足）",
  "TECH_MA_SLOPE_DOWN_WEEKLY": "移動平均線の傾き↘（週足）",
  "TECH_MA_SLOPE_UP_MONTHLY": "移動平均線の傾き↗（月足）",
  "TECH_MA_SLOPE_DOWN_MONTHLY": "移動平均線の傾き↘（月足）",

  "TECH_MA_PO_DAILY": "移動平均線の位置（日足）",
  "TECH_MA_RPO_DAILY": "移動平均線の乖離（日足）",
  "TECH_MA_PO_WEEKLY": "移動平均線の位置（週足）",
  "TECH_MA_RPO_WEEKLY": "移動平均線の乖離（週足）",
  "TECH_MA_PO_MONTHLY": "移動平均線の位置（月足）",
  "TECH_MA_RPO_MONTHLY": "移動平均線の乖離（月足）",

  "TECH_MA_PRE_PO": "直前の位置判定",
  "TECH_MA_PRE_RPO": "直前の乖離判定",

  "TECH_MA_CONGESTION_UP": "移動平均線の収束（上）",
  "TECH_MA_CONGESTION_DOWN": "移動平均線の収束（下）",

  "TECH_MA_SPREAD_UP": "移動平均線の拡散（上）",
  "TECH_MA_SPREAD_DOWN": "移動平均線の拡散（下）",

  "TECH_MA100_TREND_UP": "100MAトレンド（上）",
  "TECH_MA100_TREND_DOWN": "100MAトレンド（下）",

  "TECH_KAHANSHIN": "下半身",
  "TECH_GYAKU_KAHANSHIN": "逆下半身",

  "TECH_5MA_HIGH_UPDATE": "5MA高値更新",
  "TECH_5MA_LOW_UPDATE": "5MA安値更新",

  "TECH_SAKATA_TRIPLE_TOP": "三尊天井",
  "TECH_SAKATA_TRIPLE_BOTTOM": "逆三尊",
  "TECH_SAKATA_SANKU_UP": "三空（上）",
  "TECH_SAKATA_SANKU_DOWN": "三空（下）",
  "TECH_SAKATA_SANPEI_UP": "三兵（上）",
  "TECH_SAKATA_SANPEI_DOWN": "三兵（下）",
  "TECH_SAKATA_SANPO_UP": "三法（上）",
  "TECH_SAKATA_SANPO_DOWN": "三法（下）",

  "TECH_HEAD_AND_SHOULDERS": "ヘッド＆ショルダー",
  "TECH_DOUBLE_BOTTOM": "ダブルボトム",

  "TECH_NICHI_DAI": "日大（上）",
  "TECH_GYAKU_NICHI_DAI": "逆日大（下）",

  "TECH_MONOWAKARE_UP": "物別れ（上）",
  "TECH_MONOWAKARE_DOWN": "物別れ（下）",
  "TECH_MONOWAKARE_CROSS_UP": "物別れクロス（上）",
  "TECH_MONOWAKARE_CROSS_DOWN": "物別れクロス（下）",

  "TECH_RULE9_DAILY": "Rule9（日足）",
  "TECH_RULE9_WEEKLY": "Rule9（週足）",

  "TECH_RULE9_DAILY_UP_9": "Rule9（日足）上向き9本",
  "TECH_RULE9_DAILY_UP_17": "Rule9（日足）上向き17本",
  "TECH_RULE9_DAILY_UP_23": "Rule9（日足）上向き23本",
  "TECH_RULE9_DAILY_DOWN_9": "Rule9（日足）下向き9本",
  "TECH_RULE9_DAILY_DOWN_17": "Rule9（日足）下向き17本",
  "TECH_RULE9_DAILY_DOWN_23": "Rule9（日足）下向き23本",

  "TECH_RULE9_WEEKLY_UP_9": "Rule9（週足）上向き9本",
  "TECH_RULE9_WEEKLY_UP_17": "Rule9（週足）上向き17本",
  "TECH_RULE9_WEEKLY_UP_23": "Rule9（週足）上向き23本",
  "TECH_RULE9_WEEKLY_DOWN_9": "Rule9（週足）下向き9本",
  "TECH_RULE9_WEEKLY_DOWN_17": "Rule9（週足）下向き17本",
  "TECH_RULE9_WEEKLY_DOWN_23": "Rule9（週足）下向き23本"
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
    <tr>
      <th class="fixed-col" data-sort-key="コード">コード</th>
      <th class="fixed-col col-2" data-sort-key="銘柄名">銘柄名</th>
      ${Object.keys(TECH_LABELS)
        .map(key => `<th data-sort-key="${key}">${TECH_LABELS[key]}</th>`)
        .join("")}
    </tr>
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
        if (key === "TECH_RULE9_DAILY" || key === "TECH_RULE9_WEEKLY") {
          html += `<td>${formatRule9(r[key])}</td>`;
        } else {
          html += `<td>${boolMark(r[key])}</td>`;
        }
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
   ★ 2段階遅延で「初回表示から隙間ゼロ」を保証
============================ */
function afterTableRendered() {
  setTimeout(() => {
    syncColumnWidths();   // ① 列幅を確定
    setTimeout(() => {
      syncFixedColumns(); // ② 列幅確定後に固定列の left を再計算
    }, 0);
  }, 0);
}

/* ============================================================
   ★ 固定列の left を自動調整（隙間ゼロ・今後列が増えても対応）
============================================================ */
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
