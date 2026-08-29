import { access, mkdtemp, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_WHISPER_MODEL, DEFAULT_WHISPER_MODEL_DIR, MEDIA_EXTENSIONS, TRANSCRIPT_FORMATS } from './constants.mjs';
import { collectMediaFiles, ensureDirectory, requireReadableFile } from './files.mjs';
import { enumOption, integerOption } from './cli.mjs';
import { fail } from './errors.mjs';
import { requireCommand, formatCommand, runCommand } from './process.mjs';
import { whisperModelPath } from './models.mjs';

/** @param {string} filePath */
async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert whisper.cpp's machine-readable progress line into a stable API event
 * and deliberately avoid forwarding the recognized transcript to callers.
 * @param {{fileIndex: number, fileCount: number, logger: {log: Function}, onOutput?: (stream: 'stdout'|'stderr', chunk: string) => void, onProgress?: (progress: {phase: 'preparing'|'transcribing', fileIndex: number, fileCount: number, percentage: number}) => void}} options
 */
function createTranscriptionProgressReporter(options) {
  /** @type {Map<'preparing'|'transcribing', number>} */
  const previous = new Map();
  let buffer = '';

  /** @param {'preparing'|'transcribing'} phase @param {number} percentage */
  function report(phase, percentage) {
    const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
    if (previous.get(phase) === normalized) return;
    previous.set(phase, normalized);
    const label = phase === 'preparing' ? '准备音频' : '转写进度';
    const message = `[${options.fileIndex}/${options.fileCount}] ${label}：${normalized}%`;
    options.logger.log(message);
    options.onOutput?.('stderr', `${message}\n`);
    options.onProgress?.({ phase, fileIndex: options.fileIndex, fileCount: options.fileCount, percentage: normalized });
  }

  /** @param {'stdout'|'stderr'} _stream @param {string} chunk */
  function onWhisperOutput(_stream, chunk) {
    buffer += chunk;
    // Current whisper.cpp emits: whisper_print_progress_callback: progress =  42%
    for (const match of buffer.matchAll(/whisper_print_progress_callback\s*:\s*progress\s*=\s*(\d{1,3})%/giu)) {
      report('transcribing', Number(match[1]));
    }
    // Keep a short tail to handle a progress line split across process chunks.
    buffer = buffer.slice(-160);
  }

  return { report, onWhisperOutput };
}

/** @param {unknown} value @param {string} option */
function optionalInteger(value, option) {
  if (value === undefined || value === '') return undefined;
  return String(integerOption(value, option, { min: 0 }));
}

/** @param {unknown} formats */
function normalizeFormats(formats) {
  const requested = String(formats ?? 'txt,srt').split(',').map((item) => item.trim()).filter(Boolean);
  if (requested.length === 0) fail('--formats 不能为空。');
  for (const format of requested) if (!TRANSCRIPT_FORMATS.has(format)) fail(`不支持的输出格式：${format}`);
  return requested;
}

/** @param {Record<string, unknown>} raw @param {string} [cwd] */
export function normalizeTranscribeOptions(raw, cwd = process.cwd()) {
  const options = {
    model: String(raw.model ?? DEFAULT_WHISPER_MODEL),
    modelDir: path.resolve(cwd, String(raw.modelDir ?? DEFAULT_WHISPER_MODEL_DIR)),
    output: path.resolve(cwd, String(raw.output ?? 'transcripts')),
    whisperCli: String(raw.whisperCli ?? process.env.WHISPER_CLI_PATH ?? 'whisper-cli'),
    ffmpeg: String(raw.ffmpeg ?? process.env.FFMPEG_PATH ?? 'ffmpeg'),
    formats: normalizeFormats(raw.formats),
    language: String(raw.language ?? 'auto'),
    task: String(raw.task ?? 'transcribe'),
    threads: optionalInteger(raw.threads, '--threads'),
    processors: optionalInteger(raw.processors, '--processors'),
    offsetMs: optionalInteger(raw.offsetMs, '--offset-ms'),
    durationMs: optionalInteger(raw.durationMs, '--duration-ms'),
    maxLen: optionalInteger(raw.maxLen, '--max-len'),
    wordTimestamps: Boolean(raw.wordTimestamps),
    temperature: raw.temperature === undefined || raw.temperature === '' ? undefined : String(raw.temperature),
    prompt: raw.prompt === undefined || raw.prompt === '' ? undefined : String(raw.prompt),
    gpuEnabled: raw.gpuEnabled !== false,
    gpuDevice: raw.gpuDevice === undefined || raw.gpuDevice === '' ? undefined : String(raw.gpuDevice),
    printProgress: raw.printProgress !== false,
    vadEnabled: Boolean(raw.vadEnabled),
    vadModel: raw.vadModel === undefined || raw.vadModel === '' ? undefined : path.resolve(cwd, String(raw.vadModel)),
    keepWav: Boolean(raw.keepWav),
    overwrite: Boolean(raw.overwrite),
    recursive: Boolean(raw.recursive),
    dryRun: Boolean(raw.dryRun),
    extraArgs: Array.isArray(raw.extraArgs) ? raw.extraArgs.map(String) : [],
  };
  enumOption(options.task, '--task', ['transcribe', 'translate']);
  if (options.wordTimestamps && options.maxLen !== undefined) fail('--word-timestamps 不能与 --max-len 同时使用。');
  if (options.vadEnabled && !options.vadModel) fail('--vad 需要同时提供 --vad-model。');
  return options;
}

