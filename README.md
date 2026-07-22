# Alibaba Wan + HappyHorse Agent Skill

Generate and download images and videos from Codex, Claude Code, or OpenCode through the Alibaba Cloud Model Studio API.

## Supported models

| Model | Mode | Use it for |
|---|---|---|
| `wan2.7-image-pro` | `image` | Text-to-image and editing with up to 9 reference images |
| `happyhorse-1.1-t2v` | `t2v` | Text-to-video |
| `happyhorse-1.1-i2v` | `i2v` | Animate one image as the first frame |
| `happyhorse-1.1-r2v` | `r2v` | Preserve subjects or style from 1-9 reference images |

Video commands submit one asynchronous task, poll that same task until completion, and download the expiring MP4 URL. HappyHorse results include synchronized audio. Watermarks are disabled by default.

> `--dry-run` does not submit a generation request. Actual generation can consume quota or incur charges on the configured Alibaba Cloud account.

## Install

Codex:

```bash
npx -y github:cori-j0choi/alibaba-wan-happyhorse-skill --codex
```

Claude Code:

```bash
npx -y github:cori-j0choi/alibaba-wan-happyhorse-skill --claude
```

OpenCode:

```bash
npx -y github:cori-j0choi/alibaba-wan-happyhorse-skill --opencode
```

Restart the agent or start a new task after installation so it discovers the skill.

## Quick start

1. Install the skill.
2. Configure an API key, unless it is already stored in OpenCodeX.
3. Start a new agent task.
4. Run a dry-run before a billable request.

For Codex on PowerShell:

```powershell
$skill = "$HOME\.codex\skills\alibaba-wan-happyhorse"
node "$skill\scripts\alibaba-media.mjs" --help
node "$skill\scripts\alibaba-media.mjs" image --prompt "A pink lotus at dawn, no text" --dry-run
```

For a cloned repository on macOS or Linux:

```bash
node scripts/alibaba-media.mjs --help
node scripts/alibaba-media.mjs image --prompt "A pink lotus at dawn, no text" --dry-run
```

You can also ask the agent naturally:

```text
Use $alibaba-wan-happyhorse to generate a 3-second, 720P, watermark-free video of golden pollen drifting over a lotus.
```

## Configure credentials

The CLI looks for credentials in this order:

1. Non-empty `DASHSCOPE_API_KEY`; optional `DASHSCOPE_BASE_URL`
2. Provider selected by `OPENCODEX_PROVIDER`
3. `alibaba-token-plan-intl` in `~/.opencodex/config.json`

### Standard Alibaba Cloud setup

