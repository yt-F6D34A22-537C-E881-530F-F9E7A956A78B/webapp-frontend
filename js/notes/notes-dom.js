// ============================================================
// 相場ノート：DOM 生成・URL 検証の共通ヘルパー（2026-11 追加）
// ・描画は createElement + textContent のみ（innerHTML は使わない）。
//   定義（notes-data.js）は運用者が手で書くため、書き間違いが XSS・不正な遷移に
//   つながらないようにする（js/info/ の情報モーダルと同じ方針）。
// ・js/info/info-dom.js と同種のヘルパーだが、ページ（index.html / pages/notes.html）が
//   別で互いに依存しない構成を保つため、あえて import せず本ファイルに持つ。
// ============================================================

/**
 * 要素を生成する。
 * @param {string} tag
 * @param {{text?: string, className?: string, attrs?: Object<string,string>}} [options]
 *        className はスタイル用（JS からの取得キーには使わない）。
 *        data-* や id は attrs で渡す。
 * @param {Node[]} [children]
 */
export function createEl(tag, options = {}, children = []) {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.text !== undefined) el.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    el.setAttribute(name, value);
  }
  for (const child of children) el.append(child);
  return el;
}

/** https のみ許可する（それ以外は null）。出典リンク用。 */
export function toSafeHttpsUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** assets/notes/ 直下の画像ファイルだけを許可する（それ以外は null）。 */
export function toSafeNotesImagePath(src) {
  return /^\.\.\/assets\/notes\/[A-Za-z0-9._-]+$/.test(src ?? "") ? src : null;
}
