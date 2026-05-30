const startBtn = document.getElementById("startBtn");
const cancelBtn = document.getElementById("cancelBtn");
const progressText = document.getElementById("progressText");
const elapsedTimeEl = document.getElementById("elapsedTime");
const tbody = document.querySelector("#resultTable tbody");
const tableHeaders = document.querySelectorAll("#resultTable thead th");

let abortController = null;
let currentResults = [];
let sortState = {};

let elapsedSeconds = 0;
let timerId = null;

const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

/* ===============================
   日付プルダウンのロード
=============================== */
async function loadDates() {
  const sel = document.getElementById("dateSelect");
  if (!sel) return;

  try {
    const res = await fetch(`${API_BASE_URL}/dates`);
    const dates = await res.json();

    sel.innerHTML = "";
    dates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("日付取得エラー:", e);
  }
}

window.addEventListener("DOMContentLoaded", loadDates);

startBtn.addEventListener("click", startScreening);
cancelBtn.addEventListener("click", cancelScreening);

/* ===============================
   時間フォーマット
=============================== */
function formatElapsed(sec) {
  if (sec < 60) return `スクリーニング時間：${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `スクリーニング時間：${m}分${s}秒`;
}

/* ===============================
   テーブルヘッダ切り替え
=============================== */
function updateTableHeader(mode) {
  const header = document.getElementById("resultHeader");

  if (mode === "ratio") {
    header.innerHTML = `
      <th data-sort-key="コード">コード</th>
      <th data-sort-key="銘柄名">銘柄名</th>
      <th data-sort-key="出来高倍率">出来高倍率</th>
      <th data-sort-key="上髭実体比">上髭実体比</th>
      <th data-sort-key="出来高">出来高</th>
      <th data-sort-key="上髭">上髭</th>
      <th data-sort-key="実体">実体</th>
    `;
  } else {
    header.innerHTML = `
      <th data-sort-key="コード">コード</th>
      <th data-sort-key="銘柄名">銘柄名</th>
      <th data-sort-key="値上がり率">値上がり率</th>
      <th data-sort-key="当日終値">当日終値</th>
      <th data-sort-key="前日終値">前日終値</th>
      <th data-sort-key="日付">日付</th>
    `;
  }
}

/* ===============================
   スクリーニング開始
=============================== */
async function startScreening() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;

  const volumeRatio = parseFloat(document.getElementById("volumeRatio")?.value) || 5;
  const shadowRatio = parseFloat(document.getElementById("shadowRatio")?.value) || 5;
  const targetDate = document.getElementById("dateSelect")?.value;

  updateTableHeader(mode);

  startBtn.disabled = true;
  cancelBtn.disabled = false;

  elapsedSeconds = 0;
  elapsedTimeEl.textContent = formatElapsed(0);

  timerId = setInterval(() => {
    elapsedSeconds++;
    elapsedTimeEl.textContent = formatElapsed(elapsedSeconds);
  }, 1000);

  abortController = new AbortController();

  document.getElementById("loadingOverlay").classList.remove("hidden");

  try {
    const url = new URL("/screening", API_BASE_URL);

    if (mode === "ratio") {
      url.searchParams.set("mode", "ratio");
      url.searchParams.set("volume_ratio", volumeRatio);
      url.searchParams.set("shadow_ratio", shadowRatio);
    } else {
      url.searchParams.set("mode", "date_ranking");
      url.searchParams.set("target_date", targetDate);
    }

    const res = await fetch(url.toString(), {
      signal: abortController.signal,
    });

    if (!res.ok) throw new Error("サーバーエラー");

    const results = await res.json();
    currentResults = results;

    clearInterval(timerId);
    timerId = null;

    progressText.textContent = `完了：${results.length} 件ヒット`;

    showResults(currentResults, mode);

    if (window.setScreeningResults) {
      window.setScreeningResults(results);
    }

    alert(`スクリーニング完了：${results.length} 件`);
  } catch (e) {
    clearInterval(timerId);
    timerId = null;

    if (abortController.signal.aborted) {
      progressText.textContent = "キャンセルされました。";
    } else {
      console.error(e);
      alert("スクリーニング中にエラーが発生しました。");
      progressText.textContent = "エラーが発生しました。";
    }
  } finally {
    startBtn.disabled = false;
    cancelBtn.disabled = true;
    cancelBtn.textContent = "キャンセル";
    document.getElementById("loadingOverlay").classList.add("hidden");
  }
}

/* ===============================
   キャンセル
=============================== */
function cancelScreening() {
  if (abortController) {
    abortController.abort();
    cancelBtn.disabled = true;
    cancelBtn.textContent = "キャンセル中…";

    clearInterval(timerId);
    timerId = null;

    progressText.textContent += "（キャンセル要求済み）";
  }
}

/* ===============================
   結果表示（モード別）
=============================== */
function showResults(results, mode) {
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const tr = document.createElement("tr");

    if (mode === "ratio") {
      tr.innerHTML = `
        <td>${r.コード}</td>
        <td>${r.銘柄名}</td>
        <td>${r.出来高倍率}</td>
        <td>${r.上髭実体比}</td>
        <td>${Number(r.出来高).toLocaleString()}</td>
        <td>${r.上髭}</td>
        <td>${r.実体}</td>
      `;
    } else {
      tr.innerHTML = `
        <td>${r.コード}</td>
        <td>${r.銘柄名}</td>
        <td>${r.値上がり率}%</td>
        <td>${r.当日終値}</td>
        <td>${r.前日終値}</td>
        <td>${r.日付}</td>
      `;
    }

    tr.addEventListener("click", () => {
      openChartModal(r.コード, r.銘柄名, index);
    });

    tbody.appendChild(tr);
  });
}

/* ===============================
   列ヘッダクリックでソート
=============================== */
tableHeaders.forEach(th => {
  const key = th.dataset.sortKey;
  if (!key) return;

  sortState[key] = "asc";

  th.style.cursor = "pointer";

  th.addEventListener("click", () => {
    const order = sortState[key];

    currentResults.sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (!isNaN(valA) && !isNaN(valB)) {
        return order === "asc" ? valA - valB : valB - valA;
      }

      return order === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    sortState[key] = order === "asc" ? "desc" : "asc";

    const mode = document.querySelector('input[name="searchMode"]:checked').value;
    showResults(currentResults, mode);
  });
});
