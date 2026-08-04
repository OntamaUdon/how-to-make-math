/* studio.ts — 制作ページ（/studio）の裏方。
   このサイトは静的（アダプタ無し）なので API ルートが使えない。代わりに
   astro:server:setup で「dev サーバにだけ」ミドルウェアを生やしている。
   ＝ astro build の成果物には一切含まれない。本番の /studio はプレビュー専用。

   使えるのは次の5つ（すべて /__studio/ 配下）:
     GET  /list            src/pages 配下の .mdx 一覧
     GET  /read?rel=…      1ファイルの生テキスト
     POST /save            書き込み（新規 or 上書き。上書き時は .bak を残す）
     POST /publish         npm run build → wrangler pages deploy をローカル実行
     GET  /publish-status  上の進捗ログ（差分ポーリング）

   安全策：書き込み先は src/pages 配下の .md / .mdx に限定し、`..` は弾く。 */
import type { AstroIntegration } from "astro";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

/** wrangler の公開先。cloudflare-pages-deploy の運用に合わせてある */
const PROJECT_NAME = "how-to-make-math";
const DEPLOY_BRANCH = "main";

interface PublishJob {
  status: "idle" | "building" | "deploying" | "done" | "error";
  lines: string[];
  url: string;
  startedAt: number;
}

const job: PublishJob = { status: "idle", lines: [], url: "", startedAt: 0 };

export default function studio(): AstroIntegration {
  let root = process.cwd();

  return {
    name: "studio",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = path.resolve(config.root.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      },

      "astro:server:setup": ({ server, logger }) => {
        const pagesRoot = path.join(root, "src", "pages");

        /** src/pages の中の .md / .mdx だけを指すことを保証する */
        const resolveSafe = (rel: string): string | null => {
          if (typeof rel !== "string" || rel === "") return null;
          const abs = path.resolve(pagesRoot, rel);
          if (abs !== pagesRoot && !abs.startsWith(pagesRoot + path.sep)) return null;
          if (!/\.mdx?$/.test(abs)) return null;
          return abs;
        };

        const send = (res: ServerResponse, code: number, body: unknown): void => {
          res.statusCode = code;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };

        const readBody = async (req: IncomingMessage): Promise<any> => {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const text = Buffer.concat(chunks).toString("utf8");
          return text ? JSON.parse(text) : {};
        };

        /** frontmatter から title だけ拾う（一覧の表示用） */
        const titleOf = (raw: string): string => {
          const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
          const line = block && /^title:\s*(.*)$/m.exec(block[1]);
          return line ? line[1].trim().replace(/^["']|["']$/g, "") : "";
        };

        const listPages = async (dir: string, out: any[] = []): Promise<any[]> => {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              await listPages(abs, out);
            } else if (/\.mdx?$/.test(entry.name)) {
              const rel = path.relative(pagesRoot, abs).split(path.sep).join("/");
              const raw = await readFile(abs, "utf8");
              const name = entry.name.replace(/\.mdx?$/, "");
              out.push({
                rel,
                dir: "/" + (path.dirname(rel) === "." ? "" : path.dirname(rel)),
                order: /^\d+$/.test(name) ? Number(name) : null,
                isIndex: name === "index",
                title: titleOf(raw),
              });
            }
          }
          return out;
        };

        // ── 公開（build → deploy）をローカルで実行する ──────────────
        const run = (command: string, args: string[]): Promise<number> =>
          new Promise((resolve) => {
            const child = spawn(command, args, { cwd: root, shell: true });
            const push = (buf: Buffer) => {
              for (const line of buf.toString("utf8").split(/\r?\n/)) {
                if (line.trim()) job.lines.push(line.replace(/\[[0-9;]*m/g, ""));
              }
              if (job.lines.length > 4000) job.lines.splice(0, job.lines.length - 4000);
            };
            child.stdout.on("data", push);
            child.stderr.on("data", push);
            child.on("close", (code) => resolve(code ?? 1));
            child.on("error", (err) => {
              job.lines.push(String(err));
              resolve(1);
            });
          });

        const publish = async (): Promise<void> => {
          job.status = "building";
          job.lines = ["$ npm run build"];
          job.url = "";
          job.startedAt = Date.now();

          if ((await run("npm", ["run", "build"])) !== 0) {
            job.lines.push("ビルドに失敗しました。公開は中止です。");
            job.status = "error";
            return;
          }

          job.status = "deploying";
          job.lines.push("", `$ wrangler pages deploy dist --project-name=${PROJECT_NAME}`);
          const code = await run("npx", [
            "wrangler",
            "pages",
            "deploy",
            "dist",
            `--project-name=${PROJECT_NAME}`,
            `--branch=${DEPLOY_BRANCH}`,
            "--commit-dirty=true",
          ]);

          if (code !== 0) {
            job.lines.push("公開に失敗しました。");
            job.status = "error";
            return;
          }

          const hit = job.lines.join("\n").match(/https:\/\/[\w.-]+\.pages\.dev/g);
          job.url = hit ? hit[hit.length - 1] : `https://${PROJECT_NAME}.pages.dev`;
          job.status = "done";
        };

        // ── ルーティング ────────────────────────────────────────────
        server.middlewares.use("/__studio", (req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const route = url.pathname.replace(/\/$/, "");

          void (async () => {
            try {
              if (route === "/list" && req.method === "GET") {
                return send(res, 200, { pages: await listPages(pagesRoot) });
              }

              if (route === "/read" && req.method === "GET") {
                const abs = resolveSafe(url.searchParams.get("rel") ?? "");
                if (!abs || !existsSync(abs)) return send(res, 404, { error: "見つかりません" });
                return send(res, 200, { content: await readFile(abs, "utf8") });
              }

              if (route === "/save" && req.method === "POST") {
                const body = await readBody(req);
                const abs = resolveSafe(body.rel);
                if (!abs) return send(res, 400, { error: "保存先が不正です（src/pages 配下の .mdx のみ）" });

                const exists = existsSync(abs);
                if (body.mode === "create" && exists) {
                  return send(res, 409, { error: "同じ名前のファイルが既にあります" });
                }
                if (typeof body.content !== "string" || body.content.trim() === "") {
                  return send(res, 400, { error: "中身が空です" });
                }

                // 上書きの前に .bak を残す（取り返しがつくように）
                let backup = "";
                if (exists) {
                  backup = `${abs}.bak`;
                  await copyFile(abs, backup);
                }
                await mkdir(path.dirname(abs), { recursive: true });
                await writeFile(abs, body.content, "utf8");
                logger.info(`保存しました: src/pages/${body.rel}`);

                const info = await stat(abs);
                return send(res, 200, {
                  ok: true,
                  bytes: info.size,
                  backup: backup ? path.basename(backup) : "",
                });
              }

              if (route === "/publish" && req.method === "POST") {
                if (job.status === "building" || job.status === "deploying") {
                  return send(res, 409, { error: "すでに実行中です" });
                }
                void publish();
                return send(res, 200, { started: true });
              }

              if (route === "/publish-status" && req.method === "GET") {
                const since = Number(url.searchParams.get("since") ?? 0) || 0;
                return send(res, 200, {
                  status: job.status,
                  url: job.url,
                  total: job.lines.length,
                  lines: job.lines.slice(since),
                });
              }

              next();
            } catch (error) {
              logger.error(String(error));
              send(res, 500, { error: String(error) });
            }
          })();
        });

        logger.info("制作ページを有効にしました → http://localhost:4321/studio");
      },
    },
  };
}
