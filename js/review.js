// ============================================================
// review.js（2026-09 新規）
// 「学びの棚」復習ページ：目次・しおり・メモ機能
//
// screening.js と同じく classic script（type="module" ではない）として
// 読み込む。conventions.nodeScriptModuleSystem は scripts/*.js（Node実行の
// バックエンドスクリプト）向けの規約であり、ブラウザ向けの本ファイルは
// 対象外（screening.js と同じ扱い）。
// ============================================================

const API_BASE_URL = "https://yfinance-api-fe86988c-d3b4-f1c6-640d.onrender.com";

// ------------------------------------------------------------------
// 章コンテンツ・しおり/メモの「読み取り」は、Render（コールドスタートで
// 数十秒待たされることがある）を経由せず、GitHub Raw
// （raw.githubusercontent.com）へ直接 fetch する（2026-09 変更）。
//
// - raw.githubusercontent.com は CORS が全面的に開放されており
//   （Access-Control-Allow-Origin: *）、GitHub Pages 上の静的JSから
//   直接読みに行ける。
// - キャッシュは GitHub 側の CDN（Fastly）で cache-control: max-age=300
//   （5分固定）。これは main.py 側が同じ raw URL を経由して読んでいた
//   従来の実装と同じ挙動であり、Renderを外したことで新たに生じる
//   制約ではない。
// - 一方、しおり登録・メモ保存・章の追加編集などの「書き込み」は、
//   GitHubへコミットするための REVIEW_GITHUB_TOKEN をサーバー側に
//   秘匿する必要があるため、引き続き Render（/review/bookmark・
//   /review/memo・/review/chapter）を経由する。
//
// リポジトリ情報は main.py の REVIEW_NOTES_REPO_OWNER /
// REVIEW_NOTES_REPO_NAME / REVIEW_NOTES_REPO_BRANCH と同じ値を
// ここに直接持つ（バックエンドとフロントエンドでの二重管理。
// リポジトリ名やブランチを変更する場合は両方を修正すること）。
const REVIEW_REPO_OWNER = "yt-f6d34a22-537c-e881-530f-f9e7a956a78b";
const REVIEW_REPO_NAME = "webapp-frontend";
const REVIEW_REPO_BRANCH = "main";

const REVIEW_CHAPTERS_RAW_URL =
  `https://raw.githubusercontent.com/${REVIEW_REPO_OWNER}/${REVIEW_REPO_NAME}` +
  `/refs/heads/${REVIEW_REPO_BRANCH}/data/review_chapters.json`;

const REVIEW_NOTES_RAW_URL =
  `https://raw.githubusercontent.com/${REVIEW_REPO_OWNER}/${REVIEW_REPO_NAME}` +
  `/refs/heads/${REVIEW_REPO_BRANCH}/data/review_notes.json`;

// ------------------------------------------------------------------
// 章コンテンツ
//
// 本文自体は data/review_chapters.json（webapp-frontend リポジトリ）で
// 管理し、GET /review/chapters で取得する。ここに定義する DEFAULT_CHAPTERS は
// 通信に失敗した場合の最低限のフォールバック表示用（バックエンドが停止して
// いてもページが完全に空にならないようにするため）であり、通常はサーバー
// から取得した内容で上書きされる。
//
// 章を追加・編集したい場合は、この配列を直接編集するのではなく、
// POST /review/chapter（またはGitHub上でdata/review_chapters.jsonを直接編集）
// を使うこと。
//
// id は一度公開したら変更しないこと（しおり・メモが chapter_id で
// 紐付いているため、id を変えると既存のしおり・メモが孤立する）。
// ------------------------------------------------------------------
const DEFAULT_CHAPTERS = [
  {
    id: "candlestick-basics",
    group: "学びの棚サンプル",
    part: "第1部　値動きを読む基礎",
    title: "ローソク足とは何を表すか（オフライン表示）",
    readMinutes: 3,
    bodyHtml: `<p class="lead">章コンテンツの読み込みに失敗したため、簡易表示をしています。しばらくしてから再読み込みしてください。</p>`,
  },
];

let CHAPTERS = DEFAULT_CHAPTERS;
let CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

