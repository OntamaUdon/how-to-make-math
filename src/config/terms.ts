/* =============================================================
   terms.ts — 用語集（pages/terms/<語>.mdx）の自動レジストリ。
   ・pages/terms/ に「<語>.mdx」を置くと、本文の <Term>その語</Term> が
     自動でその詳細ページへのリンクになる（手動の登録は不要）。
   ・ファイル名（拡張子を除いた部分）＝用語名 として突き合わせる。
   ============================================================= */

/** pages/terms 配下の用語ページを列挙（中身は評価しないので循環 import にならない） */
const termFiles = import.meta.glob("/src/pages/terms/*.{md,mdx}");

/** 詳細ページがある用語名の集合（"/src/pages/terms/文字.mdx" → "文字"） */
const termSet = new Set(
  Object.keys(termFiles).map((path) =>
    path.replace(/^.*\/terms\//, "").replace(/\.(md|mdx)$/, "")
  )
);

/** その用語に詳細ページがあれば URL を返す（無ければ undefined） */
export function termHref(term: string): string | undefined {
  return termSet.has(term) ? `/terms/${encodeURIComponent(term)}` : undefined;
}
