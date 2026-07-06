// --------------------------------------
// chart-macd.js
// MACDチャート（MACD・Signal・Histogram）
// --------------------------------------
import { calcMACD } from "./chart-indicators.js";

export function createMacdChart(macdContainer, candleData) {
  const mRect = macdContainer.getBoundingClientRect();

  const chart = LightweightCharts.createChart(macdContainer, {
    width: mRect.width || 400,
    height: mRect.height || 160,
    layout: {
      background: { color: '#ffffff' },
      textColor: '#333',
    },
    rightPriceScale: {
      visible: true,
      borderVisible: true,
    },
    timeScale: {
      borderVisible: true,
      timeVisible: false,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkSpacing: 50,
    },
    grid: {
      vertLines: { color: '#eee' },
      horzLines: { color: '#eee' },
    },
  });

  chart.applyOptions({
    localization: {
      locale: 'ja-JP',
      dateFormat: 'yyyy/MM/dd',
    },
  });

  chart.timeScale().applyOptions({
    tickMarkFormatter: (time) => {
      const date = new Date(time * 1000);
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${m}/${d}`;
    },
  });

  // 凡例（色付き）
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.innerHTML = `
    <div><strong>【MACD】</strong></div>
    <div><span style="color:#0000ff;">■</span> MACD</div>
    <div><span style="color:#ff0000;">■</span> Signal</div>
    <div><span style="color:rgba(0,128,0,0.8);">■</span> Histogram</div>
  `;
  macdContainer.style.position = "relative";
  macdContainer.appendChild(legend);

  const macd = calcMACD(candleData, 12, 26, 9);

  const macdLineSeries = chart.addSeries(LightweightCharts.LineSeries, {
    color: '#0000ff',
    lineWidth: 1,
  });
  macdLineSeries.setData(macd.macdData.filter(p => p.value !== null));

  const macdSignalSeries = chart.addSeries(LightweightCharts.LineSeries, {
    color: '#ff0000',
    lineWidth: 1,
  });
  macdSignalSeries.setData(macd.signalData.filter(p => p.value !== null));

  const macdHistSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
    color: 'rgba(0, 128, 0, 0.6)',
    priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    scaleMargins: { top: 0.1, bottom: 0.1 },
  });
  macdHistSeries.setData(macd.histData.filter(p => p.value !== null));

  chart.priceScale('right').applyOptions({
    scaleMargins: { top: 0.1, bottom: 0.1 },
  });

  const macdTooltip = document.createElement('div');
  macdTooltip.style.position = 'absolute';
  macdTooltip.style.display = 'none';
  macdTooltip.style.padding = '6px';
  macdTooltip.style.background = 'rgba(255,255,255,0.9)';
  macdTooltip.style.border = '1px solid #ccc';
  macdTooltip.style.borderRadius = '4px';
  macdTooltip.style.fontSize = '12px';
  macdTooltip.style.pointerEvents = 'none';
  macdTooltip.style.zIndex = '2100';

  macdContainer.style.position = "relative";
  macdContainer.appendChild(macdTooltip);

  chart.subscribeCrosshairMove(param => {
    if (!param.time || !param.point) {
      macdTooltip.style.display = 'none';
      return;
    }

    const macdVal   = param.seriesData.get(macdLineSeries);
    const signalVal = param.seriesData.get(macdSignalSeries);
    const histVal   = param.seriesData.get(macdHistSeries);

    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const date = new Date(param.time * 1000 + JST_OFFSET);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    macdTooltip.style.display = 'block';

    const tooltipWidth = macdTooltip.offsetWidth;
    const containerWidth = macdContainer.clientWidth;

    let left = param.point.x + 20;
    if (left + tooltipWidth > containerWidth) {
      left = param.point.x - tooltipWidth - 20;
    }
    if (left < 0) left = 0;

    macdTooltip.style.left = left + 'px';
    macdTooltip.style.top  = param.point.y + 20 + 'px';

    macdTooltip.innerHTML = `
      <div>日付: ${y}/${m}/${d}</div>
      <div>MACD: ${macdVal?.value?.toFixed(4) ?? '-'}</div>
      <div>Signal: ${signalVal?.value?.toFixed(4) ?? '-'}</div>
      <div>Hist: ${histVal?.value?.toFixed(4) ?? '-'}</div>
    `;
  });

  return { chart };
}
