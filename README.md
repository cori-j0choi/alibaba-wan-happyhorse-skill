# Alibaba Wan + HappyHorse Agent Skill

Generate images and videos from Codex, Claude Code, or OpenCode using Alibaba Cloud Model Studio.

## Supported models

| Model | Workflow |
|---|---|
| `wan2.7-image-pro` | Text-to-image and reference-image editing |
| `happyhorse-1.1-t2v` | Text-to-video |
| `happyhorse-1.1-i2v` | First-frame image-to-video |
| `happyhorse-1.1-r2v` | Reference image-to-video with 1-9 images |

The video commands create asynchronous tasks, poll the existing task until completion, and immediately download the expiring MP4 result. HappyHorse outputs include synchronized audio. Watermarks are disabled by default.

`--dry-run` does not submit a generation request. Actual image and video generation can consume Model Studio quota or incur charges on the configured account.

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

Restart the agent or start a new task after installation.

## Configure

Create an international-region Model Studio API key and set:

[Get an Alibaba Cloud Model Studio API key](https://www.alibabacloud.com/help/en/model-studio/get-api-key)

```bash
export DASHSCOPE_API_KEY="your-key"
```

PowerShell:

```powershell
$env:DASHSCOPE_API_KEY = "your-key"
```

Persist it for the current Windows user:

```powershell
[Environment]::SetEnvironmentVariable("DASHSCOPE_API_KEY", "your-key", "User")
```

`DASHSCOPE_BASE_URL` is optional. The skill defaults to the international endpoint. It also detects an Alibaba provider in `~/.opencodex/config.json`, so OpenCodeX users do not need to duplicate their key.

If neither configuration source contains a key, the CLI prints the key-creation link and platform-specific setup commands. Do not paste API keys into prompts, source files, or logs.

## Use

```bash
node scripts/alibaba-media.mjs image \
  --prompt "A cinematic pink lotus at dawn, no text" \
  --size "1344*768" \
  --output "./outputs/lotus.png"

node scripts/alibaba-media.mjs t2v \
  --prompt "Golden pollen drifts above a lotus, slow camera push-in" \
  --duration 3 --resolution 720P --ratio 16:9 --no-watermark \
  --output "./outputs/lotus.mp4"

node scripts/alibaba-media.mjs i2v \
  --image "./lotus.png" \
  --prompt "Preserve the flower while the camera slowly pushes in" \
  --duration 3 --resolution 720P --no-watermark \
  --output "./outputs/lotus-i2v.mp4"

node scripts/alibaba-media.mjs r2v \
  --image "./lotus.png" --image "./artifact.jpg" \
  --prompt "[Image 1] dissolves into [Image 2] through restrained golden dust" \
  --duration 3 --resolution 720P --ratio 16:9 --no-watermark \
  --output "./outputs/transition.mp4"
```

Add `--dry-run` to validate a request without submitting a billable generation task. Video duration must be 3-15 seconds; resolution can be `720P` or `1080P`.

Recover an existing task without submitting a duplicate request:

```bash
node scripts/alibaba-media.mjs status \
  --task-id "existing-task-id" \
  --output "./outputs/recovered.mp4"
```

## Security

- API keys are read at runtime and are never written to output metadata.
- Local reference images are converted to data URIs in memory.
- Dry-run output redacts data URIs and signed query parameters.
- Generated result URLs expire, so outputs are downloaded locally.

## Development

```bash
npm test
python ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
```

The direct Singapore API path has been exercised end to end for image generation, image editing, T2V, I2V, R2V, task recovery, signed-result download, and watermark-free output. Automated tests do not submit billable requests.

## Official references

- [Wan 2.7 image API](https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference)
- [HappyHorse text-to-video API](https://www.alibabacloud.com/help/en/model-studio/happyhorse-text-to-video-api-reference)
- [Alibaba Model Studio video models](https://www.alibabacloud.com/help/en/model-studio/video-generate-edit-model)

## Acknowledgements

The packaging and task-runner ergonomics were informed by [HiAPIAI/hiapi-happyhorse-1-0-video-skill](https://github.com/HiAPIAI/hiapi-happyhorse-1-0-video-skill). This project uses Alibaba Model Studio's direct API contract for Wan 2.7 and HappyHorse 1.1.

## License

MIT
