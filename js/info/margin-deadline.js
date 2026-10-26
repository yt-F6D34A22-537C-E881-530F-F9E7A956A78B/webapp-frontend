// --------------------------------------
// margin-deadline.js
// 各証券会社の「追証 → 強制決済」スケジュール（モーダル #marginDeadlineModal の中身）。
// ・定義：margin-deadline-data.js の MARGIN_DEADLINES（通信なし）
// ・表示の優先順位：①追証発生から何営業日後か（相対）、②具体的な日付（参考例）。
//   日付は example.days を index で引くだけで、祝日・休業日の計算はしない。
// ・構成：日付例の見出し → 比較表 → トレーダー視点のメモ → 証券会社ごとのカード
// ・最終確認日が古い（STALE_AFTER_DAYS 超）／不明な証券会社は「要再確認」と表示する。
// --------------------------------------
import { createEl, toSafeHttpsUrl } from "./info-dom.js";
import { MARGIN_DEADLINES } from "./margin-deadline-data.js";

const STALE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const { updatedAt, example, brokers, traderNotes } = MARGIN_DEADLINES;

/* ---------- 整形 ---------- */
// 「3営業日後 12:00」の形にする。day が null（会社指定など）の場合は「会社指定」
function formatWhen(point) {
  if (!point) return "-";
  const dayText = point.day == null ? "会社指定" : point.day === 0 ? "発生日" : `${point.day}営業日後`;
  return point.time ? `${dayText} ${point.time}` : dayText;
}

// 参考の日付（例）。日数が決まらない・例に無い場合は空文字
function formatExampleDate(point) {
  if (!point || point.day == null) return "";
  const date = example?.days?.[point.day];
  return date ? `例 ${date}` : "";
}

function isStale(checkedAt) {
  const t = Date.parse(checkedAt ?? "");   // 空・不正は NaN → 日付不明として「要再確認」扱い
  return Number.isNaN(t) || Date.now() - t > STALE_AFTER_DAYS * DAY_MS;
}

/* ---------- 日付例の見出し ---------- */
function buildExampleHeader() {
  if (!example) return null;
  const box = createEl("div", "margin-deadline-example");
  box.appendChild(createEl("p", "margin-deadline-example-title", example.title));
  if (example.note) box.appendChild(createEl("p", "info-modal-hint", example.note));
  return box;
}

/* ---------- 比較表（①相対の営業日数を主、②日付の例を従） ---------- */
function buildWhenCell(point, emphasized) {
  const td = createEl("td");
  if (emphasized) td.dataset.emphasis = "";   // 強制決済の列を強調（CSS 専用フック。フラグ型）
  td.appendChild(createEl("span", "margin-deadline-cell-main", formatWhen(point)));
  const exampleText = formatExampleDate(point);
  if (exampleText) td.appendChild(createEl("span", "margin-deadline-cell-example", exampleText));
  return td;
}