function setChapters(chapters) {
  CHAPTERS = chapters && chapters.length > 0 ? chapters : DEFAULT_CHAPTERS;
  CHAPTERS_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
}

async function loadChapters() {
  try {
    const res = await fetch(REVIEW_CHAPTERS_RAW_URL);
    if (res.status === 404) {
      // data/review_chapters.json がまだ存在しない（章を一度も
      // 追加・編集していない）場合。DEFAULT_CHAPTERS のフォールバック
      // 表示のまま続行する（main.py の REVIEW_CHAPTERS_DEFAULT に
      // 相当する挙動をクライアント側でも再現）。
      return;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    setChapters(data.chapters);
  } catch (e) {
    console.error("章コンテンツの読み込みに失敗しました:", e);
  }
}

// ------------------------------------------------------------------
// DOM 要素の取得（domHookAttributes に従い id / data-* のみを用いる）
// ------------------------------------------------------------------
const reviewTabReadBtn = document.getElementById("reviewTabRead");
const reviewTabBookmarksBtn = document.getElementById("reviewTabBookmarks");
const reviewTabMemosBtn = document.getElementById("reviewTabMemos");
const reviewViewRead = document.getElementById("reviewViewRead");
const reviewViewBookmarks = document.getElementById("reviewViewBookmarks");
const reviewViewMemos = document.getElementById("reviewViewMemos");

const chapterNavEl = document.getElementById("chapterNavEl");
const chapterBreadcrumbEl = document.getElementById("chapterBreadcrumbEl");
const chapterTitleEl = document.getElementById("chapterTitleEl");
const chapterMetaEl = document.getElementById("chapterMetaEl");
const chapterBodyEl = document.getElementById("chapterBodyEl");
const chapterPrevBtn = document.getElementById("chapterPrevBtn");
const chapterNextBtn = document.getElementById("chapterNextBtn");

const bookmarkToggleBtn = document.getElementById("bookmarkToggleBtn");
const bookmarkListEl = document.getElementById("bookmarkListEl");
const bookmarkEmptyEl = document.getElementById("bookmarkEmptyEl");

const memoListEl = document.getElementById("memoListEl");
const memoListEmptyEl = document.getElementById("memoListEmptyEl");

const memoTextareaEl = document.getElementById("memoTextareaEl");
const memoSaveBtn = document.getElementById("memoSaveBtn");
const memoStatusEl = document.getElementById("memoStatusEl");

const reviewLoadingOverlay = document.getElementById("reviewLoadingOverlay");

const addChapterBtn = document.getElementById("addChapterBtn");
const editChapterBtn = document.getElementById("editChapterBtn");

const chapterEditorModal = document.getElementById("chapterEditorModal");
const chapterEditorTitleEl = document.getElementById("chapterEditorTitleEl");
const chapterEditorCloseBtn = document.getElementById("chapterEditorCloseBtn");
const chapterEditorGroupInput = document.getElementById("chapterEditorGroupInput");
const chapterEditorPartInput = document.getElementById("chapterEditorPartInput");
const chapterEditorTitleInput = document.getElementById("chapterEditorTitleInput");
const chapterEditorReadMinutesInput = document.getElementById("chapterEditorReadMinutesInput");
const chapterEditorBodyHtmlInput = document.getElementById("chapterEditorBodyHtmlInput");
const chapterEditorPreviewEl = document.getElementById("chapterEditorPreviewEl");
const chapterGroupOptionsEl = document.getElementById("chapterGroupOptions");
const chapterPartOptionsEl = document.getElementById("chapterPartOptions");
const chapterEditorSaveBtn = document.getElementById("chapterEditorSaveBtn");
const chapterEditorCancelBtn = document.getElementById("chapterEditorCancelBtn");
const chapterEditorDeleteBtn = document.getElementById("chapterEditorDeleteBtn");

// ------------------------------------------------------------------
// 状態
// ------------------------------------------------------------------
let notes = { bookmarks: [], memos: {} };
let currentChapterId = CHAPTERS[0].id;

// エディタが「新規追加」か「既存章の編集」かを判定するための状態。
// null のときは新規追加モード、章IDが入っているときは編集モード。
let editingChapterId = null;

// ------------------------------------------------------------------
// 合言葉（書き込み系エンドポイントの簡易認可）
//
// NOTE: このアプリは静的サイト（GitHub Pages）のため、合言葉をこの
// ファイルに直接書いてコミットすると、ページのソースを見れば誰でも
// 値が分かってしまう（＝実質無認可と同じ）。そのため、値はコードに
// 埋め込まず、初回操作時に prompt() で入力させ、この端末の
// localStorage にのみ保持する。他の端末で使う場合はそれぞれの端末で
// 一度だけ入力し直す必要がある。
// ------------------------------------------------------------------
const REVIEW_SECRET_STORAGE_KEY = "reviewApiSecret";

function getReviewSecret() {
  let secret = localStorage.getItem(REVIEW_SECRET_STORAGE_KEY);
  if (!secret) {
    secret = window.prompt(
      "しおり・メモの保存には合言葉が必要です。合言葉を入力してください（この端末に保存され、次回以降は不要です）。"
    );
    if (secret) {
      localStorage.setItem(REVIEW_SECRET_STORAGE_KEY, secret);
    }
  }
  return secret || null;
}

function clearReviewSecret() {
  localStorage.removeItem(REVIEW_SECRET_STORAGE_KEY);
}

// ------------------------------------------------------------------
// サーバー通信
//
// loadingOverlaySspec に従い、通信開始前にオーバーレイを表示し、
// try/finally の finally で必ず非表示にする。
// ------------------------------------------------------------------
async function loadNotes() {
  try {
    const res = await fetch(REVIEW_NOTES_RAW_URL);
    if (res.status === 404) {
      // data/review_notes.json がまだ存在しない（一度もしおり・メモを
      // 保存していない）場合。初期値のまま続行する。
      notes = { bookmarks: [], memos: {} };
      return;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    notes = { bookmarks: data.bookmarks || [], memos: data.memos || {} };
  } catch (e) {
    console.error("しおり・メモの読み込みに失敗しました:", e);
  }
}

async function requestWithSecret(method, path, body) {
  const secret = getReviewSecret();
  if (!secret) {
    return { error: "合言葉が入力されなかったため、保存を中止しました。" };
  }
  reviewLoadingOverlay.classList.remove("hidden");
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Review-Secret": secret,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      // 合言葉が誤っている場合は保存し直したものを次回再入力させる
      clearReviewSecret();
      return { error: "合言葉が違うようです。もう一度お試しください。" };
    }
    const data = await res.json();
    if (data.error) {
      return { error: data.detail || data.error };
    }
    return data;
  } catch (e) {
    return { error: String(e) };
  } finally {
    reviewLoadingOverlay.classList.add("hidden");
  }
}

