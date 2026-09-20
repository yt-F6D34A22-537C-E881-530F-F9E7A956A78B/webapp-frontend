// --------------------------------------
// chart-legend.js
// HUD凡例（値表示付き固定凡例）の生成・更新（2026-09 新設）
//
// 旧実装は「色と名前だけの静的な凡例（chart-price.js 内で innerHTML 直書き）」と
// 「マウス追従ツールチップ（価格・RCI・MACD の3か所に別々に存在）」の二重構成で、
//   ・追従ツールチップがチャート本体を覆う
//   ・表示 OFF のインジケータの値までツールチップに出る
//   ・凡例が値を持たないうえ、モバイルでは display:none で色の手がかりが消える
// という可読性上の問題があった。本モジュールは値を固定位置の HUD に集約し、
// 十字カーソルの移動では数値だけを差し替える（moomoo 等の金融チャートと同方式）。
//
// DOM 取得フックは data-legend-group / data-legend-value を用いる
// （conventions.domHookAttributes：class はスタイル専用）。
// 表示テキストはすべて textContent で設定し、innerHTML は使用しない
// （API 由来の値を HTML として解釈させないため）。
// --------------------------------------
import { formatDateJst } from "./chart-theme.js";

/**
 * HUD凡例を生成する。
 *
 * @param {HTMLElement} container 凡例を載せる要素（position: relative であること）
 * @param {Array<{key: string, legend: Array<{key: string, label: string, color: ?string, valueAt: function(number): ?string}>}>} groups
 *        インジケータグループ配列（表示トグルの単位＝行の単位）
 * @returns {{update: function(number): void, setGroupVisible: function(string, boolean): void, destroy: function(): void}}
 */
export function createLegend(container, groups) {
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.id = "chartLegend";

  const valueEls = new Map();   // legendItemKey -> HTMLElement
  const groupEls = new Map();   // groupKey      -> HTMLElement（行）
  const itemsByGroup = new Map();

  // 日付行（常時表示）
  const dateRow = createRow("date");
  const dateValue = appendItem(dateRow, { key: "date", label: "日付", color: null });
  valueEls.set("date", dateValue);
  groupEls.set("date", dateRow);
  legend.appendChild(dateRow);

  for (const group of groups) {
    if (!group.legend || group.legend.length === 0) continue;

    const row = createRow(group.key);
    for (const item of group.legend) {
      valueEls.set(item.key, appendItem(row, item));
    }
    legend.appendChild(row);
    groupEls.set(group.key, row);
    itemsByGroup.set(group.key, group.legend);
  }

  container.style.position = "relative";
  container.appendChild(legend);

  // 凡例の表示位置（既定は左上）。
  // カーソルがチャート左半分にあるときは右上へ退避させ、
  // 凡例がカーソル位置と重なって値やローソク足が読めなくなるのを防ぐ
  // （2026-09 追加）。
  let currentSide = "left";

  // ------------------------------
  // 行・項目の生成ヘルパ
  // ------------------------------
  function createRow(groupKey) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.dataset.legendGroup = groupKey;   // CSS/JS 共用フック
    return row;
  }

  function appendItem(row, item) {
    const itemEl = document.createElement("span");
    itemEl.className = "legend-item";

    if (item.color) {
      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.color = item.color;    // 値は chart-theme.js のリテラルのみ
      swatch.textContent = "■";
      itemEl.appendChild(swatch);
    }

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = item.label;
    itemEl.appendChild(label);

    const value = document.createElement("span");
    value.className = "legend-value";
    value.dataset.legendValue = item.key;
    value.textContent = "-";
    itemEl.appendChild(value);

    row.appendChild(itemEl);
    return value;
  }

  // ------------------------------
  // 公開 API
  // ------------------------------
  return {
    /**
     * 指定時刻の値で HUD を更新する。
     * カーソルがチャート外にある場合は呼び出し側が最新バーの時刻を渡すことで、
     * 常に何らかの値が読める状態を保つ。
     * @param {number} time UTC 秒
     */
    update(time) {
      const dateEl = valueEls.get("date");
      if (dateEl) dateEl.textContent = time == null ? "-" : formatDateJst(time);

      for (const items of itemsByGroup.values()) {
        for (const item of items) {
          const el = valueEls.get(item.key);
          if (!el) continue;
          const text = time == null ? null : item.valueAt(time);
          el.textContent = text ?? "-";
        }
      }
    },

    /**
     * 凡例の表示位置を左上／右上に切り替える。
     * 位置は CSS の left / right のみで制御し、レイアウト計測は行わない
     * （crosshairMove のたびに offsetWidth を読むとレイアウト再計算が発生するため）。
     * @param {"left"|"right"} side
     */
    setSide(side) {
      if (side === currentSide) return;
      currentSide = side;

      if (side === "right") {
        legend.style.left  = "auto";
        legend.style.right = "6px";
      } else {
        legend.style.left  = "6px";
        legend.style.right = "auto";
      }
    },

    /**
     * グループ単位で凡例の行ごと表示／非表示を切り替える。
     * 非表示にしたインジケータの値を HUD に残さないためのもの。
     * @param {string} groupKey
     * @param {boolean} visible
     */
    setGroupVisible(groupKey, visible) {
      const row = groupEls.get(groupKey);
      if (row) row.style.display = visible ? "" : "none";
    },

    /**
     * 凡例 DOM を破棄する。
     * chart-main.js の closeModal / drawChart はコンテナごと innerHTML を
     * クリアするが、明示的な破棄口も用意しておく。
     */
    destroy() {
      legend.remove();
      valueEls.clear();
      groupEls.clear();
      itemsByGroup.clear();
    },
  };
}
