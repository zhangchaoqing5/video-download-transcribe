import React, { useState, useEffect } from 'react';
import { X, Copy, Check, FileText, Download, Loader2 } from 'lucide-react';

interface TranscriptPreviewModalProps {
  filePath: string | null;
  onClose: () => void;
}

export const TranscriptPreviewModal: React.FC<TranscriptPreviewModalProps> = ({ filePath, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);

    fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to read file');
        }
        return res.json();
      })
      .then((data) => {
        setContent(data.content);
        setFileName(data.fileName);
        setFileSize(data.size);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filePath]);

  if (!filePath) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-[#121316] w-full max-w-4xl max-h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100">
              <FileText className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 truncate max-w-md">{fileName || filePath}</h3>
              <p className="text-xs text-zinc-400">
                {fileSize > 0 ? `${(fileSize / 1024).toFixed(1)} KB` : '产物文件预览'} • {filePath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={loading || !content}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              {copied ? '已复制' : '复制全文'}
            </button>

            <button
              onClick={handleDownload}
              disabled={loading || !content}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-zinc-900" />
              下载文件
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 font-mono text-zinc-200 text-xs leading-relaxed whitespace-pre-wrap selection:bg-zinc-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-200" />
              <span>正在读取本地产物文件...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300">
              {error}
            </div>
          ) : (
            content || '文件内容为空'
          )}
        </div>
      </div>
    </div>
  );
};
