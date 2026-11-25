// --------------------------------------
// chart-patterns.js
// チャートパターン検出モジュール（2026-11 新設）
//   三尊 / 逆三尊 / ダブルトップ / ダブルボトム / 上昇三角 / 下降三角 / 対称三角
//
// 責務：candleData（chart-data.js の整形結果）から「いま成立しているパターン」を
// 検出し、描画に必要な座標だけを返す。DOM・LightweightCharts・テーマには依存しない
// 純粋関数のみで構成する（chart-indicators.js と同じ位置づけ。描画は chart-price.js）。
//
// 検出の流れ（detectPatterns）
//   1. findZigzagPivots() … ノイズを除いた高値・安値の交互列（ジグザグ）を1回だけ作る
//   2. PATTERN_DEFINITIONS の各 detect(data, pivots, params) へ同じピボット列を渡す
//   3. 優先順位（配列の並び順）に従い、時間的に重なるパターンは先に採用されたものを残す
//      （例：三尊の中のダブルトップ状の2山は採用されない）
//
// 「発生している」の定義：どのパターンも、ネックライン／トレンドラインを
// 終値でブレイクしたものだけを返す（形成途中のものは返さない）。
//
// 先読み（ルックアヘッド）はしない：各ピボットは「反転幅 reversalRatio 以上
// 戻した時点」で確定し、最終バー以降の値を使わない。値動きクイズで出題日までの
// データだけを渡した場合も、出題日以降の情報は混ざらない。
//
// 閾値はすべて PATTERN_PARAMS に集約している（推測の初期値。実データで要調整）。
// ダブルトップ・ボトムの深さ（minDepthRatio）は、日次変動率2%のランダムウォーク200本×500回で
// 検出頻度を確認し、浅いと乱発する（6%で1本あたり約1.3件）ため8%（同約0.2件）とした。
// ただしランダムウォークは実際の相場の代用にはならない。実データでの確認が必要。
// --------------------------------------

export const PATTERN_PARAMS = {
  zigzag: {
    reversalRatio: 0.05,        // 直近の極値から5%戻したらピボット確定
  },

  // 三尊・逆三尊
  headAndShoulders: {
    headOverShoulderMin:    0.02,       // 頭は両肩より2%以上突出
    shoulderToleranceRatio: 0.07,       // 左右の肩の価格差（低い方に対する比）の上限
    necklineTiltMax:        0.05,       // 2つの谷の価格差（低い方に対する比）の上限
    minHeadHeightRatio:     0.03,       // ネックラインから頭までの高さ（ネックライン価格に対する比）の下限
    timeSymmetryRange:      [0.5, 2.0], // 右肩までの本数 / 左肩までの本数 の許容範囲
    maxBreakoutBars:        20,         // 右肩の確定後、この本数以内にブレイクしたものだけ採用
  },

  // ダブルトップ・ダブルボトム
  doublePeak: {
    peakToleranceRatio: 0.02,   // 2つの山（谷）の価格差（低い方に対する比）の上限
    minDepthRatio:      0.08,   // 山の平均値から間の谷までの深さ（山の平均値に対する比）の下限
    minPeakGapBars:     10,     // 2つの山の間隔（本数）の下限
    maxPeakGapBars:     80,     // 同上限
    maxBreakoutBars:    20,     // 2つ目の山の確定後、この本数以内にブレイクしたものだけ採用
  },

  // 三角持ち合い（上昇・下降・対称）
  triangle: {
    flatToleranceRatio:  0.02,  // 「水平」とみなす変化率（始点→終点）の上限
    slopeMinRatio:       0.03,  // 「上昇／下降」とみなす変化率の下限
    touchToleranceRatio: 0.02,  // 各ピボットが辺から外れてよい比率（3点目の接触・期間中の終値の内側判定）
    convergenceRatio:    0.7,   // 終点の幅 / 始点の幅 の上限（収束しているか）
    minBars:             10,    // パターンの長さ（本数）の下限
    maxBars:             120,   // 同上限
    maxBreakoutBars:     20,    // 最後のピボットの確定後、この本数以内にブレイクしたものだけ採用
  },
};

// 三角持ち合いの判定に使う連続ピボット数（高値3＋安値2 または 高値2＋安値3）
const TRIANGLE_WINDOW_PIVOTS = 5;

