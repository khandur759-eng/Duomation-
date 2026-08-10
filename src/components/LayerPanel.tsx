import React from 'react';
import { Layer, Project } from '../types/animation';
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';

interface LayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onChangeOpacity: (layerId: string, opacity: number) => void;
  onReorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  onDeleteLayer: (layerId: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  isOpen,
  onClose,
  project,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onToggleVisibility,
  onToggleLock,
  onChangeOpacity,
  onReorderLayer,
  onDeleteLayer,
}) => {
  if (!isOpen) return null;

  const layers = project.layers;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-72 bg-slate-900/95 border-l border-slate-800 backdrop-blur-md shadow-2xl text-slate-200 flex flex-col">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white">Layers</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Add Layer CTA */}
      <div className="p-3 border-b border-slate-800/80">
        <button
          onClick={onAddLayer}
          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add New Layer
        </button>
      </div>

      {/* Layer List (Top layer is index 0 in UI) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {layers.slice().reverse().map((layer, reverseIndex) => {
          const actualIndex = layers.length - 1 - reverseIndex;
          const isActive = layer.id === activeLayerId;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`p-3 rounded-xl border transition-all ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md'
                  : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                  {layer.name}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(layer.id);
                    }}
                    className={`p-1 rounded transition-colors ${
                      layer.visible ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                  >
                    {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(layer.id);
                    }}
                    className={`p-1 rounded transition-colors ${
                      layer.locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                  >
                    {layer.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderLayer(layer.id, 'up');
                    }}
                    disabled={actualIndex === layers.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    title="Move Layer Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderLayer(layer.id, 'down');
                    }}
                    disabled={actualIndex === 0}
                    className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-30 transition-colors"
                    title="Move Layer Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {layers.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <span className="text-[10px] font-mono text-slate-400 w-12">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => onChangeOpacity(layer.id, Number(e.target.value) / 100)}
                  className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <span className="text-[10px] font-mono text-slate-300 w-8 text-right">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
