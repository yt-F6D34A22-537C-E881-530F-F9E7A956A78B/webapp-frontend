// --------------------------------------
// margin-deadline.js
// 各証券会社の「追証 → 強制決済」スケジュール（モーダル #marginDeadlineModal の中身）。
// ・定義：margin-deadline-data.js の MARGIN_DEADLINES（通信なし）
// ・表示の優先順位：①追証発生から何営業日後か（相対）、②具体的な日付（月曜基準の参考例）。
//   日付は example.days を index で引くだけで、祝日・休業日の計算はしない。
// ・構成：日付例の見出し → スケジュール表（証券会社 × 営業日。解消期限・強制決済を色分け）
//         → 各社の条件表（スクロール可能なグリッド。見出し行と証券会社名の列は固定）
//         → トレーダー視点のメモ
// ・iPhone など狭い画面でも読めるよう、条件表は縦積みにせず、表の中だけ上下左右にスクロールさせる。
// ・最終確認日が古い（STALE_AFTER_DAYS 超）／不明な証券会社は「要再確認」と表示する。
// --------------------------------------
import { createEl, toSafeHttpsUrl } from "./info-dom.js";
import { MARGIN_DEADLINES } from "./margin-deadline-data.js";

const STALE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const { updatedAt, example, brokers, traderNotes } = MARGIN_DEADLINES;
const exampleDays = example?.days ?? [];

/* ---------- 整形 ---------- */
function isStale(checkedAt) {
  const t = Date.parse(checkedAt ?? "");   // 空・不正は NaN → 日付不明として「要再確認」扱い
  return Number.isNaN(t) || Date.now() - t > STALE_AFTER_DAYS * DAY_MS;
}

// 文中の {day2} などを example.days[2] の日付ラベルに置き換える（日付の例を1か所で管理するため）
function resolveDayTokens(text) {
  return String(text ?? "").replace(/\{day(\d+)\}/g, (_, index) => exampleDays[Number(index)] ?? "");
}

/* ---------- 日付例の見出し ---------- */
function buildExampleHeader() {
  if (!example) return null;
  const box = createEl("div", "margin-deadline-example");
  box.appendChild(createEl("p", "margin-deadline-example-title", example.title));
  if (example.note) box.appendChild(createEl("p", "info-modal-hint", example.note));
  return box;
}

/* ---------- 見出し付きの区画 ---------- */
function buildSection(title, hint, contentEl) {
  const section = createEl("section", "margin-deadline-section");
  section.appendChild(createEl("h3", "margin-deadline-section-title", title));
  if (hint) section.appendChild(createEl("p", "info-modal-hint", hint));
  section.appendChild(contentEl);
  return section;
}

