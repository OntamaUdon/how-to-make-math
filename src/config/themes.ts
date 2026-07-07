/* =============================================================
   themes.ts — 配色テーマの一覧と既定値（サイト内の切替に使う）
   ・各テーマの実体は public/themes/theme-<id>.css（色・書体・余白のトークン）。
   ・テーマを足すときは public/themes/ に CSS を作り、ここに 1 行追加する。
   ============================================================= */

export interface ThemeOption {
  /** ファイル名に対応する id（public/themes/theme-<id>.css） */
  id: string;
  /** 切替メニューに出す表示名 */
  label: string;
  /** 分類（メニューのグループ分け用） */
  group: "light" | "dark" | "fun";
}

export const themes: ThemeOption[] = [
  { id: "washi",     label: "和紙",          group: "light" },
  { id: "sepia",     label: "書籍セピア",     group: "light" },
  { id: "ocean",     label: "オーシャン",     group: "light" },
  { id: "lavender",  label: "藤",            group: "light" },
  { id: "newspaper", label: "新聞",          group: "light" },
  { id: "mono",      label: "モノクロ",       group: "light" },
  { id: "luxe",      label: "高級・ダーク",   group: "dark" },
  { id: "midnight",  label: "ミッドナイト",   group: "dark" },
  { id: "nord",      label: "ノルド",         group: "dark" },
  { id: "terminal",  label: "ターミナル",     group: "dark" },
  { id: "geocities", label: "90年代ホムペ",   group: "fun" },
  { id: "rainbow",   label: "虹色★点滅",     group: "fun" },
];

/** 初期表示のテーマ（localStorage に保存が無いときに使う） */
export const defaultTheme = "ocean";

/** 選択を記憶する localStorage のキー */
export const themeStorageKey = "site-theme";
