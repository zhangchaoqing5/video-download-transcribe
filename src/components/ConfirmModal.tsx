import React from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  Clock,
  Video,
  FileText,
  Layers,
  Cpu,
  ShieldAlert,
  FolderOpen,
  Info,
} from 'lucide-react';
import { JobRecord, JobKind, JobStatus } from '../types';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  job?: JobRecord | null;
  description?: React.ReactNode;
  warningNote?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  job,
  description,
  warningNote,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const isRunningJob = job && (job.status === 'running' || job.status === 'queued');

  const getKindLabel = (kind?: JobKind) => {
    switch (kind) {
      case 'download':
        return { label: '视频下载', icon: Video, color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' };
      case 'model-download':
        return { label: '模型下载', icon: Cpu, color: 'text-purple-300 bg-purple-500/10 border-purple-500/30' };
      case 'transcribe':
        return { label: '本地转写', icon: FileText, color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
      case 'pipeline':
        return { label: '一键 Pipeline', icon: Layers, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
      default:
        return { label: '任务', icon: Clock, color: 'text-zinc-300 bg-zinc-800 border-zinc-700' };
    }
  };

  const getStatusBadge = (status?: JobStatus) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            执行中
          </span>
        );
      case 'complete':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            已完成
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
            失败
          </span>
        );
      case 'queued':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
            排队中
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[#121316] w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col transition-all animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                isRunningJob || variant === 'danger'
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : variant === 'warning'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              {isRunningJob ? (
                <ShieldAlert className="w-5 h-5" />
              ) : variant === 'danger' ? (
                <Trash2 className="w-4.5 h-4.5" />
              ) : variant === 'warning' ? (
                <AlertTriangle className="w-4.5 h-4.5" />
              ) : (
                <Info className="w-4.5 h-4.5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
              <p className="text-xs text-zinc-400">
                {isRunningJob ? '注意：目标任务正在后台执行中' : '请核对以下操作详情'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs text-zinc-300">
          {/* Job metadata card if job object is provided */}
          {job && (
            <div className="p-3.5 bg-zinc-950/90 rounded-xl border border-zinc-800/90 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const km = getKindLabel(job.kind);
                    const KindIcon = km.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${km.color}`}>
                        <KindIcon className="w-3 h-3" />
                        {km.label}
                      </span>
                    );
                  })()}
                  <span className="font-mono text-xs text-zinc-200 font-semibold">{job.id}</span>
                </div>
                {getStatusBadge(job.status)}
              </div>

              <div className="text-[11px] text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
                <span>创建时间: {new Date(job.createdAt).toLocaleString()}</span>
                {job.outputDir && (
                  <span className="truncate max-w-[260px]" title={job.outputDir}>
                    输出: {job.outputDir}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {description && <div className="leading-relaxed text-zinc-300">{description}</div>}

          {/* Warning / Informational Callout Box */}
          {isRunningJob ? (
            <div className="p-3.5 bg-red-950/30 border border-red-800/50 rounded-xl text-red-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-red-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>执行中任务移除提醒</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-red-200/90 pl-1 leading-relaxed">
                <li>该任务将立即从任务列表和监控面板中移除，后台事件不再更新此记录。</li>
                <li>此操作仅移除界面的记录跟踪，<strong>不会强制终止</strong>操作系统已启动的底层进程（如 yt-dlp、ffmpeg 或 whisper-cli）。</li>
                <li>所有已下载或转写的本地输出文件均<strong>不会被删除</strong>。</li>
              </ul>
            </div>
          ) : warningNote ? (
            <div className="p-3 bg-zinc-900/80 border border-zinc-700/60 rounded-xl text-zinc-300 text-[11px] leading-relaxed">
              {warningNote}
            </div>
          ) : (
            <div className="p-3 bg-zinc-900/70 border border-zinc-800 rounded-xl text-zinc-400 text-[11px] flex items-start gap-2 leading-relaxed">
              <FolderOpen className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <span>
                本次操作仅删除任务中心中的记录与执行日志，<strong>不会删除</strong>您在磁盘中已生成的任何音视频、字幕或文本产物文件。
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
              isRunningJob || variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/40 border border-red-500/40'
                : variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/40 border border-amber-500/40'
                : 'bg-zinc-100 hover:bg-white text-zinc-900 shadow-md'
            }`}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>处理中…</span>
              </>
            ) : (
              <>
                {isRunningJob ? <ShieldAlert className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
