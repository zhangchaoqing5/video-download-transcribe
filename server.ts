import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, spawnSync } from 'child_process';
import { createServer as createViteServer } from 'vite';
import {
  downloadUrls,
  downloadWhisperModel,
  transcribeMedia,
  runPipeline,
} from '@video-download-transcribe/skill';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Path resolver supporting ~
function resolvePath(p: string): string {
  if (!p) return process.cwd();
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return path.resolve(process.cwd(), p);
}

/**
 * The UI uses the string "none" for its dropdown. The Skill intentionally
 * treats an omitted remoteEjs option as disabled, so do not pass that UI-only
 * sentinel into its strict `npm | github` API.
 */
function normalizeRemoteEjs(value: unknown): 'npm' | 'github' | undefined {
  if (value === undefined || value === null || value === '' || value === 'none') {
    return undefined;
  }
  return value as 'npm' | 'github';
}

type LocalSelectionKind = 'file' | 'directory';

function runNativeDialog(command: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('系统文件选择器等待超时。'));
    }, 120_000);

    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * Open a native chooser because browsers intentionally do not reveal selected
 * files' absolute paths, while whisper-cli needs those local paths.
 */
async function chooseLocalPaths(kind: LocalSelectionKind): Promise<string[]> {
  let command: string;
  /** @type {string[]} */
  let args: string[];

  if (process.platform === 'darwin') {
    command = 'osascript';
    const script = kind === 'directory'
      ? 'POSIX path of (choose folder with prompt "选择包含媒体文件的文件夹")'
      : [
          'set selectedFiles to choose file with prompt "选择媒体文件" with multiple selections allowed',
          'set selectedPaths to {}',
          'repeat with selectedFile in selectedFiles',
          'set end of selectedPaths to POSIX path of selectedFile',
          'end repeat',
          'set AppleScript\'s text item delimiters to linefeed',
          'return selectedPaths as text',
        ].join('\n');
    args = ['-e', script];
  } else if (process.platform === 'win32') {
    command = 'powershell.exe';
    const script = kind === 'directory'
      ? [
          'Add-Type -AssemblyName System.Windows.Forms',
          '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
          'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }',
        ].join('; ')
      : [
          'Add-Type -AssemblyName System.Windows.Forms',
          '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
          '$dialog.Multiselect = $true',
          'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileNames -join [Environment]::NewLine) }',
        ].join('; ');
    args = ['-NoProfile', '-STA', '-Command', script];
  } else {
    command = 'zenity';
    args = kind === 'directory'
      ? ['--file-selection', '--directory', '--title=选择包含媒体文件的文件夹']
      : ['--file-selection', '--multiple', '--separator=\n', '--title=选择媒体文件'];
  }

  const result = await runNativeDialog(command, args);
  const output = result.stdout.trim();
  const error = result.stderr.trim();
  // Native dialogs use a non-zero exit status when the user cancels.
  if (result.code !== 0 && !/cancel|user canceled|-128/iu.test(error)) {
    throw new Error(error || '系统文件选择器未能返回结果。');
  }
  return output ? output.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean) : [];
}

