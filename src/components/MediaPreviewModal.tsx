import React, { useState } from 'react';
import {
  X,
  Play,
  Video,
  Music,
  Download,
  FolderOpen,
  AlertCircle,
  Check,
  FileCode,
} from 'lucide-react';
import { formatFileSize, getFormatBadge } from '../utils/outputFiles';

interface MediaPreviewModalProps {
  filePath: string | null;
  fileName?: string;
  fileSize?: number;
  ext?: string;
  mediaType?: 'video' | 'audio';
  onClose: () => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  filePath,
  fileName,
  fileSize = 0,
  ext = '',
  mediaType = 'video',
  onClose,
  onShowToast,
}) => {
  const [playError, setPlayError] = useState<boolean>(false);
  const [revealing, setRevealing] = useState<boolean>(false);
  const [revealed, setRevealed] = useState<boolean>(false);

  if (!filePath) return null;

  const actualFileName = fileName || filePath.split(/[\\/]/).pop() || 'media';
  const fileExt = ext || (actualFileName.includes('.') ? `.${actualFileName.split('.').pop()}` : '');
  const formatBadge = getFormatBadge(fileExt);
  const isVideo = mediaType === 'video';
  const mediaUrl = `/api/files/media?path=${encodeURIComponent(filePath)}`;
  const downloadUrl = `/api/files/download?path=${encodeURIComponent(filePath)}`;

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

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = actualFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content bg-[#121316] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="modal-header px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-3 min-w-0 mr-4">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-100 shrink-0 shadow-xs">
              {isVideo ? <Video className="w-4 h-4 text-blue-400" /> : <Music className="w-4 h-4 text-purple-400" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-100 truncate">{actualFileName}</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                  {formatBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate max-w-lg font-mono" title={filePath}>
                {fileSize > 0 ? formatFileSize(fileSize) : '本地媒体'} • {filePath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRevealInFolder}
              disabled={revealing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium btn-secondary rounded-lg transition-all cursor-pointer active:scale-[0.98]"
              title="在系统 Finder 或资源管理器中高亮选中此文件"
            >
              {revealed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{revealed ? '已定位' : '在文件夹中显示'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold btn-primary rounded-lg transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              title="下载此媒体文件"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载文件</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors ml-1 cursor-pointer"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Player Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/90 flex flex-col items-center justify-center min-h-[300px]">
          {playError ? (
            <div className="w-full max-w-lg p-6 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-center space-y-4 shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-zinc-100">浏览器播放受限</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  当前文件扩展名为 <code className="text-amber-300 font-mono font-semibold">{formatBadge}</code>
                  ，但其内部音视频编码可能不受当前浏览器原生解码器支持。
                </p>
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-left font-mono text-xs text-zinc-400 break-all select-all">
                {filePath}
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRevealInFolder}
                  className="px-4 py-2 text-xs font-medium btn-secondary rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-zinc-400" />
                  <span>在系统文件夹中打开</span>
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
          ) : isVideo ? (
            <div className="w-full flex flex-col items-center justify-center">
              <video
                src={mediaUrl}
                controls
                autoPlay
                playsInline
                onError={() => setPlayError(true)}
                className="max-h-[65vh] w-full max-w-3xl rounded-xl bg-black shadow-2xl border border-zinc-800/80 outline-none"
              >
                您的浏览器不支持 HTML5 视频播放。
              </video>
            </div>
          ) : (
            <div className="w-full max-w-xl p-8 bg-zinc-900/90 rounded-2xl border border-zinc-800 text-center space-y-6 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto shadow-inner">
                <Music className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-zinc-100">{actualFileName}</h4>
                <p className="text-xs text-zinc-400 font-mono">
                  {fileSize > 0 ? formatFileSize(fileSize) : '音频文件'} • {formatBadge}
                </p>
              </div>
              <audio
                src={mediaUrl}
                controls
                autoPlay
                onError={() => setPlayError(true)}
                className="w-full mt-2"
              >
                您的浏览器不支持 HTML5 音频播放。
              </audio>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="modal-footer px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-zinc-400" />
            支持 HTTP Range 分段流式加载与进度拖拽
          </span>
          <span className="font-mono text-zinc-400">{formatFileSize(fileSize)}</span>
        </div>
      </div>
    </div>
  );
};
