import React, { useState } from 'react';
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
    setTimeout(() => setCompletedMessage(null), 3000);
  };

  // Export PNG Frames Sequence
  const handleExportPNGSequence = async () => {
    setExporting(true);
    setExportProgress(0);

    const canvas = document.createElement('canvas');
    canvas.width = project.settings.width;
    canvas.height = project.settings.height;

    for (let i = 0; i < project.frames.length; i++) {
      setExportProgress(Math.round(((i + 1) / project.frames.length) * 100));

      renderCanvasFrame({
        canvas,
        project,
        activeFrameIndex: i,
        showOnionSkin: false,
        isExporting: true,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${project.name}_frame_${String(i + 1).padStart(3, '0')}.png`;
      a.click();

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    setExporting(false);
    setCompletedMessage(`Exported ${project.frames.length} PNG frames successfully!`);
    setTimeout(() => setCompletedMessage(null), 3000);
  };

  // Export WebM Video using Canvas MediaRecorder API
  const handleExportWebM = async () => {
    setExporting(true);
    setExportProgress(0);

    const canvas = document.createElement('canvas');
    canvas.width = project.settings.width;
    canvas.height = project.settings.height;

    const stream = canvas.captureStream(project.settings.fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}.webm`;
      a.click();

      setExporting(false);
      setCompletedMessage('WebM Animation Video exported successfully!');
      setTimeout(() => setCompletedMessage(null), 3000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
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
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Rendering Animation Frames...</p>
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
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900/80 flex items-center gap-3 text-left transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Film className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">WebM Video File</h4>
                <p className="text-xs text-slate-400">High-definition smooth video clip ({project.settings.fps} FPS)</p>
              </div>
            </button>

            <button
              onClick={handleExportPNGSequence}
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900/80 flex items-center gap-3 text-left transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">PNG Image Sequence</h4>
                <p className="text-xs text-slate-400">Individual high-res transparent PNGs for every frame</p>
              </div>
            </button>

            <button
              onClick={handleExportJSON}
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/80 hover:bg-slate-900/80 flex items-center gap-3 text-left transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Project JSON Backup</h4>
                <p className="text-xs text-slate-400">Full structured project file to load or transfer across devices</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
