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

const PROJECT_ROOT = process.cwd();
const DATA_DIR = path.resolve(PROJECT_ROOT, '.local-data');
const JOBS_DIR = path.join(DATA_DIR, 'jobs');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LEGACY_WORKSPACE_FILE = path.join(DATA_DIR, 'workspace.json');
fs.mkdirSync(JOBS_DIR, { recursive: true });

let activeWorkingDir = PROJECT_ROOT;
let settings: Record<string, any> = {};
let hasLegacyWorkspaceSettings = false;

function createDefaultSettings(): Record<string, any> {
  const modelDir = path.join(os.homedir(), '.cache', 'whisper-cpp');
  return {
    workspace: { workingDirectory: PROJECT_ROOT },
    videoDownload: {
      output: 'videos', quality: 'best', parallel: 1, cookies: 'none', browser: 'chrome', browserProfile: '', cookiesFile: '',
      ytDlp: 'yt-dlp', ffmpeg: 'ffmpeg', jsRuntime: 'auto', remoteEjs: 'none', extraArgs: [],
    },
    modelDownload: {
      model: 'large-v3-turbo-q5_0', modelDir, repository: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main', force: false,
    },
    transcribe: {
      recursive: false, output: 'transcripts', overwrite: false, keepWav: false, model: 'large-v3-turbo-q5_0', modelDir,
      whisperCli: 'whisper-cli', ffmpeg: 'ffmpeg', formats: ['txt', 'srt'], language: 'auto', task: 'transcribe', gpuEnabled: true,
      wordTimestamps: false, prompt: '', printProgress: true, vadEnabled: false, vadModel: '', extraArgs: [],
    },
    pipeline: {
      runRoot: 'pipeline', downloadParallel: 1, quality: 'best', cookies: 'none', browser: 'chrome', browserProfile: '', cookiesFile: '',
      ytDlp: 'yt-dlp', ffmpeg: 'ffmpeg', jsRuntime: 'auto', remoteEjs: 'none', downloadExtraArgs: [], model: 'large-v3-turbo-q5_0',
      modelDir, whisperCli: 'whisper-cli', formats: ['txt', 'srt'], language: 'auto', task: 'transcribe', gpuEnabled: true,
      wordTimestamps: false, prompt: '', vadEnabled: false, vadModel: '', transcribeExtraArgs: [],
    },
  };
}

function mergeWithDefaultSettings(saved: Record<string, any>): Record<string, any> {
  const defaults = createDefaultSettings();
  return Object.fromEntries(Object.entries(defaults).map(([section, value]) => [
    section,
    { ...value, ...(saved?.[section] || {}) },
  ]));
}

function isDirectoryWritable(dirPath: string): boolean {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK | fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolvePathToSystem(p: string, baseDir: string = activeWorkingDir): string {
  if (!p) return baseDir;
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  if (path.isAbsolute(p)) {
    return path.normalize(p);
  }
  return path.resolve(baseDir, p);
}

// Path resolver supporting ~ and dynamic active working directory
function resolvePath(p: string): string {
  return resolvePathToSystem(p, activeWorkingDir);
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settings = mergeWithDefaultSettings(JSON.parse(raw) || {});
    } else if (fs.existsSync(LEGACY_WORKSPACE_FILE)) {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_WORKSPACE_FILE, 'utf8'));
      settings = createDefaultSettings();
      if (legacy.workingDirectory && typeof legacy.workingDirectory === 'string') {
        settings.workspace.workingDirectory = legacy.workingDirectory;
        hasLegacyWorkspaceSettings = true;
      }
    } else {
      settings = createDefaultSettings();
    }
    const workingDirectory = settings.workspace?.workingDirectory;
    if (typeof workingDirectory === 'string') {
        const resolved = resolvePathToSystem(workingDirectory, PROJECT_ROOT);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          activeWorkingDir = resolved;
        }
      }
  } catch (err) {
    console.error('Failed to load settings:', err);
    settings = createDefaultSettings();
  }
  saveSettings();
}
loadSettings();

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    if (hasLegacyWorkspaceSettings) {
      fs.rmSync(LEGACY_WORKSPACE_FILE, { force: true });
      hasLegacyWorkspaceSettings = false;
    }
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

const PREFERENCE_SECTIONS = new Set(['videoDownload', 'transcribe', 'pipeline', 'modelDownload']);

