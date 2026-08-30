import React, { useEffect, useRef, useState } from 'react';
import { Cpu, Download, HardDrive, ExternalLink, CheckCircle2, RotateCw, Sparkles, AlertCircle } from 'lucide-react';
import { CAPABILITY_CATALOG, WhisperModelInfo } from '../capabilityCatalog';
import { ModelDownloadFormState, SystemDefaults, UserSettings } from '../types';

interface WhisperModelViewProps {
  systemDefaults: SystemDefaults | null;
  onSubmitDownload: (data: ModelDownloadFormState) => Promise<void>;
  isSubmitting: boolean;
  onRefreshDefaults: () => void;
  preferences?: UserSettings['modelDownload'];
  onPreferencesChange: (preferences: UserSettings['modelDownload']) => void;
  onResetPreferences: () => void;
}

export const WhisperModelView: React.FC<WhisperModelViewProps> = ({
  systemDefaults,
  onSubmitDownload,
  isSubmitting,
  onRefreshDefaults,
  preferences,
  onPreferencesChange,
  onResetPreferences,
}) => {
  const [formData, setFormData] = useState<ModelDownloadFormState>({
    model: CAPABILITY_CATALOG.defaults.defaultModel,
    modelDir: systemDefaults?.defaultModelDir || '~/.cache/whisper-cpp',
    repository: CAPABILITY_CATALOG.defaults.modelRepository,
    force: false,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const defaultForm = useRef(formData);
  const hadPreferences = useRef(Boolean(preferences));
  const savedPreferences = useRef<UserSettings['modelDownload']>(formData);

  useEffect(() => {
    if (preferences) {
      savedPreferences.current = preferences;
      setFormData((current) => ({ ...current, ...preferences }));
    } else if (hadPreferences.current) {
      setFormData(defaultForm.current);
      savedPreferences.current = defaultForm.current;
    }
    hadPreferences.current = Boolean(preferences);
  }, [preferences]);

  useEffect(() => {
    if (JSON.stringify(formData) !== JSON.stringify(savedPreferences.current)) {
      savedPreferences.current = formData;
      onPreferencesChange(formData);
    }
  }, [formData, onPreferencesChange]);

  // Sync modelDir when systemDefaults is loaded if not touched
  React.useEffect(() => {
    if (systemDefaults?.defaultModelDir && formData.modelDir === '~/.cache/whisper-cpp') {
      setFormData((prev) => ({ ...prev, modelDir: systemDefaults.defaultModelDir }));
    }
  }, [systemDefaults]);

  const installedModelNames = new Set(
    (systemDefaults?.installedModels || []).map((m) => m.name.toLowerCase())
  );

  const handleDownload = (modelName: string) => {
    const target = {
      ...formData,
      model: modelName,
    };
    setFormData(target);
    onSubmitDownload(target);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6 px-4">
      {/* Overview & Official Link */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100">Whisper.cpp 语音模型管理</h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-300 rounded-md border border-blue-500/30">
                GGML Models
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              下载与管理本地语音识别模型。转写服务将直接从本地缓存目录加载模型文件。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onResetPreferences} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/70 rounded-lg transition-colors cursor-pointer">
              恢复默认设置
            </button>
            <button
              onClick={onRefreshDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 rounded-lg transition-colors cursor-pointer"
              title="重新扫描本地已安装模型"
            >
              <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
              刷新本地状态
            </button>
            <a
              href={CAPABILITY_CATALOG.defaults.officialModelsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/70 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              官方模型目录说明
            </a>
          </div>
        </div>

        {/* Directory Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              模型存放目录 (Model Directory)
            </label>
            <input
              type="text"
              value={formData.modelDir}
              onChange={(e) => setFormData({ ...formData, modelDir: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
              placeholder="~/.cache/whisper-cpp"
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              默认解析至系统缓存目录：<code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700 font-mono">{systemDefaults?.defaultModelDir || '~/.cache/whisper-cpp'}</code>
            </p>
          </div>

          <div className="flex items-center gap-4 pt-4 sm:pt-6">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-zinc-300">
              <input
                type="checkbox"
                checked={formData.force}
                onChange={(e) => setFormData({ ...formData, force: e.target.checked })}
                className="w-4 h-4 rounded text-zinc-900 bg-zinc-900 border-zinc-700 accent-zinc-100"
              />
              <span>强制重新下载 (覆盖已有本地模型)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            可用 Whisper 官方标准与量化模型 (7个规格)
          </h3>
          <span className="text-xs text-zinc-400">
            已就绪: {systemDefaults?.installedModels?.length || 0} 个模型
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {CAPABILITY_CATALOG.whisperModels.map((m: WhisperModelInfo) => {
            const isInstalled = installedModelNames.has(m.value.toLowerCase());
            const installedInfo = systemDefaults?.installedModels?.find(
              (im) => im.name.toLowerCase() === m.value.toLowerCase()
            );

            return (
              <div
                key={m.value}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isInstalled
                    ? 'bg-emerald-950/20 border-emerald-800/60'
                    : m.isDefault
                    ? 'bg-zinc-800/70 border-zinc-600 ring-1 ring-zinc-500/30'
                    : 'bg-[#121316] border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-zinc-100">{m.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded">
                      {m.size}
                    </span>
                    {m.isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-950 rounded">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        推荐默认
                      </span>
                    )}
                    {isInstalled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        已下载 ({installedInfo?.sizeFormatted})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{m.purpose}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(m.value)}
                    disabled={isSubmitting}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      isInstalled
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                        : 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-md'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isInstalled ? '重新下载' : '下载此模型'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Repository Config */}
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 text-left font-semibold text-xs text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <span>高级模型源镜像仓库配置 (Repository Base URL)</span>
          <span className="text-zinc-400">{showAdvanced ? '收起' : '展开'}</span>
        </button>

        {showAdvanced && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/40 space-y-2">
            <input
              type="text"
              value={formData.repository}
              onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
              placeholder="https://huggingface.co/ggerganov/whisper.cpp/resolve/main"
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
            />
            <p className="text-[11px] text-zinc-400">
              若遇到 HuggingFace 下载受限，可配置国内镜像源或自定义 HuggingFace 代理地址。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
