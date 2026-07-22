import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildVideoPayload,
  parseArgs,
  requestOrigin,
  resolveConfig,
  safePayload,
} from "../scripts/alibaba-media.mjs";

test("parses repeated image inputs and no-watermark", () => {
  const options = parseArgs([
    "r2v", "--prompt", "transition", "--image", "one.png", "--image", "two.jpg",
    "--duration", "3", "--no-watermark", "--dry-run",
  ]);
  assert.equal(options.mode, "r2v");
  assert.deepEqual(options.images, ["one.png", "two.jpg"]);
  assert.equal(options.watermark, false);
  assert.equal(options.dryRun, true);
});

test("parses an existing task recovery command", () => {
  const options = parseArgs(["status", "--task-id", "task-123", "--output", "recovered.mp4"]);
  assert.equal(options.mode, "status");
  assert.equal(options.taskId, "task-123");
  assert.equal(options.output, "recovered.mp4");
});

test("uses the origin from an OpenAI-compatible provider URL", () => {
  assert.equal(
    requestOrigin("https://workspace.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"),
    "https://workspace.ap-southeast-1.maas.aliyuncs.com",
  );
});

test("resolves a standard international configuration from environment", async () => {
  const config = await resolveConfig({ DASHSCOPE_API_KEY: "test-key" });
  assert.equal(config.provider, "environment");
  assert.equal(config.baseUrl, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
});

test("gives actionable Alibaba API key guidance when no configuration exists", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "alibaba-skill-"));
  const missingConfig = path.join(directory, "missing-opencodex.json");
  try {
    await assert.rejects(
      resolveConfig({ OPENCODEX_CONFIG: missingConfig }),
      (error) => {
        assert.match(error.message, /Alibaba Cloud Model Studio API key is required/);
        assert.match(error.message, /DASHSCOPE_API_KEY/);
        assert.match(error.message, /get-api-key/);
        return true;
      },
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("builds HappyHorse 1.1 T2V with watermark disabled", async () => {
  const payload = await buildVideoPayload({
    mode: "t2v",
    prompt: "golden pollen",
    images: [],
    duration: "3",
    resolution: "720p",
    ratio: "16:9",
    watermark: false,
  });
  assert.equal(payload.model, "happyhorse-1.1-t2v");
  assert.equal(payload.parameters.resolution, "720P");
  assert.equal(payload.parameters.watermark, false);
  assert.equal(payload.parameters.duration, 3);
});

test("builds I2V and R2V media contracts", async () => {
  const dataUri = "data:image/png;base64,AA==";
  const i2v = await buildVideoPayload({ mode: "i2v", prompt: "move", images: [dataUri] });
  assert.equal(i2v.input.media[0].type, "first_frame");
  assert.equal(i2v.parameters.ratio, undefined);

  const r2v = await buildVideoPayload({
    mode: "r2v",
    prompt: "[Image 1] becomes [Image 2]",
    images: [dataUri, "https://example.com/two.jpg"],
  });
  assert.deepEqual(r2v.input.media.map((item) => item.type), ["reference_image", "reference_image"]);
  assert.equal(r2v.parameters.ratio, "16:9");
});

test("redacts data URIs and signed query strings from dry-run output", () => {
  const safe = safePayload({
    media: [
      { url: "data:image/png;base64,AA==" },
      { url: "https://example.com/image.png?signature=secret" },
    ],
  });
  assert.match(safe.media[0].url, /^\[data-uri/);
  assert.equal(safe.media[1].url, "https://example.com/image.png?[signed]");
});
