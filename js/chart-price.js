// --------------------------------------
// chart-price.js（一目均衡表・動的雲：SpanA最背面 × SpanB前面）
// --------------------------------------

let candleSeries;
let volumeSeries;

let ma5Series, ma25Series, ma50Series, ma75Series, ma100Series;

let bbMidSeries, bbUpperSeries, bbLowerSeries;

let tenkanSeries, kijunSeries, span1Series, span2Series, chikouSeries;
let spanAArea, spanBArea;

// ▼ 追加：MA / BB / 一目均衡表 の表示状態
let showCandles = true;
let showMA = true;
let showBB = true;
let showIchimoku = true;   // ★ 追加

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
// ★ 一目均衡表の表示／非表示
// --------------------------------------
function applyIchimokuVisibility() {
  if (!tenkanSeries) return;

  tenkanSeries.applyOptions({ visible: showIchimoku });
  kijunSeries.applyOptions({ visible: showIchimoku });
  span1Series.applyOptions({ visible: showIchimoku });
  span2Series.applyOptions({ visible: showIchimoku });
  chikouSeries.applyOptions({ visible: showIchimoku });

  // 雲（AreaSeries）
  spanAArea.applyOptions({ visible: showIchimoku });
  spanBArea.applyOptions({ visible: showIchimoku });
}

// --------------------------------------
// 一目均衡表の計算（営業日インデックスベース）
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

  // --------------------------------------
  // 一目均衡表（先に計算して雲を“最背面”に描画）
  // --------------------------------------
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

  spanAArea = priceChart.addSeries(LightweightCharts.AreaSeries, {
    topColor: bullColor,
    bottomColor: bgRGBA,
    lineColor: "rgba(0,0,0,0)",
    lineWidth: 0,
  });
  spanAArea.setData(spanAColored);

  spanBArea = priceChart.addSeries(LightweightCharts.AreaSeries, {
    topColor: bearColor,
    bottomColor: bgRGBA,
    lineColor: "rgba(0,0,0,0)",
    lineWidth: 0,
  });
  spanBArea.setData(spanBColored);

  // --------------------------------------
  // ローソク足・出来高・MA・BB・線を“上に”重ねる
  // --------------------------------------

  candleSeries = priceChart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: 'red',
    downColor: 'blue',
    borderUpColor: 'red',
    borderDownColor: 'blue',
    wickUpColor: 'red',
    wickDownColor: 'blue',
  });
  candleSeries.setData(candleData);

  candleSeries.priceScale().applyOptions({
    scaleMargins: { top: 0.05, bottom: 0.25 },
  });

  applyCandleVisibility();

  volumeSeries = priceChart.addSeries(LightweightCharts.HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
    color: 'rgba(128,128,128,0.6)',
  });

  priceChart.priceScale('volume').applyOptions({
    scaleMargins: {
      top: 0.9,
      bottom: 0,
    }
  });

  volumeSeries.setData(
    candleData.map(c => ({ time: c.time, value: c.volume }))
  );
  
  // --------------------------------------
  // 凡例
  // --------------------------------------
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

  // --------------------------------------
  // ▼ 追加：MA / BB / 一目均衡表 の初期反映
  // --------------------------------------
  applyMAVisibility();
  applyBBVisibility();
  applyIchimokuVisibility();

  return { chart: priceChart };
}
