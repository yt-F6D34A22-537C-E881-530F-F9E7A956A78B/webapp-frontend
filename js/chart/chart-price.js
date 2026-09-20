// --------------------------------------
// chart-price.js（価格ペイン：ローソク足 / 出来高 / MA / BB / 一目均衡表）
//
// 2026-09 の可読性改修により、本ファイルの責務は
// 「価格ペイン（paneIndex 0）に載せるインジケータ群の記述子を提供すること」
// に変わった。旧 createPriceChart() が担っていた
//   ・シリーズ生成
//   ・表示フラグ（showCandles 等）の保持と apply*Visibility()
//   ・凡例 DOM の生成
//   ・マウス追従ツールチップ
// のうち、表示制御は chart-main.js、凡例は chart-legend.js へ移し、
// ツールチップは HUD 凡例へ統合して廃止した。
// インジケータを1つ追加する際に触る箇所を「記述子1件」に閉じるための構成
// （旧実装ではシリーズ変数宣言・apply*Visibility・set* セッター・凡例 HTML・
//   ツールチップ HTML の5か所を同時に修正する必要があった）。
// --------------------------------------
import { calcMA, calcBB } from "./chart-indicators.js";
import { getTheme, LINE_WIDTH, getLineStyles } from "./chart-theme.js";

// --------------------------------------
// ボリンジャーバンド ±3σ 外側の背景塗り Series Primitive（2026-09 追加）
//
// 「+3σ より上」「-3σ より下」をグレーで塗り、統計上まれな価格帯であることを
// 可視化する。上端・下端はペインの上辺・下辺まで塗りつぶす。
//
// 重なり順：zOrder は "bottom"（ローソク足・各ラインより背面）。
// 同じ zOrder の Primitive 同士は、アタッチ先シリーズの生成順に描画されるため、
// 本 Primitive を一目均衡表の雲より先に生成されるシリーズ（ボリンジャーバンド）へ
// アタッチすることで、雲より背面に描画される。
// PRICE_INDICATORS の並び順（… bb → ichimoku …）がこの前後関係を担保している。
// --------------------------------------
class OuterBandPrimitive {
  constructor(data, options) {
    this._data = data;               // [{ time, upper, lower }]（±3σ）
    this._options = options;         // { fillColor }
    this._visible = true;
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._points = [];

    this._paneView = {
      renderer: () => ({ draw: (target) => this._draw(target) }),
      zOrder: () => "bottom",
    };
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews() {
    return [this._paneView];
  }

  updateAllViews() {
    if (!this._chart || !this._series) {
      this._points = [];
      return;
    }
    const timeScale = this._chart.timeScale();
    const points = [];
    for (const d of this._data) {
      const x = timeScale.timeToCoordinate(d.time);
      const yUpper = this._series.priceToCoordinate(d.upper);
      const yLower = this._series.priceToCoordinate(d.lower);
      if (x === null || yUpper === null || yLower === null) continue;
      points.push({ x, yUpper, yLower });
    }
    this._points = points;
  }

  setVisible(visible) {
    this._visible = visible;
    if (this._requestUpdate) this._requestUpdate();
  }

  _draw(target) {
    if (!this._visible) return;
    const pts = this._points;
    if (pts.length < 2) return;

    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr } = scope;
      const height = scope.bitmapSize.height;

      ctx.fillStyle = this._options.fillColor;

      // +3σ より上（ペイン上辺まで）
      ctx.beginPath();
      ctx.moveTo(pts[0].x * hr, 0);
      for (const p of pts) ctx.lineTo(p.x * hr, p.yUpper * vr);
      ctx.lineTo(pts[pts.length - 1].x * hr, 0);
      ctx.closePath();
      ctx.fill();

      // -3σ より下（ペイン下辺まで）
      ctx.beginPath();
      ctx.moveTo(pts[0].x * hr, height);
      for (const p of pts) ctx.lineTo(p.x * hr, p.yLower * vr);
      ctx.lineTo(pts[pts.length - 1].x * hr, height);
      ctx.closePath();
      ctx.fill();
    });
  }
}

