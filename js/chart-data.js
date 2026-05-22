// --------------------------------------
// chart-data.js
// API からチャートデータを取得し、
// candleData 形式に整形して返すモジュール
// --------------------------------------

async function fetchChartData(ticker, timeframe = "1d") {
  const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

  // ★ timeframe をバックエンドへ渡す
  const url = `${API_BASE_URL}/chart?ticker=${ticker}&timeframe=${timeframe}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json || !json.Close) {
      console.error("データ形式が不正:", json);
      return null;
    }

    // 日付を昇順にソート
    const dates = Object.keys(json.Close).sort((a, b) => {
      return new Date(a).getTime() - new Date(b).getTime();
    });

    // candleData 形式に変換
    const candleData = dates.map(d => ({
      time: Math.floor(new Date(d).getTime() / 1000),
      open: json.Open[d],
      high: json.High[d],
      low: json.Low[d],
      close: json.Close[d],
      volume: json.Volume[d]
    }));

    return candleData;

  } catch (e) {
    console.error("API取得エラー:", e);
    return null;
  }
}
