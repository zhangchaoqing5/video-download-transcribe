import { createWriteStream } from 'node:fs';
import { access, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  COMMON_WHISPER_MODELS,
  DEFAULT_WHISPER_MODEL,
  DEFAULT_WHISPER_MODEL_DIR,
  DEFAULT_WHISPER_MODEL_REPOSITORY,
  WHISPER_MODEL_CATALOG,
} from './constants.mjs';
import { ensureDirectory } from './files.mjs';
import { fail } from './errors.mjs';

/** @param {string} model */
export function whisperModelFilename(model) {
  if (!model || model.includes('/') || model.includes('\\')) fail('模型名不能包含路径。请改用 --model-dir。');
  if (model.startsWith('ggml-') && model.endsWith('.bin')) return model;
  if (model.endsWith('.bin')) return `ggml-${model}`;
  return `ggml-${model}.bin`;
}

/** @param {string} modelDir @param {string} model */
export function whisperModelPath(modelDir, model) {
  return path.join(modelDir, whisperModelFilename(model));
}

export function commonModelsText() {
  const rows = COMMON_WHISPER_MODELS.map(([name, size, use]) => `  ${name.padEnd(24)} ${size.padEnd(9)} ${use}`);
  return [
    '常用 whisper.cpp 多语言模型：',
    '',
    '  名称                     大小       建议用途',
    ...rows,
    '',
    '不带 .en 后缀的模型均支持多语言；.en 仅适合英语。',
    '-q5_0 表示量化模型，通常占用更少的内存和磁盘。',
    '',
    `完整官方模型目录：\n${WHISPER_MODEL_CATALOG}`,
  ].join('\n');
}

/** @param {string} filePath */
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** @param {number} bytes */
function readableBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

/**
 * Explicitly download a whisper.cpp model. This function is never called by transcription.
 * @param {{model?: string, modelDir?: string, repository?: string, force?: boolean, logger?: {log: Function}, onProgress?: (progress: {received: number, total?: number}) => void, cwd?: string}} [raw]
 */
export async function downloadWhisperModel(raw = {}) {
  const cwd = raw.cwd ?? process.cwd();
  const model = raw.model ?? DEFAULT_WHISPER_MODEL;
  const modelDir = path.resolve(cwd, raw.modelDir ?? DEFAULT_WHISPER_MODEL_DIR);
  const repository = (raw.repository ?? DEFAULT_WHISPER_MODEL_REPOSITORY).replace(/\/+$/u, '');
  const destination = whisperModelPath(modelDir, model);
  const logger = raw.logger ?? console;
  if (!raw.force && await fileExists(destination)) {
    logger.log(`模型已存在：${destination}`);
    logger.log('如需重新下载，请添加 --force。');
    return { destination, skipped: true };
  }

  const filename = whisperModelFilename(model);
  const sourceUrl = `${repository}/${filename}`;
  await ensureDirectory(modelDir);
  const temporary = path.join(modelDir, `.${filename}.${process.pid}.${Date.now()}.part`);
  logger.log(`模型：${filename}`);
  logger.log(`保存至：${destination}`);
  logger.log(`下载地址：${sourceUrl}`);
  logger.log(`完整模型目录：${WHISPER_MODEL_CATALOG}`);

  try {
    const response = await fetch(sourceUrl, { redirect: 'follow' });
    if (!response.ok || !response.body) fail(`模型下载失败：HTTP ${response.status} ${response.statusText}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0) || undefined;
    let received = 0;
    let lastPercent = -1;
    const progress = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        const percent = contentLength ? Math.floor((received / contentLength) * 100) : -1;
        if (percent >= 0 && percent !== lastPercent && (percent === 100 || percent - lastPercent >= 2)) {
          lastPercent = percent;
          logger.log(`下载进度：${percent}%（${readableBytes(received)}）`);
        }
        raw.onProgress?.({ received, total: contentLength });
        callback(null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body), progress, createWriteStream(temporary, { flags: 'wx' }));
    const downloaded = await stat(temporary);
    if (downloaded.size === 0) fail('下载的模型文件为空。');
    try {
      await rename(temporary, destination);
    } catch (error) {
      if (!raw.force) throw error;
      await rm(destination, { force: true });
      await rename(temporary, destination);
    }
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  logger.log(`模型下载完成：${destination}`);
  return { destination, skipped: false };
}
