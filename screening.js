const startBtn = document.getElementById("startBtn");
const cancelBtn = document.getElementById("cancelBtn");
const progressText = document.getElementById("progressText");
const elapsedTimeEl = document.getElementById("elapsedTime");
const tbody = document.querySelector("#resultTable tbody"); 

const dateSelect = document.getElementById("dateSelect");                     // date_ranking 用
const ratioDateSelect = document.getElementById("ratioDateSelect");           // ratio 用
const heuristicsDateSelect = document.getElementById("heuristicsDateSelect"); // heuristics 用

const loadingOverlay = document.getElementById("loadingOverlay");

let abortController = null;
let currentResults = [];
let sortState = {};
let elapsedSeconds = 0;
let timerId = null;

const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

// heuristicsの種別
const HEURISTICS_TYPES = [
  {
    group_label: "移動平均線の傾き",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_MA_SLOPE_DAILY",   label: "日足" },
      { key: "TECH_MA_SLOPE_WEEKLY",  label: "週足" },
      { key: "TECH_MA_SLOPE_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "移動平均線の位置",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_MA_POSITION_DAILY",   label: "日足" },
      { key: "TECH_MA_POSITION_WEEKLY",  label: "週足" },
      { key: "TECH_MA_POSITION_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "パーフェクトオーダー",
    trend_direction_css: "th-bg-trend-up",
    items: [
      { key: "TECH_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "逆パーフェクトオーダー",
    trend_direction_css: "th-bg-trend-down",
    items: [
      { key: "TECH_REVERSE_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_REVERSE_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_REVERSE_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "パーフェクトオーダー前夜",
    trend_direction_css: "th-bg-trend-up",
    items: [
      { key: "TECH_PRE_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_PRE_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_PRE_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "逆パーフェクトオーダー前夜",
    trend_direction_css: "th-bg-trend-down",
    items: [
      { key: "TECH_PRE_REVERSE_PERFECT_ORDER_DAILY",   label: "日足" },
      { key: "TECH_PRE_REVERSE_PERFECT_ORDER_WEEKLY",  label: "週足" },
      { key: "TECH_PRE_REVERSE_PERFECT_ORDER_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "移動平均線の収束",
    trend_direction_css: "th-bg-trend-up",
    items: [
      { key: "TECH_MA_CONGESTION", label: "移動平均線の収束" }
    ]
  },
  {
    group_label: "移動平均線の拡散",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_MA_SPREAD",     label: "移動平均線の拡散" }
    ]
  },
  {
    group_label: "100MAトレンド",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_MA100_TREND", label: "100MAトレンド" }
    ]
  },
  {
    group_label: "下半身・逆下半身",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_KAHANSHIN",       label: "下半身",     trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_GYAKU_KAHANSHIN", label: "逆下半身",   trend_direction_css: "th-bg-trend-down" }
    ]
  },
  {
    group_label: "5MA更新",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_5MA_UPDATE", label: "5MA更新" }
    ]
  },
  {
    group_label: "酒田五法",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_SAKATA_TRIPLE_TOP",    label: "三尊天井",   trend_direction_css: "th-bg-trend-down" },
      { key: "TECH_SAKATA_TRIPLE_BOTTOM", label: "逆三尊",     trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_SAKATA_SANKU_UP",      label: "三空（上）", trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_SAKATA_SANKU_DOWN",    label: "三空（下）", trend_direction_css: "th-bg-trend-down" },
      { key: "TECH_SAKATA_SANPEI_UP",     label: "三兵（上）", trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_SAKATA_SANPEI_DOWN",   label: "三兵（下）", trend_direction_css: "th-bg-trend-down" },
      { key: "TECH_SAKATA_SANPO_UP",      label: "三法（上）", trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_SAKATA_SANPO_DOWN",    label: "三法（下）", trend_direction_css: "th-bg-trend-down" }
    ]
  },
  {
    group_label: "パターン",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_HEAD_AND_SHOULDERS", label: "ヘッド＆ショルダー",  trend_direction_css: "th-bg-trend-down" },
      { key: "TECH_DOUBLE_BOTTOM",      label: "ダブルボトム",        trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_NICHI_DAI",          label: "N大",                trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_GYAKU_NICHI_DAI",    label: "逆N大",              trend_direction_css: "th-bg-trend-down" },
      { key: "TECH_IN_IN_HARAMI",       label: "陰の陰はらみ",        trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_RED_BLUE_CROSS",     label: "赤と青の交差",        trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_RETURN_SELL_END",    label: "戻り待ち売り後",      trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_DOWN_TREND_END",     label: "下降相場の終わり",    trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_MOMIAI",             label: "揉み合い",           trend_direction_css: "th-bg-trend-up" }
    ]
  },
  {
    group_label: "物別れ",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_MONOWAKARE",              label: "物別れ" },
      { key: "TECH_MONOWAKARE_RED_BLUE_CROSS", label: "物別れ（赤青クロス）" }
    ]
  },
  {
    group_label: "9の法則",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_RULE9_DAILY",  label: "日足" },
      { key: "TECH_RULE9_WEEKLY", label: "週足" }
    ]
  },
  {
    group_label: "BBゾーンブレイク",
    trend_direction_css: "th-bg-trend-up",
    items: [
      { key: "TECH_BB_ZONE_BREAK_DAILY",   label: "日足" },
      { key: "TECH_BB_ZONE_BREAK_WEEKLY",  label: "週足" },
      { key: "TECH_BB_ZONE_BREAK_MONTHLY", label: "月足" }
    ]
  },
  {
    group_label: "ボックスレンジ",
    items: [
      { key: "TECH_BOX_RANGE", label: "ボックスレンジ" }
    ]
  },
  {
    group_label: "過熱",
    trend_direction_css: "th-bg-trend-down",
    items: [
      { key: "TECH_OVERHEAT", label: "過熱" }
    ]
  },
  {
    group_label: "グランビル",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_GRANVILLE", label: "グランビル" }
    ]
  },
  {
    group_label: "トレンドサイクル進行度",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_CYCLE_PROGRESS", label: "トレンドサイクル進行度", trend_direction_css: "th-bg-trend-up" }
    ]
  },
  {
    group_label: "節目",
    trend_direction_css: "th-bg-trend-either",
    items: [
      { key: "TECH_FUSHIME_UP",   label: "レジスタンス", trend_direction_css: "th-bg-trend-up" },
      { key: "TECH_FUSHIME_DOWN", label: "サポート", trend_direction_css: "th-bg-trend-down" }
    ]
  }
];

/* ============================================================
   表示用ユーティリティ
============================================================ */
function boolMark(v) {
  return v === true ? "○" : v === false ? "×" : "";
}

function formatDirectionMark(direction) {
  return direction === "up" ? "↗" :
         direction === "down" ? "↘" :
         direction === "flat" ? "－" : "";
}

/* ============================================================
   CSV ダウンロード
============================================================ */

