import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Pipette, Plus, Check, Palette, Sparkles, RefreshCw, Layers, Sliders, History } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  savedPalette: string[];
  onAddSavedColor: (color: string) => void;
  onPickFromCanvas?: () => void;
}

type HarmonyMode = 'none' | 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split';

// Color conversion helpers
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) {
    return { r: 99, g: 102, b: 241 }; // fallback indigo
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
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
  const [initialColor, setInitialColor] = useState<string>(currentColor);
  const [activeTab, setActiveTab] = useState<'wheel' | 'presets' | 'saved'>('wheel');
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>('none');
  const [recentColors, setRecentColors] = useState<string[]>([
    '#000000', '#FFFFFF', '#4F46E5', '#EF4444', '#10B981', '#F59E0B'
  ]);

  // HSV state
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => {
    const rgb = hexToRgb(currentColor);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeInteractionRef = useRef<'hue' | 'sv' | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedHex(currentColor);
      setInitialColor(currentColor);
      const rgb = hexToRgb(currentColor);
      setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    }
  }, [isOpen, currentColor]);

  const updateFromHsv = useCallback(
    (newHsv: { h: number; s: number; v: number }) => {
      setHsv(newHsv);
      const hex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      setSelectedHex(hex);
      onSelectColor(hex);

      // Track recent colors without duplicates
      setRecentColors((prev) => {
        const filtered = prev.filter((c) => c.toUpperCase() !== hex.toUpperCase());
        return [hex, ...filtered].slice(0, 10);
      });
    },
    [onSelectColor]
  );

  const handleColorChange = (color: string) => {
    setSelectedHex(color);
    const rgb = hexToRgb(color);
    setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
    onSelectColor(color);

    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toUpperCase() !== color.toUpperCase());
      return [color, ...filtered].slice(0, 10);
    });
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

  // Dimensions for Procreate / Studio Disc
  const CANVAS_SIZE = 260;
  const CENTER = CANVAS_SIZE / 2;
  const OUTER_RADIUS = 120;
  const INNER_RADIUS = 96;
  const BOX_HALF = 54; // Inner square half-width (108px x 108px)

  // Calculate harmony offsets
  const getHarmonyOffsets = (mode: HarmonyMode): number[] => {
    switch (mode) {
      case 'complementary':
        return [180];
      case 'analogous':
        return [30, -30];
      case 'triadic':
        return [120, 240];
      case 'tetradic':
        return [90, 180, 270];
      case 'split':
        return [150, 210];
      default:
        return [];
    }
  };

  // Render the Professional Procreate-style Color Wheel (Outer Ring + Inner Saturation/Value Square + Harmony Nodes)
  useEffect(() => {
    if (activeTab !== 'wheel') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 2;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Draw Continuous 360° Hue Ring
    for (let angle = 0; angle < 360; angle += 0.5) {
      const radStart = ((angle - 0.5) * Math.PI) / 180;
      const radEnd = ((angle + 0.5) * Math.PI) / 180;

      ctx.beginPath();
      ctx.arc(CENTER, CENTER, (OUTER_RADIUS + INNER_RADIUS) / 2, radStart, radEnd);
      ctx.lineWidth = OUTER_RADIUS - INNER_RADIUS;
      ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.stroke();
    }

    // Outer and Inner ring subtle outlines
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, OUTER_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CENTER, CENTER, INNER_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Draw Inner Saturation-Value (S/V) Square with Rounded Corners
    const boxX = CENTER - BOX_HALF;
    const boxY = CENTER - BOX_HALF;
    const boxSize = BOX_HALF * 2;
    const cornerRadius = 14;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxSize, boxSize, cornerRadius);
    ctx.clip();

    // Pure Hue base fill
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);

    // Horizontal White Gradient (Saturation: White to Pure Hue)
    const whiteGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxSize, boxY);
    whiteGrad.addColorStop(0, '#FFFFFF');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);

    // Vertical Black Gradient (Value: Top bright to Bottom Black)
    const blackGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxSize);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, '#000000');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(boxX, boxY, boxSize, boxSize);

    // Inner Box border
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 3. Draw Harmony Nodes on Ring
    const harmonyOffsets = getHarmonyOffsets(harmonyMode);
    harmonyOffsets.forEach((offset) => {
      const harmAngle = (hsv.h + offset + 360) % 360;
      const harmRad = (harmAngle * Math.PI) / 180;
      const ringMid = (OUTER_RADIUS + INNER_RADIUS) / 2;
      const hx = CENTER + Math.cos(harmRad) * ringMid;
      const hy = CENTER + Math.sin(harmRad) * ringMid;

      // Connecting line to center
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Harmony Node Marker
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${harmAngle}, 100%, 50%)`;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.stroke();
    });

    // 4. Draw Active Hue Ring Handle (Thumb)
    const hueRad = (hsv.h * Math.PI) / 180;
    const ringMid = (OUTER_RADIUS + INNER_RADIUS) / 2;
    const handleX = CENTER + Math.cos(hueRad) * ringMid;
    const handleY = CENTER + Math.sin(hueRad) * ringMid;

    ctx.save();
    ctx.beginPath();
    ctx.arc(handleX, handleY, 10, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.stroke();
    ctx.restore();

    // 5. Draw Active Saturation/Value Cursor inside Square
    const cursorX = boxX + hsv.s * boxSize;
    const cursorY = boxY + (1 - hsv.v) * boxSize;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 7, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = hsv.v < 0.5 ? '#FFFFFF' : '#000000';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = hsv.v < 0.5 ? '#000000' : '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }, [activeTab, hsv, harmonyMode]);

  // Pointer Interaction Logic for Hue Ring and Inner Box
  const handlePointerInteraction = useCallback(
    (clientX: number, clientY: number, forceTarget?: 'hue' | 'sv') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scale = CANVAS_SIZE / rect.width;

      const px = (clientX - rect.left) * scale;
      const py = (clientY - rect.top) * scale;

      const dx = px - CENTER;
      const dy = py - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const target = forceTarget || activeInteractionRef.current;

      if (target === 'hue' || (!target && dist >= INNER_RADIUS - 8 && dist <= OUTER_RADIUS + 12)) {
        activeInteractionRef.current = 'hue';
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        updateFromHsv({ ...hsv, h: angle });
      } else if (target === 'sv' || (!target && dist < INNER_RADIUS - 8)) {
        activeInteractionRef.current = 'sv';
        const boxX = CENTER - BOX_HALF;
        const boxY = CENTER - BOX_HALF;
        const boxSize = BOX_HALF * 2;

        const s = Math.max(0, Math.min(1, (px - boxX) / boxSize));
        const v = Math.max(0, Math.min(1, 1 - (py - boxY) / boxSize));

        updateFromHsv({ ...hsv, s, v });
      }
    },
    [hsv, updateFromHsv]
  );

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handlePointerInteraction(e.clientX, e.clientY);
  };

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      handlePointerInteraction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (activeInteractionRef.current) {
        handlePointerInteraction(e.clientX, e.clientY);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (activeInteractionRef.current && e.touches.length > 0) {
        handlePointerInteraction(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalUp = () => {
      activeInteractionRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', handleGlobalUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [handlePointerInteraction]);

  // Dynamic Tints & Shades Generator (Cel-Shading Palette)
  const tintsAndShades = [
    hsvToHex(hsv.h, Math.max(0, hsv.s * 0.4), Math.min(1, hsv.v * 1.3)),
    hsvToHex(hsv.h, Math.max(0, hsv.s * 0.7), Math.min(1, hsv.v * 1.15)),
    selectedHex,
    hsvToHex(hsv.h, Math.min(1, hsv.s * 1.15), Math.max(0, hsv.v * 0.8)),
    hsvToHex(hsv.h, Math.min(1, hsv.s * 1.3), Math.max(0, hsv.v * 0.6)),
    hsvToHex(hsv.h, 1, Math.max(0, hsv.v * 0.35)),
  ];

  // Active Harmony Palette Colors
  const harmonyColors = [
    selectedHex,
    ...getHarmonyOffsets(harmonyMode).map((offset) =>
      hsvToHex((hsv.h + offset + 360) % 360, hsv.s, hsv.v)
    ),
  ];

  const currentRgb = hexToRgb(selectedHex);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-white/95 border border-slate-200/90 rounded-[2rem] w-full max-w-lg shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-2xl overflow-hidden flex flex-col">
        {/* Modal Header: Heading only Colors */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-950 text-lg leading-none">Colors</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aligned Toolbar: Dual Color Swatch (Current vs Previous), Hex Input, Eyedropper, Save Swatch */}
        <div className="px-6 py-3.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          {/* Dual Current / Previous Swatch comparison & Hex code */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex w-12 h-10 rounded-xl border border-slate-300 shadow-xs shrink-0 overflow-hidden ring-2 ring-slate-100/90"
              title="Left: Initial Color, Right: Current Active Color"
            >
              <button
                type="button"
                onClick={() => handleColorChange(initialColor)}
                className="w-1/2 h-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: initialColor }}
                title={`Revert to Initial: ${initialColor}`}
              />
              <div
                className="w-1/2 h-full"
                style={{ backgroundColor: selectedHex }}
                title={`Current Color: ${selectedHex}`}
              />
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-slate-400 font-mono text-xs font-bold pointer-events-none">#</span>
              <input
                type="text"
                value={selectedHex.replace('#', '').toUpperCase()}
                onChange={(e) => {
                  const val = '#' + e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                  setSelectedHex(val);
                  if (val.length === 7) {
                    handleColorChange(val);
                  }
                }}
                className="h-10 pl-6 pr-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-all"
                placeholder="FFFFFF"
              />
            </div>
          </div>

          {/* Action tools aligned in a straight line */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleNativeEyedropper}
              className="h-10 flex items-center gap-1.5 px-3 rounded-xl bg-white hover:bg-slate-100/90 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Pick active color with Eyedropper"
            >
              <Pipette className="w-4 h-4 text-indigo-600" />
              <span>Eyedropper</span>
            </button>

            <button
              onClick={() => onAddSavedColor(selectedHex)}
              className="h-10 flex items-center gap-1.5 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
              title="Save to My Swatches"
            >
              <Plus className="w-4 h-4" />
              <span>Save Swatch</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200/80 px-6 bg-white">
          <button
            onClick={() => setActiveTab('wheel')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'wheel'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Color Disc & Harmony
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'presets'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Animation Palettes
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'saved'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            My Swatches ({savedPalette.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 sm:p-6 max-h-[440px] overflow-y-auto space-y-5 custom-scrollbar bg-white">
          {activeTab === 'wheel' && (
            <div className="flex flex-col items-center gap-5">
              {/* Harmony Mode Selector Strip */}
              <div className="w-full flex items-center justify-between bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80 gap-1 overflow-x-auto text-[11px] font-bold">
                {(
                  [
                    { id: 'none', label: 'Single' },
                    { id: 'complementary', label: 'Complementary' },
                    { id: 'analogous', label: 'Analogous' },
                    { id: 'triadic', label: 'Triadic' },
                    { id: 'tetradic', label: 'Tetradic' },
                    { id: 'split', label: 'Split' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setHarmonyMode(mode.id)}
                    className={`flex-1 min-w-[4.2rem] py-1 px-2 rounded-xl transition-all text-center whitespace-nowrap cursor-pointer ${
                      harmonyMode === mode.id
                        ? 'bg-white text-indigo-600 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Procreate Studio Color Disc Canvas */}
              <div className="relative flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  onMouseDown={onMouseDown}
                  onTouchStart={onTouchStart}
                  className="w-64 h-64 sm:w-68 sm:h-68 rounded-full cursor-crosshair shadow-md ring-4 ring-slate-100 hover:ring-indigo-100 transition-all touch-none"
                />
              </div>

              {/* Harmony Color Swatches (if Harmony active) */}
              {harmonyMode !== 'none' && (
                <div className="w-full space-y-2 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/80">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Harmonious Palette
                    </span>
                    <span className="text-[10px] text-indigo-500">Tap to select</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                    {harmonyColors.map((color, idx) => (
                      <button
                        key={`${color}-${idx}`}
                        onClick={() => handleColorChange(color)}
                        className={`h-9 rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${
                          selectedHex.toUpperCase() === color.toUpperCase()
                            ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 border-white'
                            : 'border-slate-200 hover:border-indigo-400'
                        }`}
                        style={{ backgroundColor: color }}
                        title={`Select Harmony Color: ${color}`}
                      >
                        {selectedHex.toUpperCase() === color.toUpperCase() && (
                          <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Cel-Shading Highlights & Shadows (Tints & Shades) */}
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Tints & Shades (Shading Strip)
                  </span>
                  <span className="text-[10px] text-slate-400">Highlights → Shadows</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {tintsAndShades.map((color, idx) => (
                    <button
                      key={`shade-${idx}`}
                      onClick={() => handleColorChange(color)}
                      className={`h-8 rounded-xl border transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xs ${
                        selectedHex.toUpperCase() === color.toUpperCase()
                          ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 border-white'
                          : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Cel shade ${idx + 1}: ${color}`}
                    />
                  ))}
                </div>
              </div>

              {/* Sliders & Numeric RGB Precision Inputs */}
              <div className="w-full space-y-3 pt-1">
                {/* Hue Spectrum Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span>Hue</span>
                    <span className="font-mono">{Math.round(hsv.h)}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={hsv.h}
                    onChange={(e) => updateFromHsv({ ...hsv, h: parseFloat(e.target.value) })}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer shadow-inner"
                    style={{
                      background:
                        'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    }}
                  />
                </div>

                {/* Brightness / Value Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                    <span>Brightness</span>
                    <span className="font-mono">{Math.round(hsv.v * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={hsv.v}
                    onChange={(e) => updateFromHsv({ ...hsv, v: parseFloat(e.target.value) })}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer shadow-inner"
                    style={{
                      background: `linear-gradient(to right, #000000, ${hsvToHex(hsv.h, hsv.s, 1)})`,
                    }}
                  />
                </div>

                {/* RGB Numeric Fields */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {(['r', 'g', 'b'] as const).map((channel) => (
                    <div
                      key={channel}
                      className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs"
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5">{channel}</span>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={currentRgb[channel]}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                          const newRgb = { ...currentRgb, [channel]: val };
                          handleColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
                        }}
                        className="w-full bg-transparent font-mono text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Colors History */}
              <div className="w-full space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <History className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Recent Colors</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {recentColors.map((color, i) => (
                    <button
                      key={`recent-${i}-${color}`}
                      onClick={() => handleColorChange(color)}
                      className={`w-7 h-7 rounded-lg shrink-0 border transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xs ${
                        selectedHex.toUpperCase() === color.toUpperCase()
                          ? 'ring-2 ring-indigo-600 ring-offset-1 scale-105 border-white'
                          : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Recent: ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-5">
              {PRESET_PALETTES.map((palette) => (
                <div key={palette.name} className="space-y-2">
                  <span className="text-xs font-bold text-slate-700">{palette.name}</span>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                    {palette.colors.map((color) => {
                      const isSelected = selectedHex.toLowerCase() === color.toLowerCase();
                      return (
                        <button
                          key={color}
                          onClick={() => handleColorChange(color)}
                          className={`w-9 h-9 rounded-2xl border flex items-center justify-center
  transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95 cursor-pointer
  ${
    isSelected
      ? 'border-white ring-2 ring-indigo-600 ring-offset-2 ring-offset-white scale-110 z-10 shadow-lg'
      : 'border-slate-300/80 shadow-2xs hover:border-indigo-400'
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

          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedPalette.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
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
                        className={`w-9 h-9 rounded-2xl border flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'border-white ring-2 ring-indigo-600 ring-offset-2 ring-offset-white scale-105 z-10 shadow-md'
                            : 'border-slate-300 shadow-2xs hover:border-indigo-400'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {isSelected && (
                          <Check className={`w-4 h-4 drop-shadow ${color === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};


