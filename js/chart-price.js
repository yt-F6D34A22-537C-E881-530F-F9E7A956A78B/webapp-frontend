// --------------------------------------
// chart-price.js（一目均衡表・動的雲：SpanA最背面 × SpanB前面）
// --------------------------------------

let candleSeries;
let volumeSeries;

let ma5Series, ma25Series, ma50Series, ma75Series, ma100Series;

let bbMidSeries, bbUpperSeries, bbLowerSeries;

let tenkanSeries, kijunSeries, span1Series, span2Series, chikouSeries;
let spanAArea, spanBArea;

// ▼ 表示状態フラグ
let showCandles = true;
let showMA = true;
let showBB = true;
let showIchimoku = true;

// --------------------------------------
// ローソク足の表示／非表示
// --------------------------------------
function applyCandleVisibility() {
  if (!candleSeries) return;

  if (showCandles) {
    candleSeries.applyOptions({
      upColor: 'red',
      downColor: 'blue',
      borderUpColor: 'red',
      borderDownColor: 'blue',
      wickUpColor: 'red',
      wickDownColor: 'blue',
    });
  } else {
    candleSeries.applyOptions({
      upColor: 'rgba(0,0,0,0)',
      downColor: 'rgba(0,0,0,0)',
      borderUpColor: 'rgba(0,0,0,0)',
      borderDownColor: 'rgba(0,0,0,0)',
      wickUpColor: 'rgba(0,0,0,0)',
      wickDownColor: 'rgba(0,0,0,0)',
    });
  }
}

// --------------------------------------
// MA の表示／非表示
// --------------------------------------
function applyMAVisibility() {
  if (!ma5Series) return;

  ma5Series.applyOptions({ visible: showMA });
  ma25Series.applyOptions({ visible: showMA });
  ma50Series.applyOptions({ visible: showMA });
  ma75Series.applyOptions({ visible: showMA });
  ma100Series.applyOptions({ visible: showMA });
}

// --------------------------------------
// BB の表示／非表示
// --------------------------------------
function applyBBVisibility() {
  if (!bbMidSeries) return;

  bbMidSeries.applyOptions({ visible: showBB });
  bbUpperSeries.applyOptions({ visible: showBB });
  bbLowerSeries.applyOptions({ visible: showBB });
}

