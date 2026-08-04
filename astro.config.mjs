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

// https://astro.build/config
export default defineConfig({
  // .mdx の中で <Theorem> などの部品を使えるようにする。
  // studio() は /studio（制作ページ）の保存・公開を dev サーバにだけ生やす部品で、
  // astro build の出力には一切入らない。
  integrations: [mdx(), studio()],
  // $…$（インライン）と $$…$$（ブロック）の数式を KaTeX で描画する。
  // 表示には KaTeX の CSS が必要（BaseLayout の <head> で読み込んでいる）。
  // 原稿はすべて素の KaTeX で書く（サイト独自マクロは定義しない）。
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [[rehypeKatex, { strict: false }], rehypeInChapterAds],
  },
});