[Get an Alibaba Cloud Model Studio API key](https://www.alibabacloud.com/help/en/model-studio/get-api-key).

PowerShell, current terminal only:

```powershell
$env:DASHSCOPE_API_KEY = "your-api-key"
```

PowerShell, persist for the current Windows user:

```powershell
[Environment]::SetEnvironmentVariable("DASHSCOPE_API_KEY", "your-api-key", "User")
```

Open a new terminal or restart the agent after persisting the variable.

macOS or Linux:

```bash
export DASHSCOPE_API_KEY="your-api-key"
```

`DASHSCOPE_BASE_URL` is optional. With only `DASHSCOPE_API_KEY`, the CLI uses the international endpoint.

### OpenCodeX setup

If `~/.opencodex/config.json` already contains an Alibaba provider with `baseUrl` and `apiKey`, no duplicate environment variable is needed. Override the defaults only when necessary:

```powershell
$env:OPENCODEX_CONFIG = "C:\path\to\config.json"
$env:OPENCODEX_PROVIDER = "my-alibaba-provider"
```

If no usable key exists, the CLI stops before any network request and prints:

- The Alibaba API key creation link
- PowerShell current-session and persistent setup commands
- The macOS/Linux export command
- The OpenCodeX configuration alternative

Do not pass API keys as `alibaba-media.mjs` arguments or embed them in chat prompts, source files, or logs.

## Usage

Show built-in help:

```bash
node scripts/alibaba-media.mjs --help
```

### Generate an image

Required: `--prompt`.

```bash
node scripts/alibaba-media.mjs image \
  --prompt "A cinematic pink lotus blooming above a dark pond at dawn, no text" \
  --size "1344*768" \
  --output "./outputs/lotus.png"
```

Defaults: model `wan2.7-image-pro`, size `1344*768`, one output, no watermark, thinking mode enabled.

### Edit an image

Pass 1-9 local paths, public URLs, or image data URIs with repeated `--image`. The prompt can refer to them by order as image 1, image 2, and so on.

```bash
node scripts/alibaba-media.mjs image \
  --image "./artifact.jpg" \
  --prompt "Preserve image 1 exactly and replace only the background with neutral museum darkness" \
  --size "2K" \
  --output "./outputs/artifact-edit.png"
```

Local files are converted to data URIs in memory. They are not uploaded to a separate hosting service.

### Text-to-video (`t2v`)

Use when the scene can be described entirely with text.

```bash
node scripts/alibaba-media.mjs t2v \
  --prompt "Golden pollen drifts above a lotus, stable camera, slow push-in, no text" \
  --duration 3 \
  --resolution 720P \
  --ratio 16:9 \
  --no-watermark \
  --output "./outputs/lotus-t2v.mp4"
```

### First-frame image-to-video (`i2v`)

Use exactly one `--image`. The generated video's aspect ratio follows the first-frame image, so prepare that image in the intended delivery ratio before submitting.

```bash
node scripts/alibaba-media.mjs i2v \
  --image "./lotus-16x9.png" \
  --prompt "Preserve the flower while the camera slowly pushes in and pollen drifts right" \
  --duration 3 \
  --resolution 720P \
  --no-watermark \
  --output "./outputs/lotus-i2v.mp4"
```

### Reference image-to-video (`r2v`)

Use 1-9 `--image` values. Refer to them in the prompt as `[Image 1]`, `[Image 2]`, and so on. R2V uses the images as subject, object, scene, or style references; it does not guarantee that image 1 is the literal first frame.

```bash
node scripts/alibaba-media.mjs r2v \
  --image "./lotus.png" \
  --image "./artifact.jpg" \
  --prompt "[Image 1] dissolves into [Image 2] through restrained golden dust; preserve the exact artifact" \
  --duration 3 \
  --resolution 720P \
  --ratio 16:9 \
  --no-watermark \
  --output "./outputs/transition-r2v.mp4"
```

### Recover an existing task (`status`)

Use the original task ID after a timeout or interrupted terminal. This checks and downloads the existing task without submitting a duplicate generation request.

```bash
node scripts/alibaba-media.mjs status \
  --task-id "existing-task-id" \
  --output "./outputs/recovered.mp4"
```

If the task is still pending or running, the command reports its status without resubmitting it.

## Options

| Option | Applies to | Meaning |
|---|---|---|
| `--prompt <text>` | `image`, `t2v`, `i2v`, `r2v` | Required generation or editing instruction |
| `--output <path>` | All | Local output path; otherwise uses `outputs/alibaba-media/` |
| `--image <path-or-url>` | `image`, `i2v`, `r2v` | Repeatable reference input; I2V requires exactly one |
| `--model <id>` | Generation modes | Override the default model ID |
| `--dry-run` | Generation modes | Validate and print a redacted payload without submitting |
| `--no-watermark` | Generation modes | Disable watermark; this is already the default |
| `--watermark` | Generation modes | Explicitly enable the provider watermark |
| `--size <value>` | `image` | Pixel dimensions or a supported tier such as `1K` or `2K` |
| `--thinking-mode <bool>` | `image` | Defaults to `true`; pass `false` for a detailed prompt when latency matters |
| `--duration <3-15>` | Video | Output seconds; default `3` |
| `--resolution <720P\|1080P>` | Video | Resolution tier; default `720P` |
| `--ratio <value>` | `t2v`, `r2v` | Output ratio; default `16:9` |
| `--seed <integer>` | Video | Optional seed from `0` to `2147483647` |
| `--timeout <seconds>` | Video | Maximum polling time; default `600` |
| `--task-id <id>` | `status` | Existing Alibaba task ID to retrieve |

## Dry-run and billing safety

Start with the minimum useful settings:

```bash
node scripts/alibaba-media.mjs t2v \
  --prompt "Short test scene" \
  --duration 3 --resolution 720P --ratio 16:9 \
  --dry-run
```

Dry-run output redacts local image data and signed query parameters. Remove `--dry-run` only after checking the model, prompt, duration, resolution, image order, and output path. Do not create a second task while the first is pending or running.

## Outputs

Successful commands create:

- The requested `.png` or `.mp4`
- A neighboring `<output>.json` metadata file

Metadata can include model, provider label, task ID, request ID, byte size, and usage. It never contains the API key or an expiring signed result URL.

Validate a downloaded file on Windows:

```powershell
ffmpeg -v error -xerror -i ".\outputs\result.mp4" -f null NUL
```

## Troubleshooting

| Problem | What to do |
|---|---|
| Missing credentials | Follow the printed key-creation link and set `DASHSCOPE_API_KEY`, or fix the OpenCodeX provider |
| `401` or `403` authentication error | Confirm that the key and endpoint belong to the same Alibaba region |
| Quota, balance, or payment error | Check the configured Alibaba Cloud account before retrying |
| `400` invalid request | Check model, image count, duration, resolution, ratio, size, and seed |
| `429` rate limit | Wait and retry; do not submit duplicate concurrent jobs |
| Video timeout | Use `status --task-id ...`; the remote task may still be running |
| Successful task but download failed | Use `status` promptly because signed result URLs expire |

## Security

- API keys are read only at runtime and are never written to metadata.
- Local reference images are converted to data URIs in memory.
- Dry-run output hides data URIs and signed query parameters.
- Generated result URLs are downloaded immediately because they expire.
- The repository contains no embedded user keys, task IDs, or machine-specific paths.

## Development

```bash
npm test
python ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
```

Automated tests do not submit billable requests. The direct Singapore API path has been exercised end to end for image generation, image editing, T2V, I2V, R2V, task recovery, signed-result download, and watermark-free output.

## Official references

- [Wan 2.7 image API](https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference)
- [HappyHorse text-to-video API](https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference)
- [Alibaba Model Studio video models](https://www.alibabacloud.com/help/en/model-studio/video-generate-edit-model)

## Acknowledgements

The packaging and task-runner ergonomics were informed by [HiAPIAI/hiapi-happyhorse-1-0-video-skill](https://github.com/HiAPIAI/hiapi-happyhorse-1-0-video-skill). This project uses Alibaba Model Studio's direct API contract for Wan 2.7 and HappyHorse 1.1.

## License

MIT
