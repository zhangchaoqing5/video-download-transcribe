import React, { useEffect, useRef, useState } from 'react';
import { Layers, Upload, Download, Settings2, Sliders, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { CAPABILITY_CATALOG } from '../capabilityCatalog';
import { ExtraArgsEditor } from './ExtraArgsEditor';
import { PipelineFormState, SystemDefaults, UserSettings } from '../types';

interface PipelineViewProps {
  systemDefaults: SystemDefaults | null;
  onSubmit: (data: PipelineFormState) => Promise<void>;
  isSubmitting: boolean;
  onNavigateToModels: () => void;
  preferences?: UserSettings['pipeline'];
  onPreferencesChange: (preferences: UserSettings['pipeline']) => void;
  onResetPreferences: () => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  systemDefaults,
  onSubmit,
  isSubmitting,
  onNavigateToModels,
  preferences,
  onPreferencesChange,
  onResetPreferences,
}) => {
  const [formData, setFormData] = useState<PipelineFormState>({
    urls: '',
    runRoot: CAPABILITY_CATALOG.defaults.pipelineRunsRoot,
    batchId: '',
    downloadParallel: 1,
    quality: 'best',
    cookies: 'none',
    browser: 'chrome',
    browserProfile: '',
    cookiesFile: '',
    ytDlp: 'yt-dlp',
    ffmpeg: 'ffmpeg',
    jsRuntime: 'auto',
    remoteEjs: 'none',
    downloadExtraArgs: [],
    model: CAPABILITY_CATALOG.defaults.defaultModel,
    modelDir: systemDefaults?.defaultModelDir || '~/.cache/whisper-cpp',
    whisperCli: 'whisper-cli',
    formats: ['txt', 'srt'],
    language: 'auto',
    task: 'transcribe',
    gpuEnabled: true,
    gpuDevice: undefined,
    threads: undefined,
    processors: undefined,
    offsetMs: undefined,
    durationMs: undefined,
    maxLen: undefined,
    wordTimestamps: false,
    temperature: undefined,
    prompt: '',
    vadEnabled: false,
    vadModel: '',
    transcribeExtraArgs: [],
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [urlFileLoadedName, setUrlFileLoadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultForm = useRef(formData);
  const hadPreferences = useRef(Boolean(preferences));
  const savedPreferences = useRef<UserSettings['pipeline']>({ ...formData, urls: undefined, batchId: undefined } as UserSettings['pipeline']);

  useEffect(() => {
    if (preferences) {
      savedPreferences.current = preferences;
      setFormData((current) => ({ ...current, ...preferences }));
    } else if (hadPreferences.current) {
      setFormData(defaultForm.current);
      savedPreferences.current = { ...defaultForm.current, urls: undefined, batchId: undefined } as UserSettings['pipeline'];
    }
    hadPreferences.current = Boolean(preferences);
  }, [preferences]);

  useEffect(() => {
    const next = { ...formData, urls: undefined, batchId: undefined } as UserSettings['pipeline'];
    if (JSON.stringify(next) !== JSON.stringify(savedPreferences.current)) {
      savedPreferences.current = next;
      onPreferencesChange(next);
    }
  }, [formData, onPreferencesChange]);

  // Sync modelDir
  React.useEffect(() => {
    if (systemDefaults?.defaultModelDir && formData.modelDir === '~/.cache/whisper-cpp') {
      setFormData((prev) => ({ ...prev, modelDir: systemDefaults.defaultModelDir }));
    }
  }, [systemDefaults]);

  const isModelInstalled = (systemDefaults?.installedModels || []).some(
    (m) => m.name.toLowerCase() === formData.model.toLowerCase()
  );

  const validUrlLines = formData.urls
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setFormData((prev) => ({
          ...prev,
          urls: prev.urls ? `${prev.urls}\n${content}` : content,
        }));
        setUrlFileLoadedName(file.name);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const toggleFormat = (formatVal: string) => {
    setFormData((prev) => {
      const exists = prev.formats.includes(formatVal);
      if (exists) {
        if (prev.formats.length === 1) return prev;
        return { ...prev, formats: prev.formats.filter((f) => f !== formatVal) };
      } else {
        return { ...prev, formats: [...prev.formats, formatVal] };
      }
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validUrlLines.length === 0) {
      alert('请至少输入一个有效的视频 URL');
      return;
    }
    if (formData.cookies === 'file' && !formData.cookiesFile.trim()) {
      alert('请填写 Cookies 文件的本地绝对路径');
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 max-w-4xl mx-auto py-6 px-4">
      <div className="text-right"><button type="button" onClick={onResetPreferences} className="text-xs text-zinc-400 hover:text-zinc-100">恢复默认设置</button></div>
      {/* Missing model banner */}
      {!isModelInstalled && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                转写所选模型 <code className="font-mono bg-amber-900/60 px-1 py-0.5 rounded text-amber-200 border border-amber-800/80">{formData.model}</code> 尚未在本地检测到
              </p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Pipeline 运行到转写步骤将需要此模型。建议先前往“模型管理”完成下载。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToModels}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg transition-colors shrink-0 cursor-pointer shadow-sm"
          >
            前往模型管理
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Banner / Description */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">一键下载 + 转写 Pipeline 任务</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              为每个目标 URL 创建独立隔离目录：<code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700 font-mono">pipeline/&lt;batch&gt;/items/&lt;task&gt;/video & transcript</code>
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md">
            已解析: {validUrlLines.length} 个任务
          </span>
        </div>

        {/* URLs input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              视频 URL 列表 (每行一个) <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.list"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 px-3 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                导入 .txt 文件
              </button>
              {urlFileLoadedName && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded">
                  <Check className="w-3 h-3" /> 已导入
                </span>
              )}
            </div>
          </div>

          <textarea
            value={formData.urls}
            onChange={(e) => setFormData({ ...formData, urls: e.target.value })}
            rows={4}
            placeholder="https://www.youtube.com/watch?v=...&#10;https://www.bilibili.com/video/..."
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950 border border-zinc-700 rounded-xl focus:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
            required
          />
        </div>

        {/* Batch configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-zinc-800">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              批次根目录 (runRoot)
            </label>
            <input
              type="text"
              value={formData.runRoot}
              onChange={(e) => setFormData({ ...formData, runRoot: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
              placeholder="pipeline"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              自定义批次 ID (留空自动生成)
            </label>
            <input
              type="text"
              value={formData.batchId}
              onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
              placeholder="例如: batch_meeting_01"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              下载并发数 (downloadParallel)
            </label>
            <select
              value={formData.downloadParallel}
              onChange={(e) => setFormData({ ...formData, downloadParallel: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.parallel.map((n) => (
                <option key={n} value={n}>
                  {n} 任务并发
                </option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Download & Transcribe Core Options Card */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-6">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          下载与识别核心参数配置
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              下载画质 (Quality)
            </label>
            <select
              value={formData.quality}
              onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.quality.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Cookie 认证凭据
            </label>
            <select
              value={formData.cookies}
              onChange={(e) => setFormData({ ...formData, cookies: e.target.value as any })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.cookiesSource.map((cs) => (
                <option key={cs.value} value={cs.value}>
                  {cs.label}
                </option>
              ))}
            </select>
          </div>

          {/* Conditional cookies file or browser */}
          {formData.cookies === 'file' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Cookie 文件路径 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.cookiesFile}
                onChange={(e) => setFormData({ ...formData, cookiesFile: e.target.value })}
                placeholder="/path/to/cookies.txt"
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg font-mono text-zinc-100 placeholder-zinc-600"
                required
              />
            </div>
          )}

          {formData.cookies === 'browser' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                读取浏览器
              </label>
              <select
                value={formData.browser}
                onChange={(e) => setFormData({ ...formData, browser: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100"
              >
                {CAPABILITY_CATALOG.browsers.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Transcribe options */}
        <div className="pt-4 border-t border-zinc-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Whisper 模型
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100"
                >
                  {CAPABILITY_CATALOG.whisperModels.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.name} ({m.size})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  转写音频语种
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100"
                >
                  {CAPABILITY_CATALOG.languages.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  转写任务模式
                </label>
                <select
                  value={formData.task}
                  onChange={(e) => setFormData({ ...formData, task: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100"
                >
                  {CAPABILITY_CATALOG.tasks.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Formats */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                字幕及转写输出格式
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CAPABILITY_CATALOG.formats.map((fmt) => {
                  const isChecked = formData.formats.includes(fmt.value);
                  return (
                    <button
                      type="button"
                      key={fmt.value}
                      onClick={() => toggleFormat(fmt.value)}
                      className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'border-zinc-500 bg-zinc-800/90 text-zinc-100 ring-1 ring-zinc-500'
                          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <span className="text-xs font-medium">{fmt.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded ${isChecked ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'}`}>
                        {fmt.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>
      </div>

      {/* Advanced Executable Paths & Extra Args */}
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-semibold text-sm text-zinc-200 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-400" />
            <span>Pipeline 高级执行参数与硬件加速</span>
          </div>
          <span className="text-xs text-zinc-400">
            {showAdvanced ? '收起配置' : '展开下载及转写附加参数'}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-zinc-800 space-y-5 bg-zinc-950/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  yt-dlp 命令路径
                </label>
                <input
                  type="text"
                  value={formData.ytDlp}
                  onChange={(e) => setFormData({ ...formData, ytDlp: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg font-mono text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  ffmpeg 命令路径
                </label>
                <input
                  type="text"
                  value={formData.ffmpeg}
                  onChange={(e) => setFormData({ ...formData, ffmpeg: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg font-mono text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  whisper-cli 命令路径
                </label>
                <input
                  type="text"
                  value={formData.whisperCli}
                  onChange={(e) => setFormData({ ...formData, whisperCli: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg font-mono text-zinc-100"
                />
              </div>
            </div>

            {/* Extra args for download and transcribe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <ExtraArgsEditor
                args={formData.downloadExtraArgs}
                onChange={(args) => setFormData({ ...formData, downloadExtraArgs: args })}
                label="下载阶段附加参数 (downloadExtraArgs)"
                placeholder="--write-subs"
              />

              <ExtraArgsEditor
                args={formData.transcribeExtraArgs}
                onChange={(args) => setFormData({ ...formData, transcribeExtraArgs: args })}
                label="转写阶段附加参数 (transcribeExtraArgs)"
                placeholder="--beam-size 5"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || validUrlLines.length === 0}
          className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-white active:bg-zinc-200 text-zinc-950 font-semibold text-sm rounded-xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Layers className="w-4 h-4 text-zinc-900" />
          {isSubmitting ? '正在创建 Pipeline...' : `启动 Pipeline 任务 (${validUrlLines.length} 个目标)`}
        </button>
      </div>
    </form>
  );
};