/**
 * CSV セル値をエスケープする（RFC 4180 準拠）
 * ダブルクォート・カンマ・改行を含む場合はダブルクォートで囲む
 * @param {*} value
 * @returns {string}
 */
function escapeCsvCell(value) {
  const str = (value === null || value === undefined) ? "" : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replaceAll('"', '""') + '"';
  }
  return str;
}

/**
 * heuristics モードの TECH_* 値を画面表示と同等のテキストに変換する
 * specifications.json の cellRendering 定義に準拠
 * @param {string} key   TECH_* キー名
 * @param {*}      val   セル値
 * @returns {string}
 */
function techValueToText(key, val) {
  switch (key) {
    // --- 酒田五法（数値 or null） ---
    case "TECH_SAKATA_TRIPLE_TOP":
    case "TECH_SAKATA_TRIPLE_BOTTOM":
    case "TECH_SAKATA_SANKU_UP":
    case "TECH_SAKATA_SANKU_DOWN":
    case "TECH_SAKATA_SANPEI_UP":
    case "TECH_SAKATA_SANPEI_DOWN":
    case "TECH_SAKATA_SANPO_UP":
    case "TECH_SAKATA_SANPO_DOWN":
      return val ? "○" : "";

    // --- 9の法則（オブジェクト） ---
    case "TECH_RULE9_DAILY":
    case "TECH_RULE9_WEEKLY":
      if (!val || !val.direction) return "";
      return `${formatDirectionMark(val.direction)}（${val.count} 本目）`;

    // --- グランビル（オブジェクト） ---
    case "TECH_GRANVILLE":
      if (!val || !val.direction) return "";
      return `${formatDirectionMark(val.direction)}（${val.count}）`;

    // --- 節目（オブジェクト） ---
    case "TECH_FUSHIME_UP":
    case "TECH_FUSHIME_DOWN":
      if (!val || !val.price) return "";
      return `${val.price}（${val.tryCount}回）`;

    // --- トレンドサイクル進行度（オブジェクト or null） ---
    case "TECH_CYCLE_PROGRESS":
      if (!val || !val.direction) return "";
      return `${formatDirectionMark(val.direction)}（${val.count}日）`;

    // 上記以外
    default:
      switch (typeof val) {
        case "string":  return formatDirectionMark(val);
        case "boolean": return boolMark(val);
        default:        return "";
      }
  }
}

/**
 * 現在の表示モードに応じた CSV ヘッダ行（1行）を生成する
 * 2行ヘッダ（heuristics）は「1行目（2行目）」形式でまとめる
 * @param {string} mode   ratio | date | heuristics
 * @param {string} label  date モードの日付ラベル（例: 2025/06/27（金））
 * @returns {string[]}    ヘッダセルの配列
 */
function buildCsvHeaders(mode, label) {
  if (mode === "ratio") {
    return ["コード", "銘柄名", "出来高倍率", "上髭実体比", "出来高", "上髭", "実体"];
  }

  if (mode === "date") {
    return ["コード", "銘柄名", "値上がり率", `${label}終値`, "前日終値"];
  }

  if (mode === "heuristics") {
    // 固定列（rowspan=2 なので 1行目のみ）
    const headers = ["コード", "銘柄名", "トレンド", "スコア"];

    for (const typeObj of HEURISTICS_TYPES) {
      const itemCount = typeObj.items.length;

      if (itemCount > 1) {
        // グループ複数 → 「グループ名（item.label）」
        for (const item of typeObj.items) {
          headers.push(`${typeObj.group_label}（${item.label}）`);
        }
      } else {
        const item = typeObj.items[0];
        if (typeObj.group_label === item.label) {
          // rowspan=2 の単独列 → グループ名のみ
          headers.push(typeObj.group_label);
        } else {
          // グループ名と item.label が異なる → 「グループ名（item.label）」
          headers.push(`${typeObj.group_label}（${item.label}）`);
        }
      }
    }

    return headers;
  }

  if (mode === "compare") {
    // 画面表示と同一の列順に合わせる
    return ["コード", "銘柄名", "スコア", "上昇/下降の予測", "上昇/下降の結果", "比較元終値", "比較先終値", "増減（円）", "増減（％）"];
  }

  return [];
}

/**
 * 結果1行分のセル値配列を返す
 * @param {object} r     結果オブジェクト
 * @param {string} mode  ratio | date | heuristics
 * @returns {string[]}
 */
function buildCsvRow(r, mode) {
  if (mode === "ratio") {
    return [
      r.コード,
      r.銘柄名,
      r.出来高倍率,
      r.上髭実体比,
      r.出来高,
      r.上髭,
      r.実体
    ].map(String);
  }

  if (mode === "date") {
    return [
      r.コード,
      r.銘柄名,
      `${r.値上がり率}%`,
      r.当日終値,
      r.前日終値
    ].map(String);
  }

  if (mode === "heuristics") {
    const cells = [
      r.コード,
      r.銘柄名,
      formatDirectionMark(r.トレンド),
      r.スコア
    ].map(String);

    for (const typeObj of HEURISTICS_TYPES) {
      for (const item of typeObj.items) {
        cells.push(techValueToText(item.key, r[item.key]));
      }
    }

    return cells;
  }

  if (mode === "compare") {
    const compareResult = (!r.error && r.比較元終値 != null && r.比較先終値 != null)
      ? calcCompareResult(r.比較元終値, r.比較先終値)
      : "";
    const score = uploadedCsvScoreMap[r.コード] ?? "-";
    return [
      r.コード,
      r.銘柄名,
      score,
      formatDirectionMark(r.予測) || "-",
      compareResult,
      r.比較元終値 ?? "",
      r.比較先終値 ?? "",
      r.増減円  != null ? (r.増減円  > 0 ? "+" : "") + r.増減円  : "",
      r.増減率 != null ? (r.増減率 > 0 ? "+" : "") + r.増減率 + "%" : ""
    ].map(String);
  }

  return [];
}

/**
 * 現在の currentResults を CSV ファイルとしてダウンロードする
 * ファイル名: screening_<mode>_<YYYYMMDD>.csv
 */
