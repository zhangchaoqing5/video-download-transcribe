export type JobKind = 'download' | 'model-download' | 'transcribe' | 'pipeline';
export type JobStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface JobProgressData {
  loaded: number;
  total: number;
  percentage: number;
  speed?: string;
  phase?: 'preparing' | 'transcribing';
  fileIndex?: number;
  fileCount?: number;
}

export interface PipelineTaskItem {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  error?: string;
  videoDir?: string;
  videoFiles?: string[];
  transcriptDir?: string;
  transcriptFiles?: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineBatchData {
  batchId: string;
  createdAt: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  total: number;
  completed: number;
  failed: number;
  downloadOnly: boolean;
  items: PipelineTaskItem[];
}

export interface JobRecord {
  id: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  params: Record<string, any>;
  logs: string;
  error?: string;
  outputDir?: string;
  progress?: JobProgressData;
  result?: any;
  pipelineBatch?: PipelineBatchData;
}

export interface ToolStatus {
  available: boolean;
  path: string;
  version?: string;
  error?: string;
}

export interface WorkspaceConfig {
  currentWorkingDir: string;
  projectRoot: string;
  isDefault: boolean;
  homeDir: string;
  exists: boolean;
  writable: boolean;
}

export interface SystemDefaults {
  defaultModelDir: string;
  defaultModel: string;
  homeDir: string;
  cwd: string;
  projectRoot: string;
  isDefaultCwd: boolean;
  workspace?: WorkspaceConfig;
  tools: {
    ytDlp: ToolStatus;
    ffmpeg: ToolStatus;
    whisperCli: ToolStatus;
  };
  installedModels: Array<{
    name: string;
    fileName: string;
    path: string;
    sizeBytes: number;
    sizeFormatted: string;
  }>;
}

export interface UserSettings {
  workspace?: { workingDirectory?: string };
  videoDownload?: Partial<Omit<DownloadFormState, 'urls'>>;
  modelDownload?: Partial<ModelDownloadFormState>;
  transcribe?: Partial<Omit<TranscribeFormState, 'inputs'>>;
  pipeline?: Partial<Omit<PipelineFormState, 'urls' | 'batchId'>>;
}

export interface DownloadFormState {
  urls: string;
  output: string;
  quality: string;
  parallel: number;
  cookies: 'none' | 'browser' | 'file';
  browser: string;
  browserProfile: string;
  cookiesFile: string;
  ytDlp: string;
  ffmpeg: string;
  jsRuntime: 'auto' | 'node' | 'deno';
  remoteEjs: 'none' | 'npm' | 'github';
  extraArgs: string[];
}

export interface ModelDownloadFormState {
  model: string;
  modelDir: string;
  repository: string;
  force: boolean;
}

export interface TranscribeFormState {
  inputs: string[];
  recursive: boolean;
  output: string;
  overwrite: boolean;
  keepWav: boolean;
  model: string;
  modelDir: string;
  whisperCli: string;
  ffmpeg: string;
  formats: string[];
  language: string;
  task: 'transcribe' | 'translate';
  gpuEnabled: boolean;
  gpuDevice?: number;
  threads?: number;
  processors?: number;
  offsetMs?: number;
  durationMs?: number;
  maxLen?: number;
  wordTimestamps: boolean;
  temperature?: number;
  prompt: string;
  printProgress: boolean;
  vadEnabled: boolean;
  vadModel: string;
  extraArgs: string[];
}

export interface PipelineFormState {
  urls: string;
  runRoot: string;
  batchId: string;
  downloadParallel: number;
  // Download params
  quality: string;
  cookies: 'none' | 'browser' | 'file';
  browser: string;
  browserProfile: string;
  cookiesFile: string;
  ytDlp: string;
  ffmpeg: string;
  jsRuntime: 'auto' | 'node' | 'deno';
  remoteEjs: 'none' | 'npm' | 'github';
  downloadExtraArgs: string[];
  // Transcribe params
  model: string;
  modelDir: string;
  whisperCli: string;
  formats: string[];
  language: string;
  task: 'transcribe' | 'translate';
  gpuEnabled: boolean;
  gpuDevice?: number;
  threads?: number;
  processors?: number;
  offsetMs?: number;
  durationMs?: number;
  maxLen?: number;
  wordTimestamps: boolean;
  temperature?: number;
  prompt: string;
  vadEnabled: boolean;
  vadModel: string;
  transcribeExtraArgs: string[];
}

export type ThemeMode = 'midnight' | 'light';

export interface ThemeOption {
  id: ThemeMode;
  name: string;
  desc: string;
  previewClass: string;
  iconName: 'sparkles' | 'sun';
}
