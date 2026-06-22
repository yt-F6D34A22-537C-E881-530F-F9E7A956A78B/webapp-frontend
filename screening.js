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

// 列順だけを定義
const TECH_KEYS = [
  // 移動平均線の傾き
  "TECH_MA_SLOPE_DAILY" ,
  "TECH_MA_SLOPE_WEEKLY" ,
  "TECH_MA_SLOPE_MONTHLY" ,

  // 移動平均線の位置
  "TECH_MA_POSITION_DAILY" ,
  "TECH_MA_POSITION_WEEKLY" ,
  "TECH_MA_POSITION_MONTHLY" ,

  // パーフェクトオーダー
  "TECH_PERFECT_ORDER_DAILY" ,
  "TECH_PERFECT_ORDER_WEEKLY" ,
  "TECH_PERFECT_ORDER_MONTHLY" ,

  // 逆パーフェクトオーダー
  "TECH_REVERSE_PERFECT_ORDER_DAILY" ,
  "TECH_REVERSE_PERFECT_ORDER_WEEKLY" ,
  "TECH_REVERSE_PERFECT_ORDER_MONTHLY" ,

  // パーフェクトオーダー前夜
  "TECH_PRE_PERFECT_ORDER_DAILY" ,
  "TECH_PRE_PERFECT_ORDER_WEEKLY" ,
  "TECH_PRE_PERFECT_ORDER_MONTHLY" ,

  // 逆パーフェクトオーダー前夜
  "TECH_PRE_REVERSE_PERFECT_ORDER_DAILY" ,
  "TECH_PRE_REVERSE_PERFECT_ORDER_WEEKLY" ,
  "TECH_PRE_REVERSE_PERFECT_ORDER_MONTHLY" ,

  // 移動平均線の収束
  "TECH_MA_CONGESTION" ,

  // 移動平均線の拡散
  "TECH_MA_SPREAD" ,

  // 100MAトレンド
  "TECH_MA100_TREND" ,

  // 下半身
  "TECH_KAHANSHIN" ,

  // 逆下半身
  "TECH_GYAKU_KAHANSHIN" ,

  // 5MA更新
  "TECH_5MA_UPDATE" ,

  // 酒田五法（三尊天井 / 逆三尊 / 三空（上） / 三空（下） / 三兵（上） / 三兵（下） / 三法（上） / 三法（下））
  "TECH_SAKATA_TRIPLE_TOP" ,
  "TECH_SAKATA_TRIPLE_BOTTOM" ,
  "TECH_SAKATA_SANKU_UP" ,
  "TECH_SAKATA_SANKU_DOWN" ,
  "TECH_SAKATA_SANPEI_UP" ,
  "TECH_SAKATA_SANPEI_DOWN" ,
  "TECH_SAKATA_SANPO_UP" ,
  "TECH_SAKATA_SANPO_DOWN" ,

  // パターン（ヘッド＆ショルダー / ダブルボトム / N大（上） / 逆N大（下））
  "TECH_HEAD_AND_SHOULDERS" ,
  "TECH_DOUBLE_BOTTOM" ,
  "TECH_NICHI_DAI" ,
  "TECH_GYAKU_NICHI_DAI" ,

  // 物別れ
  "TECH_MONOWAKARE" ,
  "TECH_MONOWAKARE_RED_BLUE_CROSS" ,

  // 9の法則
  "TECH_RULE9_DAILY" ,
  "TECH_RULE9_WEEKLY" ,

  // BBゾーンブレイク
  "TECH_BB_ZONE_BREAK_DAILY" ,
  "TECH_BB_ZONE_BREAK_WEEKLY" ,
  "TECH_BB_ZONE_BREAK_MONTHLY" ,

  // ボックスレンジ
  "TECH_BOX_RANGE" ,

  // 過熱
  "TECH_OVERHEAT" ,

  // グランビル
  "TECH_GRANVILLE" ,

  // 陰の陰はらみ
  "TECH_IN_IN_HARAMI" ,
  // 戻り待ち売り後
  "TECH_RETURN_SELL_END" ,
  // 下降相場の終わり
  "TECH_DOWN_TREND_END" ,
  // 揉み合い
  "TECH_MOMIAI" ,

  // トレンドサイクル進行度
  "TECH_CYCLE_PROGRESS" ,

  // 節目
  "TECH_FUSHIME_UP" ,
  "TECH_FUSHIME_DOWN" 
];

/* ============================================================
   表示用ユーティリティ
============================================================ */
function boolMark(v) {
  return v === true ? "○" : v === false ? "×" : "";
}

