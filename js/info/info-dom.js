// --------------------------------------
// info-dom.js
// 情報モーダル共通の DOM 生成ユーティリティ。
// 表示テキストはすべて textContent で設定し、innerHTML は使用しない。
// --------------------------------------

/**
 * 要素を生成する。className は見た目専用（JS からの要素取得には使わない）。
 */
export function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * href に設定してよい URL かを検証する。https のみ許可する
 * （手修正の際の入力ミスでも javascript: / data: 等が href に入らないようにするため）。
 * @returns {string|null} 安全な URL、不正なら null
 */
export function toSafeHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.href : null;
  } catch (e) {
    return null;
  }
}