function downloadCsv() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;

  if (!currentResults || currentResults.length === 0) return;

  // date モードのラベル（ヘッダに使用）
  let label = "";
  if (mode === "date") {
    const d = dateSelect.value;
    const y = d.substring(0, 4);
    const m = d.substring(4, 6);
    const day = d.substring(6, 8);
    const w = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${day}`).getDay()];
    label = `${y}/${m}/${day}（${w}）`;
  }

  const headers = buildCsvHeaders(mode, label);
  const rows = currentResults.map(r => buildCsvRow(r, mode));

  // CSV 文字列を組み立てる（RFC 4180 準拠）
  const csvLines = [headers, ...rows]
    .map(cells => cells.map(escapeCsvCell).join(","))
    .join("\r\n");

  // BOM 付き UTF-8（Excel での文字化け防止）
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvLines], { type: "text/csv;charset=utf-8;" });

  // ファイル名: screening_<mode>_<YYYYMMDD>.csv
  // YYYYMMDD はスクリーニングへ指定した日付（モードごとの日付セレクタ値）
  const targetDateMap = {
    ratio:      ratioDateSelect.value,
    date:       dateSelect.value,
    heuristics: heuristicsDateSelect.value,
  };
  const dateStr = targetDateMap[mode] || "";
  const fileName = dateStr
    ? `screening_${mode}_${dateStr}.csv`
    : `screening_${mode}.csv`;

  // <a> 要素でダウンロードをトリガー
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * compare モードの予測合致率を算出する
 * 予測が null の行（date / 証券コード直接入力）は集計対象外
 * @param {object[]} results - currentResults
 * @returns {{ up: {matched,total}, down: {matched,total}, all: {matched,total} } | null}
 *          予測あり行が0件の場合は null
 */
function calcMatchRate(results) {
  const predictable = results.filter(
    r => !r.error && r.予測 != null && r.比較元終値 != null && r.比較先終値 != null
  );
  if (predictable.length === 0) return null;

  let upMatched = 0, upTotal = 0;
  let downMatched = 0, downTotal = 0;

  predictable.forEach(r => {
    const actual = calcCompareResult(r.比較元終値, r.比較先終値);
    const predicted = formatDirectionMark(r.予測); // "↗" | "↘"

    if (predicted === "↗") {
      upTotal++;
      if (actual === "↗") upMatched++;
    } else if (predicted === "↘") {
      downTotal++;
      if (actual === "↘") downMatched++;
    }
  });

  const allMatched = upMatched + downMatched;
  const allTotal   = upTotal  + downTotal;

  return {
    up:   { matched: upMatched,   total: upTotal },
    down: { matched: downMatched, total: downTotal },
    all:  { matched: allMatched,  total: allTotal,
            rate: Math.round(allMatched / allTotal * 100) }
  };
}

/* ============================================================
   初期化処理
============================================================ */
/* ----------------------------------------------------------
   除外市場・商品区分：共通定義（ratio / heuristics で共有）
   選択肢・デフォルト値の変更はここ1箇所を編集すれば
   両モードに反映される。
---------------------------------------------------------- */
const EXCLUDE_MARKET_OPTIONS = [
  "ETF・ETN",
  "PRO Market",
  "REIT・ベンチャーファンド・カントリーファンド・インフラファンド",
  "出資証券",
  "グロース（内国株式）",
  "グロース（外国株式）",
  "スタンダード（内国株式）",
  "スタンダード（外国株式）",
  "プライム（内国株式）",
  "プライム（外国株式）",
];

const EXCLUDE_MARKET_DEFAULT_CHECKED = ["ETF・ETN"];

/**
 * 除外市場・商品区分のチェックボックス fieldset を EXCLUDE_MARKET_OPTIONS から
 * 動的生成し、指定コンテナ（containerId）内の [data-exclude-markets-slot] へ挿入する。
 * 生成直後は disabled（モード切替時に initSearchMode() が有効・無効を制御する）。
 */
function renderExcludeMarketsFieldset(containerId) {
  const slot = document.querySelector(`#${containerId} [data-exclude-markets-slot]`);
  if (!slot) return;

  const fieldset = document.createElement("fieldset");
  fieldset.className = "exclude-markets-fieldset";
  fieldset.disabled = true;

  // fieldset のアクセシブルな名前として legend を設定する
  // （<label> でチェックボックス群をまとめて囲むと「単一のフォームフィールドに
  //   紐付かない label」としてアクセシビリティ監査で警告されるため、
  //   フィールドセットの見出しには legend を用いる）
  const legend = document.createElement("legend");
  legend.textContent = "除外する市場・商品区分";
  fieldset.appendChild(legend);

  EXCLUDE_MARKET_OPTIONS.forEach((value, index) => {
    // 元の静的マークアップと同じ位置（4件目の後）で改行する
    if (index === 4) {
      fieldset.appendChild(document.createElement("br"));
    }

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "exclude-market-checkbox";
    checkbox.dataset.role = "exclude-market-checkbox";
    checkbox.value = value;
    checkbox.checked = EXCLUDE_MARKET_DEFAULT_CHECKED.includes(value);

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${value}`));
    fieldset.appendChild(label);
  });

  slot.appendChild(fieldset);
}

/**
 * ratio / heuristics 両モードの除外市場フィールドセットをまとめて生成する。
 * initSearchMode() が fieldset の有効/無効を切り替える前に、
 * 必ず window.onload の先頭で呼び出すこと。
 */
function renderExcludeMarketsFieldsets() {
  renderExcludeMarketsFieldset("ratioConditions");
  renderExcludeMarketsFieldset("heuristicsConditions");
}

window.onload = () => {
  renderExcludeMarketsFieldsets();
  initSearchMode();
  loadDates();
  loadTradingDates();
  loadHeuristicsDates();
};

/* ============================
   モード切替
============================ */
function initSearchMode() {
  const radios = document.querySelectorAll('input[name="searchMode"]');
  const ratioInputs = document.querySelectorAll("#ratioConditions input:not([type='checkbox']), #ratioConditions select");
  const ratioFieldset = document.querySelectorAll("#ratioConditions fieldset");
  const dateInputs = document.querySelectorAll("#dateConditions select");
  const heuristicsInputs = document.querySelectorAll("#heuristicsConditions select, #heuristicsConditions input[type='text']");
  const heuristicsFieldset = document.querySelectorAll("#heuristicsConditions fieldset");
  const compareFieldsets = document.querySelectorAll("#compareConditions fieldset");

  function updateMode() {
    const mode = document.querySelector('input[name="searchMode"]:checked').value;

    ratioInputs.forEach(i => i.disabled = (mode !== "ratio"));
    ratioFieldset.forEach(i => i.disabled = (mode !== "ratio"));
    dateInputs.forEach(i => i.disabled = (mode !== "date"));
    heuristicsInputs.forEach(i => i.disabled = (mode !== "heuristics"));
    heuristicsFieldset.forEach(i => i.disabled = (mode !== "heuristics"));
    compareFieldsets.forEach(i => i.disabled = (mode !== "compare"));

    updateCompareSourceInputs();
  }

  radios.forEach(r => r.addEventListener("change", updateMode));
  updateMode();

  // compare モード内の入力方法（CSV/証券コード）切替
  document.querySelectorAll('input[name="compareSource"]').forEach(r => {
    r.addEventListener("change", updateCompareSourceInputs);
  });
}

/**
 * compare モードの入力方法（CSV/証券コード）に応じて
 * #compareCsvFile / #compareCodes の有効・無効を切り替える
 */
function updateCompareSourceInputs() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;
  const source = document.querySelector('input[name="compareSource"]:checked')?.value;

  const csvFileInput = document.getElementById("compareCsvFile");
  const codesInput = document.getElementById("compareCodes");
  if (!csvFileInput || !codesInput) return;

  csvFileInput.disabled = (mode !== "compare" || source !== "csv");
  codesInput.disabled   = (mode !== "compare" || source !== "code");
}

/* ============================
   compare モード：CSVアップロード処理
============================ */
const compareCsvFileInput = document.getElementById("compareCsvFile");
const compareFromDateInput = document.getElementById("compareFromDate");

// CSVファイル名（screening_<mode>_<YYYYMMDD>.csv）から日付と元モードを抽出する
// 元モード（出来高×上髭／値上がり率ランキング／heuristics）は
// アップロードcsvの予測列（上昇/下降の予測）切り替えに使用する
let uploadedCsvSourceMode = null;
let uploadedCsvCodes = [];
let uploadedCsvScoreMap = {}; // コード→スコアのマップ（CSVアップロード時のみ使用）

if (compareCsvFileInput) {
  compareCsvFileInput.addEventListener("change", async () => {
    const file = compareCsvFileInput.files[0];
    if (!file) return;

    // ファイル名: screening_<mode>_<YYYYMMDD>.csv からモードと日付を抽出
    const m = file.name.match(/^screening_(ratio|date|heuristics)_(\d{8})\.csv$/);
    if (!m) {
      alert("ファイル名がスクリーニング結果のCSV形式（screening_<mode>_<YYYYMMDD>.csv）と一致しません。");
      compareCsvFileInput.value = "";
      uploadedCsvScoreMap = {};  // スコアマップをリセット
      return;
    }

    uploadedCsvSourceMode = m[1];
    // 比較元日付の自動設定（ラジオ切替時の再設定はしない仕様のため、ここで一度だけ設定）
    // 選択肢に存在しない日付（3か月超）の場合は option を動的追加してから選択する
    setCompareFromDate(m[2]);

    uploadedCsvCodes = await extractCodesFromCsv(file);
  });
}

/**
 * アップロードされたCSVファイルからコード列の値一覧を抽出する
 * @param {File} file
 * @returns {Promise<string[]>}
 */
async function extractCodesFromCsv(file) {
  const text = await file.text();
  // BOM除去
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r\n|\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  // 1行目（ヘッダ）の「コード」列・「スコア」列インデックスを特定
  const headerCells = parseCsvLine(lines[0]);
  const codeIdx  = headerCells.indexOf("コード");
  if (codeIdx === -1) return [];

  const scoreIdx = headerCells.indexOf("スコア");  // heuristics CSV のみ存在

  // スコアマップを初期化（前回の CSV アップロード内容をクリア）
  uploadedCsvScoreMap = {};

  const codes = [];
  lines.slice(1).forEach(line => {
    const cells = parseCsvLine(line);
    const code  = cells[codeIdx];
    if (!code) return;
    codes.push(code);
    if (scoreIdx !== -1 && cells[scoreIdx] != null) {
      uploadedCsvScoreMap[code] = cells[scoreIdx];
    }
  });

  return codes;
}

/**
 * RFC 4180 準拠の簡易CSV1行パーサ（ダブルクォート対応）
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/* ============================
   /dates のロード
============================ */
async function loadDates() {
  const controlsOverlay = document.getElementById("controlsLoadingOverlay");

  // サーバ通信前にオーバーレイを表示する（共通仕様）
  controlsOverlay.classList.remove("hidden");

  try {
    dateSelect.innerHTML = "";
    dateSelect.appendChild(new Option("読み込み中...", ""));

    ratioDateSelect.innerHTML = "";
    ratioDateSelect.appendChild(new Option("読み込み中...", ""));

    const res = await fetch(`${API_BASE_URL}/dates`);
    const data = await res.json();

    if (!data.status || data.status !== "ok") {
      console.error("dates API error:", { httpStatus: res.status, body: data });
      dateSelect.innerHTML = `<option value="">取得失敗</option>`;
      ratioDateSelect.innerHTML = `<option value="">取得失敗</option>`;
      return;
    }

    const dates = data.dates;

    // date_ranking 用
    dateSelect.innerHTML = "";
    dates.forEach(d => dateSelect.appendChild(makeOption(d)));

    // ratio 用（最古日除外）
    ratioDateSelect.innerHTML = "";
    if (dates.length >= 2) {
      const ratioDates = dates.slice(0, dates.length - 1); // 最古日を除外
      ratioDates.forEach(d => ratioDateSelect.appendChild(makeOption(d)));
    }

  } catch (e) {
    console.error("日付取得エラー:", e);
  } finally {
    // 必ずオーバーレイを非表示にする（共通仕様）
    controlsOverlay.classList.add("hidden");
  }
}

/* ============================
   /trading_dates のロード
   （compare モード：比較元日付・比較先日付の共通データソース）
============================ */
async function loadTradingDates() {
  const compareFromDateSelect = document.getElementById("compareFromDate");
  const compareToDateSelect = document.getElementById("compareToDateSelect");
  if (!compareFromDateSelect || !compareToDateSelect) return;

  const controlsOverlay = document.getElementById("controlsLoadingOverlay");

  // サーバ通信前にオーバーレイを表示する（共通仕様）
  controlsOverlay.classList.remove("hidden");

  try {
    compareFromDateSelect.innerHTML = "";
    compareFromDateSelect.appendChild(new Option("読み込み中...", ""));

    compareToDateSelect.innerHTML = "";
    compareToDateSelect.appendChild(new Option("読み込み中...", ""));

    const res = await fetch(`${API_BASE_URL}/trading_dates`);
    const data = await res.json();

    if (!data.status || data.status !== "ok") {
      console.error("trading_dates API error:", { httpStatus: res.status, body: data });
      compareFromDateSelect.innerHTML = `<option value="">取得失敗</option>`;
      compareToDateSelect.innerHTML = `<option value="">取得失敗</option>`;
      return;
    }

    const dates = data.dates; // 直近3か月の市場開場日（降順）

    // 比較元日付（デフォルト＝先頭＝最新の市場開場日）
    compareFromDateSelect.innerHTML = "";
    dates.forEach(d => compareFromDateSelect.appendChild(makeOption(d)));

    // 比較先日付（デフォルト＝先頭＝最新の市場開場日）
    compareToDateSelect.innerHTML = "";
    dates.forEach(d => compareToDateSelect.appendChild(makeOption(d)));

  } catch (e) {
    console.error("trading_dates 取得エラー:", e);
  } finally {
    // 必ずオーバーレイを非表示にする（共通仕様）
    controlsOverlay.classList.add("hidden");
  }
}

/* ============================
   /heuristics_dates のロード
============================ */
async function loadHeuristicsDates() {
  const select = heuristicsDateSelect;
  if (!select) return;

  const controlsOverlay = document.getElementById("controlsLoadingOverlay");

  select.innerHTML = `<option>読み込み中...</option>`;

  // サーバ通信前にオーバーレイを表示する（共通仕様）
  controlsOverlay.classList.remove("hidden");

  try {
    const res = await fetch(`${API_BASE_URL}/heuristics_dates`);
    const data = await res.json();

    if (!data || data.status !== "ok") {
      console.error("heuristics_dates API error:", {
        httpStatus: res.status,
        body: data
      });
      select.innerHTML = `<option value="">取得失敗</option>`;
      return;
    }

    const dates = data.dates;

    select.innerHTML = "";
    dates.forEach(d => select.appendChild(makeOption(d)));

  } catch (e) {
    console.error("heuristics 日付取得エラー:", e);
    select.innerHTML = `<option value="">取得失敗</option>`;
  } finally {
    // 必ずオーバーレイを非表示にする（共通仕様）
    controlsOverlay.classList.add("hidden");
  }
}

/* ============================
   日付 option 生成
============================ */
function makeOption(d) {
  const y = d.substring(0,4);
  const m = d.substring(4,6);
  const day = d.substring(6,8);
  const w = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${day}`).getDay()];
  return new Option(`${y}/${m}/${day}（${w}）`, d);
}