function formatRule9(obj) {
  if (!obj || !obj.direction) return "";
  const arrow = obj.direction === "up" ? "↗" :
                obj.direction === "down" ? "↘" : "";
  return `${arrow}（${obj.count} 本目）`;
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

    // グループ名判定
    function detectGroup(key) {
      if (key.startsWith("TECH_MA_SLOPE")) return "移動平均線の傾き";
      if (key.startsWith("TECH_MA_POSITION")) return "移動平均線の位置";
      if (key.startsWith("TECH_PERFECT_ORDER") && !key.includes("REVERSE") && !key.includes("PRE_")) return "パーフェクトオーダー";
      if (key.startsWith("TECH_REVERSE_PERFECT_ORDER") && !key.includes("PRE_")) return "逆パーフェクトオーダー";
      if (key.startsWith("TECH_PRE_PERFECT_ORDER") && !key.includes("REVERSE")) return "直前PO";
      if (key.startsWith("TECH_PRE_REVERSE_PERFECT_ORDER")) return "直前逆PO";

      if (key === "TECH_MA_CONGESTION" || key === "TECH_MA_SPREAD" || key === "TECH_MA100_TREND") return "MA系";

      if (key === "TECH_KAHANSHIN" || key === "TECH_GYAKU_KAHANSHIN") return "ローソク足";

      if (key === "TECH_5MA_UPDATE") return "5MA更新";

      if (key.startsWith("TECH_SAKATA")) return "酒田五法";

      if (key === "TECH_HEAD_AND_SHOULDERS" ||
          key === "TECH_DOUBLE_BOTTOM" ||
          key === "TECH_NICHI_DAI" ||
          key === "TECH_GYAKU_NICHI_DAI") return "パターン認識";

      if (key.startsWith("TECH_MONOWAKARE")) return "物別れ";

      if (key.startsWith("TECH_RULE9")) return "Rule9";

      if (key.startsWith("TECH_BB_ZONE_BREAK")) return "BBゾーンブレイク";

      if (key === "TECH_BOX_RANGE" ||
          key === "TECH_OVERHEAT" ||
          key === "TECH_GRANVILLE" ||
          key === "TECH_IN_IN_HARAMI" ||
          key === "TECH_RETURN_SELL_END" ||
          key === "TECH_DOWN_TREND_END" ||
          key === "TECH_MOMIAI") return "その他";

      if (key === "TECH_CYCLE_PROGRESS") return "サイクル進行度";

      if (key.startsWith("TECH_FUSHIME")) return "節目";

      return "その他";
    }

    // 2段目ラベル
    function shortLabel(key) {
      if (key.endsWith("_DAILY")) return "日足";
      if (key.endsWith("_WEEKLY")) return "週足";
      if (key.endsWith("_MONTHLY")) return "月足";
      return key.replace("TECH_", "");
    }

    // グループ化
    const groups = [];
    let current = null;

    for (const key of TECH_KEYS) {
      const g = detectGroup(key);
      if (!current || current.name !== g) {
        current = { name: g, keys: [] };
        groups.push(current);
      }
      current.keys.push(key);
    }

    // 1段目・2段目生成
    for (const g of groups) {
      if (g.name === "サイクル進行度") {
        row1 += `<th rowspan="2">${g.name}</th>`;
        continue;
      }

      row1 += `<th colspan="${g.keys.length}">${g.name}</th>`;
      for (const key of g.keys) {
        row2 += `<th>${shortLabel(key)}</th>`;
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

      for (const key of TECH_KEYS) {
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




  // const bodyCells = firstRow.children;

  // // --- 2段目（最終行）を同期 ---
  // const headerRow2 = headerTable.querySelector("thead tr:last-child");
  // const headerCells2 = headerRow2 ? headerRow2.querySelectorAll("th") : [];

  // const len = Math.min(headerCells2.length, bodyCells.length);

  // for (let i = 0; i < len; i++) {
  //   const w = bodyCells[i].getBoundingClientRect().width;
  //   headerCells2[i].style.width = w + "px";
  //   bodyCells[i].style.width = w + "px";
  // }

  // // --- 1段目（グループ行）を同期 ---
  // const headerRow1 = headerTable.querySelector("thead tr:first-child");
  // const headerCells1 = headerRow1 ? headerRow1.querySelectorAll("th") : [];

  // let colIndex = 0;

  // headerCells1.forEach(th => {
  //   const rowspan = th.getAttribute("rowspan");
  //   const colspan = th.getAttribute("colspan");

  //   // rowspan=2（コード・銘柄名・サイクル進行度）
  //   if (rowspan === "2") {
  //     const w = bodyCells[colIndex].getBoundingClientRect().width;
  //     th.style.width = w + "px";
  //     colIndex += 1;
  //     return;
  //   }

  //   // colspan（グループ列）
  //   if (colspan) {
  //     const span = Number(colspan);
  //     let total = 0;

  //     for (let i = 0; i < span; i++) {
  //       const w = bodyCells[colIndex + i].getBoundingClientRect().width;
  //       total += w;
  //     }

  //     th.style.width = total + "px";
  //     colIndex += span;
  //     return;
  //   }
  // });

  // // --- 固定列の left を再計算 ---
  // const rows = bodyTable.querySelectorAll("tbody tr");
  // if (rows.length === 0) return;

  // const first = rows[0];
  // const fixedCols = first.querySelectorAll(".fixed-col");

  // let left = 0;

  // fixedCols.forEach(col => {
  //   const idx = Array.from(first.children).indexOf(col);
  //   const w = col.getBoundingClientRect().width;

  //   document.querySelectorAll(`#resultTable td:nth-child(${idx + 1})`)
  //     .forEach(td => td.style.left = `${left}px`);

  //   document.querySelectorAll(`.table-header-sticky th:nth-child(${idx + 1})`)
  //     .forEach(th => th.style.left = `${left}px`);

  //   left += w;
  // });
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