// Check availability of local CLI binaries
function checkBinary(nameOrPath: string, args = ['--version']): { available: boolean; path: string; version?: string; error?: string } {
  try {
    const res = spawnSync(nameOrPath, args, { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (res.error) {
      return { available: false, path: nameOrPath, error: res.error.message };
    }
    if (res.status === 0 || (res.stdout && res.stdout.length > 0)) {
      const firstLine = (res.stdout || res.stderr || '').split('\n')[0].trim();
      return { available: true, path: nameOrPath, version: firstLine };
    }
    return { available: false, path: nameOrPath, error: res.stderr || `Exit code ${res.status}` };
  } catch (err: any) {
    return { available: false, path: nameOrPath, error: err.message };
  }
}

async function checkToolsAvailability(customPaths?: { ytDlp?: string; ffmpeg?: string; whisperCli?: string }) {
  const ytDlpPath = customPaths?.ytDlp || process.env.YT_DLP_PATH || 'yt-dlp';
  const ffmpegPath = customPaths?.ffmpeg || process.env.FFMPEG_PATH || 'ffmpeg';
  const whisperCliPath = customPaths?.whisperCli || process.env.WHISPER_CLI_PATH || 'whisper-cli';

  return {
    ytDlp: checkBinary(ytDlpPath, ['--version']),
    ffmpeg: checkBinary(ffmpegPath, ['-version']),
    whisperCli: checkBinary(whisperCliPath, ['-h']),
  };
}

// Local jobs storage directory
const DATA_DIR = path.resolve(process.cwd(), '.local-data');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');
fs.mkdirSync(JOBS_DIR, { recursive: true });

// In-memory active SSE event emitters
const sseClients = new Map<string, Set<express.Response>>();

function broadcastJobEvent(jobId: string, event: string, data: any) {
  const clients = sseClients.get(jobId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const clientRes of clients) {
    try {
      clientRes.write(payload);
    } catch {}
  }
}

// In-memory cache & file persistence of jobs
interface JobRecord {
  id: string;
  kind: 'download' | 'model-download' | 'transcribe' | 'pipeline';
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  params: Record<string, any>;
  logs: string;
  error?: string;
  outputDir?: string;
  progress?: { loaded: number; total: number; percentage: number; speed?: string };
  result?: any;
  pipelineBatch?: any;
}

const jobsCache = new Map<string, JobRecord>();
// A force-removed background job may still settle later. Keep it suppressed so
// its finally block cannot recreate the record the user explicitly removed.
const removedJobIds = new Set<string>();

// Load existing jobs on startup
function loadJobsFromDisk() {
  try {
    const files = fs.readdirSync(JOBS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const raw = fs.readFileSync(path.join(JOBS_DIR, file), 'utf8');
          const job = JSON.parse(raw);
          jobsCache.set(job.id, job);
        } catch {}
      }
    }
  } catch {}
}
loadJobsFromDisk();

