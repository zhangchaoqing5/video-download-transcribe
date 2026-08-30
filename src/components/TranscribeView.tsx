import React, { useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2, Settings2, AlertCircle, Cpu, Sliders, CheckSquare, Sparkles, ArrowRight } from 'lucide-react';
import { CAPABILITY_CATALOG } from '../capabilityCatalog';
import { ExtraArgsEditor } from './ExtraArgsEditor';
import { TranscribeFormState, SystemDefaults, UserSettings } from '../types';

interface TranscribeViewProps {
  systemDefaults: SystemDefaults | null;
  onSubmit: (data: TranscribeFormState) => Promise<void>;
  isSubmitting: boolean;
  onNavigateToModels: () => void;
  preferences?: UserSettings['transcribe'];
  onPreferencesChange: (preferences: UserSettings['transcribe']) => void;
  onResetPreferences: () => void;
}

export const TranscribeView: React.FC<TranscribeViewProps> = ({
  systemDefaults,
  onSubmit,
  isSubmitting,
  onNavigateToModels,
  preferences,
  onPreferencesChange,
  onResetPreferences,
}) => {
  const [formData, setFormData] = useState<TranscribeFormState>({
    inputs: [''],
    recursive: false,
    output: CAPABILITY_CATALOG.defaults.transcribeOutput,
    overwrite: false,
    keepWav: false,
    model: CAPABILITY_CATALOG.defaults.defaultModel,
    modelDir: systemDefaults?.defaultModelDir || '~/.cache/whisper-cpp',
    whisperCli: 'whisper-cli',
    ffmpeg: 'ffmpeg',
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
    printProgress: true,
    vadEnabled: false,
    vadModel: '',
    extraArgs: [],
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const defaultForm = useRef(formData);
  const hadPreferences = useRef(Boolean(preferences));
  const savedPreferences = useRef<UserSettings['transcribe']>({ ...formData, inputs: undefined } as UserSettings['transcribe']);

  useEffect(() => {
    if (preferences) {
      savedPreferences.current = preferences;
      setFormData((current) => ({ ...current, ...preferences }));
    } else if (hadPreferences.current) {
      setFormData(defaultForm.current);
      savedPreferences.current = { ...defaultForm.current, inputs: undefined } as UserSettings['transcribe'];
    }
    hadPreferences.current = Boolean(preferences);
  }, [preferences]);

  useEffect(() => {
    const next = { ...formData, inputs: undefined } as UserSettings['transcribe'];
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

  // Check if selected model is installed locally
  const isModelInstalled = (systemDefaults?.installedModels || []).some(
    (m) => m.name.toLowerCase() === formData.model.toLowerCase()
  );

  const handleAddInput = () => {
    setFormData((prev) => ({ ...prev, inputs: [...prev.inputs, ''] }));
  };

  const [isSelecting, setIsSelecting] = useState<false | 'file' | 'directory'>(false);

  const handleNativeSelection = async (kind: 'file' | 'directory') => {
    setIsSelecting(kind);
    try {
      const res = await fetch('/api/files/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '无法打开系统文件选择器');
      if (!Array.isArray(data.paths) || data.paths.length === 0) return;
      setFormData((prev) => {
        const inputs = [...new Set([...prev.inputs.map((item) => item.trim()).filter(Boolean), ...data.paths])];
        return { ...prev, inputs };
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleUpdateInput = (index: number, val: string) => {
    const updated = [...formData.inputs];
    updated[index] = val;
    setFormData((prev) => ({ ...prev, inputs: updated }));
  };

  const handleRemoveInput = (index: number) => {
    const updated = formData.inputs.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, inputs: updated.length ? updated : [''] }));
  };

  const toggleFormat = (formatVal: string) => {
    setFormData((prev) => {
      const exists = prev.formats.includes(formatVal);
      if (exists) {
        if (prev.formats.length === 1) return prev; // At least one format required
        return { ...prev, formats: prev.formats.filter((f) => f !== formatVal) };
      } else {
        return { ...prev, formats: [...prev.formats, formatVal] };
      }
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validInputs = formData.inputs.map((i) => i.trim()).filter(Boolean);
    if (validInputs.length === 0) {
      alert('请至少输入一个媒体文件或目录路径');
      return;
    }
    if (formData.formats.length === 0) {
      alert('请至少选择一种转写输出格式（如 txt 或 srt）');
      return;
    }
    onSubmit({ ...formData, inputs: validInputs });
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 max-w-4xl mx-auto py-6 px-4">
      <div className="text-right"><button type="button" onClick={onResetPreferences} className="text-xs text-zinc-400 hover:text-zinc-100">恢复默认设置</button></div>
      {/* Top Banner / Missing Model Notice */}
      {!isModelInstalled && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                当前所选模型 <code className="font-mono bg-amber-900/60 px-1 py-0.5 rounded text-amber-200 border border-amber-800/80">{formData.model}</code> 尚未在本地缓存中检测到
              </p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                请先前往“模型管理”完成模型下载，或切换为已下载的其它模型。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToModels}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-lg transition-colors shrink-0 cursor-pointer shadow-sm"
          >
            前往模型管理下载
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Media Inputs Section */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100">1. 输入媒体文件或目录</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              支持音视频文件（.mp4, .mkv, .mp3, .wav, .m4a, .flac 等）或包含媒体的文件夹路径
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleNativeSelection('file')}
              disabled={Boolean(isSelecting)}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              <FileText className="w-3.5 h-3.5" />
              {isSelecting === 'file' ? '正在打开…' : '选择文件'}
            </button>
            <button
              type="button"
              onClick={() => handleNativeSelection('directory')}
              disabled={Boolean(isSelecting)}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {isSelecting === 'directory' ? '正在打开…' : '选择文件夹'}
            </button>
            <button
              type="button"
              onClick={handleAddInput}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white px-2 py-1 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              手动输入
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {formData.inputs.map((inputPath, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={inputPath}
                onChange={(e) => handleUpdateInput(idx, e.target.value)}
                placeholder="点击“选择文件 / 文件夹”，或输入本地路径"
                className="flex-1 px-3.5 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-xl focus:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
                required
              />
              {formData.inputs.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveInput(idx)}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Directory scanning & Overwrite options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-800">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.recursive}
              onChange={(e) => setFormData({ ...formData, recursive: e.target.checked })}
              className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
            />
            <span>递归扫描子目录 (recursive)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.overwrite}
              onChange={(e) => setFormData({ ...formData, overwrite: e.target.checked })}
              className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
            />
            <span>覆盖已有输出 (overwrite)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.keepWav}
              onChange={(e) => setFormData({ ...formData, keepWav: e.target.checked })}
              className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
            />
            <span>保留 16kHz WAV 音频 (keepWav)</span>
          </label>
        </div>
      </div>

      {/* 2. Model & Formats Section */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-6">
        <h3 className="text-base font-bold text-zinc-100 pb-3 border-b border-zinc-800">
          2. 语音模型与输出格式
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Model Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Whisper 语音模型 (Model)
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.whisperModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name} ({m.size}) - {m.purpose}
                </option>
              ))}
            </select>
          </div>

          {/* Model Directory */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              模型目录 (Model Directory)
            </label>
            <input
              type="text"
              value={formData.modelDir}
              onChange={(e) => setFormData({ ...formData, modelDir: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
              placeholder="~/.cache/whisper-cpp"
            />
          </div>
        </div>

        {/* Output Formats Multi-select Checkboxes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300">
              输出产物格式 (至少选择一种)
            </label>
            <span className="text-[11px] text-zinc-400">
              说明：<strong className="text-zinc-200">txt</strong> 为纯文本，<strong className="text-zinc-200">srt/vtt</strong> 为带时间轴字幕
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CAPABILITY_CATALOG.formats.map((fmt) => {
              const isChecked = formData.formats.includes(fmt.value);
              return (
                <button
                  type="button"
                  key={fmt.value}
                  onClick={() => toggleFormat(fmt.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isChecked
                      ? 'border-zinc-500 bg-zinc-800/90 text-zinc-100 ring-1 ring-zinc-500'
                      : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{fmt.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        isChecked ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                      }`}
                    >
                      {fmt.badge}
                    </span>
                  </div>
                  <span className={`text-[11px] mt-1 line-clamp-1 ${isChecked ? 'text-zinc-300' : 'text-zinc-400'}`}>
                    {fmt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language & Task */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              音频语种 (Language)
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              转写任务模式 (Task)
            </label>
            <select
              value={formData.task}
              onChange={(e) => setFormData({ ...formData, task: e.target.value as any })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.tasks.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              输出文件夹 (Output Path)
            </label>
            <input
              type="text"
              value={formData.output}
              onChange={(e) => setFormData({ ...formData, output: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
              placeholder="transcripts"
            />
          </div>
        </div>
      </div>

      {/* 3. Advanced Hardware, Segmentation, VAD Options */}
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-semibold text-sm text-zinc-200 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-zinc-400" />
            <span>硬件加速、断句分段与 VAD 静音检测高级参数</span>
          </div>
          <span className="text-xs text-zinc-400">
            {showAdvanced ? '收起配置' : '展开 GPU、线程、时间戳等设置'}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-zinc-800 space-y-6 bg-zinc-950/40">
            {/* Hardware & GPU */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                计算资源与硬件加速
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-zinc-900/70 rounded-xl border border-zinc-800">
                  <input
                    type="checkbox"
                    id="gpuEnabled"
                    checked={formData.gpuEnabled}
                    onChange={(e) => setFormData({ ...formData, gpuEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
                  />
                  <label htmlFor="gpuEnabled" className="text-xs font-medium text-zinc-200 cursor-pointer">
                    启用 GPU 加速 (-ng 禁用开关)
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    GPU 设备编号
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.gpuDevice ?? ''}
                    onChange={(e) => setFormData({ ...formData, gpuDevice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="默认 0"
                    disabled={!formData.gpuEnabled}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    计算线程数 (threads)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.threads ?? ''}
                    onChange={(e) => setFormData({ ...formData, threads: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="自动"
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Segmentation & Mutually exclusive timestamps */}
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                分段长度与时间戳互斥规则
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800 flex flex-col justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.wordTimestamps}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({
                          ...formData,
                          wordTimestamps: checked,
                          maxLen: checked ? undefined : formData.maxLen,
                        });
                      }}
                      className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
                    />
                    <span>开启词级时间戳 (wordTimestamps)</span>
                  </label>
                  <span className="text-[10px] text-zinc-400 mt-1">
                    开启时将互斥禁用“单段最大字符数”
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    单段最大字符数 (maxLen)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxLen ?? ''}
                    onChange={(e) => setFormData({ ...formData, maxLen: e.target.value ? Number(e.target.value) : undefined })}
                    disabled={formData.wordTimestamps}
                    placeholder={formData.wordTimestamps ? '词级时间戳已启用（禁用）' : '例如: 40'}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-100 placeholder-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    温度采样 (temperature)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={formData.temperature ?? ''}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="默认 0.0"
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Time Offset & Prompt */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-800">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  初始提示词 (Prompt, 可引导专业术语/专有名词)
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  rows={2}
                  placeholder="例如: 以下是关于人工智能大模型与计算机视觉的学术讲座讨论。"
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100 placeholder-zinc-600"
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      起始偏移 (毫秒 offsetMs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.offsetMs ?? ''}
                      onChange={(e) => setFormData({ ...formData, offsetMs: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      最大时长 (毫秒 durationMs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.durationMs ?? ''}
                      onChange={(e) => setFormData({ ...formData, durationMs: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="完整音频"
                      className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.printProgress}
                      onChange={(e) => setFormData({ ...formData, printProgress: e.target.checked })}
                      className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
                    />
                    <span>打印识别进度 (-pp)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* VAD Section */}
            <div className="p-4 bg-zinc-900/70 rounded-xl border border-zinc-800 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.vadEnabled}
                  onChange={(e) => setFormData({ ...formData, vadEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
                />
                <span>启用 VAD 语音活动静音检测 (Voice Activity Detection)</span>
              </label>

              {formData.vadEnabled && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    VAD 模型文件路径 (vadModel) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vadModel}
                    onChange={(e) => setFormData({ ...formData, vadModel: e.target.value })}
                    placeholder="/path/to/ggml-vad.bin"
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
                    required={formData.vadEnabled}
                  />
                </div>
              )}
            </div>

            {/* Custom whisper-cli extra args */}
            <ExtraArgsEditor
              args={formData.extraArgs}
              onChange={(args) => setFormData({ ...formData, extraArgs: args })}
              label="高级 whisper-cli 参数 (extraArgs)"
              placeholder="例如: --best-of 5 或 --beam-size 5"
            />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-white active:bg-zinc-200 text-zinc-950 font-semibold text-sm rounded-xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <FileText className="w-4 h-4 text-zinc-900" />
          {isSubmitting ? '正在提交转写任务...' : '开始本地媒体转写'}
        </button>
      </div>
    </form>
  );
};