function buildSummaryTable() {
  const table = createEl("table", "margin-deadline-table");
  table.appendChild(createEl("caption", "", "追証が発生した日（発生日）から何営業日後か。祝日・休業日は営業日に含めない"));

  const headRow = createEl("tr");
  ["証券会社", "追証の解消期限", "強制決済"].forEach((label) => {
    const th = createEl("th", "", label);
    th.scope = "col";
    headRow.appendChild(th);
  });
  table.appendChild(createEl("thead")).appendChild(headRow);

  const tbody = createEl("tbody");
  brokers.forEach((broker) => {
    const row = createEl("tr");
    const nameCell = createEl("th", "", broker.name);
    nameCell.scope = "row";
    row.append(nameCell, buildWhenCell(broker.resolve, false), buildWhenCell(broker.forcedClose, true));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  const wrap = createEl("div", "margin-deadline-table-wrap");   // 狭い画面では表の中だけ横スクロール
  wrap.appendChild(table);
  return wrap;
}

/* ---------- トレーダー視点のメモ ---------- */
function buildTraderNotes() {
  if (!traderNotes || !Array.isArray(traderNotes.items) || traderNotes.items.length === 0) return null;
  const section = createEl("section", "margin-deadline-notes");
  section.appendChild(createEl("h3", "margin-deadline-notes-title", traderNotes.title));
  if (traderNotes.disclaimer) section.appendChild(createEl("p", "info-modal-hint", traderNotes.disclaimer));

  const list = createEl("ul", "margin-deadline-notes-list");
  traderNotes.items.forEach((item) => {
    const li = createEl("li", "margin-deadline-notes-item");
    li.appendChild(createEl("strong", "", item.when));
    li.appendChild(createEl("span", "", item.text));
    list.appendChild(li);
  });
  section.appendChild(list);
  return section;
}

/* ---------- 証券会社ごとのカード（時系列の流れ） ---------- */
function buildStep(kind, title, point, detailTexts) {
  const li = createEl("li", "margin-deadline-step");
  li.dataset.step = kind;   // occur / resolve / forced（色分けの CSS 専用フック。値保持型）

  const head = createEl("div", "margin-deadline-step-head");
  head.append(
    createEl("span", "margin-deadline-step-title", title),
    createEl("span", "margin-deadline-step-when", formatWhen(point))
  );
  li.appendChild(head);

  const exampleText = formatExampleDate(point);
  if (exampleText) li.appendChild(createEl("p", "margin-deadline-step-example", exampleText));
  detailTexts.filter(Boolean).forEach((text) => li.appendChild(createEl("p", "margin-deadline-step-text", text)));
  return li;
}

function buildBrokerHead(broker) {
  const head = createEl("div", "margin-deadline-broker-head");
  head.appendChild(createEl("h3", "margin-deadline-broker-name", broker.name));

  const checked = createEl(
    "span", "margin-deadline-checked",
    broker.checkedAt ? `最終確認日：${broker.checkedAt}` : "最終確認日：不明"
  );
  if (isStale(broker.checkedAt)) {
    checked.dataset.stale = "";            // フラグ型 data-*（CSS 専用フック）
    checked.textContent += "（要再確認）";
  }
  head.appendChild(checked);

  const href = toSafeHttpsUrl(broker.sourceUrl);
  if (href) {
    const link = createEl("a", "margin-deadline-source", "公式情報");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    head.appendChild(link);
  }
  return head;
}

function buildBrokerCard(broker) {
  const section = createEl("section", "margin-deadline-broker");
  section.appendChild(buildBrokerHead(broker));

  const steps = createEl("ol", "margin-deadline-steps");
  steps.append(
    buildStep("occur", "追証発生", { day: 0 }, []),
    buildStep("resolve", "追証の解消期限", broker.resolve, [broker.resolve?.text]),
    buildStep("forced", "強制決済", broker.forcedClose, [broker.forcedClose?.text, broker.forcedClose?.note])
  );
  section.appendChild(steps);

  if (broker.note) section.appendChild(createEl("p", "margin-deadline-broker-note", broker.note));
  return section;
}

/* ---------- 初期化 ---------- */
export function initMarginDeadline() {
  const bodyEl = document.getElementById("marginDeadlineBody");
  const updatedEl = document.getElementById("marginDeadlineUpdatedEl");
  if (!bodyEl || !updatedEl) {
    console.warn("margin-deadline.js: 必要な要素が見つかりません。index.html が古い可能性があります。");
    return;
  }

  updatedEl.textContent = updatedAt ? `一覧の更新日：${updatedAt}` : "";

  if (!brokers || brokers.length === 0) {
    bodyEl.replaceChildren(createEl("p", "", "登録されている証券会社がありません。"));
    return;
  }

  bodyEl.replaceChildren(
    ...[buildExampleHeader(), buildSummaryTable(), buildTraderNotes(), ...brokers.map(buildBrokerCard)]
      .filter(Boolean)
  );
}
