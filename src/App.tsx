import React, { useState, useEffect, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { VideoDownloadView } from './components/VideoDownloadView';
import { WhisperModelView } from './components/WhisperModelView';
import { TranscribeView } from './components/TranscribeView';
import { PipelineView } from './components/PipelineView';
import { JobCenterView } from './components/JobCenterView';
import { ToolDiagnosticModal } from './components/ToolDiagnosticModal';
import { TranscriptPreviewModal } from './components/TranscriptPreviewModal';
import { WorkspaceModal } from './components/WorkspaceModal';
import {
  JobRecord,
  SystemDefaults,
  DownloadFormState,
  ModelDownloadFormState,
  TranscribeFormState,
  PipelineFormState,
  ThemeMode,
  UserSettings,
} from './types';
import { getSavedTheme, applyTheme } from './utils/theme';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getSavedTheme);
  const [activeTab, setActiveTab] = useState<ActiveTab>('download');
  const [systemDefaults, setSystemDefaults] = useState<SystemDefaults | null>(null);
  const [settings, setSettings] = useState<UserSettings>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState<boolean>(false);
  const [workspaceOpen, setWorkspaceOpen] = useState<boolean>(false);
  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Apply theme on initial load & theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
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

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const savedSettings = await res.json();
        setSettings(savedSettings);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  const savePreferences = useCallback(async <Section extends keyof Pick<UserSettings, 'videoDownload' | 'modelDownload' | 'transcribe' | 'pipeline'>>(
    section: Section,
    preferences: NonNullable<UserSettings[Section]>,
  ) => {
    const res = await fetch(`/api/settings/${section}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preferences),
    });
    if (!res.ok) return console.error(`Failed to save ${section} preferences`);
    setSettings(await res.json());
  }, []);

  const resetPreferences = useCallback(async (section: 'videoDownload' | 'modelDownload' | 'transcribe' | 'pipeline') => {
    const res = await fetch(`/api/settings/${section}`, { method: 'DELETE' });
    if (!res.ok) return console.error(`Failed to reset ${section} preferences`);
    setSettings(await res.json());
    setSettingsRevision((revision) => revision + 1);
  }, []);

  const initializeAllSettings = useCallback(async () => {
    const res = await fetch('/api/settings/reset', { method: 'POST' });
    if (!res.ok) throw new Error('初始化默认设置失败');
    setSettings(await res.json());
    setSettingsRevision((revision) => revision + 1);
  }, []);

  // Initial load
  useEffect(() => {
    fetchDefaults();
    fetchJobs();
    fetchSettings();
  }, [fetchDefaults, fetchJobs, fetchSettings]);

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
    
    // Safely update jobs in state and select next remaining job if current was selected
    setJobs((prev) => {
      const remaining = prev.filter((j) => j.id !== jobId);
      if (selectedJobId === jobId) {
        setSelectedJobId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });

    await fetchJobs();
    showToast(data.message || '已删除任务记录；输出文件未删除。', 'success');
  };

  return (
    <div className="app-container min-h-screen flex flex-col font-sans">
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
        onOpenWorkspace={() => setWorkspaceOpen(true)}
        currentTheme={theme}
        onThemeChange={handleThemeChange}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {settingsLoaded && activeTab === 'download' && (
          <VideoDownloadView
            key={`download-${settingsRevision}`}
            onSubmit={handleDownloadSubmit}
            isSubmitting={isSubmitting}
            preferences={settings.videoDownload}
            onPreferencesChange={(preferences) => savePreferences('videoDownload', preferences)}
            onResetPreferences={() => resetPreferences('videoDownload')}
          />
        )}

        {settingsLoaded && activeTab === 'models' && (
          <WhisperModelView
            key={`models-${settingsRevision}`}
            systemDefaults={systemDefaults}
            onSubmitDownload={handleModelDownloadSubmit}
            isSubmitting={isSubmitting}
            onRefreshDefaults={fetchDefaults}
            preferences={settings.modelDownload}
            onPreferencesChange={(preferences) => savePreferences('modelDownload', preferences)}
            onResetPreferences={() => resetPreferences('modelDownload')}
          />
        )}

        {settingsLoaded && activeTab === 'transcribe' && (
          <TranscribeView
            key={`transcribe-${settingsRevision}`}
            systemDefaults={systemDefaults}
            onSubmit={handleTranscribeSubmit}
            isSubmitting={isSubmitting}
            onNavigateToModels={() => setActiveTab('models')}
            preferences={settings.transcribe}
            onPreferencesChange={(preferences) => savePreferences('transcribe', preferences)}
            onResetPreferences={() => resetPreferences('transcribe')}
          />
        )}

        {settingsLoaded && activeTab === 'pipeline' && (
          <PipelineView
            key={`pipeline-${settingsRevision}`}
            systemDefaults={systemDefaults}
            onSubmit={handlePipelineSubmit}
            isSubmitting={isSubmitting}
            onNavigateToModels={() => setActiveTab('models')}
            preferences={settings.pipeline}
            onPreferencesChange={(preferences) => savePreferences('pipeline', preferences)}
            onResetPreferences={() => resetPreferences('pipeline')}
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
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Tool Diagnostic Modal */}
      <ToolDiagnosticModal
        isOpen={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        systemDefaults={systemDefaults}
        onRefresh={fetchDefaults}
        onOpenWorkspace={() => setWorkspaceOpen(true)}
      />

      {/* Workspace Configuration Modal */}
      <WorkspaceModal
        isOpen={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        workspace={systemDefaults?.workspace || null}
        onWorkspaceChanged={fetchDefaults}
        onAllSettingsReset={initializeAllSettings}
        onShowToast={showToast}
      />

      {/* File Text / Subtitle Preview Modal */}
      <TranscriptPreviewModal
        isOpen={Boolean(previewFilePath)}
        filePath={previewFilePath}
        onClose={() => setPreviewFilePath(null)}
        onShowToast={showToast}
      />
    </div>
  );
}
