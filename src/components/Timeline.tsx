import React, { useRef, useEffect } from 'react';
import { Frame, Project, OnionSkinSettings } from '../types/animation';
import { drawStroke } from '../engine/renderer';
import {
  Play,
  Pause,
  Plus,
  Copy,
  ClipboardPaste,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Settings2,
  Clock,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface TimelineProps {
  project: Project;
  activeFrameIndex: number;
  isPlaying: boolean;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: (index: number) => void;
  onDeleteFrame: (index: number) => void;
  onCopyFrame?: (index: number) => void;
  onPasteFrame?: (index: number) => void;
  onInsertFrameBefore?: (index: number) => void;
  onInsertFrameAfter?: (index: number) => void;
  hasClipboardData?: boolean;
  onTogglePlay: () => void;
  onChangeFps: (fps: number) => void;
  onToggleOnionSkin: () => void;
  onChangeOnionSkinSettings?: (settings: Partial<OnionSkinSettings>) => void;
  onOpenOnionSettings: () => void;
  onOpenLayers: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

// Lightweight, crisp mini thumbnail preview for each animation frame
const FrameThumbnail: React.FC<{ project: Project; frameId: string }> = React.memo(({ project, frameId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Frame paper canvas background
    if (project.settings.backgroundColor === 'transparent') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = project.settings.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    // Render strokes across visible project layers
    project.layers.forEach((layer) => {
      if (!layer.visible) return;
      const strokes = project.layerFrames[`${layer.id}:${frameId}`];
      if (!strokes || strokes.length === 0) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      strokes.forEach((stroke) => {
        drawStroke(ctx, stroke, w, h);
      });
      ctx.restore();
    });
  }, [project, frameId]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={76}
      className="w-full h-full object-contain rounded-lg pointer-events-none"
    />
  );
});

export const Timeline: React.FC<TimelineProps> = ({
  project,
  activeFrameIndex,
  isPlaying,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onCopyFrame,
  onPasteFrame,
  onInsertFrameBefore,
  onInsertFrameAfter,
  hasClipboardData = false,
  onTogglePlay,
  onChangeFps,
  onToggleOnionSkin,
  onChangeOnionSkinSettings,
  onOpenOnionSettings,
  onOpenLayers,
  isMinimized = false,
  onToggleMinimize,
}) => {
  const frames = project.frames;
  const fps = project.settings.fps || 12;
  const onionSkin = project.settings.onionSkin;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevFramesLengthRef = useRef(frames.length);

  // Auto-scroll when new frames are added or when selecting a frame while editing
  useEffect(() => {
    if (!isPlaying) {
      const isNewFrameAdded = frames.length > prevFramesLengthRef.current;
      const timer = setTimeout(() => {
        if (isNewFrameAdded) {
          // Frame added at the end or duplicated: smoothly scroll all the way to view the new frame
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
              left: scrollContainerRef.current.scrollWidth,
              behavior: 'smooth',
            });
          }
        } else if (frameRefs.current[activeFrameIndex]) {
          frameRefs.current[activeFrameIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      }, 50);

      prevFramesLengthRef.current = frames.length;
      return () => clearTimeout(timer);
    }
    prevFramesLengthRef.current = frames.length;
  }, [frames.length, activeFrameIndex, isPlaying]);

  const handleStepPrev = () => {
    if (activeFrameIndex > 0) {
      onSelectFrame(activeFrameIndex - 1);
    } else {
      onSelectFrame(frames.length - 1);
    }
  };

  const handleStepNext = () => {
    if (activeFrameIndex < frames.length - 1) {
      onSelectFrame(activeFrameIndex + 1);
    } else {
      onSelectFrame(0);
    }
  };

  if (isMinimized) {
    return (
      <div className="w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/90 text-slate-800 select-none px-4 py-2 flex items-center justify-between text-xs shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`p-2 rounded-xl font-medium transition-all active:scale-95 shadow-sm ${
              isPlaying
                ? 'bg-amber-500 text-white hover:bg-amber-400 shadow-amber-500/20'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/20'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>

          <span className="text-xs font-mono text-slate-600">
            Frame <span className="text-indigo-600 font-bold">{activeFrameIndex + 1}</span> / {frames.length}
          </span>

          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

          <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold">
            {fps} FPS
          </span>
        </div>

        <button
          onClick={onToggleMinimize}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors text-xs font-bold border border-slate-200/80 shadow-xs"
          title="Expand Timeline Panel"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          <span>Timeline</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/90 text-slate-800 select-none flex flex-col shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2 border-b border-slate-200/80 text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleStepPrev}
            title="Previous Frame"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/60 shadow-xs transition-colors active:scale-95"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`p-2 sm:p-2.5 rounded-xl font-semibold flex items-center justify-center transition-all active:scale-95 shadow-md ${
              isPlaying
                ? 'bg-amber-500 text-white hover:bg-amber-400 shadow-amber-500/20'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/20'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />}
          </button>

          <button
            onClick={handleStepNext}
            title="Next Frame"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200/60 shadow-xs transition-colors active:scale-95"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-0.5 sm:mx-1" />

          {/* FPS Selector matching website color theory */}
          <div className="relative flex items-center bg-white hover:bg-indigo-50/70 border border-slate-200/90 hover:border-indigo-300 rounded-xl px-2.5 py-1.5 shadow-2xs transition-all group cursor-pointer">
            <Clock className="w-3.5 h-3.5 text-indigo-600 mr-1.5 shrink-0" />
            <select
              value={fps}
              onChange={(e) => onChangeFps(Number(e.target.value))}
              className="appearance-none bg-transparent text-slate-800 text-[11px] sm:text-xs font-bold focus:outline-none pr-4 cursor-pointer"
              title="Animation Playback Speed (Frames Per Second)"
            >
              {[6, 8, 12, 15, 24, 30, 60].map((rate) => (
                <option key={rate} value={rate} className="bg-white text-slate-800 font-semibold">
                  {rate} FPS
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 absolute right-2 pointer-events-none transition-colors" />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Onion Skin Quick Toggle & Frame Count Selector matching website purple color theory */}
          <div className="flex items-center rounded-xl bg-white p-1 border border-slate-200/90 shadow-2xs gap-1">
            <button
              onClick={onToggleOnionSkin}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                onionSkin.enabled
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70'
              }`}
              title="Toggle Onion Skin overlay"
            >
              {onionSkin.enabled ? <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              <span className="hidden xs:inline font-bold">Onion Skin</span>
            </button>

            {/* Quick Frame Count Selector directly inside the tool */}
            {onChangeOnionSkinSettings && (
              <div className="relative flex items-center bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-100 rounded-lg px-1.5 py-0.5 shadow-2xs transition-colors">
                <select
                  value={onionSkin.prevFrames}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onChangeOnionSkinSettings({ prevFrames: val, nextFrames: Math.min(val, 3) });
                  }}
                  className="appearance-none bg-transparent text-indigo-700 font-mono text-[10px] sm:text-[11px] font-bold pr-3.5 focus:outline-none cursor-pointer"
                  title="Number of Onion Skin Frames"
                >
                  <option value={1} className="bg-white text-slate-800 font-medium">1f</option>
                  <option value={2} className="bg-white text-slate-800 font-medium">2f</option>
                  <option value={3} className="bg-white text-slate-800 font-medium">3f</option>
                  <option value={4} className="bg-white text-slate-800 font-medium">4f</option>
                  <option value={5} className="bg-white text-slate-800 font-medium">5f</option>
                </select>
                <ChevronDown className="w-2.5 h-2.5 text-indigo-500 absolute right-1 pointer-events-none" />
              </div>
            )}

            <button
              onClick={onOpenOnionSettings}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Detailed Onion Skin Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onOpenLayers}
            className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-700 font-bold text-[11px] sm:text-xs border border-slate-200/90 shadow-2xs transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Layers</span>
            <span className="bg-indigo-50 px-1.5 py-0.5 rounded-md text-[10px] text-indigo-700 font-mono font-bold border border-indigo-100 shadow-2xs">
              {project.layers.length}
            </span>
          </button>

          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-400 hover:text-slate-800 border border-slate-200/60 shadow-xs transition-colors"
              title="Minimize Timeline"
            >
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Frame Strip - Wider cards with top padding for floating contextual popup */}
      <div
        ref={scrollContainerRef}
        className="relative flex items-center gap-2.5 sm:gap-3.5 pt-11 pb-2 sm:pb-3 px-3 sm:px-5 overflow-x-auto custom-scrollbar scroll-smooth"
      >
        {frames.map((frame, index) => {
          const isActive = index === activeFrameIndex;

          return (
            <div
              key={frame.id}
              ref={(el) => (frameRefs.current[index] = el)}
              onClick={() => onSelectFrame(index)}
              className={`group relative flex-shrink-0 w-22 h-20 sm:w-26 sm:h-22 min-w-[5.5rem] sm:min-w-[6.5rem] rounded-2xl border-2 cursor-pointer flex flex-col justify-between p-1.5 sm:p-2 transition-all shadow-xs ${
                isActive
                  ? 'bg-indigo-50/90 border-indigo-600 shadow-md shadow-indigo-500/15 scale-102 z-20'
                  : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-sm'
              }`}
            >
              {/* Contextual Floating Popup Bar above the Selected Frame */}
              {isActive && (
                <div
                  className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-xl border border-indigo-200/90 shadow-xl shadow-indigo-900/15 rounded-xl p-1 animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Subtle triangle caret pointing down to frame */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-r border-b border-indigo-200/90 pointer-events-none" />

                  {/* Add frame in front (before) */}
                  <button
                    onClick={() => onInsertFrameBefore?.(index)}
                    className="flex items-center justify-center px-1.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors group/btn"
                    title="Add frame in front (before)"
                  >
                    <div className="flex items-center -space-x-0.5">
                      <ArrowLeft className="w-3.5 h-3.5 text-indigo-600 group-hover/btn:scale-110 transition-transform" />
                      <Plus className="w-3 h-3 text-indigo-600 group-hover/btn:scale-110 transition-transform" />
                    </div>
                  </button>

                  <div className="w-px h-3.5 bg-slate-200" />

                  {/* Add frame at back (after) */}
                  <button
                    onClick={() => onInsertFrameAfter?.(index)}
                    className="flex items-center justify-center px-1.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors group/btn"
                    title="Add frame at back (after)"
                  >
                    <div className="flex items-center -space-x-0.5">
                      <Plus className="w-3 h-3 text-indigo-600 group-hover/btn:scale-110 transition-transform" />
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-600 group-hover/btn:scale-110 transition-transform" />
                    </div>
                  </button>

                  {frames.length > 1 && (
                    <>
                      <div className="w-px h-3.5 bg-slate-200" />
                      {/* Delete Frame */}
                      <button
                        onClick={() => onDeleteFrame(index)}
                        className="flex items-center justify-center p-1 rounded-lg hover:bg-rose-50 transition-colors group/btn"
                        title="Delete selected frame"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500 group-hover/btn:scale-110 transition-transform" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Top Frame Number badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[9px] sm:text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-lg ${
                    isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  F{index + 1}
                </span>
              </div>

              {/* Center visual thumbnail preview area without strokes count */}
              <div className={`flex-1 my-0.5 sm:my-1 rounded-xl border overflow-hidden flex items-center justify-center ${
                isActive ? 'bg-white border-indigo-300/80 shadow-2xs' : 'bg-slate-50 border-slate-200/80'
              }`}>
                <FrameThumbnail project={project} frameId={frame.id} />
              </div>

              {/* Frame bottom options: Only Copy and Paste symbols without text */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100/90">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyFrame?.(index);
                  }}
                  className="flex-1 flex items-center justify-center py-0.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Copy Frame Artwork"
                >
                  <Copy className="w-3 h-3 text-indigo-500" />
                </button>
                <div className="w-px h-3 bg-slate-200" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPasteFrame?.(index);
                  }}
                  disabled={!hasClipboardData}
                  className={`flex-1 flex items-center justify-center py-0.5 rounded-md transition-colors ${
                    hasClipboardData
                      ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                      : 'text-slate-200 cursor-not-allowed'
                  }`}
                  title={hasClipboardData ? 'Paste into Frame' : 'Copy a frame first'}
                >
                  <ClipboardPaste className={`w-3 h-3 ${hasClipboardData ? 'text-indigo-500' : 'text-slate-300'}`} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Frame Button - Matching card size */}
        <button
          onClick={onAddFrame}
          className="flex-shrink-0 w-22 h-20 sm:w-26 sm:h-22 min-w-[5.5rem] sm:min-w-[6.5rem] rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white/70 hover:bg-indigo-50/70 text-slate-500 hover:text-indigo-600 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-xs"
          title="Add Blank Frame"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 group-hover:text-indigo-600">Add Frame</span>
        </button>
      </div>
    </div>
  );
};

