import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  FolderPlus,
  FolderOpen,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowUp,
  HardDrive,
  Info,
  ExternalLink,
} from 'lucide-react';
import { WorkspaceConfig } from '../types';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceConfig | null;
  onWorkspaceChanged: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface BrowseData {
  current: string;
  parent: string | null;
  projectRoot: string;
  homeDir: string;
  directories: Array<{ name: string; path: string; isAccessible: boolean }>;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  workspace,
  onWorkspaceChanged,
  onShowToast,
}) => {
  const [customPath, setCustomPath] = useState('');
  const [createIfNotExists, setCreateIfNotExists] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseData | null>(null);
  const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);
  const [nativeSelecting, setNativeSelecting] = useState(false);

  useEffect(() => {
    if (isOpen && workspace) {
      setCustomPath(workspace.currentWorkingDir);
    }
  }, [isOpen, workspace]);

  if (!isOpen) return null;

  const handleFetchBrowse = async (targetDir?: string) => {
    setIsLoadingBrowse(true);
    try {
      const url = targetDir
        ? `/api/workspace/browse?dir=${encodeURIComponent(targetDir)}`
        : '/api/workspace/browse';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '无法读取目录列表');
      setBrowseData(data);
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsLoadingBrowse(false);
    }
  };

  const handleToggleBrowse = () => {
    if (!isBrowsing) {
      handleFetchBrowse(workspace?.currentWorkingDir);
    }
    setIsBrowsing((prev) => !prev);
  };

  const handleSelectFromBrowse = (dirPath: string) => {
    setCustomPath(dirPath);
    setIsBrowsing(false);
  };

  const handleNativeChoose = async () => {
    setNativeSelecting(true);
    try {
      const res = await fetch('/api/files/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'directory' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '系统目录选择器未返回');
      if (Array.isArray(data.paths) && data.paths.length > 0) {
        setCustomPath(data.paths[0]);
      }
    } catch (err: any) {
      onShowToast(`未能使用系统选择器: ${err.message}，您也可以直接输入路径或使用内置浏览器`, 'info');
    } finally {
      setNativeSelecting(false);
    }
  };

  const handleSwitchWorkspace = async (targetPath: string) => {
    if (!targetPath.trim()) {
      onShowToast('请输入或选择有效的工作目录路径', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory: targetPath.trim(),
          createIfNotExists,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '切换工作目录失败');
      onShowToast(data.message || '工作目录已切换并持久化保存', 'success');
      onWorkspaceChanged();
      onClose();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/workspace/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '重置工作目录失败');
      onShowToast('已恢复为项目默认工作目录', 'success');
      onWorkspaceChanged();
      onClose();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentDir = workspace?.currentWorkingDir || '';
  const isDefaultDir = workspace?.isDefault ?? true;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121316] w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 flex items-center justify-center">
              <Folder className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">工作目录配置与切换</h3>
              <p className="text-xs text-zinc-400">配置任务的相对路径根目录，自动保存至项目配置持久记忆</p>
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Current Active Workspace Card */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">当前工作目录</span>
              <div className="flex items-center gap-2">
                {isDefaultDir ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-md">
                    项目默认
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-md">
                    自定义目录
                  </span>
                )}
                {workspace?.writable ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-md">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> 可读写
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-md">
                    <AlertTriangle className="w-3 h-3 text-amber-400" /> 只读或受限
                  </span>
                )}
              </div>
            </div>

            <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <HardDrive className="w-4 h-4 text-zinc-400 shrink-0" />
                <code className="text-xs font-mono text-zinc-200 truncate select-all">{currentDir}</code>
              </div>
              {!isDefaultDir && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isSubmitting}
                  className="shrink-0 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 rounded border border-zinc-700 transition-colors cursor-pointer"
                  title="恢复为项目启动默认目录"
                >
                  <RotateCcw className="w-3 h-3" />
                  恢复默认
                </button>
              )}
            </div>
          </div>

          {/* Directory Input and Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-zinc-300">
              设定新工作目录
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="例如: /Users/username/workspace 或 ~/Downloads/media"
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={handleNativeChoose}
                disabled={nativeSelecting}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-xl border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="打开系统文件夹选择窗口"
              >
                <FolderOpen className="w-4 h-4 text-zinc-300" />
                <span>系统选择</span>
              </button>
              <button
                type="button"
                onClick={handleToggleBrowse}
                className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  isBrowsing
                    ? 'bg-zinc-100 text-zinc-950 border-white'
                    : 'bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 border-zinc-700'
                }`}
                title="在网页内展开文件夹树浏览"
              >
                <Folder className="w-4 h-4 text-zinc-300" />
                <span>内置浏览</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createIfNotExists}
                  onChange={(e) => setCreateIfNotExists(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-zinc-200 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-xs text-zinc-400">若指定目录不存在则自动创建文件夹</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomPath(workspace?.projectRoot || '')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 transition-colors"
                >
                  项目根目录
                </button>
                <button
                  type="button"
                  onClick={() => setCustomPath(workspace?.homeDir || '~')}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 transition-colors"
                >
                  用户主目录 ~
                </button>
              </div>
            </div>
          </div>

          {/* Embedded Folder Browser */}
          {isBrowsing && (
            <div className="p-4 rounded-xl border border-zinc-700 bg-zinc-950 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-zinc-300">浏览路径:</span>
                  <code className="text-xs font-mono text-zinc-400 truncate">{browseData?.current}</code>
                </div>
                {browseData?.parent && (
                  <button
                    type="button"
                    onClick={() => handleFetchBrowse(browseData.parent!)}
                    disabled={isLoadingBrowse}
                    className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-2 py-1 bg-zinc-800 rounded border border-zinc-700 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" />
                    上一级
                  </button>
                )}
              </div>

              {isLoadingBrowse ? (
                <div className="py-6 text-center text-xs text-zinc-400">正在读取目录内容...</div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-xs text-zinc-300 font-mono flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-zinc-400" />
                      当前浏览目录 [.]
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectFromBrowse(browseData?.current || '')}
                      className="text-xs px-2.5 py-1 bg-zinc-100 text-zinc-950 font-semibold rounded hover:bg-white cursor-pointer"
                    >
                      选定此文件夹
                    </button>
                  </div>
                  {browseData?.directories?.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-3 text-center">此目录下无可见子文件夹</p>
                  ) : (
                    browseData?.directories.map((dir) => (
                      <div
                        key={dir.path}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleFetchBrowse(dir.path)}
                          className="flex items-center gap-2 text-xs text-zinc-200 font-mono hover:text-white text-left truncate flex-1 cursor-pointer"
                        >
                          <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{dir.name}</span>
                          <ChevronRight className="w-3 h-3 text-zinc-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectFromBrowse(dir.path)}
                          className="text-xs px-2 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded border border-zinc-700/60 cursor-pointer ml-2"
                        >
                          选择
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Path Resolution Guide */}
          <div className="p-3.5 bg-zinc-900/60 rounded-xl text-xs text-zinc-400 border border-zinc-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-300">
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              <span>任务相对路径解析基准</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              切换后，表单中的相对路径将自动相对于当前工作目录解析：
            </p>
            <div className="font-mono text-[11px] space-y-1 pl-1 text-zinc-300">
              <div>• 视频下载输出: <code className="text-zinc-200 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">{customPath || currentDir}/videos</code></div>
              <div>• 本地转写输出: <code className="text-zinc-200 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">{customPath || currentDir}/transcripts</code></div>
              <div>• Pipeline 批次: <code className="text-zinc-200 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">{customPath || currentDir}/pipeline</code></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            持久配置保存在 <code className="text-zinc-400">.local-data/settings.json</code>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => handleSwitchWorkspace(customPath)}
              disabled={isSubmitting || !customPath.trim()}
              className="px-5 py-2 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? '保存切换中...' : '应用并切换目录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
