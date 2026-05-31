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

/* DOM 完全構築後 */
window.onload = () => {
  initSearchMode();
  loadDates();
};

/* モード切替 */
function initSearchMode() {
  const radios = document.querySelectorAll('input[name="searchMode"]');
  const ratioInputs = document.querySelectorAll("#ratioConditions input");
  const dateInputs = document.querySelectorAll("#dateConditions select");

  function updateMode() {
    const mode = document.querySelector('input[name="searchMode"]:checked').value;

    if (mode === "ratio") {
      ratioInputs.forEach(i => i.disabled = false);
      dateInputs.forEach(i => i.disabled = true);
    } else {
      ratioInputs.forEach(i => i.disabled = true);
      dateInputs.forEach(i => i.disabled = false);
    }
  }

  radios.forEach(r => r.addEventListener("change", updateMode));
  updateMode();
}

/* 日付ロード */
async function loadDates() {
  try {
    const res = await fetch(`${API_BASE_URL}/dates`);
    const dates = await res.json();

    dateSelect.innerHTML = "";
    const weekdays = ["日","月","火","水","木","金","土"];

    dates.forEach(d => {
      const y = d.substring(0,4);
      const m = d.substring(4,6);
      const day = d.substring(6,8);
      const w = weekdays[new Date(`${y}-${m}-${day}`).getDay()];

      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = `${y}/${m}/${day}（${w}）`;
      dateSelect.appendChild(opt);
    });
  } catch (e) {
    console.error("日付取得エラー:", e);
  }
}

/* ヘッダ更新（固定ヘッダ＋本体ヘッダ） */
function updateTableHeader(mode, label = "") {
  const sticky = document.getElementById("resultHeaderSticky");
  const body = document.getElementById("resultHeaderBody");

  const ratio = `
    <tr>
      <th data-sort-key="コード">コード</th>
      <th data-sort-key="銘柄名">銘柄名</th>
      <th data-sort-key="出来高倍率">出来高倍率</th>
      <th data-sort-key="上髭実体比">上髭実体比</th>
      <th data-sort-key="出来高">出来高</th>
      <th data-sort-key="上髭">上髭</th>
      <th data-sort-key="実体">実体</th>
    </tr>
  `;

  const date = `
    <tr>
      <th data-sort-key="コード">コード</th>
      <th data-sort-key="銘柄名">銘柄名</th>
      <th data-sort-key="値上がり率">値上がり率</th>
      <th data-sort-key="当日終値">${label}終値</th>
      <th data-sort-key="前日終値">前日終値</th>
    </tr>
  `;

  const html = mode === "ratio" ? ratio : date;

  sticky.innerHTML = html;
  body.innerHTML = html;
}

/* スクリーニング開始 */
async function startScreening() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;

  const volumeRatio = parseFloat(document.getElementById("volumeRatio").value);
  const shadowRatio = parseFloat(document.getElementById("shadowRatio").value);
  const targetDate = dateSelect.value;

  if (mode === "date" && !targetDate) {
    alert("日付が選択されていません。");
    return;
  }

  let label = "";
  if (mode === "date") {
    const y = targetDate.substring(0,4);
    const m = targetDate.substring(4,6);
    const d = targetDate.substring(6,8);
    const w = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${d}`).getDay()];
    label = `${y}/${m}/${d}（${w}）`;
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
    } else {
      url.searchParams.set("mode", "date_ranking");
      url.searchParams.set("target_date", targetDate);
    }

    const res = await fetch(url.toString(), { signal: abortController.signal });
    const data = await res.json();

    currentResults = data;
    showResults(data, mode);

    alert(`スクリーニング完了：${data.length} 件`);
  } catch (e) {
    if (!abortController.signal.aborted) {
      alert("エラーが発生しました");
    }
  } finally {
    clearInterval(timerId);
    loadingOverlay.classList.add("hidden");
    startBtn.disabled = false;
    cancelBtn.disabled = true;
  }
}

/* キャンセル */
function cancelScreening() {
  if (abortController) abortController.abort();
  cancelBtn.disabled = true;
  cancelBtn.textContent = "キャンセル中…";
}

/* 結果表示 */
function showResults(results, mode) {
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML =
      mode === "ratio"
        ? `
          <td>${r.コード}</td>
          <td>${r.銘柄名}</td>
          <td>${r.出来高倍率}</td>
          <td>${r.上髭実体比}</td>
          <td>${r.出来高.toLocaleString()}</td>
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

    /* ★★★ 行クリックイベント（必須） ★★★ */
    tr.addEventListener("click", () => {
      openChartModal(r.コード, r.銘柄名, index);
    });

    tbody.appendChild(tr);
  });
}

/* ソート */
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

/* イベント登録 */
startBtn.addEventListener("click", startScreening);
cancelBtn.addEventListener("click", cancelScreening);
