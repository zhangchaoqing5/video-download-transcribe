# 视频下载与转写控制台

一个完全在本机运行的 Web 控制台和可独立复制的 Agent Skill，用于批量下载公开或已获授权的视频，并使用 `whisper.cpp` 将本地媒体转写为文本或字幕。

项目不上传视频、Cookie、模型或转写结果到云端。浏览器页面只负责表单和任务展示；实际执行始终由本机 Node 服务调用底层 Skill、`yt-dlp`、`ffmpeg` 和 `whisper-cli` 完成。

## 能力

- 批量下载 YouTube、Bilibili、抖音、X 等受 yt-dlp 支持的网站内容。
- 按最高质量或指定高度下载 MP4；支持并发、浏览器 Cookie、Cookie 文件、Deno/Node JS runtime 和高级 yt-dlp 参数。
- 下载并管理 whisper.cpp 模型，默认缓存目录为 `~/.cache/whisper-cpp`。
- 批量转写本地视频或音频，输出 TXT、SRT、VTT、JSON、CSV、LRC、WTS 等格式。
- 支持语言、翻译模式、GPU、线程、VAD、初始提示词、时间范围和高级 whisper-cli 参数。
- 一键 Pipeline：每个 URL 生成独立的 `video/`、`transcript/`、`task.json`；批次生成 `batch.json`。
- 任务中心提供实时进度、日志、输出目录打开、记录删除和本机文件/文件夹选择。

## 结构

```text
src/                         React 页面：参数表单、任务列表、日志和进度
server.ts                    本地 Express 服务：任务状态、SSE、系统文件选择器
video-download-transcribe/  可独立复制的核心 Skill
  scripts/core/              下载、模型、转写、Pipeline 和进程执行逻辑
  scripts/*.mjs              命令行入口
```

页面不会复制下载或转写逻辑。它通过 `server.ts` 调用 `@video-download-transcribe/skill` 的公开 API。

## 前置条件

- Node.js 20 或更高版本。
- pnpm 11。
- 下载功能：`yt-dlp`、`ffmpeg`。
- 转写功能：`whisper-cli`、`ffmpeg`，以及已下载的 Whisper 模型。
- YouTube 的 JS 校验默认使用 Deno。若选择页面中的 Node runtime，则需安装 Node 并由 yt-dlp 显式使用它。

外部命令可以放入 `PATH`，也可以在页面或命令行中传入绝对路径。项目不会自动安装它们。

## 安装与启动

```sh
pnpm install
pnpm run dev
```

然后在浏览器中打开 <http://localhost:3000>。

常用检查命令：

```sh
pnpm run lint
pnpm run check
pnpm run build
```

## Web 使用方式

1. **视频下载**：粘贴一个或多个 URL；需要登录态时选择浏览器 Cookie 或 Netscape `cookies.txt` 文件。
2. **模型管理**：选择一个模型下载到默认目录或自定义目录。
3. **本地转写**：选择本机文件或文件夹，选择模型和输出格式，然后提交任务。日志仅显示转写百分比，不回显识别正文。
4. **一键 Pipeline**：输入 URL，下载后自动转写；每个 URL 的产物相互隔离。
5. **任务中心**：可在文件管理器中打开输出目录；删除只移除任务记录，不删除任何产物。执行中的记录需要二次确认强制移除，且不会终止已经启动的外部进程。

默认输出目录：

| 能力 | 默认位置 |
| --- | --- |
| 视频下载 | `./output/` |
| 本地转写 | `./transcripts/` |
| Pipeline | `./runs/<batch>/items/<id>/` |
| Whisper 模型 | `~/.cache/whisper-cpp/` |

## 命令行与 Agent Skill

根目录提供与页面相同的命令：

```sh
pnpm download URL1 URL2 --quality 1080 --parallel 2
pnpm download-model --model small
pnpm transcribe /absolute/path/video.mp4 --formats txt,srt --language zh
pnpm pipeline URL1 URL2 --formats txt,srt --download-parallel 2
```