/**
 * YYYYMMDD 形式の日付文字列を「YYYY/MM/DD（曜）」形式に変換する
 * compare モードのテーブルヘッダ日付表示に使用する
 * @param {string} d - YYYYMMDD
 * @returns {string}
 */
function makeDateLabel(d) {
  if (!d) return "";
  const y   = d.substring(0, 4);
  const m   = d.substring(4, 6);
  const day = d.substring(6, 8);
  const w   = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${day}`).getDay()];
  return `${y}/${m}/${day}（${w}）`;
}

/**
 * 比較元・比較先終値から上昇/下降の結果を算出する
 * @param {number} fromClose - 比較元終値
 * @param {number} toClose   - 比較先終値
 * @returns {string} "↗" | "横ばい" | "↘"
 */
function calcCompareResult(fromClose, toClose) {
  if (toClose === fromClose) return "横ばい";
  return toClose > fromClose ? "↗" : "↘";
}

/**
 * 比較元日付セレクタ（#compareFromDate）に指定日付を選択状態にする。
 * 選択肢一覧（/trading_dates＝直近3か月）に存在しない日付の場合は、
 * option を動的追加してから選択する（3か月超のCSVアップロード対応）。
 * @param {string} dateStr - YYYYMMDD
 */
function setCompareFromDate(dateStr) {
  const select = document.getElementById("compareFromDate");
  if (!select || !dateStr) return;

  const exists = Array.from(select.options).some(opt => opt.value === dateStr);
  if (!exists) {
    select.appendChild(makeOption(dateStr));
  }

  select.value = dateStr;
}

/* ============================
   テーブルヘッダ更新
============================ */
function updateTableHeader(mode, label = "", compareFromLabel = "", compareToLabel = "") {
  const stickyThead = document.getElementById("resultHeaderSticky");
  const bodyThead   = document.getElementById("resultHeaderBody");

  // ratio
  if (mode === "ratio") {
    const html = `
      <tr>
        <th class="fixed-col" data-fixed-col>コード</th>
        <th class="fixed-col" data-fixed-col>銘柄名</th>
        <th>出来高倍率</th>
        <th>上髭実体比</th>
        <th>出来高</th>
        <th>上髭</th>
        <th>実体</th>
      </tr>
    `;
    stickyThead.innerHTML = html;
    bodyThead.innerHTML   = html;
    return;
  }

  // date
  if (mode === "date") {
    const html = `
      <tr>
        <th class="fixed-col" data-fixed-col>コード</th>
        <th class="fixed-col" data-fixed-col>銘柄名</th>
        <th>値上がり率</th>
        <th>${label}終値</th>
        <th>前日終値</th>
      </tr>
    `;
    stickyThead.innerHTML = html;
    bodyThead.innerHTML   = html;
    return;
  }

  // heuristics
  if (mode === "heuristics") {
    let row1 = `
      <tr>
        <th class="fixed-col" data-fixed-col rowspan="2">コード</th>
        <th class="fixed-col" data-fixed-col rowspan="2">銘柄名</th>
        <th class="fixed-col" data-fixed-col rowspan="2">トレンド</th>
        <th class="fixed-col" data-fixed-col rowspan="2">スコア</th>
    `;
    let row2 = `<tr>`;

    for (const typeObj of HEURISTICS_TYPES) {
      const itemCount = typeObj.items.length;

      if (itemCount > 1) {
        row1 += `<th colspan="${itemCount}" class="${typeObj.trend_direction_css ?? ''}">${typeObj.group_label}</th>`;
        for (const item of typeObj.items) {
          row2 += `<th class="${item.trend_direction_css ?? ''}">${item.label}</th>`;
        }
      } else {
        const item = typeObj.items[0];
        if (typeObj.group_label === item.label) {
          row1 += `<th rowspan="2" class="${typeObj.trend_direction_css ?? ''}">${typeObj.group_label}</th>`;
        } else {
          row1 += `<th class="${typeObj.trend_direction_css ?? ''}">${typeObj.group_label}</th>`;
          row2 += `<th class="${item.trend_direction_css ?? ''}">${item.label}</th>`;
        }
      }
    }

    row1 += `</tr>`;
    row2 += `</tr>`;

    stickyThead.innerHTML = row1 + row2;
    bodyThead.innerHTML   = row1 + row2;
  }

  // compare（CSV/証券コード比較）
  if (mode === "compare") {
    const fromHeader = compareFromLabel ? `比較元 ${compareFromLabel}終値` : "比較元終値";
    const toHeader   = compareToLabel   ? `比較先 ${compareToLabel}終値`   : "比較先終値";
    const html = `
      <tr>
        <th class="fixed-col" data-fixed-col>コード</th>
        <th class="fixed-col" data-fixed-col>銘柄名</th>
        <th>スコア</th>
        <th>上昇/下降の予測</th>
        <th>上昇/下降の結果</th>
        <th>${fromHeader}</th>
        <th>${toHeader}</th>
        <th>増減（円）</th>
        <th>増減（％）</th>
      </tr>
    `;
    stickyThead.innerHTML = html;
    bodyThead.innerHTML   = html;
    return;
  }
}

/* ============================
   スクリーニング開始
============================ */
async function startScreening() {
  const mode = document.querySelector('input[name="searchMode"]:checked').value;

  const volumeRatio = parseFloat(document.getElementById("volumeRatio").value);
  const shadowRatio = parseFloat(document.getElementById("shadowRatio").value);
  const targetDateRanking = dateSelect.value;
  const targetDateRatio = ratioDateSelect.value;
  const targetDateHeuristics = heuristicsDateSelect.value;
  const source = document.querySelector('input[name="compareSource"]:checked').value;
  const fromDate = compareFromDateInput.value;
  const toDate = document.getElementById("compareToDateSelect").value;
  const codes = document.getElementById("compareCodes").value.trim();

  if (mode === "ratio" && !targetDateRatio) {
    alert("日付を選択してください。");
    return;
  }

  if (mode === "date" && !targetDateRanking) {
    alert("日付が選択されていません。");
    return;
  }

  if (mode === "heuristics" && !targetDateHeuristics) {
    alert("日付を選択してください。");
    return;
  }

  if (mode === "compare") {

    if (!fromDate || !toDate) {
      alert("比較元日付・比較先日付を確認してください。");
      return;
    }

    if (source === "csv") {
      if (uploadedCsvCodes.length === 0) {
        alert("CSVファイルをアップロードしてください。");
        return;
      }
    } else {
      if (!codes) {
        alert("証券コードを入力してください。");
        return;
      }
    }
  }

  let label = "";
  if (mode === "date") {
    const d = targetDateRanking;
    const y = d.substring(0,4);
    const m = d.substring(4,6);
    const day = d.substring(6,8);
    const w = ["日","月","火","水","木","金","土"][new Date(`${y}-${m}-${day}`).getDay()];
    label = `${y}/${m}/${day}（${w}）`;
  }

  // compare モード：ヘッダ用日付ラベルを組み立て、証券コード直接入力時はスコアマップをリセット
  let compareFromLabel = "";
  let compareToLabel   = "";
  if (mode === "compare") {
    compareFromLabel = makeDateLabel(fromDate);
    compareToLabel   = makeDateLabel(toDate);
    if (source !== "csv") {
      uploadedCsvScoreMap = {};  // 証券コード直接入力時はスコアマップをクリア
    }
  }

  updateTableHeader(mode, label, compareFromLabel, compareToLabel);

  startBtn.disabled = true;
  cancelBtn.disabled = false;

  elapsedSeconds = 0;
  elapsedTimeEl.textContent = "スクリーニング時間：0秒";

  timerId = setInterval(() => {
    elapsedSeconds++;
    elapsedTimeEl.textContent = `スクリーニング時間：${elapsedSeconds}秒`;
  }, 1000);

  abortController = new AbortController();
  loadingOverlay.classList.remove("hidden");

  try {
    const url = new URL("/screening", API_BASE_URL);

    if (mode === "ratio") {
      url.searchParams.set("mode", "ratio");
      url.searchParams.set("volume_ratio", volumeRatio);
      url.searchParams.set("shadow_ratio", shadowRatio);
      url.searchParams.set("target_date", targetDateRatio);

      // 除外市場をパラメータに追加（1件以上チェックされている場合のみ）
      const excludeMarkets = getExcludeMarkets("ratioConditions");
      if (excludeMarkets) {
        url.searchParams.set("exclude_markets", excludeMarkets);
      }

    } else if (mode === "date") {
      url.searchParams.set("mode", "date_ranking");
      url.searchParams.set("target_date", targetDateRanking);

    } else if (mode === "heuristics") {
      url.searchParams.set("mode", "heuristics");
      url.searchParams.set("target_date", targetDateHeuristics);

      // 除外市場をパラメータに追加（1件以上チェックされている場合のみ）
      const excludeMarkets = getExcludeMarkets("heuristicsConditions");
      if (excludeMarkets) {
        url.searchParams.set("exclude_markets", excludeMarkets);
      }

      // 証券コードによる絞り込み（未入力時は従来通り全件対象）
      const heuristicsCodes = document.getElementById("heuristicsCodes").value.trim();
      if (heuristicsCodes) {
        url.searchParams.set("codes", heuristicsCodes);
      }
    } else if (mode === "compare") {
      url.searchParams.set("mode", "compare");
      url.searchParams.set("from_date", fromDate);
      url.searchParams.set("to_date", toDate);
      url.searchParams.set("source_mode", source === "csv" ? (uploadedCsvSourceMode || "") : "");

      if (source === "csv") {
        url.searchParams.set("codes", uploadedCsvCodes.join(","));
      } else {
        url.searchParams.set("codes", codes);
      }
    }

    const res = await fetch(url.toString(), { signal: abortController.signal });
    const data = await res.json();

    if (!data.status || data.status !== "ok") {
      console.error("screening API error:", {
        httpStatus: res.status,
        body: data
      });
      alert("スクリーニング中にエラーが発生しました（詳細はコンソールを確認）");
      return;
    }

    let results = null;
    if (mode === "heuristics") {
      const dataUp = data.data.up.map(up => ({
        ...up,
        トレンド: "up",
        スコア: up["アップスコア"]
      }));
      const dataDown = data.data.down.map(down => ({
        ...down,
        トレンド: "down",
        スコア: down["ダウンスコア"]
      }));
      results = [...dataUp, ...dataDown];
    } else {
      results = data.data;
    }

    currentResults = results;
    showResults(results, mode);

    const countLabel = document.getElementById("resultCount");
    if (countLabel) {
      countLabel.textContent = `検索結果：${results.length} 件`;
    }

    const target = document.getElementById("resultSection");
    const offset = -10;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.pageYOffset + offset,
      behavior: "smooth"
    });

  } catch (e) {
    if (!abortController.signal.aborted) {
      console.error("screening fetch error:", e);
      alert("エラーが発生しました（詳細はコンソールを確認）");
    }
  } finally {
    clearInterval(timerId);
    // サーバ通信後に必ずオーバーレイを非表示にする（共通仕様）
    loadingOverlay.classList.add("hidden");
    startBtn.disabled = false;
    cancelBtn.disabled = true;
    cancelBtn.textContent = "キャンセル";  // "キャンセル中…" からリセット
  }
}

/* ============================
   除外市場の収集
============================ */
/**
 * 指定した条件設定コンテナ（scopeId）配下でチェックされている
 * 除外市場チェックボックスの値をカンマ区切りで返す。
 * ratio / heuristics で同じ data-role（exclude-market-checkbox）を共有しているため、
 * DOM 全体ではなくコンテナ単位でスコープして集計する。
 */
function getExcludeMarkets(scopeId) {
  const checked = document.querySelectorAll(`#${scopeId} [data-role="exclude-market-checkbox"]:checked`);
  return Array.from(checked).map(cb => cb.value).join(",");
}

