/* searchIndex.ts — サイト内ワード検索の索引を「ビルド時に」作る。
   ・.mdx の生テキストから 数式・JSX・Markdown記法 を落として、本文のプレーンテキストにする。
   ・分野名／バッジは navigation.ts の siteNav から引くので、分野を足せば索引にも自動で載る。
   ・二段構え：軽い「見出し索引」(/search-index.json) と重い「本文索引」(/search-body.json) を
     別々のエンドポイントに出す。どちらも下の searchDocs から作るので順番は必ず一致する。
   ・このファイルを読むのはサーバ側（エンドポイント）だけ。生テキストがブラウザに渡ることはない。 */
import { siteNav, isHiddenHref } from "./navigation";

const rawPages = import.meta.glob("/src/pages/**/*.{md,mdx}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** 索引 1 件ぶん（= 1 ページ） */
export interface SearchDoc {
  /** リンク先。例: /calculus/1 */
  href: string;
  /** ページ題（frontmatter の title） */
  title: string;
  /** 分野名。例: 微分積分学 */
  section: string;
  /** 分野のバッジ。例: 解析 */
  badge: string;
  /** frontmatter の description */
  desc: string;
  /** ページ内の見出し（h1〜h3。ページ題と同じものは除く） */
  heads: string[];
  /** 本文のプレーンテキスト */
  body: string;
}

/** MDX の生テキストを、検索に使えるプレーンテキストへ均す。
    数式は KaTeX の命令だらけでノイズにしかならないので丸ごと落とす。 */
function toPlainText(src: string): string {
  let s = src;
  s = s.replace(/^---\r?\n[\s\S]*?\r?\n---/, " "); // frontmatter
  s = s.replace(/```[\s\S]*?```/g, " "); // コードブロック（先に消す。中に < > があるため）
  s = s.replace(/^[ \t]*import\s.+$/gm, " "); // MDX の import 行
  s = s.replace(/\$\$[\s\S]*?\$\$/g, " "); // ブロック数式
  s = s.replace(/\$[^$\n]*\$/g, " "); // インライン数式
  s = s.replace(/<[^>]*>/g, " "); // JSX/HTML のタグ（囲まれた文字は残る）
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // 画像
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // リンクは文字だけ残す
  s = s.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, " "); // 見出し記号
  s = s.replace(/^[ \t]{0,3}>[ \t]?/gm, " "); // 引用記号
  s = s.replace(/^[ \t]{0,3}(?:[-*+]|\d+\.)[ \t]+/gm, " "); // 箇条書き記号
  s = s.replace(/^[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, " "); // 水平線
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1"); // 強調（** と *）
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/`([^`\n]*)`/g, "$1"); // インラインコード
  s = s.replace(/\|/g, " "); // 表の区切り
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** frontmatter から title / description を拾う（navigation.ts と同じ素朴な読み方） */
function readFrontmatter(raw: string): { title: string; description: string } {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!block) return { title: "", description: "" };

  let title = "";
  let description = "";
  for (const line of block[1].split(/\r?\n/)) {
    const match = /^\s*(title|description)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (match[1] === "title") title = value;
    else description = value;
  }
  return { title, description };
}

/** ページ内の見出し（# 〜 ###）を本文から拾う */
function readHeadings(raw: string): string[] {
  const body = raw
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, "")
    .replace(/```[\s\S]*?```/g, "");

  const out: string[] = [];
  for (const m of body.matchAll(/^[ \t]{0,3}#{1,3}[ \t]+(.+)$/gm)) {
    const text = toPlainText(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function pathToHref(filePath: string): string {
  const href = filePath
    .replace(/^\/src\/pages/, "")
    .replace(/\.(md|mdx)$/, "")
    .replace(/\/index$/, "");
  return href === "" ? "/" : href;
}

/** href → その分野の { 分野名, バッジ } を引く表を、siteNav から作る */
const sectionByHref = new Map<string, { section: string; badge: string }>();
for (const section of siteNav) {
  const label = { section: section.title, badge: section.badge ?? "" };
  if (section.href) sectionByHref.set(section.href, label);
  for (const item of section.items) sectionByHref.set(item.href, label);
}

/** siteNav に載らないページの見出し。/standalone は分野に属さない一話完結の記事 */
function labelFor(href: string): { section: string; badge: string } {
  const known = sectionByHref.get(href);
  if (known) return known;
  if (href.startsWith("/standalone/")) return { section: "一話完結", badge: "記事" };
  return { section: "", badge: "" };
}

/** 全ページの索引。/search-index.json と /search-body.json は
    どちらもこの配列をそのままの順で出すので、添字で対応が取れる。 */
export const searchDocs: SearchDoc[] = Object.entries(rawPages)
  // 隠し部（navigation.ts で hidden: true）は索引に入れない。
  // 目次にも検索にも出さず、URL を直接開いた人だけが読む扱いにする。
  .filter(([filePath]) => !isHiddenHref(pathToHref(filePath)))
  .map(([filePath, raw]): SearchDoc => {
    const href = pathToHref(filePath);
    const { title, description } = readFrontmatter(raw);
    const label = labelFor(href);
    const allHeads = readHeadings(raw);
    const heads = allHeads.filter((h) => h !== title);

    // 本文の先頭はページ題（h1）なので落とす。残すと検索結果で
    // 題名と抜粋に同じ文字列が二重に出てしまう。
    let body = toPlainText(raw);
    if (allHeads[0] && body.startsWith(allHeads[0])) {
      body = body.slice(allHeads[0].length).trim();
    }

    return {
      href,
      title: title || href,
      section: label.section,
      badge: label.badge,
      desc: description,
      heads,
      body,
    };
  })
  .sort((a, b) => a.href.localeCompare(b.href));
