// scripts/daily-summary.ts
// 运行前：确保在 GitHub Actions 或本地 shell 中已设置：
//   - OPENAI_API_KEY：LLM 密钥（可替换为企业网关）
//   - OPENAI_BASE_URL：LLM API 地址（可替换为自建网关）
//   - LARK_WEBHOOK_URL：飞书自定义机器人 Webhook （也可替换为其他通知 Webhook ）
// 可选：
//   - PER_BRANCH_LIMIT：每个分支最多统计的"今日提交"条数（默认 200）
//   - DIFF_CHUNK_MAX_CHARS：单次送模的最大字符数（默认 80000）
//   - MODEL_NAME：指定模型名称（默认 gpt-4.1-mini）
//   - REPO：owner/repo（Actions 内自动注入）

import { execSync } from "node:child_process";
import https from "node:https";

// ------- 环境变量 -------
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const LARK_WEBHOOK_URL = process.env.LARK_WEBHOOK_URL || "";
const REPO = process.env.REPO || ""; // e.g. "org/repo"
const MODEL_NAME = process.env.MODEL_NAME || "gpt-4.1-mini";
const PER_BRANCH_LIMIT = parseInt(process.env.PER_BRANCH_LIMIT || "200", 10);
const DIFF_CHUNK_MAX_CHARS = parseInt(process.env.DIFF_CHUNK_MAX_CHARS || "80000", 10);

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

// ------- 工具函数 -------
/**
 * Executes a shell command synchronously and returns the trimmed output
 * @param {string} cmd - The shell command to execute
 * @returns {string} The trimmed stdout output from the command
 */
function sh(cmd: string) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}

// function safeArray<T>(xs: T[] | undefined | null) {
//   return Array.isArray(xs) ? xs : [];
// }

// ------- 分支与提交收集（覆盖 origin/* 全分支）-------
const since = "midnight"; // 受 TZ=America/Los_Angeles 影响
const until = "now";

// 拉全远端（建议在 workflow 里执行：git fetch --all --prune --tags）
// 这里再次保险 fetch 一次，避免本地调试遗漏
try {
  sh(`git fetch --all --prune --tags`);
} catch {
  // ignore
}

// 列出所有 origin/* 远端分支，排除 origin/HEAD
const remoteBranches = sh(
  `git for-each-ref --format="%(refname:short)" refs/remotes/origin | grep -v "^origin/HEAD$" || true`,
)
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

// 分支白名单/黑名单（如需）：在此可用正则筛选 remoteBranches

/**
 * Represents metadata for a git commit
 */
type CommitMeta = {
  /** The commit SHA hash */
  sha: string;
  /** The commit title/message */
  title: string;
  /** The commit author name */
  author: string;
  /** The URL to view the commit */
  url: string;
  /** Array of branch names that contain this commit */
  branches: string[]; // 该提交归属的分支集合
};

const branchToCommits = new Map<string, string[]>();
// eslint-disable-next-line no-restricted-syntax
for (const rb of remoteBranches) {
  const list = sh(
    `git log ${rb} --no-merges --since="${since}" --until="${until}" --pretty=format:%H --reverse || true`,
  )
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  branchToCommits.set(rb, list.slice(-PER_BRANCH_LIMIT));
}

// 反向映射：提交 → 出现的分支集合
const shaToBranches = new Map<string, Set<string>>();

// eslint-disable-next-line no-restricted-syntax
for (const [rb, shas] of branchToCommits) {
  // eslint-disable-next-line no-restricted-syntax
  for (const sha of shas) {
    if (!shaToBranches.has(sha)) shaToBranches.set(sha, new Set());
    shaToBranches.get(sha)!.add(rb);
  }
}

// 在所有分支联合视图中获取今天的提交，按时间从早到晚，再与 shaToBranches 交集过滤
const allShasOrdered = sh(
  `git log --no-merges --since="${since}" --until="${until}" --all --pretty=format:%H --reverse || true`,
)
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const seen = new Set<string>();
const commitShas = allShasOrdered.filter((sha) => {
  if (seen.has(sha)) return false;
  if (!shaToBranches.has(sha)) return false; // 仅统计出现在 origin/* 的提交
  seen.add(sha);
  return true;
});

if (commitShas.length === 0) {
  console.log("📭 今天所有分支均无有效提交。结束。");
  process.exit(0);
}

const serverUrl = "https://github.com";

const commitMetas: CommitMeta[] = commitShas.map((sha) => {
  const title = sh(`git show -s --format=%s ${sha}`);
  const author = sh(`git show -s --format=%an ${sha}`);
  const url = REPO ? `${serverUrl}/${REPO}/commit/${sha}` : `${serverUrl}/commit/${sha}`;
  const branches = Array.from(shaToBranches.get(sha) || []).sort();
  return { sha, title, author, url, branches };
});

