// ============================================================
// quiz.js（2026-10 新規）
// 値動きクイズ：条件に合う銘柄をランダムに出題し、出題日時点までの
// チャートを見て「その後の株価が上がるか下がるか」を回答する。
//
// screening.js / review.js と同じく classic script（type="module" ではない）として
// 読み込む。チャートの表示は index.html と同じ chart-main.js（type="module"）が
// window に公開している関数（openChartModal / setScreeningResults / setChartEndDate）を
// 呼ぶことで再利用する（chart-main.js 側はクイズの存在を知らない）。
//
// DOM の取得・特定は id のみで行う（conventions.domHookAttributes。
// class はスタイル専用）。
// ============================================================

const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

// ------------------------------------------------------------------
// 要素
// ------------------------------------------------------------------
const quizConditionsLoadingOverlay = document.getElementById("quizConditionsLoadingOverlay");
const quizDateSelect = document.getElementById("quizDateSelect");
const quizMinVolumeInput = document.getElementById("quizMinVolume");
const quizMinTradeValueInput = document.getElementById("quizMinTradeValue");
const quizMarketCapBandSelect = document.getElementById("quizMarketCapBand");
const quizSymbolInput = document.getElementById("quizSymbol");
const quizStartBtn = document.getElementById("quizStartBtn");

const quizStatusEl = document.getElementById("quizStatusEl");
const quizResultEl = document.getElementById("quizResultEl");
const quizOpenChartBtn = document.getElementById("quizOpenChartBtn");
const quizNextBtn = document.getElementById("quizNextBtn");
const quizScoreEl = document.getElementById("quizScoreEl");

const chartModal = document.getElementById("chartModal");
const quizAnswerPromptEl = document.getElementById("quizAnswerPromptEl");
const quizGuessButtons = document.getElementById("quizGuessButtons");
const quizGuessUpBtn = document.getElementById("quizGuessUpBtn");
const quizGuessDownBtn = document.getElementById("quizGuessDownBtn");
const quizAnswerResultEl = document.getElementById("quizAnswerResultEl");
const quizModalNextBtn = document.getElementById("quizModalNextBtn");
const quizAnswerNoticeEl = document.getElementById("quizAnswerNoticeEl");
const quizModalLoadingOverlay = document.getElementById("quizModalLoadingOverlay");

// ------------------------------------------------------------------
// 状態
// ------------------------------------------------------------------
let quizQuestion = null;   // 出題中の問題 { code, name, targetDate(YYYY-MM-DD), judgeDays, candidateCount }
let quizAnswer = null;     // 回答済みなら /quiz/answer のレスポンス（未回答は null）
let quizNumber = 0;        // 出題通し番号（ページ内のみ。リロードでリセット）
let quizBusy = false;      // サーバ通信中（二重送信防止）
const quizScore = { answered: 0, correct: 0, draw: 0 };   // 成績（ページ内のみ）

// ------------------------------------------------------------------
// 補助関数
// ------------------------------------------------------------------