function saveJobToDisk(job: JobRecord) {
  if (removedJobIds.has(job.id)) return;
  jobsCache.set(job.id, job);
  const filePath = path.join(JOBS_DIR, `${job.id}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write job record to disk:', err);
  }
}

function sanitizeJobParams(params: Record<string, any>): Record<string, any> {
  const sanitized = { ...params };
  if (sanitized.cookiesFile) {
    sanitized.cookiesFile = '[Cookies File Provided]';
  }
  return sanitized;
}

function appendJobLog(job: JobRecord, stream: 'stdout' | 'stderr', chunk: string) {
  if (removedJobIds.has(job.id)) return;
  job.logs += chunk;
  broadcastJobEvent(job.id, 'log', { stream, chunk, totalLength: job.logs.length });
}

function updateTranscriptionProgress(job: JobRecord, progress: { phase: 'preparing' | 'transcribing'; fileIndex: number; fileCount: number; percentage: number }) {
  if (removedJobIds.has(job.id)) return;
  const phase = progress.phase === 'preparing' ? '准备音频' : '转写';
  job.progress = {
    loaded: progress.percentage,
    total: 100,
    percentage: progress.percentage,
    speed: `${phase} · 文件 ${progress.fileIndex}/${progress.fileCount}`,
  };
  broadcastJobEvent(job.id, 'progress', job.progress);
}

function openDirectoryInFileManager(directory: string) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error('输出目录不存在或不是目录。');
  }
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
    ? 'explorer.exe'
    : 'xdg-open';
  const result = spawnSync(command, [directory], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  if (result.error || result.status !== 0) {
    throw new Error(`无法在文件管理器中打开目录：${result.error?.message || String(result.stderr ?? '').trim() || '未知错误'}`);
  }
}

function isSafeJobId(jobId: string) {
  return /^[A-Za-z0-9_-]+$/u.test(jobId);
}

// Sequential queue for model download jobs to prevent concurrent duplicate model download
const modelDownloadQueue: Array<() => Promise<void>> = [];
let isDownloadingModel = false;

function processNextModelDownload() {
  if (isDownloadingModel || modelDownloadQueue.length === 0) return;
  isDownloadingModel = true;
  const nextTask = modelDownloadQueue.shift();
  if (nextTask) {
    nextTask().finally(() => {
      isDownloadingModel = false;
      processNextModelDownload();
    });
  }
}

// ----------------------------------------------------
// REST API Endpoints
// ----------------------------------------------------

// 0. GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 0.1 POST /api/files/select
app.post('/api/files/select', async (req, res) => {
  const kind = req.body?.kind;
  if (kind !== 'file' && kind !== 'directory') {
    return res.status(400).json({ error: 'kind 必须是 file 或 directory。' });
  }
  try {
    const paths = await chooseLocalPaths(kind);
    res.json({ paths });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1. GET /api/defaults
app.get('/api/defaults', async (req, res) => {
  try {
    const defaultModelDir = process.env.WHISPER_MODEL_DIR || path.join(os.homedir(), '.cache', 'whisper-cpp');
    const tools = await checkToolsAvailability();

    // Check installed models in defaultModelDir
    const installedModels: Array<{
      name: string;
      fileName: string;
      path: string;
      sizeBytes: number;
      sizeFormatted: string;
    }> = [];

    if (fs.existsSync(defaultModelDir)) {
      try {
        const files = fs.readdirSync(defaultModelDir);
        for (const file of files) {
          if (file.startsWith('ggml-') && file.endsWith('.bin')) {
            const fullPath = path.join(defaultModelDir, file);
            const stat = fs.statSync(fullPath);
            const modelName = file.replace(/^ggml-/, '').replace(/\.bin$/, '');
            installedModels.push({
              name: modelName,
              fileName: file,
              path: fullPath,
              sizeBytes: stat.size,
              sizeFormatted: (stat.size / 1024 / 1024).toFixed(1) + ' MB',
            });
          }
        }
      } catch {}
    }

    res.json({
      defaultModelDir,
      defaultModel: process.env.WHISPER_DEFAULT_MODEL || 'large-v3-turbo-q5_0',
      homeDir: os.homedir(),
      cwd: process.cwd(),
      tools,
      installedModels,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/tools/check
app.get('/api/tools/check', async (req, res) => {
  try {
    const { ytDlp, ffmpeg, whisperCli } = req.query as Record<string, string>;
    const tools = await checkToolsAvailability({ ytDlp, ffmpeg, whisperCli });
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/jobs/download
app.post('/api/jobs/download', async (req, res) => {
  const options = req.body || {};
  const urls: string[] = Array.isArray(options.urls)
    ? options.urls
    : typeof options.urls === 'string'
    ? options.urls.split('\n')
    : [];

  const validUrls = urls.map((u) => u.trim()).filter((u) => u && !u.startsWith('#'));
  if (validUrls.length === 0) {
    return res.status(400).json({ error: '请提供至少一个有效的视频 URL' });
  }

  const jobId = `job_dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sanitized = sanitizeJobParams({ ...options, urls: validUrls });
  const outputDir = resolvePath(options.output || 'output');

  const job: JobRecord = {
    id: jobId,
    kind: 'download',
    status: 'queued',
    createdAt: new Date().toISOString(),
    params: sanitized,
    logs: '',
    outputDir,
  };

  saveJobToDisk(job);
  res.json({ jobId, message: '视频下载任务已创建', job });

  // Execute in background
  setImmediate(async () => {
    if (removedJobIds.has(job.id)) return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    saveJobToDisk(job);
    broadcastJobEvent(job.id, 'status', { status: 'running' });

    try {
      const result = await downloadUrls({
        ...options,
        urls: validUrls,
        output: outputDir,
        cookiesFile: options.cookiesFile ? resolvePath(options.cookiesFile) : undefined,
        remoteEjs: normalizeRemoteEjs(options.remoteEjs),
        onOutput: (stream, chunk) => {
          appendJobLog(job, stream, chunk);
        },
      });

      const failedItem = result.results?.find((r) => !r.ok);
      if (failedItem) {
        job.status = 'failed';
        job.error = failedItem.error || '部分或全部视频下载失败';
      } else {
        job.status = 'complete';
      }
      job.result = result;
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      appendJobLog(job, 'stderr', `\n[错误] ${err.message}\n`);
    } finally {
      job.completedAt = new Date().toISOString();
      saveJobToDisk(job);
      broadcastJobEvent(job.id, 'status', { status: job.status, error: job.error, result: job.result });
      broadcastJobEvent(job.id, 'complete', { job });
    }
  });
});