也可以不通过 workspace，直接运行可复制目录中的入口：

```sh
node video-download-transcribe/scripts/download.mjs URL
node video-download-transcribe/scripts/download-whisper-model.mjs --model small
node video-download-transcribe/scripts/transcribe.mjs /absolute/path/video.mp4
node video-download-transcribe/scripts/pipeline.mjs URL1 URL2
```

Skill 的 Agent 使用约束、全部参数和状态文件规则见 [video-download-transcribe/SKILL.md](video-download-transcribe/SKILL.md)。

## Cookie 与本地安全

- `--cookies browser` 由 yt-dlp 在本机读取指定浏览器的 Cookie；不会在项目中写死浏览器安装路径。
- Cookie 文件路径不会写入 Web 任务记录。
- `.local-data/` 仅保存本地任务状态，已被 Git 忽略。
- 请只下载自己拥有或已获授权访问的内容，并遵守目标站点的服务条款和适用法律。

如果 macOS 上选择 Chrome Cookie 后提示 `could not find chrome cookies database`，先在启动服务的同一个命令行窗口检查运行 `yt-dlp` 所用的 Python 能否列出 Chrome 配置目录。即使 `ls` 能看到已知的 `Cookies` 文件，Python 仍可能在列目录时收到 `Operation not permitted`，而 yt-dlp 会把它显示为“找不到数据库”。此时需要在系统的“隐私与安全性 → 完全磁盘访问权限”中检查承载该命令行的应用：在 IntelliJ IDEA 内置终端运行就检查 IntelliJ IDEA.app，不能只检查系统的终端.app。完全退出并重新打开对应应用后重试；不希望授予该权限时，可在页面上改选 Netscape 格式 Cookie 文件。项目不会自动更改系统权限或导出 Cookie。

## 抖音详情接口 403：上游跟踪（2026-10-12）

在本机使用 yt-dlp `2026.08.19` 和 Chrome Cookie 时，Cookie 已成功读取，但抖音视频详情接口返回 `HTTP 403`，随后 yt-dlp 提示 `Fresh cookies ... are needed`。同一环境下 YouTube 下载正常，Chrome 中的抖音视频也能播放。这是详情请求被拒绝，与上面的 Chrome Cookie 数据库访问权限错误是两个问题。

上游 [yt-dlp issue #9667](https://github.com/yt-dlp/yt-dlp/issues/9667) 在记录当日仍为 Open。讨论中有人报告详情接口开始校验 `uifid` 和 `x-secsdk-web-signature` 等信息；本项目的本地探针使用这些信息获得了详情响应，并成功下载、验证了一个视频。这说明该请求方式在测试环境中可用，不代表官方 yt-dlp 已修复。

临时插件实现保存在独立分支 `codex/douyin-signed-extractor`，**没有合并到 `main`**。需要该方案时可使用此分支；`main` 继续使用官方 yt-dlp 的抖音提取器。

后续回到官方实现的步骤：

1. 查看 issue #9667、相关修复是否合入，以及**发布的 yt-dlp 版本**是否包含修复；issue 关闭本身不等于已发布可用版本。
2. 在 `main` 上由使用者手动更新 yt-dlp，先用 Chrome Cookie 验证抖音直链和短链接的详情提取、实际下载，再检查 VDT 页面下载和 YouTube 下载。
3. 全部通过后继续使用 `main`，保留临时分支作记录，无需合并插件；若官方版本仍返回 403，则继续使用临时分支并跟踪上游。

## 开发说明

- 根项目与 `video-download-transcribe/` 是 pnpm workspace；一次 `pnpm install` 会安装两者所需依赖。
- Skill 使用 Node ESM JavaScript 和 JSDoc，不需要 TypeScript 编译步骤；`index.d.ts` 是对外类型契约。
- 外部命令以参数数组启动，不通过 Shell 拼接命令。
