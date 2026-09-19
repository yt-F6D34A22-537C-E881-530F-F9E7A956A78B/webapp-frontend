// --------------------------------------
// chart-data.js
// API からチャートデータを取得し、
// candleData 形式に整形して返すモジュール
// --------------------------------------

// リトライ設定
// バックエンド（Render）のコールドスタート時に不正レスポンスが返る場合があるため、
// 指数バックオフで最大 FETCH_MAX_RETRIES 回リトライする。
const FETCH_MAX_RETRIES  = 3;   // 最大リトライ回数（初回 + 2回 = 最大3回試行）
const FETCH_RETRY_BASE_MS = 1500; // 初回リトライ待機時間（ms）。以降は 2倍ずつ増加

// --------------------------------------
// 取得結果キャッシュ（2026-09 追加）
// 同一銘柄で足種（日足／週足／月足）を切り替えるたびに同じ銘柄へ再アクセスし、
// Render のコールドスタート待ち（最大3回試行・最長約4.5秒の待機）を
// 繰り返し引き当てていたため、モーダルを開いている間だけ結果を保持する。
// キーは "<ticker>:<timeframe>"。モーダルを閉じる際に
// clearChartDataCache() で破棄するため、古い日足を掴み続けることはない。
// --------------------------------------
const chartDataCache = new Map();

/**
 * キャッシュを破棄する（chart-main.js の closeModal から呼び出す）
 */
export function clearChartDataCache() {
  chartDataCache.clear();
}

/**
 * 指定ミリ秒待機する
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * バックエンド API からチャートデータを取得し candleData 形式に整形して返す。
 * 不正レスポンス・ネットワークエラー時は指数バックオフでリトライする。
 * @param {string} ticker     銘柄コード（例: "7203"）
 * @param {string} timeframe  足種（"1d" | "1wk" | "1mo"）
 * @returns {Promise<Array|null>} candleData 配列、取得失敗時は null
 */
export async function fetchChartData(ticker, timeframe = "1d") {
  const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

  const cacheKey = `${ticker}:${timeframe}`;
  if (chartDataCache.has(cacheKey)) {
    return chartDataCache.get(cacheKey);
  }

  // ★ timeframe をバックエンドへ渡す
  // クエリ文字列はパラメータ汚染を避けるため必ずエンコードする（2026-09 追加）
  const url = `${API_BASE_URL}/chart`
    + `?ticker=${encodeURIComponent(ticker)}`
    + `&timeframe=${encodeURIComponent(timeframe)}`;

  for (let attempt = 1; attempt <= FETCH_MAX_RETRIES; attempt++) {
    try {
      const res  = await fetch(url);
      const json = await res.json();

      // 正常レスポンス判定：Close キーが存在すること
      if (!json || !json.Close) {
        console.warn(
          `データ形式が不正（試行 ${attempt}/${FETCH_MAX_RETRIES}）:`,
          json
        );

        // 最終試行だった場合はあきらめて null を返す
        if (attempt === FETCH_MAX_RETRIES) {
          console.error("最大リトライ回数に達しました。チャートデータを取得できませんでした。");
          return null;
        }

        // 次の試行まで待機（指数バックオフ）
        await sleep(FETCH_RETRY_BASE_MS * Math.pow(2, attempt - 1));
        continue;
      }

      // 日付を昇順にソート
      const dates = Object.keys(json.Close).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
      });

      // candleData 形式に変換
      const candleData = dates.map(d => ({
        time:   Math.floor(new Date(d).getTime() / 1000),
        open:   json.Open[d],
        high:   json.High[d],
        low:    json.Low[d],
        close:  json.Close[d],
        volume: json.Volume[d]
      }));

      // 成功時のみキャッシュする（null はキャッシュしない）
      chartDataCache.set(cacheKey, candleData);

      return candleData;

    } catch (e) {
      console.warn(`API取得エラー（試行 ${attempt}/${FETCH_MAX_RETRIES}）:`, e);

      // 最終試行だった場合はあきらめて null を返す
      if (attempt === FETCH_MAX_RETRIES) {
        console.error("最大リトライ回数に達しました。チャートデータを取得できませんでした。");
        return null;
      }

      // 次の試行まで待機（指数バックオフ）
      await sleep(FETCH_RETRY_BASE_MS * Math.pow(2, attempt - 1));
    }
  }

  // ここには到達しないが念のため
  return null;
}
