#!/usr/bin/env node
import process from 'node:process';
import { parseCli } from './core/cli.mjs';
import { DEFAULT_WHISPER_MODEL, DEFAULT_WHISPER_MODEL_DIR } from './core/constants.mjs';
import { runEntrypoint } from './core/entrypoint.mjs';
import { transcribeMedia } from './core/transcribe.mjs';

function usage() {
  return `
使用 whisper.cpp 将本地视频或音频批量转为文本。

用法：
  node video-download-transcribe/scripts/transcribe.mjs [选项] <媒体文件或目录> [...]

模型与输出：
  -m, --model <名称>             默认 ${DEFAULT_WHISPER_MODEL}
  -d, --model-dir <目录>          默认 ${DEFAULT_WHISPER_MODEL_DIR}
      --whisper-cli <路径>        whisper-cli 命令或可执行文件路径
      --ffmpeg <路径>             ffmpeg 命令或可执行文件路径
  -o, --output <目录>             默认当前目录下 transcripts/
  -F, --formats <列表>            txt,srt,vtt,json,json-full,csv,lrc,wts；默认 txt,srt

识别控制：
  -l, --language <语言>           例如 auto、zh、en；默认 auto
      --task <transcribe|translate>
  -t, --threads <数量>            -p, --processors <数量>
      --offset-ms <毫秒>          --duration-ms <毫秒>
      --max-len <字符数>          --word-timestamps
      --temperature <值>          --prompt <文本>
      --no-gpu                    --gpu-device <编号>
      --no-progress               --vad --vad-model <路径>
      --keep-wav                  --overwrite
      --recursive                 --dry-run
      --whisper-arg <参数>        高级：原样追加一个 whisper-cli 参数，可重复
  -h, --help                      显示帮助

模型缺失时只会给出错误提示，不会自动联网下载。纯文本用 --formats txt；字幕用 srt 或 vtt。
`;
}

await runEntrypoint(async () => {
  const { options, positionals } = parseCli(process.argv.slice(2), [
    { name: 'help', aliases: ['-h'], type: 'boolean', default: false },
    { name: 'model', aliases: ['-m'], type: 'value', default: DEFAULT_WHISPER_MODEL },
    { name: 'modelDir', aliases: ['-d', '--model-dir'], type: 'value', default: DEFAULT_WHISPER_MODEL_DIR },
    { name: 'whisperCli', aliases: ['--whisper-cli'], type: 'value' },
    { name: 'ffmpeg', type: 'value' },
    { name: 'output', aliases: ['-o'], type: 'value', default: 'transcripts' },
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
    { name: 'recursive', aliases: ['--recursive'], type: 'boolean', default: false },
    { name: 'dryRun', aliases: ['--dry-run'], type: 'boolean', default: false },
    { name: 'extraArgs', aliases: ['--whisper-arg'], type: 'repeat' },
  ]);
  if (options.help) {
    console.log(usage());
    return;
  }
  await transcribeMedia({
    ...options,
    inputs: positionals,
    gpuEnabled: !options.noGpu,
    printProgress: !options.noProgress,
  });
});
