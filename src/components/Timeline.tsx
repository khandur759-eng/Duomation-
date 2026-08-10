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
  onOpenOnionSettings: () => void;
  onOpenLayers: () => void;
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
  onOpenOnionSettings,
  onOpenLayers,
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

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 text-slate-200 select-none flex flex-col">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 text-xs">
        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleStepPrev}
            title="Previous Frame"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className={`p-2 rounded-lg font-medium flex items-center justify-center transition-all active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={handleStepNext}
            title="Next Frame"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* FPS Selector */}
          <div className="flex items-center gap-1 text-slate-400 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <select
              value={fps}
              onChange={(e) => onChangeFps(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-md px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
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
        <div className="flex items-center gap-2">
          {/* Onion Skin Quick Toggle */}
          <div className="flex items-center rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/50">
            <button
              onClick={onToggleOnionSkin}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                onionSkin.enabled
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Onion Skin"
            >
              {onionSkin.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Onion</span>
            </button>
            <button
              onClick={onOpenOnionSettings}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              title="Onion Skin Settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onOpenLayers}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Layers</span>
            <span className="bg-slate-900 px-1.5 py-0.2 rounded text-[10px] text-slate-400 font-mono">
              {project.layers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Frame Strip */}
      <div className="flex items-center gap-2 p-2.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
        {frames.map((frame, index) => {
          const isActive = index === activeFrameIndex;

          // Count strokes across all layers for this frame
          let strokeCount = 0;
          project.layers.forEach((layer) => {
            const strokes = project.layerFrames[`${layer.id}:${frame.id}`];
            if (strokes) strokeCount += strokes.length;
          });

          return (
            <div
              key={frame.id}
              onClick={() => onSelectFrame(index)}
              className={`group relative flex-shrink-0 w-16 h-20 rounded-xl border-2 cursor-pointer flex flex-col justify-between p-1.5 transition-all ${
                isActive
                  ? 'bg-indigo-950/60 border-indigo-500 shadow-md shadow-indigo-500/10 scale-105 z-10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Top Frame Number badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono font-bold px-1 rounded ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-500'
                  }`}
                >
                  {index + 1}
                </span>

                {/* Populated vs empty dot indicator */}
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    strokeCount > 0 ? 'bg-emerald-400' : 'bg-slate-800'
                  }`}
                  title={strokeCount > 0 ? `${strokeCount} stroke(s)` : 'Empty frame'}
                />
              </div>

              {/* Center thumbnail abstraction */}
              <div className="flex-1 my-1 rounded bg-slate-900/60 border border-slate-800/50 flex items-center justify-center">
                <span className="text-[9px] text-slate-600 font-mono">
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
                  <Copy className="w-3 h-3" />
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
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Frame Button */}
        <button
          onClick={onAddFrame}
          className="flex-shrink-0 w-16 h-20 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/80 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-400 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
          title="Add Blank Frame"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] font-medium">Add Frame</span>
        </button>
      </div>
    </div>
  );
};
