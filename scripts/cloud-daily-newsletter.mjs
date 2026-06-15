import fs from "node:fs/promises";
import path from "node:path";

const OWNER = "MarianKang";
const REPO = "everyday-AI-newsletter-";
const BASE_URL = `https://${OWNER.toLowerCase()}.github.io/${REPO}/`;
const SOURCE_REPO = "zarazhangrui/follow-builders";
const SOURCE_BRANCH = "main";
const SOURCE_RAW = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}`;
const PUBLIC_DIR = ".";
const ARCHIVE_DIR = "archive";
const STATE_FILE = "newsletter-state.json";
const TIME_ZONE = "Asia/Shanghai";
const RECIPIENT = "kt951218@163.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const TOPICS = [
  {
    label: "模型路由与成本效率",
    keywords: ["routing", "token", "cost", "evals", "quality/cost", "cheapest model", "right model", "model diversity", "open-weight"],
    title: "模型路由正在从工程细节变成应用层产品能力",
    why: "当企业真正开始大规模使用大语言模型，成本和质量的取舍就会变成产品问题。谁能知道某个任务该用强模型、便宜模型还是开源模型，谁就能在效果和成本之间做出更好的产品设计。",
  },
  {
    label: "智能体与开发工作流",
    keywords: ["agent", "agents", "agentic", "codex", "paxel", "vibe", "coding", "threads", "approval", "local models"],
    title: "智能体编码和开发工作流继续变得更上头，也更需要管理界面",
    why: "这类更新说明，开发者不是只在尝鲜，而是在真的把智能体放进日常工作。新的问题随之出现：线程怎么管理、任务怎么筛选、本地与云端边界怎么解释、哪些步骤该交给模型。产品机会会从“能不能生成代码”转向“能不能把复杂工作流管顺”。",
  },
  {
    label: "内容形态与创作者互动",
    keywords: ["static content", "live interaction", "conference", "research paper", "publishing", "human being", "raw", "opinionated", "taste", "mastery", "preference"],
    title: "内容和产品判断里，taste 正在变成一种需要训练的能力",
    why: "这条线索和产品有关：当 AI 让生成变便宜，真正稀缺的可能变成判断力、品味和选择能力。内容、软件、会议和社区都会更依赖背后的人如何筛选、组织和表达。",
  },
  {
    label: "创业、世界模型与生态关系",
    keywords: ["world models", "world model", "startup", "company", "investors", "stealth", "ceo", "latency", "vc", "gaza", "local government"],
    title: "创业生态里既有世界模型的新公司故事，也有资本与价值观的摩擦",
    why: "这些内容不是纯产品发布，但会影响创业者如何选择方向、投资人和团队。尤其是世界模型、低延迟、游戏与三维生成这些关键词，可能会成为下一批空间智能产品的基础。",
  },
];

const MANUAL_SUMMARIES = {
  "2063491534339936584": "Peter Yang 发了一条简短的晚安动态，信息量较低，保留为窗口内更新。",
  "2063486871037153558": "Peter Yang 调侃智能体编码非常容易让人上头，甚至比游戏还让人停不下来。可以看成开发者对智能体编程体验的真实反馈。",
  "2063475353335869922": "Peter Yang 希望 Codex 线程能支持更多筛选和排序方式，例如查看所有等待批准的任务、所有正在运行的任务，而不只是按项目分组。",
  "2063438262841094604": "Dan Shipper 借柏拉图对技艺、敬畏和正义的讨论，延伸到大语言模型：知识从哪里来、德性是否能被教授，这些古典问题又被新技术重新打开。",
  "2063436919967522848": "Dan Shipper 补充说，敬畏他人和判断何为正确的能力会变得更重要。这是在把技术能力和人类判断放在一起讨论。",
  "2063432747432268259": "Swyx 认为，研究论文和实验室公开发布的吸引力下降，部分原因是研究者可以带着隐性知识直接创业。他也提到想把 AI Engineer 做成更偏产品的行业会议。",
  "2063426632824562167": "Dan Shipper 用一句话表达对大语言模型意识问题的暧昧态度：既不能简单说有意识，也不能简单说完全没有意识。",
  "2063418130714800487": "Garry Tan 澄清 Paxel 的数据边界：他们没有说完全不上传用户数据，而是说代码文件内容不会上传。随着本地模型变强，更多能力有机会在本地完成。",
  "2063409501706018903": "Garry Tan 表示希望 Paxel 帮助人们变得更专业、更像真正的建设者。",
  "2063391758189572266": "Zara Zhang 赞同一个观点：静态内容的价值在下降，实时互动的价值在上升。用户想连接作品背后真实的人，偏原始、有观点的表达比精致但泛化的内容更有吸引力。",
  "2063381764782116914": "Nikunj Kothari 发了一条周末提醒，建议大家出去走走、接触现实世界。信息量不高，但保留为窗口内更新。",
  "2063344460705288401": "Amjad Masad 谈到自己公开表达政治立场后，一些投资人试图施压，也有更好的投资人支持他。他的重点是：坚持信念会筛掉不合适的人。",
  "2063342268472574268": "Madhu Guru 详细解释模型路由为什么难：要把不同任务匹配到合适模型，需要针对产品任务做评测，并平衡质量和成本。他把企业采用模型的过程分成三个阶段：先默认用热门模型，再过度追求便宜模型，最后走向更细致的任务路由。",
  "2063320673217609936": "Aaron Levie 认为 token 成本已经成为企业 AI 的热门话题，这反而说明系统正在被大规模使用。他认为应用层 AI 的差异化会越来越来自模型路由、领域工作流理解和评测能力。",
  "2063300737296400516": "Amjad Masad 提到 Vibecon，像是围绕 vibe coding 或建设者社区的活动动态。",
  "2063280482922663980": "Garry Tan 谈到地方治理，认为 Oakland 的管理问题可以修复，但还缺少类似旧金山那样的常识回归。这条偏公共事务，和 AI 产品关联较弱。",
  "2063263389238087745": "Nikunj Kothari 发布了一期访谈目录，主题包括世界模型、从文本到三维的创业起点、为什么创办公司、游戏和编程经历、低延迟的重要性、成为 CEO 和扩展团队等。",
  "2066036778713362747": "Zara Zhang 推荐了一篇关于 taste 如何培养的文章。她摘出的重点是：品味不只是个人偏好，好的品味需要掌握能力和长期经验。这条更偏产品判断和创作者判断力，而不是单纯信息更新。",
  "2066034464120345075": "Peter Yang 发了一条非常短的 YOLO 动态并附了链接，原文信息量较低，先作为窗口内补充更新保留。",
};

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
  const end = new Date(`${p.year}-${p.month}-${p.day}T05:10:00.000Z`);
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

function itemId(item) {
  return String(item.url || "").split("/").pop();
}

function chineseSummary(item) {
  const manual = MANUAL_SUMMARIES[itemId(item)];
  if (manual) return manual;

  const text = `${item.title} ${item.text}`.toLowerCase();
  if (text.includes("routing") || text.includes("token") || text.includes("model")) {
    return `${item.sourceName} 讨论了模型选择、成本或任务路由问题，重点是如何在质量、速度和价格之间做取舍。`;
  }
  if (text.includes("agent") || text.includes("codex") || text.includes("coding")) {
    return `${item.sourceName} 提到了智能体或编码工作流相关体验，适合放进开发工具和自动化产品线索里观察。`;
  }
  if (text.includes("startup") || text.includes("founder") || text.includes("investor") || text.includes("company")) {
    return `${item.sourceName} 更新了创业或团队建设相关内容，可能和 AI 创业生态的节奏、融资和组织判断有关。`;
  }
  if (item.type === "podcast") {
    return `${item.sourceName} 发布了新播客，主题是 ${item.title}。`;
  }
  if (item.type === "blog") {
    return `${item.sourceName} 发布了新文章，主题是 ${item.title}。`;
  }
  return `${item.sourceName} 有一条窗口内更新，原文信息较短，先作为补充动态保留。`;
}

function compactItem(item, index) {
  return {
    id: sourceAnchor(item, index),
    type: item.type,
    sourceName: item.sourceName,
    title: item.title,
    date: formatDateTime(item.date),
    url: item.url,
    text: truncate(item.text, item.type === "podcast" ? 1800 : 900),
  };
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("DeepSeek response was not JSON.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function themeMatchesSourceText(theme, items) {
  const heading = `${theme.label || ""} ${theme.title || ""}`;
  const sourceText = items.map((item) => `${item.title || ""} ${item.text || ""}`).join(" ").toLowerCase();
  if (/智能体|开发|工作流|编程|代码/.test(heading)) {
    return /agent|codex|coding|workflow|developer|智能体|编程|代码|工作流/.test(sourceText);
  }
  if (/模型|路由|成本|词元|评测/.test(heading)) {
    return /model|routing|route|token|cost|eval|模型|路由|成本|词元|评测/.test(sourceText);
  }
  return true;
}

function validateModelDigest(value, compactItems = []) {
  if (!value || typeof value !== "object") throw new Error("DeepSeek digest JSON is not an object.");
  if (typeof value.lede !== "string") throw new Error("DeepSeek digest JSON missing lede.");
  if (!Array.isArray(value.themes)) throw new Error("DeepSeek digest JSON missing themes.");
  if (!Array.isArray(value.itemSummaries)) throw new Error("DeepSeek digest JSON missing itemSummaries.");
  if (!Array.isArray(value.productSignals)) value.productSignals = [];
  if (!Array.isArray(value.watchQuestions)) value.watchQuestions = [];
  const itemsById = new Map(compactItems.map((item) => [item.id, item]));
  const usedIds = new Set();
  value.themes = value.themes
    .map((theme) => {
      const sourceIds = [...new Set(theme?.sourceIds || [])]
        .filter((id) => itemsById.has(id) && !usedIds.has(id));
      const sourceItems = sourceIds.map((id) => itemsById.get(id));
      if (!sourceIds.length || !themeMatchesSourceText(theme, sourceItems)) return null;
      for (const id of sourceIds) usedIds.add(id);
      return { ...theme, sourceIds };
    })
    .filter(Boolean)
    .slice(0, 6);
  return value;
}

async function generateModelDigest({ window, xItems, podcastItems, blogItems }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const compactItems = [
    ...xItems.map(compactItem),
    ...podcastItems.map(compactItem),
    ...blogItems.map(compactItem),
  ];
  const prompt = {
    window: `${formatDateTime(window.start)} 至 ${formatDateTime(window.end)} Asia/Shanghai`,
    requirements: [
      "输出必须是简体中文。正文里尽量不要保留英文技术词：agent 写作“智能体”，LLM 写作“大语言模型”，token 写作“词元”，evals 写作“评测”。",
      "人名、公司名、产品名、X、URL 可以保留英文；标题由系统固定使用 Everyday AI Newsletter｜YYYY-MM-DD。",
      "标题不需要生成，标题固定由系统使用 Everyday AI Newsletter｜YYYY-MM-DD。",
      "lede 是标题下方的本期整体概览，不要只是统计数量，要概括本期整体形状。",
      "themes 是“今天发生了什么”，必须跨 X、播客、博客综合共同主题、变化方向、产品/agent/创业相关类别，不要按信息源类型分类。",
      "themes 之间必须互斥：同一个 item 的 id 只能出现在一个 theme.sourceIds 里；不要把同一批来源重复归入多个主题。",
      "每个 theme 的 label、title、summary 必须和 sourceIds 对应的来源内容严格一致。不要出现“智能体与开发工作流”标题却讲模型路由/成本，也不要出现“模型路由与成本效率”标题却讲开发工作流。",
      "如果来源内容只支持一个主题，就只写一个 theme；宁可少写，也不要为了凑类别而重复或错配。",
      "每个 theme 必须包含 label、title、summary、why、sourceIds。sourceIds 使用输入 item 的 id。",
      "itemSummaries 必须覆盖每一个输入 item，给出中文 summary，不能省略。",
      "productSignals 是产品与观点线索，watchQuestions 是可继续观察的问题。",
      "不要写“值得点击的链接”或强诱导点击；链接由系统在页面下方保留。",
      "不要编造输入里没有的信息。可以解释为什么重要，但要明确是从来源内容推断。",
    ],
    items: compactItems,
  };

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "你是一个中文 AI 产品与创业信息源编辑。你只输出 JSON，不输出 Markdown，不输出解释。",
        },
        {
          role: "user",
          content: `请根据以下 JSON 生成日报内容，严格返回 JSON：\n${JSON.stringify(prompt)}`,
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${body.error?.message || body.message || response.status}`);
  }

  return validateModelDigest(extractJson(body.choices?.[0]?.message?.content), compactItems);
}

