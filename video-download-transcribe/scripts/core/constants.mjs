import os from 'node:os';
import path from 'node:path';

export const DEFAULT_WHISPER_MODEL_DIR = process.env.WHISPER_MODEL_DIR
  ?? path.join(os.homedir(), '.cache', 'whisper-cpp');
export const DEFAULT_WHISPER_MODEL = process.env.WHISPER_DEFAULT_MODEL ?? 'large-v3-turbo-q5_0';
export const DEFAULT_WHISPER_MODEL_REPOSITORY = process.env.WHISPER_MODEL_REPOSITORY
  ?? 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
export const WHISPER_MODEL_CATALOG = 'https://huggingface.co/ggerganov/whisper.cpp/tree/main';

export const COMMON_WHISPER_MODELS = [
  ['tiny', '75 MiB', '最快，适合快速试用'],
  ['base', '142 MiB', '轻量转写'],
  ['small', '466 MiB', '速度与效果的常用平衡'],
  ['medium', '1.5 GiB', '更高准确率'],
  ['large-v3-turbo', '1.5 GiB', '高质量且较快'],
  ['large-v3-turbo-q5_0', '547 MiB', '高质量、量化、较省内存（默认）'],
  ['large-v3', '2.9 GiB', '最高质量，资源和耗时最大'],
];

export const MEDIA_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mov', '.mkv', '.webm', '.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus', '.aac',
]);

export const TRANSCRIPT_FORMATS = new Map([
  ['txt', { argument: '-otxt', extension: 'txt' }],
  ['srt', { argument: '-osrt', extension: 'srt' }],
  ['vtt', { argument: '-ovtt', extension: 'vtt' }],
  ['json', { argument: '-oj', extension: 'json' }],
  ['json-full', { argument: '-ojf', extension: 'json' }],
  ['csv', { argument: '-ocsv', extension: 'csv' }],
  ['lrc', { argument: '-olrc', extension: 'lrc' }],
  ['wts', { argument: '-owts', extension: 'wts' }],
]);
