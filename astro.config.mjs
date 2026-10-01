// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import studio from './src/integrations/studio.ts';

/* rehypeInChapterAds — 各章（# と ##）の終わり＝次章タイトルの直前に、
   記事内広告のプレースホルダを自動で挟む rehype プラグイン。
   ・「章の区切り」は h1 / h2。最初の見出し（ページ題）の前には入れない。
   ・実際の広告タグは、生成される .ad-inline-slot の中に差し込めばよい。 */
function rehypeInChapterAds() {
  const adNode = () => ({
    type: 'element',
    tagName: 'aside',
    properties: { className: ['ad-inline'], 'aria-label': '広告' },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['ad-inline-slot'] },
        children: [{ type: 'text', value: '広告スペース' }],
      },
    ],
  });

  return (/** @type {any} */ tree) => {
    const out = [];
    let seenHeading = false;
    for (const node of tree.children) {
      const isChapterHead =
        node.type === 'element' && (node.tagName === 'h1' || node.tagName === 'h2');
      if (isChapterHead) {
        if (seenHeading) out.push(adNode()); // 直前の章の終わりに広告
        seenHeading = true;
      }
      out.push(node);
    }
    tree.children = out;
  };
}

/* サブフォルダ付きの URL（GitHub Pages: https://ユーザー.github.io/リポジトリ名/）で
   公開するときだけ、環境変数 SITE_BASE / SITE_URL を入れてビルドする。
   未指定（ふだんの npm run dev・npm run build）では、これまでどおり / 直下で動く。 */
const SITE_BASE = (process.env.SITE_BASE ?? '').replace(/\/$/, '');
const SITE_URL = process.env.SITE_URL || undefined;

/* rehypeBaseLinks — 本文の「/ から始まるリンク・画像」の前に SITE_BASE を付ける。
   本文には [文](/linear-algebra/3) のような書き方が多いので、1つずつ直さずビルド時に変換する。
   Markdown 由来の a / img と、MDX の JSX（<a href="/…">）の両方を対象にする。 */
function rehypeBaseLinks() {
  const prefix = (/** @type {unknown} */ v) =>
    typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') &&
    v !== SITE_BASE && !v.startsWith(SITE_BASE + '/')
      ? SITE_BASE + v
      : v;

  const walk = (/** @type {any} */ node) => {
    if (node.type === 'element' && node.properties) {
      if (node.tagName === 'a' || node.tagName === 'link') node.properties.href = prefix(node.properties.href);
      if (node.tagName === 'img' || node.tagName === 'source') node.properties.src = prefix(node.properties.src);
    }
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.attributes) {
      for (const attr of node.attributes) {
        if (attr.type === 'mdxJsxAttribute' && (attr.name === 'href' || attr.name === 'src')) {
          attr.value = prefix(attr.value);
        }
      }
    }
    if (node.children) node.children.forEach(walk);
  };
  return (/** @type {any} */ tree) => walk(tree);
}

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  base: SITE_BASE || undefined,
  // .mdx の中で <Theorem> などの部品を使えるようにする。
  // studio() は /studio（制作ページ）の保存・公開を dev サーバにだけ生やす部品で、
  // astro build の出力には一切入らない。
  integrations: [mdx(), studio()],
  // $…$（インライン）と $$…$$（ブロック）の数式を KaTeX で描画する。
  // 表示には KaTeX の CSS が必要（BaseLayout の <head> で読み込んでいる）。
  // 原稿はすべて素の KaTeX で書く（サイト独自マクロは定義しない）。
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeKatex, { strict: false }],
      rehypeInChapterAds,
      ...(SITE_BASE ? [rehypeBaseLinks] : []),
    ],
  },
});
