#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MODES = new Set(["image", "t2v", "i2v", "r2v", "status"]);
export const API_KEY_HELP_URL = "https://www.alibabacloud.com/help/en/model-studio/get-api-key";
const VIDEO_MODELS = {
  t2v: "happyhorse-1.1-t2v",
  i2v: "happyhorse-1.1-i2v",
  r2v: "happyhorse-1.1-r2v",
};

export function parseArgs(argv) {
  const mode = argv.shift();
  if (!MODES.has(mode)) {
    throw new Error("First argument must be one of: image, t2v, i2v, r2v, status");
  }
  const options = { mode, images: [], watermark: undefined, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-watermark") options.watermark = false;
    else if (arg === "--watermark") options.watermark = true;
    else if (arg === "--image") options.images.push(requireValue(argv, ++index, arg));
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      options[key] = requireValue(argv, ++index, arg);
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function integer(value, fallback, min, max, name) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

export async function resolveConfig(env = process.env) {
  const environmentKey = env.DASHSCOPE_API_KEY?.trim();
  if (environmentKey) {
    return {
      apiKey: environmentKey,
      baseUrl: (env.DASHSCOPE_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").trim(),
      provider: "environment",
    };
  }

  const configPath = env.OPENCODEX_CONFIG
    ? path.resolve(env.OPENCODEX_CONFIG)
    : path.join(os.homedir(), ".opencodex", "config.json");
  let config;
  try {
    const text = (await fs.readFile(configPath, "utf8")).replace(/^\uFEFF/, "");
    config = JSON.parse(text);
  } catch (error) {
    const reason = error?.code === "ENOENT"
      ? `OpenCodeX config was not found at ${configPath}.`
      : `OpenCodeX config could not be read at ${configPath}: ${error.message}`;
    throw new Error(apiKeyGuidance(reason));
  }
  const providerName = env.OPENCODEX_PROVIDER || "alibaba-token-plan-intl";
  const provider = config.providers?.[providerName];
  if (!provider) {
    throw new Error(apiKeyGuidance(`OpenCodeX provider was not found: ${providerName}.`));
  }
  const pooledKey = provider.apiKeyPool?.find((entry) => entry?.key)?.key;
  const apiKey = (provider.apiKey || pooledKey || "").trim();
  if (!apiKey || !provider.baseUrl) {
    throw new Error(apiKeyGuidance(`OpenCodeX provider ${providerName} does not contain both baseUrl and apiKey.`));
  }
  return { apiKey, baseUrl: provider.baseUrl, provider: providerName };
}

export function apiKeyGuidance(reason) {
  return [
    reason,
    "Alibaba Cloud Model Studio API key is required.",
    `Get an API key: ${API_KEY_HELP_URL}`,
    "PowerShell (current session): $env:DASHSCOPE_API_KEY=\"your-api-key\"",
    "PowerShell (save for this Windows user): [Environment]::SetEnvironmentVariable(\"DASHSCOPE_API_KEY\",\"your-api-key\",\"User\")",
    "macOS/Linux: export DASHSCOPE_API_KEY=\"your-api-key\"",
    "Alternatively, configure an Alibaba provider with baseUrl and apiKey in ~/.opencodex/config.json.",
    "Do not paste the key into prompts, source files, or logs.",
  ].join("\n");
}

export function requestOrigin(baseUrl) {
  return new URL(baseUrl).origin;
}

async function fetchJson(url, init, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text.slice(0, 800) };
    }
    if (!response.ok) {
      const code = data.code || data.output?.code || "request_failed";
      const message = data.message || data.output?.message || response.statusText;
      throw new Error(`HTTP ${response.status} ${code}: ${message}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(apiKey, asyncRequest = false) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (asyncRequest) headers["X-DashScope-Async"] = "enable";
  return headers;
}

function mimeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  throw new Error(`Unsupported image extension: ${extension}`);
}

async function mediaUrl(value) {
  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;
  const absolute = path.resolve(value);
  const bytes = await fs.readFile(absolute);
  if (bytes.length > 20 * 1024 * 1024) throw new Error(`Image exceeds 20 MB: ${absolute}`);
  return `data:${mimeFor(absolute)};base64,${bytes.toString("base64")}`;
}

export function safePayload(payload) {
  return JSON.parse(JSON.stringify(payload, (key, value) => {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      return `[data-uri ${value.length} chars]`;
    }
    if (key === "url" && typeof value === "string" && value.includes("?")) {
      return `${value.slice(0, value.indexOf("?"))}?[signed]`;
    }
    return value;
  }));
}

function findUrl(value, extensionPattern) {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    const pathname = new URL(value).pathname;
    if (extensionPattern.test(pathname)) return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item, extensionPattern);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findUrl(item, extensionPattern);
      if (found) return found;
    }
  }
  return null;
}

async function download(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  return bytes.length;
}

function defaultOutput(mode) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const extension = mode === "image" ? ".png" : ".mp4";
  return path.resolve("outputs", "alibaba-media", `${stamp}-${mode}${extension}`);
}

async function generateImage(options, config, origin) {
  if (!options.prompt) throw new Error("--prompt is required");
  if (options.images.length > 9) throw new Error("image accepts at most 9 --image values");
  const model = options.model || "wan2.7-image-pro";
  const content = await Promise.all(options.images.map(async (image) => ({ image: await mediaUrl(image) })));
  content.push({ text: options.prompt });
  const payload = {
    model,
    input: { messages: [{ role: "user", content }] },
    parameters: {
      size: options.size || "1344*768",
      n: 1,
      watermark: options.watermark ?? false,
      thinking_mode: options.thinkingMode !== "false",
    },
  };
  const endpoint = `${origin}/api/v1/services/aigc/multimodal-generation/generation`;
  if (options.dryRun) return { dryRun: true, provider: config.provider, endpoint, payload: safePayload(payload) };
  const response = await fetchJson(endpoint, {
    method: "POST",
    headers: authHeaders(config.apiKey),
    body: JSON.stringify(payload),
  }, 360_000);
  const imageUrl = response.output?.choices?.[0]?.message?.content?.find((item) => item.image)?.image
    || findUrl(response, /\.(png|jpe?g|webp)$/i);
  if (!imageUrl) throw new Error("Image generation succeeded without an image URL");
  const output = path.resolve(options.output || defaultOutput("image"));
  const bytes = await download(imageUrl, output);
  const metadata = { model, provider: config.provider, output, bytes, requestId: response.request_id, usage: response.usage };
  await fs.writeFile(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}

export async function buildVideoPayload(options) {
  if (!options.prompt) throw new Error("--prompt is required");
  const model = options.model || VIDEO_MODELS[options.mode];
  const duration = integer(options.duration, 3, 3, 15, "duration");
  const resolution = String(options.resolution || "720P").toUpperCase();
  if (!new Set(["720P", "1080P"]).has(resolution)) throw new Error("resolution must be 720P or 1080P");
  const parameters = { resolution, duration, watermark: options.watermark ?? false };
  if (options.seed !== undefined) parameters.seed = integer(options.seed, 0, 0, 2_147_483_647, "seed");
  if (options.mode !== "i2v") parameters.ratio = options.ratio || "16:9";
  const input = { prompt: options.prompt };
  if (options.mode === "i2v") {
    if (options.images.length !== 1) throw new Error("i2v requires exactly one --image");
    input.media = [{ type: "first_frame", url: await mediaUrl(options.images[0]) }];
  } else if (options.mode === "r2v") {
    if (options.images.length < 1 || options.images.length > 9) throw new Error("r2v requires 1-9 --image values");
    input.media = await Promise.all(options.images.map(async (image) => ({ type: "reference_image", url: await mediaUrl(image) })));
  } else if (options.images.length) {
    throw new Error("t2v does not accept --image");
  }
  return { model, input, parameters };
}

async function generateVideo(options, config, origin) {
  const payload = await buildVideoPayload(options);
  const endpoint = `${origin}/api/v1/services/aigc/video-generation/video-synthesis`;
  if (options.dryRun) return { dryRun: true, provider: config.provider, endpoint, payload: safePayload(payload) };
  const submitted = await fetchJson(endpoint, {
    method: "POST",
    headers: authHeaders(config.apiKey, true),
    body: JSON.stringify(payload),
  });
  const taskId = submitted.output?.task_id;
  if (!taskId) throw new Error("Task submission succeeded without task_id");
  const timeoutSeconds = integer(options.timeout, 600, 30, 3600, "timeout");
  const deadline = Date.now() + timeoutSeconds * 1000;
  let result;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    result = await fetchJson(`${origin}/api/v1/tasks/${encodeURIComponent(taskId)}`, {
      method: "GET",
      headers: authHeaders(config.apiKey),
    }, 90_000);
    const status = result.output?.task_status;
    if (status === "SUCCEEDED") break;
    if (["FAILED", "CANCELED", "UNKNOWN"].includes(status)) {
      throw new Error(`Task ${status}: ${result.output?.code || ""} ${result.output?.message || ""}`.trim());
    }
  }
  if (result?.output?.task_status !== "SUCCEEDED") {
    throw new Error(`Timed out waiting for task ${taskId}; query it instead of resubmitting`);
  }
  const videoUrl = result.output.video_url || findUrl(result, /\.mp4$/i);
  if (!videoUrl) throw new Error("Video task succeeded without video_url");
  const output = path.resolve(options.output || defaultOutput(options.mode));
  const bytes = await download(videoUrl, output);
  const metadata = {
    model: payload.model,
    provider: config.provider,
    taskId,
    output,
    bytes,
    requestId: result.request_id,
    usage: result.usage,
  };
  await fs.writeFile(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}

async function retrieveVideoTask(options, config, origin) {
  if (!options.taskId) throw new Error("status requires --task-id");
  const result = await fetchJson(`${origin}/api/v1/tasks/${encodeURIComponent(options.taskId)}`, {
    method: "GET",
    headers: authHeaders(config.apiKey),
  }, 90_000);
  const status = result.output?.task_status;
  if (status !== "SUCCEEDED") {
    return {
      provider: config.provider,
      taskId: options.taskId,
      status,
      code: result.output?.code,
      message: result.output?.message,
    };
  }
  const videoUrl = result.output.video_url || findUrl(result, /\.mp4$/i);
  if (!videoUrl) throw new Error("Completed task does not contain video_url");
  const output = path.resolve(options.output || defaultOutput("status"));
  const bytes = await download(videoUrl, output);
  const metadata = {
    model: options.model || "completed-video-task",
    provider: config.provider,
    taskId: options.taskId,
    status,
    output,
    bytes,
    requestId: result.request_id,
    usage: result.usage,
  };
  await fs.writeFile(`${output}.json`, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return metadata;
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = await resolveConfig();
  const origin = requestOrigin(config.baseUrl);
  let result;
  if (options.mode === "image") result = await generateImage(options, config, origin);
  else if (options.mode === "status") result = await retrieveVideoTask(options, config, origin);
  else result = await generateVideo(options, config, origin);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