// --------------------------------------
// 一目均衡表の雲（Ichimoku Cloud）Series Primitive
// Lightweight Chartsには2本のライン（先行スパン1・先行スパン2）の間を
// 直接塗りつぶすネイティブなシリーズ型が存在しないため、Series Primitive
// （ISeriesPrimitive）として自作し、先行スパン1・先行スパン2で挟まれた
// 領域をポリゴンとして描画する。
// 公式のバンド系プラグイン例（bands-indicator）と同様、Custom Series
// （addCustomSeries）ではなく Primitive（attachPrimitive）で実装する
// （Custom Seriesは新しいシリーズ型そのものを定義する重い仕組みであり、
// 既存シリーズの上に帯・塗りつぶしを重ねるだけの用途にはPrimitiveが適切、
// というLightweight Charts公式の使い分け方針に沿った）。
// --------------------------------------
class IchimokuCloudPrimitive {
  constructor(data, options) {
    this._data = data;                 // [{ time, spanA, spanB }]
    this._options = options;           // { bullColor, bearColor }
    this._visible = true;
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
    this._points = [];                 // ピクセル座標へ変換済みの点列

    this._paneView = {
      renderer: () => ({ draw: (target) => this._draw(target) }),
      zOrder: () => "bottom",          // ローソク足・各ラインより背面に描画
    };
  }

  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  paneViews() {
    return [this._paneView];
  }

  // 表示範囲・スケールが変わるたびに呼ばれる。ここで価格・時刻をピクセル座標へ変換する。
  updateAllViews() {
    if (!this._chart || !this._series) {
      this._points = [];
      return;
    }
    const timeScale = this._chart.timeScale();
    const points = [];
    for (const d of this._data) {
      const x = timeScale.timeToCoordinate(d.time);
      const yA = this._series.priceToCoordinate(d.spanA);
      const yB = this._series.priceToCoordinate(d.spanB);
      if (x === null || yA === null || yB === null) continue;
      points.push({ x, yA, yB, bull: d.spanA >= d.spanB });
    }
    this._points = points;
  }

  setData(data) {
    this._data = data;
    if (this._requestUpdate) this._requestUpdate();
  }

  setVisible(visible) {
    this._visible = visible;
    if (this._requestUpdate) this._requestUpdate();
  }

  // 陽転（先行スパン1＞先行スパン2）／陰転で連続する区間ごとに
  // 「上端＝先行スパン1を forward」「下端＝先行スパン2を backward」で
  // ポリゴンを組み立てて塗りつぶす。
  _draw(target) {
    if (!this._visible) return;
    const pts = this._points;
    if (pts.length < 2) return;

    target.useBitmapCoordinateSpace((scope) => {
      const { context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr } = scope;
      let i = 0;
      while (i < pts.length - 1) {
        const bull = pts[i].bull;
        let j = i;
        while (j < pts.length - 1 && pts[j + 1].bull === bull) j++;

        if (j > i) {
          ctx.beginPath();
          ctx.fillStyle = bull ? this._options.bullColor : this._options.bearColor;
          ctx.moveTo(pts[i].x * hr, pts[i].yA * vr);
          for (let k = i; k <= j; k++) ctx.lineTo(pts[k].x * hr, pts[k].yA * vr);
          for (let k = j; k >= i; k--) ctx.lineTo(pts[k].x * hr, pts[k].yB * vr);
          ctx.closePath();
          ctx.fill();
        }
        i = j > i ? j : i + 1;
      }
    });
  }
}

// --------------------------------------
// 一目均衡表の計算
// --------------------------------------
function calcIchimoku(candleData) {
  const len = candleData.length;

  const tenkan = new Array(len).fill(null);
  const kijun = new Array(len).fill(null);
  const span1 = [];
  const span2 = [];
  const chikou = [];

  for (let i = 0; i < len; i++) {
    if (i >= 8) {
      let high = -Infinity, low = Infinity;
      for (let j = i - 8; j <= i; j++) {
        high = Math.max(high, candleData[j].high);
        low = Math.min(low, candleData[j].low);
      }
      tenkan[i] = (high + low) / 2;
    }

    if (i >= 25) {
      let high = -Infinity, low = Infinity;
      for (let j = i - 25; j <= i; j++) {
        high = Math.max(high, candleData[j].high);
        low = Math.min(low, candleData[j].low);
      }
      kijun[i] = (high + low) / 2;
    }
  }

  for (let i = 0; i < len; i++) {
    const shift = i + 26;
    if (shift >= len) continue;

    if (tenkan[i] != null && kijun[i] != null) {
      span1.push({
        time: candleData[shift].time,
        value: (tenkan[i] + kijun[i]) / 2,
      });
    }

    if (i >= 51) {
      let high = -Infinity, low = Infinity;
      for (let j = i - 51; j <= i; j++) {
        high = Math.max(high, candleData[j].high);
        low = Math.min(low, candleData[j].low);
      }
      span2.push({
        time: candleData[shift].time,
        value: (high + low) / 2,
      });
    }
  }

  for (let i = 26; i < len; i++) {
    chikou.push({
      time: candleData[i - 26].time,
      value: candleData[i].close,
    });
  }

  const tenkanLine = [];
  const kijunLine = [];
  for (let i = 0; i < len; i++) {
    if (tenkan[i] != null) tenkanLine.push({ time: candleData[i].time, value: tenkan[i] });
    if (kijun[i] != null) kijunLine.push({ time: candleData[i].time, value: kijun[i] });
  }

  return { tenkanLine, kijunLine, span1, span2, chikou };
}