// 4. POST /api/jobs/model-download
app.post('/api/jobs/model-download', async (req, res) => {
  const options = req.body || {};
  const model = options.model || 'large-v3-turbo-q5_0';
  const modelDir = resolvePath(options.modelDir || path.join(os.homedir(), '.cache', 'whisper-cpp'));

  const jobId = `job_md_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sanitized = sanitizeJobParams({ ...options, model, modelDir });

  const job: JobRecord = {
    id: jobId,
    kind: 'model-download',
    status: 'queued',
    createdAt: new Date().toISOString(),
    params: sanitized,
    logs: '',
    progress: { loaded: 0, total: 0, percentage: 0, speed: 'Waiting in queue...' },
  };

  saveJobToDisk(job);
  res.json({ jobId, message: 'Whisper 模型下载任务已加入队列', job });

  // Add to sequential model download queue
  modelDownloadQueue.push(async () => {
    if (removedJobIds.has(job.id)) return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    saveJobToDisk(job);
    broadcastJobEvent(job.id, 'status', { status: 'running' });

    try {
      const result = await downloadWhisperModel({
        model,
        modelDir,
        repository: options.repository,
        force: Boolean(options.force),
        logger: {
          log: (...args: any[]) => appendJobLog(job, 'stdout', args.join(' ') + '\n'),
        },
        onProgress: (p) => {
          const percentage = p.total && p.total > 0 ? Math.floor((p.received / p.total) * 100) : 0;
          job.progress = {
            loaded: p.received,
            total: p.total || 0,
            percentage,
            speed: `${(p.received / 1024 / 1024).toFixed(1)} MB${p.total ? ` / ${(p.total / 1024 / 1024).toFixed(1)} MB` : ''}`,
          };
          broadcastJobEvent(job.id, 'progress', job.progress);
        },
      });

      job.status = 'complete';
      job.result = result;
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      appendJobLog(job, 'stderr', `\n[错误] ${err.message}\n`);
    } finally {
      job.completedAt = new Date().toISOString();
      saveJobToDisk(job);
      broadcastJobEvent(job.id, 'status', { status: job.status, error: job.error, result: job.result });
      broadcastJobEvent(job.id, 'complete', { job });
    }
  });

  processNextModelDownload();
});

// 5. POST /api/jobs/transcribe
app.post('/api/jobs/transcribe', async (req, res) => {
  const options = req.body || {};
  const inputs: string[] = Array.isArray(options.inputs)
    ? options.inputs
    : typeof options.inputs === 'string'
    ? [options.inputs]
    : [];

  const validInputs = inputs.map((i) => i.trim()).filter(Boolean);
  if (validInputs.length === 0) {
    return res.status(400).json({ error: '请提供至少一个有效的媒体文件或文件夹路径' });
  }

  const outputDir = resolvePath(options.output || 'transcripts');
  const jobId = `job_tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sanitized = sanitizeJobParams({ ...options, inputs: validInputs, output: outputDir });

  const job: JobRecord = {
    id: jobId,
    kind: 'transcribe',
    status: 'queued',
    createdAt: new Date().toISOString(),
    params: sanitized,
    logs: '',
    outputDir,
  };

  saveJobToDisk(job);
  res.json({ jobId, message: '媒体转写任务已创建', job });

  // Execute in background
  setImmediate(async () => {
    if (removedJobIds.has(job.id)) return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    saveJobToDisk(job);
    broadcastJobEvent(job.id, 'status', { status: 'running' });

    try {
      const result = await transcribeMedia({
        ...options,
        inputs: validInputs.map(resolvePath),
        output: outputDir,
        modelDir: options.modelDir ? resolvePath(options.modelDir) : undefined,
        vadModel: options.vadModel ? resolvePath(options.vadModel) : undefined,
        logger: {
          log: (...args: any[]) => appendJobLog(job, 'stdout', args.join(' ') + '\n'),
        },
        onProgress: (progress) => updateTranscriptionProgress(job, progress),
      });

      job.status = 'complete';
      job.result = result;
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      appendJobLog(job, 'stderr', `\n[错误] ${err.message}\n`);
    } finally {
      job.completedAt = new Date().toISOString();
      saveJobToDisk(job);
      broadcastJobEvent(job.id, 'status', { status: job.status, error: job.error, result: job.result });
      broadcastJobEvent(job.id, 'complete', { job });
    }
  });
});

