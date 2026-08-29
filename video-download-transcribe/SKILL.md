---
name: video-download-transcribe
description: 在本地使用 yt-dlp 批量下载视频、管理 whisper.cpp 模型，并将媒体转写为文本或字幕。适用于下载 URL、使用浏览器或文件 Cookie、下载模型、转写本地媒体或运行端到端视频下载与转写 Pipeline。
---

# 本地视频下载与转写 Skill

这个 Skill 在本机使用 `yt-dlp` 下载公开视频或已获授权内容，并通过 `ffmpeg` 与 `whisper.cpp` 转写媒体。它可以脱离本项目复制；不依赖 Web 页面，不会自动安装外部软件，也不会自动下载缺失的语音模型。

## 运行前提

- Node.js 20 或更高版本。
- 下载：`yt-dlp` 和 `ffmpeg` 位于 `PATH`，或在命令中显式传入 `--yt-dlp`、`--ffmpeg`。
- 转写：`whisper-cli` 和 `ffmpeg` 位于 `PATH`，或显式传入 `--whisper-cli`、`--ffmpeg`。
- 默认模型目录为 `~/.cache/whisper-cpp`（Windows 会按当前用户目录计算），默认模型为 `ggml-large-v3-turbo-q5_0.bin`。

任何外部二进制的路径都可以通过对应参数覆盖；环境变量 `YT_DLP_PATH`、`FFMPEG_PATH`、`WHISPER_CLI_PATH`、`WHISPER_MODEL_DIR`、`WHISPER_DEFAULT_MODEL`、`WHISPER_MODEL_REPOSITORY` 可设置默认值。

## 命令

从项目根目录执行：

```sh
node video-download-transcribe/scripts/download.mjs --help
node video-download-transcribe/scripts/download-whisper-model.mjs --help
node video-download-transcribe/scripts/transcribe.mjs --help
node video-download-transcribe/scripts/pipeline.mjs --help
```

在本项目根目录中，pnpm workspace 也提供相同命令：

```sh
pnpm download URL
pnpm download-model --model small
pnpm transcribe local-video.mp4 --formats txt
pnpm pipeline URL1 URL2 --download-parallel 2
```

常用示例：

```sh
# 单个或多个 URL 下载；默认输出当前目录 output/
node video-download-transcribe/scripts/download.mjs URL1 URL2 --quality 1080 --parallel 2

# 从 Chrome 的本地 Cookie 数据库读取 Cookie；yt-dlp 自行发现浏览器位置
node video-download-transcribe/scripts/download.mjs --cookies browser --browser chrome URL1

# 先显式下载默认或指定模型
node video-download-transcribe/scripts/download-whisper-model.mjs
node video-download-transcribe/scripts/download-whisper-model.mjs --model small

# 只要纯文本；也可用 srt、vtt 等字幕格式
node video-download-transcribe/scripts/transcribe.mjs local-video.mp4 --formats txt --language zh

# 一键批量下载和转写；每个 URL 都有独立的 video/、transcript/、task.json
node video-download-transcribe/scripts/pipeline.mjs URL1 URL2 --formats txt,srt --download-parallel 2
```

## Agent 调用规则

1. 先根据目标选择一个命令；只需要下载时用 `download.mjs`，已有本地媒体时用 `transcribe.mjs`，需要端到端任务时用 `pipeline.mjs`。
2. 对需要登录态的网站，仅在用户明确允许时使用 `--cookies browser` 或 `--cookies file --cookies-file <path>`。浏览器 Cookie 模式由 yt-dlp 按浏览器名称与系统位置自动读取，无需在代码中写死 Chrome 路径。
3. 不能假设模型存在。转写前如默认模型缺失，先向用户说明，并在获得执行模型下载的授权后运行 `download-whisper-model.mjs`。
4. Pipeline 的状态文件是 `runs/<batch>/batch.json` 和每个 `items/<id>/task.json`。读取其 `download.status`、`transcription.status` 和可选的 `error` 字段判断结果，禁止根据猜测的视频文件名关联任务。
5. 使用 `--yt-dlp-arg`、`--whisper-arg`、`--download-arg`、`--transcribe-arg` 时，每次只传一个完整参数，不拼接 Shell 字符串。

## 模块 API（供未来本地服务调用）

未来 UI 的本地 Node 服务应直接从 workspace 包 `@video-download-transcribe/skill` 导入 `downloadUrls`、`downloadWhisperModel`、`transcribeMedia`、`runPipeline`。Skill 被独立复制时，也可以直接导入其 `scripts/index.mjs`。这些函数接受对象参数，并可选接收 `onOutput(stream, chunk)` 回调以转发外部工具日志。UI 不得重新实现下载、转写、模型命名或任务状态逻辑。
