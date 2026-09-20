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
//   ・O/H/L/C は当初「ラベル行＋値行」の2段組で1項目にまとめていたが、
//     値がスラッシュ区切りで横に長くなる問題があったため、
//     O / H / L / C を独立した4項目（4行）へ分割した
//     （chart-price.js 側の記述子変更。本ファイルは特別扱いをせず、
//      通常項目と同じ描画パスで4行になる）
//   ・インジケータグループが切り替わる境目に区切り線を挟む
//   ・クリック／タップで凡例本体の折りたたみ・展開を切り替える
//     （凡例をクリックすると閉じ、閉じた状態の凡例をクリックすると
//     元の状態に展開する。折りたたみ中は「凡例」という短いラベルのみ
//     表示し、それをタップすると展開する）
//   ・開閉状態は localStorage に保存し、次回（銘柄送り・足種切替・
//     モーダル再オープン）も同じ状態を復元する
//     （「前回閉じていたら次も閉じたまま」。2026-09 追加）
//
// 凡例のクリック判定を有効にするため、.chart-legend は
// pointer-events: auto（style.css）にしている。旧実装は
// pointer-events: none でマウスイベントを下のチャートへ透過させていたが、
// クリックで開閉する要件と両立できないため変更した。これにより、
// カーソルが凡例の上にある間はチャート側の十字カーソルが更新されなくなる
// （凡例が画面の一角を占める小さな要素であるため実用上の影響は小さい）。
//
// DOM 取得フックは data-legend-group / data-legend-item / data-legend-value を
// 用いる（conventions.domHookAttributes：class はスタイル専用）。
// 表示テキストはすべて textContent で設定し、innerHTML は使用しない
// （API 由来の値を HTML として解釈させないため）。
// --------------------------------------
import { formatDateJst } from "./chart-theme.js";

// --------------------------------------
// 折りたたみ状態の永続化（2026-09 追加）
// 「前回閉じていたら次回も閉じたまま」とするため、開閉状態を
// localStorage（キー: chartLegendCollapsed）へ保存し、次に createLegend()
// が呼ばれた（＝銘柄送り・足種切替・モーダル再オープンのたび）際に復元する。
// chart-main.js の表示トグル永続化（VISIBILITY_STORAGE_KEY）と同じ理由で、
// localStorage はプライベートブラウズ等で例外を投げうるため try/catch で
// 囲み、失敗時は既定値（展開）へフォールバックして処理を継続する。
// --------------------------------------
const COLLAPSE_STORAGE_KEY = "chartLegendCollapsed";

function loadCollapsedPreference() {
  try {
    return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
  } catch (e) {
    console.warn("凡例の開閉状態の読み込みに失敗しました:", e);
    return false;
  }
}

function saveCollapsedPreference(collapsed) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  } catch (e) {
    console.warn("凡例の開閉状態の保存に失敗しました:", e);
  }
}

/**
 * HUD凡例を生成する。
 *
 * @param {HTMLElement} container 凡例を載せる要素（position: relative であること）
 * @param {Array<{key: string, legend: Array<{key: string, label: string, color: ?string, valueAt: function(number): ?string}>}>} groups
 *        インジケータグループ配列（表示トグルの単位）
 * @returns {{update: function(number): void, setGroupVisible: function(string, boolean): void, setSide: function(string): void, destroy: function(): void}}
 */
export function createLegend(container, groups) {
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.id = "chartLegend";

  // 折りたたみ中に表示する短いラベル。展開中は非表示（style.css で制御）。
  const collapsedLabel = document.createElement("div");
  collapsedLabel.className = "legend-collapsed-label";
  collapsedLabel.textContent = "凡例";
  legend.appendChild(collapsedLabel);

  // 通常時に表示する本体（日付・各インジケータの行）。
  // 折りたたみ・展開はこの要素ごと表示/非表示を切り替えることで行う
  // （setGroupVisible の行単位の display 制御とは独立させ、
  //  互いに干渉しないようにしている）。
  const body = document.createElement("div");
  body.className = "legend-body";
  legend.appendChild(body);

  const valueEls = new Map();     // itemKey -> HTMLElement（値の表示先）
  const itemsFlat = [];           // [{ key, valueAt }]（update() が走査する一覧）
  const groupRows = new Map();    // groupKey -> HTMLElement[]（setGroupVisible 用）

  // グループの切り替わりを検出して区切り線を入れるための直近グループ記録
  let lastGroupKey = null;

  // ------------------------------
  // 行の生成
  // 1行 = 1項目（■ ラベル 値）。
  // グループが直前の行と異なる場合、先頭行に legend-group-start を付け
  // CSS 側で区切り線を描画する（date → candle → volume → ma → bb →
  // ichimoku → rci → macd の境目すべてに入る）。
  // ------------------------------
  function renderItem(groupKey, item) {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.dataset.legendGroup = groupKey;
    row.dataset.legendItem = item.key;

    if (lastGroupKey !== null && groupKey !== lastGroupKey) {
      row.classList.add("legend-group-start");
    }
    lastGroupKey = groupKey;

    // スワッチは色がある項目のみ表示する（例：O/H/L/C は O 行にのみ表示し、
    // H/L/C 行は非表示にする。2026-09 変更）。
    // ただし同じグループ内でラベルの左端を揃えるため、色が無い項目でも
    // スワッチの領域そのものは常に確保する（.legend-swatch の min-width。
    // 空のまま出力し、色・記号は付けない）。
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    if (item.color) {
      swatch.style.color = item.color;    // 値は chart-theme.js のリテラルのみ
      swatch.textContent = "■";
    }
    row.appendChild(swatch);

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = item.label;
    row.appendChild(label);

    const value = document.createElement("span");
    value.className = "legend-value";
    value.dataset.legendValue = item.key;
    value.textContent = "-";
    row.appendChild(value);

    body.appendChild(row);

    if (!groupRows.has(groupKey)) groupRows.set(groupKey, []);
    groupRows.get(groupKey).push(row);

    valueEls.set(item.key, value);
    itemsFlat.push({ key: item.key, valueAt: item.valueAt });
  }

  // 日付行（常時表示・先頭）
  renderItem("date", { key: "date", label: "日付", color: null, valueAt: null });

  for (const group of groups) {
    if (!group.legend || group.legend.length === 0) continue;
    for (const item of group.legend) {
      renderItem(group.key, item);
    }
  }

  container.style.position = "relative";
  container.appendChild(legend);

  // 前回の開閉状態を復元する（保存値が無い、または取得に失敗した場合は展開）
  if (loadCollapsedPreference()) {
    legend.classList.add("is-collapsed");
  }

  // クリック／タップで折りたたみ・展開を切り替える。
  legend.addEventListener("click", () => {
    legend.classList.toggle("is-collapsed");
    saveCollapsedPreference(legend.classList.contains("is-collapsed"));
  });

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
     * 1グループが複数行（例：MA は5行、O/H/L/C は4行）になった場合も、
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