// 既存コードとの互換のため、POST専用の薄いラッパーとして残す。
function postWithSecret(path, body) {
  return requestWithSecret("POST", path, body);
}

async function toggleBookmark() {
  const bookmarked = !notes.bookmarks.includes(currentChapterId);
  const result = await postWithSecret("/review/bookmark", {
    chapter_id: currentChapterId,
    bookmarked,
  });
  if (result.error) {
    alert("しおりの更新に失敗しました：" + result.error);
    return;
  }
  notes.bookmarks = result.bookmarks;
  renderChapterNav();
  renderBookmarkButton();
  renderBookmarkList();
}

async function saveMemo() {
  const memo = memoTextareaEl.value;
  memoStatusEl.textContent = "保存中…";
  const result = await postWithSecret("/review/memo", {
    chapter_id: currentChapterId,
    memo,
  });
  if (result.error) {
    memoStatusEl.textContent = "";
    alert("メモの保存に失敗しました：" + result.error);
    return;
  }
  notes.memos = result.memos;
  memoStatusEl.textContent = "保存しました";
  setTimeout(() => {
    if (memoStatusEl.textContent === "保存しました") {
      memoStatusEl.textContent = "";
    }
  }, 2500);
}

// ------------------------------------------------------------------
// 章コンテンツの追加・編集・削除（2026-09 追加）
//
// 「＋ 新規章を追加」ボタン、および読む画面の編集（✏️）ボタンから
// 同じモーダルを開く。新規追加は editingChapterId = null、
// 既存章の編集は editingChapterId = 編集対象のID として区別する。
// ------------------------------------------------------------------