app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.put('/api/settings/:section', (req, res) => {
  const { section } = req.params;
  if (!PREFERENCE_SECTIONS.has(section)) {
    return res.status(404).json({ error: '未知设置项。' });
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: '设置内容必须是对象。' });
  }
  settings[section] = { ...createDefaultSettings()[section], ...req.body };
  saveSettings();
  res.json(settings);
});

app.delete('/api/settings/:section', (req, res) => {
  const { section } = req.params;
  if (!PREFERENCE_SECTIONS.has(section)) {
    return res.status(404).json({ error: '未知设置项。' });
  }
  settings[section] = createDefaultSettings()[section];
  saveSettings();
  res.json(settings);
});

app.post('/api/settings/reset', (req, res) => {
  settings = createDefaultSettings();
  activeWorkingDir = PROJECT_ROOT;
  saveSettings();
  res.json(settings);
});

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
function checkBinary(nameOrPath: string, args = ['--version'], timeout = 5000): { available: boolean; path: string; version?: string; error?: string } {
  try {
    const res = spawnSync(nameOrPath, args, { encoding: 'utf8', timeout, windowsHide: true });
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
    // whisper-cli may initialise Metal/BLAS backends before rendering help on macOS.
    whisperCli: checkBinary(whisperCliPath, ['-h'], 15_000),
  };
}

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

