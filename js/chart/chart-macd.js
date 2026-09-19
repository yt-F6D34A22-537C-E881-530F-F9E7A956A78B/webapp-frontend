// --------------------------------------
// chart-macd.js
// MACDペイン（MACD・Signal・Histogram）
//
// 2026-09 の可読性改修（1チャート3ペイン化）により、本ファイルは
// 独立したチャートインスタンスを生成しなくなった。
// 旧 createMacdChart(macdContainer, candleData) → { chart } は、
// 価格チャートと同一の chart インスタンスの paneIndex 2 へシリーズを追加する
// 記述子（MACD_INDICATORS）へ置き換えている。
// 時間軸ラベルはチャート最下段（＝本ペインの下）に1本だけ描画される。
// --------------------------------------
import { calcMACD } from "./chart-indicators.js";
import { getTheme, LINE_WIDTH } from "./chart-theme.js";

const PANE_MACD = 2;

function makeValueMap(arr) {
  const m = new Map();
  arr.forEach(p => {
    if (p.value != null) m.set(p.time, p.value);
  });
  return m;
}

function formatFixed(map, time, digits = 4) {
  const v = map.get(time);
  return v == null ? null : v.toFixed(digits);
}

export const MACD_INDICATORS = [
  {
    key: "macd",
    label: "MACD",
    toggleId: null,        // サブペインは常時表示（トグル対象外）
    defaultVisible: true,
    pane: PANE_MACD,

    // 期間を1か所で持つ
    periods: { short: 12, long: 26, signal: 9 },

    build(chart, candleData) {
      const T = getTheme();
      const macd = calcMACD(
        candleData,
        this.periods.short,
        this.periods.long,
        this.periods.signal
      );

      const lineSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: T.macdLine,
        lineWidth: LINE_WIDTH.sub,
      }, PANE_MACD);
      lineSeries.setData(macd.macdData.filter(p => p.value !== null));

      const signalSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: T.macdSignal,
        lineWidth: LINE_WIDTH.sub,
      }, PANE_MACD);
      signalSeries.setData(macd.signalData.filter(p => p.value !== null));

      const histSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
        color: T.macdHist,
        priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
      }, PANE_MACD);
      histSeries.setData(macd.histData.filter(p => p.value !== null));

      lineSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
      });

      const macdMap   = makeValueMap(macd.macdData);
      const signalMap = makeValueMap(macd.signalData);
      const histMap   = makeValueMap(macd.histData);

      return {
        series: [lineSeries, signalSeries, histSeries],
        primitives: [],
        legend: [
          { key: "macdLine",   label: "MACD",   color: T.macdLine,   valueAt: (t) => formatFixed(macdMap, t) },
          { key: "macdSignal", label: "Signal", color: T.macdSignal, valueAt: (t) => formatFixed(signalMap, t) },
          { key: "macdHist",   label: "Hist",   color: T.macdHist,   valueAt: (t) => formatFixed(histMap, t) },
        ],
      };
    },
  },
];
