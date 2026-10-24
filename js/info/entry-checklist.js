// --------------------------------------
// entry-checklist.js
// エントリー可否のセルフチェックリスト（モーダル #entryChecklistModal の中身）。
// ・定義：entry-checklist-data.js の ENTRY_CHECKLIST（通信なし）
// ・チェック状態：DOM（チェックボックスの checked）のみが保持する。保存はしない
//   （リロードで初期状態に戻る仕様）
// 判定は「自分で決めた基準を満たしているか」の表示であり、売買の推奨ではない。
// --------------------------------------
import { createEl } from "./info-dom.js";
import { ENTRY_CHECKLIST } from "./entry-checklist-data.js";

const VERDICT_LABEL = {
  ok:   "基準を満たしています",
  hold: "任意項目が基準に届いていません",
  ng:   "必須項目が未達です",
};

export function initEntryChecklist() {
  const bodyEl = document.getElementById("entryChecklistBody");
  const summaryEl = document.getElementById("entryChecklistSummary");
  const resetBtn = document.getElementById("entryChecklistResetBtn");
  if (!bodyEl || !summaryEl || !resetBtn) {
    console.warn("entry-checklist.js: 必要な要素が見つかりません。index.html が古い可能性があります。");
    return;
  }

  const { passRule, sections } = ENTRY_CHECKLIST;

  /* ---------- 判定 ---------- */
  // data-item-kind（"required" | "optional"）を持つ入力欄の checked を数える
  function countByKind(inputs, kind) {
    const list = inputs.filter((input) => input.dataset.itemKind === kind);
    return { total: list.length, checked: list.filter((input) => input.checked).length };
  }

  function renderSummary() {
    const inputs = [...bodyEl.querySelectorAll("input[data-item-kind]")];
    const required = countByKind(inputs, "required");
    const optional = countByKind(inputs, "optional");
    const optionalRatio = optional.total === 0 ? 1 : optional.checked / optional.total;

    let verdict = "ok";
    if (passRule.requireAllRequired && required.checked < required.total) {
      verdict = "ng";
    } else if (optionalRatio < passRule.minOptionalRatio) {
      verdict = "hold";
    }

    summaryEl.dataset.verdict = verdict;   // 色は css/info-modal.css の [data-verdict] が担う
    summaryEl.replaceChildren(
      createEl("p", "entry-checklist-verdict", VERDICT_LABEL[verdict]),
      createEl("p", "entry-checklist-count",
        `必須 ${required.checked}/${required.total}　任意 ${optional.checked}/${optional.total}`)
    );
  }

  /* ---------- 描画 ---------- */
  function buildItem(item) {
    const label = createEl("label", "entry-checklist-item");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.itemKind = item.required === true ? "required" : "optional";

    const textWrap = createEl("span");
    textWrap.appendChild(createEl("span", "", item.text));
    if (item.required === true) textWrap.appendChild(createEl("span", "entry-checklist-required", "必須"));
    if (item.hint) textWrap.appendChild(createEl("small", "entry-checklist-hint", item.hint));

    label.append(input, textWrap);
    return label;
  }

  function buildSection(section) {
    const fieldset = createEl("fieldset", "entry-checklist-section");
    fieldset.appendChild(createEl("legend", "", section.title));
    section.items.forEach((item) => fieldset.appendChild(buildItem(item)));
    return fieldset;
  }

  bodyEl.replaceChildren(...sections.map(buildSection));
  renderSummary();

  /* ---------- イベント ---------- */
  // 委譲：項目数が増えても登録は1回
  bodyEl.addEventListener("change", renderSummary);

  resetBtn.addEventListener("click", () => {
    bodyEl.querySelectorAll("input[data-item-kind]").forEach((input) => { input.checked = false; });
    renderSummary();
  });
}