// ------------------------------
// ジグザグ（高値・安値が交互に並ぶピボット列）
// 戻り値: [{ index, time, price, type: "high" | "low" }]
// 末尾の「まだ反転が確定していない極値」は含めない。
// ------------------------------
export function findZigzagPivots(data, ratio = PATTERN_PARAMS.zigzag.reversalRatio) {
  const pivots = [];
  if (!data || data.length < 2) return pivots;

  const pushHigh = (i) => pivots.push({ index: i, time: data[i].time, price: data[i].high, type: "high" });
  const pushLow  = (i) => pivots.push({ index: i, time: data[i].time, price: data[i].low,  type: "low"  });

  let trend = 0;            // 0:方向未確定 / 1:上昇中（高値を追跡）/ -1:下降中（安値を追跡）
  let hiIdx = 0, loIdx = 0; // trend === 0 の間の暫定高値・安値
  let extIdx = 0;           // trend !== 0 の間、追跡中の極値のバー番号

  for (let i = 1; i < data.length; i++) {
    const bar = data[i];

    if (trend === 0) {
      if (bar.high > data[hiIdx].high) hiIdx = i;
      if (bar.low  < data[loIdx].low)  loIdx = i;

      if (hiIdx > loIdx && data[hiIdx].high >= data[loIdx].low * (1 + ratio)) {
        pushLow(loIdx);
        trend = 1;
        extIdx = hiIdx;
      } else if (loIdx > hiIdx && data[loIdx].low <= data[hiIdx].high * (1 - ratio)) {
        pushHigh(hiIdx);
        trend = -1;
        extIdx = loIdx;
      }
      continue;
    }

    if (trend === 1) {
      if (bar.high > data[extIdx].high) {
        extIdx = i;
      } else if (bar.low <= data[extIdx].high * (1 - ratio)) {
        pushHigh(extIdx);
        trend = -1;
        extIdx = i;
      }
    } else {
      if (bar.low < data[extIdx].low) {
        extIdx = i;
      } else if (bar.high >= data[extIdx].low * (1 + ratio)) {
        pushLow(extIdx);
        trend = 1;
        extIdx = i;
      }
    }
  }

  return pivots;
}

// ------------------------------
// 共通ヘルパ
// ------------------------------

// 2点（{ index, price }）を通る直線。バー番号 → 価格 の関数を返す
function lineThrough(a, b) {
  const slope = (b.price - a.price) / (b.index - a.index);
  return (i) => a.price + slope * (i - a.index);
}

// 直線 valueAt を from〜to のバーごとにサンプリングして LineSeries 用データにする。
// 毎バーの値を持たせるのは、描画データと HUD 凡例の値を同じ配列から作り、
// 両者が必ず一致するようにするため。
function sampleLine(data, valueAt, fromIdx, toIdx) {
  const out = [];
  for (let i = fromIdx; i <= toIdx; i++) {
    out.push({ time: data[i].time, value: valueAt(i) });
  }
  return out;
}

/**
 * 検出結果の共通形式を作る。
 * @param {string} kind
 * @param {Array<{time:number, price:number}>} bodyPivots 折れ線で結ぶピボット
 * @param {Array<Array<{time:number, value:number}>>} guides 補助線（ネックライン／トレンドライン）
 * @param {Array<{time:number, value:number}>} keyGuide guides のうちブレイクされた線（HUD 凡例の値の元）
 * @param {number} breakoutTime
 */
function makePattern(kind, bodyPivots, guides, keyGuide, breakoutTime) {
  const body = bodyPivots.map(pt => ({ time: pt.time, value: pt.price }));
  return { kind, body, guides, keyGuide, startTime: body[0].time, breakoutTime };
}

