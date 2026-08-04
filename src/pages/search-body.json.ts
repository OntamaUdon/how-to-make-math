/* /search-body.json — 検索の「二段目」。全ページの本文プレーンテキスト。
   /search-index.json と同じ searchDocs から同じ順で出しているので、添字がそのまま対応する。
   数式を落としても全体で 2MB 強あるため、検索窓を開いたときに裏で読み込み、
   届いた時点で本文ヒットを結果に足す（それまでは見出し索引だけで検索する）。 */
import type { APIRoute } from "astro";
import { searchDocs } from "../config/searchIndex";

const payload = JSON.stringify({ bodies: searchDocs.map((doc) => doc.body) });

export const GET: APIRoute = () =>
  new Response(payload, {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
