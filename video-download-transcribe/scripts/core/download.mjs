import path from 'node:path';
import { ensureDirectory, requireReadableFile } from './files.mjs';
import { enumOption, integerOption } from './cli.mjs';
import { fail } from './errors.mjs';
import { requireCommand, runCommand } from './process.mjs';

/** @param {string} quality */
export function downloadFormat(quality) {
  if (quality === 'best') return 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  if (!/^\d+$/u.test(quality)) fail('--quality 必须是 best 或 1080 这样的高度。');
  return `bestvideo[ext=mp4][height<=${quality}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${quality}]/best[height<=${quality}]/best`;
}

/** @param {Record<string, unknown>} raw @param {string} [cwd] */
export function normalizeDownloadOptions(raw, cwd = process.cwd()) {
  const options = {
    output: path.resolve(cwd, String(raw.output ?? 'output')),
    outputTemplate: raw.outputTemplate ? String(raw.outputTemplate) : undefined,
    captureTitle: Boolean(raw.captureTitle),
    quality: String(raw.quality ?? 'best'),
    parallel: integerOption(raw.parallel ?? 1, '--parallel', { min: 1, max: 8 }),
    cookies: String(raw.cookies ?? 'none'),
    browser: String(raw.browser ?? 'chrome'),
    browserProfile: raw.browserProfile ? String(raw.browserProfile) : undefined,
    cookiesFile: raw.cookiesFile ? path.resolve(cwd, String(raw.cookiesFile)) : undefined,
    ytDlp: String(raw.ytDlp ?? process.env.YT_DLP_PATH ?? 'yt-dlp'),
    ffmpeg: String(raw.ffmpeg ?? process.env.FFMPEG_PATH ?? 'ffmpeg'),
    jsRuntime: String(raw.jsRuntime ?? 'auto'),
    remoteEjs: raw.remoteEjs ? String(raw.remoteEjs) : undefined,
    extraArgs: Array.isArray(raw.extraArgs) ? raw.extraArgs.map(String) : [],
  };
  downloadFormat(options.quality);
  enumOption(options.cookies, '--cookies', ['none', 'browser', 'file']);
  enumOption(options.jsRuntime, '--js-runtime', ['auto', 'node', 'deno']);
  if (options.remoteEjs) enumOption(options.remoteEjs, '--remote-ejs', ['npm', 'github']);
  if (options.cookies === 'file' && !options.cookiesFile) fail('--cookies file 需要 --cookies-file。');
  if (options.cookies !== 'file' && options.cookiesFile) fail('--cookies-file 只能和 --cookies file 一起使用。');
  if (options.cookies !== 'browser' && options.browserProfile) fail('--browser-profile 只能和 --cookies browser 一起使用。');
  return options;
}

/** @param {ReturnType<typeof normalizeDownloadOptions>} options */
export function buildYtDlpArgs(options) {
  const args = [
    '--output', options.outputTemplate ?? path.join(options.output, '%(uploader|NA)s - %(title)s [%(id)s].%(ext)s'),
    '--format', downloadFormat(options.quality),
    '--merge-output-format', 'mp4',
    ...(options.captureTitle ? ['--print', 'after_move:__VDT_TITLE__%(title)s'] : []),
    '--no-playlist',
    '--continue',
    '--no-overwrites',
    '--progress',
    '--newline',
    '--progress-delta', '1',
  ];
  if (options.cookies === 'browser') {
    args.push('--cookies-from-browser', options.browserProfile ? `${options.browser}:${options.browserProfile}` : options.browser);
  } else if (options.cookies === 'file' && options.cookiesFile) {
    args.push('--cookies', options.cookiesFile);
  }
  if (options.jsRuntime !== 'auto') args.push('--no-js-runtimes', '--js-runtimes', options.jsRuntime);
  if (options.remoteEjs) args.push('--remote-components', `ejs:${options.remoteEjs}`);
  args.push(...options.extraArgs);
  return args;
}

/**
 * Download URLs while preserving yt-dlp's own progress output.
 * @param {{urls: string[], onEvent?: (event: Record<string, unknown>) => void, checkDependencies?: boolean, cwd?: string, onOutput?: (stream: 'stdout'|'stderr', chunk: string) => void} & Record<string, unknown>} raw
 */
export async function downloadUrls(raw) {
  const options = normalizeDownloadOptions(raw, raw.cwd);
  if (raw.urls.length === 0) fail('请提供至少一个 URL，或使用 --file。');
  if (options.cookiesFile) await requireReadableFile(options.cookiesFile, 'Cookie 文件');
  if (raw.checkDependencies !== false) {
    await requireCommand(options.ytDlp, 'yt-dlp');
    await requireCommand(options.ffmpeg, 'ffmpeg', ['-version']);
    if (options.jsRuntime !== 'auto') await requireCommand(options.jsRuntime, options.jsRuntime);
  }
  await ensureDirectory(options.output);

  /** @type {{url: string, ok: boolean, error?: string, title?: string}[]} */
  const results = new Array(raw.urls.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < raw.urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      const url = raw.urls[index];
      raw.onEvent?.({ type: 'download-start', url, index, total: raw.urls.length });
      try {
        let title = '';
        let stdoutTail = '';
        await runCommand(options.ytDlp, [...buildYtDlpArgs(options), url], {
          onOutput: (stream, chunk) => {
            if (stream === 'stdout' && options.captureTitle) {
              stdoutTail += chunk;
              const lines = stdoutTail.split(/\r?\n/u);
              stdoutTail = lines.pop() ?? '';
              for (const line of lines) {
                if (line.startsWith('__VDT_TITLE__')) title = line.slice('__VDT_TITLE__'.length).trim();
              }
            }
            raw.onOutput?.(stream, chunk);
          },
        });
        if (options.captureTitle && stdoutTail.startsWith('__VDT_TITLE__')) title = stdoutTail.slice('__VDT_TITLE__'.length).trim();
        results[index] = { url, ok: true, ...(title ? { title } : {}) };
        raw.onEvent?.({ type: 'download-complete', url, index, total: raw.urls.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[index] = { url, ok: false, error: message };
        raw.onEvent?.({ type: 'download-failed', url, index, total: raw.urls.length, error: message });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.parallel, raw.urls.length) }, worker));
  return { options, results };
}
