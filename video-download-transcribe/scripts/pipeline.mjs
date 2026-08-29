#!/usr/bin/env node
import process from 'node:process';
import { parseCli, readUrlFile, requireUrls } from './core/cli.mjs';
import { DEFAULT_WHISPER_MODEL, DEFAULT_WHISPER_MODEL_DIR } from './core/constants.mjs';
import { runEntrypoint } from './core/entrypoint.mjs';
import { runPipeline } from './core/pipeline.mjs';

function usage() {
  return `
一键批量下载视频并转写为文本/字幕。每个 URL 都创建独立任务目录与 task.json。

用法：
  node video-download-transcribe/scripts/pipeline.mjs [选项] URL [URL ...]
  node video-download-transcribe/scripts/pipeline.mjs --file urls.txt [选项]

任务目录：
  默认在当前执行目录创建 runs/<batch-id>/items/<item-id>/。
  每个任务有 video/、transcript/ 与 task.json；批次根目录有 batch.json。

批次：
  -f, --file <路径>              URL 文件；每行一个 URL
      --run-root <目录>           默认当前目录下 runs/
      --batch-id <名称>           字母、数字、.、_、-；默认时间戳
      --download-parallel <1-8>  同时下载 URL 数；默认 1
      --download-only             仅下载，转写状态记为 skipped

下载参数：
  -q, --quality <best|高度>      默认 best，例如 1080
      --cookies <模式>            none、browser、file；默认 none
      --browser <名称>            默认 chrome
      --browser-profile <名称>    仅 browser Cookie 模式
      --cookies-file <路径>       仅 file Cookie 模式
      --yt-dlp <路径>             --ffmpeg <路径>
      --js-runtime <模式>         auto、node、deno；默认 auto
      --remote-ejs <来源>         npm 或 github
      --download-arg <参数>       高级：原样追加一个 yt-dlp 参数，可重复

转写参数：
  -m, --model <名称>             默认 ${DEFAULT_WHISPER_MODEL}
  -d, --model-dir <目录>          默认 ${DEFAULT_WHISPER_MODEL_DIR}
      --whisper-cli <路径>        whisper-cli 路径
  -F, --formats <列表>            txt（纯文本）、srt/vtt（字幕）等；默认 txt,srt
  -l, --language <语言>           默认 auto，例如 zh、en
      --task <transcribe|translate>
  -t, --threads <数量>            -p, --processors <数量>
      --offset-ms <毫秒>          --duration-ms <毫秒> --max-len <字符数>
      --word-timestamps           --temperature <值> --prompt <文本>
      --no-gpu                    --gpu-device <编号> --no-progress
      --keep-wav                  --overwrite
      --vad --vad-model <路径>
      --transcribe-arg <参数>     高级：原样追加一个 whisper-cli 参数，可重复
  -h, --help                      显示帮助
`;
}

await runEntrypoint(async () => {
  const { options, positionals } = parseCli(process.argv.slice(2), [
    { name: 'help', aliases: ['-h'], type: 'boolean', default: false },
    { name: 'file', aliases: ['-f'], type: 'value' },
    { name: 'runRoot', aliases: ['--run-root'], type: 'value', default: 'runs' },
    { name: 'batchId', aliases: ['--batch-id'], type: 'value' },
    { name: 'downloadParallel', aliases: ['--download-parallel'], type: 'value', default: '1' },
    { name: 'downloadOnly', aliases: ['--download-only'], type: 'boolean', default: false },
    { name: 'quality', aliases: ['-q'], type: 'value', default: 'best' },
    { name: 'cookies', type: 'value', default: 'none' },
    { name: 'browser', type: 'value', default: 'chrome' },
    { name: 'browserProfile', aliases: ['--browser-profile'], type: 'value' },
    { name: 'cookiesFile', aliases: ['--cookies-file'], type: 'value' },
    { name: 'ytDlp', aliases: ['--yt-dlp'], type: 'value' },
    { name: 'ffmpeg', type: 'value' },
    { name: 'jsRuntime', aliases: ['--js-runtime'], type: 'value', default: 'auto' },
    { name: 'remoteEjs', aliases: ['--remote-ejs'], type: 'value' },
    { name: 'downloadExtraArgs', aliases: ['--download-arg'], type: 'repeat' },
    { name: 'model', aliases: ['-m'], type: 'value', default: DEFAULT_WHISPER_MODEL },
    { name: 'modelDir', aliases: ['-d', '--model-dir'], type: 'value', default: DEFAULT_WHISPER_MODEL_DIR },
    { name: 'whisperCli', aliases: ['--whisper-cli'], type: 'value' },
    { name: 'formats', aliases: ['-F'], type: 'value', default: 'txt,srt' },
    { name: 'language', aliases: ['-l'], type: 'value', default: 'auto' },
    { name: 'task', type: 'value', default: 'transcribe' },
    { name: 'threads', aliases: ['-t'], type: 'value' },
    { name: 'processors', aliases: ['-p'], type: 'value' },
    { name: 'offsetMs', aliases: ['--offset-ms'], type: 'value' },
    { name: 'durationMs', aliases: ['--duration-ms'], type: 'value' },
    { name: 'maxLen', aliases: ['--max-len'], type: 'value' },
    { name: 'wordTimestamps', aliases: ['--word-timestamps'], type: 'boolean', default: false },
    { name: 'temperature', type: 'value' },
    { name: 'prompt', type: 'value' },
    { name: 'noGpu', aliases: ['--no-gpu'], type: 'boolean', default: false },
    { name: 'gpuDevice', aliases: ['--gpu-device'], type: 'value' },
    { name: 'noProgress', aliases: ['--no-progress'], type: 'boolean', default: false },
    { name: 'vadEnabled', aliases: ['--vad'], type: 'boolean', default: false },
    { name: 'vadModel', aliases: ['--vad-model'], type: 'value' },
    { name: 'keepWav', aliases: ['--keep-wav'], type: 'boolean', default: false },
    { name: 'overwrite', aliases: ['--overwrite'], type: 'boolean', default: false },
    { name: 'transcribeExtraArgs', aliases: ['--transcribe-arg'], type: 'repeat' },
  ]);
  if (options.help) {
    console.log(usage());
    return;
  }
  const urls = requireUrls([...positionals, ...(options.file ? await readUrlFile(String(options.file)) : [])]);
  const result = await runPipeline({
    ...options,
    urls,
    gpuEnabled: !options.noGpu,
    printProgress: !options.noProgress,
  });
  if (result.failed.length > 0) process.exitCode = 1;
});
