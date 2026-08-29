import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { integerOption } from './cli.mjs';
import { ensureDirectory, writeJson } from './files.mjs';
import { fail } from './errors.mjs';
import { downloadUrls, normalizeDownloadOptions } from './download.mjs';
import { normalizeTranscribeOptions, transcribeMedia } from './transcribe.mjs';

/** @param {string} batchId */
function validateBatchId(batchId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(batchId)) {
    fail('--batch-id 只能使用字母、数字、.、_、-，且必须以字母或数字开始。');
  }
}

/** @param {string} root @param {string} desiredId */
async function createBatchDirectory(root, desiredId) {
  await ensureDirectory(root);
  let suffix = 0;
  while (true) {
    const name = suffix === 0 ? desiredId : `${desiredId}-${suffix}`;
    const candidate = path.join(root, name);
    try {
      await mkdir(candidate);
      await mkdir(path.join(candidate, 'items'));
      return candidate;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
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

/** @param {{id: string, url: string, directory: string, download: {status: string, error?: string}, transcription: {status: string, error?: string}} item @param {ReturnType<typeof normalizePipelineOptions>} options */
function taskDocument(item, options) {
  return {
    schema_version: 1,
    task_id: item.id,
    source: { url: item.url },
    download: {
      status: item.download.status,
      directory: 'video',
      ...(item.download.error ? { error: item.download.error } : {}),
    },
    transcription: {
      status: item.transcription.status,
      directory: 'transcript',
      model: options.transcribe.model,
      formats: options.transcribe.formats,
      language: options.transcribe.language,
      task: options.transcribe.task,
      ...(item.transcription.error ? { error: item.transcription.error } : {}),
    },
  };
}

/** @param {{directory: string} & Parameters<typeof taskDocument>[0]} item @param {ReturnType<typeof normalizePipelineOptions>} options */
async function saveTask(item, options) {
  await writeJson(path.join(item.directory, 'task.json'), taskDocument(item, options));
}

/**
 * One URL per isolated task directory. Runners may be injected by a future local server or tests.
 * @param {{urls: string[], cwd?: string, logger?: {log: Function, error: Function}, onOutput?: (stream: 'stdout'|'stderr', chunk: string) => void, onProgress?: (progress: {phase: 'preparing'|'transcribing', fileIndex: number, fileCount: number, percentage: number}) => void, checkDependencies?: boolean, downloadRunner?: typeof downloadUrls, transcribeRunner?: typeof transcribeMedia} & Record<string, unknown>} raw
 */
export async function runPipeline(raw) {
  if (raw.urls.length === 0) fail('请提供至少一个 URL，或使用 --file。');
  const options = normalizePipelineOptions(raw, raw.cwd);
  const logger = raw.logger ?? console;
  const batchDirectory = await createBatchDirectory(options.runRoot, options.batchId);
  const batchId = path.basename(batchDirectory);
  await writeJson(path.join(batchDirectory, 'batch.json'), {
    schema_version: 1,
    batch_id: batchId,
    created_at: new Date().toISOString(),
    item_count: raw.urls.length,
    download_only: options.downloadOnly,
    transcription: {
      model: options.transcribe.model,
      formats: options.transcribe.formats,
      language: options.transcribe.language,
      task: options.transcribe.task,
    },
  });

  const items = await Promise.all(raw.urls.map(async (url, index) => {
    const id = String(index + 1).padStart(3, '0');
    const directory = path.join(batchDirectory, 'items', id);
    await ensureDirectory(path.join(directory, 'video'));
    await ensureDirectory(path.join(directory, 'transcript'));
    const item = { id, url, directory, download: { status: 'pending' }, transcription: { status: 'pending' } };
    await saveTask(item, options);
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
      await saveTask(item, options);
      logger.log(`[下载 ${index + 1}/${items.length}] ${item.url}`);
      try {
        const result = await downloadRunner({
          ...options.download,
          output: path.join(item.directory, 'video'),
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
        }
      } catch (error) {
        item.download.status = 'failed';
        item.download.error = error instanceof Error ? error.message : String(error);
      }
      await saveTask(item, options);
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.downloadParallel, items.length) }, downloadWorker));

  if (options.downloadOnly) {
    for (const item of items) {
      item.transcription.status = 'skipped';
      await saveTask(item, options);
    }
  } else {
    const transcribeRunner = raw.transcribeRunner ?? transcribeMedia;
    for (const item of items.filter((candidate) => candidate.download.status === 'complete')) {
      item.transcription.status = 'running';
      await saveTask(item, options);
      logger.log(`[转写 ${item.id}]`);
      try {
        await transcribeRunner({
          ...options.transcribe,
          output: path.join(item.directory, 'transcript'),
          inputs: [path.join(item.directory, 'video')],
          checkDependencies: raw.checkDependencies,
          onOutput: raw.onOutput,
          onProgress: raw.onProgress,
        });
        item.transcription.status = 'complete';
      } catch (error) {
        item.transcription.status = 'failed';
        item.transcription.error = error instanceof Error ? error.message : String(error);
      }
      await saveTask(item, options);
    }
    for (const item of items.filter((candidate) => candidate.download.status !== 'complete')) {
      item.transcription.status = 'skipped';
      await saveTask(item, options);
    }
  }
  const failed = items.filter((item) => item.download.status === 'failed' || item.transcription.status === 'failed');
  logger.log(`批次完成：${items.length - failed.length}/${items.length} 成功。`);
  logger.log(`结果目录：${batchDirectory}`);
  return { batchDirectory, batchId, items, failed };
}
