import React, { useEffect, useRef, useState } from 'react';
import { Upload, Download, AlertTriangle, ShieldCheck, Settings2, FileText, Check } from 'lucide-react';
import { CAPABILITY_CATALOG } from '../capabilityCatalog';
import { ExtraArgsEditor } from './ExtraArgsEditor';
import { DownloadFormState, UserSettings } from '../types';

interface VideoDownloadViewProps {
  onSubmit: (data: DownloadFormState) => Promise<void>;
  isSubmitting: boolean;
  preferences?: UserSettings['videoDownload'];
  onPreferencesChange: (preferences: UserSettings['videoDownload']) => void;
  onResetPreferences: () => void;
}

function toVideoDownloadPreferences({ urls: _urls, ...preferences }: DownloadFormState): UserSettings['videoDownload'] {
  return preferences;
}

export const VideoDownloadView: React.FC<VideoDownloadViewProps> = ({ onSubmit, isSubmitting, preferences, onPreferencesChange, onResetPreferences }) => {
  const [formData, setFormData] = useState<DownloadFormState>({
    urls: '',
    output: CAPABILITY_CATALOG.defaults.downloadOutput,
    quality: 'best',
    parallel: 1,
    cookies: 'none',
    browser: 'chrome',
    browserProfile: '',
    cookiesFile: '',
    ytDlp: 'yt-dlp',
    ffmpeg: 'ffmpeg',
    jsRuntime: 'auto',
    remoteEjs: 'none',
    extraArgs: [],
  });

  const [cookieRiskDismissed, setCookieRiskDismissed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [urlFileLoadedName, setUrlFileLoadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defaultForm = useRef(formData);
  const hadPreferences = useRef(Boolean(preferences));
  const savedPreferences = useRef<UserSettings['videoDownload']>(toVideoDownloadPreferences(formData));
  const preferencesSignature = JSON.stringify(preferences ?? null);
  const appliedPreferencesSignature = useRef<string | null>(null);

  useEffect(() => {
    if (appliedPreferencesSignature.current === preferencesSignature) return;
    appliedPreferencesSignature.current = preferencesSignature;
    if (preferences) {
      savedPreferences.current = preferences;
      setFormData((current) => ({ ...current, ...preferences }));
    } else if (hadPreferences.current) {
      setFormData(defaultForm.current);
      savedPreferences.current = toVideoDownloadPreferences(defaultForm.current);
    }
    hadPreferences.current = Boolean(preferences);
  }, [preferencesSignature]);

  useEffect(() => {
    const next = toVideoDownloadPreferences(formData);
    if (JSON.stringify(next) !== JSON.stringify(savedPreferences.current)) {
      savedPreferences.current = next;
      onPreferencesChange(next);
    }
  }, [formData, onPreferencesChange]);

  // Compute active URL lines count
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validUrlLines.length === 0) {
      alert('请至少输入一个有效的视频 URL（非空且不以 # 开头）');
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
      {/* Top Banner / Overview */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">批量视频下载 (yt-dlp)</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              提供 URL 列表，调用本地 yt-dlp 引擎批量提取视频、音轨及元数据
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 rounded-md">
            已解析: {validUrlLines.length} 个目标
          </span>
        </div>
        <button type="button" onClick={onResetPreferences} className="text-xs text-zinc-400 hover:text-zinc-100">恢复默认设置</button>

        {/* URL Inputs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
              <span>视频 URL 列表</span>
              <span className="text-red-400">*</span>
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                导入 URL 文本文件 (.txt)
              </button>
              {urlFileLoadedName && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 px-2 py-1 rounded">
                  <Check className="w-3 h-3" /> 已导入 {urlFileLoadedName}
                </span>
              )}
            </div>
          </div>

          <textarea
            value={formData.urls}
            onChange={(e) => setFormData({ ...formData, urls: e.target.value })}
            rows={5}
            placeholder={`https://www.youtube.com/watch?v=...\nhttps://www.bilibili.com/video/...\n# 支持使用 # 注释行，多行批量解析`}
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950/80 border border-zinc-700/80 rounded-xl focus:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 font-mono text-zinc-100 placeholder-zinc-500 leading-relaxed"
            required
          />
          <p className="text-xs text-zinc-400">
            每行填写一个 URL，前端将自动忽略空行以及以 <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700 font-mono font-semibold">#</code> 开头的注释行。
          </p>
        </div>
      </div>

      {/* Core Download Parameters */}
      <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-6">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          下载基础参数
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quality */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              目标画质 (Quality)
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

          {/* Parallel */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              并发下载数 (Parallel)
            </label>
            <select
              value={formData.parallel}
              onChange={(e) => setFormData({ ...formData, parallel: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
            >
              {CAPABILITY_CATALOG.parallel.map((n) => (
                <option key={n} value={n}>
                  {n} 任务并发
                </option>
              ))}
            </select>
          </div>

          {/* Output Directory */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              输出目录 (Output Path)
            </label>
            <input
              type="text"
              value={formData.output}
              onChange={(e) => setFormData({ ...formData, output: e.target.value })}
              placeholder="videos"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100 font-mono"
            />
          </div>
        </div>

        {/* Cookies Selection & Conditional Options */}
        <div className="pt-4 border-t border-zinc-800">
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Cookie 认证凭据 (Cookies Source)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CAPABILITY_CATALOG.cookiesSource.map((cs) => {
              const isSelected = formData.cookies === cs.value;
              return (
                <label
                  key={cs.value}
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-zinc-500 bg-zinc-800/80 ring-1 ring-zinc-500 text-zinc-100'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cookies"
                      value={cs.value}
                      checked={isSelected}
                      onChange={() => {
                        setFormData({ ...formData, cookies: cs.value });
                        if (cs.value !== 'none') setCookieRiskDismissed(false);
                      }}
                      className="accent-zinc-100"
                    />
                    <span className="text-xs font-semibold text-zinc-200">{cs.label}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 pl-5">{cs.description}</span>
                </label>
              );
            })}
          </div>

          {/* Cookie Security Warning Notice */}
          {formData.cookies !== 'none' && !cookieRiskDismissed && (
            <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start justify-between gap-3 text-amber-200">
              <div className="flex items-start gap-2 text-xs leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300">Cookie 安全与授权提示：</span>
                  请仅用于下载您拥有合法权限或已订阅的内容。系统服务端绝不会将 Cookie 明文内容写入任务日志或网络响应。
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCookieRiskDismissed(true)}
                className="text-xs font-medium text-amber-300 hover:text-amber-100 underline shrink-0 cursor-pointer"
              >
                我知道了
              </button>
            </div>
          )}

          {/* Conditional: Browser fields */}
          {formData.cookies === 'browser' && (
            <div className="mt-4 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  浏览器类型 (Browser)
                </label>
                <select
                  value={formData.browser}
                  onChange={(e) => setFormData({ ...formData, browser: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                >
                  {CAPABILITY_CATALOG.browsers.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  浏览器配置文件名称 (Browser Profile, 可选)
                </label>
                <input
                  type="text"
                  value={formData.browserProfile}
                  onChange={(e) => setFormData({ ...formData, browserProfile: e.target.value })}
                  placeholder="例如: Default 或 Profile 1"
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100 placeholder-zinc-600"
                />
              </div>
            </div>
          )}

          {/* Conditional: Cookie File Path */}
          {formData.cookies === 'file' && (
            <div className="mt-4 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Cookie 文件绝对路径 (Cookies File Path) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.cookiesFile}
                onChange={(e) => setFormData({ ...formData, cookiesFile: e.target.value })}
                placeholder="/path/to/cookies.txt"
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100 placeholder-zinc-600"
                required
              />
              <p className="text-xs text-zinc-400 mt-1">
                支持 Netscape 格式文本文件。出于安全考虑，服务仅接收本地路径并在内部调用，不上传文件内容。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Executable Paths & Arguments Collapsible */}
      <div className="bg-[#121316] rounded-2xl border border-zinc-800/80 shadow-md overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-semibold text-sm text-zinc-200 hover:bg-zinc-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-zinc-400" />
            <span>执行环境与高级参数配置</span>
          </div>
          <span className="text-xs text-zinc-400">
            {showAdvanced ? '收起配置' : '展开自定义 CLI 路径与附加参数'}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-zinc-800 space-y-5 bg-zinc-950/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  yt-dlp 路径 (可自定义指定可执行文件)
                </label>
                <input
                  type="text"
                  value={formData.ytDlp}
                  onChange={(e) => setFormData({ ...formData, ytDlp: e.target.value })}
                  placeholder="yt-dlp 或 /usr/local/bin/yt-dlp"
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  ffmpeg 路径 (可自定义指定可执行文件)
                </label>
                <input
                  type="text"
                  value={formData.ffmpeg}
                  onChange={(e) => setFormData({ ...formData, ffmpeg: e.target.value })}
                  placeholder="ffmpeg 或 /usr/local/bin/ffmpeg"
                  className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  JS Runtime 执行器
                </label>
                <select
                  value={formData.jsRuntime}
                  onChange={(e) => setFormData({ ...formData, jsRuntime: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                >
                  {CAPABILITY_CATALOG.jsRuntime.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  远程 EJS 解析器
                </label>
                <select
                  value={formData.remoteEjs}
                  onChange={(e) => setFormData({ ...formData, remoteEjs: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-100"
                >
                  {CAPABILITY_CATALOG.remoteEjs.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Extra args */}
            <ExtraArgsEditor
              args={formData.extraArgs}
              onChange={(args) => setFormData({ ...formData, extraArgs: args })}
              label="高级 yt-dlp 参数 (extraArgs)"
              placeholder="例如: --write-subs 或 --sub-lang zh-Hans,en"
            />
          </div>
        )}
      </div>

      {/* Submit Action */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || validUrlLines.length === 0}
          className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-100 hover:bg-white active:bg-zinc-200 text-zinc-950 font-semibold text-sm rounded-xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download className="w-4 h-4 text-zinc-900" />
          {isSubmitting ? '正在提交任务...' : `创建下载任务 (${validUrlLines.length} 个目标)`}
        </button>
      </div>
    </form>
  );
};
