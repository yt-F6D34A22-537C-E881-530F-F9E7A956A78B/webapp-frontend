// --------------------------------------
// info-modal.js
// 情報モーダルの開閉を一手に担う共通コントローラ。
// ・開く：[data-role="info-modal-open"] の data-modal-target（開くモーダルの id）
// ・閉じる：[data-role="info-modal-close"]（✕ボタン・背景）／Esc
// ・状態：モーダルの data-open 属性（見た目は css/info-modal.css が担う）
// モーダルを増やすときは、index.html にマークアップと起動ボタンを足すだけでよい
// （本ファイルは無改修）。要素の特定は id / data-* のみで行う。
// --------------------------------------
let openedModalEl = null;
let lastOpenerEl = null;

function openInfoModal(modalId, openerEl) {
  const modalEl = document.getElementById(modalId);
  if (!modalEl) {
    console.warn(`info-modal.js: モーダル #${modalId} が見つかりません。index.html が古い可能性があります。`);
    return;
  }
  if (openedModalEl) closeInfoModal();

  openedModalEl = modalEl;
  lastOpenerEl = openerEl ?? null;
  modalEl.setAttribute("data-open", "");
  modalEl.focus();   // tabindex="-1" のモーダル本体へフォーカスを移す
}

function closeInfoModal() {
  if (!openedModalEl) return;

  openedModalEl.removeAttribute("data-open");
  if (lastOpenerEl) lastOpenerEl.focus();   // 開いたボタンへフォーカスを戻す
  openedModalEl = null;
  lastOpenerEl = null;
}

export function initInfoModalController() {
  // イベント委譲：ボタン・モーダルが増えても登録は1回で済む
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest('[data-role="info-modal-open"]');
    if (openBtn) {
      openInfoModal(openBtn.dataset.modalTarget, openBtn);
      return;
    }
    if (e.target.closest('[data-role="info-modal-close"]')) closeInfoModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openedModalEl) closeInfoModal();
  });
}