// 6. POST /api/jobs/pipeline
app.post('/api/jobs/pipeline', async (req, res) => {
  const options = req.body || {};
  const urls: string[] = Array.isArray(options.urls)
    ? options.urls
    : typeof options.urls === 'string'
    ? options.urls.split('\n')
    : [];

  const validUrls = urls.map((u) => u.trim()).filter((u) => u && !u.startsWith('#'));
  if (validUrls.length === 0) {
    return res.status(400).json({ error: '请提供至少一个有效的视频 URL' });
  }

  const runRoot = resolvePath(options.runRoot || 'runs');
  const jobId = `job_pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sanitized = sanitizeJobParams({ ...options, urls: validUrls, runRoot });

  const job: JobRecord = {
    id: jobId,
    kind: 'pipeline',
    status: 'queued',
    createdAt: new Date().toISOString(),
    params: sanitized,
    logs: '',
    outputDir: runRoot,
  };

  saveJobToDisk(job);
  res.json({ jobId, message: '一键 Pipeline 任务已创建', job });

  // Execute in background
  setImmediate(async () => {
    if (removedJobIds.has(job.id)) return;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    saveJobToDisk(job);
    broadcastJobEvent(job.id, 'status', { status: 'running' });

    try {
      const result = await runPipeline({
        ...options,
        urls: validUrls,
        runRoot,
        cookiesFile: options.cookiesFile ? resolvePath(options.cookiesFile) : undefined,
        remoteEjs: normalizeRemoteEjs(options.remoteEjs),
        modelDir: options.modelDir ? resolvePath(options.modelDir) : undefined,
        vadModel: options.vadModel ? resolvePath(options.vadModel) : undefined,
        logger: {
          log: (...args: any[]) => appendJobLog(job, 'stdout', args.join(' ') + '\n'),
          error: (...args: any[]) => appendJobLog(job, 'stderr', args.join(' ') + '\n'),
        },
        onOutput: (stream, chunk) => {
          appendJobLog(job, stream, chunk);
        },
        onProgress: (progress) => updateTranscriptionProgress(job, progress),
      });

      job.status = result.failed && result.failed.length > 0 ? 'failed' : 'complete';
      job.result = result;
      job.outputDir = result.batchDirectory;

      if (result.failed && result.failed.length > 0) {
        job.error = `${result.failed.length} 个任务项处理失败`;
      }

      // Load batch document
      try {
        const batchJsonPath = path.join(result.batchDirectory, 'batch.json');
        if (fs.existsSync(batchJsonPath)) {
          job.pipelineBatch = JSON.parse(fs.readFileSync(batchJsonPath, 'utf8'));
        }
      } catch {}
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      appendJobLog(job, 'stderr', `\n[错误] ${err.message}\n`);
    } finally {
      job.completedAt = new Date().toISOString();
      saveJobToDisk(job);
      broadcastJobEvent(job.id, 'status', { status: job.status, error: job.error, result: job.result });
      broadcastJobEvent(job.id, 'complete', { job });
    }
  });
});

// 7. GET /api/jobs
app.get('/api/jobs', (req, res) => {
  const list = Array.from(jobsCache.values())
    .map((j) => ({
      id: j.id,
      kind: j.kind,
      status: j.status,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      params: j.params,
      outputDir: j.outputDir,
      error: j.error,
      progress: j.progress,
      pipelineSummary: j.pipelineBatch || (j.result?.items ? {
        itemCount: j.result.items.length,
        failedCount: j.result.failed?.length || 0,
      } : undefined),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ jobs: list });
});

// 7.1 DELETE /api/jobs/:id — delete only the UI job record, never its output.
app.delete('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  if (!isSafeJobId(id)) return res.status(400).json({ error: '非法任务 ID。' });
  const job = jobsCache.get(id);
  if (!job) return res.status(404).json({ error: `未找到任务 ${id}` });
  try {
    const wasActive = job.status === 'queued' || job.status === 'running';
    removedJobIds.add(id);
    fs.rmSync(path.join(JOBS_DIR, `${id}.json`), { force: true });
    jobsCache.delete(id);
    for (const client of sseClients.get(id) ?? []) client.end();
    sseClients.delete(id);
    res.json({
      id,
      deleted: true,
      wasActive,
      message: wasActive
        ? '已强制移除任务记录；已启动的底层进程不会被此操作终止。'
        : '已删除任务记录；输出文件未删除。',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7.2 POST /api/jobs/:id/open-output
app.post('/api/jobs/:id/open-output', (req, res) => {
  const { id } = req.params;
  if (!isSafeJobId(id)) return res.status(400).json({ error: '非法任务 ID。' });
  const job = jobsCache.get(id);
  if (!job) return res.status(404).json({ error: `未找到任务 ${id}` });
  if (!job.outputDir) return res.status(404).json({ error: '该任务没有输出目录。' });

  try {
    openDirectoryInFileManager(job.outputDir);
    res.json({ id, outputDir: job.outputDir, opened: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. GET /api/jobs/:id
app.get('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  const job = jobsCache.get(id);
  if (!job) {
    return res.status(404).json({ error: `未找到任务 ${id}` });
  }

  // If pipeline job, reload latest batch.json and task items if available
  if (job.kind === 'pipeline' && job.outputDir) {
    try {
      const batchJsonPath = path.join(job.outputDir, 'batch.json');
      if (fs.existsSync(batchJsonPath)) {
        job.pipelineBatch = JSON.parse(fs.readFileSync(batchJsonPath, 'utf8'));
      }
    } catch {}
  }

  // Also collect output directory preview files if existing
  let outputFiles: Array<{ name: string; size: number; path: string; ext: string }> = [];
  if (job.outputDir && fs.existsSync(job.outputDir)) {
    try {
      const findFilesRecursive = (dir: string): Array<{ name: string; size: number; path: string; ext: string }> => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const list: Array<{ name: string; size: number; path: string; ext: string }> = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            list.push({
              name: path.relative(job.outputDir!, fullPath),
              size: stat.size,
              path: fullPath,
              ext: path.extname(entry.name).toLowerCase(),
            });
          } else if (entry.isDirectory()) {
            list.push(...findFilesRecursive(fullPath));
          }
        }
        return list;
      };
      outputFiles = findFilesRecursive(job.outputDir);
    } catch {}
  }

  res.json({ ...job, outputFiles });
});

// 9. GET /api/jobs/:id/events (Server-Sent Events)
app.get('/api/jobs/:id/events', (req, res) => {
  const { id } = req.params;
  const job = jobsCache.get(id);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!sseClients.has(id)) {
    sseClients.set(id, new Set());
  }
  sseClients.get(id)!.add(res);

  // Send initial snapshot
  if (job) {
    res.write(`event: init\ndata: ${JSON.stringify(job)}\n\n`);
  }

  req.on('close', () => {
    const clients = sseClients.get(id);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(id);
      }
    }
  });
});

// 10. GET /api/files/read (Safe text/transcript viewer)
app.get('/api/files/read', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const resolved = resolvePath(filePath);
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    if (stat.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: '文件过大，无法在网页中直接预览' });
    }

    const content = fs.readFileSync(resolved, 'utf8');
    res.json({
      path: resolved,
      fileName: path.basename(resolved),
      size: stat.size,
      content,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Vite Middleware / Static Serve
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Video Download & Transcribe Console server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
