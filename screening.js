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

// heuristicsの種別
const HEURISTICS_TYPES = [
  {
    group_label: "移動平均線の傾き",
    items: [
      { key: "TECH_MA_SLOPE_DAILY",   label: "日足" },
      { key: "TECH_MA_SLOPE_WEEKLY",  label: "週足" },
      { key: "TECH_MA_SLOPE_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "移動平均線の位置",
    items: [
      { key: "TECH_MA_POSITION_DAILY",   label: "日足" },
      { key: "TECH_MA_POSITION_WEEKLY",  label: "週足" },
      { key: "TECH_MA_POSITION_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "パーフェクトオーダー",
    items: [
      { key: "TECH_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "逆パーフェクトオーダー",
    items: [
      { key: "TECH_REVERSE_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_REVERSE_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_REVERSE_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "パーフェクトオーダー前夜",
    items: [
      { key: "TECH_PRE_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_PRE_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_PRE_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "逆パーフェクトオーダー前夜",
    items: [
      { key: "TECH_PRE_REVERSE_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_PRE_REVERSE_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_PRE_REVERSE_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "移動平均線の収束",
    items: [
      { key: "TECH_MA_CONGESTION", label: "移動平均線の収束" }
    ]
  },
  {
    group_label: "移動平均線の拡散",
    items: [
      { key: "TECH_MA_SPREAD",     label: "移動平均線の拡散" }
    ]
  },
  {
    group_label: "100MAトレンド",
    items: [
      { key: "TECH_MA100_TREND", label: "100MAトレンド" }
    ]
  },
  {
    group_label: "下半身・逆下半身",
    items: [
      { key: "TECH_KAHANSHIN",       label: "下半身" },
      { key: "TECH_GYAKU_KAHANSHIN", label: "逆下半身" }
    ]
  },
  {
    group_label: "5MA更新",
    items: [
      { key: "TECH_5MA_UPDATE", label: "5MA更新" }
    ]
  },
  {
    group_label: "酒田五法",
    items: [
      { key: "TECH_SAKATA_TRIPLE_TOP",    label: "三尊天井" },
      { key: "TECH_SAKATA_TRIPLE_BOTTOM", label: "逆三尊" },
      { key: "TECH_SAKATA_SANKU_UP",      label: "三空（上）" },
      { key: "TECH_SAKATA_SANKU_DOWN",    label: "三空（下）" },
      { key: "TECH_SAKATA_SANPEI_UP",     label: "三兵（上）" },
      { key: "TECH_SAKATA_SANPEI_DOWN",   label: "三兵（下）" },
      { key: "TECH_SAKATA_SANPO_UP",      label: "三法（上）" },
      { key: "TECH_SAKATA_SANPO_DOWN",    label: "三法（下）" }
    ]
  },
  {
    group_label: "パターン",
    items: [
      { key: "TECH_HEAD_AND_SHOULDERS", label: "ヘッド＆ショルダー" },
      { key: "TECH_DOUBLE_BOTTOM",      label: "ダブルボトム" },
      { key: "TECH_NICHI_DAI",          label: "N大" },
      { key: "TECH_GYAKU_NICHI_DAI",    label: "逆N大" },
      { key: "TECH_IN_IN_HARAMI",       label: "陰の陰はらみ" },
      { key: "TECH_RETURN_SELL_END",    label: "戻り待ち売り後" },
      { key: "TECH_DOWN_TREND_END",     label: "下降相場の終わり" },
      { key: "TECH_MOMIAI",             label: "揉み合い" }
    ]
  },
  {
    group_label: "物別れ",
    items: [
      { key: "TECH_MONOWAKARE",              label: "物別れ" },
      { key: "TECH_MONOWAKARE_RED_BLUE_CROSS", label: "物別れ（赤青クロス）" }
    ]
  },
  {
    group_label: "9の法則",
    items: [
      { key: "TECH_RULE9_DAILY",  label: "日足" },
      { key: "TECH_RULE9_WEEKLY", label: "週足" }
    ]
  },
  {
    group_label: "BBゾーンブレイク",
    items: [
      { key: "TECH_BB_ZONE_BREAK_DAILY",   label: "日足" },
      { key: "TECH_BB_ZONE_BREAK_WEEKLY",  label: "週足" },
      { key: "TECH_BB_ZONE_BREAK_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "ボックスレンジ",
    items: [
      { key: "TECH_BOX_RANGE", label: "ボックスレンジ" }
    ]
  },
  {
    group_label: "過熱",
    items: [
      { key: "TECH_OVERHEAT", label: "過熱" }
    ]
  },
  {
    group_label: "グランビル",
    items: [
      { key: "TECH_GRANVILLE", label: "グランビル" }
    ]
  },
  {
    group_label: "トレンドサイクル進行度",
    items: [
      { key: "TECH_CYCLE_PROGRESS", label: "トレンドサイクル進行度" }
    ]
  },
  {
    group_label: "節目",
    items: [
      { key: "TECH_FUSHIME_UP",   label: "上" },
      { key: "TECH_FUSHIME_DOWN", label: "下" }
    ]
  }
];

/* ============================================================
   表示用ユーティリティ
============================================================ */
function boolMark(v) {
  return v === true ? "○" : v === false ? "×" : "";
}

function formatDirectionMark(direction) {
  return direction === "up" ? "↗" :
         direction === "down" ? "↘" :
         direction === "flat" ? "－" : "";
}

/* ============================================================
   初期化処理
============================================================ */
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
  const stickyThead = document.getElementById("resultHeaderSticky");
  const bodyThead   = document.getElementById("resultHeaderBody");

  // ratio
  if (mode === "ratio") {
    const html = `
      <tr>
        <th class="fixed-col">コード</th>
        <th class="fixed-col">銘柄名</th>
        <th>出来高倍率</th>
        <th>上髭実体比</th>
        <th>出来高</th>
        <th>上髭</th>
        <th>実体</th>
      </tr>
    `;
    stickyThead.innerHTML = html;
    bodyThead.innerHTML   = html;
    return;
  }

  // date
  if (mode === "date") {
    const html = `
      <tr>
        <th class="fixed-col">コード</th>
        <th class="fixed-col">銘柄名</th>
        <th>値上がり率</th>
        <th>${label}終値</th>
        <th>前日終値</th>
      </tr>
    `;
    stickyThead.innerHTML = html;
    bodyThead.innerHTML   = html;
    return;
  }

  // heuristics
  if (mode === "heuristics") {
    let row1 = `
      <tr>
        <th class="fixed-col" rowspan="2">コード</th>
        <th class="fixed-col" rowspan="2">銘柄名</th>
    `;
    let row2 = `<tr>`;


    for (const typeObj of HEURISTICS_TYPES) {
      // item数
      const itemCount = typeObj.items.length;

      if (itemCount > 1) {
        row1 += `<th colspan="${itemCount}">${typeObj.group_label}</th>`;
        for (const item of typeObj.items) {
          row2 += `<th>${item.label}</th>`;
        }
      } else {
        row1 += `<th rowspan="2">${typeObj.group_label}</th>`;
      }
    }

    row1 += `</tr>`;
    row2 += `</tr>`;

    stickyThead.innerHTML = row1 + row2;
    bodyThead.innerHTML   = row1 + row2;
  }
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

    /* ------------------------------
       ratio モード
    ------------------------------ */
    if (mode === "ratio") {
      tr.innerHTML = `
        <td class="fixed-col">${r.コード}</td>
        <td class="fixed-col">${r.銘柄名}</td>
        <td>${r.出来高倍率}</td>
        <td>${r.上髭実体比}</td>
        <td>${r.出来高.toLocaleString()}</td>
        <td>${r.上髭}</td>
        <td>${r.実体}</td>
      `;
    }

    /* ------------------------------
       date モード
    ------------------------------ */
    else if (mode === "date") {
      tr.innerHTML = `
        <td class="fixed-col">${r.コード}</td>
        <td class="fixed-col">${r.銘柄名}</td>
        <td>${r.値上がり率}%</td>
        <td>${r.当日終値}</td>
        <td>${r.前日終値}</td>
      `;
    }

    /* ------------------------------
       heuristics モード
    ------------------------------ */
    else if (mode === "heuristics") {
      let html = `
        <td class="fixed-col">${r.コード}</td>
        <td class="fixed-col">${r.銘柄名}</td>
      `;

      for (const typeObj of HEURISTICS_TYPES) {
        for (const item of typeObj.items) {
          const key = item.key
          const val = r[key];

          switch (key) {
            // --- 9の法則（オブジェクト） ---
            case "TECH_RULE9_DAILY":
            case "TECH_RULE9_WEEKLY":
              if (!val || !val.direction) {
                html += `<td></td>`;
              } else {
                const arrow = formatDirectionMark(val.direction);
                html += `<td>${arrow}（${val.count} 本目）</td>`;
              }
              continue;

            // --- グランビル（オブジェクト） ---
            case "TECH_GRANVILLE":
              if (!val || !val.direction) {
                html += `<td></td>`;
              } else {
                const arrow = formatDirectionMark(val.direction);
                html += `<td>${arrow}（${val.count}）</td>`;
              }
              continue;
              
            // --- 節目（オブジェクト） ---
            case "TECH_FUSHIME_UP":
            case "TECH_FUSHIME_DOWN":
              if (!val || !val.price) {
                html += `<td></td>`;
              } else {
                html += `<td>${val.price}（${val.tryCount}回）</td>`;
              }
              continue;
              
            // --- トレンドサイクル進行度（数値 or null） ---
            case "TECH_CYCLE_PROGRESS":
              html += `<td>${val ?? ""}</td>`;
              continue;

            // 上記以外
            default:
              // type判定
              switch (typeof val) {
                // --- 文字列（up/down/flat） ---
                case "string":
                  const arrow = formatDirectionMark(val);
                  html += `<td>${arrow}</td>`;
                  continue;
                  
                // --- boolean（○/×） ---
                case "boolean":
                  html += `<td>${boolMark(val)}</td>`;
                  continue;

                // --- 上記以外（null or undefined） ---
                default:
                  html += `<td></td>`;
                  continue;
              }
          }
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
  const headerTable = document.getElementById("resultTableSticky");
  const bodyTable   = document.getElementById("resultTable");
  if (!headerTable || !bodyTable) return;

  if (bodyTable.querySelectorAll("tbody tr").length === 0) return;

  // thead要素は一致している前提とする
  const headerTableTHeadRows = headerTable.querySelectorAll("thead tr");
  const bodyTableTHeadRows = bodyTable.querySelectorAll("thead tr");

  for (let i = 0; i < bodyTableTHeadRows.length; i++) {
    const hRow = headerTableTHeadRows[i];
    const hThs = hRow.querySelectorAll("th");

    const bRow = bodyTableTHeadRows[i];
    const bThs = bRow.querySelectorAll("th");

    for (let j = 0; j < bThs.length; j++) {
      hThs[j].style.width = bThs[j].getBoundingClientRect().width + "px";
    }
  }
}

/* ============================
   固定列同期
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
    const width = col.getBoundingClientRect().width;

    document.querySelectorAll(`#resultTable td:nth-child(${colIndex + 1})`)
      .forEach(td => td.style.left = `${left}px`);

    document.querySelectorAll(`.table-header-sticky th:nth-child(${colIndex + 1})`)
      .forEach(th => th.style.left = `${left}px`);

    left += width;
  });
}

/* ============================
   スクロール同期
============================ */
const stickyHeader = document.querySelector(".table-header-sticky");
const scrollOuter = document.querySelector(".table-scroll-outer");

if (stickyHeader && scrollOuter) {
  stickyHeader.addEventListener("scroll", () => {
    scrollOuter.scrollLeft = stickyHeader.scrollLeft;
  });

  scrollOuter.addEventListener("scroll", () => {
    stickyHeader.scrollLeft = scrollOuter.scrollLeft;
  });
}

/* ============================
   afterTableRendered
============================ */
function afterTableRendered() {
  setTimeout(() => {
    syncColumnWidths();
    setTimeout(() => {
      syncFixedColumns();
    }, 0);
  }, 0);
}

/* ------------------------------
   イベント登録
------------------------------ */
startBtn.addEventListener("click", startScreening);
cancelBtn.addEventListener("click", cancelScreening);

/* ------------------------------
   リサイズ時にも同期
------------------------------ */
window.addEventListener("resize", () => {
  syncColumnWidths();
  syncFixedColumns();
});

/* ------------------------------
   showResults パッチ（同期保証）
------------------------------ */
(function patchShowResults() {
  const original = showResults;
  showResults = function(results, mode) {
    original(results, mode);
    // afterTableRendered() 内で 2段階遅延同期するため、ここでは呼ばない
  };
})();
