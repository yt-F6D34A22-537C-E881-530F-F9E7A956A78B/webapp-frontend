// --------------------------------------
// margin-deadline-data.js
// 信用取引 強制決済期日一覧の表示内容（定義）。
// 内容を変えたいときは、このファイルだけを手で編集する（ロジックは margin-deadline.js）。
//
// 【考え方】優先順位は ①追証発生から強制決済までの営業日数（相対）、②具体的な日付（例）。
//   ・各社のルールは「発生日からの営業日数（day）」で持つ。これが本体の情報。
//   ・具体的な日付は example.days に1か所だけ持つ参考表示。day を index として引くだけで、
//     日付の計算（祝日・休業日の判定）は一切しない。例を変えるときは example だけを直す。
//
// 【編集のしかた】
//   updatedAt : 一覧全体の更新日（YYYY-MM-DD）
//   example   : 参考表示用の日付例（月曜に追証が発生した場合を基準にする）
//     title : 例の見出し（例：「11/9（月）に追証が発生した場合の例」）
//     note  : 例の注意書き
//     days  : 営業日ごとの日付ラベル。index が「発生日からの営業日数」（0＝発生日、1＝1営業日後…）。
//             祝日を含まない週を選ぶこと（祝日があると営業日の数がずれる）
//   brokers[] : 証券会社（表示順＝配列順）
//     name        : 証券会社名（必須）
//     shortName   : 表（スマホでは幅が狭い）で使う短い名前。省略すると name を使う（正式名称が必要なら note に書く）
//     sourceUrl   : 公式情報の URL（https のみ有効。クエリ文字列などの余分な付与物は付けない。空なら非表示）
//     checkedAt   : 公式情報を確認した日（YYYY-MM-DD）。90日超・空・不正な場合は「要再確認」と表示される
//     resolve     : 追証の解消期限
//     forcedClose : 強制決済
//       day    : 発生日から何営業日後か（0以上の整数）。会社指定などで日数が決まらない場合は null
//       time   : 時刻・タイミングの表記（例："12:00" / "寄付き" / "12:30以降" / "以降"）。不要なら ""
//       text   : 補足説明
//       note   : さらに補足（forcedClose のみ。省略可）
//       approx : true なら日数が目安（例）であることを表に「（目安）」と表示する（省略可）
//     note        : 証券会社ごとの注記（省略可）
//   traderNotes : トレーダー視点のメモ（運用者の見方。事実の保証ではない）
//     title / disclaimer / items[]（when：時期、text：内容）
//     when の中の {day2} {day3} などは、example.days[2] [3] の日付に置き換えて表示する
//     （日付の例を変えても、ここを直さなくてよい）
//
// 公式ページで確認した内容は checkedAt に確認日を入れる。未確認のものは "" のままにする
// （画面上「要再確認」と表示される）。
// --------------------------------------
export const MARGIN_DEADLINES = {
  updatedAt: "2026-10-26",

  example: {
    title: "11/9（月）に追証が発生した場合の例",
    note: "月曜日を基準にした参考例です（祝日のない週）。実際の日付は営業日カレンダーで確認してください。",
    days: ["11/9（月）", "11/10（火）", "11/11（水）", "11/12（木）", "11/13（金）"],
  },

  brokers: [
    {
      name: "SBI証券",
      shortName: "SBI",
      sourceUrl: "https://search.sbisec.co.jp/v2/popwin/help/trade_stock_11_04.html",
      checkedAt: "2026-10-26",
      resolve: { day: 3, time: "12:00", text: "発生日から3営業日目の正午までに解消" },
      forcedClose: {
        day: 3,
        time: "12:30以降",
        text: "会社の任意のタイミングで強制決済注文を執行",
        note: "実際は当日の後場〜翌営業日の寄付きに執行されることが多い",
      },
      note: "発生日の翌営業日までに解消できないと、新規建てができなくなる（強制決済の期限とは別）。",
    },
    {
      name: "楽天証券",
      shortName: "楽天",
      sourceUrl: "https://www.rakuten-sec.co.jp/web/domestic/special/beginner/margin05.html",
      checkedAt: "2026-10-26",
      resolve: { day: 2, time: "12:00", text: "発生日の翌々営業日の正午までに解消" },
      forcedClose: { day: 3, time: "寄付き", text: "期限の翌営業日の寄付きから強制決済" },
    },
    {
      name: "マネックス証券",
      shortName: "マネックス",
      sourceUrl: "https://info.monex.co.jp/margin-trade/rule/margin-call_02.html",
      checkedAt: "",
      resolve: { day: 2, time: "24:00", text: "追証期日の24:00までに解消" },
      forcedClose: { day: 3, time: "以降", text: "会社の任意のタイミングで強制決済（寄付き固定ではない）" },
    },
    {
      name: "三菱UFJ eスマート証券（旧auカブコム）",
      shortName: "三菱UFJ eスマート",
      sourceUrl: "https://faq.kabu.com/s/article/k000352",
      checkedAt: "",
      resolve: { day: 2, time: "12:00", text: "正午までに解消" },
      forcedClose: { day: 3, time: "寄付き", text: "寄付きから強制決済" },
      note: "正式名称：三菱UFJ eスマート証券（旧auカブコム）",
    },
    {
      name: "松井証券",
      shortName: "松井",
      sourceUrl: "",
      checkedAt: "",
      resolve: { day: 2, time: "", text: "この日までに解消（時刻は要確認）" },
      forcedClose: { day: 3, time: "寄付き", text: "寄付きから強制決済（会社判断）" },
    },
    {
      name: "野村證券",
      shortName: "野村",
      sourceUrl: "",
      checkedAt: "",
      resolve: { day: null, time: "", text: "会社指定の期限までに解消" },
      forcedClose: { day: 3, time: "以降", approx: true, text: "未解消の場合、以降に強制決済（日数は目安）" },
    },
    {
      name: "SMBC日興証券",
      shortName: "SMBC日興",
      sourceUrl: "",
      checkedAt: "",
      resolve: { day: null, time: "", text: "会社指定の期限までに解消" },
      forcedClose: { day: 3, time: "以降", approx: true, text: "未解消の場合、以降に強制決済（日数は目安）" },
    },
  ],

  traderNotes: {
    title: "トレーダー視点のメモ（参考）",
    disclaimer: "運用者の見方であり、事実の保証や売買の推奨ではありません。実際の需給は異なる場合があります。",
    items: [
      {
        when: "解消期限の日（例 {day2}）",
        text: "多くの証券会社で追証の解消期限にあたる。この日に出やすい売りは、投資家が自分で追証を解消するための売り。",
      },
      {
        when: "強制決済の初日・寄付き（例 {day3}）",
        text: "楽天・松井・三菱UFJ eスマートの強制売りが出やすい。",
      },
      {
        when: "後場〜翌営業日（例 {day3}後場〜{day4}）",
        text: "SBI分の売りが加わる可能性がある。SBIは解消期限が正午のため、寄付きの一斉執行とは限らない。マネックスも寄付き固定ではなく、会社の任意のタイミングで執行される。",
      },
    ],
  },
};
