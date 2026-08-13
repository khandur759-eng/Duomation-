import React from 'react';
import { OnionSkinSettings } from '../types/animation';
import { Eye, EyeOff, X, Sliders, Layers } from 'lucide-react';

interface OnionSkinModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: OnionSkinSettings;
  onChangeSettings: (newSettings: OnionSkinSettings) => void;
}

const PAST_COLORS = [
  { name: 'Blue', value: '#0066ff' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Amber', value: '#f59e0b' },
];

const FUTURE_COLORS = [
  { name: 'Green', value: '#00cc66' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Pink', value: '#ec4899' },
];

export const OnionSkinModal: React.FC<OnionSkinModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
}) => {
  if (!isOpen) return null;

  const update = (partial: Partial<OnionSkinSettings>) => {
    onChangeSettings({
      ...settings,
      ...partial,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Onion Skin Settings</h3>
              <p className="text-xs text-slate-400">Control frame ghosting visibility</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              {settings.enabled ? (
                <Eye className="w-5 h-5 text-indigo-400" />
              ) : (
                <EyeOff className="w-5 h-5 text-slate-500" />
              )}
              <div>
                <span className="text-sm font-semibold text-white block">Enable Onion Skin</span>
                <span className="text-xs text-slate-400">Show adjacent frames as translucent overlays</span>
              </div>
            </div>
            <button
              onClick={() => update({ enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.enabled ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Past Frames Count & Color */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: settings.prevColor }} />
                Previous Frames (Past): <span className="text-indigo-400 font-mono text-sm">{settings.prevFrames}</span>
              </label>
            </div>
            {/* Number Selector */}
            <div className="grid grid-cols-6 gap-1.5 p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => update({ prevFrames: num })}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    settings.prevFrames === num
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Past Color Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-400">Past Tint:</span>
              <div className="flex items-center gap-1.5">
                {PAST_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ prevColor: c.value })}
                    className={`w-6 h-6 rounded-lg border-2 transition-transform ${
                      settings.prevColor === c.value
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Future Frames Count & Color */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: settings.nextColor }} />
                Next Frames (Future): <span className="text-emerald-400 font-mono text-sm">{settings.nextFrames}</span>
              </label>
            </div>
            {/* Number Selector */}
            <div className="grid grid-cols-6 gap-1.5 p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => update({ nextFrames: num })}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    settings.nextFrames === num
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Future Color Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-400">Future Tint:</span>
              <div className="flex items-center gap-1.5">
                {FUTURE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ nextColor: c.value })}
                    className={`w-6 h-6 rounded-lg border-2 transition-transform ${
                      settings.nextColor === c.value
                        ? 'border-white scale-110 shadow-lg'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                Overlay Opacity
              </label>
              <span className="text-xs font-mono text-indigo-300 font-bold">
                {Math.round(settings.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={settings.opacity}
              onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Quick Presets */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <span className="text-xs text-slate-400 font-semibold block">Quick Presets:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => update({ prevFrames: 1, nextFrames: 1, opacity: 0.35 })}
                className="py-1.5 px-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
              >
                Classic (1f)
              </button>
              <button
                onClick={() => update({ prevFrames: 2, nextFrames: 2, opacity: 0.4 })}
                className="py-1.5 px-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
              >
                Standard (2f)
              </button>
              <button
                onClick={() => update({ prevFrames: 4, nextFrames: 2, opacity: 0.5 })}
                className="py-1.5 px-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
              >
                Motion (4f/2f)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