/* ============================
   キャンセル
============================ */
function cancelScreening() {
  if (abortController) abortController.abort();
  cancelBtn.disabled = true;
  cancelBtn.textContent = "キャンセル中…";
}

/* ============================
   結果表示
============================ */
function showResults(results, mode) {
  tbody.innerHTML = "";

  results.forEach((r, index) => {
    const tr = document.createElement("tr");

    /* ------------------------------
       ratio モード
    ------------------------------ */
    if (mode === "ratio") {
      tr.innerHTML = `
        <td class="fixed-col" data-fixed-col>${r.コード}</td>
        <td class="fixed-col" data-fixed-col>${r.銘柄名}</td>
        <td>${r.出来高倍率}</td>
        <td>${r.上髭実体比}</td>
        <td>${r.出来高.toLocaleString()}</td>
        <td>${r.上髭}</td>
        <td>${r.実体}</td>
      `;
    }

    /* ------------------------------
       date モード
    ------------------------------ */
    else if (mode === "date") {
      tr.innerHTML = `
        <td class="fixed-col" data-fixed-col>${r.コード}</td>
        <td class="fixed-col" data-fixed-col>${r.銘柄名}</td>
        <td>${r.値上がり率}%</td>
        <td>${r.当日終値}</td>
        <td>${r.前日終値}</td>
      `;
    }

    /* ------------------------------
       heuristics モード
    ------------------------------ */
    else if (mode === "heuristics") {

      if (r.error) {
        tr.classList.add("tr-error");
      } else {
        const trendBg = (r.トレンド === "up") ? "tr-trend-up" : "tr-trend-down";
        tr.classList.add(trendBg);
      }
        
      let html = `
        <td class="fixed-col" data-fixed-col>${r.コード}</td>
        <td class="fixed-col" data-fixed-col>${r.銘柄名}</td>
        <td class="fixed-col" data-fixed-col>${formatDirectionMark(r.トレンド)}</td>
        <td class="fixed-col" data-fixed-col>${r.スコア}</td>
      `;

      for (const typeObj of HEURISTICS_TYPES) {
        for (const item of typeObj.items) {
          const key = item.key;
          const val = r[key];
          
          html += `<td data-rule-key="${key}">`;

          switch (key) {
            // --- 酒田五法（数値 or null） ---
            case "TECH_SAKATA_TRIPLE_TOP":
            case "TECH_SAKATA_TRIPLE_BOTTOM":
            case "TECH_SAKATA_SANKU_UP":
            case "TECH_SAKATA_SANKU_DOWN":
            case "TECH_SAKATA_SANPEI_UP":
            case "TECH_SAKATA_SANPEI_DOWN":
            case "TECH_SAKATA_SANPO_UP":
            case "TECH_SAKATA_SANPO_DOWN":
              html += val ? `<span class="tech-true">○</span></td>` : `</td>`;
              continue;
              
            // --- 9の法則（オブジェクト） ---
            case "TECH_RULE9_DAILY":
            case "TECH_RULE9_WEEKLY":
              if (!val || !val.direction) {
                html += `</td>`;
              } else {
                const arrow = formatDirectionMark(val.direction);
                html += `${arrow}（${val.count} 本目）</td>`;
              }
              continue;

            // --- グランビル（オブジェクト） ---
            case "TECH_GRANVILLE":
              if (!val || !val.direction) {
                html += `</td>`;
              } else {
                const arrow = formatDirectionMark(val.direction);
                html += `${arrow}（${val.count}）</td>`;
              }
              continue;

            // --- 節目（オブジェクト） ---
            case "TECH_FUSHIME_UP":
            case "TECH_FUSHIME_DOWN":
              if (!val || !val.price) {
                html += `</td>`;
              } else {
                html += `${val.price}（${val.tryCount}回）</td>`;
              }
              continue;

            // --- トレンドサイクル進行度（{direction, count, startDate, lastDate} or null） ---
            case "TECH_CYCLE_PROGRESS":
              if (!val || !val.direction) {
                html += `</td>`;
              } else {
                const arrow = formatDirectionMark(val.direction);
                html += `${arrow}（${val.count}日）</td>`;
              }
              continue;

            // 上記以外
            default:
              switch (typeof val) {
                // --- 文字列（up/down/flat） ---
                case "string":
                  const arrow = formatDirectionMark(val);
                  html += `${arrow}</td>`;
                  continue;

                // --- boolean（○/×） ---
                case "boolean":
                  html += `${boolMark(val)}</td>`;
                  continue;

                // --- 上記以外（null or undefined） ---
                default:
                  html += `</td>`;
                  continue;
              }
          }
        }
      }

      tr.innerHTML = html;

      // ハイライト処理
      const applied = (r.トレンド === "up")
          ? r.applied_up_rules
          : r.applied_down_rules;
  
      tr.querySelectorAll("td[data-rule-key]").forEach(td => {
          const ruleKey = td.dataset.ruleKey;
          if (applied.includes(ruleKey)) {
              td.classList.add("td-heuristics-applied");
          }
      });
    }

    /* ------------------------------
       compare モード
    ------------------------------ */
    else if (mode === "compare") {
      // 上昇/下降の結果（比較先 vs 比較元）
      const compareResult = (!r.error && r.比較元終値 != null && r.比較先終値 != null)
        ? calcCompareResult(r.比較元終値, r.比較先終値)
        : "";

      // 行の背景色：予測に基づく（heuristics モードと同様の CSS クラスを流用）
      if (r.予測 === "up") {
        tr.classList.add("tr-trend-up");
      } else if (r.予測 === "down") {
        tr.classList.add("tr-trend-down");
      }

      // 結果グループのセル背景色：上昇/下降の結果に基づく
      const resultBg = compareResult === "↗" ? "var(--color-trend-up-bg)"
                     : compareResult === "↘" ? "var(--color-trend-down-bg)"
                     : "var(--color-bg-table-row)";

      // スコア：CSVアップロード時に抽出したマップから取得（存在しない場合は "-"）
      const score = uploadedCsvScoreMap[r.コード] ?? "-";

      // 予測グループのセル背景色：上昇/下降の予測に基づく
      const predictBg = r.予測 === "up"   ? "var(--color-trend-up-bg)"
                      : r.予測 === "down" ? "var(--color-trend-down-bg)"
                      : "";

      tr.innerHTML = `
        <td class="fixed-col" data-fixed-col>${r.コード}</td>
        <td class="fixed-col" data-fixed-col>${r.銘柄名}</td>
        <td${predictBg ? ` style="background-color:${predictBg}"` : ""}>${score}</td>
        <td${predictBg ? ` style="background-color:${predictBg}"` : ""}>${formatDirectionMark(r.予測) || "-"}</td>
        <td style="background-color:${resultBg}">${compareResult}</td>
        <td style="background-color:${resultBg}">${r.比較元終値 ?? ""}</td>
        <td style="background-color:${resultBg}">${r.比較先終値 ?? ""}</td>
        <td style="background-color:${resultBg}">${r.増減円 > 0 ? "+" : ""}${r.増減円 ?? ""}</td>
        <td style="background-color:${resultBg}">${r.増減率 > 0 ? "+" : ""}${r.増減率 != null ? r.増減率 + "%" : ""}</td>
      `;
    }

    tr.addEventListener("click", () => {
      openChartModal(r.コード, r.銘柄名, index);
    });

    tbody.appendChild(tr);
  });

  if (typeof window.setScreeningResults === "function") {
    window.setScreeningResults(results);
  }
  
  // CSV ダウンロードボタンを有効化（結果が存在する場合のみ）
  const csvBtn = document.getElementById("csvDownloadBtn");
  if (csvBtn) {
    csvBtn.disabled = results.length === 0;
  }

  const matchRateEl = document.getElementById("compareMatchRate");
  if (matchRateEl) {
    if (mode === "compare") {
      const mr = calcMatchRate(results);
      if (mr) {
        const upText   = mr.up.total   > 0 ? `↗ ${mr.up.matched}/${mr.up.total}件` : null;
        const downText = mr.down.total > 0 ? `↘ ${mr.down.matched}/${mr.down.total}件` : null;
        const detail   = [upText, downText].filter(Boolean).join("　");
        matchRateEl.textContent =
          `合致率：${mr.all.matched}/${mr.all.total}件（${mr.all.rate}%）　${detail}`;
        matchRateEl.classList.remove("hidden");
      } else {
        // 予測なし（date / 証券コード直接入力）
        matchRateEl.textContent = "";
        matchRateEl.classList.add("hidden");
      }
    } else {
      matchRateEl.textContent = "";
      matchRateEl.classList.add("hidden");
    }
  }

  // テーブル描画後に列幅＋固定列を同期（2段階遅延）
  afterTableRendered();
}

