// --------------------------------------
// margin-deadline-data.js
// 信用取引 強制決済期日一覧の表示内容（定義）。
// 内容を変えたいときは、このファイルだけを手で編集する（ロジックは margin-deadline.js）。
//
// 【編集のしかた】
//   updatedAt                : 一覧全体の更新日（YYYY-MM-DD）
//   brokers[]                : 証券会社（表示順＝配列順）
//     name      : 証券会社名（必須）
//     sourceUrl : 公式情報の URL（https のみ有効。空なら「公式情報」リンクを出さない）
//     checkedAt : 公式情報を確認した日（YYYY-MM-DD）。90日を超える／不正な場合は「要再確認」と表示される
//     products[]              : 信用取引の種類ごとの条件
//       label       : 商品名（例：制度信用）
//       term        : 返済期限
//       forcedClose : 強制決済のタイミング
//       holidayRule : 期日が休業日の場合の扱い
//       note        : 備考
//       （term / forcedClose / holidayRule / note は空文字または省略すると表示されない）
//
// 下記は【架空のサンプル】です。実在の証券会社の条件は含んでいません。
// 各社の公式ページで確認した内容に書き換えてください。
// --------------------------------------
export const MARGIN_DEADLINES = {
  updatedAt: "2026-10-24",
  brokers: [
    {
      name: "（サンプル）○○証券",
      sourceUrl: "https://example.com/",
      checkedAt: "2026-10-24",
      products: [
        {
          label: "制度信用",
          term: "（例）最長6か月",
          forcedClose: "（例）期日までに返済しない場合の強制決済のタイミング",
          holidayRule: "（例）期日が休業日の場合の扱い",
          note: "",
        },
        {
          label: "一般信用",
          term: "（公式ページで確認して記入）",
          forcedClose: "（公式ページで確認して記入）",
        },
      ],
    },
  ],
};
