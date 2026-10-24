// --------------------------------------
// entry-checklist-data.js
// エントリーチェックリストの表示内容（定義）。
// 項目を変えたいときは、このファイルだけを手で編集する（ロジックは entry-checklist.js）。
//
// 【編集のしかた】
//   passRule.requireAllRequired : true なら「必須」項目がすべて ON でないと判定は「基準を満たしています」にならない
//   passRule.minOptionalRatio   : 「任意」項目のうち、ON が必要な割合（0〜1。0.6 なら 60% 以上）
//   sections[].title            : グループ見出し
//   sections[].items[]
//     text     : チェック項目の文言（必須）
//     required : true で「必須」項目。省略または false で「任意」項目
//     hint     : 補足説明（省略可）
//
// 下記の項目は例（サンプル）です。実際の基準に書き換えてください。
// チェック状態は保存されません（リロードすると初期状態に戻ります）。
// --------------------------------------
export const ENTRY_CHECKLIST = {
  passRule: {
    requireAllRequired: true,
    minOptionalRatio: 0.6,
  },
  sections: [
    {
      title: "エントリー前の確認（サンプル）",
      items: [
        { text: "損切りラインを事前に決めている", required: true },
        { text: "ポジションサイズが許容損失の範囲内である", required: true, hint: "例：1回の損失が資金の○％以内" },
        { text: "出来高が十分で、売買しやすい" },
      ],
    },
    {
      title: "信用取引の場合（サンプル）",
      items: [
        { text: "返済期限と強制決済の条件を確認した", required: true, hint: "「信用 強制決済期日」一覧を参照" },
        { text: "規制・貸借区分を確認した" },
      ],
    },
  ],
};
