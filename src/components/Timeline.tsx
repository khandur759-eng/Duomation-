import React from 'react';
import { Frame, Project, OnionSkinSettings } from '../types/animation';
import {
  Play,
  Pause,
  Plus,
  Copy,
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
  MoreHorizontal
} from 'lucide-react';

interface TimelineProps {
  project: Project;
  activeFrameIndex: number;
  isPlaying: boolean;
  onSelectFrame: (index: number) => void;
  onAddFrame: () => void;
  onDuplicateFrame: (index: number) => void;
  onDeleteFrame: (index: number) => void;
  onTogglePlay: () => void;
  onChangeFps: (fps: number) => void;
  onToggleOnionSkin: () => void;
  onChangeOnionSkinSettings?: (settings: Partial<OnionSkinSettings>) => void;
  onOpenOnionSettings: () => void;
  onOpenLayers: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  activeFrameIndex,
  isPlaying,
  onSelectFrame,
  onAddFrame,
  onDuplicateFrame,
  onDeleteFrame,
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
      <div className="w-full bg-slate-900 border-t border-slate-800 text-slate-200 select-none px-3 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`p-1.5 rounded-lg font-medium transition-all active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>

          <span className="text-[11px] font-mono text-slate-300">
            Frame <span className="text-indigo-400 font-bold">{activeFrameIndex + 1}</span> / {frames.length}
          </span>

          <div className="h-3 w-px bg-slate-800 mx-0.5" />

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 font-semibold">
            {fps} FPS
          </span>
        </div>

        <button
          onClick={onToggleMinimize}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-semibold border border-slate-700/60 shadow-sm"
          title="Expand Timeline Panel"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Timeline</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 text-slate-200 select-none flex flex-col">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 sm:py-2 border-b border-slate-800/80 text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={handleStepPrev}
            title="Previous Frame"
            className="p-1 sm:p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`p-1.5 sm:p-2 rounded-lg font-medium flex items-center justify-center transition-all active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />}
          </button>

          <button
            onClick={handleStepNext}
            title="Next Frame"
            className="p-1 sm:p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5 sm:mx-1" />

          {/* FPS Selector */}
          <div className="flex items-center gap-1 text-slate-400 font-medium text-[11px] sm:text-xs">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <select
              value={fps}
              onChange={(e) => onChangeFps(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-md px-1 py-0.5 text-[11px] sm:text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              {[6, 8, 12, 15, 24, 30, 60].map((rate) => (
                <option key={rate} value={rate}>
                  {rate} FPS
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Onion Skin Quick Toggle & Frame Count Selector */}
          <div className="flex items-center rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/50">
            <button
              onClick={onToggleOnionSkin}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
                onionSkin.enabled
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Onion Skin"
            >
              {onionSkin.enabled ? <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              <span className="hidden xs:inline">Onion</span>
            </button>

            {/* Quick Frame Count Selector directly inside the tool */}
            {onChangeOnionSkinSettings && (
              <select
                value={onionSkin.prevFrames}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onChangeOnionSkinSettings({ prevFrames: val, nextFrames: Math.min(val, 3) });
                }}
                className="bg-transparent text-indigo-300 font-mono text-[10px] sm:text-[11px] font-bold px-1 py-0.5 focus:outline-none cursor-pointer border-l border-slate-700/60 ml-0.5"
                title="Number of Onion Skin Frames"
              >
                <option value={1} className="bg-slate-900 text-slate-200">1 frame</option>
                <option value={2} className="bg-slate-900 text-slate-200">2 frames</option>
                <option value={3} className="bg-slate-900 text-slate-200">3 frames</option>
                <option value={4} className="bg-slate-900 text-slate-200">4 frames</option>
                <option value={5} className="bg-slate-900 text-slate-200">5 frames</option>
              </select>
            )}

            <button
              onClick={onOpenOnionSettings}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              title="Detailed Onion Skin Settings"
            >
              <Settings2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>

          <button
            onClick={onOpenLayers}
            className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] sm:text-xs transition-colors"
          >
            <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Layers</span>
            <span className="bg-slate-900 px-1 py-0.2 rounded text-[10px] text-slate-400 font-mono">
              {project.layers.length}
            </span>
          </button>

          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-1 sm:p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Minimize Timeline"
            >
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Frame Strip */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 overflow-x-auto custom-scrollbar">
        {frames.map((frame, index) => {
          const isActive = index === activeFrameIndex;

          let strokeCount = 0;
          project.layers.forEach((layer) => {
            const strokes = project.layerFrames[`${layer.id}:${frame.id}`];
            if (strokes) strokeCount += strokes.length;
          });

          return (
            <div
              key={frame.id}
              onClick={() => onSelectFrame(index)}
              className={`group relative flex-shrink-0 w-12 h-14 sm:w-16 sm:h-20 rounded-xl border-2 cursor-pointer flex flex-col justify-between p-1 sm:p-1.5 transition-all ${
                isActive
                  ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/10 scale-105 z-10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Top Frame Number badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[9px] sm:text-[10px] font-mono font-bold px-0.5 sm:px-1 rounded ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-500'
                  }`}
                >
                  {index + 1}
                </span>

                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    strokeCount > 0 ? 'bg-emerald-400' : 'bg-slate-800'
                  }`}
                  title={strokeCount > 0 ? `${strokeCount} stroke(s)` : 'Empty frame'}
                />
              </div>

              {/* Center thumbnail abstraction */}
              <div className="flex-1 my-0.5 sm:my-1 rounded bg-slate-900/60 border border-slate-800/50 flex items-center justify-center">
                <span className="text-[8px] sm:text-[9px] text-slate-500 font-mono">
                  {strokeCount > 0 ? `${strokeCount} St` : 'blank'}
                </span>
              </div>

              {/* Frame Action buttons on Hover / Active */}
              <div className="flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateFrame(index);
                  }}
                  title="Duplicate Frame"
                  className="p-0.5 text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                {frames.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFrame(index);
                    }}
                    title="Delete Frame"
                    className="p-0.5 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Frame Button */}
        <button
          onClick={onAddFrame}
          className="flex-shrink-0 w-12 h-14 sm:w-16 sm:h-20 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/80 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-400 flex flex-col items-center justify-center gap-0.5 sm:gap-1 transition-all active:scale-95"
          title="Add Blank Frame"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[10px] font-medium hidden xs:inline">Add</span>
        </button>
      </div>
    </div>
  );
};