function populateEditorDatalists() {
  const groups = [...new Set(CHAPTERS.map((c) => c.group).filter(Boolean))];
  const parts = [...new Set(CHAPTERS.map((c) => c.part).filter(Boolean))];

  chapterGroupOptionsEl.innerHTML = groups
    .map((g) => `<option value="${g.replace(/"/g, "&quot;")}"></option>`)
    .join("");
  chapterPartOptionsEl.innerHTML = parts
    .map((p) => `<option value="${p.replace(/"/g, "&quot;")}"></option>`)
    .join("");
}

function updateEditorPreview() {
  // bodyHtml はページ作者（自分自身）が入力する信頼済みHTMLとして扱う
  // 前提（scripts.review.contentModel.chapters を参照）。ユーザー投稿を
  // 受け付けるフォームではないため、ここでも innerHTML へそのまま反映する。
  chapterEditorPreviewEl.innerHTML = chapterEditorBodyHtmlInput.value;
}

function openChapterEditor(chapterId) {
  editingChapterId = chapterId || null;
  populateEditorDatalists();

  if (editingChapterId) {
    const chapter = CHAPTERS_BY_ID[editingChapterId];
    if (!chapter) return;
    chapterEditorTitleEl.textContent = "章を編集";
    chapterEditorGroupInput.value = chapter.group || "";
    chapterEditorPartInput.value = chapter.part || "";
    chapterEditorTitleInput.value = chapter.title || "";
    chapterEditorReadMinutesInput.value = chapter.readMinutes || 3;
    chapterEditorBodyHtmlInput.value = chapter.bodyHtml || "";
    chapterEditorDeleteBtn.classList.remove("hidden");
  } else {
    // 新規追加時は、今開いている章と同じグループ・部を初期値にしておくと
    // 続けて同じ部に章を追加したい場合に入力の手間が減る。
    const current = CHAPTERS_BY_ID[currentChapterId];
    chapterEditorTitleEl.textContent = "新規章を追加";
    chapterEditorGroupInput.value = current?.group || "";
    chapterEditorPartInput.value = current?.part || "";
    chapterEditorTitleInput.value = "";
    chapterEditorReadMinutesInput.value = 3;
    chapterEditorBodyHtmlInput.value = "";
    chapterEditorDeleteBtn.classList.add("hidden");
  }

  updateEditorPreview();
  chapterEditorModal.classList.remove("hidden");
}

function closeChapterEditor() {
  chapterEditorModal.classList.add("hidden");
  editingChapterId = null;
}

function slugifyForNewChapterId() {
  // 新規章のIDは自動採番する（利用者にIDを意識させない）。
  // 一意性だけを重視し、時刻ベースの文字列にする。
  return `custom-${Date.now().toString(36)}`;
}

async function saveChapterFromEditor() {
  const title = chapterEditorTitleInput.value.trim();
  const bodyHtml = chapterEditorBodyHtmlInput.value.trim();
  if (!title || !bodyHtml) {
    alert("章タイトルと本文は必須です。");
    return;
  }

  const payload = {
    id: editingChapterId || slugifyForNewChapterId(),
    group: chapterEditorGroupInput.value.trim(),
    part: chapterEditorPartInput.value.trim(),
    title,
    readMinutes: Math.max(1, parseInt(chapterEditorReadMinutesInput.value, 10) || 1),
    bodyHtml,
  };

  const result = await requestWithSecret("POST", "/review/chapter", payload);
  if (result.error) {
    alert("章の保存に失敗しました：" + result.error);
    return;
  }

  setChapters(result.chapters);
  closeChapterEditor();
  renderChapterNav();
  // 保存した章をそのまま開く（新規追加でも、編集でも同じ章に留まる）
  showChapter(payload.id, { scroll: false });
}

