import { JobOutputFile, PipelineBatchData } from '../types';

const VIDEO_MEDIA_EXTS = new Set(['.mp4', '.webm', '.m4v', '.mov']);
const VIDEO_OTHER_EXTS = new Set(['.mkv', '.avi', '.flv', '.ts', '.wmv', '.3gp', '.m4p', '.mpg', '.mpeg', '.vob']);
const AUDIO_MEDIA_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg']);
const AUDIO_OTHER_EXTS = new Set(['.flac', '.opus', '.wma', '.alac', '.aiff', '.ape']);
const TEXT_EXTS = new Set(['.txt', '.srt', '.vtt', '.lrc', '.wts', '.log', '.md']);
const DATA_EXTS = new Set(['.json', '.csv', '.tsv', '.xml', '.yaml', '.yml']);

export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function getFileCategory(ext: string): 'video' | 'audio' | 'text' | 'data' | 'other' {
  const lower = (ext || '').toLowerCase();
  if (VIDEO_MEDIA_EXTS.has(lower) || VIDEO_OTHER_EXTS.has(lower)) return 'video';
  if (AUDIO_MEDIA_EXTS.has(lower) || AUDIO_OTHER_EXTS.has(lower)) return 'audio';
  if (TEXT_EXTS.has(lower)) return 'text';
  if (DATA_EXTS.has(lower)) return 'data';
  return 'other';
}

export function getPreviewType(ext: string): 'text' | 'media' | 'none' {
  const lower = (ext || '').toLowerCase();
  if (VIDEO_MEDIA_EXTS.has(lower) || AUDIO_MEDIA_EXTS.has(lower)) return 'media';
  if (TEXT_EXTS.has(lower) || DATA_EXTS.has(lower)) return 'text';
  return 'none';
}

export function getCategoryLabel(category: 'video' | 'audio' | 'text' | 'data' | 'other'): string {
  switch (category) {
    case 'video':
      return '视频文件';
    case 'audio':
      return '音频文件';
    case 'text':
      return '文本与字幕';
    case 'data':
      return '结构化数据';
    case 'other':
    default:
      return '其他产物';
  }
}

export function getFormatBadge(ext: string): string {
  if (!ext) return 'FILE';
  const clean = ext.replace(/^\./, '').toUpperCase();
  return clean || 'FILE';
}

export interface GroupedOutputFiles {
  video: JobOutputFile[];
  audio: JobOutputFile[];
  text: JobOutputFile[];
  data: JobOutputFile[];
  other: JobOutputFile[];
}

export function groupOutputFiles(files: JobOutputFile[]): GroupedOutputFiles {
  const grouped: GroupedOutputFiles = {
    video: [],
    audio: [],
    text: [],
    data: [],
    other: [],
  };

  for (const file of files) {
    const category = file.category || getFileCategory(file.ext);
    if (category in grouped) {
      grouped[category].push(file);
    } else {
      grouped.other.push(file);
    }
  }

  return grouped;
}

export interface PipelineSubtaskGroup {
  taskId: string;
  title: string;
  url?: string;
  status?: string;
  subtaskDir?: string;
  videoFiles: JobOutputFile[];
  transcriptFiles: JobOutputFile[];
  dataFiles: JobOutputFile[];
  otherFiles: JobOutputFile[];
}

export interface GroupedPipelineFiles {
  subtasks: PipelineSubtaskGroup[];
  rootMetadataFiles: JobOutputFile[];
}

export function groupPipelineOutputFiles(
  files: JobOutputFile[],
  pipelineBatch?: PipelineBatchData
): GroupedPipelineFiles {
  const subtaskMap = new Map<string, PipelineSubtaskGroup>();
  const rootMetadataFiles: JobOutputFile[] = [];

  // Seed subtasks from pipelineBatch if provided
  if (pipelineBatch?.items) {
    for (const item of pipelineBatch.items) {
      subtaskMap.set(item.id, {
        taskId: item.id,
        title: item.url || item.id,
        url: item.url,
        status: item.status,
        videoFiles: [],
        transcriptFiles: [],
        dataFiles: [],
        otherFiles: [],
      });
    }
  }

  for (const file of files) {
    // Check if relativePath is inside items/<taskId>/...
    const rel = (file.relativePath || file.name).replace(/\\/g, '/');
    const match = rel.match(/^items\/([^/]+)/);

    if (match) {
      const taskId = match[1];
      let group = subtaskMap.get(taskId);
      if (!group) {
        group = {
          taskId,
          title: file.pipelineTaskTitle || taskId,
          videoFiles: [],
          transcriptFiles: [],
          dataFiles: [],
          otherFiles: [],
        };
        subtaskMap.set(taskId, group);
      }

      // Infer subtask directory
      if (!group.subtaskDir) {
        // file.path contains .../items/<taskId>/...
        const subtaskDirIndex = file.path.replace(/\\/g, '/').indexOf(`/items/${taskId}`);
        if (subtaskDirIndex !== -1) {
          group.subtaskDir = file.path.slice(0, subtaskDirIndex + `/items/${taskId}`.length);
        } else {
          group.subtaskDir = file.parentDirectory;
        }
      }

      const cat = file.category || getFileCategory(file.ext);
      if (cat === 'video') {
        group.videoFiles.push(file);
      } else if (cat === 'text') {
        group.transcriptFiles.push(file);
      } else if (cat === 'data') {
        group.dataFiles.push(file);
      } else {
        group.otherFiles.push(file);
      }
    } else {
      // Root level file (e.g. batch.json or root artifacts)
      rootMetadataFiles.push(file);
    }
  }

  return {
    subtasks: Array.from(subtaskMap.values()),
    rootMetadataFiles,
  };
}
