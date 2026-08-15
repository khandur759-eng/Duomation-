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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-3 sm:p-4 pl-safe pr-safe pt-safe pb-safe animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2rem] bg-white/95 border border-slate-200/90 p-6 sm:p-7 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        <button
          onClick={onClose}
          disabled={exporting}
          className="absolute top-5 right-5 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-30"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 mb-3 shadow-xs">
            <Download className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-950">Export Animation</h2>
          <p className="text-xs text-slate-500 mt-1">
            Download your 2D animation project in professional formats.
          </p>
        </div>

        {completedMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2.5 shadow-xs">
            <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>{completedMessage}</span>
          </div>
        )}

        {exporting ? (
          <div className="py-6 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">{exportStatusText}</p>
              <p className="text-xs font-mono font-bold text-slate-500">{exportProgress}% Completed</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-600 to-violet-600 h-full transition-all duration-200"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleExportWebM}
              className="w-full p-4 rounded-2xl bg-white border-2 border-slate-200/90 hover:border-indigo-400 hover:bg-indigo-50/30 flex items-center gap-3.5 text-left transition-all group shadow-xs hover:shadow-md active:scale-98 cursor-pointer"
            >
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-violet-600 group-hover:text-white transition-all shadow-xs">
                <Film className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-950">WebM Video File</h4>
                <p className="text-xs text-slate-500 font-medium">Smooth video clip ({project.settings.fps} FPS)</p>
              </div>
            </button>

            <button
              onClick={handleExportPNGSequence}
              className="w-full p-4 rounded-2xl bg-white border-2 border-slate-200/90 hover:border-emerald-400 hover:bg-emerald-50/30 flex items-center gap-3.5 text-left transition-all group shadow-xs hover:shadow-md active:scale-98 cursor-pointer"
            >
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-teal-600 group-hover:text-white transition-all shadow-xs">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-950">PNG Sequence (ZIP)</h4>
                <p className="text-xs text-slate-500 font-medium">Single ZIP containing high-res transparent PNGs</p>
              </div>
            </button>

            <button
              onClick={handleExportJSON}
              className="w-full p-4 rounded-2xl bg-white border-2 border-slate-200/90 hover:border-amber-400 hover:bg-amber-50/30 flex items-center gap-3.5 text-left transition-all group shadow-xs hover:shadow-md active:scale-98 cursor-pointer"
            >
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 group-hover:bg-gradient-to-r group-hover:from-amber-600 group-hover:to-orange-600 group-hover:text-white transition-all shadow-xs">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-950">Project JSON Backup</h4>
                <p className="text-xs text-slate-500 font-medium">Structured project file to transfer or load later</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