/* ============================
   ソート
============================ */
document.addEventListener("click", e => {
  const th = e.target.closest("#resultTableSticky th[data-sort-key]");
  if (!th) return;

  const key = th.dataset.sortKey;
  const order = sortState[key] === "asc" ? "desc" : "asc";
  sortState[key] = order;

  currentResults.sort((a, b) => {
    const A = a[key];
    const B = b[key];

    return !isNaN(A) && !isNaN(B)
      ? (order === "asc" ? A - B : B - A)
      : (order === "asc"
          ? String(A).localeCompare(String(B))
          : String(B).localeCompare(String(A)));
  });

  const mode = document.querySelector('input[name="searchMode"]:checked').value;
  showResults(currentResults, mode);
});

/* ============================
   固定ヘッダと本体テーブルの列幅同期
============================ */
function syncColumnWidths() {
  const headerTable = document.getElementById("resultTableSticky");
  const bodyTable   = document.getElementById("resultTable");
  if (!headerTable || !bodyTable) return;

  // querySelectorAll("tbody tr") は本体テーブル全行を走査してからその件数を数えるため、
  // 空判定のためだけに使うと無駄なDOM走査が発生する。
  // tBodies[0].rows はライブコレクションで件数取得が O(1) のため、空判定はこちらを使う。
  const bodyRows = bodyTable.tBodies[0]?.rows;
  if (!bodyRows || bodyRows.length === 0) return;

  // thead 行・セルの取得も querySelectorAll ではなく tHead.rows / row.cells
  // （どちらもライブコレクションで CSS セレクタ照合を伴わない）に統一する。
  // thead の行数・列数は数行～数十列程度なので、この時点でのコストは元々小さいが、
  // syncFixedColumns() と方針を揃えるため同様に軽量な取得方法へ統一する。
  const headerTheadRows = headerTable.tHead?.rows;
  const bodyTheadRows   = bodyTable.tHead?.rows;
  if (!headerTheadRows || !bodyTheadRows) return;

  for (let i = 0; i < bodyTheadRows.length; i++) {
    const hCells = headerTheadRows[i].cells;
    const bCells = bodyTheadRows[i].cells;

    for (let j = 0; j < bCells.length; j++) {
      hCells[j].style.width = bCells[j].getBoundingClientRect().width + "px";
    }
  }
}

