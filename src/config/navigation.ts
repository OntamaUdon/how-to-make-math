export interface NavLink {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  badge?: string;
  href?: string;
  items: NavLink[];
  /** true なら「隠し部」。目次・ホームの地図・検索・前後送りの連鎖に出さない。
      URL を直接開いた人だけが読める（中のパンくずとページ送りは普通に効く）。 */
  hidden?: boolean;
}

interface SectionDef {
  dir: string;
  title: string;
  badge?: string;
  hidden?: boolean;
}

const sections: SectionDef[] = [
  // ── 解析 ──
  { dir: "/calculus", title: "微分積分学", badge: "解析" },
  { dir: "/complex-analysis", title: "複素解析", badge: "解析" },
  { dir: "/differential-equations", title: "微分方程式", badge: "解析" },
  { dir: "/measure-theory", title: "測度論・ルベーグ積分", badge: "解析" },
  { dir: "/functional-analysis", title: "関数解析", badge: "解析" },
  { dir: "/fourier-analysis", title: "実解析・フーリエ解析", badge: "解析" },
  { dir: "/probability", title: "確率論", badge: "解析" },
  { dir: "/pde-advanced", title: "偏微分方程式（発展）", badge: "解析" },
  { dir: "/calculus-of-variations", title: "変分法", badge: "解析" },
  // ── 代数 ──
  { dir: "/linear-algebra", title: "線形代数学", badge: "代数" },
  { dir: "/group-theory", title: "群論", badge: "代数" },
  { dir: "/ring-theory", title: "環論", badge: "代数" },
  { dir: "/field-and-galois", title: "体論・ガロア理論", badge: "代数" },
  { dir: "/module-theory", title: "加群論", badge: "代数" },
  { dir: "/representation-theory", title: "表現論", badge: "代数" },
  { dir: "/commutative-homological", title: "可換環論・ホモロジー代数", badge: "代数" },
  { dir: "/algebraic-number-theory", title: "代数的整数論", badge: "代数" },
  { dir: "/noncommutative-lie", title: "非可換環・リー環", badge: "代数" },
  // ── 幾何 ──
  { dir: "/manifolds", title: "多様体論", badge: "幾何" },
  { dir: "/algebraic-topology", title: "位相幾何学", badge: "幾何" },
  { dir: "/differential-geometry", title: "微分幾何学", badge: "幾何" },
  { dir: "/lie-groups", title: "リー群", badge: "幾何" },
  { dir: "/riemannian-geometry", title: "リーマン幾何学", badge: "幾何" },
  { dir: "/algebraic-geometry", title: "代数幾何学", badge: "幾何" },
  { dir: "/differential-topology", title: "微分位相幾何学", badge: "幾何" },
  { dir: "/complex-geometry", title: "複素幾何学", badge: "幾何" },
  { dir: "/symplectic-geometry", title: "シンプレクティック幾何学", badge: "幾何" },
  // ── 基礎 ──
  { dir: "/set-topology", title: "集合と位相", badge: "基礎" },
  { dir: "/logic-foundations", title: "数理論理学・数学基礎論", badge: "基礎" },
  { dir: "/category-theory", title: "圏論", badge: "基礎" },
  // ── 番外（隠し部） ──
  // 目次には載せない。URL を知っている人だけが読める番外編。
  { dir: "/godot", title: "Godotの使い方", badge: "ゲーム制作", hidden: true },
  { dir: "/github-claude", title: "GitHubとClaudeの使い方", badge: "開発", hidden: true },
];

/** 隠し部のディレクトリ（"/godot" など）。検索の索引づくりが参照する。 */
export const hiddenDirs: string[] = sections
  .filter((section) => section.hidden)
  .map((section) => section.dir);

/** その URL が隠し部のページかどうか */
export function isHiddenHref(href: string): boolean {
  return hiddenDirs.some((dir) => href === dir || href.startsWith(`${dir}/`));
}

interface PageFrontmatter {
  title?: string;
  navTitle?: string;
}

const rawPages = import.meta.glob("/src/pages/**/*.{md,mdx}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function parseFrontmatter(raw: string): PageFrontmatter {
  const fm: PageFrontmatter = {};
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!block) return fm;

  for (const line of block[1].split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][\w]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;

    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (key === "navTitle") fm.navTitle = value;
    if (key === "title") fm.title = value;
  }

  return fm;
}

function orderFromPath(filePath: string): number {
  const name = filePath.replace(/^.*\//, "").replace(/\.(md|mdx)$/, "");
  return /^\d+$/.test(name) ? Number(name) : Number.MAX_SAFE_INTEGER;
}

function pathToHref(filePath: string): string {
  const href = filePath
    .replace(/^\/src\/pages/, "")
    .replace(/\.(md|mdx)$/, "")
    .replace(/\/index$/, "");
  return href === "" ? "/" : href;
}

function dirFromPath(filePath: string): string {
  return filePath.replace(/^\/src\/pages/, "").replace(/\/[^/]+\.(md|mdx)$/, "") || "/";
}

interface Article {
  href: string;
  title: string;
  dir: string;
  isIndex: boolean;
  order: number;
}

const articles: Article[] = Object.entries(rawPages).map(([path, raw]) => {
  const fm = parseFrontmatter(raw);
  return {
    href: pathToHref(path),
    title: fm.navTitle ?? fm.title ?? pathToHref(path),
    dir: dirFromPath(path),
    isIndex: /\/index\.(md|mdx)$/.test(path),
    order: orderFromPath(path),
  };
});

export const siteNav: NavSection[] = sections
  .map((section) => {
    const inDir = articles.filter((article) => article.dir === section.dir);
    const items = inDir
      .filter((article) => !article.isIndex)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ja"))
      .map((article) => ({ title: article.title, href: article.href }));
    const href = inDir.find((article) => article.isIndex)?.href;

    return { title: section.title, badge: section.badge, href, items, hidden: section.hidden };
  })
  .filter((section) => section.items.length > 0 || section.href);

/** 目次に出してよい部だけ（隠し部を除いたもの）。SiteNav はこちらを使う。 */
export const visibleNav: NavSection[] = siteNav.filter((section) => !section.hidden);

const normalize = (path: string): string =>
  path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;

export function isCurrent(href: string, pathname: string): boolean {
  return normalize(href) === normalize(pathname);
}

export function flattenPages(nav: NavSection[] = siteNav): NavLink[] {
  return nav.filter((section) => !section.hidden).flatMap((section) => section.items);
}

export function findLocation(pathname: string, nav: NavSection[] = siteNav) {
  for (const section of nav) {
    const page = section.items.find((item) => isCurrent(item.href, pathname));
    if (page) return { section, page };

    if (section.href && isCurrent(section.href, pathname)) {
      return { section, page: undefined };
    }
  }

  return { section: undefined, page: undefined };
}

export function getAdjacentPages(pathname: string, nav: NavSection[] = siteNav) {
  // 隠し部のページは全体の流れに混ぜない（前の分野の最終章から続いて見えてしまう）。
  // その部の中だけで前後を作る。
  const hiddenOwner = nav.find(
    (section) => section.hidden && section.items.some((item) => isCurrent(item.href, pathname))
  );
  const pages = hiddenOwner ? hiddenOwner.items : flattenPages(nav);
  const index = pages.findIndex((page) => isCurrent(page.href, pathname));

  return {
    prev: index > 0 ? pages[index - 1] : undefined,
    next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : undefined,
  };
}
