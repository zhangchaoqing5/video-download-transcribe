import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  FileText,
  Download,
  Loader2,
  FolderOpen,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { formatFileSize, getFormatBadge } from '../utils/outputFiles';

export interface FileTextPreviewModalProps {
  filePath: string | null;
  fileName?: string;
  ext?: string;
  onClose: () => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const FileTextPreviewModal: React.FC<FileTextPreviewModalProps> = ({
  filePath,
  fileName: initialFileName,
  ext: initialExt,
  onClose,
  onShowToast,
}) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>(initialFileName || '');
  const [fileSize, setFileSize] = useState<number>(0);
  const [fileExt, setFileExt] = useState<string>(initialExt || '');
  const [copied, setCopied] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    setContent('');

    fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '无法读取文件内容');
        }
        return data;
      })
      .then((data) => {
        setContent(data.content || '');
        setFileName(data.fileName || filePath.split(/[\\/]/).pop() || '');
        setFileSize(data.size || 0);
        setFileExt(data.ext || (filePath.includes('.') ? `.${filePath.split('.').pop()}` : ''));
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filePath]);

  if (!filePath) return null;

  const actualFileName = fileName || filePath.split(/[\\/]/).pop() || 'file.txt';
  const formatBadge = getFormatBadge(fileExt || (actualFileName.includes('.') ? `.${actualFileName.split('.').pop()}` : ''));
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(filePath)}`;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    if (onShowToast) onShowToast('已复制全文到剪贴板', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = actualFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRevealInFolder = async () => {
    setRevealing(true);
    try {
      const res = await fetch('/api/files/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '无法在文件管理器中定位');
      setRevealed(true);
      if (onShowToast) onShowToast('已在系统文件管理器中显示并定位文件', 'success');
      setTimeout(() => setRevealed(false), 2500);
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || '无法在文件管理器中定位', 'error');
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content bg-[#121316] w-full max-w-4xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="modal-header px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3 min-w-0 mr-4">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100 shrink-0 shadow-xs">
              <FileText className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 truncate">{actualFileName}</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                  {formatBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate max-w-md font-mono" title={filePath}>
                {fileSize > 0 ? formatFileSize(fileSize) : '文本产物'} • {filePath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !content}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium btn-secondary rounded-lg transition-all disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copied ? '已复制' : '复制全文'}</span>
            </button>

            <button
              type="button"
              onClick={handleRevealInFolder}
              disabled={revealing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium btn-secondary rounded-lg transition-all cursor-pointer active:scale-[0.98]"
              title="在系统 Finder 或资源管理器中定位"
            >
              {revealed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{revealed ? '已定位' : '在文件夹中显示'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold btn-primary rounded-lg transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载文件</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/80 font-mono text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap selection:bg-zinc-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-200" />
              <span>正在读取本地产物文件...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-zinc-900/80 border border-zinc-800 rounded-2xl text-center space-y-4 max-w-md mx-auto my-8 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-100">无法在页面中预览内容</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRevealInFolder}
                  className="px-4 py-2 text-xs font-medium btn-secondary rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-zinc-400" />
                  <span>在文件夹中显示</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 text-xs font-semibold btn-primary rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>下载原始文件</span>
                </button>
              </div>
            </div>
          ) : (
            content || '文件内容为空'
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer px-6 py-2.5 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-zinc-400" />
            UTF-8 文本即时预览
          </span>
          <span className="font-mono text-zinc-400">{fileSize > 0 ? formatFileSize(fileSize) : ''}</span>
        </div>
      </div>
    </div>
  );
};

// Backwards-compatible export alias
export const TranscriptPreviewModal = FileTextPreviewModal;