// 要素が見つからない場合は警告のみで処理を継続する（review.js の on() と同じ方針。
// quiz.html と quiz.js の一部だけが更新された状態でも、他の機能を止めないため）。
function on(element, event, handler) {
  if (!element) {
    console.warn(
      `quiz.js: イベント登録対象の要素が見つかりませんでした（event=${event}）。` +
      `quiz.html が古いバージョンのままになっている可能性があります。`
    );
    return;
  }
  element.addEventListener(event, handler);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// YYYYMMDD → "YYYY/MM/DD"
function formatDateKey(dateKey) {
  return `${dateKey.slice(0, 4)}/${dateKey.slice(4, 6)}/${dateKey.slice(6, 8)}`;
}

// "YYYY-MM-DD" → "YYYY/MM/DD"
function formatIsoDate(isoDate) {
  return isoDate.replaceAll("-", "/");
}

function formatYen(value) {
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}円`;
}

function formatSignedPercent(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// 現在日付の1か月前を YYYYMMDD で返す。
// 31日などの「前月に存在しない日」は前月末日へ丸める（例：3/31 → 2/28）。
function oneMonthAgoDateKey(now) {
  const year = now.getFullYear();
  const month = now.getMonth();                    // 0 始まり
  const lastDayOfPrevMonth = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(now.getDate(), lastDayOfPrevMonth));
  return `${target.getFullYear()}${pad2(target.getMonth() + 1)}${pad2(target.getDate())}`;
}

function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

// ------------------------------------------------------------------
// API
// 読み取り専用の GET のみ（書き込み系・認可は不要）。サーバーは失敗時も
// HTTP 200 で { error, detail } を返す設計のため、error キーの有無で判定する。
// ------------------------------------------------------------------
async function fetchQuizApi(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url);
  const json = await res.json();
  if (!json || json.error) {
    throw new Error((json && (json.detail || json.error)) || "サーバーから不正な応答が返りました。");
  }
  return json;
}

// ------------------------------------------------------------------
// 出題条件
// ------------------------------------------------------------------

// 出題日の選択肢を描画する。先頭は「未指定（ランダム）」。
// 既定は「現在日付の1か月前」以前で最も新しい出題可能日。
function renderDateOptions(dates) {
  quizDateSelect.textContent = "";
  quizDateSelect.appendChild(makeOption("", "未指定（ランダム）"));
  dates.forEach(dateKey => {
    quizDateSelect.appendChild(makeOption(dateKey, formatDateKey(dateKey)));
  });

  // dates は降順（新しい日付が先頭）の YYYYMMDD なので、文字列比較で日付比較になる
  const limit = oneMonthAgoDateKey(new Date());
  const defaultKey = dates.find(dateKey => dateKey <= limit);
  quizDateSelect.value = defaultKey ?? "";
}

// 空欄＝未指定（null）、0以上の数値＝その値、それ以外＝エラー
function readOptionalNonNegativeNumber(input, label) {
  const raw = input.value.trim();
  if (raw === "") return { value: null, error: null };

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { value: null, error: `${label}は0以上の数値で入力してください。` };
  }
  return { value, error: null };
}

// 入力欄から /quiz/question のクエリを組み立てる。未指定の項目は含めない。
function buildQuestionParams() {
  const params = {};

  if (quizDateSelect.value) params.target_date = quizDateSelect.value;

  const volume = readOptionalNonNegativeNumber(quizMinVolumeInput, "出来高");
  if (volume.error) return { params, error: volume.error };
  if (volume.value !== null) params.min_volume = volume.value;

  // 画面は「億円」、API は「円」。浮動小数点の誤差（0.1億円 → 10000000.000000002 等）を丸める
  const tradeValue = readOptionalNonNegativeNumber(quizMinTradeValueInput, "売買金額");
  if (tradeValue.error) return { params, error: tradeValue.error };
  if (tradeValue.value !== null) params.min_trade_value = Math.round(tradeValue.value * 100_000_000);

  if (quizMarketCapBandSelect.value) params.market_cap_band = quizMarketCapBandSelect.value;

  const symbol = quizSymbolInput.value.trim();
  if (symbol) params.symbol = symbol;

  return { params, error: null };
}

// 出題可能な日付の一覧を取得して条件欄を有効化する
async function loadQuizDates() {
  quizConditionsLoadingOverlay.classList.remove("hidden");
  try {
    const data = await fetchQuizApi("/quiz/dates");
    renderDateOptions(data.dates);
    quizStartBtn.disabled = false;
  } catch (e) {
    console.warn("出題日の取得に失敗しました:", e);
    reportError(`出題日の一覧を取得できませんでした。（${e.message}）ページを再読み込みしてください。`);
  } finally {
    quizConditionsLoadingOverlay.classList.add("hidden");
  }
}

// ------------------------------------------------------------------
// 表示の更新
// ------------------------------------------------------------------

// エラーはページ側の状況表示に出し、モーダルが開いている場合は回答バーにも出す
// （モーダルがページを覆うため、ページ側だけだと気づけない）。
function reportError(message) {
  quizStatusEl.textContent = message;
  if (chartModal && chartModal.style.display === "flex") {
    quizAnswerNoticeEl.textContent = message;
    quizAnswerNoticeEl.classList.remove("hidden");
  }
}

function clearNotice() {
  quizAnswerNoticeEl.textContent = "";
  quizAnswerNoticeEl.classList.add("hidden");
}

function renderScore() {
  if (quizScore.answered === 0 && quizScore.draw === 0) {
    quizScoreEl.textContent = "";
    return;
  }
  const rate = quizScore.answered > 0
    ? `（正答率 ${Math.round((quizScore.correct / quizScore.answered) * 100)}%）`
    : "";
  const draw = quizScore.draw > 0 ? `／引き分け ${quizScore.draw} 問` : "";
  quizScoreEl.textContent = `成績：${quizScore.answered} 問中 ${quizScore.correct} 問正解${rate}${draw}`;
}

// 結果の文章を組み立てて、ページ側・モーダル側の両方へ描画する。
// 数値・日付はすべて textContent で設定する（innerHTML は使わない）。
function renderResultInto(el, result) {
  el.textContent = "";

  const label = document.createElement("span");
  label.className = "quiz-result-label";
  label.textContent = result.correct === true ? "正解！"
                    : result.correct === false ? "不正解…"
                    : "同値のため引き分け。";
  el.appendChild(label);

  el.appendChild(document.createTextNode(
    `${formatIsoDate(result.target_date)} の終値 ${formatYen(result.base_close)} → ` +
    `${result.judge_days}営業日後（${formatIsoDate(result.judge_date)}）の終値 ${formatYen(result.judge_close)} `
  ));

  const directionText = { up: "上昇", down: "下落", flat: "変わらず" }[result.direction];
  const change = document.createElement("span");
  change.className = "quiz-change";
  change.dataset.direction = result.direction;
  change.textContent = `（${formatSignedPercent(result.change_pct)}・${directionText}）`;
  el.appendChild(change);

  el.dataset.result = result.correct === true ? "correct"
                    : result.correct === false ? "wrong"
                    : "draw";
  el.classList.remove("hidden");
}

// 出題直後（未回答）の表示
function renderQuestionState() {
  const q = quizQuestion;

  quizStatusEl.textContent =
    `第${quizNumber}問：${formatIsoDate(q.targetDate)} 時点までのチャートです。` +
    `${q.judgeDays}営業日後の終値は、この日の終値より上がるでしょうか、下がるでしょうか？` +
    `（条件に合う ${q.candidateCount} 銘柄から出題）`;
  quizResultEl.classList.add("hidden");
  quizOpenChartBtn.classList.remove("hidden");
  quizNextBtn.classList.add("hidden");

  quizAnswerPromptEl.textContent =
    `${formatIsoDate(q.targetDate)} の終値に対し、${q.judgeDays}営業日後の終値は上がる？ 下がる？`;
  quizGuessButtons.classList.remove("hidden");
  quizGuessUpBtn.disabled = false;
  quizGuessDownBtn.disabled = false;
  quizAnswerResultEl.classList.add("hidden");
  quizModalNextBtn.classList.add("hidden");
  clearNotice();
}

// 回答直後の表示
function renderAnswerState() {
  renderResultInto(quizResultEl, quizAnswer);
  renderResultInto(quizAnswerResultEl, quizAnswer);
  quizStatusEl.textContent = `第${quizNumber}問の結果です。チャートは答え合わせ用に ${formatIsoDate(quizAnswer.judge_date)} まで延ばしています。`;

  quizGuessButtons.classList.add("hidden");
  quizNextBtn.classList.remove("hidden");
  quizModalNextBtn.classList.remove("hidden");
  clearNotice();
  renderScore();
}

// ------------------------------------------------------------------
// チャート（chart-main.js の公開関数を利用）
// 未回答のうちは出題日まで、回答後は判定日までを表示する。
// 前へ/次へが参照する一覧は常に出題中の1銘柄のみ。
// ------------------------------------------------------------------
function openChart() {
  if (!quizQuestion) return;

  if (typeof window.openChartModal !== "function" ||
      typeof window.setChartEndDate !== "function" ||
      typeof window.setScreeningResults !== "function") {
    reportError("チャート機能を読み込めませんでした。ページを再読み込みしてください。");
    return;
  }

  window.setScreeningResults([{ コード: quizQuestion.code, 銘柄名: quizQuestion.name }]);
  window.setChartEndDate(quizAnswer ? quizAnswer.judge_date : quizQuestion.targetDate);
  window.openChartModal(quizQuestion.code, quizQuestion.name, 0);
}

// ------------------------------------------------------------------
// 出題・回答
// ------------------------------------------------------------------

// overlayEl：通信中に表示するオーバーレイ（ページ側の条件カード、またはモーダル内）。
// 「次の問題へ」はモーダルが開いたまま呼ばれるため、背面に隠れないよう呼び出し元が渡す。
async function startQuiz(overlayEl) {
  if (quizBusy) return;

  const { params, error } = buildQuestionParams();
  if (error) {
    reportError(error);
    return;
  }

  quizBusy = true;
  quizStartBtn.disabled = true;
  quizModalNextBtn.disabled = true;
  overlayEl.classList.remove("hidden");
  try {
    const data = await fetchQuizApi("/quiz/question", params);

    if (!data.question) {
      reportError(
        "条件に合う銘柄が見つかりませんでした。出来高・売買金額・時価総額帯の条件を緩める、" +
        "または日付・銘柄を変えてもう一度お試しください。"
      );
      return;
    }

    quizQuestion = {
      code: data.question.code,
      name: data.question.name,
      targetDate: data.question.target_date,
      judgeDays: data.question.judge_days,
      candidateCount: data.question.candidate_count,
    };
    quizAnswer = null;
    quizNumber += 1;
    renderQuestionState();
    openChart();
  } catch (e) {
    console.warn("出題に失敗しました:", e);
    reportError(`出題に失敗しました。（${e.message}）もう一度お試しください。`);
  } finally {
    overlayEl.classList.add("hidden");
    quizBusy = false;
    quizStartBtn.disabled = false;
    quizModalNextBtn.disabled = false;
  }
}

async function submitGuess(guess) {
  if (!quizQuestion || quizAnswer || quizBusy) return;

  quizBusy = true;
  quizGuessUpBtn.disabled = true;
  quizGuessDownBtn.disabled = true;
  clearNotice();
  quizModalLoadingOverlay.classList.remove("hidden");
  try {
    const result = await fetchQuizApi("/quiz/answer", {
      code: quizQuestion.code,
      target_date: quizQuestion.targetDate.replaceAll("-", ""),
      guess,
    });

    quizAnswer = result;
    if (result.correct === true) {
      quizScore.answered += 1;
      quizScore.correct += 1;
    } else if (result.correct === false) {
      quizScore.answered += 1;
    } else {
      quizScore.draw += 1;
    }
    renderAnswerState();

    // 答え合わせ：終端日を判定日まで延ばして、同じ銘柄のチャートを描き直す
    openChart();
  } catch (e) {
    console.warn("判定に失敗しました:", e);
    reportError(`判定に失敗しました。（${e.message}）もう一度回答してください。`);
    quizGuessUpBtn.disabled = false;
    quizGuessDownBtn.disabled = false;
  } finally {
    quizModalLoadingOverlay.classList.add("hidden");
    quizBusy = false;
  }
}

// ------------------------------------------------------------------
// イベント登録
// ------------------------------------------------------------------
on(quizStartBtn, "click", () => startQuiz(quizConditionsLoadingOverlay));
on(quizNextBtn, "click", () => startQuiz(quizConditionsLoadingOverlay));
on(quizModalNextBtn, "click", () => startQuiz(quizModalLoadingOverlay));
on(quizOpenChartBtn, "click", openChart);
on(quizGuessUpBtn, "click", () => submitGuess("up"));
on(quizGuessDownBtn, "click", () => submitGuess("down"));

// チャートモーダルの ←／→ キーは、chart-main.js が「前へ／次へ」として扱う。
// クイズでは出題が常に1銘柄のため、押すと同じチャートを無駄に再描画してしまう。
// window の capture フェーズで先に受けて伝播を止め、chart-main.js のハンドラへ届けない
// （chart-main.js 側を変更しないための対処。モーダルが開いている間だけ有効）。
window.addEventListener("keydown", (e) => {
  if (!chartModal || chartModal.style.display !== "flex") return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.stopImmediatePropagation();
}, true);

// ------------------------------------------------------------------
// 初期化
// ------------------------------------------------------------------
window.addEventListener("load", loadQuizDates);