// ------------------------------
// 三尊（inverse: false）／逆三尊（inverse: true）
// 逆三尊は「高値と安値を入れ替えた三尊」として同一ロジックで判定する
// （s = -1 で大小比較を反転）。価格の比率計算は常に実価格で行う。
// ------------------------------
function detectHeadAndShoulders(data, pivots, inverse, p) {
  const s = inverse ? -1 : 1;
  const peakType = inverse ? "low" : "high";
  const kind = inverse ? "inverseHeadAndShoulders" : "headAndShoulders";
  const extremeOf = (bar) => (inverse ? bar.low : bar.high);

  const found = [];
  let lastBreakoutIndex = -1;

  for (let i0 = 0; i0 + 4 < pivots.length; i0++) {
    if (pivots[i0].type !== peakType) continue;

    const [ls, t1, head, t2, rs] = pivots.slice(i0, i0 + 5);
    if (ls.index <= lastBreakoutIndex) continue;   // 直前のパターンと重ねない

    // 頭が両肩より突出している（三尊：高い／逆三尊：低い）
    const over = (sh) => (s * (head.price - sh.price)) / sh.price;
    if (over(ls) < p.headOverShoulderMin) continue;
    if (over(rs) < p.headOverShoulderMin) continue;

    // 左右の肩の高さがおおむね揃っている
    if (Math.abs(ls.price - rs.price) / Math.min(ls.price, rs.price) > p.shoulderToleranceRatio) continue;

    // 2つの谷（ネックライン）の傾きが急すぎない
    if (Math.abs(t1.price - t2.price) / Math.min(t1.price, t2.price) > p.necklineTiltMax) continue;

    // 左右の時間的な釣り合い
    const timeRatio = (rs.index - head.index) / (head.index - ls.index);
    if (timeRatio < p.timeSymmetryRange[0] || timeRatio > p.timeSymmetryRange[1]) continue;

    // ネックライン（2つの谷を通る直線）
    const neckAt = lineThrough(t1, t2);

    // 頭・両肩がネックラインの外側にあり、頭の高さが十分ある
    if (s * (ls.price - neckAt(ls.index)) <= 0) continue;
    if (s * (rs.price - neckAt(rs.index)) <= 0) continue;
    if ((s * (head.price - neckAt(head.index))) / neckAt(head.index) < p.minHeadHeightRatio) continue;

    // ブレイク確認：右肩の後、頭を超える動きが出る前に、終値がネックラインを抜けたもの
    let breakoutIdx = -1;
    const last = Math.min(data.length - 1, rs.index + p.maxBreakoutBars);
    for (let i = rs.index + 1; i <= last; i++) {
      if (s * extremeOf(data[i]) > s * head.price) break;      // 頭を更新 → 不成立
      if (s * (data[i].close - neckAt(i)) < 0) { breakoutIdx = i; break; }
    }
    if (breakoutIdx === -1) continue;

    const neckline = sampleLine(data, neckAt, t1.index, breakoutIdx);
    found.push(makePattern(kind, [ls, t1, head, t2, rs], [neckline], neckline, data[breakoutIdx].time));
    lastBreakoutIndex = breakoutIdx;
  }

  return found;
}

// ------------------------------
// ダブルトップ（inverse: false）／ダブルボトム（inverse: true）
// 山（谷）2つと、その間の谷（山）の3ピボットで判定する。
// ネックラインは間のピボットを通る水平線。
// ------------------------------
function detectDoublePeak(data, pivots, inverse, p) {
  const s = inverse ? -1 : 1;
  const peakType = inverse ? "low" : "high";
  const kind = inverse ? "doubleBottom" : "doubleTop";
  const extremeOf = (bar) => (inverse ? bar.low : bar.high);

  const found = [];
  let lastBreakoutIndex = -1;

  for (let i0 = 0; i0 + 2 < pivots.length; i0++) {
    if (pivots[i0].type !== peakType) continue;

    const [p1, mid, p2] = pivots.slice(i0, i0 + 3);
    if (p1.index <= lastBreakoutIndex) continue;

    // 2つの山（谷）の高さがおおむね揃っている
    if (Math.abs(p1.price - p2.price) / Math.min(p1.price, p2.price) > p.peakToleranceRatio) continue;

    // 山（谷）同士の間隔
    const gap = p2.index - p1.index;
    if (gap < p.minPeakGapBars || gap > p.maxPeakGapBars) continue;

    // 間のピボットまでの深さが十分ある
    const avgPeak = (p1.price + p2.price) / 2;
    if ((s * (avgPeak - mid.price)) / avgPeak < p.minDepthRatio) continue;

    // ブレイク確認：2つ目の後、山（谷）を更新する動きが出る前に、終値が水平ネックラインを抜けたもの
    const peakExtreme = inverse ? Math.min(p1.price, p2.price) : Math.max(p1.price, p2.price);
    let breakoutIdx = -1;
    const last = Math.min(data.length - 1, p2.index + p.maxBreakoutBars);
    for (let i = p2.index + 1; i <= last; i++) {
      if (s * (extremeOf(data[i]) - peakExtreme) > 0) break;  // 山（谷）を更新 → 不成立
      if (s * (data[i].close - mid.price) < 0) { breakoutIdx = i; break; }
    }
    if (breakoutIdx === -1) continue;

    const neckline = sampleLine(data, () => mid.price, p1.index, breakoutIdx);
    found.push(makePattern(kind, [p1, mid, p2], [neckline], neckline, data[breakoutIdx].time));
    lastBreakoutIndex = breakoutIdx;
  }

  return found;
}

