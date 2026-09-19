// --------------------------------------
// chart-theme.js
// チャートの配色・線幅・ペイン比率・軸ラベル整形の単一情報源（2026-09 新設）
//
// 旧実装は chart-price.js / chart-rci.js / chart-macd.js がそれぞれ色リテラルを
// 直書きしており、以下の色衝突が発生していた（2026-09 監査で検出）。
//   陽線 red      ⇔ 転換線 #ff0000
//   陰線 blue     ⇔ MA(50) #0000ff・基準線 #0000ff
//   MA(5) #ff1493 ⇔ RCI(9) #ff1493
//   MA(100) #ffaa00 ⇔ ボリンジャーバンド #ffa500
//   ボリンジャーバンドの上限・中心・下限がすべて #ffa500（区別不能）
// ここへ集約することで色の一意性を保証し、あわせて
// 「主役（ローソク足）＞脇役（インジケータ）」の視覚的階層を線幅で表現する。
//
// 本ファイルは定数と純粋関数の export のみで副作用を持たない。
// セキュリティ上の注意：ここで定義した値は series の color / CSS の style.color
// として解釈されるため、必ずリテラルのみを置くこと
// （API レスポンス・利用者入力を混ぜてはならない）。
// --------------------------------------

// --------------------------------------
// カラーパレット
// light / dark の2セットを持つ。現時点で UI からの切替手段は設けていないが、
// 将来ダークテーマを導入する際は document.documentElement.dataset.theme に
// "dark" を設定するだけで全チャートへ反映される（getTheme() を参照）。
// --------------------------------------
export const THEMES = {
  light: {
    // レイアウト
    background:  "#ffffff",
    textColor:   "#333333",
    gridHorz:    "#eeeeee",
    gridVert:    "rgba(0,0,0,0)",   // 縦グリッドはローソク足と干渉するため非表示
    border:      "#cccccc",
    paneSeparator: "#e0e0e0",

    // 主役：ローソク足（日本式：陽線=赤 / 陰線=青）。最も高コントラストにする
    candleUp:    "#D93A3A",
    candleDown:  "#2C63C4",

    // 脇役：移動平均（ローソク足と色相が競合しない、彩度を落とした5色）
    ma5:   "#E8A33D",   // アンバー
    ma25:  "#3AA675",   // ティールグリーン
    ma50:  "#8E6FD6",   // パープル
    ma75:  "#C05E9B",   // マゼンタ
    ma100: "#6B7C8C",   // スレート

    // ボリンジャーバンド：上下バンドは同色、中心線のみ別色＋破線で区別する
    bbBand: "#C9A227",
    bbMid:  "#9C7E1E",

    // 一目均衡表
    tenkan: "#E06C3B",
    kijun:  "#4A7FB5",
    span1:  "#5FA97A",
    span2:  "#A97ABF",
    chikou: "#8A8A8A",
    cloudBull: "rgba(95,169,122,0.22)",   // 旧 rgba(0,200,0,0.35)
    cloudBear: "rgba(169,122,191,0.22)",  // 旧 rgba(200,0,0,0.35)（陽線赤と衝突していた）

    // 出来高
    volume: "rgba(120,120,120,0.45)",

    // サブペイン
    rciShort:   "#E8A33D",
    rciLong:    "#4A7FB5",
    macdLine:   "#2C63C4",
    macdSignal: "#D93A3A",
    macdHist:   "rgba(95,169,122,0.55)",
  },

  dark: {
    background:  "#1B1B1F",
    textColor:   "#D8D4CC",
    gridHorz:    "#2A2A31",
    gridVert:    "rgba(0,0,0,0)",
    border:      "#3A3A42",
    paneSeparator: "#3A3A42",

    candleUp:    "#E55A5A",
    candleDown:  "#5A8FE0",

    ma5:   "#F0B45C",
    ma25:  "#57C08B",
    ma50:  "#A98CE4",
    ma75:  "#D67FB4",
    ma100: "#93A2AF",

    bbBand: "#D9B84A",
    bbMid:  "#B99A33",

    tenkan: "#F08A5C",
    kijun:  "#6D9BD1",
    span1:  "#7CC096",
    span2:  "#BE95D2",
    chikou: "#9E9E9E",
    cloudBull: "rgba(124,192,150,0.20)",
    cloudBear: "rgba(190,149,210,0.20)",

    volume: "rgba(170,170,170,0.40)",

    rciShort:   "#F0B45C",
    rciLong:    "#6D9BD1",
    macdLine:   "#5A8FE0",
    macdSignal: "#E55A5A",
    macdHist:   "rgba(124,192,150,0.50)",
  },
};

/**
 * 現在有効なテーマを返す。
 * document.documentElement の data-theme 属性（値保持型の data-* フック。
 * conventions.domHookAttributes に準拠）を見て切り替える。
 * 属性が無い場合は light。
 * @returns {object} THEMES のいずれか
 */
export function getTheme() {
  const name = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return THEMES[name];
}

// --------------------------------------
// 線幅の階層
// ローソク足（主役）より脇役が目立たないよう、インジケータはすべて 1px とする
// （旧実装の MA は lineWidth: 2 でローソク足の枠線より太かった）。
// --------------------------------------
export const LINE_WIDTH = {
  ma: 1,
  bb: 1,
  ichimoku: 1,
  sub: 1,   // RCI / MACD
};

// --------------------------------------
// ペインの高さ比（LightweightCharts v5 の IPaneApi.setStretchFactor へ渡す）
// 旧実装では RCI / MACD の高さを CSS（--rci-macd-height）で固定していたが、
// 1チャート3ペイン化に伴いライブラリ側の相対指定へ一本化した。
// --------------------------------------
export const PANE_STRETCH = {
  price: 3,
  rci:   1,
  macd:  1,
};

// --------------------------------------
// 時間軸ラベルの整形
// 旧実装は3ファイルに同じ MM/DD 固定のフォーマッタが重複しており、
// 週足・月足や年跨ぎで年が読めなかった。
// ライブラリが渡す tickMarkType（Year / Month / DayOfMonth …）に応じて
// 粒度を変えるため、足種（timeframe）を引数で引き回す必要はない。
// --------------------------------------
/**
 * @param {number} time  UTC 秒
 * @param {number} tickMarkType LightweightCharts.TickMarkType
 * @returns {string}
 */
export function formatTickMark(time, tickMarkType) {
  const date = new Date(time * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const T = LightweightCharts.TickMarkType;
  switch (tickMarkType) {
    case T.Year:  return `${y}`;
    case T.Month: return `${y}/${m}`;
    default:      return `${m}/${d}`;
  }
}

// --------------------------------------
// 日付表示（HUD凡例・ツールチップ共通）
// バックエンドの返す日付は UTC 0時基準のため、JST に寄せてから読み出す。
// 旧実装では chart-price.js / chart-rci.js / chart-macd.js の3か所に
// 同一のロジックが重複していた。
// --------------------------------------
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * @param {number} time UTC 秒
 * @returns {string} YYYY/MM/DD
 */
export function formatDateJst(time) {
  const date = new Date(time * 1000 + JST_OFFSET_MS);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}