/* ---------- スケジュール表（証券会社 × 発生日からの営業日） ---------- */
// 解消期限・強制決済のどちらかが来る営業日の範囲だけを列にする（何も起きない日の列は作らない）
function getColumnDays() {
  const days = brokers
    .flatMap((b) => [b.resolve?.day, b.forcedClose?.day])
    .filter(Number.isInteger);
  if (days.length === 0) return [];
  const first = Math.min(...days);
  const last = Math.max(...days);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

// ラベル（解消期限／強制決済）を小さく、時刻・タイミングを大きく2段で表示する
function buildChip(kind, label, point) {
  const chip = createEl("span", "margin-deadline-chip");
  chip.dataset.kind = kind;   // resolve / forced（色分けの CSS 専用フック。値保持型）
  chip.appendChild(createEl("span", "margin-deadline-chip-label", label));
  const when = point.time ? `${point.time}${point.approx === true ? "（目安）" : ""}` : "";
  if (when) chip.appendChild(createEl("span", "margin-deadline-chip-time", when));
  return chip;
}

function buildScheduleCell(broker, day) {
  const td = createEl("td");
  if (broker.resolve?.day === day) td.appendChild(buildChip("resolve", "解消期限", broker.resolve));
  if (broker.forcedClose?.day === day) td.appendChild(buildChip("forced", "強制決済", broker.forcedClose));
  return td;
}

function buildScheduleTable() {
  const columnDays = getColumnDays();
  if (columnDays.length === 0) return null;

  const table = createEl("table", "margin-deadline-table margin-deadline-schedule");
  table.setAttribute("aria-label", "スケジュール表");

  const headRow = createEl("tr");
  const corner = createEl("th", "", "証券会社");
  corner.scope = "col";
  headRow.appendChild(corner);
  columnDays.forEach((day) => {
    const th = createEl("th");
    th.scope = "col";
    th.appendChild(createEl("span", "margin-deadline-day-name", `${day}営業日後`));
    if (exampleDays[day]) th.appendChild(createEl("span", "margin-deadline-day-date", exampleDays[day]));
    headRow.appendChild(th);
  });
  table.appendChild(createEl("thead")).appendChild(headRow);

  const tbody = createEl("tbody");
  brokers.forEach((broker) => {
    const row = createEl("tr");
    const nameCell = createEl("th", "", broker.shortName || broker.name);
    nameCell.scope = "row";
    if (broker.resolve?.day == null) {   // 解消期限の日数が決まらない会社は、列に置けないため名前の下に注記する
      nameCell.appendChild(createEl("span", "margin-deadline-sub", "解消期限は会社指定"));
    }
    row.appendChild(nameCell);
    columnDays.forEach((day) => row.appendChild(buildScheduleCell(broker, day)));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  const wrap = createEl("div", "margin-deadline-table-wrap");
  wrap.appendChild(table);
  return buildSection("スケジュール表", "追証の発生日を基準に、解消期限と強制決済が来る営業日（日付は参考例）", wrap);
}

/* ---------- 各社の条件表（上下左右にスクロールできるグリッド） ---------- */
function buildBrokerNameCell(broker) {
  const th = createEl("th");
  th.scope = "row";
  th.appendChild(createEl("span", "margin-deadline-detail-name", broker.shortName || broker.name));

  th.appendChild(createEl("span", "margin-deadline-checked", `確認日 ${broker.checkedAt || "不明"}`));
  if (isStale(broker.checkedAt)) {
    const stale = createEl("span", "margin-deadline-stale", "要再確認");
    stale.dataset.stale = "";              // フラグ型 data-*（CSS 専用フック）
    th.appendChild(stale);
  }

  const href = toSafeHttpsUrl(broker.sourceUrl);
  if (href) {
    const link = createEl("a", "margin-deadline-source", "公式情報");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    th.appendChild(link);
  }
  return th;
}

// 条件表のセル。営業日数・時刻はスケジュール表に出しているため、ここでは補足文を表示する
function buildDetailCell(texts) {
  const td = createEl("td");
  texts.filter(Boolean).forEach((text, index) => {
    td.appendChild(createEl("span", index === 0 ? "margin-deadline-detail-text" : "margin-deadline-detail-sub", text));
  });
  return td;
}

function buildDetailTable() {
  const table = createEl("table", "margin-deadline-table margin-deadline-details");
  table.setAttribute("aria-label", "各社の条件");

  const headRow = createEl("tr");
  ["証券会社", "追証の解消期限", "強制決済", "補足"].forEach((label) => {
    const th = createEl("th", "", label);
    th.scope = "col";
    headRow.appendChild(th);
  });
  table.appendChild(createEl("thead")).appendChild(headRow);

  const tbody = createEl("tbody");
  brokers.forEach((broker) => {
    const row = createEl("tr");
    row.append(
      buildBrokerNameCell(broker),
      buildDetailCell([broker.resolve?.text]),
      buildDetailCell([broker.forcedClose?.text, broker.forcedClose?.note]),
      buildDetailCell([broker.note])
    );
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  const wrap = createEl("div", "margin-deadline-table-wrap margin-deadline-grid");   // grid：上下左右にスクロール
  wrap.appendChild(table);
  return buildSection("各社の条件", "表は上下左右にスクロールできます（見出しと証券会社名は固定）", wrap);
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
    li.appendChild(createEl("strong", "", resolveDayTokens(item.when)));
    li.appendChild(createEl("span", "", resolveDayTokens(item.text)));
    list.appendChild(li);
  });
  section.appendChild(list);
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
    ...[buildExampleHeader(), buildScheduleTable(), buildDetailTable(), buildTraderNotes()].filter(Boolean)
  );
}