// ------------------------------
// 三角持ち合い
//   ascending   : 上辺が水平・下辺が切り上がる。上方向へブレイクしたものだけ採用
//   descending  : 下辺が水平・上辺が切り下がる。下方向へブレイクしたものだけ採用
//   symmetrical : 上辺が切り下がり・下辺が切り上がる。どちらへのブレイクも採用
// 連続する5ピボット（高値3＋安値2 または 高値2＋安値3）の「各タイプの最初と最後」を
// 結んで2辺とし、3点目のピボットがその辺に接していることを確認する。
// ジグザグのピボットは反転幅以上戻して初めて確定するため、ブレイク方向への最後の
// 山（谷）はブレイク前には確定しない。したがって窓は「ブレイク前に確定した最後の
// ピボット」で終わり、その後ろのバーでブレイクを探す。
// ------------------------------
function detectTriangles(data, pivots, shape, p) {
  const kind = `${shape}Triangle`;
  const W = TRIANGLE_WINDOW_PIVOTS;

  const isFlat    = (x) => Math.abs(x) <= p.flatToleranceRatio;
  const isRising  = (x) => x >= p.slopeMinRatio;
  const isFalling = (x) => x <= -p.slopeMinRatio;
  const matchesShape = (upperChange, lowerChange) => {
    if (shape === "ascending")  return isFlat(upperChange) && isRising(lowerChange);
    if (shape === "descending") return isFlat(lowerChange) && isFalling(upperChange);
    return isFalling(upperChange) && isRising(lowerChange);   // symmetrical
  };

  const found = [];
  let lastBreakoutIndex = -1;

  for (let i0 = 0; i0 + W <= pivots.length; i0++) {
    const win = pivots.slice(i0, i0 + W);
    const startIdx = win[0].index;
    const endIdx   = win[W - 1].index;
    if (startIdx <= lastBreakoutIndex) continue;

    const span = endIdx - startIdx;
    if (span < p.minBars || span > p.maxBars) continue;

    const highs = win.filter(x => x.type === "high");
    const lows  = win.filter(x => x.type === "low");
    const hFirst = highs[0], hLast = highs[highs.length - 1];
    const lFirst = lows[0],  lLast = lows[lows.length - 1];

    const upper = lineThrough(hFirst, hLast);
    const lower = lineThrough(lFirst, lLast);

    // 形状（辺の傾き）
    const upperChange = (hLast.price - hFirst.price) / hFirst.price;
    const lowerChange = (lLast.price - lFirst.price) / lFirst.price;
    if (!matchesShape(upperChange, lowerChange)) continue;

    // 3点目のピボットが辺に接している
    const touches = (pts, line) =>
      pts.every(pt => Math.abs(pt.price - line(pt.index)) / line(pt.index) <= p.touchToleranceRatio);
    if (!touches(highs, upper) || !touches(lows, lower)) continue;

    // 収束している（終点の幅が始点の幅より十分狭い）
    const widthStart = upper(startIdx) - lower(startIdx);
    const widthEnd   = upper(endIdx)   - lower(endIdx);
    if (widthStart <= 0 || widthEnd <= 0 || widthEnd > widthStart * p.convergenceRatio) continue;

    // 期間中の終値が2辺の内側に収まっている（すでにブレイクしたものを除く）
    let contained = true;
    for (let i = startIdx; i <= endIdx; i++) {
      const c = data[i].close;
      if (c > upper(i) * (1 + p.touchToleranceRatio) || c < lower(i) * (1 - p.touchToleranceRatio)) {
        contained = false;
        break;
      }
    }
    if (!contained) continue;

    // ブレイク確認：最後のピボットの後、2辺が交わる（頂点）前に、終値が辺を抜けたもの
    let breakoutIdx = -1;
    let direction = 0;   // 1:上抜け / -1:下抜け
    const last = Math.min(data.length - 1, endIdx + p.maxBreakoutBars);
    for (let i = endIdx + 1; i <= last; i++) {
      if (upper(i) <= lower(i)) break;
      const c = data[i].close;
      if (c > upper(i)) { direction = 1;  breakoutIdx = i; break; }
      if (c < lower(i)) { direction = -1; breakoutIdx = i; break; }
    }
    if (breakoutIdx === -1) continue;
    if (shape === "ascending"  && direction !== 1)  continue;
    if (shape === "descending" && direction !== -1) continue;

    const upperGuide = sampleLine(data, upper, hFirst.index, breakoutIdx);
    const lowerGuide = sampleLine(data, lower, lFirst.index, breakoutIdx);
    const keyGuide = direction === 1 ? upperGuide : lowerGuide;

    found.push(makePattern(kind, win, [upperGuide, lowerGuide], keyGuide, data[breakoutIdx].time));
    lastBreakoutIndex = breakoutIdx;
  }

  return found;
}