/* ============================
   固定列同期
============================ */
function syncFixedColumns() {
  const bodyTable = document.getElementById("resultTable");
  if (!bodyTable) return;

  // tBodies[0].rows はライブコレクション。querySelectorAll("tbody tr") と異なり
  // CSS セレクタ照合を伴わずに全行へアクセスできる。
  const rows = bodyTable.tBodies[0]?.rows;
  if (!rows || rows.length === 0) return;

  const firstRow = rows[0];
  const fixedCols = firstRow.querySelectorAll("[data-fixed-col]");
  if (fixedCols.length === 0) return;

  // ① 読み取りフェーズ：先頭行だけを見て「固定列の列インデックスと left オフセット」を
  //    1回だけ算出する（固定列は2〜4個程度のため、ここでの getBoundingClientRect 呼び出しコストは小さい）
  const offsets = [];
  let left = 0;
  fixedCols.forEach(col => {
    offsets.push({ colIndex: col.cellIndex, left });
    left += col.getBoundingClientRect().width;
  });

  // ② 書き込みフェーズ：本体テーブルは行を1回だけ走査し、
  //    各行の固定列セルへ colIndex で直接アクセスして left を設定する。
  //    従来は「固定列の数 × 全行」ぶん document.querySelectorAll(":nth-child(...)") を
  //    テーブル全体に対して呼び出しており、行数が多い場合にコストが線形以上に増加していた。
  //    row.cells[colIndex] はライブコレクションへの添字アクセスのため、
  //    行数のぶんだけの O(rows数) で完結する。
  for (const row of rows) {
    for (const { colIndex, left } of offsets) {
      const cell = row.cells[colIndex];
      if (cell) cell.style.left = `${left}px`;
    }
  }

  // ③ 固定ヘッダテーブル側：heuristics モードは rowspan="2" により
  //    2行目のセル位置が本体テーブルの列インデックスとずれるため、
  //    nth-child（DOM上の位置）ではなく [data-fixed-col] の出現順
  //    （本体と同じ左→右の並び）で対応付ける。固定列は少数のため走査コストも小さい。
  const headerFixedCols = document.querySelectorAll("#resultTableSticky [data-fixed-col]");
  headerFixedCols.forEach((th, i) => {
    if (offsets[i]) th.style.left = `${offsets[i].left}px`;
  });
}

