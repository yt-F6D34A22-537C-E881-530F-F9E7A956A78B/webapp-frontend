// --------------------------------------
// chart-rci.js
// RCIチャート（短期9・長期26）
// --------------------------------------
import { calcRCI } from "./chart-indicators.js";

export function createRciChart(rciContainer, candleData) {
  const rRect = rciContainer.getBoundingClientRect();

  const chart = LightweightCharts.createChart(rciContainer, {
    width: rRect.width || 400,
    height: rRect.height || 160,
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
    <div><strong>【RCI】</strong></div>
    <div><span style="color:#ff1493;">■</span> RCI(9)</div>
    <div><span style="color:#1e90ff;">■</span> RCI(26)</div>
  `;
  rciContainer.style.position = "relative";
  rciContainer.appendChild(legend);

  const rciShort = calcRCI(candleData, 9);
  const rciLong  = calcRCI(candleData, 26);

  const rciShortSeries = chart.addSeries(LightweightCharts.LineSeries, {
    color: '#ff1493',
    lineWidth: 1,
  });
  rciShortSeries.setData(rciShort.filter(p => p.value !== null));

  const rciLongSeries = chart.addSeries(LightweightCharts.LineSeries, {
    color: '#1e90ff',
    lineWidth: 1,
  });
  rciLongSeries.setData(rciLong.filter(p => p.value !== null));

  chart.priceScale('right').applyOptions({
    scaleMargins: { top: 0.1, bottom: 0.1 },
  });

  const rciTooltip = document.createElement('div');
  rciTooltip.style.position = 'absolute';
  rciTooltip.style.display = 'none';
  rciTooltip.style.padding = '6px';
  rciTooltip.style.background = 'rgba(255,255,255,0.9)';
  rciTooltip.style.border = '1px solid #ccc';
  rciTooltip.style.borderRadius = '4px';
  rciTooltip.style.fontSize = '12px';
  rciTooltip.style.pointerEvents = 'none';
  rciTooltip.style.zIndex = '2100';

  rciContainer.style.position = "relative";
  rciContainer.appendChild(rciTooltip);

  chart.subscribeCrosshairMove(param => {
    if (!param.time || !param.point) {
      rciTooltip.style.display = 'none';
      return;
    }

    const shortVal = param.seriesData.get(rciShortSeries);
    const longVal  = param.seriesData.get(rciLongSeries);

    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const date = new Date(param.time * 1000 + JST_OFFSET);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    rciTooltip.style.display = 'block';

    const tooltipWidth = rciTooltip.offsetWidth;
    const containerWidth = rciContainer.clientWidth;

    let left = param.point.x + 20;
    if (left + tooltipWidth > containerWidth) {
      left = param.point.x - tooltipWidth - 20;
    }
    if (left < 0) left = 0;

    rciTooltip.style.left = left + 'px';
    rciTooltip.style.top  = param.point.y + 20 + 'px';

    rciTooltip.innerHTML = `
      <div>日付: ${y}/${m}/${d}</div>
      <div>RCI(9): ${shortVal?.value?.toFixed(2) ?? '-'}</div>
      <div>RCI(26): ${longVal?.value?.toFixed(2) ?? '-'}</div>
    `;
  });

  return { chart };
}