function inWindow(value, window) {
  if (!value) return false;
  const date = new Date(value);
  return date >= window.start && date < window.end;
}

function itemKey(item) {
  return `${item.type}:${item.url || item.id || `${item.sourceName}:${item.date}:${item.title}`}`;
}

async function loadNewsletterState(startedAt) {
  try {
    const text = await fs.readFile(path.join(PUBLIC_DIR, STATE_FILE), "utf8");
    const state = JSON.parse(text);
    return {
      startedAt: state.startedAt || startedAt.toISOString(),
      lastCutoff: state.lastCutoff || null,
      lastRunAt: state.lastRunAt || null,
      seenItemIds: Array.isArray(state.seenItemIds) ? state.seenItemIds : [],
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      startedAt: startedAt.toISOString(),
      lastCutoff: null,
      lastRunAt: null,
      seenItemIds: [],
    };
  }
}

async function saveNewsletterState(state) {
  await fs.writeFile(path.join(PUBLIC_DIR, STATE_FILE), `${JSON.stringify(state, null, 2)}\n`);
}

async function fetchGithubText(filePath) {
  const url = `${SOURCE_RAW}/${filePath}`;
  let response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": "ai-builders-newsletter-cloud" },
    });
  } catch (error) {
    response = null;
  }

  if (response?.ok) return response.text();

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    const apiResponse = await fetch(`https://api.github.com/repos/${SOURCE_REPO}/contents/${filePath}?ref=${SOURCE_BRANCH}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "ai-builders-newsletter-cloud",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const body = await apiResponse.json().catch(() => ({}));
    if (apiResponse.ok && body.content) {
      return Buffer.from(body.content, "base64").toString("utf8");
    }
  }

  if (!response) throw new Error(`Failed to fetch ${filePath}`);
  throw new Error(`Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
}

