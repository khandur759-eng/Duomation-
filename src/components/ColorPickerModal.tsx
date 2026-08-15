import React, { useState } from 'react';
import { X, Pipette, Plus, Check, Palette } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  savedPalette: string[];
  onAddSavedColor: (color: string) => void;
  onPickFromCanvas?: () => void;
}

const PRESET_PALETTES = [
  {
    name: 'Animation Classic',
    colors: [
      '#000000', '#FFFFFF', '#EF4444', '#F97316', '#F59E0B', 
      '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', 
      '#EC4899', '#64748B'
    ],
  },
  {
    name: 'Character & Skin',
    colors: [
      '#FFF0EB', '#FCD5CE', '#F8AD9D', '#F4845F', '#D06040', 
      '#A84420', '#6F2B13', '#401507', '#FFE5B4', '#D2A079', 
      '#8C5A3C', '#54331C'
    ],
  },
  {
    name: 'Pastel Studio',
    colors: [
      '#FFD1DC', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', 
      '#E8DFF5', '#FCE1E4', '#FCF4DD', '#DDEDF4', '#E8E8E8', 
      '#F3C4FB', '#FFC6FF'
    ],
  },
  {
    name: 'Neon & Cyber',
    colors: [
      '#00FFCC', '#FF007F', '#7F00FF', '#00FF00', '#FFFF00', 
      '#FF3300', '#00E5FF', '#FF00CC', '#39FF14', '#CC00FF', 
      '#00FFFF', '#FF0055'
    ],
  },
  {
    name: 'Nature & Backgrounds',
    colors: [
      '#1E3A8A', '#1D4ED8', '#0284C7', '#0F766E', '#15803D', 
      '#65A30D', '#CA8A04', '#D97706', '#B45309', '#78350F', 
      '#451A03', '#27272A'
    ],
  },
  {
    name: 'Shading & Values',
    colors: [
      '#0F172A', '#1E293B', '#334155', '#475569', '#64748B', 
      '#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9', '#F8FAFC'
    ],
  },
];

export const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onClose,
  currentColor,
  onSelectColor,
  savedPalette,
  onAddSavedColor,
  onPickFromCanvas,
}) => {
  const [selectedHex, setSelectedHex] = useState<string>(currentColor);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'saved'>('presets');

  if (!isOpen) return null;

  const handleColorChange = (color: string) => {
    setSelectedHex(color);
    onSelectColor(color);
  };

  const handleNativeEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          handleColorChange(result.sRGBHex);
        }
      } catch (e) {
        // EyeDropper cancelled or unsupported
      }
    } else if (onPickFromCanvas) {
      onPickFromCanvas();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Color Palette & Picker</h3>
              <p className="text-xs text-slate-400">Select or create colors for your animation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Color Bar & Eyedropper CTA */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl border-2 border-slate-700 shadow-lg relative overflow-hidden"
              style={{ backgroundColor: selectedHex }}
            />
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Active Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selectedHex.toUpperCase()}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="bg-slate-100 border border-slate-300 font-mono text-xs font-semibold text-slate-800 px-2.5 py-1 rounded-lg w-24 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNativeEyedropper}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-700 transition-all active:scale-95"
              title="Pick color from screen or canvas"
            >
              <Pipette className="w-4 h-4 text-indigo-400" />
              <span>Eyedropper</span>
            </button>

            <button
              onClick={() => onAddSavedColor(selectedHex)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all active:scale-95 shadow-md shadow-indigo-600/20"
              title="Save to My Swatches"
            >
              <Plus className="w-4 h-4" />
              <span>Save Swatch</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'presets'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Animation Palettes
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'custom'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom Color Wheel
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'saved'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Swatches ({savedPalette.length})
          </button>
        </div>

        {/* Tab Contents */}
       <div className="p-6 max-h-[360px] overflow-y-auto space-y-6 custom-scrollbar bg-white">
          {activeTab === 'presets' && (
            <div className="space-y-5">
              {PRESET_PALETTES.map((palette) => (
                <div key={palette.name} className="space-y-2">
                  <span className="text-xs font-medium text-slate-700">{palette.name}</span>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                    {palette.colors.map((color) => {
                      const isSelected = selectedHex.toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          
                         className={`w-9 h-9 rounded-2xl border flex items-center justify-center
  transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95
  ${isSelected
    ? 'border-white ring-2 ring-indigo-500 ring-offset-2 ring-offset-white scale-110 z-10 shadow-lg'
    : 'border-slate-300/80 shadow-sm hover:border-indigo-400'
  }`}
 style={{ backgroundColor: color }}
                          title={color}
                        >
                          {isSelected && (
  <Check
    className={`w-4 h-4 drop-shadow-sm ${
      color === '#FFFFFF' || color === '#FFF0EB'
        ? 'text-black'
        : 'text-white'
    }`}
  />
)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="flex flex-col items-center gap-6 py-2">
              <div className="w-full flex flex-col items-center gap-4">
                <label className="relative cursor-pointer group">
                  <input
                    type="color"
                    value={selectedHex}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-48 h-48 rounded-full cursor-pointer opacity-0 absolute inset-0 z-10"
                  />
                  <div
                    className="w-48 h-48 rounded-full border-4 border-slate-700 shadow-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ backgroundColor: selectedHex }}
                  >
                    <span className={`text-sm font-bold font-mono px-3 py-1.5 rounded-xl backdrop-blur-md ${
                      selectedHex.toLowerCase() === '#ffffff' ? 'text-black bg-black/10' : 'text-white bg-black/40'
                    }`}>
                      Click to Open System Picker
                    </span>
                  </div>
                </label>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  Click the color circle above to fine-tune RGB, HSL, or HSV values with your system color picker.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedPalette.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No saved swatches yet. Click "Save Swatch" above to save colors you create!
                </div>
              ) : (
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2.5">
                  {savedPalette.map((color, index) => {
                    const isSelected = selectedHex.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={`${color}-${index}`}
                        onClick={() => handleColorChange(color)}
                        className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
                          isSelected ? 'border-white ring-2 ring-indigo-500/50 scale-105 z-10' : 'border-slate-800'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
