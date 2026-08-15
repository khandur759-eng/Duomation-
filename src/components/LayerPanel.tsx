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
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white/95 border-l border-slate-200/90 backdrop-blur-2xl shadow-2xl text-slate-900 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-950 text-sm">Layers Panel</h3>
            <p className="text-[11px] text-slate-500">{layers.length} active layer{layers.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Close layers panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Add Layer CTA */}
      <div className="p-3.5 border-b border-slate-200/80">
        <button
          onClick={onAddLayer}
          className="w-full py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add New Layer
        </button>
      </div>

      {/* Layer List (Top layer is index 0 in UI) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
        {layers.slice().reverse().map((layer, reverseIndex) => {
          const actualIndex = layers.length - 1 - reverseIndex;
          const isActive = layer.id === activeLayerId;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50/80 border-indigo-600 shadow-md shadow-indigo-500/10'
                  : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                  {layer.name}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(layer.id);
                    }}
                    className={`p-1 rounded-lg transition-colors ${
                      layer.visible ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
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
                    className={`p-1 rounded-lg transition-colors ${
                      layer.locked ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
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
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors rounded-lg"
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
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors rounded-lg"
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
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                <span className="text-[10px] font-mono font-semibold text-slate-500 w-12">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(layer.opacity * 100)}
                  onChange={(e) => onChangeOpacity(layer.id, Number(e.target.value) / 100)}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-[10px] font-mono font-bold text-slate-700 w-8 text-right">
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