// ------- diff 获取与分片 -------
const FILE_EXCLUDES = [
  ":!**/*.lock",
  ":!**/dist/**",
  ":!**/build/**",
  ":!**/.next/**",
  ":!**/.vite/**",
  ":!**/out/**",
  ":!**/coverage/**",
  ":!package-lock.json",
  ":!pnpm-lock.yaml",
  ":!yarn.lock",
  ":!**/*.min.*",
];

/**
 * Gets the parent SHA of a given commit
 * @param {string} sha - The commit SHA to find the parent for
 * @returns {string} The parent commit SHA, or undefined for root commits
 */
function getParentSha(sha: string) {
  const line = sh(`git rev-list --parents -n 1 ${sha} || true`);
  const parts = line.split(" ").filter(Boolean);
  // 非 merge 情况 parent 通常只有一个；root commit 无 parent
  return parts[1];
}

/**
 * Gets the git diff for a specific commit
 * @param {string} sha - The commit SHA to get the diff for
 * @returns {string} The git diff output
 */
function getDiff(sha: string) {
  const parent = getParentSha(sha);
  const base = parent || sh(`git hash-object -t tree /dev/null`);
  const excludes = FILE_EXCLUDES.join(" ");
  const diff = sh(`git diff --unified=0 --minimal ${base} ${sha} -- . ${excludes} || true`);
  return diff;
}

/**
 * Splits a git patch into separate file parts
 * @param {string} patch - The git patch content
 * @returns {string[]} Array of individual file patches
 */