async function deleteChapterFromEditor() {
  if (!editingChapterId) return;
  const chapter = CHAPTERS_BY_ID[editingChapterId];
  const confirmed = window.confirm(
    `「${chapter ? chapter.title : editingChapterId}」を削除します。よろしいですか？\n` +
    `（この章に付けたしおり・メモも一緒に削除されます）`
  );
  if (!confirmed) return;

  const deletingId = editingChapterId;
  const result = await requestWithSecret(
    "DELETE",
    `/review/chapter?chapter_id=${encodeURIComponent(deletingId)}`
  );
  if (result.error) {
    alert("章の削除に失敗しました：" + result.error);
    return;
  }

  setChapters(result.chapters);
  // ローカルの notes からも、バックエンドの自動クリーンアップ結果に合わせて
  // 該当IDを取り除いておく（次回 loadNotes() されるまでの間の表示整合用）。
  notes.bookmarks = notes.bookmarks.filter((id) => id !== deletingId);
  delete notes.memos[deletingId];

  closeChapterEditor();
  renderChapterNav();
  renderBookmarkList();
  renderMemoList();

  if (currentChapterId === deletingId) {
    // 削除した章が表示中だった場合は、先頭の章へ退避する
    showChapter(CHAPTERS[0].id, { scroll: false });
  }
}

// ------------------------------------------------------------------
// 描画
// ------------------------------------------------------------------

// 章配列を「グループ→部」の順にネストしたMapへ組み替える。
// data/review_chapters.json は元々「隣接する要素が同じpartなら
// グルーピング」という前提で作られていたが、章の追加・編集を
// UIから任意の順序・位置で行えるようにした（2026-09）ことで、
// 同じグループ/部の章が配列内で必ずしも隣り合わない場合がある。
// そのため、配列内の位置に関わらず正しくグルーピングされるよう、
// 「初めて登場した順」を保持する Map ベースの集計に変更した。
// group が未設定（従来データとの後方互換）の場合は「分類未設定」とする。
function groupChaptersForNav() {
  const groups = new Map();
  CHAPTERS.forEach((chapter) => {
    const groupLabel = chapter.group || "分類未設定";
    const partLabel = chapter.part || "（部未設定）";
    if (!groups.has(groupLabel)) {
      groups.set(groupLabel, new Map());
    }
    const parts = groups.get(groupLabel);
    if (!parts.has(partLabel)) {
      parts.set(partLabel, []);
    }
    parts.get(partLabel).push(chapter);
  });
  return groups;
}

function renderChapterNav() {
  chapterNavEl.innerHTML = "";
  const groups = groupChaptersForNav();

  groups.forEach((parts, groupLabel) => {
    const groupEl = document.createElement("p");
    groupEl.className = "review-chapter-group-title";
    groupEl.textContent = groupLabel;
    chapterNavEl.appendChild(groupEl);

    parts.forEach((chapters, partLabel) => {
      const partEl = document.createElement("p");
      partEl.className = "review-chapter-part-title";
      partEl.textContent = partLabel;
      chapterNavEl.appendChild(partEl);

      chapters.forEach((chapter) => {
        const itemEl = document.createElement("div");
        itemEl.className = "review-chapter-item";
        itemEl.dataset.chapterId = chapter.id;
        if (chapter.id === currentChapterId) {
          itemEl.setAttribute("data-current", "");
        }
        if (notes.bookmarks.includes(chapter.id)) {
          itemEl.setAttribute("data-bookmarked", "");
        }

        const dotEl = document.createElement("span");
        dotEl.className = "review-chapter-item-bookmark";
        itemEl.appendChild(dotEl);

        const labelEl = document.createElement("span");
        labelEl.textContent = chapter.title;
        itemEl.appendChild(labelEl);

        itemEl.addEventListener("click", () => showChapter(chapter.id));
        chapterNavEl.appendChild(itemEl);
      });
    });
  });
}

function renderBookmarkButton() {
  const bookmarked = notes.bookmarks.includes(currentChapterId);
  if (bookmarked) {
    bookmarkToggleBtn.setAttribute("data-bookmarked", "");
  } else {
    bookmarkToggleBtn.removeAttribute("data-bookmarked");
  }
}

