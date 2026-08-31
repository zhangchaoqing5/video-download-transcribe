import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ListOrdered,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  FolderOpen,
  FileText,
  Video,
  Layers,
  Cpu,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Eye,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Timer,
  Play,
  Hourglass,
  Music,
  Download,
  Database,
  Package,
  Film,
  FileCode,
  FolderArchive,
  ExternalLink,
} from 'lucide-react';
import { JobRecord, JobKind, JobStatus, JobOutputFile } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { CustomDatePicker } from './CustomDatePicker';
import { MediaPreviewModal } from './MediaPreviewModal';
import { FileTextPreviewModal } from './TranscriptPreviewModal';
import {
  formatDateTime,
  formatDate,
  formatDuration,
  getTodayDateStr,
  getYesterdayDateStr,
  isDateWithinDays,
} from '../utils/date';
import {
  formatFileSize,
  getFormatBadge,
  getCategoryLabel,
  groupOutputFiles,
  groupPipelineOutputFiles,
} from '../utils/outputFiles';

interface JobCenterViewProps {
  jobs: JobRecord[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  onRefreshJobs: () => void;
  onDeleteJob: (id: string) => Promise<void>;
  onPreviewFile: (path: string) => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'week' | 'custom';

export const JobCenterView: React.FC<JobCenterViewProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onRefreshJobs,
  onDeleteJob,
  onPreviewFile,
  onShowToast,
}) => {
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customDate, setCustomDate] = useState<string>('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [activeJobDetails, setActiveJobDetails] = useState<JobRecord | null>(null);
  const [liveLogs, setLiveLogs] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [deletingJob, setDeletingJob] = useState<JobRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [openingOutputId, setOpeningOutputId] = useState<string | null>(null);
  const [mediaModalState, setMediaModalState] = useState<{
    filePath: string;
    fileName?: string;
    fileSize?: number;
    ext?: string;
    mediaType: 'video' | 'audio';
  } | null>(null);
  const [textModalState, setTextModalState] = useState<{
    filePath: string;
    fileName?: string;
    ext?: string;
  } | null>(null);
  const [revealingPath, setRevealingPath] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (onShowToast) {
      onShowToast(text, type);
    }
  };

  const handleRevealPath = async (targetPath: string) => {
    setRevealingPath(targetPath);
    try {
      const res = await fetch('/api/files/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '无法在系统文件管理器中定位');
      triggerToast('已在系统文件管理器中显示并定位', 'success');
    } catch (err: any) {
      triggerToast(err.message || '无法在文件管理器中定位', 'error');
    } finally {
      setRevealingPath(null);
    }
  };

  const handleDownloadFile = (targetPath: string, fileName?: string) => {
    const a = document.createElement('a');
    a.href = `/api/files/download?path=${encodeURIComponent(targetPath)}`;
    a.download = fileName || targetPath.split(/[\\/]/).pop() || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenDeleteModal = (job: JobRecord) => {
    setDeletingJob(job);
  };

  const handleConfirmDelete = async () => {
    if (!deletingJob) return;
    setIsDeleting(true);
    try {
      await onDeleteJob(deletingJob.id);
      setDeletingJob(null);
    } catch (err: any) {
      triggerToast(err.message || '删除任务记录失败', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenOutputDirectory = async (jobId: string) => {
    setOpeningOutputId(jobId);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/open-output`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '无法打开输出目录');
      triggerToast('已在系统文件管理器中打开输出目录', 'success');
    } catch (err: any) {
      triggerToast(err.message || '无法打开输出目录', 'error');
    } finally {
      setOpeningOutputId(null);
    }
  };

  // Synchronize selection when jobs list changes
  useEffect(() => {
    if (jobs.length === 0) {
      if (selectedJobId !== null) onSelectJob('');
      setActiveJobDetails(null);
      setLiveLogs('');
      return;
    }

    // If currently selected job no longer exists, select the first available job
    const exists = jobs.some((j) => j.id === selectedJobId);
    if (!exists || !selectedJobId) {
      onSelectJob(jobs[0].id);
    }
  }, [selectedJobId, jobs, onSelectJob]);

  // Load selected job details and connect SSE
  useEffect(() => {
    if (!selectedJobId) {
      setActiveJobDetails(null);
      setLiveLogs('');
      return;
    }

    let isMounted = true;

    // Fetch snapshot safely
    fetch(`/api/jobs/${encodeURIComponent(selectedJobId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Task not found');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data && data.id && !data.error) {
          setActiveJobDetails(data);
          setLiveLogs(data.logs || '');
        } else {
          setActiveJobDetails(null);
          setLiveLogs('');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setActiveJobDetails(null);
        setLiveLogs('');
      });

    // Setup SSE connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/jobs/${encodeURIComponent(selectedJobId)}/events`);

      eventSource.addEventListener('init', (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data && data.id) {
            setActiveJobDetails(data);
            setLiveLogs(data.logs || '');
          }
        } catch {}
      });

      eventSource.addEventListener('log', (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data?.chunk) {
            setLiveLogs((prev) => prev + data.chunk);
          }
        } catch {}
      });

      eventSource.addEventListener('progress', (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          setActiveJobDetails((prev) => (prev ? { ...prev, progress: data } : prev));
        } catch {}
      });

      eventSource.addEventListener('status', (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          setActiveJobDetails((prev) =>
            prev ? { ...prev, status: data.status, error: data.error, result: data.result } : prev
          );
          onRefreshJobs();
        } catch {}
      });

      eventSource.addEventListener('pipeline_update', (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          setActiveJobDetails((prev) => (prev ? { ...prev, pipelineBatch: data } : prev));
        } catch {}
      });

      eventSource.addEventListener('complete', (e) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(e.data);
          if (data?.job?.id) setActiveJobDetails(data.job);
          onRefreshJobs();
        } catch {}
      });

      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch {}

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedJobId, onRefreshJobs]);

  // Auto scroll logs to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogs, autoScroll]);

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(liveLogs);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Filter jobs by kind, status, and date
  const filteredJobs = useMemo(() => {
    const today = getTodayDateStr();
    const yesterday = getYesterdayDateStr();

    return jobs.filter((j) => {
      if (kindFilter !== 'all' && j.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;

      // Date filtering
      if (datePreset === 'today') {
        if (formatDate(j.createdAt) !== today) return false;
      } else if (datePreset === 'yesterday') {
        if (formatDate(j.createdAt) !== yesterday) return false;
      } else if (datePreset === 'week') {
        if (!isDateWithinDays(j.createdAt, 7)) return false;
      } else if (datePreset === 'custom' && customDate) {
        if (formatDate(j.createdAt) !== customDate) return false;
      }

      return true;
    });
  }, [jobs, kindFilter, statusFilter, datePreset, customDate]);

  // Dates that have jobs for calendar indicator dots
  const availableJobDates = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      const d = formatDate(j.createdAt);
      if (d && d !== '-') set.add(d);
    });
    return Array.from(set);
  }, [jobs]);

  // Total pages and clamped current page
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Reset to page 1 whenever filters change
  const handleKindFilterChange = (val: string) => {
    setKindFilter(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleDatePresetChange = (preset: DateFilterPreset) => {
    setDatePreset(preset);
    setCurrentPage(1);
  };

  const handleCustomDateChange = (val: string) => {
    setCustomDate(val);
    setDatePreset('custom');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setKindFilter('all');
    setStatusFilter('all');
    setDatePreset('all');
    setCustomDate('');
    setCurrentPage(1);
  };

  // Paginated slice
  const paginatedJobs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredJobs.slice(startIdx, startIdx + pageSize);
  }, [filteredJobs, currentPage, pageSize]);

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
        return { label: '任务', icon: ListOrdered, color: 'text-zinc-300 bg-zinc-800 border-zinc-700' };
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
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            已完成
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
            <XCircle className="w-3 h-3 text-red-400" />
            失败
          </span>
        );
      case 'queued':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
            <Clock className="w-3 h-3 text-zinc-400" />
            排队中
          </span>
        );
    }
  };

  const isDeletingRunningJob = deletingJob && (deletingJob.status === 'running' || deletingJob.status === 'queued');
  const hasActiveFilters = kindFilter !== 'all' || statusFilter !== 'all' || datePreset !== 'all' || Boolean(customDate);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Filters & Date Bar */}
      <div className="bg-[#121316] p-4 sm:p-5 rounded-2xl border border-zinc-800/80 shadow-md space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 text-xs font-semibold text-zinc-300">
              <ListOrdered className="w-4 h-4 text-zinc-400" />
              <span>任务筛选:</span>
            </div>

            {/* Kind filter */}
            <select
              value={kindFilter}
              onChange={(e) => handleKindFilterChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-200 cursor-pointer"
            >
              <option value="all">所有类型 ({jobs.length})</option>
              <option value="download">视频下载</option>
              <option value="model-download">模型下载</option>
              <option value="transcribe">本地转写</option>
              <option value="pipeline">一键 Pipeline</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-200 cursor-pointer"
            >
              <option value="all">所有状态</option>
              <option value="running">正在执行</option>
              <option value="complete">已完成</option>
              <option value="failed">执行失败</option>
              <option value="queued">等待队列</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="清空所有筛选条件"
              >
                <RotateCcw className="w-3 h-3" />
                重置筛选
              </button>
            )}
            <button
              onClick={onRefreshJobs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
              刷新列表
            </button>
          </div>
        </div>

        {/* Date Selection Filter Row */}
        <div className="pt-2 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mr-0.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>按日期查询:</span>
            </div>

            {/* Polished Custom Date Picker & Presets Component */}
            <CustomDatePicker
              value={customDate}
              onChange={(dateStr) => {
                setCustomDate(dateStr);
                setDatePreset('custom');
                setCurrentPage(1);
              }}
              onClear={() => {
                setCustomDate('');
                setDatePreset('all');
                setCurrentPage(1);
              }}
              activePreset={datePreset}
              onSelectPreset={(preset) => {
                setDatePreset(preset);
                setCustomDate('');
                setCurrentPage(1);
              }}
              hasJobDates={availableJobDates}
            />
          </div>

          {/* Filter Match Count */}
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <span>
              已筛选 <strong className="text-zinc-200">{filteredJobs.length}</strong> / {jobs.length} 条记录
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Job List, Right Detail & Real-time Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Job Cards List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Header & Page Size Selector */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              任务列表 ({filteredJobs.length})
            </span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span>每页:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value={10}>10条</option>
                <option value={20}>20条</option>
                <option value={50}>50条</option>
                <option value={100}>100条</option>
              </select>
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center bg-[#121316] rounded-2xl border border-zinc-800/80 text-zinc-500 space-y-2">
              <ListOrdered className="w-8 h-8 mx-auto opacity-30 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-300">暂无符合条件的本地任务</p>
              <p className="text-xs text-zinc-500">
                {hasActiveFilters ? '可点击“重置筛选”查看全部历史记录' : '可前往上方“视频下载”或“本地转写”创建新任务'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg cursor-pointer transition-colors inline-block"
                >
                  重置筛选条件
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-2.5 max-h-[68vh] overflow-y-auto pr-1">
                {paginatedJobs.map((j) => {
                  const isSelected = selectedJobId === j.id;
                  const kindMeta = getKindLabel(j.kind);
                  const KindIcon = kindMeta.icon;
                  const durationStr = formatDuration(j.startedAt || j.createdAt, j.completedAt);

                  return (
                    <div
                      key={j.id}
                      onClick={() => onSelectJob(j.id)}
                      className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-md ring-1 ring-zinc-500/50'
                          : 'bg-[#121316] hover:bg-zinc-900/80 border-zinc-800/80 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
                              isSelected ? 'bg-zinc-900 text-zinc-200 border-zinc-700' : kindMeta.color
                            }`}
                          >
                            <KindIcon className="w-3 h-3" />
                            {kindMeta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(j.status)}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenDeleteModal(j);
                            }}
                            className="p-1 text-zinc-500 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                            title={j.status === 'queued' || j.status === 'running' ? '强制移除执行中任务记录' : '删除任务记录'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-mono truncate max-w-[170px] ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                            {j.id}
                          </span>
                        </div>

                        {/* Summary / params snippet */}
                        <p className={`text-xs truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-400'}`}>
                          {j.kind === 'download' && j.params?.urls?.length
                            ? `下载 ${j.params.urls.length} 个目标`
                            : j.kind === 'model-download'
                            ? `下载 Whisper: ${j.params?.model}`
                            : j.kind === 'transcribe' && j.params?.inputs?.length
                            ? `转写 ${j.params.inputs.length} 个媒体路径`
                            : j.kind === 'pipeline' && j.params?.urls?.length
                            ? `Pipeline 批次 (${j.params.urls.length} 个任务)`
                            : '任务'}
                        </p>

                        {/* Detailed Time and Duration Stamps */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-800/60 text-zinc-400">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            {formatDateTime(j.createdAt)}
                          </span>
                          {(j.status === 'complete' || j.status === 'failed') && j.startedAt && (
                            <span className="font-mono text-[10px] text-zinc-400 bg-zinc-900/90 px-1.5 py-0.2 rounded border border-zinc-800">
                              耗时: {durationStr}
                            </span>
                          )}
                          {j.status === 'running' && (
                            <span className="font-mono text-[10px] text-blue-300 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/30 animate-pulse">
                              执行中...
                            </span>
                          )}
                        </div>

                        {/* Model-download and transcription progress */}
                        {j.kind !== 'download' && j.progress && j.status === 'running' && (
                          <div className="pt-1">
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-500 h-full transition-all duration-300"
                                style={{ width: `${j.progress.percentage || 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-3 bg-[#121316] rounded-xl border border-zinc-800/80 flex items-center justify-between gap-2 text-xs select-none">
                  <div className="text-zinc-400 font-mono text-[11px]">
                    {currentPage} / {totalPages} 页
                  </div>

                  <div className="flex items-center gap-1">
                    {/* First page */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="第一页"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Prev page */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-0.5"
                      title="上一页"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        // show first, last, and current +- 1
                        if (p === 1 || p === totalPages) return true;
                        if (Math.abs(p - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && p - prev > 1;

                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span className="px-1 text-zinc-600">…</span>}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`w-6 h-6 rounded text-xs font-mono transition-colors cursor-pointer ${
                                currentPage === p
                                  ? 'bg-zinc-700 text-white font-bold border border-zinc-600'
                                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    {/* Next page */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-0.5"
                      title="下一页"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Last page */}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="最后一页"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Selected Job Details, Pipeline Batch & Real-Time Terminal (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeJobDetails && activeJobDetails.id ? (
            <>
              {/* Job Info Header Card */}
              <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-zinc-100">{activeJobDetails.id}</span>
                      {getStatusBadge(activeJobDetails.status)}
                      <span className="text-xs text-zinc-400 font-mono">
                        {getKindLabel(activeJobDetails.kind).label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {activeJobDetails.outputDir && (
                      <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800 font-mono">
                        <span className="font-semibold text-zinc-400">输出目录: </span>
                        <code className="max-w-[240px] truncate" title={activeJobDetails.outputDir}>{activeJobDetails.outputDir}</code>
                        <button
                          type="button"
                          onClick={() => handleOpenOutputDirectory(activeJobDetails.id)}
                          disabled={openingOutputId === activeJobDetails.id}
                          className="inline-flex shrink-0 items-center gap-1 px-1.5 py-1 text-[11px] font-sans font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
                          title="在系统文件管理器中打开输出目录"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          {openingOutputId === activeJobDetails.id ? '打开中…' : '打开目录'}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(activeJobDetails)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-800/50 rounded-lg transition-colors cursor-pointer"
                      title="删除任务记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除记录</span>
                    </button>
                  </div>
                </div>

                {/* Structured Task Time & Execution Timeline */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-zinc-950/70 rounded-xl border border-zinc-800/80 text-xs">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-500" /> 创建时间
                    </span>
                    <p className="font-mono text-zinc-200 text-xs">
                      {formatDateTime(activeJobDetails.createdAt)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <Play className="w-3 h-3 text-zinc-500" /> 启动时间
                    </span>
                    <p className="font-mono text-zinc-200 text-xs">
                      {activeJobDetails.startedAt ? formatDateTime(activeJobDetails.startedAt) : '排队等待中'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" /> 结束时间
                    </span>
                    <p className="font-mono text-zinc-200 text-xs">
                      {activeJobDetails.completedAt ? formatDateTime(activeJobDetails.completedAt) : activeJobDetails.status === 'running' ? '正在执行中' : '-'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <Timer className="w-3 h-3 text-zinc-500" /> 执行耗时
                    </span>
                    <p className="font-mono text-zinc-200 text-xs">
                      {activeJobDetails.startedAt
                        ? formatDuration(activeJobDetails.startedAt, activeJobDetails.completedAt)
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Error diagnostics banner if failed */}
                {activeJobDetails.error && (
                  <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-200 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-red-300">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span>任务失败原因 (Diagnostic Error)</span>
                    </div>
                    <p className="font-mono text-red-200">{activeJobDetails.error}</p>
                  </div>
                )}

                {/* Model-download and transcription live progress */}
                {activeJobDetails.kind !== 'download' && activeJobDetails.progress && (
                  <div className="p-4 bg-purple-950/30 border border-purple-800/50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-purple-200">
                      <span>{activeJobDetails.kind === 'model-download' ? '下载进度' : '转写进度'}: {activeJobDetails.progress.percentage || 0}%</span>
                      <span>{activeJobDetails.progress.speed || '计算中...'}</span>
                    </div>
                    <div className="w-full bg-purple-950 h-2.5 rounded-full overflow-hidden border border-purple-800/40">
                      <div
                        className="bg-purple-500 h-full transition-all duration-300"
                        style={{ width: `${activeJobDetails.progress.percentage || 0}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-purple-300 font-mono flex justify-between">
                      {activeJobDetails.kind === 'model-download' ? <>
                        <span>已下载: {activeJobDetails.progress.loaded ? (activeJobDetails.progress.loaded / 1024 / 1024).toFixed(1) : 0} MB</span>
                        <span>总大小: {activeJobDetails.progress.total ? (activeJobDetails.progress.total / 1024 / 1024).toFixed(1) : 0} MB</span>
                      </> : <span>仅显示转写百分比，不回显识别正文。</span>}
                    </div>
                  </div>
                )}

                {/* Result Files (成果文件) Section */}
                <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FolderArchive className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        成果文件与产物 (Result Files)
                      </h4>
                      {activeJobDetails.outputFiles && activeJobDetails.outputFiles.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
                          {activeJobDetails.outputFiles.length} 个文件
                        </span>
                      )}
                    </div>

                    {activeJobDetails.outputDir && (
                      <button
                        type="button"
                        onClick={() => handleOpenOutputDirectory(activeJobDetails.id)}
                        disabled={openingOutputId === activeJobDetails.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium btn-secondary rounded-lg transition-colors cursor-pointer"
                        title="在系统文件管理器中打开整个任务输出目录"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{openingOutputId === activeJobDetails.id ? '打开中…' : '打开任务输出目录'}</span>
                      </button>
                    )}
                  </div>

                  {/* Empty or In-progress state */}
                  {(!activeJobDetails.outputFiles || activeJobDetails.outputFiles.length === 0) && (
                    <div className="p-5 bg-zinc-950/60 rounded-xl border border-zinc-800/80 text-center space-y-2">
                      <Package className="w-8 h-8 mx-auto text-zinc-600" />
                      {activeJobDetails.status === 'running' || activeJobDetails.status === 'pending' ? (
                        <p className="text-xs text-zinc-400">
                          任务正在执行中，生成的音视频、字幕或文本产物将在完成后自动在此呈现。
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-zinc-300 font-medium">未在输出目录中检测到生成的文件</p>
                          <p className="text-[11px] text-zinc-500 font-mono">
                            目录路径: {activeJobDetails.outputDir || '未指定'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pipeline tasks: grouped by subtask item */}
                  {activeJobDetails.kind === 'pipeline' && activeJobDetails.outputFiles && activeJobDetails.outputFiles.length > 0 && (() => {
                    const pipelineData = groupPipelineOutputFiles(activeJobDetails.outputFiles, activeJobDetails.pipelineBatch);
                    return (
                      <div className="space-y-4">
                        {pipelineData.subtasks.map((subtask) => (
                          <div
                            key={subtask.taskId}
                            className="bg-zinc-950/90 rounded-xl border border-zinc-800/90 p-4 space-y-3 shadow-xs"
                          >
                            {/* Subtask Header */}
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-800/70">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-bold text-xs text-zinc-100 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700/80 shrink-0">
                                  {subtask.taskId}
                                </span>
                                <span className="text-xs font-semibold text-zinc-200 truncate max-w-md" title={subtask.url || subtask.title}>
                                  {subtask.title}
                                </span>
                                {subtask.status && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      subtask.status === 'complete'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : subtask.status === 'running'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                                        : subtask.status === 'failed'
                                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                    }`}
                                  >
                                    {subtask.status.toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {subtask.subtaskDir && (
                                <button
                                  type="button"
                                  onClick={() => handleRevealPath(subtask.subtaskDir!)}
                                  disabled={revealingPath === subtask.subtaskDir}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium btn-secondary rounded-lg transition-colors cursor-pointer shrink-0"
                                  title="在文件管理器中定位该子任务的独立产物目录"
                                >
                                  <FolderOpen className="w-3 h-3 text-zinc-400" />
                                  <span>定位子任务目录</span>
                                </button>
                              )}
                            </div>

                            {/* Subtask Videos */}
                            {subtask.videoFiles.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                                  <Video className="w-3.5 h-3.5" />
                                  <span>视频产物 ({subtask.videoFiles.length})</span>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {subtask.videoFiles.map((file, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 text-xs hover:border-zinc-700 transition-colors"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 mr-2">
                                        <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                                          <Video className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-zinc-100 truncate">{file.name}</span>
                                            <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                                              {getFormatBadge(file.ext)}
                                            </span>
                                          </div>
                                          <span className="text-[11px] text-zinc-500 font-mono">
                                            {formatFileSize(file.size)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {file.previewType === 'media' && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setMediaModalState({
                                                filePath: file.path,
                                                fileName: file.name,
                                                fileSize: file.size,
                                                ext: file.ext,
                                                mediaType: 'video',
                                              })
                                            }
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold btn-primary rounded-lg transition-colors cursor-pointer"
                                            title="在页面中直接播放视频"
                                          >
                                            <Play className="w-3 h-3 fill-current" />
                                            <span>播放</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleRevealPath(file.path)}
                                          disabled={revealingPath === file.path}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium btn-secondary rounded-lg transition-colors cursor-pointer"
                                          title="在系统文件管理器中显示并定位此文件"
                                        >
                                          <FolderOpen className="w-3 h-3 text-zinc-400" />
                                          <span>定位</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDownloadFile(file.path, file.name)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium btn-secondary rounded-lg transition-colors cursor-pointer"
                                          title="下载此文件"
                                        >
                                          <Download className="w-3 h-3 text-zinc-400" />
                                          <span>下载</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Subtask Transcripts & Subtitles */}
                            {subtask.transcriptFiles.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>转写与字幕产物 ({subtask.transcriptFiles.length})</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {subtask.transcriptFiles.map((file, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 text-xs hover:border-zinc-700 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 mr-2">
                                        <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <div className="min-w-0">
                                          <span className="font-semibold text-zinc-100 truncate block">{file.name}</span>
                                          <span className="text-[10px] text-zinc-500 font-mono">
                                            {getFormatBadge(file.ext)} • {formatFileSize(file.size)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTextModalState({
                                              filePath: file.path,
                                              fileName: file.name,
                                              ext: file.ext,
                                            })
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold btn-secondary rounded-lg transition-colors cursor-pointer"
                                          title="在网页中预览文本与字幕内容"
                                        >
                                          <Eye className="w-3 h-3 text-zinc-300" />
                                          <span>预览</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleRevealPath(file.path)}
                                          disabled={revealingPath === file.path}
                                          className="p-1 text-zinc-400 hover:text-zinc-200 btn-secondary rounded-lg transition-colors cursor-pointer"
                                          title="在文件夹中显示"
                                        >
                                          <FolderOpen className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDownloadFile(file.path, file.name)}
                                          className="p-1 text-zinc-400 hover:text-zinc-200 btn-secondary rounded-lg transition-colors cursor-pointer"
                                          title="下载文件"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Subtask Data or other files if any */}
                            {subtask.dataFiles.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                                  <Database className="w-3.5 h-3.5" />
                                  <span>任务状态与数据 ({subtask.dataFiles.length})</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {subtask.dataFiles.map((file, idx) => (
                                    <div
                                      key={idx}
                                      className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800 text-xs font-mono"
                                    >
                                      <span className="text-zinc-300">{file.name}</span>
                                      <span className="text-[10px] text-zinc-500">({formatFileSize(file.size)})</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setTextModalState({
                                            filePath: file.path,
                                            fileName: file.name,
                                            ext: file.ext,
                                          })
                                        }
                                        className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                        title="查看 JSON/数据"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRevealPath(file.path)}
                                        className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                        title="在文件夹中显示"
                                      >
                                        <FolderOpen className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Root Pipeline Metadata (batch.json, etc.) */}
                        {pipelineData.rootMetadataFiles.length > 0 && (
                          <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2">
                            <div className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" />
                              <span>批次全局元数据产物 ({pipelineData.rootMetadataFiles.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pipelineData.rootMetadataFiles.map((file, idx) => (
                                <div
                                  key={idx}
                                  className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800 text-xs font-mono"
                                >
                                  <FileCode className="w-3.5 h-3.5 text-zinc-400" />
                                  <span className="text-zinc-200 font-semibold">{file.name}</span>
                                  <span className="text-[10px] text-zinc-500">({formatFileSize(file.size)})</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTextModalState({
                                        filePath: file.path,
                                        fileName: file.name,
                                        ext: file.ext,
                                      })
                                    }
                                    className="p-1 hover:text-zinc-100 text-zinc-400 cursor-pointer"
                                    title="预览元数据"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRevealPath(file.path)}
                                    className="p-1 hover:text-zinc-100 text-zinc-400 cursor-pointer"
                                    title="在文件夹中显示"
                                  >
                                    <FolderOpen className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(file.path, file.name)}
                                    className="p-1 hover:text-zinc-100 text-zinc-400 cursor-pointer"
                                    title="下载文件"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Regular Jobs: Download / Transcribe / Model-Download */}
                  {activeJobDetails.kind !== 'pipeline' && activeJobDetails.outputFiles && activeJobDetails.outputFiles.length > 0 && (() => {
                    const grouped = groupOutputFiles(activeJobDetails.outputFiles);

                    const renderCategorySection = (
                      title: string,
                      icon: React.ReactNode,
                      files: JobOutputFile[],
                      themeColor: string
                    ) => {
                      if (files.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <div className={`text-xs font-bold ${themeColor} flex items-center gap-1.5`}>
                            {icon}
                            <span>{title} ({files.length})</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            {files.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/90 text-xs hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 mr-3">
                                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-200 shrink-0 shadow-xs">
                                    {file.category === 'video' ? (
                                      <Video className="w-4 h-4 text-blue-400" />
                                    ) : file.category === 'audio' ? (
                                      <Music className="w-4 h-4 text-purple-400" />
                                    ) : file.category === 'text' ? (
                                      <FileText className="w-4 h-4 text-amber-400" />
                                    ) : file.category === 'data' ? (
                                      <Database className="w-4 h-4 text-cyan-400" />
                                    ) : (
                                      <Package className="w-4 h-4 text-zinc-400" />
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-zinc-100 truncate">{file.name}</span>
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                        {getFormatBadge(file.ext)}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 font-mono truncate" title={file.path}>
                                      {formatFileSize(file.size)} {file.relativePath !== file.name && `• ${file.relativePath}`}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {file.previewType === 'media' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMediaModalState({
                                          filePath: file.path,
                                          fileName: file.name,
                                          fileSize: file.size,
                                          ext: file.ext,
                                          mediaType: file.category === 'audio' ? 'audio' : 'video',
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold btn-primary rounded-lg transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                                      title="在页面内播放媒体文件"
                                    >
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                      <span>播放</span>
                                    </button>
                                  )}

                                  {file.previewType === 'text' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTextModalState({
                                          filePath: file.path,
                                          fileName: file.name,
                                          ext: file.ext,
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium btn-secondary rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                      title="在网页中预览内容并复制全文"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-zinc-300" />
                                      <span>预览</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleRevealPath(file.path)}
                                    disabled={revealingPath === file.path}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium btn-secondary rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                    title="在系统 Finder 或文件资源管理器中显示并定位此文件"
                                  >
                                    <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>定位</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDownloadFile(file.path, file.name)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium btn-secondary rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                                    title="下载此文件"
                                  >
                                    <Download className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>下载</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-4">
                        {renderCategorySection('视频文件', <Video className="w-4 h-4 text-blue-400" />, grouped.video, 'text-blue-400')}
                        {renderCategorySection('音频文件', <Music className="w-4 h-4 text-purple-400" />, grouped.audio, 'text-purple-400')}
                        {renderCategorySection('文本与字幕', <FileText className="w-4 h-4 text-amber-400" />, grouped.text, 'text-amber-400')}
                        {renderCategorySection('结构化数据', <Database className="w-4 h-4 text-cyan-400" />, grouped.data, 'text-cyan-400')}
                        {renderCategorySection('其他产物', <Package className="w-4 h-4 text-zinc-400" />, grouped.other, 'text-zinc-400')}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Real-time SSE Logs Terminal Card */}
              <div className="bg-zinc-950 rounded-2xl shadow-xl overflow-hidden border border-zinc-800/90">
                {/* Terminal top bar */}
                <div className="px-4 py-3 bg-[#121316] border-b border-zinc-800 flex items-center justify-between text-zinc-400 text-xs">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-zinc-200">实时执行日志 (SSE Stream)</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                        className="rounded bg-zinc-800 border-zinc-700 text-zinc-200 focus:ring-0 accent-zinc-200"
                      />
                      <span>自动滚屏</span>
                    </label>

                    <button
                      onClick={handleCopyLogs}
                      disabled={!liveLogs}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors cursor-pointer"
                    >
                      {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedLogs ? '已复制' : '复制日志'}
                    </button>
                  </div>
                </div>

                {/* Terminal Content */}
                <div
                  ref={logContainerRef}
                  className="p-5 font-mono text-xs text-zinc-300 h-96 overflow-y-auto leading-relaxed whitespace-pre-wrap selection:bg-zinc-700"
                >
                  {liveLogs ? (
                    liveLogs
                  ) : (
                    <div className="text-zinc-500 italic">
                      [等待日志输出中... 任务启动后输出流将通过 SSE 实时推送到此处]
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center bg-[#121316] rounded-2xl border border-zinc-800/80 text-zinc-500 space-y-2">
              <ListOrdered className="w-10 h-10 mx-auto opacity-30 text-zinc-400 mb-2" />
              <p className="text-sm font-medium text-zinc-300">请在左侧选择一个任务以查看实时状态与日志</p>
              <p className="text-xs text-zinc-500">当创建新任务或选择已有任务时，详细参数与输出日志将在此展开。</p>
            </div>
          )}
        </div>
      </div>

      {/* Friendly Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingJob)}
        onClose={() => !isDeleting && setDeletingJob(null)}
        onConfirm={handleConfirmDelete}
        title={isDeletingRunningJob ? '强制移除执行中任务记录？' : '确认删除任务记录？'}
        job={deletingJob}
        confirmText={isDeletingRunningJob ? '强制移除记录' : '确认删除'}
        cancelText="取消"
        variant={isDeletingRunningJob ? 'danger' : 'danger'}
        isLoading={isDeleting}
      />

      {/* Media Playback Modal (Video & Audio) */}
      <MediaPreviewModal
        isOpen={Boolean(mediaModalState)}
        onClose={() => setMediaModalState(null)}
        filePath={mediaModalState?.filePath || ''}
        fileName={mediaModalState?.fileName}
        fileSize={mediaModalState?.fileSize}
        ext={mediaModalState?.ext}
        mediaType={mediaModalState?.mediaType || 'video'}
        onShowToast={onShowToast}
      />

      {/* Text / Subtitle / Data Preview Modal */}
      <FileTextPreviewModal
        isOpen={Boolean(textModalState)}
        onClose={() => setTextModalState(null)}
        filePath={textModalState?.filePath || ''}
        fileName={textModalState?.fileName}
        ext={textModalState?.ext}
        onShowToast={onShowToast}
      />
    </div>
  );
};
