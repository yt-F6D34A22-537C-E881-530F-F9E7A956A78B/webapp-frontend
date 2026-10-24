// --------------------------------------
// margin-deadline.js
// 各証券会社の信用取引の強制決済期日一覧（モーダル #marginDeadlineModal の中身）。
// ・定義：margin-deadline-data.js の MARGIN_DEADLINES（通信なし）
// ・掲載内容は人手で確認した値。最終確認日が古い（STALE_AFTER_DAYS 超）／不明な
//   証券会社は「要再確認」と表示する。
// --------------------------------------
import { createEl, toSafeHttpsUrl } from "./info-dom.js";
import { MARGIN_DEADLINES } from "./margin-deadline-data.js";

const STALE_AFTER_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// 商品ごとに表示する項目（表示順）。項目を増やすときはここと data ファイルだけを触る
const PRODUCT_FIELDS = [
  ["term",        "返済期限"],
  ["forcedClose", "強制決済"],
  ["holidayRule", "休業日の扱い"],
  ["note",        "備考"],
];

function isStale(checkedAt) {
  const t = Date.parse(checkedAt ?? "");   // 空・不正は NaN → 日付不明として「要再確認」扱い
  return Number.isNaN(t) || Date.now() - t > STALE_AFTER_DAYS * DAY_MS;
}

function buildProduct(product) {
  const dl = createEl("dl", "margin-deadline-product");
  dl.appendChild(createEl("h4", "margin-deadline-product-label", product.label || "（商品名なし）"));
  PRODUCT_FIELDS.forEach(([key, label]) => {
    if (!product[key]) return;
    dl.append(createEl("dt", "", label), createEl("dd", "", product[key]));
  });
  return dl;
}

function buildBroker(broker) {
  const section = createEl("section", "margin-deadline-broker");
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

  section.appendChild(head);
  (broker.products ?? []).forEach((product) => section.appendChild(buildProduct(product)));
  return section;
}

export function initMarginDeadline() {
  const bodyEl = document.getElementById("marginDeadlineBody");
  const updatedEl = document.getElementById("marginDeadlineUpdatedEl");
  if (!bodyEl || !updatedEl) {
    console.warn("margin-deadline.js: 必要な要素が見つかりません。index.html が古い可能性があります。");
    return;
  }

  const { updatedAt, brokers } = MARGIN_DEADLINES;
  updatedEl.textContent = updatedAt ? `一覧の更新日：${updatedAt}` : "";

  if (!brokers || brokers.length === 0) {
    bodyEl.replaceChildren(createEl("p", "", "登録されている証券会社がありません。"));
    return;
  }
  bodyEl.replaceChildren(...brokers.map(buildBroker));
}