function renderBookmarkList() {
  bookmarkListEl.innerHTML = "";
  const bookmarkedChapters = notes.bookmarks
    .map((id) => CHAPTERS_BY_ID[id])
    .filter(Boolean);

  bookmarkEmptyEl.classList.toggle("hidden", bookmarkedChapters.length > 0);

  bookmarkedChapters.forEach((chapter) => {
    const itemEl = document.createElement("div");
    itemEl.className = "review-bookmark-item";
    itemEl.dataset.chapterId = chapter.id;

    const partEl = document.createElement("div");
    partEl.className = "review-bookmark-item-part";
    partEl.textContent = chapter.part;

    const titleEl = document.createElement("div");
    titleEl.className = "review-bookmark-item-title";
    titleEl.textContent = chapter.title;

    itemEl.appendChild(partEl);
    itemEl.appendChild(titleEl);

    itemEl.addEventListener("click", () => {
      // switchTab を先に呼び、#reviewReaderSection を可視化してから
      // showChapter() のスクロール計算（getBoundingClientRect）を行う。
      // 逆順だと本文エリアがまだ hidden（display:none）のままで
      // 座標が正しく取れず、目次付近にしかスクロールしなかった。
      switchTab("read");
      showChapter(chapter.id);
    });

    bookmarkListEl.appendChild(itemEl);
  });
}

function renderMemoList() {
  memoListEl.innerHTML = "";

  const memoChapters = Object.keys(notes.memos)
    .filter((id) => (notes.memos[id] || "").trim() !== "")
    .map((id) => CHAPTERS_BY_ID[id])
    .filter(Boolean);

  memoListEmptyEl.classList.toggle("hidden", memoChapters.length > 0);

  memoChapters.forEach((chapter) => {
    const memoText = notes.memos[chapter.id] || "";

    const itemEl = document.createElement("div");
    itemEl.className = "review-bookmark-item";
    itemEl.dataset.chapterId = chapter.id;

    const partEl = document.createElement("div");
    partEl.className = "review-bookmark-item-part";
    partEl.textContent = chapter.part;

    const titleEl = document.createElement("div");
    titleEl.className = "review-bookmark-item-title";
    titleEl.textContent = chapter.title;

    const previewEl = document.createElement("div");
    previewEl.className = "review-memo-item-preview";
    previewEl.textContent = memoText.length > 60 ? `${memoText.slice(0, 60)}…` : memoText;

    itemEl.appendChild(partEl);
    itemEl.appendChild(titleEl);
    itemEl.appendChild(previewEl);

    itemEl.addEventListener("click", () => {
      // しおり一覧と同じ理由で、先にタブを切り替えてから showChapter() を呼ぶ。
      switchTab("read");
      showChapter(chapter.id);
    });

    memoListEl.appendChild(itemEl);
  });
}

function showChapter(chapterId, options = {}) {
  const { scroll = true } = options;
  const chapter = CHAPTERS_BY_ID[chapterId];
  if (!chapter) return;

  currentChapterId = chapterId;
  location.hash = chapterId;

  chapterBreadcrumbEl.textContent = chapter.group
    ? `${chapter.group} / ${chapter.part}`
    : chapter.part;
  chapterTitleEl.textContent = chapter.title;
  chapterMetaEl.textContent = `読了目安 ${chapter.readMinutes}分`;
  chapterBodyEl.innerHTML = chapter.bodyHtml;
  memoTextareaEl.value = notes.memos[chapterId] || "";
  memoStatusEl.textContent = "";

  const index = CHAPTERS.findIndex((c) => c.id === chapterId);
  chapterPrevBtn.disabled = index <= 0;
  chapterNextBtn.disabled = index >= CHAPTERS.length - 1;

  renderChapterNav();
  renderBookmarkButton();

  // 目次クリック・前後章移動時は、screening.js の showResults() 後のスクロール
  // （#resultSection へ smooth スクロール、offset -10）と同じUXにする。
  // 初回読み込み時（window load）は options.scroll=false を渡し、
  // ページを開いた瞬間に勝手にスクロールしないようにする。
  if (scroll) {
    const target = document.getElementById("reviewReaderSection");
    const offset = -10;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.pageYOffset + offset,
      behavior: "smooth",
    });
  }
}

