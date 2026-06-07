import fs from "node:fs/promises";
import path from "node:path";

const OWNER = "MarianKang";
const REPO = "everyday-AI-newsletter-";
const BASE_URL = `https://${OWNER.toLowerCase()}.github.io/${REPO}/`;
const SOURCE_REPO = "zarazhangrui/follow-builders";
const SOURCE_BRANCH = "main";
const SOURCE_API = `https://api.github.com/repos/${SOURCE_REPO}/contents`;
const PUBLIC_DIR = ".";
const TIME_ZONE = "Asia/Shanghai";
const RECIPIENT = "kt951218@163.com";

const TOPICS = [
  {
    label: "Agent / 上下文层",
    keywords: ["agent", "agents", "gbrain", "openclaw", "hermes", "memory", "context", "mcp", "cowork", "claude", "codex"],
    title: "agent 产品继续往上下文、记忆和执行环境靠拢",
  },
  {
    label: "产品 / 工作流",
    keywords: ["product", "workflow", "figma", "cursor", "replit", "vercel", "shopify", "tool", "skills", "software", "build"],
    title: "产品和工作流更新仍在围绕“更快构建、更好交付”展开",
  },
  {
    label: "创业 / 生态",
    keywords: ["startup", "founder", "vc", "yc", "capital", "funding", "valuation", "company"],
    title: "创业生态里的速度、资本和长期建设仍在互相拉扯",
  },
  {
    label: "模型 / 基础设施",
    keywords: ["model", "llm", "gpu", "infra", "sandbox", "storage", "api", "eval", "fine-tuning", "token"],
    title: "模型与基础设施信号继续影响产品形态",
  },
];

function shanghaiParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const out = {};
  for (const part of parts) out[part.type] = part.value;
  return out;
}

