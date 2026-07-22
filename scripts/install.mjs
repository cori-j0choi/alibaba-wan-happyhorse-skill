#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillName = "alibaba-wan-happyhorse";
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function selectedTargets() {
  const explicit = args.find((arg) => arg.startsWith("--target="));
  if (explicit) return [path.resolve(explicit.slice("--target=".length))];
  const targets = [];
  if (args.includes("--codex")) targets.push(path.join(os.homedir(), ".codex", "skills"));
  if (args.includes("--claude")) targets.push(path.join(os.homedir(), ".claude", "skills"));
  if (args.includes("--opencode")) targets.push(path.join(os.homedir(), ".opencode", "skills"));
  if (targets.length) return targets;
  return [path.join(os.homedir(), ".codex", "skills")];
}

async function install(targetRoot) {
  const destination = path.join(targetRoot, skillName);
  await fs.mkdir(destination, { recursive: true });
  for (const entry of ["SKILL.md", "agents", "references", "scripts"]) {
    await fs.cp(path.join(sourceRoot, entry), path.join(destination, entry), {
      recursive: true,
      force: true,
    });
  }
  console.log(`Installed ${skillName} to ${destination}`);
}

for (const target of selectedTargets()) await install(target);
console.log("Restart your agent or start a new task so it discovers the skill.");
if (!process.env.DASHSCOPE_API_KEY) {
  console.log("DASHSCOPE_API_KEY is not set.");
  console.log("Get an Alibaba Cloud Model Studio API key: https://www.alibabacloud.com/help/en/model-studio/get-api-key");
  console.log('PowerShell: $env:DASHSCOPE_API_KEY="your-api-key"');
  console.log('macOS/Linux: export DASHSCOPE_API_KEY="your-api-key"');
  console.log("The skill can also use an Alibaba provider with baseUrl and apiKey stored in ~/.opencodex/config.json.");
  console.log("Do not paste the key into prompts, source files, or logs.");
}
