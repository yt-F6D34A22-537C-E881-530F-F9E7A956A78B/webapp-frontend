// ============================================================
// 相場ノート：描画（2026-11 追加）
// 定義（notes-data.js の NOTES）を DOM に変換するだけで、通信・保存は行わない。
// ============================================================
import { createEl, toSafeHttpsUrl, toSafeNotesImagePath } from "./notes-dom.js";

export const FILTER_ALL = "all";

// ---- ブロック（本文の部品）ごとの描画。type を増やす場合はここへ1関数足す ----
const BLOCK_RENDERERS = {
  p: (block) => createEl("p", { text: block.text }),

  list: (block) =>
    createEl("ul", {}, block.items.map((text) => createEl("li", { text }))),

  steps: (block) =>
    createEl("ol", {}, block.items.map((text) => createEl("li", { text }))),

  table: (block) => {
    const head = createEl("thead", {}, [
      createEl("tr", {}, block.head.map((text) => createEl("th", { text, attrs: { scope: "col" } }))),
    ]);
    const body = createEl("tbody", {}, block.rows.map((row) =>
      createEl("tr", {}, row.map((text, i) =>
        i === 0 ? createEl("th", { text, attrs: { scope: "row" } }) : createEl("td", { text })
      ))
    ));
    // 幅の広い表は枠の中だけ横スクロールさせる（ページ全体は横に伸ばさない）
    return createEl("div", { className: "notes-table-wrap" }, [
      createEl("table", { className: "notes-table" }, [head, body]),
    ]);
  },

  image: (block) => {
    const src = toSafeNotesImagePath(block.src);
    if (!src) {
      console.warn("[notes] 画像のパスが不正なためスキップしました:", block.src);
      return null;
    }
    const figure = createEl("figure", { className: "notes-figure" }, [
      createEl("img", { attrs: { src, alt: block.alt ?? "", loading: "lazy" } }),
    ]);
    if (block.caption) figure.append(createEl("figcaption", { text: block.caption }));
    return figure;
  },

  // tone: "info"（補足）| "caution"（未検証・注意）。data-tone は CSS 専用フック（値保持型）
  callout: (block) =>
    createEl("p", { className: "notes-callout", attrs: { "data-tone": block.tone ?? "info" }, text: block.text }),
};

function renderBlock(block, entryId) {
  const renderer = BLOCK_RENDERERS[block.type];
  if (!renderer) {
    console.warn(`[notes] 未知のブロック種別をスキップしました（entry: ${entryId}）:`, block.type);
    return null;
  }
  return renderer(block);
}

function renderEntry(entry) {
  const summary = createEl("summary", { className: "notes-entry-summary" }, [
    createEl("span", { className: "notes-entry-title", text: entry.title }),
    createEl("span", { className: "notes-entry-source", text: entry.source.name }),
  ]);
  const body = createEl("div", { className: "notes-entry-body" });
  for (const block of entry.blocks) {
    const el = renderBlock(block, entry.id);
    if (el) body.append(el);
  }
  const href = entry.source.url ? toSafeHttpsUrl(entry.source.url) : null;
  if (href) {
    body.append(createEl("a", {
      className: "notes-entry-link",
      text: "元の投稿を開く",
      attrs: { href, target: "_blank", rel: "noopener noreferrer" },
    }));
  }
  return createEl("details", {
    className: "notes-entry",
    attrs: { id: `note-${entry.id}`, "data-category": entry.category },
  }, [summary, body]);
}

/** 絞り込みボタン（すべて＋各カテゴリ）を描画する。 */
export function renderFilterBar(barEl, categories) {
  barEl.replaceChildren(
    ...[{ id: FILTER_ALL, title: "すべて" }, ...categories].map((c) =>
      createEl("button", {
        className: "notes-filter-btn",
        text: c.title,
        attrs: { type: "button", "data-role": "notes-filter", "data-category": c.id },
      })
    )
  );
}

/** ノート一覧を描画し、id → <details> の Map を返す（ハッシュ遷移用）。 */
export function renderEntries(listEl, entries, categories) {
  const knownCategories = new Set(categories.map((c) => c.id));
  const entryEls = new Map();
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    if (!knownCategories.has(entry.category)) {
      console.warn(`[notes] 未定義のカテゴリです（entry: ${entry.id}）:`, entry.category);
    }
    const el = renderEntry(entry);
    entryEls.set(entry.id, el);
    fragment.append(el);
  }
  listEl.replaceChildren(fragment);
  return entryEls;
}

/** カテゴリで絞り込み、ボタンの選択状態（data-current）と件数を更新する。表示件数を返す。 */
export function applyFilter({ barEl, listEl, categoryId }) {
  let visibleCount = 0;
  for (const el of listEl.children) {
    const visible = categoryId === FILTER_ALL || el.dataset.category === categoryId;
    el.hidden = !visible;
    if (visible) visibleCount += 1;
  }
  for (const btn of barEl.children) {
    btn.toggleAttribute("data-current", btn.dataset.category === categoryId);
  }
  return visibleCount;
}