function ymd(date) {
  const p = shanghaiParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function md(date) {
  const p = shanghaiParts(date);
  return `${Number(p.month)}月${Number(p.day)}日`;
}

function shanghaiWindow(now = new Date()) {
  const p = shanghaiParts(now);
  const end = new Date(`${p.year}-${p.month}-${p.day}T05:30:00.000Z`);
  if (now < end) end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);
  return { start, end };
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function truncate(text, max = 260) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function inWindow(value, window) {
  if (!value) return false;
  const date = new Date(value);
  return date >= window.start && date < window.end;
}

async function fetchGithubText(filePath) {
  const url = `${SOURCE_API}/${filePath}?ref=${SOURCE_BRANCH}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-builders-newsletter-cloud",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return Buffer.from(payload.content, "base64").toString("utf8");
}

async function fetchSourceJson(filePath) {
  return JSON.parse(await fetchGithubText(filePath));
}

function collectItems(feedX, feedPodcasts, feedBlogs, window) {
  const xItems = (feedX.x || []).flatMap((builder) =>
    (builder.tweets || [])
      .filter((tweet) => inWindow(tweet.createdAt, window))
      .map((tweet) => ({
        type: "x",
        sourceName: builder.name,
        handle: builder.handle,
        title: `${builder.name} 的 X 更新`,
        text: tweet.text,
        url: tweet.url,
        date: tweet.createdAt,
      })),
  );

  const podcastItems = (feedPodcasts.podcasts || [])
    .filter((episode) => inWindow(episode.publishedAt, window))
    .map((episode) => ({
      type: "podcast",
      sourceName: episode.name,
      title: episode.title,
      text: episode.transcript || episode.summary || "",
      url: episode.url,
      date: episode.publishedAt,
    }));

  const blogItems = (feedBlogs.blogs || [])
    .filter((post) => inWindow(post.publishedAt || post.date, window))
    .map((post) => ({
      type: "blog",
      sourceName: post.source || post.name || "Blog",
      title: post.title,
      text: post.summary || post.text || post.content || "",
      url: post.url,
      date: post.publishedAt || post.date,
    }));

  return {
    xItems: xItems.sort((a, b) => new Date(b.date) - new Date(a.date)),
    podcastItems: podcastItems.sort((a, b) => new Date(b.date) - new Date(a.date)),
    blogItems: blogItems.sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

function classify(items) {
  const used = new Set();
  const groups = [];

  for (const topic of TOPICS) {
    const matches = items.filter((item) => {
      const text = `${item.title} ${item.text}`.toLowerCase();
      return topic.keywords.some((keyword) => text.includes(keyword));
    });
    if (!matches.length) continue;
    for (const match of matches) used.add(match);
    groups.push({ ...topic, items: matches });
  }

  const other = items.filter((item) => !used.has(item));
  if (other.length) {
    groups.push({
      label: "其他 / 低信号",
      title: "还有一些更新更像补充信息，先保留但不强行解读",
      items: other,
    });
  }

  return groups;
}

function sourceAnchor(item, index) {
  return `${item.type}-${index + 1}`;
}

function renderThemeSummary(group, sourceMap) {
  const refs = group.items
    .slice(0, 5)
    .map((item) => `<a href="#${sourceMap.get(item)}">${escapeHtml(item.sourceName)}</a>`)
    .join("，");

  const examples = group.items
    .slice(0, 3)
    .map((item) => escapeHtml(truncate(item.text || item.title, 130)))
    .join(" / ");

  return `
      <div class="block">
        <span class="label">${escapeHtml(group.label)}</span>
        <h3>${escapeHtml(group.title)}</h3>
        <p>${examples || "这个主题在本窗口内有更新，但原始文本较短，适合先标记为观察项。"}</p>
        <p>为什么可能重要：这类更新能帮助你判断 AI 产品正在往哪里卷：是模型能力、agent 执行、产品体验，还是创业生态里的预期变化。这里先把线索摊开，不替你做最终判断。</p>
        <p class="meta">信息来源：${refs}</p>
      </div>`;
}

function renderItem(item, anchor) {
  const title = item.type === "x"
    ? `${item.sourceName}${item.handle ? ` (${item.handle} on X)` : ""}`
    : `${item.sourceName} - ${item.title}`;

  return `
        <div class="item" id="${anchor}">
          <p class="meta">${escapeHtml(formatDateTime(item.date))}</p>
          <h3>${escapeHtml(title)}</h3>
          <div class="quote">${escapeHtml(truncate(item.text || item.title, 520))}</div>
          <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">原始链接</a></p>
        </div>`;
}

function renderItems(items, emptyText, anchorPrefix) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }
  return items.map((item, index) => renderItem(item, `${anchorPrefix}-${index + 1}`)).join("\n");
}

function renderHtml({ date, window, xItems, podcastItems, blogItems }) {
  const allItems = [...xItems, ...podcastItems, ...blogItems];
  const sourceMap = new Map();
  xItems.forEach((item, index) => sourceMap.set(item, `x-${index + 1}`));
  podcastItems.forEach((item, index) => sourceMap.set(item, `podcast-${index + 1}`));
  blogItems.forEach((item, index) => sourceMap.set(item, `blog-${index + 1}`));
  const groups = classify(allItems);
  const title = `Everyday AI Newsletter｜${ymd(date)}`;
  const lede = allItems.length
    ? `这期覆盖 ${formatDateTime(window.start)} 到 ${formatDateTime(window.end)}。窗口内共有 ${xItems.length} 条 X 更新、${podcastItems.length} 条播客更新、${blogItems.length} 条博客更新。下面先按主题看变化，再按信息源展开明细。`
    : `这期覆盖 ${formatDateTime(window.start)} 到 ${formatDateTime(window.end)}。当前 feed 在这个窗口内没有抓到新更新，下面保留结构，方便你确认日报流程。`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --bg:#f6f7f4; --paper:#fff; --ink:#1f2933; --muted:#667085; --line:#d9ded6; --accent:#1769aa; --soft:#eef4f7; --note:#f7f1df; --green:#2f6f4e; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.72 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(900px, calc(100% - 28px)); margin: 0 auto; padding: 30px 0 48px; }
    header { padding: 10px 0 24px; border-bottom: 1px solid var(--line); }
    h1 { margin: 8px 0 12px; font-size: clamp(30px, 6vw, 48px); line-height: 1.08; letter-spacing: 0; }
    h2 { margin: 34px 0 12px; font-size: 23px; line-height: 1.3; letter-spacing: 0; }
    h3 { margin: 0 0 8px; font-size: 18px; line-height: 1.35; letter-spacing: 0; }
    p { margin: 0 0 13px; }
    a { color: var(--accent); text-underline-offset: 3px; }
    .meta { color: var(--muted); font-size: 14px; }
    .lede { max-width: 760px; font-size: 18px; }
    .note { margin-top: 18px; padding: 14px 16px; border: 1px solid #e5d7aa; border-radius: 8px; background: var(--note); color: #5b4b1f; }
    .toc { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .toc a { display: inline-block; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); font-size: 14px; text-decoration: none; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
    .metric, .block, .source { background: var(--paper); border: 1px solid var(--line); border-radius: 8px; }
    .metric { display: block; padding: 13px 14px; color: var(--ink); text-decoration: none; }
    .metric strong { display: block; font-size: 25px; line-height: 1.1; }
    .block, .source { padding: 18px; margin-top: 14px; }
    .label { display: inline-block; margin-bottom: 9px; color: var(--green); font-size: 13px; font-weight: 700; }
    .item { padding-top: 13px; margin-top: 13px; border-top: 1px solid var(--line); }
    .item:first-of-type { padding-top: 0; margin-top: 0; border-top: 0; }
    .quote { padding: 12px 14px; margin: 10px 0 12px; border-left: 4px solid #9ab7c9; background: var(--soft); color: #273746; }
    ul { margin: 8px 0 0; padding-left: 22px; }
    li { margin: 8px 0; }
    footer { margin-top: 34px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
    @media (max-width: 680px) { main { width: min(100% - 24px, 900px); padding-top: 22px; } .grid { grid-template-columns: 1fr; } .block, .source { padding: 15px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="meta">发送窗口：${escapeHtml(formatDateTime(window.start))} 至 ${escapeHtml(formatDateTime(window.end))}，Asia/Shanghai</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(lede)}</p>
      <div class="note">本页由 GitHub Actions 云端生成和发布，不依赖你的 Mac 是否开机或联网。</div>
      <nav class="toc" aria-label="日报目录">
        <a href="#what-happened">今天发生了什么</a>
        <a href="#source-overview">信息源更新概览</a>
        <a href="#product-signals">产品与观点线索</a>
        <a href="#watch-questions">可继续观察的问题</a>
      </nav>
      <div class="grid">
        <a class="metric" href="#x-updates"><strong>${xItems.length}</strong><span class="meta">X 更新的信息</span></a>
        <a class="metric" href="#podcasts"><strong>${podcastItems.length}</strong><span class="meta">播客</span></a>
        <a class="metric" href="#blogs"><strong>${blogItems.length}</strong><span class="meta">博客</span></a>
      </div>
    </header>

    <section id="what-happened">
      <h2>今天发生了什么</h2>
      ${groups.length ? groups.map((group) => renderThemeSummary(group, sourceMap)).join("\n") : '<div class="block"><p>本窗口暂无新内容。今天发生了什么这一节会在有更新时跨来源整理共同主题。</p></div>'}
    </section>

    <section id="source-overview">
      <h2>信息源更新概览</h2>
      <div class="source" id="x-updates"><span class="label">X 更新的信息</span>${renderItems(xItems, "本窗口暂无 X 更新。", "x")}</div>
      <div class="source" id="podcasts"><span class="label">播客</span>${renderItems(podcastItems, "本窗口暂无播客更新。", "podcast")}</div>
      <div class="source" id="blogs"><span class="label">博客</span>${renderItems(blogItems, "本窗口暂无博客更新。", "blog")}</div>
    </section>

    <section id="product-signals">
      <h2>产品与观点线索</h2>
      <div class="block">
        <ul>
          ${groups.length ? groups.map((group) => `<li><strong>${escapeHtml(group.label)}：</strong>${escapeHtml(group.title)}</li>`).join("\n") : "<li>暂无足够新内容形成产品线索。</li>"}
        </ul>
      </div>
    </section>

    <section id="watch-questions">
      <h2>可继续观察的问题</h2>
      <div class="block">
        <ul>
          <li>今天出现的 agent 或工作流信号，是一次性动态，还是会连续几天被不同来源提到？</li>
          <li>这些更新里提到的产品方向，是否对应明确用户场景，而不只是工具热度？</li>
          <li>如果某个主题连续出现，是否值得单独整理成自己的信息源标签？</li>
        </ul>
      </div>
    </section>

    <footer>
      <p>Generated through the Follow Builders skill: https://github.com/zarazhangrui/follow-builders</p>
    </footer>
  </main>
</body>
</html>`;
}

async function sendEmail({ title, url }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send email.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "AI Builders Digest <digest@resend.dev>",
      to: [RECIPIENT],
      subject: title,
      text: `${title}\n\n公网 HTML 链接：${url}\n\n这个链接可以在其他电脑和手机上打开。`,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Resend API error: ${body.message || response.status}`);
  }
}

async function main() {
  const now = new Date();
  const window = shanghaiWindow(now);
  const date = window.end;
  const dateSlug = ymd(date);
  const fileName = `ai-builders-digest-${dateSlug}.html`;
  const publicUrl = `${BASE_URL}${fileName}`;

  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchSourceJson("feed-x.json"),
    fetchSourceJson("feed-podcasts.json"),
    fetchSourceJson("feed-blogs.json"),
  ]);

  const { xItems, podcastItems, blogItems } = collectItems(feedX, feedPodcasts, feedBlogs, window);
  const html = renderHtml({ date, window, xItems, podcastItems, blogItems });
  const index = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0; url=${fileName}"><title>Everyday AI Newsletter</title></head><body><p><a href="${fileName}">打开最新一期</a></p></body></html>`;

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.writeFile(path.join(PUBLIC_DIR, fileName), html);
  await fs.writeFile(path.join(PUBLIC_DIR, "index.html"), index);

  if (process.env.SEND_EMAIL !== "false") {
    await sendEmail({ title: `Everyday AI Newsletter｜${ymd(date)}`, url: publicUrl });
  }

  console.log(publicUrl);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