/* ============================
   スクロール同期
============================ */
const stickyHeader = document.getElementById("resultTableStickyWrap");
const scrollOuter = document.getElementById("resultTableScrollOuter");

if (stickyHeader && scrollOuter) {
  stickyHeader.addEventListener("scroll", () => {
    scrollOuter.scrollLeft = stickyHeader.scrollLeft;
  });

  scrollOuter.addEventListener("scroll", () => {
    stickyHeader.scrollLeft = scrollOuter.scrollLeft;
  });
}

/* ============================
   afterTableRendered
============================ */
function afterTableRendered() {
  setTimeout(() => {
    syncColumnWidths();
    setTimeout(() => {
      syncFixedColumns();
    }, 0);
  }, 0);
}

/* ------------------------------
   イベント登録
------------------------------ */
startBtn.addEventListener("click", startScreening);
cancelBtn.addEventListener("click", cancelScreening);

const csvDownloadBtn = document.getElementById("csvDownloadBtn");
if (csvDownloadBtn) {
  csvDownloadBtn.addEventListener("click", downloadCsv);
}

/* ------------------------------
   リサイズ時にも同期
------------------------------ */
window.addEventListener("resize", () => {
  syncColumnWidths();
  syncFixedColumns();
});

/* ------------------------------
   showResults パッチ（同期保証）
------------------------------ */
(function patchShowResults() {
  const original = showResults;
  showResults = function(results, mode) {
    original(results, mode);
    // afterTableRendered() 内で 2段階遅延同期するため、ここでは呼ばない
  };
})();
