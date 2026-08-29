#!/usr/bin/env node
import process from 'node:process';
import { parseCli } from './core/cli.mjs';
import { DEFAULT_WHISPER_MODEL, DEFAULT_WHISPER_MODEL_DIR, DEFAULT_WHISPER_MODEL_REPOSITORY } from './core/constants.mjs';
import { commonModelsText, downloadWhisperModel } from './core/models.mjs';
import { runEntrypoint } from './core/entrypoint.mjs';

function usage() {
  return `
下载 whisper.cpp 模型到本地缓存。

用法：
  node video-download-transcribe/scripts/download-whisper-model.mjs [选项]

选项：
  -m, --model <名称>             模型名或 ggml-*.bin 文件名；默认 ${DEFAULT_WHISPER_MODEL}
  -d, --model-dir <目录>          模型目录；默认 ${DEFAULT_WHISPER_MODEL_DIR}
      --repository <URL>          模型仓库基础 URL；默认 ${DEFAULT_WHISPER_MODEL_REPOSITORY}
      --force                     即使目标文件存在也重新下载
      --list-models               显示常用模型与官方完整目录链接
  -h, --help                      显示帮助

模型下载始终需要显式执行，转写命令不会自动下载缺失模型。
`;
}

await runEntrypoint(async () => {
  const { options, positionals } = parseCli(process.argv.slice(2), [
    { name: 'help', aliases: ['-h'], type: 'boolean', default: false },
    { name: 'model', aliases: ['-m'], type: 'value', default: DEFAULT_WHISPER_MODEL },
    { name: 'modelDir', aliases: ['-d', '--model-dir'], type: 'value', default: DEFAULT_WHISPER_MODEL_DIR },
    { name: 'repository', type: 'value', default: DEFAULT_WHISPER_MODEL_REPOSITORY },
    { name: 'force', type: 'boolean', default: false },
    { name: 'listModels', aliases: ['--list-models'], type: 'boolean', default: false },
  ]);
  if (positionals.length > 0) throw new Error(`未知位置参数：${positionals.join(' ')}`);
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.listModels) {
    console.log(commonModelsText());
    return;
  }
  await downloadWhisperModel({
    model: String(options.model),
    modelDir: String(options.modelDir),
    repository: String(options.repository),
    force: Boolean(options.force),
  });
});
