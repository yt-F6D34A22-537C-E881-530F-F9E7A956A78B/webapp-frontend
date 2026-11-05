// ============================================================
// 相場ノート：エントリーポイント（type="module"。2026-11 追加）
// 通信なし。NOTES（notes-data.js）→ 描画 → 絞り込み／ハッシュ遷移の登録だけを行う。
// ============================================================
import { NOTES } from "./notes-data.js";
import { FILTER_ALL, renderFilterBar, renderEntries, applyFilter } from "./notes-render.js";

function init() {
  const barEl = document.getElementById("notesFilterBar");
  const listEl = document.getElementById("notesList");
  const updatedEl = document.getElementById("notesUpdatedEl");
  const emptyEl = document.getElementById("notesEmptyEl");
  // html だけ古いままデプロイされた場合も例外で止めず、警告のみで終える
  if (!barEl || !listEl || !updatedEl || !emptyEl) {
    console.warn("[notes] 必要な要素が見つかりません。pages/notes.html が最新か確認してください。");
    return;
  }

  updatedEl.textContent = `最終更新 ${NOTES.updatedAt}`;
  renderFilterBar(barEl, NOTES.categories);
  const entryEls = renderEntries(listEl, NOTES.entries, NOTES.categories);

  const filter = (categoryId) => {
    const count = applyFilter({ barEl, listEl, categoryId });
    emptyEl.hidden = count > 0;
  };

  // #note-xxx で個別のノートを開く（共有・他ページからのリンク用）。
  // 絞り込みで隠れているときは「すべて」に戻してから開く。
  const openFromHash = () => {
    const entryId = decodeURIComponent(location.hash.slice(1)).replace(/^note-/, "");
    const el = entryEls.get(entryId);
    if (!el) return false;
    if (el.hidden) filter(FILTER_ALL);
    el.open = true;
    el.scrollIntoView({ block: "start" });
    return true;
  };

  barEl.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-role="notes-filter"]');
    if (btn) filter(btn.dataset.category);
  });
  window.addEventListener("hashchange", openFromHash);

  filter(FILTER_ALL);
  openFromHash();
}

init();
