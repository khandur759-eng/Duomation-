import React, { useState } from 'react';
import JSZip from 'jszip';
import { Project } from '../types/animation';
import { renderCanvasFrame } from '../engine/renderer';
import { Download, Film, Image as ImageIcon, FileCode, X, Check, Loader2 } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, project }) => {
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportStatusText, setExportStatusText] = useState<string>('Rendering Animation Frames...');
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Export JSON Backup
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.name.toLowerCase().replace(/\s+/g, '_')}_duet.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setCompletedMessage('Project JSON file downloaded successfully!');
    setTimeout(() => setCompletedMessage(null), 3500);
  };

  // Export PNG Frames Sequence as a single ZIP archive
  const handleExportPNGSequence = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportStatusText('Rendering PNG Frames...');

    try {
      const zip = new JSZip();
      const folder = zip.folder(`${project.name.toLowerCase().replace(/\s+/g, '_')}_png_sequence`);

      const canvas = document.createElement('canvas');
      canvas.width = project.settings.width;
      canvas.height = project.settings.height;

      for (let i = 0; i < project.frames.length; i++) {
        const renderProgress = Math.round(((i + 1) / project.frames.length) * 80);
        setExportProgress(renderProgress);

        renderCanvasFrame({
          canvas,
          project,
          activeFrameIndex: i,
          showOnionSkin: false,
          isExporting: true,
        });

        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const filename = `frame_${String(i + 1).padStart(3, '0')}.png`;

        if (folder) {
          folder.file(filename, base64Data, { base64: true });
        } else {
          zip.file(filename, base64Data, { base64: true });
        }

        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      setExportStatusText('Compressing into ZIP archive...');
      setExportProgress(85);

      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        const zipPercent = 85 + Math.round((metadata.percent / 100) * 15);
        setExportProgress(zipPercent);
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_frames.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExporting(false);
      setCompletedMessage(`Exported ${project.frames.length} PNG frames in a ZIP archive!`);
      setTimeout(() => setCompletedMessage(null), 3500);
    } catch (err) {
      console.error('[Export] ZIP generation error:', err);
      setExporting(false);
      setCompletedMessage('Failed to create ZIP file. Please try again.');
      setTimeout(() => setCompletedMessage(null), 4000);
    }
  };

  // Export WebM Video using Canvas MediaRecorder API
  const handleExportWebM = async () => {
    if (typeof MediaRecorder === 'undefined') {
      alert('WebM export is not supported by this browser.');
      return;
    }

    setExporting(true);
    setExportProgress(0);
    setExportStatusText('Recording WebM Video...');

    const canvas = document.createElement('canvas');
    canvas.width = project.settings.width;
    canvas.height = project.settings.height;

    const stream = canvas.captureStream(project.settings.fps);
    let mimeType = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExporting(false);
      setCompletedMessage('Animation video exported successfully!');
      setTimeout(() => setCompletedMessage(null), 3500);
    };

    recorder.start();

    const frameDurationMs = 1000 / project.settings.fps;

    for (let loop = 0; loop < 2; loop++) {
      for (let i = 0; i < project.frames.length; i++) {
        renderCanvasFrame({
          canvas,
          project,
          activeFrameIndex: i,
          showOnionSkin: false,
          isExporting: true,
        });

        const progressPercent = Math.round(((loop * project.frames.length + i + 1) / (project.frames.length * 2)) * 100);
        setExportProgress(progressPercent);

        await new Promise((resolve) => setTimeout(resolve, frameDurationMs));
      }
    }

    recorder.stop();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 pl-safe pr-safe pt-safe pb-safe">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 text-slate-100 shadow-2xl">
        <button
          onClick={onClose}
          disabled={exporting}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-30"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 mb-3">
            <Download className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-white">Export Animation</h2>
          <p className="text-xs text-slate-400 mt-1">
            Download your 2D animation project in professional formats.
          </p>
        </div>

        {completedMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{completedMessage}</span>
          </div>
        )}

        {exporting ? (
          <div className="py-6 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">{exportStatusText}</p>
              <p className="text-xs text-slate-400">{exportProgress}% Completed</p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-200"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleExportWebM}
              className="w-full p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900/80 flex items-center gap-3 text-left transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Film className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">WebM Video File</h4>
                <p className="text-xs text-slate-400">Smooth video clip ({project.settings.fps} FPS)</p>
              </div>
            </button>

            <button
              onClick={handleExportPNGSequence}
              className="w-full p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900/80 flex items-center gap-3 text-left transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">PNG Sequence (ZIP)</h4>
                <p className="text-xs text-slate-400">Single ZIP containing high-res transparent PNGs</p>
              </div>
            </button>

            <button
              onClick={handleExportJSON}
              className="w-full p-3.5 sm:p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900/80 flex items-center gap-3 text-left transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Project JSON Backup</h4>
                <p className="text-xs text-slate-400">Structured project file to transfer or load later</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
