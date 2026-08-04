/* /search-index.json — 検索の「一段目」。ページ題・分野・概要・見出しだけの軽い索引。
   数KB しかないので、検索窓を開いた瞬間に届く。本文は /search-body.json（二段目）。
   キーを1文字にしているのは転送量を削るため（h=href, t=title, s=section, b=badge,
   d=description, g=headings）。 */
import type { APIRoute } from "astro";
import { searchDocs } from "../config/searchIndex";

const payload = JSON.stringify({
  docs: searchDocs.map((doc) => ({
    h: doc.href,
    t: doc.title,
    s: doc.section,
    b: doc.badge,
    d: doc.desc,
    g: doc.heads,
  })),
});

export const GET: APIRoute = () =>
  new Response(payload, {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
