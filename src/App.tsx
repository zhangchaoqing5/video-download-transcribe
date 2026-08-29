import React, { useState, useEffect, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { VideoDownloadView } from './components/VideoDownloadView';
import { WhisperModelView } from './components/WhisperModelView';
import { TranscribeView } from './components/TranscribeView';
import { PipelineView } from './components/PipelineView';
import { JobCenterView } from './components/JobCenterView';
import { ToolDiagnosticModal } from './components/ToolDiagnosticModal';
import { TranscriptPreviewModal } from './components/TranscriptPreviewModal';
import {
  JobRecord,
  SystemDefaults,
  DownloadFormState,
  ModelDownloadFormState,
  TranscribeFormState,
  PipelineFormState,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('download');
  const [systemDefaults, setSystemDefaults] = useState<SystemDefaults | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState<boolean>(false);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch system defaults and tool status
  const fetchDefaults = useCallback(async () => {
    try {
      const res = await fetch('/api/defaults');
      if (res.ok) {
        const data = await res.json();
        setSystemDefaults(data);
      }
    } catch (err) {
      console.error('Failed to fetch system defaults:', err);
    }
  }, []);

  // Fetch jobs list
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDefaults();
    fetchJobs();
  }, [fetchDefaults, fetchJobs]);

  // Periodic polling if there are running jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some((j) => j.status === 'running' || j.status === 'queued');
    const intervalTime = hasActiveJobs ? 2500 : 8000;

    const timer = setInterval(() => {
      fetchJobs();
    }, intervalTime);

    return () => clearInterval(timer);
  }, [jobs, fetchJobs]);

  const runningJobsCount = jobs.filter((j) => j.status === 'running').length;

  // 1. Submit Download Job
  const handleDownloadSubmit = async (formData: DownloadFormState) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建下载任务失败');

      showToast(`下载任务 ${data.jobId} 已启动！`);
      setSelectedJobId(data.jobId);
      await fetchJobs();
      setActiveTab('jobs');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Model Download Job
  const handleModelDownloadSubmit = async (formData: ModelDownloadFormState) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs/model-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建模型下载任务失败');

      showToast(`模型下载任务 ${data.jobId} 已启动！`);
      setSelectedJobId(data.jobId);
      await fetchJobs();
      setActiveTab('jobs');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Transcribe Job
  const handleTranscribeSubmit = async (formData: TranscribeFormState) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建转写任务失败');

      showToast(`本地转写任务 ${data.jobId} 已启动！`);
      setSelectedJobId(data.jobId);
      await fetchJobs();
      setActiveTab('jobs');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Submit Pipeline Job
  const handlePipelineSubmit = async (formData: PipelineFormState) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/jobs/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建 Pipeline 任务失败');

      showToast(`一键 Pipeline 任务 ${data.jobId} 已启动！`);
      setSelectedJobId(data.jobId);
      await fetchJobs();
      setActiveTab('jobs');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除任务记录失败');
    if (selectedJobId === jobId) setSelectedJobId(null);
    await fetchJobs();
    showToast(data.message || '已删除任务记录；输出文件未删除。');
  };

  return (
    <div className="min-h-screen bg-[#0c0d10] text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-zinc-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-zinc-900/95 text-zinc-100 border border-zinc-700 shadow-black/40'
                : 'bg-red-950/95 text-red-100 border border-red-800 shadow-black/40'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header & Nav */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        systemDefaults={systemDefaults}
        runningJobsCount={runningJobsCount}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'download' && (
          <VideoDownloadView
            onSubmit={handleDownloadSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {activeTab === 'models' && (
          <WhisperModelView
            systemDefaults={systemDefaults}
            onSubmitDownload={handleModelDownloadSubmit}
            isSubmitting={isSubmitting}
            onRefreshDefaults={fetchDefaults}
          />
        )}

        {activeTab === 'transcribe' && (
          <TranscribeView
            systemDefaults={systemDefaults}
            onSubmit={handleTranscribeSubmit}
            isSubmitting={isSubmitting}
            onNavigateToModels={() => setActiveTab('models')}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineView
            systemDefaults={systemDefaults}
            onSubmit={handlePipelineSubmit}
            isSubmitting={isSubmitting}
            onNavigateToModels={() => setActiveTab('models')}
          />
        )}

        {activeTab === 'jobs' && (
          <JobCenterView
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onRefreshJobs={fetchJobs}
            onDeleteJob={handleDeleteJob}
            onPreviewFile={(filePath) => setPreviewFilePath(filePath)}
          />
        )}
      </main>

      {/* Tool Diagnostic Modal */}
      <ToolDiagnosticModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        systemDefaults={systemDefaults}
        onRefresh={fetchDefaults}
      />

      {/* Transcript Preview Modal */}
      <TranscriptPreviewModal
        filePath={previewFilePath}
        onClose={() => setPreviewFilePath(null)}
      />
    </div>
  );
}
