import React, { useState, useEffect, useRef } from 'react';
import {
  ListOrdered,
  Play,
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
  ChevronRight,
  ExternalLink,
  ArrowDown,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';
import { JobRecord, JobKind, JobStatus, PipelineBatchData } from '../types';

interface JobCenterViewProps {
  jobs: JobRecord[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  onRefreshJobs: () => void;
  onDeleteJob: (id: string) => Promise<void>;
  onPreviewFile: (path: string) => void;
}

export const JobCenterView: React.FC<JobCenterViewProps> = ({
  jobs,
  selectedJobId,
  onSelectJob,
  onRefreshJobs,
  onDeleteJob,
  onPreviewFile,
}) => {
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeJobDetails, setActiveJobDetails] = useState<JobRecord | null>(null);
  const [liveLogs, setLiveLogs] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [openingOutputId, setOpeningOutputId] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleDeleteJob = async (job: JobRecord) => {
    const isActive = job.status === 'queued' || job.status === 'running';
    const message = isActive
      ? `强制移除正在执行的任务 ${job.id}？\n\n任务会立即从列表消失，且后台回调不会重新创建记录。此操作不会删除输出文件，也不能终止已启动的 yt-dlp、ffmpeg 或 whisper-cli 进程。`
      : `删除任务记录 ${job.id}？\n\n仅删除任务中心中的记录和日志，不会删除任何视频、文本或其它输出文件。`;
    if (!window.confirm(message)) return;
    if (isActive && !window.confirm('请再次确认：继续强制移除该执行中任务的记录？')) return;
    setDeletingJobId(job.id);
    try {
      await onDeleteJob(job.id);
    } catch (err: any) {
      alert(err.message || '删除任务记录失败');
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleOpenOutputDirectory = async (jobId: string) => {
    setOpeningOutputId(jobId);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/open-output`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '无法打开输出目录');
    } catch (err: any) {
      alert(err.message || '无法打开输出目录');
    } finally {
      setOpeningOutputId(null);
    }
  };

  // Auto select first job if none selected
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      onSelectJob(jobs[0].id);
    }
  }, [selectedJobId, jobs]);

  // Load selected job details and connect SSE
  useEffect(() => {
    if (!selectedJobId) return;

    // Fetch snapshot
    fetch(`/api/jobs/${selectedJobId}`)
      .then((res) => res.json())
      .then((data) => {
        setActiveJobDetails(data);
        setLiveLogs(data.logs || '');
      })
      .catch(console.error);

    // Setup SSE connection
    const eventSource = new EventSource(`/api/jobs/${selectedJobId}/events`);

    eventSource.addEventListener('init', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveJobDetails(data);
        setLiveLogs(data.logs || '');
      } catch {}
    });

    eventSource.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLiveLogs((prev) => prev + data.chunk);
      } catch {}
    });

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveJobDetails((prev) => (prev ? { ...prev, progress: data } : prev));
      } catch {}
    });

    eventSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveJobDetails((prev) =>
          prev ? { ...prev, status: data.status, error: data.error, result: data.result } : prev
        );
        onRefreshJobs();
      } catch {}
    });

    eventSource.addEventListener('pipeline_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        setActiveJobDetails((prev) => (prev ? { ...prev, pipelineBatch: data } : prev));
      } catch {}
    });

    eventSource.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.job) setActiveJobDetails(data.job);
        onRefreshJobs();
      } catch {}
    });

    return () => {
      eventSource.close();
    };
  }, [selectedJobId]);

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

  // Filter jobs
  const filteredJobs = jobs.filter((j) => {
    if (kindFilter !== 'all' && j.kind !== kindFilter) return false;
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    return true;
  });

  const getKindLabel = (kind: JobKind) => {
    switch (kind) {
      case 'download':
        return { label: '视频下载', icon: Video, color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' };
      case 'model-download':
        return { label: '模型下载', icon: Cpu, color: 'text-purple-300 bg-purple-500/10 border-purple-500/30' };
      case 'transcribe':
        return { label: '本地转写', icon: FileText, color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
      case 'pipeline':
        return { label: '一键 Pipeline', icon: Layers, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
    }
  };

  const getStatusBadge = (status: JobStatus) => {
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

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* Filters & Actions Bar */}
      <div className="bg-[#121316] p-4 rounded-2xl border border-zinc-800/80 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 text-xs font-semibold text-zinc-300">
            <ListOrdered className="w-4 h-4 text-zinc-400" />
            <span>任务筛选:</span>
          </div>

          {/* Kind filter */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-200"
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
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 text-zinc-200"
          >
            <option value="all">所有状态</option>
            <option value="running">正在执行</option>
            <option value="complete">已完成</option>
            <option value="failed">执行失败</option>
            <option value="queued">等待队列</option>
          </select>
        </div>

        <button
          onClick={onRefreshJobs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/70 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
          刷新列表
        </button>
      </div>

      {/* Main Grid: Left Job List, Right Detail & Real-time Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Job Cards List (5 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              任务列表 ({filteredJobs.length})
            </span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center bg-[#121316] rounded-2xl border border-zinc-800/80 text-zinc-500 space-y-2">
              <ListOrdered className="w-8 h-8 mx-auto opacity-30 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-300">暂无符合条件的本地任务</p>
              <p className="text-xs text-zinc-500">可前往上方“视频下载”或“本地转写”创建新任务</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[78vh] overflow-y-auto pr-1">
              {filteredJobs.map((j) => {
                const isSelected = selectedJobId === j.id;
                const kindMeta = getKindLabel(j.kind);
                const KindIcon = kindMeta.icon;

                return (
                  <div
                    key={j.id}
                    onClick={() => onSelectJob(j.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
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
                            handleDeleteJob(j);
                          }}
                          disabled={deletingJobId === j.id}
                          className="p-1 text-zinc-500 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
                          title={j.status === 'queued' || j.status === 'running' ? '强制移除任务记录（不会终止底层进程）' : '删除任务记录（不会删除输出文件）'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-mono truncate max-w-[170px] ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                          {j.id}
                        </span>
                        <span className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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

                      {/* Model-download and transcription progress */}
                      {j.kind !== 'download' && j.progress && j.status === 'running' && (
                        <div className="pt-1.5">
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-500 h-full transition-all duration-300"
                              style={{ width: `${j.progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Job Details, Pipeline Batch & Real-Time Terminal (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeJobDetails ? (
            <>
              {/* Job Info Header Card */}
              <div className="bg-[#121316] p-6 rounded-2xl border border-zinc-800/80 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-zinc-100">{activeJobDetails.id}</span>
                      {getStatusBadge(activeJobDetails.status)}
                      <span className="text-xs text-zinc-400 font-mono">
                        {getKindLabel(activeJobDetails.kind).label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      创建时间: {new Date(activeJobDetails.createdAt).toLocaleString()}
                      {activeJobDetails.completedAt && ` • 完成耗时: ${(
                        (new Date(activeJobDetails.completedAt).getTime() -
                          new Date(activeJobDetails.startedAt || activeJobDetails.createdAt).getTime()) /
                        1000
                      ).toFixed(1)} 秒`}
                    </p>
                  </div>

                  {activeJobDetails.outputDir && (
                    <div className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-950/80 p-2 rounded-lg border border-zinc-800 font-mono">
                      <span className="font-semibold text-zinc-400">输出目录: </span>
                      <code className="max-w-[320px] truncate" title={activeJobDetails.outputDir}>{activeJobDetails.outputDir}</code>
                      <button
                        type="button"
                        onClick={() => handleOpenOutputDirectory(activeJobDetails.id)}
                        disabled={openingOutputId === activeJobDetails.id}
                        className="inline-flex shrink-0 items-center gap-1 px-1.5 py-1 text-[11px] font-sans font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
                        title="在系统文件管理器中打开输出目录"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        {openingOutputId === activeJobDetails.id ? '正在打开…' : '打开目录'}
                      </button>
                    </div>
                  )}
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
                      <span>{activeJobDetails.kind === 'model-download' ? '下载进度' : '转写进度'}: {activeJobDetails.progress.percentage}%</span>
                      <span>{activeJobDetails.progress.speed || '计算中...'}</span>
                    </div>
                    <div className="w-full bg-purple-950 h-2.5 rounded-full overflow-hidden border border-purple-800/40">
                      <div
                        className="bg-purple-500 h-full transition-all duration-300"
                        style={{ width: `${activeJobDetails.progress.percentage}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-purple-300 font-mono flex justify-between">
                      {activeJobDetails.kind === 'model-download' ? <>
                        <span>已下载: {(activeJobDetails.progress.loaded / 1024 / 1024).toFixed(1)} MB</span>
                        <span>总大小: {(activeJobDetails.progress.total / 1024 / 1024).toFixed(1)} MB</span>
                      </> : <span>仅显示转写百分比，不回显识别正文。</span>}
                    </div>
                  </div>
                )}

                {/* Pipeline Batch & Tasks Breakdown */}
                {activeJobDetails.kind === 'pipeline' && activeJobDetails.pipelineBatch && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        Pipeline 批次任务状态 (batch.json / task.json)
                      </h4>
                      <span className="text-xs text-zinc-400 font-mono">
                        总计: {activeJobDetails.pipelineBatch.total} | 成功: {activeJobDetails.pipelineBatch.completed} | 失败: {activeJobDetails.pipelineBatch.failed}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {activeJobDetails.pipelineBatch.items?.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-zinc-100">{item.id}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.status === 'complete'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : item.status === 'running'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                                    : item.status === 'failed'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                }`}
                              >
                                {item.status.toUpperCase()}
                              </span>
                            </div>
                            <span className="font-mono text-zinc-400 truncate max-w-[280px]" title={item.url}>
                              {item.url}
                            </span>
                          </div>

                          {/* Item generated output folders & files */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {item.transcriptFiles && item.transcriptFiles.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-zinc-400">转写产物:</span>
                                {item.transcriptFiles.map((tf, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => onPreviewFile(tf)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded text-[11px] text-zinc-200 font-mono transition-colors cursor-pointer"
                                    title="查看此转写文件"
                                  >
                                    <Eye className="w-3 h-3 text-zinc-400" />
                                    {tf.split('/').pop()}
                                  </button>
                                ))}
                              </div>
                            )}

                            {item.error && (
                              <span className="text-[11px] text-red-400 font-mono">
                                错误: {item.error}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Output Files Explorer for Download / Transcribe jobs */}
                {activeJobDetails.kind !== 'pipeline' &&
                  (activeJobDetails as any).outputFiles &&
                  (activeJobDetails as any).outputFiles.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                        输出产物文件 (点击快速预览)
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(activeJobDetails as any).outputFiles.map((file: any, i: number) => {
                          const isTranscript = ['.txt', '.srt', '.vtt', '.json', '.csv', '.lrc', '.wts'].includes(
                            file.ext
                          );
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => isTranscript && onPreviewFile(file.path)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                                isTranscript
                                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-100 cursor-pointer'
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5 text-zinc-400" />
                              <span>{file.name}</span>
                              <span className="text-[10px] text-zinc-500">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
            <div className="p-12 text-center bg-[#121316] rounded-2xl border border-zinc-800/80 text-zinc-500">
              <ListOrdered className="w-10 h-10 mx-auto opacity-30 text-zinc-400 mb-2" />
              <p className="text-sm font-medium text-zinc-300">请在左侧选择一个任务以查看实时状态与日志</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
