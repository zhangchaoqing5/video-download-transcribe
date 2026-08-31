import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { integerOption } from './cli.mjs';
import { ensureDirectory } from './files.mjs';
import { fail } from './errors.mjs';
import { downloadUrls, normalizeDownloadOptions } from './download.mjs';
import { normalizeTranscribeOptions, transcribeMedia } from './transcribe.mjs';

/** @param {string} batchId */
function validateBatchId(batchId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(batchId)) {
    fail('--batch-id 只能使用字母、数字、.、_、-，且必须以字母或数字开始。');
  }
}

/** @param {string} root @param {string} desiredId @param {boolean} allowExisting */
async function createBatchDirectory(root, desiredId, allowExisting = false) {
  await ensureDirectory(root);
  let suffix = 0;
  while (true) {
    const name = suffix === 0 ? desiredId : `${desiredId}-${suffix}`;
    const candidate = path.join(root, name);
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        if (suffix === 0 && allowExisting) return candidate;
        suffix += 1;
        continue;
      }
      throw error;
    }
  }
}

/** @param {Record<string, unknown>} raw @param {string} [cwd] */
export function normalizePipelineOptions(raw, cwd = process.cwd()) {
  const runRoot = path.resolve(cwd, String(raw.runRoot ?? 'runs'));
  const downloadParallel = integerOption(raw.downloadParallel ?? 1, '--download-parallel', { min: 1, max: 8 });
  const batchId = raw.batchId === undefined || raw.batchId === ''
    ? new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, '')
    : String(raw.batchId);
  validateBatchId(batchId);
  const download = normalizeDownloadOptions({
    output: runRoot,
    quality: raw.quality,
    parallel: 1,
    cookies: raw.cookies,
    browser: raw.browser,
    browserProfile: raw.browserProfile,
    cookiesFile: raw.cookiesFile,
    ytDlp: raw.ytDlp,
    ffmpeg: raw.ffmpeg,
    jsRuntime: raw.jsRuntime,
    remoteEjs: raw.remoteEjs,
    extraArgs: raw.downloadExtraArgs,
  }, cwd);
  const transcribe = normalizeTranscribeOptions({
    output: runRoot,
    model: raw.model,
    modelDir: raw.modelDir,
    whisperCli: raw.whisperCli,
    ffmpeg: raw.ffmpeg,
    formats: raw.formats,
    language: raw.language,
    task: raw.task,
    threads: raw.threads,
    processors: raw.processors,
    offsetMs: raw.offsetMs,
    durationMs: raw.durationMs,
    maxLen: raw.maxLen,
    wordTimestamps: raw.wordTimestamps,
    temperature: raw.temperature,
    prompt: raw.prompt,
    gpuEnabled: raw.gpuEnabled,
    gpuDevice: raw.gpuDevice,
    printProgress: raw.printProgress,
    vadEnabled: raw.vadEnabled,
    vadModel: raw.vadModel,
    keepWav: raw.keepWav,
    overwrite: raw.overwrite,
    extraArgs: raw.transcribeExtraArgs,
  }, cwd);
  return {
    runRoot,
    batchId,
    downloadParallel,
    downloadOnly: Boolean(raw.downloadOnly),
    download,
    transcribe,
  };
}

/**
 * One URL per isolated task directory. Runners may be injected by a future local server or tests.
 * @param {{urls: string[], cwd?: string, logger?: {log: Function, error: Function}, onOutput?: (stream: 'stdout'|'stderr', chunk: string) => void, onProgress?: (progress: {phase: 'preparing'|'transcribing', fileIndex: number, fileCount: number, percentage: number}) => void, checkDependencies?: boolean, downloadRunner?: typeof downloadUrls, transcribeRunner?: typeof transcribeMedia} & Record<string, unknown>} raw
 */
export async function runPipeline(raw) {
  if (raw.urls.length === 0) fail('请提供至少一个 URL，或使用 --file。');
  const options = normalizePipelineOptions(raw, raw.cwd);
  const logger = raw.logger ?? console;
  const batchDirectory = await createBatchDirectory(options.runRoot, options.batchId, Boolean(raw.allowExistingBatchDirectory));
  const batchId = path.basename(batchDirectory);
  const suppliedTaskIds = Array.isArray(raw.taskIds) && raw.taskIds.length === raw.urls.length
    ? raw.taskIds.map((id) => String(id))
    : null;

  const items = await Promise.all(raw.urls.map(async (url, index) => {
    const id = suppliedTaskIds?.[index] ?? `t_${randomUUID().replace(/-/gu, '').slice(0, 12)}`;
    if (!/^t_[A-Za-z0-9_-]+$/u.test(id)) fail('taskIds 必须是以 t_ 开头的安全唯一标识。');
    const directory = path.join(batchDirectory, id);
    await ensureDirectory(directory);
    const item = { id, url, directory, title: '', download: { status: 'pending' }, transcription: { status: 'pending' } };
    return item;
  }));

  logger.log(`批次目录：${batchDirectory}`);
  logger.log(`下载项目数：${items.length}；下载并行数：${options.downloadParallel}`);
  const downloadRunner = raw.downloadRunner ?? downloadUrls;
  let nextIndex = 0;
  async function downloadWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      item.download.status = 'running';
      logger.log(`[下载 ${index + 1}/${items.length}] ${item.url}`);
      try {
        const result = await downloadRunner({
          ...options.download,
          output: item.directory,
          outputTemplate: path.join(item.directory, `${item.id}.%(ext)s`),
          captureTitle: true,
          urls: [item.url],
          parallel: 1,
          checkDependencies: raw.checkDependencies,
          onOutput: raw.onOutput,
        });
        const failure = result.results.find((entry) => !entry.ok);
        if (failure) {
          item.download.status = 'failed';
          item.download.error = failure.error ?? 'yt-dlp 下载失败。';
        } else {
          item.download.status = 'complete';
          item.title = result.results.find((entry) => entry.ok)?.title ?? '';
        }
      } catch (error) {
        item.download.status = 'failed';
        item.download.error = error instanceof Error ? error.message : String(error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.downloadParallel, items.length) }, downloadWorker));

  if (options.downloadOnly) {
    for (const item of items) {
      item.transcription.status = 'skipped';
    }
  } else {
    const transcribeRunner = raw.transcribeRunner ?? transcribeMedia;
    for (const item of items.filter((candidate) => candidate.download.status === 'complete')) {
      item.transcription.status = 'running';
      logger.log(`[转写 ${item.id}]`);
      try {
        await transcribeRunner({
          ...options.transcribe,
          output: item.directory,
          outputStem: item.id,
          inputs: [item.directory],
          checkDependencies: raw.checkDependencies,
          onOutput: raw.onOutput,
          onProgress: raw.onProgress,
        });
        item.transcription.status = 'complete';
      } catch (error) {
        item.transcription.status = 'failed';
        item.transcription.error = error instanceof Error ? error.message : String(error);
      }
    }
    for (const item of items.filter((candidate) => candidate.download.status !== 'complete')) {
      item.transcription.status = 'skipped';
    }
  }
  const failed = items.filter((item) => item.download.status === 'failed' || item.transcription.status === 'failed');
  logger.log(`批次完成：${items.length - failed.length}/${items.length} 成功。`);
  logger.log(`结果目录：${batchDirectory}`);
  return { batchDirectory, batchId, items, failed };
}
