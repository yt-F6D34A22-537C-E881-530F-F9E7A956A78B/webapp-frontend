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
// 2026-09 追加改修：
//   ・1行1項目とする（旧実装は MA(5) と MA(25) が同じ行に並ぶなど、
//     1つのグループの全項目を1行へ詰め込んでおり判読しづらかった）
//   ・O/H/L/C はラベル行「O/H/L/C」と値行を上下に分け、両方を左揃えにする
//     ことで、O の値の左端が O の左端と揃うようにする
//   ・インジケータグループが切り替わる境目に区切り線を挟む
//
// DOM 取得フックは data-legend-group / data-legend-item / data-legend-value を
// 用いる（conventions.domHookAttributes：class はスタイル専用）。
// 表示テキストはすべて textContent で設定し、innerHTML は使用しない
// （API 由来の値を HTML として解釈させないため）。
// --------------------------------------
import { formatDateJst } from "./chart-theme.js";

/**
 * HUD凡例を生成する。
 *
 * @param {HTMLElement} container 凡例を載せる要素（position: relative であること）
 * @param {Array<{key: string, legend: Array<LegendItem>}>} groups
 *        インジケータグループ配列（表示トグルの単位）。
 *        LegendItem は次のいずれか：
 *          - 通常項目: { key, label, color, valueAt(time) }
 *          - O/H/L/C のような複数値項目: { key, label, color, ohlc: true,
 *            valueAt(time) }（valueAt は "始値/高値/安値/終値" 形式の
 *            スラッシュ区切り文字列、または null を返す）
 * @returns {{update: function(number): void, setGroupVisible: function(string, boolean): void, setSide: function(string): void, destroy: function(): void}}
 */
export function createLegend(container, groups) {
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.id = "chartLegend";

  const valueEls = new Map();     // itemKey -> HTMLElement（値の表示先）
  const itemsFlat = [];           // [{ key, valueAt }]（update() が走査する一覧）
  const groupRows = new Map();    // groupKey -> HTMLElement[]（setGroupVisible 用）

  // グループの切り替わりを検出して区切り線を入れるための直近グループ記録
  let lastGroupKey = null;

  // ------------------------------
  // 行の生成ヘルパ
  // グループが直前の行と異なる場合、先頭行に legend-group-start を付け
  // CSS 側で区切り線を描画する（date → candle → volume → ma → bb →
  // ichimoku → rci → macd の境目すべてに入る）。
  // ------------------------------
  function createRow(groupKey, itemKey, extraClass = "") {
    const row = document.createElement("div");
    row.className = extraClass ? `legend-row ${extraClass}` : "legend-row";
    row.dataset.legendGroup = groupKey;
    row.dataset.legendItem = itemKey;

    if (lastGroupKey !== null && groupKey !== lastGroupKey) {
      row.classList.add("legend-group-start");
    }
    lastGroupKey = groupKey;

    if (!groupRows.has(groupKey)) groupRows.set(groupKey, []);
    groupRows.get(groupKey).push(row);

    legend.appendChild(row);
    return row;
  }

  function appendSwatch(row, color) {
    if (!color) return;
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.color = color;    // 値は chart-theme.js のリテラルのみ
    swatch.textContent = "■";
    row.appendChild(swatch);
  }

  // 通常項目（1行 = ラベル + 値）
  function renderSimpleItem(groupKey, item) {
    const row = createRow(groupKey, item.key);
    appendSwatch(row, item.color);

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = item.label;
    row.appendChild(label);

    const value = document.createElement("span");
    value.className = "legend-value";
    value.dataset.legendValue = item.key;
    value.textContent = "-";
    row.appendChild(value);

    valueEls.set(item.key, value);
    itemsFlat.push({ key: item.key, valueAt: item.valueAt });
  }

  // O/H/L/C 項目（1行内でラベル行「O/H/L/C」と値行を上下2段にする）
  function renderOhlcItem(groupKey, item) {
    const row = createRow(groupKey, item.key, "legend-row--stacked");
    appendSwatch(row, item.color);

    const stack = document.createElement("div");
    stack.className = "legend-ohlc";

    const label = document.createElement("div");
    label.className = "legend-label";
    label.textContent = item.label;   // "O/H/L/C"

    const value = document.createElement("div");
    value.className = "legend-value";
    value.dataset.legendValue = item.key;
    value.textContent = "-";

    // ラベル行・値行とも左揃え（block要素の既定）で描画するため、
    // O（ラベル行の先頭文字）と値行の先頭文字（始値）の左端は自然に揃う。
    stack.append(label, value);
    row.appendChild(stack);

    valueEls.set(item.key, value);
    itemsFlat.push({ key: item.key, valueAt: item.valueAt });
  }

  // 日付行（常時表示・先頭）
  renderSimpleItem("date", { key: "date", label: "日付", color: null, valueAt: null });

  for (const group of groups) {
    if (!group.legend || group.legend.length === 0) continue;

    for (const item of group.legend) {
      if (item.ohlc) {
        renderOhlcItem(group.key, item);
      } else {
        renderSimpleItem(group.key, item);
      }
    }
  }

  container.style.position = "relative";
  container.appendChild(legend);

  // 凡例の表示位置（既定は左上）。
  // カーソルがチャート左半分にあるときは右上へ退避させ、
  // 凡例がカーソル位置と重なって値やローソク足が読めなくなるのを防ぐ
  // （2026-09 追加）。
  let currentSide = "left";

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

      for (const { key, valueAt } of itemsFlat) {
        if (key === "date") continue;   // 日付は上で処理済み
        const el = valueEls.get(key);
        if (!el) continue;
        const text = time == null ? null : valueAt(time);
        el.textContent = text ?? "-";
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
     * 1グループが複数行（例：MA は5行）になった場合も、
     * そのグループの全行をまとめて切り替える。
     * @param {string} groupKey
     * @param {boolean} visible
     */
    setGroupVisible(groupKey, visible) {
      const rows = groupRows.get(groupKey);
      if (!rows) return;
      rows.forEach(row => { row.style.display = visible ? "" : "none"; });
    },

    /**
     * 凡例 DOM を破棄する。
     * chart-main.js の closeModal / drawChart はコンテナごと innerHTML を
     * クリアするが、明示的な破棄口も用意しておく。
     */
    destroy() {
      legend.remove();
      valueEls.clear();
      itemsFlat.length = 0;
      groupRows.clear();
    },
  };
}
