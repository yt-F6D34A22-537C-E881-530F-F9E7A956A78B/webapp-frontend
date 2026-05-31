/* ============================================================
   要素取得（DOM アクセスを最小化）
============================================================ */
const startBtn = document.getElementById("startBtn");
const cancelBtn = document.getElementById("cancelBtn");
const progressText = document.getElementById("progressText");
const elapsedTimeEl = document.getElementById("elapsedTime");
const tbody = document.querySelector("#resultTable tbody");
const dateSelect = document.getElementById("dateSelect");
const loadingOverlay = document.getElementById("loadingOverlay");

let abortController = null;
let currentResults = [];
let sortState = {};
let elapsedSeconds = 0;
let timerId = null;

const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

/* ============================================================
   日付プルダウンのロード
============================================================ */
async function loadDates() {
  if (!dateSelect) return;

  try {
    const res = await fetch(`${API_BASE_URL}/dates`);
    const dates = await res.json();

    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    dateSelect.innerHTML = "";

    const fragment = document.createDocumentFragment();

    dates.forEach(d => {
      const y = d.substring(0, 4);
      const m = d.substring(4, 6);
      const day = d.substring(6, 8);

      const dateObj = new Date(`${y}-${m}-${day}`);
      const w = weekdays[dateObj.getDay()];
      const label = `${y}/${m}/${day}（${w}）`;

      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = label;
      fragment.appendChild(opt);
    });

    dateSelect.appendChild(fragment);
  } catch (e) {
    console.error("日付取得エラー:", e);
  }
}

window.addEventListener("DOMContentLoaded", loadDates);

/* ============================================================
   sticky ヘッダ（3 層構造対応）
============================================================ */
document.addEventListener("scroll", () => {
  const thead = document.querySelector("#resultTable thead");
  if (!thead) return;

  const rect = thead.getBoundingClientRect();
  thead.classList.toggle("sticky", rect.top <= 0);
});

/* ============================================================
   時間フォーマット
============================================================ */
function formatElapsed(sec) {
  if (sec < 60) return `スクリーニング時間：${sec}秒`;
  return `スクリーニング時間：${Math.floor(sec / 60)}分${sec % 60}秒`;
}

/* ============================================================
   テーブルヘッダ切り替え
============================================================ */
function updateTableHeader(mode, targetDateLabel = "") {
  const header = document.getElementById("resultHeader");

  header.innerHTML =
    mode === "ratio"
      ? `
        <th data-sort-key="コード">コード</th>
        <th data-sort-key="銘柄名">銘柄名</th>
        <th data-sort-key="出来高倍率">出来高倍率</th>
        <th data-sort-key="上髭実体比">上髭実体比</th>
        <th data-sort-key="出来高">出来高</th>
        <th data-sort-key="上髭">上髭</th>
        <th data-sort-key="実体">実体</th>
      `
      : `
        <th data-sort-key="コード">コード</th>
        <th data-sort-key="銘柄名">銘柄名</th>
        <th data-sort-key="値上がり率">値上がり率</th>
        <th data-sort-key="当日終値">${targetDateLabel}終値</th>
        <th data-sort-key="前日終値">前日終値</th>
      `;
}

/* ============================================================
   スクリーニング開始
============================================================ */
async function startScreening() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;

  const volumeRatio = parseFloat(document.getElementById("volumeRatio")?.value) || 5;
  const shadowRatio = parseFloat(document.getElementById("shadowRatio")?.value) || 5;
  const targetDate = dateSelect?.value;

  let targetDateLabel = "";
  if (mode === "date") {
    const y = targetDate.substring(0, 4);
    const m = targetDate.substring(4, 6);
    const d = targetDate.substring(6, 8);
    const w = ["日", "月", "火", "水", "木", "金", "土"][new Date(`${y}-${m}-${d}`).getDay()];
    targetDateLabel = `${y}/${m}/${d}（${w}）`;
  }

  updateTableHeader(mode, targetDateLabel);

  startBtn.disabled = true;
  cancelBtn.disabled = false;

  elapsedSeconds = 0;
  elapsedTimeEl.textContent = formatElapsed(0);

  timerId = setInterval(() => {
    elapsedSeconds++;
    elapsedTimeEl.textContent = formatElapsed(elapsedSeconds);
  }, 1000);

  abortController = new AbortController();
  loadingOverlay.classList.remove("hidden");

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

    const res = await fetch(url.toString(), { signal: abortController.signal });
    if (!res.ok) throw new Error("サーバーエラー");

    currentResults = await res.json();

    clearInterval(timerId);
    timerId = null;

    progressText.textContent = `完了：${currentResults.length} 件ヒット`;

    showResults(currentResults, mode);

    if (window.setScreeningResults) {
      window.setScreeningResults(currentResults);
    }

    alert(`スクリーニング完了：${currentResults.length} 件`);
  } catch (e) {
    clearInterval(timerId);
    timerId = null;

    if (abortController.signal.aborted) {
      progressText.textContent = "キャンセルされました。";
    } else {
      console.error(e);
      progressText.textContent = "エラーが発生しました。";
      alert("スクリーニング中にエラーが発生しました。");
    }
  } finally {
    startBtn.disabled = false;
    cancelBtn.disabled = true;
    cancelBtn.textContent = "キャンセル";
    loadingOverlay.classList.add("hidden");
  }
}

/* ============================================================
   キャンセル
============================================================ */
function cancelScreening() {
  if (!abortController) return;

  abortController.abort();
  cancelBtn.disabled = true;
  cancelBtn.textContent = "キャンセル中…";

  clearInterval(timerId);
  timerId = null;

  progressText.textContent += "（キャンセル要求済み）";
}

/* ============================================================
   結果表示
============================================================ */
function showResults(results, mode) {
  tbody.innerHTML = "";

  const fragment = document.createDocumentFragment();

  results.forEach((r, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML =
      mode === "ratio"
        ? `
          <td>${r.コード}</td>
          <td>${r.銘柄名}</td>
          <td>${r.出来高倍率}</td>
          <td>${r.上髭実体比}</td>
          <td>${Number(r.出来高).toLocaleString()}</td>
          <td>${r.上髭}</td>
          <td>${r.実体}</td>
        `
        : `
          <td>${r.コード}</td>
          <td>${r.銘柄名}</td>
          <td>${r.値上がり率}%</td>
          <td>${r.当日終値}</td>
          <td>${r.前日終値}</td>
        `;

    tr.addEventListener("click", () => {
      openChartModal(r.コード, r.銘柄名, index);
    });

    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

/* ============================================================
   ソート
============================================================ */
document.addEventListener("click", e => {
  const th = e.target.closest("th[data-sort-key]");
  if (!th) return;

  const key = th.dataset.sortKey;
  const order = sortState[key] === "asc" ? "desc" : "asc";
  sortState[key] = order;

  currentResults.sort((a, b) => {
    const A = a[key];
    const B = b[key];

    if (!isNaN(A) && !isNaN(B)) {
      return order === "asc" ? A - B : B - A;
    }
    return order === "asc"
      ? String(A).localeCompare(String(B))
      : String(B).localeCompare(String(A));
  });

  const mode = document.querySelector('input[name="searchMode"]:checked').value;
  showResults(currentResults, mode);
});
