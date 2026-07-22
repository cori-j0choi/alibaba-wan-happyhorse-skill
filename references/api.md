# API Notes

## Configuration

The CLI resolves credentials in this order:

1. `DASHSCOPE_API_KEY` and optional `DASHSCOPE_BASE_URL`
2. Provider selected by `OPENCODEX_PROVIDER`
3. `alibaba-token-plan-intl` in `~/.opencodex/config.json`

When only `DASHSCOPE_API_KEY` is set, the CLI uses the international endpoint. Only the origin is reused from an OpenAI-compatible OpenCodeX `baseUrl`. The key is sent in the `Authorization: Bearer` header and is never logged.

## Models

| Mode | Model | Input | Output |
|---|---|---|---|
| `image` | `wan2.7-image-pro` | Prompt and optional 1-9 reference images | PNG |
| `t2v` | `happyhorse-1.1-t2v` | Prompt | MP4 with audio |
| `i2v` | `happyhorse-1.1-i2v` | Prompt and one first-frame image | MP4 with audio |
| `r2v` | `happyhorse-1.1-r2v` | Prompt and 1-9 reference images | MP4 with audio |

Image generation is synchronous at `/api/v1/services/aigc/multimodal-generation/generation`.

Video generation is asynchronous:

- Submit: `/api/v1/services/aigc/video-generation/video-synthesis`
- Poll: `/api/v1/tasks/{task_id}`

Video duration is 3-15 seconds. Supported HappyHorse resolutions are `720P` and `1080P`. T2V and R2V accept an output ratio. I2V follows the first-frame aspect ratio. Local images are converted to data URIs in memory and are not uploaded elsewhere.

Generated remote URLs expire, so the CLI downloads results immediately and writes a metadata JSON beside each output.
