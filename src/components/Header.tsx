import React from 'react';
import { Video, Cpu, FileText, Layers, ListOrdered, CheckCircle2, AlertCircle, Wrench, Folder } from 'lucide-react';
import { SystemDefaults, ThemeMode } from '../types';
import { ThemeSelector } from './ThemeSelector';

export type ActiveTab = 'download' | 'models' | 'transcribe' | 'pipeline' | 'jobs';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  systemDefaults: SystemDefaults | null;
  runningJobsCount: number;
  onOpenDiagnostics: () => void;
  onOpenWorkspace: () => void;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  systemDefaults,
  runningJobsCount,
  onOpenDiagnostics,
  onOpenWorkspace,
  currentTheme,
  onThemeChange,
}) => {
  const tabs = [
    { id: 'download' as const, label: '视频下载', icon: Video, desc: 'yt-dlp 批量下载' },
    { id: 'models' as const, label: '模型管理', icon: Cpu, desc: 'Whisper 模型仓库' },
    { id: 'transcribe' as const, label: '本地转写', icon: FileText, desc: 'whisper.cpp 语音转写' },
    { id: 'pipeline' as const, label: '一键 Pipeline', icon: Layers, desc: '下载 + 转写隔离任务' },
    { id: 'jobs' as const, label: '任务中心', icon: ListOrdered, desc: '日志与产物监控', badge: runningJobsCount > 0 ? runningJobsCount : undefined },
  ];

  const currentCwd = systemDefaults?.cwd || '';
  const isDefaultCwd = systemDefaults?.isDefaultCwd ?? true;

  // Short display name for working directory
  const shortCwd = currentCwd.length > 28
    ? '...' + currentCwd.slice(-25)
    : currentCwd;

  return (
    <header className="bg-[#121316]/90 border-b border-zinc-800/80 sticky top-0 z-30 shadow-md backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100 shadow-inner">
              <Video className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-zinc-100 tracking-tight">视频下载与转写控制台</h1>
                <span className="text-[11px] font-medium bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700/70">
                  Local Skill UI
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                调用 @video-download-transcribe/skill 本地 API
              </p>
            </div>
          </div>

          {/* System CLI Tools & Workspace Badges */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Working Directory Quick Switcher */}
            <button
              onClick={onOpenWorkspace}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-700/70 text-zinc-200 transition-colors shadow-xs cursor-pointer group"
              title={`当前工作目录: ${currentCwd}\n点击可选择或切换工作目录`}
            >
              <Folder className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-zinc-400 hidden lg:inline font-sans">工作目录:</span>
                <span className="text-zinc-200 max-w-[120px] sm:max-w-[180px] truncate" title={currentCwd}>
                  {shortCwd || '加载中...'}
                </span>
                {!isDefaultCwd && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/40">
                    自定义
                  </span>
                )}
              </div>
            </button>

            {/* Diagnostics */}
            <button
              onClick={onOpenDiagnostics}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-700/70 text-zinc-200 transition-colors shadow-xs cursor-pointer"
              title="查看 yt-dlp, ffmpeg, whisper-cli 运行环境诊断"
            >
              <Wrench className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden md:inline text-zinc-300">环境:</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${systemDefaults?.tools?.ytDlp?.available ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-amber-400'}`} />
                  yt-dlp
                </span>
                <span className="text-zinc-600">|</span>
                <span className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${systemDefaults?.tools?.ffmpeg?.available ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-amber-400'}`} />
                  ffmpeg
                </span>
                <span className="text-zinc-600">|</span>
                <span className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${systemDefaults?.tools?.whisperCli?.available ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-amber-400'}`} />
                  whisper
                </span>
              </div>
            </button>

            {/* Theme Selector */}
            <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-2 -mb-px overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-zinc-100 text-zinc-100 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500 text-white shadow-xs animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

