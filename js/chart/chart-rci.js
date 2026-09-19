// --------------------------------------
// chart-rci.js
// RCIペイン（短期9・長期26）
//
// 2026-09 の可読性改修（1チャート3ペイン化）により、本ファイルは
// 独立したチャートインスタンスを生成しなくなった。
// 旧 createRciChart(rciContainer, candleData) → { chart } は、
// 価格チャートと同一の chart インスタンスの paneIndex 1 へシリーズを追加する
// 記述子（RCI_INDICATORS）へ置き換えている。
// これにより時間軸・十字カーソル・価格軸幅の同期がライブラリ標準機能で
// 保証され、chart-sync.js の bindTimeSync / setupResize が不要になった。
// --------------------------------------
import { calcRCI } from "./chart-indicators.js";
import { getTheme, LINE_WIDTH } from "./chart-theme.js";

const PANE_RCI = 1;

function makeValueMap(arr) {
  const m = new Map();
  arr.forEach(p => {
    if (p.value != null) m.set(p.time, p.value);
  });
  return m;
}

function formatFixed(map, time, digits = 2) {
  const v = map.get(time);
  return v == null ? null : v.toFixed(digits);
}

export const RCI_INDICATORS = [
  {
    key: "rci",
    label: "RCI",
    toggleId: null,        // サブペインは常時表示（トグル対象外）
    defaultVisible: true,
    pane: PANE_RCI,

    // 期間を1か所で持つ（短期・長期）
    periods: { short: 9, long: 26 },

    build(chart, candleData) {
      const T = getTheme();

      const shortData = calcRCI(candleData, this.periods.short);
      const longData  = calcRCI(candleData, this.periods.long);

      const shortSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: T.rciShort,
        lineWidth: LINE_WIDTH.sub,
      }, PANE_RCI);
      shortSeries.setData(shortData.filter(p => p.value !== null));

      const longSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: T.rciLong,
        lineWidth: LINE_WIDTH.sub,
      }, PANE_RCI);
      longSeries.setData(longData.filter(p => p.value !== null));

      shortSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
      });

      const shortMap = makeValueMap(shortData);
      const longMap  = makeValueMap(longData);

      return {
        series: [shortSeries, longSeries],
        primitives: [],
        legend: [
          {
            key: "rciShort",
            label: `RCI(${this.periods.short})`,
            color: T.rciShort,
            valueAt: (t) => formatFixed(shortMap, t),
          },
          {
            key: "rciLong",
            label: `RCI(${this.periods.long})`,
            color: T.rciLong,
            valueAt: (t) => formatFixed(longMap, t),
          },
        ],
      };
    },
  },
];