// --------------------------------------
// 一目均衡表の表示／非表示
// --------------------------------------
function applyIchimokuVisibility() {
  if (!tenkanSeries) return;

  tenkanSeries.applyOptions({ visible: showIchimoku });
  kijunSeries.applyOptions({ visible: showIchimoku });
  span1Series.applyOptions({ visible: showIchimoku });
  span2Series.applyOptions({ visible: showIchimoku });
  chikouSeries.applyOptions({ visible: showIchimoku });

  spanAArea.applyOptions({ visible: showIchimoku });
  spanBArea.applyOptions({ visible: showIchimoku });
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
// 価格チャート生成（前半）
// --------------------------------------
function createPriceChart(priceChart, candleData) {

  const candleMap = new Map();
  candleData.forEach(c => candleMap.set(c.time, c));

  const makeValueMap = (arr) => {
    const m = new Map();
    arr.forEach(p => {
      if (p.value != null) m.set(p.time, p.value);
    });
    return m;
  };

  // 一目均衡表の計算
  const ichimoku = calcIchimoku(candleData);

  const bgRGBA = "rgba(255,255,255,1)";
  const bullColor = "rgba(0,200,0,0.35)";
  const bearColor = "rgba(200,0,0,0.35)";

  const spanBMap = new Map();
  for (const b of ichimoku.span2) {
    spanBMap.set(b.time, b.value);
  }

  const spanAColored = [];
  const spanBColored = [];

  for (const a of ichimoku.span1) {
    const bValue = spanBMap.get(a.time);
    if (bValue === undefined) continue;

    if (a.value > bValue) {
      spanAColored.push({ time: a.time, value: a.value, color: bullColor });
      spanBColored.push({ time: a.time, value: bValue, color: bgRGBA });
    } else {
      spanAColored.push({ time: a.time, value: a.value, color: bgRGBA });
      spanBColored.push({ time: a.time, value: bValue, color: bearColor });
    }
  }

  // 雲（AreaSeries）※スケールはローソク足と同じ、ラベルだけ消す
  spanAArea = priceChart.addSeries(LightweightCharts.AreaSeries, {
    topColor: bullColor,
    bottomColor: bgRGBA,
    lineColor: "rgba(0,0,0,0)",
    lineWidth: 0,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  spanAArea.setData(spanAColored);

  spanBArea = priceChart.addSeries(LightweightCharts.AreaSeries, {
    topColor: bearColor,
    bottomColor: bgRGBA,
    lineColor: "rgba(0,0,0,0)",
    lineWidth: 0,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  spanBArea.setData(spanBColored);

  // ローソク足（最新値だけ y軸に表示）
  candleSeries = priceChart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: 'red',
    downColor: 'blue',
    borderUpColor: 'red',
    borderDownColor: 'blue',
    wickUpColor: 'red',
    wickDownColor: 'blue',
    // lastValueVisible: true（デフォルトのまま）
  });
  candleSeries.setData(candleData);

  candleSeries.priceScale().applyOptions({
    scaleMargins: { top: 0.05, bottom: 0.10 },
  });

  applyCandleVisibility();

  // 出来高
  volumeSeries = priceChart.addSeries(LightweightCharts.HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
    color: 'rgba(128,128,128,0.6)',
  });

  priceChart.priceScale('volume').applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    }
  });

  volumeSeries.setData(
    candleData.map(c => ({ time: c.time, value: c.volume }))
  );

  function addMA(color, data) {
    const s = priceChart.addSeries(LightweightCharts.LineSeries, {
      color,
      lineWidth: 2,
      lastValueVisible: false,   // ★ y軸ラベル非表示
      priceLineVisible: false,   // ★ 価格ライン非表示
    });
    s.setData(data.filter(p => p.value !== null));
    return s;
  }

  const ma5 = calcMA(candleData, 5);
  const ma25 = calcMA(candleData, 25);
  const ma50 = calcMA(candleData, 50);
  const ma75 = calcMA(candleData, 75);
  const ma100 = calcMA(candleData, 100);

  ma5Series   = addMA('#ff1493', ma5);
  ma25Series  = addMA('#00aa00', ma25);
  ma50Series  = addMA('#0000ff', ma50);
  ma75Series  = addMA('#aa00aa', ma75);
  ma100Series = addMA('#ffaa00', ma100);

  const ma5Map   = makeValueMap(ma5);
  const ma25Map  = makeValueMap(ma25);
  const ma50Map  = makeValueMap(ma50);
  const ma75Map  = makeValueMap(ma75);
  const ma100Map = makeValueMap(ma100);

  const bb = calcBB(candleData, 20, 2);

  bbMidSeries = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: '#ffa500',
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  bbMidSeries.setData(bb.mid.filter(p => p.value !== null));

  bbUpperSeries = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: '#ffa500',
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  bbUpperSeries.setData(bb.upper.filter(p => p.value !== null));

  bbLowerSeries = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: '#ffa500',
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  bbLowerSeries.setData(bb.lower.filter(p => p.value !== null));

  const bbMidMap   = makeValueMap(bb.mid);
  const bbUpperMap = makeValueMap(bb.upper);
  const bbLowerMap = makeValueMap(bb.lower);

  // 一目均衡表の線（スケールは同じ、ラベルだけ消す）
  tenkanSeries = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: "#ff0000",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  tenkanSeries.setData(ichimoku.tenkanLine);

  kijunSeries = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: "#0000ff",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  kijunSeries.setData(ichimoku.kijunLine);

  span1Series = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: "#00aa00",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  span1Series.setData(ichimoku.span1);

  span2Series = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: "#aa00aa",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  span2Series.setData(ichimoku.span2);

  chikouSeries = priceChart.addSeries(LightweightCharts.LineSeries, {
    color: "#888888",
    lineWidth: 1,
    lastValueVisible: false,
    priceLineVisible: false,
  });
  chikouSeries.setData(ichimoku.chikou);

  // 一目用 Map
  const tenkanMap = makeValueMap(ichimoku.tenkanLine);
  const kijunMap  = makeValueMap(ichimoku.kijunLine);
  const span1Map  = makeValueMap(ichimoku.span1);
  const span2Map  = makeValueMap(ichimoku.span2);
  const chikouMap = makeValueMap(ichimoku.chikou);

  // ツールチップ
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.display = "none";
  tooltip.style.padding = "6px";
  tooltip.style.background = "rgba(255,255,255,0.9)";
  tooltip.style.border = "1px solid #ccc";
  tooltip.style.borderRadius = "4px";
  tooltip.style.fontSize = "12px";
  tooltip.style.pointerEvents = "none";
  tooltip.style.zIndex = "2100";

  chartContainer.style.position = "relative";
  chartContainer.appendChild(tooltip);

  priceChart.subscribeCrosshairMove(param => {
    if (!param.time || !param.point) {
      tooltip.style.display = "none";
      return;
    }

    const candle = candleMap.get(param.time);
    if (!candle) {
      tooltip.style.display = "none";
      return;
    }

    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const date = new Date(param.time * 1000 + JST_OFFSET);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");

    tooltip.style.display = "block";

    const tooltipWidth = tooltip.offsetWidth;
    const containerWidth = chartContainer.clientWidth;

    let left = param.point.x + 20;
    if (left + tooltipWidth > containerWidth) {
      left = param.point.x - tooltipWidth - 20;
    }
    if (left < 0) left = 0;

    tooltip.style.left = left + "px";
    tooltip.style.top = param.point.y + 20 + "px";

    tooltip.innerHTML = `
      <div>日付: ${y}/${m}/${d}</div>
      <div>始値: ${candle.open}</div>
      <div>高値: ${candle.high}</div>
      <div>安値: ${candle.low}</div>
      <div>終値: ${candle.close}</div>
      <div>出来高: ${candle.volume?.toLocaleString() ?? "-"}</div>
      <hr>
      <div>MA(5): ${ma5Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>MA(25): ${ma25Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>MA(50): ${ma50Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>MA(75): ${ma75Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>MA(100): ${ma100Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <hr>
      <div>BB ミドル: ${bbMidMap.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>BB 上限: ${bbUpperMap.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>BB 下限: ${bbLowerMap.get(param.time)?.toFixed(2) ?? "-"}</div>
      <hr>
      <div>転換線: ${tenkanMap.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>基準線: ${kijunMap.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>先行スパン1: ${span1Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>先行スパン2: ${span2Map.get(param.time)?.toFixed(2) ?? "-"}</div>
      <div>遅行スパン: ${chikouMap.get(param.time)?.toFixed(2) ?? "-"}</div>
    `;
  });

  // 凡例
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `
    <div><strong>【価格チャート】</strong></div>
    <div><span style="color:red;">■</span> 陽線</div>
    <div><span style="color:blue;">■</span> 陰線</div>
    <div><span style="color:#ff1493;">■</span> MA(5)</div>
    <div><span style="color:#00aa00;">■</span> MA(25)</div>
    <div><span style="color:#0000ff;">■</span> MA(50)</div>
    <div><span style="color:#aa00aa;">■</span> MA(75)</div>
    <div><span style="color:#ffaa00;">■</span> MA(100)</div>
    <div><span style="color:#ffa500;">■</span> ボリンジャーバンド</div>
    <div><span style="color:#ff0000;">■</span> 転換線</div>
    <div><span style="color:#0000ff;">■</span> 基準線</div>
    <div><span style="color:#00aa00;">■</span> 先行スパン1</div>
    <div><span style="color:#aa00aa;">■</span> 先行スパン2</div>
    <div><span style="color:#888888;">■</span> 遅行スパン</div>
  `;
  chartContainer.appendChild(legend);

  // 初期反映
  applyMAVisibility();
  applyBBVisibility();
  applyIchimokuVisibility();

  return { chart: priceChart };
}