async function fetchSourceJson(filePath) {
  return JSON.parse(await fetchGithubText(filePath));
}

function collectItems(feedX, feedPodcasts, feedBlogs, { state, cutoff }) {
  const startedAt = new Date(state.startedAt);
  const seenItemIds = new Set(state.seenItemIds);
  const shouldInclude = (item) => {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return false;
    return date >= startedAt && date < cutoff && !seenItemIds.has(itemKey(item));
  };

  const xItems = (feedX.x || []).flatMap((builder) =>
    (builder.tweets || [])
      .map((tweet) => ({
        type: "x",
        id: tweet.id,
        sourceName: builder.name,
        handle: builder.handle,
        title: `${builder.name} 的 X 更新`,
        text: tweet.text,
        url: tweet.url,
        date: tweet.createdAt,
      }))
      .filter(shouldInclude),
  );

  const podcastItems = (feedPodcasts.podcasts || [])
    .map((episode) => ({
      type: "podcast",
      id: episode.guid,
      sourceName: episode.name,
      title: episode.title,
      text: episode.transcript || episode.summary || "",
      url: episode.url,
      date: episode.publishedAt,
    }))
    .filter(shouldInclude);

  const blogItems = (feedBlogs.blogs || [])
    .map((post) => ({
      type: "blog",
      sourceName: post.source || post.name || "Blog",
      title: post.title,
      text: post.summary || post.text || post.content || "",
      url: post.url,
      date: post.publishedAt || post.date,
    }))
    .filter(shouldInclude);

  return {
    xItems: xItems.sort((a, b) => new Date(b.date) - new Date(a.date)),
    podcastItems: podcastItems.sort((a, b) => new Date(b.date) - new Date(a.date)),
    blogItems: blogItems.sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

function classify(items) {
  const groups = [];
  const remaining = new Set(items);

  for (const topic of TOPICS) {
    const matches = [...remaining].filter((item) => {
      const text = `${item.title} ${item.text}`.toLowerCase();
      return topic.keywords.some((keyword) => text.includes(keyword));
    });
    if (!matches.length) continue;
    for (const match of matches) remaining.delete(match);
    groups.push({ ...topic, items: matches });
  }

  const other = [...remaining];
  if (other.length) {
    groups.push({
      label: "其他补充信息",
      title: "还有一些更新更像补充信息，先保留但不强行解读",
      why: "不是所有窗口内更新都值得强行归纳成趋势。这里保留低信号或偏题内容，是为了让你知道信息源确实有更新，同时不把它包装成过度结论。",
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
    .slice(0, 8)
    .map((item) => `<a href="#${sourceMap.get(item)}">${escapeHtml(item.sourceName)}</a>`)
    .join("，");

  const examples = group.items
    .slice(0, 3)
    .map((item) => escapeHtml(truncate(chineseSummary(item), 150)))
    .join(" / ");

  return `
      <div class="block">
        <span class="label">${escapeHtml(group.label)}</span>
        <h3>${escapeHtml(group.title)}</h3>
        <p>${examples || "这个主题在本窗口内有更新，但原始文本较短，适合先标记为观察项。"}</p>
        <p>为什么可能重要：${escapeHtml(group.why)}</p>
        <p class="meta">信息来源：${refs}</p>
      </div>`;
}

function renderModelTheme(theme, itemsByAnchor) {
  const refs = (theme.sourceIds || [])
    .map((id) => itemsByAnchor.get(id))
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => `<a href="#${sourceAnchor(item.item, item.index)}">${escapeHtml(item.item.sourceName)}</a>`)
    .join("，");

  return `
      <div class="block">
        <span class="label">${escapeHtml(theme.label || "主题")}</span>
        <h3>${escapeHtml(theme.title || "")}</h3>
        <p>${escapeHtml(theme.summary || "")}</p>
        <p>为什么可能重要：${escapeHtml(theme.why || "这是一条值得继续观察的变化。")}</p>
        <p class="meta">信息来源：${refs || "见下方信息源更新概览"}</p>
      </div>`;
}

function renderItem(item, anchor, summaryMap = new Map()) {
  const title = item.type === "x"
    ? `${item.sourceName} 的 X 更新`
    : `${item.sourceName} - ${item.title}`;
  const summary = summaryMap.get(anchor) || chineseSummary(item);

  return `
        <div class="item" id="${anchor}">
          <p class="meta">${escapeHtml(formatDateTime(item.date))}</p>
          <h3>${escapeHtml(title)}</h3>
          <div class="quote">${escapeHtml(truncate(summary, 620))}</div>
          <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">原始链接</a></p>
        </div>`;
}

function renderItems(items, emptyText, anchorPrefix, summaryMap = new Map()) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }
  return items.map((item, index) => renderItem(item, `${anchorPrefix}-${index + 1}`, summaryMap)).join("\n");
}

function renderHtml({ date, window, xItems, podcastItems, blogItems, modelDigest }) {
  const allItems = [...xItems, ...podcastItems, ...blogItems];
  const sourceMap = new Map();
  xItems.forEach((item, index) => sourceMap.set(item, `x-${index + 1}`));
  podcastItems.forEach((item, index) => sourceMap.set(item, `podcast-${index + 1}`));
  blogItems.forEach((item, index) => sourceMap.set(item, `blog-${index + 1}`));
  const itemsByAnchor = new Map();
  xItems.forEach((item, index) => itemsByAnchor.set(`x-${index + 1}`, { item, index }));
  podcastItems.forEach((item, index) => itemsByAnchor.set(`podcast-${index + 1}`, { item, index }));
  blogItems.forEach((item, index) => itemsByAnchor.set(`blog-${index + 1}`, { item, index }));
  const summaryMap = new Map(
    (modelDigest?.itemSummaries || [])
      .filter((entry) => entry?.id && entry?.summary)
      .map((entry) => [entry.id, entry.summary]),
  );
  const groups = classify(allItems);
  const title = `Everyday AI Newsletter｜${ymd(date)}`;
  const lede = modelDigest?.lede || (allItems.length
    ? `本期整体看，更新主要集中在${groups.slice(0, 3).map((group) => group.label).join("、")}。比较值得留意的是：开发工具正在从“能生成”进入“能管理复杂任务”的阶段，模型路由和成本效率开始成为应用层产品能力，而内容与创业生态里的信号也在提醒我们，AI 产品不只是技术性能，还包括人、组织和分发方式。`
    : `本期窗口内暂无新更新。页面仍保留固定结构，方便你确认自动化流程。`);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --bg:#f6f7f4; --paper:#fff; --ink:#1f2933; --muted:#667085; --line:#d9ded6; --accent:#1769aa; --soft:#eef4f7; --green:#2f6f4e; }
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
      <p class="meta">本次推送截止：${escapeHtml(formatDateTime(window.end))}，Asia/Shanghai；收录当前 feed 中此前未推送过、且不晚于该时点的信息。</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(lede)}</p>
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
      ${modelDigest?.themes?.length ? modelDigest.themes.map((theme) => renderModelTheme(theme, itemsByAnchor)).join("\n") : (groups.length ? groups.map((group) => renderThemeSummary(group, sourceMap)).join("\n") : '<div class="block"><p>本窗口暂无新内容。今天发生了什么这一节会在有更新时跨来源整理共同主题。</p></div>')}
    </section>

    <section id="source-overview">
      <h2>信息源更新概览</h2>
      <div class="source" id="x-updates"><span class="label">X 更新的信息</span>${renderItems(xItems, "本窗口暂无 X 更新。", "x", summaryMap)}</div>
      <div class="source" id="podcasts"><span class="label">播客</span>${renderItems(podcastItems, "本窗口暂无播客更新。", "podcast", summaryMap)}</div>
      <div class="source" id="blogs"><span class="label">博客</span>${renderItems(blogItems, "本窗口暂无博客更新。", "blog", summaryMap)}</div>
    </section>

    <section id="product-signals">
      <h2>产品与观点线索</h2>
      <div class="block">
        <ul>
          ${modelDigest?.productSignals?.length ? modelDigest.productSignals.map((signal) => `<li>${escapeHtml(signal)}</li>`).join("\n") : (groups.length ? groups.map((group) => `<li><strong>${escapeHtml(group.label)}：</strong>${escapeHtml(group.title)}</li>`).join("\n") : "<li>暂无足够新内容形成产品线索。</li>")}
        </ul>
      </div>
    </section>

    <section id="watch-questions">
      <h2>可继续观察的问题</h2>
      <div class="block">
        <ul>
          ${modelDigest?.watchQuestions?.length ? modelDigest.watchQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("\n") : `<li>今天出现的 agent 或工作流信号，是一次性动态，还是会连续几天被不同来源提到？</li>
          <li>这些更新里提到的产品方向，是否对应明确用户场景，而不只是工具热度？</li>
          <li>如果某个主题连续出现，是否值得单独整理成自己的信息源标签？</li>`}
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

async function renderArchiveIndex() {
  const archivePath = path.join(PUBLIC_DIR, ARCHIVE_DIR);
  let entries = [];
  try {
    entries = await fs.readdir(archivePath, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const files = entries
    .filter((entry) => entry.isFile() && /^ai-builders-digest-\d{4}-\d{2}-\d{2}\.html$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const items = files.length
    ? files.map((file) => {
        const date = file.replace("ai-builders-digest-", "").replace(".html", "");
        return `<li><a href="${escapeHtml(file)}">Everyday AI Newsletter｜${escapeHtml(date)}</a></li>`;
      }).join("\n")
    : "<li>暂无历史日报。</li>";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Everyday AI Newsletter｜历史归档</title>
  <style>
    body { margin: 0; background: #f6f7f4; color: #1f2933; font: 16px/1.72 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(820px, calc(100% - 28px)); margin: 0 auto; padding: 34px 0 52px; }
    h1 { margin: 0 0 12px; font-size: clamp(30px, 6vw, 46px); line-height: 1.08; letter-spacing: 0; }
    a { color: #1769aa; text-underline-offset: 3px; }
    .meta { color: #667085; }
    .panel { margin-top: 22px; padding: 18px; border: 1px solid #d9ded6; border-radius: 8px; background: #fff; }
    li { margin: 10px 0; }
  </style>
</head>
<body>
  <main>
    <p class="meta"><a href="../">打开最新一期</a></p>
    <h1>Everyday AI Newsletter｜历史归档</h1>
    <div class="panel">
      <ul>
${items}
      </ul>
    </div>
  </main>
</body>
</html>`;
}

async function main() {
  const now = new Date();
  const sendWindow = shanghaiWindow(now);
  const date = sendWindow.end;
  const dateSlug = ymd(date);
  const fileName = `ai-builders-digest-${dateSlug}.html`;
  const publicUrl = `${BASE_URL}${ARCHIVE_DIR}/${fileName}`;

  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchSourceJson("feed-x.json"),
    fetchSourceJson("feed-podcasts.json"),
    fetchSourceJson("feed-blogs.json"),
  ]);

  const initialStartedAt = new Date(sendWindow.start);
  initialStartedAt.setUTCDate(initialStartedAt.getUTCDate() - 1);
  const state = await loadNewsletterState(initialStartedAt);
  const { xItems, podcastItems, blogItems } = collectItems(feedX, feedPodcasts, feedBlogs, {
    state,
    cutoff: sendWindow.end,
  });
  let modelDigest = null;
  try {
    modelDigest = await generateModelDigest({ window: sendWindow, xItems, podcastItems, blogItems });
  } catch (error) {
    console.warn(`DeepSeek digest generation failed, falling back to rules: ${error.message}`);
  }
  const html = renderHtml({ date, window: sendWindow, xItems, podcastItems, blogItems, modelDigest });

  const seenItemIds = new Set(state.seenItemIds);
  for (const item of [...xItems, ...podcastItems, ...blogItems]) seenItemIds.add(itemKey(item));
  const nextState = {
    startedAt: state.startedAt,
    lastCutoff: sendWindow.end.toISOString(),
    lastRunAt: now.toISOString(),
    seenItemIds: [...seenItemIds].sort(),
  };

  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  await fs.mkdir(path.join(PUBLIC_DIR, ARCHIVE_DIR), { recursive: true });
  await fs.writeFile(path.join(PUBLIC_DIR, ARCHIVE_DIR, fileName), html);
  await fs.writeFile(path.join(PUBLIC_DIR, "index.html"), html);
  await fs.writeFile(path.join(PUBLIC_DIR, ARCHIVE_DIR, "index.html"), await renderArchiveIndex());
  await fs.writeFile(path.join(PUBLIC_DIR, "newsletter-date.txt"), `${dateSlug}\n`);
  await saveNewsletterState(nextState);

  if (process.env.SEND_EMAIL !== "false") {
    await sendEmail({ title: `Everyday AI Newsletter｜${ymd(date)}`, url: publicUrl });
  }

  console.log(publicUrl);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