function revealInFileManager(targetPath: string) {
  if (!fs.existsSync(targetPath)) {
    throw new Error('指定的文件或目录不存在。');
  }
  const isFile = fs.statSync(targetPath).isFile();
  if (process.platform === 'darwin') {
    const args = isFile ? ['-R', targetPath] : [targetPath];
    const result = spawnSync('open', args, { encoding: 'utf8', timeout: 10_000, windowsHide: true });
    if (result.error || result.status !== 0) {
      const parent = path.dirname(targetPath);
      spawnSync('open', [parent], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
    }
  } else if (process.platform === 'win32') {
    const args = isFile ? [`/select,${targetPath}`] : [targetPath];
    const result = spawnSync('explorer.exe', args, { encoding: 'utf8', timeout: 10_000, windowsHide: true });
    if (result.error || result.status !== 0) {
      const parent = path.dirname(targetPath);
      spawnSync('explorer.exe', [parent], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
    }
  } else {
    const dirToOpen = isFile ? path.dirname(targetPath) : targetPath;
    const result = spawnSync('xdg-open', [dirToOpen], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
    if (result.error || result.status !== 0) {
      throw new Error(`无法在文件管理器中打开：${result.error?.message || String(result.stderr ?? '').trim() || '未知错误'}`);
    }
  }
}

const VIDEO_MEDIA_EXTS = new Set(['.mp4', '.webm', '.m4v', '.mov']);
const VIDEO_OTHER_EXTS = new Set(['.mkv', '.avi', '.flv', '.ts', '.wmv', '.3gp', '.m4p', '.mpg', '.mpeg', '.vob']);
const AUDIO_MEDIA_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg']);
const AUDIO_OTHER_EXTS = new Set(['.flac', '.opus', '.wma', '.alac', '.aiff', '.ape']);
const TEXT_EXTS = new Set(['.txt', '.srt', '.vtt', '.lrc', '.wts', '.log', '.md']);
const DATA_EXTS = new Set(['.json', '.csv', '.tsv', '.xml', '.yaml', '.yml']);

const MEDIA_MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
};

function classifyOutputFile(ext: string): { category: 'video' | 'audio' | 'text' | 'data' | 'other'; previewType: 'text' | 'media' | 'none' } {
  const lower = (ext || '').toLowerCase();
  if (VIDEO_MEDIA_EXTS.has(lower)) {
    return { category: 'video', previewType: 'media' };
  }
  if (VIDEO_OTHER_EXTS.has(lower)) {
    return { category: 'video', previewType: 'none' };
  }
  if (AUDIO_MEDIA_EXTS.has(lower)) {
    return { category: 'audio', previewType: 'media' };
  }
  if (AUDIO_OTHER_EXTS.has(lower)) {
    return { category: 'audio', previewType: 'none' };
  }
  if (TEXT_EXTS.has(lower)) {
    return { category: 'text', previewType: 'text' };
  }
  if (DATA_EXTS.has(lower)) {
    return { category: 'data', previewType: 'text' };
  }
  return { category: 'other', previewType: 'none' };
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

// 0.2 GET /api/workspace
app.get('/api/workspace', (req, res) => {
  const exists = fs.existsSync(activeWorkingDir) && fs.statSync(activeWorkingDir).isDirectory();
  const writable = exists ? isDirectoryWritable(activeWorkingDir) : false;
  res.json({
    currentWorkingDir: activeWorkingDir,
    projectRoot: PROJECT_ROOT,
    isDefault: path.resolve(activeWorkingDir) === path.resolve(PROJECT_ROOT),
    homeDir: os.homedir(),
    exists,
    writable,
  });
});

// 0.3 POST /api/workspace
app.post('/api/workspace', (req, res) => {
  const { directory, createIfNotExists } = req.body || {};
  if (!directory || typeof directory !== 'string' || !directory.trim()) {
    return res.status(400).json({ error: '请提供有效的工作目录路径。' });
  }

  const targetPath = resolvePathToSystem(directory.trim(), PROJECT_ROOT);

  if (!fs.existsSync(targetPath)) {
    if (createIfNotExists) {
      try {
        fs.mkdirSync(targetPath, { recursive: true });
      } catch (err: any) {
        return res.status(500).json({ error: `无法创建目标目录：${err.message}` });
      }
    } else {
      return res.status(404).json({ error: `指定目录不存在：${targetPath}。勾选“若不存在则自动创建”可自动建立。` });
    }
  }

  try {
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: `指定路径不是文件夹目录：${targetPath}` });
    }

    activeWorkingDir = path.resolve(targetPath);
    settings.workspace = { workingDirectory: activeWorkingDir };
    saveSettings();

    const writable = isDirectoryWritable(activeWorkingDir);
    res.json({
      message: '工作目录已切换并保存',
      currentWorkingDir: activeWorkingDir,
      projectRoot: PROJECT_ROOT,
      isDefault: path.resolve(activeWorkingDir) === path.resolve(PROJECT_ROOT),
      homeDir: os.homedir(),
      exists: true,
      writable,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 0.4 POST /api/workspace/reset
app.post('/api/workspace/reset', (req, res) => {
  activeWorkingDir = PROJECT_ROOT;
  settings.workspace = createDefaultSettings().workspace;
  saveSettings();
  res.json({
    message: '所有设置已恢复为默认值',
    currentWorkingDir: activeWorkingDir,
    projectRoot: PROJECT_ROOT,
    isDefault: true,
    homeDir: os.homedir(),
    exists: true,
    writable: isDirectoryWritable(activeWorkingDir),
  });
});

// 0.5 GET /api/workspace/browse
app.get('/api/workspace/browse', (req, res) => {
  try {
    const targetDir = req.query.dir ? resolvePathToSystem(req.query.dir as string, PROJECT_ROOT) : activeWorkingDir;
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: '目录不存在' });
    }
    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: '目标路径不是目录' });
    }

    const parentDir = path.dirname(targetDir);
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });

    const directories: Array<{ name: string; path: string; isAccessible: boolean }> = [];
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const full = path.join(targetDir, entry.name);
        try {
          fs.accessSync(full, fs.constants.R_OK);
          directories.push({ name: entry.name, path: full, isAccessible: true });
        } catch {
          directories.push({ name: entry.name, path: full, isAccessible: false });
        }
      }
    }

    directories.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      current: targetDir,
      parent: parentDir !== targetDir ? parentDir : null,
      projectRoot: PROJECT_ROOT,
      homeDir: os.homedir(),
      directories,
    });
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

    const isDefaultCwd = path.resolve(activeWorkingDir) === path.resolve(PROJECT_ROOT);
    const cwdExists = fs.existsSync(activeWorkingDir);
    const cwdWritable = cwdExists ? isDirectoryWritable(activeWorkingDir) : false;

    res.json({
      defaultModelDir,
      defaultModel: process.env.WHISPER_DEFAULT_MODEL || 'large-v3-turbo-q5_0',
      homeDir: os.homedir(),
      cwd: activeWorkingDir,
      projectRoot: PROJECT_ROOT,
      isDefaultCwd,
      workspace: {
        currentWorkingDir: activeWorkingDir,
        projectRoot: PROJECT_ROOT,
        isDefault: isDefaultCwd,
        homeDir: os.homedir(),
        exists: cwdExists,
        writable: cwdWritable,
      },
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

  const runRoot = resolvePath(options.runRoot || 'pipeline');
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
  let outputFiles: Array<{
    name: string;
    path: string;
    relativePath: string;
    size: number;
    ext: string;
    category: 'video' | 'audio' | 'text' | 'data' | 'other';
    previewType: 'text' | 'media' | 'none';
    parentDirectory: string;
    pipelineTaskId?: string;
    pipelineTaskTitle?: string;
  }> = [];

  if (job.outputDir && fs.existsSync(job.outputDir)) {
    try {
      const taskTitleMap = new Map<string, string>();
      if (job.pipelineBatch?.items) {
        for (const item of job.pipelineBatch.items) {
          taskTitleMap.set(item.id, item.url || item.id);
        }
      }

      const findFilesRecursive = (dir: string): typeof outputFiles => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const list: typeof outputFiles = [];
        for (const entry of entries) {
          // Finder metadata and internal pipeline documents are not user-facing
          // outputs. Their presence must not create phantom result items.
          if (entry.name.startsWith('.') || entry.name === 'task.json' || entry.name === 'batch.json' || entry.name === 'job.json') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            const ext = path.extname(entry.name).toLowerCase();
            const relativePath = path.relative(job.outputDir!, fullPath).replace(/\\/g, '/');
            const { category, previewType } = classifyOutputFile(ext);

            let pipelineTaskId: string | undefined;
            let pipelineTaskTitle: string | undefined;
            const match = relativePath.match(/^items\/([^/]+)/);
            if (match) {
              pipelineTaskId = match[1];
              pipelineTaskTitle = taskTitleMap.get(pipelineTaskId);
              if (!pipelineTaskTitle) {
                const subTaskJsonPath = path.join(job.outputDir!, 'items', pipelineTaskId, 'task.json');
                if (fs.existsSync(subTaskJsonPath)) {
                  try {
                    const subData = JSON.parse(fs.readFileSync(subTaskJsonPath, 'utf8'));
                    pipelineTaskTitle = subData.url || subData.id || pipelineTaskId;
                    taskTitleMap.set(pipelineTaskId, pipelineTaskTitle);
                  } catch {}
                }
              }
            }

            list.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              size: stat.size,
              ext,
              category,
              previewType,
              parentDirectory: path.dirname(fullPath),
              pipelineTaskId,
              pipelineTaskTitle,
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
      return res.status(400).json({ error: '文件过大（超过 10MB），无法在网页中直接预览' });
    }

    const ext = path.extname(resolved).toLowerCase();
    const content = fs.readFileSync(resolved, 'utf8');
    res.json({
      path: resolved,
      fileName: path.basename(resolved),
      size: stat.size,
      ext,
      content,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. POST /api/files/reveal (Reveal file or folder in OS Native File Manager)
app.post('/api/files/reveal', (req, res) => {
  const targetPath = req.body?.path as string;
  if (!targetPath || typeof targetPath !== 'string') {
    return res.status(400).json({ error: '请提供有效的文件或目录路径。' });
  }

  const resolved = resolvePath(targetPath);
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: '文件或目录不存在。' });
  }

  try {
    revealInFileManager(resolved);
    res.json({
      success: true,
      path: resolved,
      parentDirectory: path.dirname(resolved),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || '无法在文件管理器中定位。' });
  }
});

// 12. GET /api/files/download (Direct file download)
app.get('/api/files/download', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const resolved = resolvePath(filePath);
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: '文件不存在。' });
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    return res.status(400).json({ error: '指定路径不是文件。' });
  }

  const fileName = path.basename(resolved);
  res.download(resolved, fileName, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: `下载失败: ${err.message}` });
    }
  });
});

// 13. GET /api/files/media (Media streaming with HTTP Range support)
app.get('/api/files/media', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const resolved = resolvePath(filePath);
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: '媒体文件不存在。' });
  }

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      return res.status(400).json({ error: '指定路径不是文件。' });
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MEDIA_MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || start >= fileSize || end < start) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const safeEnd = Math.min(end, fileSize - 1);
      const chunkSize = safeEnd - start + 1;
      const fileStream = fs.createReadStream(resolved, { start, end: safeEnd });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${safeEnd}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
      });

      fs.createReadStream(resolved).pipe(res);
    }
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: `无法读取媒体文件: ${err.message}` });
    }
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
