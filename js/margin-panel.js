/**
 * 信用取引パネル（チャートモーダル内。2026-09 追加）
 *
 * chart-main.js が発火する chartModalOpened / chartModalClosed で銘柄を受け取り、
 * 「信用」ボタン（#marginInfoBtn）が開いている間だけ GET /margin_info を呼んで
 * #marginInfoBody へ描画する（パネルが閉じている間は通信しない）。
 * 前へ/次へによる銘柄切替でもパネルは開いたまま追従する。
 * 要素の取得は id のみ。class はスタイル専用（conventions.domHookAttributes）。
 */
(() => {
  "use strict";

  // screening.js の API_BASE_URL / chart-data.js の baseUrl と同じ値（二重管理。変更時は3か所を揃える）
  const MARGIN_INFO_API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";
  const MARGIN_INFO_TIMEOUT_MS = 30000;            // Render のコールドスタートを考慮
  const MARGIN_INFO_CACHE_TTL_MS = 5 * 60 * 1000;  // バックエンドの MARGIN_LATEST_CACHE_TTL_SEC（300秒）と揃える
  const MARGIN_INFO_CODE_PATTERN = /^[0-9A-Z]{4}$/;

  const toggleBtn = document.getElementById("marginInfoBtn");
  const panelEl = document.getElementById("marginInfoPanel");
  const bodyEl = document.getElementById("marginInfoBody");
  if (!toggleBtn || !panelEl || !bodyEl) return;

  const cache = new Map();   // code -> { fetchedAt, payload }
  let panelOpen = false;
  let currentCode = null;
  let inflightController = null;

  /* ---------- 整形 ---------- */
  const formatShares = (v) => (v == null ? "-" : `${v.toLocaleString()}株`);
  const formatDiff = (v) => (v == null ? "-" : `${v > 0 ? "+" : ""}${v.toLocaleString()}`);
  const formatMark = (v) => (v === true ? "○" : v === false ? "×" : "-");
  const formatRatio = (d) => {
    if (d.信用倍率 != null) {
      return `${d.信用倍率.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}倍`;
    }
    return d.信用売残 === 0 ? "∞（売残0）" : "-";
  };
  // 書式が未確認のため、8桁でなければ原文をそのまま表示する
  const formatDateLabel = (value) => {
    const s = String(value ?? "");
    return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6, 8)}` : (s || "不明");
  };
  const diffClass = (v) => (v > 0 ? "margin-info-diff-up" : v < 0 ? "margin-info-diff-down" : "");

  // 買い長/売り長は事実の分類のみ（投資判断を示すものではない）
  const resolveTilt = (d) => {
    const ratio = d.信用倍率 != null ? d.信用倍率 : (d.信用売残 === 0 && d.信用買残 > 0 ? Infinity : null);
    if (ratio == null) return null;
    return ratio > 1 ? "買い長" : ratio < 1 ? "売り長" : "拮抗";
  };

  /* ---------- DOM 生成（textContent のみ。innerHTML は使わない） ---------- */
  function createEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildHeader(payload) {
    const d = payload.data;
    const header = createEl("div", "margin-info-header");
    header.appendChild(createEl("span", "margin-info-title", "信用取引状況"));
    const tilt = resolveTilt(d);
    if (tilt) header.appendChild(createEl("span", "margin-info-tilt", tilt));
    header.appendChild(createEl(
      "span", "margin-info-subline",
      `基準日：${formatDateLabel(d.基準日)}（${d.情報源 || "情報源不明"}）／データ更新：${formatDateLabel(payload.margin_date)}`
    ));
    return header;
  }

  function buildBalanceBar(d) {
    const buy = d.信用買残;
    const sell = d.信用売残;
    if (buy == null || sell == null || buy + sell <= 0) return null;
    const buyPct = (buy / (buy + sell)) * 100;
    const sellPct = 100 - buyPct;

    const bar = createEl("div", "margin-info-bar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `買残 ${buyPct.toFixed(1)}％、売残 ${sellPct.toFixed(1)}％`);
    const buyEl = createEl("span", "margin-info-bar-buy");
    buyEl.style.width = `${buyPct}%`;
    const sellEl = createEl("span", "margin-info-bar-sell");
    sellEl.style.width = `${sellPct}%`;
    bar.append(buyEl, sellEl);

    const legend = createEl("div", "margin-info-bar-legend");
    legend.append(
      createEl("span", "", `買残 ${buyPct.toFixed(1)}%`),
      createEl("span", "", `売残 ${sellPct.toFixed(1)}%`)
    );
    const wrap = createEl("div", "margin-info-balance");
    wrap.append(bar, legend);
    return wrap;
  }

  function buildMetric(label, valueText, diff) {
    const item = createEl("div", "margin-info-item");
    item.appendChild(createEl("dt", "", label));
    const dd = createEl("dd", "");
    dd.appendChild(createEl("span", "margin-info-value", valueText));
    if (diff !== undefined) {
      dd.appendChild(createEl("span", `margin-info-diff ${diffClass(diff)}`.trim(), `前週比 ${formatDiff(diff)}`));
    }
    item.appendChild(dd);
    return item;
  }

  function buildMetricGrid(d) {
    const grid = createEl("dl", "margin-info-grid");
    grid.append(
      buildMetric("信用買残", formatShares(d.信用買残), d.信用買残前週比),
      buildMetric("信用売残", formatShares(d.信用売残), d.信用売残前週比),
      buildMetric("信用倍率", formatRatio(d)),
      buildMetric("制度信用（買い建て）", formatMark(d.制度信用買い建て)),
      buildMetric("制度信用（売り建て）", formatMark(d.制度信用売り建て))
    );
    return grid;
  }

  function buildRegulation(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return createEl("p", "margin-info-regulation", `規制：${list.join("、")}`);   // 外部由来のため textContent
  }

  function buildNote() {
    return createEl(
      "p", "margin-info-note",
      "信用残は週次公表（一部銘柄は日々公表）のため、最新の取引日の状況を反映しない場合があります。" +
      "制度信用の売り建て「×」は、規制中または貸借銘柄でない場合を含みます。"
    );
  }

  function renderData(payload) {
    bodyEl.replaceChildren(
      ...[buildHeader(payload), buildBalanceBar(payload.data), buildMetricGrid(payload.data),
          buildRegulation(payload.data.規制), buildNote()].filter(Boolean)
    );
  }

  function renderMessage(text, onRetry) {
    const nodes = [createEl("p", "margin-info-message", text)];
    if (onRetry) {
      const btn = createEl("button", "btn small", "再試行");
      btn.type = "button";
      btn.addEventListener("click", onRetry);
      nodes.push(btn);
    }
    bodyEl.replaceChildren(...nodes);
  }

  /* ---------- 取得 ---------- */
  function abortInflight() {
    if (inflightController) {
      inflightController.abort();
      inflightController = null;
    }
  }

  async function fetchMarginInfo(code, { force = false } = {}) {
    const hit = cache.get(code);
    if (!force && hit && Date.now() - hit.fetchedAt < MARGIN_INFO_CACHE_TTL_MS) return hit.payload;

    abortInflight();
    const controller = new AbortController();
    inflightController = controller;
    const timerId = setTimeout(() => controller.abort(), MARGIN_INFO_TIMEOUT_MS);
    try {
      const url = `${MARGIN_INFO_API_BASE_URL}/margin_info?code=${encodeURIComponent(code)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (payload.error) throw new Error(payload.detail || payload.error);
      cache.set(code, { fetchedAt: Date.now(), payload });   // 失敗はキャッシュしない
      return payload;
    } finally {
      clearTimeout(timerId);
      if (inflightController === controller) inflightController = null;
    }
  }

  async function loadAndRender({ force = false } = {}) {
    const code = currentCode;
    if (!code) return;
    if (!MARGIN_INFO_CODE_PATTERN.test(code)) {
      renderMessage("この銘柄コードでは信用取引情報を取得できません。");
      return;
    }
    renderMessage("信用取引情報を取得中…");
    try {
      const payload = await fetchMarginInfo(code, { force });
      if (code !== currentCode) return;   // 取得中に銘柄が切り替わった場合は破棄
      if (payload.found) {
        renderData(payload);
      } else {
        renderMessage("この銘柄は信用取引データの対象外です（信用取引不可の銘柄、または最新データに含まれていません）。");
      }
    } catch (err) {
      if (code !== currentCode) return;   // 切替・クローズによる中断は無視
      console.warn("信用取引情報の取得に失敗しました:", err);
      renderMessage("信用取引情報の取得に失敗しました。時間をおいて再試行してください。", () => loadAndRender({ force: true }));
    }
  }

  /* ---------- パネル開閉・イベント連動 ---------- */
  function setPanelOpen(open) {
    panelOpen = open;
    panelEl.classList.toggle("hidden", !open);
    toggleBtn.setAttribute("aria-expanded", String(open));
    if (open) loadAndRender(); else abortInflight();
  }

  toggleBtn.addEventListener("click", () => setPanelOpen(!panelOpen));

  document.addEventListener("chartModalOpened", (e) => {
    currentCode = String(e.detail?.ticker ?? "").trim().toUpperCase();
    if (panelOpen) loadAndRender();
  });

  document.addEventListener("chartModalClosed", () => {
    currentCode = null;
    setPanelOpen(false);   // 次回モーダルを開いた時は常に閉じた状態から始める
  });
})();