/** @param {ReturnType<typeof normalizeTranscribeOptions>} options */
export function buildWhisperArgs(options) {
  const modelPath = whisperModelPath(options.modelDir, options.model);
  const args = ['--model', modelPath, '--language', options.language];
  if (options.threads) args.push('--threads', options.threads);
  if (options.processors) args.push('--processors', options.processors);
  if (options.offsetMs) args.push('--offset-t', options.offsetMs);
  if (options.durationMs) args.push('--duration', options.durationMs);
  if (options.maxLen) args.push('--max-len', options.maxLen);
  if (options.wordTimestamps) args.push('--max-len', '1');
  if (options.temperature) args.push('--temperature', options.temperature);
  if (options.prompt) args.push('--prompt', options.prompt);
  if (!options.gpuEnabled) args.push('--no-gpu');
  if (options.gpuDevice) args.push('--device', options.gpuDevice);
  if (options.printProgress) args.push('--print-progress');
  if (options.task === 'translate') args.push('--translate');
  if (options.vadEnabled && options.vadModel) args.push('--vad', '--vad-model', options.vadModel);
  args.push(...options.extraArgs);
  return args;
}

/** @param {{inputs: string[], logger?: {log: Function}, onOutput?: (stream: 'stdout'|'stderr', chunk: string) => void, onProgress?: (progress: {phase: 'preparing'|'transcribing', fileIndex: number, fileCount: number, percentage: number}) => void, checkDependencies?: boolean, cwd?: string} & Record<string, unknown>} raw */
export async function transcribeMedia(raw) {
  const cwd = raw.cwd ?? process.cwd();
  const options = normalizeTranscribeOptions(raw, cwd);
  if (raw.inputs.length === 0) fail('请提供至少一个媒体文件或目录。');
  const inputPaths = raw.inputs.map((input) => path.resolve(cwd, input));
  const mediaFiles = (await Promise.all(inputPaths.map((input) => collectMediaFiles(input, MEDIA_EXTENSIONS, options.recursive)))).flat();
  if (mediaFiles.length === 0) fail('未找到可转写的媒体文件。');
  const modelPath = whisperModelPath(options.modelDir, options.model);
  const logger = raw.logger ?? console;

  if (!options.dryRun && raw.checkDependencies !== false) {
    await requireReadableFile(modelPath, '模型');
    await requireCommand(options.whisperCli, 'whisper-cli');
    await requireCommand(options.ffmpeg, 'ffmpeg', ['-version']);
    if (options.vadEnabled && options.vadModel) await requireReadableFile(options.vadModel, 'VAD 模型');
  }
  await ensureDirectory(options.output);
  logger.log(`模型：${modelPath}`);
  logger.log(`输出目录：${options.output}`);
  logger.log(`格式：${options.formats.join(',')}；语言：${options.language}；任务：${options.task}`);

  const commonArgs = buildWhisperArgs(options);
  const formatArgs = options.formats.map((format) => TRANSCRIPT_FORMATS.get(format)?.argument ?? '');
  /** @type {{input: string, outputBase: string, skipped?: boolean, commands?: string[]}[]} */
  const results = [];
  const workDirectory = options.dryRun ? undefined : await mkdtemp(path.join(os.tmpdir(), 'whisper-transcribe-'));
  try {
    for (let index = 0; index < mediaFiles.length; index += 1) {
      const mediaFile = mediaFiles[index];
      const stem = path.basename(mediaFile, path.extname(mediaFile));
      const outputBase = path.join(options.output, stem);
      const firstExtension = TRANSCRIPT_FORMATS.get(options.formats[0])?.extension;
      if (!options.overwrite && firstExtension && await exists(`${outputBase}.${firstExtension}`)) {
        logger.log(`跳过已存在的输出：${outputBase}.${firstExtension}`);
        results.push({ input: mediaFile, outputBase, skipped: true });
        continue;
      }
      const wavFile = path.join(workDirectory ?? os.tmpdir(), `${index + 1}.wav`);
      const ffmpegArgs = ['-hide_banner', '-nostdin', '-y', '-i', mediaFile, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wavFile];
      const whisperArgs = [...commonArgs, ...formatArgs, '--output-file', outputBase, '--file', wavFile];
      if (options.dryRun) {
        logger.log(formatCommand(options.ffmpeg, ffmpegArgs));
        logger.log(formatCommand(options.whisperCli, whisperArgs));
        results.push({ input: mediaFile, outputBase, commands: [formatCommand(options.ffmpeg, ffmpegArgs), formatCommand(options.whisperCli, whisperArgs)] });
        continue;
      }
      logger.log(`[${index + 1}/${mediaFiles.length}] 转换音频：${mediaFile}`);
      const progress = createTranscriptionProgressReporter({
        fileIndex: index + 1,
        fileCount: mediaFiles.length,
        logger,
        onOutput: raw.onOutput,
        onProgress: raw.onProgress,
      });
      progress.report('preparing', 0);
      // ffmpeg and whisper-cli output can be extremely verbose. Keep errors in
      // the command result, but only expose structured percentage progress.
      await runCommand(options.ffmpeg, ffmpegArgs, { onOutput: () => {} });
      logger.log(`[${index + 1}/${mediaFiles.length}] 开始识别：${path.basename(mediaFile)}`);
      progress.report('transcribing', 0);
      await runCommand(options.whisperCli, whisperArgs, { onOutput: progress.onWhisperOutput });
      progress.report('transcribing', 100);
      if (options.keepWav) await rename(wavFile, `${outputBase}.wav`);
      results.push({ input: mediaFile, outputBase });
    }
  } finally {
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true });
  }
  if (options.dryRun) logger.log('演练完成：未执行 ffmpeg 或 whisper-cli。');
  logger.log('转写完成。');
  return { options, mediaFiles, results };
}
