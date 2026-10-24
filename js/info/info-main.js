// --------------------------------------
// info-main.js
// 情報モーダル（エントリーチェックリスト／信用取引 強制決済期日）のエントリーポイント。
// chart-main.js とは独立しており、相互に参照しない。
// 表示内容（定義）は *-data.js の定数に持ち、通信は行わない。
// --------------------------------------
import { initInfoModalController } from "./info-modal.js";
import { initEntryChecklist } from "./entry-checklist.js";
import { initMarginDeadline } from "./margin-deadline.js";

initInfoModalController();
initEntryChecklist();
initMarginDeadline();