function splitPatchByFile(patch: string): string[] {
  if (!patch) return [];
  const parts = patch.split(/^diff --git.*$/m);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Chunks an array of strings by character size limit
 * @param {string[]} parts - Array of strings to chunk
 * @param {number} limit - Maximum character limit per chunk
 * @returns {string[]} Array of chunked strings
 */
function chunkBySize(parts: string[], limit = DIFF_CHUNK_MAX_CHARS): string[] {
  const out: string[] = [];
  let buf = "";
  // eslint-disable-next-line no-restricted-syntax
  for (const p of parts) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length > limit) {
      if (buf) out.push(buf);
      if (p.length > limit) {
        for (let i = 0; i < p.length; i += limit) {
          out.push(p.slice(i, i + limit));
        }
        buf = "";
      } else {
        buf = p;
      }
    } else {
      buf = candidate;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// ------- OpenAI Chat API -------
/**
 * Represents the payload structure for OpenAI Chat API
 */
type ChatPayload = {
  /** The model name to use */
  model: string;
  /** Array of chat messages */
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  /** Temperature setting for response randomness */
  temperature?: number;
};

/**
 * Sends a chat request to OpenAI API
 * @param {string} prompt - The prompt to send to the AI
 * @returns {Promise<string>} The AI response content
 */
async function chat(prompt: string): Promise<string> {
  const payload: ChatPayload = {
    model: MODEL_NAME,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  };
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const url = new URL(OPENAI_BASE_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: `/openai/deployments/${MODEL_NAME}/chat/completions?api-version=2024-12-01-preview`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        // eslint-disable-next-line no-return-assign
        res.on("data", (d) => `${data}${d}`);
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const json = JSON.parse(data);
              const content = json?.choices?.[0]?.message?.content?.trim() || "";
              resolve(content);
            } else {
              reject(new Error(`OpenAI HTTP ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ------- 提示词 -------
/**
 * Generates a prompt for analyzing a commit diff chunk
 * @param {CommitMeta} meta - The commit metadata
 * @param {number} partIdx - The current part index (1-based)
 * @param {number} total - Total number of parts
 * @param {string} patch - The diff patch content
 * @returns {string} The formatted prompt
 */
function commitChunkPrompt(meta: CommitMeta, partIdx: number, total: number, patch: string) {
  return `你是一名资深工程师与发布经理。以下是提交 ${meta.sha.slice(0, 7)}（${meta.title}）的 diff 片段（第 ${partIdx}/${total} 段），请用中文输出结构化摘要：

提交信息：
- SHA: ${meta.sha}
- 标题: ${meta.title}
- 作者: ${meta.author}
- 分支: ${meta.branches.join(", ")}
- 链接: ${meta.url}

要求输出：
1) 变更要点（面向工程师与产品）：列出此片段涉及的主要改动与意图
2) 影响范围：模块/接口/关键文件
3) 风险&回滚点
4) 测试建议
注意：仅基于当前片段，不要臆测；不要贴长代码；如果只是格式化/重命名也请明确指出。

=== DIFF PART BEGIN ===
${patch}
=== DIFF PART END ===`;
}

/**
 * Generates a prompt for merging multiple commit chunk summaries
 * @param {CommitMeta} meta - The commit metadata
 * @param {string[]} parts - Array of chunk summaries to merge
 * @returns {string} The formatted prompt
 */
function commitMergePrompt(meta: CommitMeta, parts: string[]) {
  const joined = parts.map((p, i) => `【片段${i + 1}】\n${p}`).join("\n\n");
  return `下面是提交 ${meta.sha.slice(0, 7)} 的各片段小结，请合并为**单条提交**的最终摘要（中文），输出以下小节：
- 变更概述（不超过5条要点）
- 影响范围（模块/接口/配置）
- 风险与回滚点
- 测试建议
- 面向用户的可见影响（如有）

请避免重复、合并同类项，标注"可能不完整"当某些片段缺失或被截断。

=== 片段小结集合 BEGIN ===
${joined}
=== 片段小结集合 END ===`;
}

/**
 * Generates a prompt for creating a daily summary report
 * @param {string} dateLabel - The date label for the report
 * @param {Array} items - Array of commit metadata and summaries
 * @param {string} repo - The repository name
 * @returns {string} The formatted prompt
 */
function dailyMergePrompt(dateLabel: string, items: { meta: CommitMeta; summary: string }[], repo: string) {
  const body = items
    .map(
      (it) =>
        `[${it.meta.sha.slice(0, 7)}] ${it.meta.title} — ${it.meta.author} — ${it.meta.branches.join(", ")}\n${it.summary}`,
    )
    .join("\n\n---\n\n");

  return `请将以下"当日各提交摘要"整合成**当日开发变更日报（中文）**，输出结构如下：
# ${dateLabel} 开发变更日报（${repo})
1. 今日概览（不超过5条）
2. **按分支**的关键改动清单（每条含模块/影响、是否潜在破坏性）
3. 跨分支风险与回滚策略（如同一提交在多个分支、存在 cherry-pick/divergence）
4. 建议测试与验证清单
5. 其他备注（如重构/依赖升级/仅格式化）

=== 当日提交摘要 BEGIN ===
${body}
=== 当日提交摘要 END ===`;
}

// ------- 飞书 Webhook -------
/**
 * Posts a message to Lark (Feishu) webhook
 * @param {string} text - The text content to send
 * @returns {Promise<void>} Promise that resolves when the message is sent
 */
async function postToLark(text: string) {
  if (!LARK_WEBHOOK_URL) {
    console.log(`LARK_WEBHOOK_URL 未配置，以下为最终日报文本：\n\n${text}`);
    return;
  }
  const payload = JSON.stringify({ msg_type: "text", content: { text } });
  await new Promise<void>((resolve, reject) => {
    const url = new URL(LARK_WEBHOOK_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve());
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ------- 主流程 -------
(async () => {
  const perCommitFinal: { meta: CommitMeta; summary: string }[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const meta of commitMetas) {
    const fullPatch = getDiff(meta.sha);

    if (!fullPatch || !fullPatch.trim()) {
      perCommitFinal.push({
        meta,
        summary: `（无有效业务改动或改动已被过滤，例如 lockfile/构建产物/二进制，或空提交）`,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    const fileParts = splitPatchByFile(fullPatch);
    const chunks = chunkBySize(fileParts, DIFF_CHUNK_MAX_CHARS);

    const partSummaries: string[] = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < chunks.length; i++) {
      const prompt = commitChunkPrompt(meta, i + 1, chunks.length, chunks[i]);
      try {
        // eslint-disable-next-line no-await-in-loop
        const sum = await chat(prompt);
        partSummaries.push(sum || `（片段${i + 1}摘要为空）`);
      } catch (e: any) {
        partSummaries.push(`（片段${i + 1}调用失败：${String(e)}）`);
      }
    }

    // 合并为"单提交摘要"
    let merged = "";
    try {
      // eslint-disable-next-line no-await-in-loop
      merged = await chat(commitMergePrompt(meta, partSummaries));
    } catch (e: any) {
      merged = partSummaries.join("\n\n");
    }

    perCommitFinal.push({ meta, summary: merged });
  }

  // 当地日期标签 YYYY-MM-DD
  const todayLabel = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });

  // 汇总"当日总览"
  let daily = "";
  try {
    daily = await chat(dailyMergePrompt(todayLabel, perCommitFinal, REPO || "repository"));
  } catch (e: any) {
    daily = `（当日汇总失败，以下为逐提交原始小结拼接）\n\n${perCommitFinal
      .map((it) => `[${it.meta.sha.slice(0, 7)}] ${it.meta.title} — ${it.meta.branches.join(", ")}\n${it.summary}`)
      .join("\n\n---\n\n")}`;
  }

  // 发送飞书
  await postToLark(daily);
  console.log("✅ 已发送飞书日报。");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
