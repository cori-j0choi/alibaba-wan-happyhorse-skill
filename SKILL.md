---
name: alibaba-wan-happyhorse
description: Generate and download images with Alibaba wan2.7-image-pro and videos with happyhorse-1.1-t2v, happyhorse-1.1-i2v, or happyhorse-1.1-r2v. Use when Codex needs Alibaba Model Studio media generation through credentials already stored in OpenCodeX, including prompt tests, first-frame animation, reference-driven video, watermark-free output, task polling, and local media validation.
---

# Alibaba Wan + HappyHorse

Use the bundled CLI. It reads `DASHSCOPE_API_KEY`, or falls back to the Alibaba provider in `~/.opencodex/config.json`; never copy or print the API key.

## Workflow

1. Run a no-cost `--dry-run` to validate inputs and show the selected endpoint and model.
2. Generate the minimum useful sample before requesting longer or 1080P output.
3. Keep `--no-watermark` for contest or production media. HappyHorse defaults to a visible watermark when this parameter is omitted.
4. Let the CLI poll an accepted task. Do not resubmit an existing task while it is pending or running.
5. Validate downloaded output with `ffmpeg -v error -xerror -i <file> -f null NUL` on Windows.

## Commands

Run commands from the directory where outputs should be stored.

```powershell
$skill = "$HOME\.codex\skills\alibaba-wan-happyhorse"

node "$skill\scripts\alibaba-media.mjs" image `
  --prompt "A cinematic pink lotus at dawn, no text" `
  --size "1344*768" `
  --output ".\outputs\lotus.png"

node "$skill\scripts\alibaba-media.mjs" image `
  --image ".\artifact.jpg" `
  --prompt "Preserve the artifact and replace only the background with museum darkness" `
  --size "2K" `
  --output ".\outputs\artifact-edit.png"

node "$skill\scripts\alibaba-media.mjs" t2v `
  --prompt "Golden pollen drifts above a lotus, slow camera push-in" `
  --duration 3 --resolution 720P --ratio 16:9 --no-watermark `
  --output ".\outputs\lotus-t2v.mp4"

node "$skill\scripts\alibaba-media.mjs" i2v `
  --image ".\lotus.png" `
  --prompt "Preserve the flower while the camera slowly pushes in" `
  --duration 3 --resolution 720P --no-watermark `
  --output ".\outputs\lotus-i2v.mp4"

node "$skill\scripts\alibaba-media.mjs" r2v `
  --image ".\lotus.png" --image ".\artifact.jpg" `
  --prompt "[Image 1] dissolves into [Image 2] through restrained golden dust" `
  --duration 3 --resolution 720P --ratio 16:9 --no-watermark `
  --output ".\outputs\transition-r2v.mp4"

node "$skill\scripts\alibaba-media.mjs" status `
  --task-id "existing-task-id" `
  --output ".\outputs\recovered.mp4"
```

Add `--dry-run` to any command to validate without sending a billable request. Use `--seed <integer>` only when reproducibility matters. For normal installations, set `DASHSCOPE_API_KEY`; the international endpoint is selected automatically. The default OpenCodeX provider is `alibaba-token-plan-intl`; override it with `OPENCODEX_PROVIDER` only when another provider has the required Model Studio endpoint and key.

For endpoint contracts and input limits, read [references/api.md](references/api.md).
