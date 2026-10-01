/* =============================================================
   base.ts — サイトを「サブフォルダ付きの URL」で公開するときの前置き処理。
   ・通常のビルドでは BASE は空文字で、ここの関数は何も変えない。
   ・GitHub Pages のように https://ユーザー.github.io/リポジトリ名/ で公開するときだけ、
     astro.config.mjs の base（環境変数 SITE_BASE）が入り、/ から始まるリンクの前に付く。
   ============================================================= */

/** 末尾の / を除いた base。"" か "/how-to-make-math" */
export const BASE: string = import.meta.env.BASE_URL.replace(/\/$/, "");

/** "/foo" → "/how-to-make-math/foo"。外部 URL・相対パス・付与済みのものはそのまま。 */
export function withBase(path: string): string {
  if (!BASE || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === BASE || path.startsWith(`${BASE}/`)) return path;
  return BASE + path;
}

/** "/how-to-make-math/foo" → "/foo"。現在地の判定は、base を除いた形で行う。 */
export function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return "/";
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}
