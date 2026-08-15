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
  { name: 'Violet', value: '#a855f7' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white/95 border border-slate-200/90 rounded-[2rem] shadow-[0_30px_90px_rgba(15,23,42,0.18)] overflow-hidden text-slate-900 backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/80 bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shadow-xs">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-950 leading-tight">Onion Skin Settings</h3>
              <p className="text-xs text-slate-500 mt-0.5">Control frame ghosting visibility & tints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-3.5">
              {settings.enabled ? (
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center">
                  <EyeOff className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="text-sm font-bold text-slate-900 block">Enable Onion Skin</span>
                <span className="text-xs text-slate-500">Show adjacent frames as translucent overlays</span>
              </div>
            </div>
            <button
              onClick={() => update({ enabled: !settings.enabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.enabled ? 'bg-indigo-600' : 'bg-slate-300'
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block shadow-2xs" style={{ backgroundColor: settings.prevColor }} />
                Previous Frames (Past): <span className="text-indigo-600 font-mono text-sm font-bold">{settings.prevFrames}</span>
              </label>
            </div>
            {/* Number Selector */}
            <div className="grid grid-cols-6 gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => update({ prevFrames: num })}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    settings.prevFrames === num
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Past Color Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-medium">Past Tint:</span>
              <div className="flex items-center gap-2">
                {PAST_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ prevColor: c.value })}
                    className={`w-6 h-6 rounded-xl border-2 transition-transform ${
                      settings.prevColor === c.value
                        ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-100'
                        : 'border-transparent hover:scale-105 shadow-2xs'
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block shadow-2xs" style={{ backgroundColor: settings.nextColor }} />
                Next Frames (Future): <span className="text-emerald-600 font-mono text-sm font-bold">{settings.nextFrames}</span>
              </label>
            </div>
            {/* Number Selector */}
            <div className="grid grid-cols-6 gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => update({ nextFrames: num })}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    settings.nextFrames === num
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Future Color Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-medium">Future Tint:</span>
              <div className="flex items-center gap-2">
                {FUTURE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ nextColor: c.value })}
                    className={`w-6 h-6 rounded-xl border-2 transition-transform ${
                      settings.nextColor === c.value
                        ? 'border-emerald-600 scale-110 shadow-sm ring-2 ring-emerald-100'
                        : 'border-transparent hover:scale-105 shadow-2xs'
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                Overlay Opacity
              </label>
              <span className="text-xs font-mono text-indigo-600 font-bold">
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
              className="w-full accent-indigo-600 bg-slate-200 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Quick Presets */}
          <div className="pt-3 border-t border-slate-200/80 space-y-2">
            <span className="text-xs text-slate-500 font-bold block">Quick Presets:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => update({ prevFrames: 1, nextFrames: 1, opacity: 0.35 })}
                className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
              >
                Classic (1f)
              </button>
              <button
                onClick={() => update({ prevFrames: 2, nextFrames: 2, opacity: 0.4 })}
                className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
              >
                Standard (2f)
              </button>
              <button
                onClick={() => update({ prevFrames: 4, nextFrames: 2, opacity: 0.5 })}
                className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
              >
                Motion (4f/2f)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