// --------------------------------------
// 共通ヘルパ
// --------------------------------------
const PANE_PRICE = 0;

function makeValueMap(arr) {
  const m = new Map();
  arr.forEach(p => {
    if (p.value != null) m.set(p.time, p.value);
  });
  return m;
}

// 凡例用の数値整形。値が無い時刻は null を返し、chart-legend.js 側で "-" になる。
function formatFixed(map, time, digits = 2) {
  const v = map.get(time);
  return v == null ? null : v.toFixed(digits);
}

function addLine(chart, color, data, extraOptions = {}) {
  const series = chart.addSeries(LightweightCharts.LineSeries, {
    color,
    lineWidth: LINE_WIDTH.ma,
    lastValueVisible: false,   // ★ y軸ラベル非表示
    priceLineVisible: false,   // ★ 価格ライン非表示
    ...extraOptions,
  }, PANE_PRICE);
  series.setData(data.filter(p => p.value !== null));
  return series;
}

// --------------------------------------
// インジケータ記述子（価格ペイン）
//
// key            : グループ識別子。localStorage のキー・凡例の data-legend-group
//                  ・チェックボックスの data-indicator-group と一致させる
// label          : 人間向けの名称（現状は保守用。UI では未使用）
// toggleId       : 対応するチェックボックスの id（null ならトグルなし＝常時表示）
// defaultVisible : 保存値もチェックボックスも無い場合の既定値
// pane           : 配置先ペイン番号
// build          : シリーズ・凡例項目を生成して返す
//                  → { series: [], primitives: [], legend: [] }
// setVisible     : 既定の visible 切替以外の挙動が必要な場合のみ定義（ローソク足）
//
// 新しいインジケータを追加する場合は、この配列に記述子を1件足すだけでよい
// （凡例・表示トグル・保存/復元はすべて記述子から自動生成される）。
// --------------------------------------
export const PRICE_INDICATORS = [
  {
    key: "candle",
    label: "ローソク足",
    toggleId: "toggleCandles",
    defaultVisible: true,
    pane: PANE_PRICE,

    build(chart, candleData) {
      const T = getTheme();
      const candleMap = new Map();
      candleData.forEach(c => candleMap.set(c.time, c));

      const series = chart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: T.candleUp,
        downColor: T.candleDown,
        borderUpColor: T.candleUp,
        borderDownColor: T.candleDown,
        wickUpColor: T.candleUp,
        wickDownColor: T.candleDown,
        // lastValueVisible: true（デフォルトのまま）
      }, PANE_PRICE);
      series.setData(candleData);

      // 出来高（下端22%）とローソク足の描画領域を重ねない。
      // 旧設定（bottom: 0.05）では安値圏でローソク足に出来高が被っていた。
      series.priceScale().applyOptions({
        scaleMargins: { top: 0.05, bottom: 0.22 },
      });

      return {
        series: [series],
        primitives: [],
        legend: [
          {
            key: "ohlc",
            label: "O/H/L/C",
            // chart-legend.js へ「ラベル行と値行を上下2段で描画する」ことを
            // 伝えるフラグ（2026-09 追加）。値は始値/高値/安値/終値の
            // スラッシュ区切り1文字列のまま渡し、表示のみ2段組にする。
            ohlc: true,
            color: T.candleUp,
            valueAt: (time) => {
              const c = candleMap.get(time);
              if (!c) return null;
              return `${c.open} / ${c.high} / ${c.low} / ${c.close}`;
            },
          },
        ],
      };
    },

    // ローソク足だけは visible: false ではなく透明色で隠す。
    // visible: false にすると価格スケールの自動調整対象から外れ、
    // MA だけを表示した際にスケールが変わってしまうため（旧実装の挙動を踏襲）。
    setVisible(built, visible) {
      const T = getTheme();
      const transparent = "rgba(0,0,0,0)";
      const up   = visible ? T.candleUp   : transparent;
      const down = visible ? T.candleDown : transparent;

      built.series[0].applyOptions({
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      });
    },
  },

  {
    key: "volume",
    label: "出来高",
    toggleId: "toggleVolume",
    defaultVisible: true,
    pane: PANE_PRICE,

    build(chart, candleData) {
      const T = getTheme();
      const volumeMap = new Map();
      candleData.forEach(c => volumeMap.set(c.time, c.volume));

      const series = chart.addSeries(LightweightCharts.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        color: T.volume,
      }, PANE_PRICE);

      series.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      series.setData(candleData.map(c => ({ time: c.time, value: c.volume })));

      return {
        series: [series],
        primitives: [],
        legend: [
          {
            key: "volume",
            label: "出来高",
            color: T.volume,
            valueAt: (time) => volumeMap.get(time)?.toLocaleString() ?? null,
          },
        ],
      };
    },
  },

  {
    key: "ma",
    label: "移動平均線",
    toggleId: "toggleMA",
    defaultVisible: true,
    pane: PANE_PRICE,

    // 期間を1か所で持つ。期間を増減する場合は、この配列と chart-theme.js の
    // 色定義（ma<期間>）を対応させるだけでよい。
    periods: [5, 25, 50, 75, 100],

    build(chart, candleData) {
      const T = getTheme();
      const series = [];
      const legend = [];

      const LS = getLineStyles();

      for (const period of this.periods) {
        const data = calcMA(candleData, period);
        const color = T[`ma${period}`];
        // MA はすべて実線（線種で他のインジケータと区別する）
        series.push(addLine(chart, color, data, { lineStyle: LS.ma }));

        const map = makeValueMap(data);
        legend.push({
          key: `ma${period}`,
          label: `MA(${period})`,
          color,
          valueAt: (time) => formatFixed(map, time),
        });
      }

      return { series, primitives: [], legend };
    },
  },

  {
    key: "bb",
    label: "ボリンジャーバンド（±1σ / ±2σ / ±3σ）",
    toggleId: "toggleBB",
    // 2026-09：初期表示を「ローソク足＋出来高＋MA」に絞る。
    // 価格ペインに常時13本の線が重なることが可読性低下の最大要因だったため。
    defaultVisible: false,
    pane: PANE_PRICE,

    // 描画する σ（2026-09：従来の ±2σ のみから ±1σ / ±2σ / ±3σ へ拡張）。
    // 値を増減する場合は chart-theme.js の色（bb<σ>）と線種（LINE_STYLE.bb<σ>）を
    // 対応させること。
    sigmas: [1, 2, 3],

    build(chart, candleData) {
      const T = getTheme();
      const LS = getLineStyles();
      const bb = calcBB(candleData, 20, this.sigmas);

      const series = [];
      const legend = [];

      // 中心線（凡例上は +σ 群と -σ 群の間に置くため、後で並べ替える）
      const midSeries = addLine(chart, T.bbMid, bb.mid, {
        lineWidth: LINE_WIDTH.bb,
        lineStyle: LS.bbMid,
      });
      const midMap = makeValueMap(bb.mid);
      series.push(midSeries);

      const upperLegend = [];
      const lowerLegend = [];

      for (const band of bb.bands) {
        const color = T[`bb${band.sigma}`];
        const lineStyle = LS[`bb${band.sigma}`];

        const upperSeries = addLine(chart, color, band.upper, {
          lineWidth: LINE_WIDTH.bb,
          lineStyle,
        });
        const lowerSeries = addLine(chart, color, band.lower, {
          lineWidth: LINE_WIDTH.bb,
          lineStyle,
        });
        series.push(upperSeries, lowerSeries);

        const upperMap = makeValueMap(band.upper);
        const lowerMap = makeValueMap(band.lower);

        upperLegend.push({
          key: `bbUpper${band.sigma}`,
          label: `+${band.sigma}σ`,
          color,
          valueAt: (t) => formatFixed(upperMap, t),
        });
        lowerLegend.push({
          key: `bbLower${band.sigma}`,
          label: `-${band.sigma}σ`,
          color,
          valueAt: (t) => formatFixed(lowerMap, t),
        });
      }

      // 凡例は +3σ → +1σ → 中心 → -1σ → -3σ の順（チャート上の並びと一致させる）
      legend.push(
        ...upperLegend.slice().reverse(),
        { key: "bbMid", label: "BB中心", color: T.bbMid, valueAt: (t) => formatFixed(midMap, t) },
        ...lowerLegend
      );

      // ±3σ の外側をグレーで塗る（外側＝最大 σ のバンドを使用）
      const outerBand = bb.bands[bb.bands.length - 1];
      const outerData = [];
      for (let i = 0; i < outerBand.upper.length; i++) {
        const u = outerBand.upper[i];
        const l = outerBand.lower[i];
        if (u.value == null || l.value == null) continue;
        outerData.push({ time: u.time, upper: u.value, lower: l.value });
      }

      const outside = new OuterBandPrimitive(outerData, {
        fillColor: T.bbOutside,
      });
      // 一目均衡表の雲より背面に置くため、雲より先に生成されるシリーズへアタッチする
      midSeries.attachPrimitive(outside);

      return {
        series,
        primitives: [outside],
        legend,
      };
    },
  },

  {
    key: "ichimoku",
    label: "一目均衡表",
    toggleId: "toggleIchimoku",
    defaultVisible: false,   // 2026-09：BB と同様に初期 OFF
    pane: PANE_PRICE,

    build(chart, candleData) {
      const T = getTheme();
      const LS = getLineStyles();
      const ichimoku = calcIchimoku(candleData);

      // 一目均衡表は実線を使わない（実線は MA 専用）。
      // 転換線・基準線・先行スパン・遅行スパンをそれぞれ異なる線種で描き分ける。
      const tenkan = addLine(chart, T.tenkan, ichimoku.tenkanLine, { lineWidth: LINE_WIDTH.ichimoku, lineStyle: LS.tenkan });
      const kijun  = addLine(chart, T.kijun,  ichimoku.kijunLine,  { lineWidth: LINE_WIDTH.ichimoku, lineStyle: LS.kijun });
      const span1  = addLine(chart, T.span1,  ichimoku.span1,      { lineWidth: LINE_WIDTH.ichimoku, lineStyle: LS.span });
      const span2  = addLine(chart, T.span2,  ichimoku.span2,      { lineWidth: LINE_WIDTH.ichimoku, lineStyle: LS.span });
      const chikou = addLine(chart, T.chikou, ichimoku.chikou,     { lineWidth: LINE_WIDTH.ichimoku, lineStyle: LS.chikou });

      // 雲（先行スパン1・先行スパン2で挟まれた領域）の元データ。
      // 片方が欠損している時刻は雲の対象外。
      const spanBMap = new Map();
      for (const b of ichimoku.span2) spanBMap.set(b.time, b.value);

      const cloudData = [];
      for (const a of ichimoku.span1) {
        const bValue = spanBMap.get(a.time);
        if (bValue === undefined) continue;
        cloudData.push({ time: a.time, spanA: a.value, spanB: bValue });
      }

      // zOrder: "bottom" のためアタッチ先の series は候補のうちどれでもよい
      // （priceToCoordinate は同じ価格スケールを共有する全シリーズで同じ結果になる）。
      // 旧実装は candleSeries へアタッチしていたが、グループ間の依存を無くすため
      // 一目均衡表グループ自身の span1 シリーズへアタッチする（2026-09 変更）。
      const cloud = new IchimokuCloudPrimitive(cloudData, {
        bullColor: T.cloudBull,
        bearColor: T.cloudBear,
      });
      span1.attachPrimitive(cloud);

      const tenkanMap = makeValueMap(ichimoku.tenkanLine);
      const kijunMap  = makeValueMap(ichimoku.kijunLine);
      const span1Map  = makeValueMap(ichimoku.span1);
      const span2Map  = makeValueMap(ichimoku.span2);
      const chikouMap = makeValueMap(ichimoku.chikou);

      return {
        series: [tenkan, kijun, span1, span2, chikou],
        primitives: [cloud],   // setVisible(visible) を持つもの
        legend: [
          { key: "tenkan", label: "転換線",      color: T.tenkan, valueAt: (t) => formatFixed(tenkanMap, t) },
          { key: "kijun",  label: "基準線",      color: T.kijun,  valueAt: (t) => formatFixed(kijunMap, t) },
          { key: "span1",  label: "先行スパン1", color: T.span1,  valueAt: (t) => formatFixed(span1Map, t) },
          { key: "span2",  label: "先行スパン2", color: T.span2,  valueAt: (t) => formatFixed(span2Map, t) },
          { key: "chikou", label: "遅行スパン",  color: T.chikou, valueAt: (t) => formatFixed(chikouMap, t) },
        ],
      };
    },
  },
];
