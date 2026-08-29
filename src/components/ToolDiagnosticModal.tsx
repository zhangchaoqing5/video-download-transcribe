import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw, Terminal, Wrench } from 'lucide-react';
import { SystemDefaults } from '../types';

interface ToolDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemDefaults: SystemDefaults | null;
  onRefresh: () => void;
  onOpenWorkspace?: () => void;
}

export const ToolDiagnosticModal: React.FC<ToolDiagnosticModalProps> = ({
  isOpen,
  onClose,
  systemDefaults,
  onRefresh,
  onOpenWorkspace,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const tools = systemDefaults?.tools;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121316] w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">本地环境与 CLI 工具诊断</h3>
              <p className="text-xs text-zinc-400">检测 yt-dlp, ffmpeg 与 whisper-cli 是否在当前环境可调用</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Tool 1: yt-dlp */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100 font-mono">yt-dlp</span>
                <span className="text-xs text-zinc-400">视频流与音频下载提取器</span>
              </div>
              {tools?.ytDlp?.available ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 已就绪
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> 未检测到
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-zinc-300 space-y-1">
              <div>命令路径: <code className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-200">{tools?.ytDlp?.path || 'yt-dlp'}</code></div>
              {tools?.ytDlp?.version && <div className="text-zinc-400">版本信息: {tools.ytDlp.version}</div>}
              {tools?.ytDlp?.error && <div className="text-red-400 font-mono">诊断错误: {tools.ytDlp.error}</div>}
            </div>
          </div>

          {/* Tool 2: ffmpeg */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100 font-mono">ffmpeg</span>
                <span className="text-xs text-zinc-400">音视频转码与 16kHz PCM WAV 提取</span>
              </div>
              {tools?.ffmpeg?.available ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 已就绪
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> 未检测到
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-zinc-300 space-y-1">
              <div>命令路径: <code className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-200">{tools?.ffmpeg?.path || 'ffmpeg'}</code></div>
              {tools?.ffmpeg?.version && <div className="text-zinc-400">版本信息: {tools.ffmpeg.version}</div>}
              {tools?.ffmpeg?.error && <div className="text-red-400 font-mono">诊断错误: {tools.ffmpeg.error}</div>}
            </div>
          </div>

          {/* Tool 3: whisper-cli */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100 font-mono">whisper-cli</span>
                <span className="text-xs text-zinc-400">whisper.cpp 高性能 C++ 离线推理引擎</span>
              </div>
              {tools?.whisperCli?.available ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 已就绪
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> 未检测到
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-zinc-300 space-y-1">
              <div>命令路径: <code className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-200">{tools?.whisperCli?.path || 'whisper-cli'}</code></div>
              {tools?.whisperCli?.version && <div className="text-zinc-400">版本信息: {tools.whisperCli.version}</div>}
              {tools?.whisperCli?.error && <div className="text-red-400 font-mono">诊断错误: {tools.whisperCli.error}</div>}
            </div>
          </div>

          <div className="p-3.5 bg-zinc-900/80 rounded-xl text-xs text-zinc-400 border border-zinc-800">
            <strong className="text-zinc-200">自定义路径提示：</strong> 若二进制未加入系统环境变量 PATH，可以在各表单“高级配置”中直接输入指定绝对路径（例如 <code className="font-mono text-zinc-300 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-700">/usr/local/bin/whisper-cli</code> 或 <code className="font-mono text-zinc-300 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-700">C:\tools\yt-dlp.exe</code>）。
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              工作目录: <code className="font-mono text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{systemDefaults?.cwd}</code>
            </span>
            {onOpenWorkspace && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWorkspace();
                }}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
              >
                切换
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
              重新检测
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