function switchTab(tab) {
  const isRead = tab === "read";
  const isBookmarks = tab === "bookmarks";
  const isMemos = tab === "memos";

  reviewViewRead.classList.toggle("hidden", !isRead);
  reviewViewBookmarks.classList.toggle("hidden", !isBookmarks);
  reviewViewMemos.classList.toggle("hidden", !isMemos);

  [reviewTabReadBtn, reviewTabBookmarksBtn, reviewTabMemosBtn].forEach((btn) => {
    btn.removeAttribute("data-current");
  });

  if (isRead) {
    reviewTabReadBtn.setAttribute("data-current", "");
  } else if (isBookmarks) {
    reviewTabBookmarksBtn.setAttribute("data-current", "");
    renderBookmarkList();
  } else if (isMemos) {
    reviewTabMemosBtn.setAttribute("data-current", "");
    renderMemoList();
  }
}

// ------------------------------------------------------------------
// イベント登録
//
// on() は、対象要素が null（review.html と review.js のバージョンが
// 一時的にズレていて、想定するidの要素が存在しない場合など）でも
// スクリプト全体を止めずに済むようにするための安全なラッパー。
// 通常の addEventListener を素で並べていると、1つの要素が見つからない
// だけでそこから下の初期化処理（章の読み込み等）が丸ごと実行されなく
// なってしまう（トップレベルで例外が発生すると、それ以降の同期処理は
// 中断されるため）。要素が見つからない場合は console.warn に留め、
// 他の初期化は継続する（2026-09 追加）。
// ------------------------------------------------------------------
function on(element, event, handler) {
  if (!element) {
    console.warn(
      `review.js: イベント登録対象の要素が見つかりませんでした（event=${event}）。` +
      `review.html が古いバージョンのままになっている可能性があります。`
    );
    return;
  }
  element.addEventListener(event, handler);
}

on(reviewTabReadBtn, "click", () => switchTab("read"));
on(reviewTabBookmarksBtn, "click", () => switchTab("bookmarks"));
on(reviewTabMemosBtn, "click", () => switchTab("memos"));
on(bookmarkToggleBtn, "click", toggleBookmark);
on(memoSaveBtn, "click", saveMemo);

on(chapterPrevBtn, "click", () => {
  const index = CHAPTERS.findIndex((c) => c.id === currentChapterId);
  if (index > 0) showChapter(CHAPTERS[index - 1].id);
});
on(chapterNextBtn, "click", () => {
  const index = CHAPTERS.findIndex((c) => c.id === currentChapterId);
  if (index < CHAPTERS.length - 1) showChapter(CHAPTERS[index + 1].id);
});

on(addChapterBtn, "click", () => openChapterEditor(null));
on(editChapterBtn, "click", () => openChapterEditor(currentChapterId));
on(chapterEditorCloseBtn, "click", closeChapterEditor);
on(chapterEditorCancelBtn, "click", closeChapterEditor);
on(chapterEditorModal?.querySelector(".review-editor-backdrop"), "click", closeChapterEditor);
on(chapterEditorBodyHtmlInput, "input", updateEditorPreview);
on(chapterEditorSaveBtn, "click", saveChapterFromEditor);
on(chapterEditorDeleteBtn, "click", deleteChapterFromEditor);

// ------------------------------------------------------------------
// 初期化
//
// 章コンテンツ（chapters）としおり・メモ（notes）は別々のJSONファイル・
// 別々のエンドポイントで管理しているため、並行して取得してから初期表示する。
// ------------------------------------------------------------------
window.addEventListener("load", async () => {
  reviewLoadingOverlay.classList.remove("hidden");
  try {
    await Promise.all([loadChapters(), loadNotes()]);
  } finally {
    reviewLoadingOverlay.classList.add("hidden");
  }

  const hashId = location.hash.replace("#", "");
  const initialChapterId = CHAPTERS_BY_ID[hashId] ? hashId : CHAPTERS[0].id;

  showChapter(initialChapterId, { scroll: false });
  renderBookmarkList();
});
