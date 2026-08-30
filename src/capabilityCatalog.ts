/**
 * Static Capability Catalog as defined by PRD Section 4.
 * Static typed enums only - NOT dynamically generated from --help text.
 */

export interface CatalogOption<T = string> {
  label: string;
  value: T;
  description?: string;
  badge?: string;
}

export interface WhisperModelInfo {
  value: string;
  name: string;
  size: string;
  purpose: string;
  isDefault?: boolean;
}

export const CAPABILITY_CATALOG = {
  // Download qualities
  quality: [
    { label: '最佳质量 (best)', value: 'best' },
    { label: '4320p (8K 超高清)', value: '4320' },
    { label: '2160p (4K 超高清)', value: '2160' },
    { label: '1440p (2K 2.5K)', value: '1440' },
    { label: '1080p (全高清 FHD)', value: '1080' },
    { label: '720p (高清 HD)', value: '720' },
    { label: '480p (标清 SD)', value: '480' },
    { label: '360p (流畅)', value: '360' },
    { label: '240p (低清)', value: '240' },
    { label: '144p (极低)', value: '144' },
  ] as CatalogOption<string>[],

  // Download parallelism
  parallel: [1, 2, 3, 4, 5, 6, 7, 8] as const,

  // Cookies source
  cookiesSource: [
    { label: '不使用 Cookie (none)', value: 'none', description: '适用于无需登录的公开视频' },
    { label: '从本地浏览器读取 (browser)', value: 'browser', description: '自动从本地浏览器安全凭据中获取' },
    { label: '从 Cookies 文件加载 (file)', value: 'file', description: '指定导出的 Netscape 格式 cookies.txt 文件路径' },
  ] as CatalogOption<'none' | 'browser' | 'file'>[],

  // Browser options for yt-dlp --cookies-from-browser
  browsers: [
    { label: 'Google Chrome', value: 'chrome' },
    { label: 'Brave Browser', value: 'brave' },
    { label: 'Chromium', value: 'chromium' },
    { label: 'Microsoft Edge', value: 'edge' },
    { label: 'Mozilla Firefox', value: 'firefox' },
    { label: 'Opera', value: 'opera' },
    { label: 'Apple Safari', value: 'safari' },
    { label: 'Vivaldi', value: 'vivaldi' },
    { label: 'Naver Whale', value: 'whale' },
  ] as CatalogOption<string>[],

  // JS runtime engine
  jsRuntime: [
    { label: 'yt-dlp 默认（仅 Deno）', value: 'auto', description: '不传 --js-runtimes；yt-dlp 默认只启用 Deno，不会自动改用 Node' },
    { label: 'Node.js', value: 'node' },
    { label: 'Deno', value: 'deno' },
  ] as CatalogOption<'auto' | 'node' | 'deno'>[],

  // Remote EJS extractor
  remoteEjs: [
    { label: '不启用 (none)', value: 'none' },
    { label: 'npm 源', value: 'npm' },
    { label: 'GitHub 源', value: 'github' },
  ] as CatalogOption<'none' | 'npm' | 'github'>[],

  // Whisper models list (Section 4.3)
  whisperModels: [
    {
      value: 'tiny',
      name: 'Tiny',
      size: '75 MiB',
      purpose: '最快，快速试用与测试',
    },
    {
      value: 'base',
      name: 'Base',
      size: '142 MiB',
      purpose: '轻量转写，资源占用极低',
    },
    {
      value: 'small',
      name: 'Small',
      size: '466 MiB',
      purpose: '速度与效果平衡',
    },
    {
      value: 'medium',
      name: 'Medium',
      size: '1.5 GiB',
      purpose: '更高准确率，多语言通用',
    },
    {
      value: 'large-v3-turbo',
      name: 'Large-v3-Turbo',
      size: '1.5 GiB',
      purpose: '高质量且转写速度较快',
    },
    {
      value: 'large-v3-turbo-q5_0',
      name: 'Large-v3-Turbo (Q5_0)',
      size: '547 MiB',
      purpose: '高质量量化模型，兼具速度与低显存消耗 (推荐默认)',
      isDefault: true,
    },
    {
      value: 'large-v3',
      name: 'Large-v3',
      size: '2.9 GiB',
      purpose: '最高识别质量，需要较多显存/内存资源',
    },
  ] as WhisperModelInfo[],

  // Transcribe formats (Section 4.4)
  formats: [
    { label: '纯文本 (.txt)', value: 'txt', badge: '纯文本', description: '适合直接阅读与全文检索' },
    { label: '标准字幕 (.srt)', value: 'srt', badge: '时间轴字幕', description: '通用视频播放器及剪辑软件字幕' },
    { label: 'Web 字幕 (.vtt)', value: 'vtt', badge: '时间轴字幕', description: '网页 HTML5 播放器格式' },
    { label: '轻量 JSON (.json)', value: 'json', badge: '结构化数据', description: '包含时间戳与分段文本' },
    { label: '完整 JSON (.json-full)', value: 'json-full', badge: '完整元数据', description: '包含词级别置信度与所有声学特征' },
    { label: '表格数据 (.csv)', value: 'csv', badge: '表格格式', description: '便于导入 Excel / Pandas 批量处理' },
    { label: '歌词同步 (.lrc)', value: 'lrc', badge: '歌词格式', description: '逐句时间同步歌词' },
    { label: '字词时间戳 (.wts)', value: 'wts', badge: '字词粒度', description: '高精度字词级时间戳数据' },
  ] as Array<CatalogOption<string> & { badge: string }>,

  // Transcribe languages
  languages: [
    { label: '自动检测语言 (auto)', value: 'auto' },
    { label: '中文 (zh / Chinese)', value: 'zh' },
    { label: '英语 (en / English)', value: 'en' },
    { label: '日语 (ja / Japanese)', value: 'ja' },
    { label: '韩语 (ko / Korean)', value: 'ko' },
    { label: '法语 (fr / French)', value: 'fr' },
    { label: '德语 (de / German)', value: 'de' },
    { label: '西班牙语 (es / Spanish)', value: 'es' },
    { label: '俄语 (ru / Russian)', value: 'ru' },
    { label: '葡萄牙语 (pt / Portuguese)', value: 'pt' },
    { label: '意大利语 (it / Italian)', value: 'it' },
    { label: '阿拉伯语 (ar / Arabic)', value: 'ar' },
    { label: '印地语 (hi / Hindi)', value: 'hi' },
    { label: '越南语 (vi / Vietnamese)', value: 'vi' },
    { label: '泰语 (th / Thai)', value: 'th' },
    { label: '印尼语 (id / Indonesian)', value: 'id' },
    { label: '土耳其语 (tr / Turkish)', value: 'tr' },
    { label: '荷兰语 (nl / Dutch)', value: 'nl' },
    { label: '波兰语 (pl / Polish)', value: 'pl' },
    { label: '乌克兰语 (uk / Ukrainian)', value: 'uk' },
  ] as CatalogOption<string>[],

  // Transcribe tasks
  tasks: [
    { label: '转写为原文 (transcribe)', value: 'transcribe', description: '保留音频对应语种的原始文字内容' },
    { label: '翻译为英文 (translate)', value: 'translate', description: '自动将识别到的多语言内容翻译为英语字幕' },
  ] as CatalogOption<'transcribe' | 'translate'>[],

  // Defaults
  defaults: {
    downloadOutput: 'videos',
    transcribeOutput: 'transcripts',
    pipelineRunsRoot: 'pipeline',
    defaultModel: 'large-v3-turbo-q5_0',
    defaultFormats: ['txt', 'srt'],
    modelRepository: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main',
    officialModelsUrl: 'https://github.com/ggerganov/whisper.cpp/blob/master/models/README.md',
  },
};
