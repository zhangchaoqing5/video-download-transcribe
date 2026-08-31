export interface DownloadOptions {
  urls: string[];
  output?: string;
  outputTemplate?: string;
  captureTitle?: boolean;
  quality?: string;
  parallel?: number;
  cookies?: 'none' | 'browser' | 'file';
  browser?: string;
  browserProfile?: string;
  cookiesFile?: string;
  ytDlp?: string;
  ffmpeg?: string;
  jsRuntime?: 'auto' | 'node' | 'deno';
  remoteEjs?: 'npm' | 'github';
  extraArgs?: string[];
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void;
  onEvent?: (event: Record<string, any>) => void;
  checkDependencies?: boolean;
  cwd?: string;
}

export interface DownloadResult {
  options: Record<string, any>;
  results: Array<{ url: string; ok: boolean; error?: string; title?: string }>;
}

export interface ModelDownloadOptions {
  model?: string;
  modelDir?: string;
  repository?: string;
  force?: boolean;
  logger?: { log: (...args: any[]) => void };
  onProgress?: (progress: { received: number; total?: number }) => void;
  cwd?: string;
}

export interface ModelDownloadResult {
  destination: string;
  skipped: boolean;
}

export interface TranscriptionProgress {
  phase: 'preparing' | 'transcribing';
  fileIndex: number;
  fileCount: number;
  percentage: number;
}

export interface TranscribeOptions {
  inputs: string[];
  model?: string;
  modelDir?: string;
  output?: string;
  whisperCli?: string;
  ffmpeg?: string;
  formats?: string | string[];
  language?: string;
  task?: 'transcribe' | 'translate';
  threads?: number | string;
  processors?: number | string;
  offsetMs?: number | string;
  durationMs?: number | string;
  maxLen?: number | string;
  wordTimestamps?: boolean;
  temperature?: number | string;
  prompt?: string;
  gpuEnabled?: boolean;
  gpuDevice?: number | string;
  printProgress?: boolean;
  vadEnabled?: boolean;
  vadModel?: string;
  keepWav?: boolean;
  overwrite?: boolean;
  recursive?: boolean;
  dryRun?: boolean;
  extraArgs?: string[];
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void;
  onProgress?: (progress: TranscriptionProgress) => void;
  checkDependencies?: boolean;
  cwd?: string;
}

export interface TranscribeResult {
  options: Record<string, any>;
  mediaFiles: string[];
  results: Array<{ input: string; outputBase: string; skipped?: boolean; commands?: string[] }>;
}

export interface PipelineOptions extends Omit<DownloadOptions, 'output'>, Omit<TranscribeOptions, 'inputs' | 'output'> {
  urls: string[];
  runRoot?: string;
  batchId?: string;
  downloadParallel?: number;
  downloadOnly?: boolean;
  downloadExtraArgs?: string[];
  transcribeExtraArgs?: string[];
  logger?: { log: (...args: any[]) => void; error?: (...args: any[]) => void };
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void;
  checkDependencies?: boolean;
  cwd?: string;
}

export interface PipelineResult {
  batchDirectory: string;
  batchId: string;
  items: Array<{
    id: string;
    url: string;
    title?: string;
    directory: string;
    download: { status: string; error?: string };
    transcription: { status: string; error?: string };
  }>;
  failed: Array<any>;
}

export function downloadUrls(options: DownloadOptions): Promise<DownloadResult>;
export function downloadWhisperModel(options?: ModelDownloadOptions): Promise<ModelDownloadResult>;
export function transcribeMedia(options: TranscribeOptions): Promise<TranscribeResult>;
export function runPipeline(options: PipelineOptions): Promise<PipelineResult>;
export function whisperModelFilename(model: string): string;
export function whisperModelPath(modelDir: string, model: string): string;
export function commonModelsText(): string;
export class SkillError extends Error {}