// --------------------------------------
// パターン定義（単一情報源）
//
// 並び順が優先順位。時間的に重なる場合は先に載っているものが採用される
// （反転型の大きなパターン → 小さなパターン → 持ち合い の順）。
//
// kind        : パターン識別子（検出結果の kind と一致）
// label       : 人間向けの名称（HUD 凡例）
// guideLabel  : 凡例に出す補助線の名称（ネックライン／ブレイクした辺）
// colorKey    : chart-theme.js の色キー。方向感で3色に束ねる
//               patternBearish（下落を示唆）/ patternBullish（上昇を示唆）/ patternNeutral
// legendKey   : HUD 凡例の項目 key
// detect      : (data, pivots, params) => 検出結果の配列
//
// 新しいパターンを追加する場合は、detectXxx を1つ書いて、この配列へ1件足し、
// 色が新しければ chart-theme.js に追加するだけでよい（chart-price.js は変更不要）。
// --------------------------------------
export const PATTERN_DEFINITIONS = [
  {
    kind: "headAndShoulders",
    label: "三尊",
    guideLabel: "ネック",
    colorKey: "patternBearish",
    legendKey: "patternHeadAndShoulders",
    detect: (data, pivots, params) => detectHeadAndShoulders(data, pivots, false, params.headAndShoulders),
  },
  {
    kind: "inverseHeadAndShoulders",
    label: "逆三尊",
    guideLabel: "ネック",
    colorKey: "patternBullish",
    legendKey: "patternInverseHeadAndShoulders",
    detect: (data, pivots, params) => detectHeadAndShoulders(data, pivots, true, params.headAndShoulders),
  },
  {
    kind: "doubleTop",
    label: "ダブルトップ",
    guideLabel: "ネック",
    colorKey: "patternBearish",
    legendKey: "patternDoubleTop",
    detect: (data, pivots, params) => detectDoublePeak(data, pivots, false, params.doublePeak),
  },
  {
    kind: "doubleBottom",
    label: "ダブルボトム",
    guideLabel: "ネック",
    colorKey: "patternBullish",
    legendKey: "patternDoubleBottom",
    detect: (data, pivots, params) => detectDoublePeak(data, pivots, true, params.doublePeak),
  },
  {
    kind: "ascendingTriangle",
    label: "上昇三角",
    guideLabel: "ブレイク辺",
    colorKey: "patternBullish",
    legendKey: "patternAscendingTriangle",
    detect: (data, pivots, params) => detectTriangles(data, pivots, "ascending", params.triangle),
  },
  {
    kind: "descendingTriangle",
    label: "下降三角",
    guideLabel: "ブレイク辺",
    colorKey: "patternBearish",
    legendKey: "patternDescendingTriangle",
    detect: (data, pivots, params) => detectTriangles(data, pivots, "descending", params.triangle),
  },
  {
    kind: "symmetricalTriangle",
    label: "対称三角",
    guideLabel: "ブレイク辺",
    colorKey: "patternNeutral",
    legendKey: "patternSymmetricalTriangle",
    detect: (data, pivots, params) => detectTriangles(data, pivots, "symmetrical", params.triangle),
  },
];

/**
 * 成立しているチャートパターンを検出する。
 * @param {Array} data candleData（time 昇順）
 * @param {object} [params] PATTERN_PARAMS の上書き
 * @returns {Array<{
 *   kind: string,
 *   body: Array<{time: number, value: number}>,            // ピボットを結ぶ折れ線
 *   guides: Array<Array<{time: number, value: number}>>,   // 補助線（ネックライン／トレンドライン）
 *   keyGuide: Array<{time: number, value: number}>,        // guides のうちブレイクされた線
 *   startTime: number,
 *   breakoutTime: number
 * }>}
 */
export function detectPatterns(data, params = PATTERN_PARAMS) {
  if (!data || data.length === 0) return [];

  const pivots = findZigzagPivots(data, params.zigzag.reversalRatio);   // 全検出器で共有
  const accepted = [];

  for (const def of PATTERN_DEFINITIONS) {
    for (const pat of def.detect(data, pivots, params)) {
      const overlaps = accepted.some(a => pat.startTime <= a.breakoutTime && a.startTime <= pat.breakoutTime);
      if (!overlaps) accepted.push(pat);
    }
  }

  return accepted;
}
