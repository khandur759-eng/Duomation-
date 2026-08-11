import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Project,
  Stroke,
  ToolType,
  Point,
  ToolSettings,
  SessionState,
} from '../types/animation';
import { renderCanvasFrame, floodFill } from '../engine/renderer';
import { stabilizePoint, simplifyPoints } from '../engine/smoothing';
import { syncService } from '../services/syncService';
import { saveProject } from '../utils/db';

import { Timeline } from './Timeline';
import { LayerPanel } from './LayerPanel';
import { PairingModal } from './PairingModal';
import { ExportModal } from './ExportModal';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ColorPickerModal } from './ColorPickerModal';

import {
  Pencil,
  PenTool,
  Paintbrush,
  Eraser,
  PaintBucket,
  Minus,
  Square,
  Circle,
  Undo2,
  Redo2,
  QrCode,
  Download,
  Activity,
  Layers as LayersIcon,
  Home,
  Sliders,
  Eye,
  Check,
  ChevronDown,
  Highlighter,
  Sparkles,
  Feather,
  Pipette,
  Palette,
  Flame,
  X,
  ChevronRight,
  Wrench,
} from 'lucide-react';

interface DrawingWorkspaceProps {
  project: Project;
  sessionState: SessionState;
  onReturnHome: () => void;
}

export const DrawingWorkspace: React.FC<DrawingWorkspaceProps> = ({
  project: initialProject,
  sessionState,
  onReturnHome,
}) => {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [activeLayerId, setActiveLayerId] = useState<string>(
    initialProject.layers[0]?.id || 'layer_1'
  );

  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    activeTool: 'pencil',
    color: '#000000',
    size: 6,
    opacity: 1,
    stabilizer: 3,
    recentColors: ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'],
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);

  // UI Modals & Drawers
  const [isPairingOpen, setIsPairingOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isOnionSettingsOpen, setIsOnionSettingsOpen] = useState<boolean>(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState<boolean>(false);

  const [savedPalette, setSavedPalette] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('anim_saved_palette');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'];
  });

  const handleAddSavedColor = (color: string) => {
    setSavedPalette((prev) => {
      if (prev.includes(color)) return prev;
      const updated = [color, ...prev].slice(0, 30);
      try {
        localStorage.setItem('anim_saved_palette', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Real-time Drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);
  const currentStrokeIdRef = useRef<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackTimerRef = useRef<number | null>(null);

  // Autosave Project throttled
  const saveTimeoutRef = useRef<number | null>(null);
  const triggerAutosave = useCallback((updatedProject: Project) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveProject(updatedProject);
    }, 1000);
  }, []);

  // Centralized Authoritative Mutation Commit
  const commitMutation = useCallback(
    (mutator: (prev: Project) => Project) => {
      setProject((prev) => {
        const mutated = mutator(prev);
        const nextRev = (mutated.revision || 1) + 1;
        const updatedProject: Project = {
          ...mutated,
          revision: nextRev,
          updatedAt: Date.now(),
        };
        syncService.sendProjectUpdate(updatedProject);
        triggerAutosave(updatedProject);
        return updatedProject;
      });
    },
    [triggerAutosave]
  );

  // Subscribe to snapshot requests from Device B
  useEffect(() => {
    const unsubscribe = syncService.subscribe((event, data) => {
      if (event === 'request-sync-snapshot') {
        const targetSocketId = data?.requestedBy;
        syncService.sendSyncSnapshot(project, activeFrameIndex, targetSocketId);
      }
    });
    return () => unsubscribe();
  }, [project, activeFrameIndex]);

  // Record undo state before modification
  const pushUndo = useCallback((stateToSave: Project) => {
    setUndoStack((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(stateToSave))]);
    setRedoStack([]);
  }, []);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(project))]);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    const nextRev = (project.revision || 1) + 1;
    const restored = { ...previous, revision: nextRev, updatedAt: Date.now() };
    setProject(restored);
    syncService.sendProjectUpdate(restored);
    triggerAutosave(restored);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(project))]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    const nextRev = (project.revision || 1) + 1;
    const restored = { ...next, revision: nextRev, updatedAt: Date.now() };
    setProject(restored);
    syncService.sendProjectUpdate(restored);
    triggerAutosave(restored);
  };

  // Synchronize canvas rendering
  const renderPass = useCallback(() => {
    if (!canvasRef.current) return;

    const activeStroke: Stroke | null = isDrawing && currentStrokePoints.length > 0
      ? {
          id: currentStrokeIdRef.current || 'active',
          tool: toolSettings.activeTool,
          color: toolSettings.color,
          size: toolSettings.size,
          opacity: toolSettings.opacity,
          points: currentStrokePoints,
          layerId: activeLayerId,
          frameId: project.frames[activeFrameIndex]?.id || 'f1',
          timestamp: Date.now(),
        }
      : null;

    renderCanvasFrame({
      canvas: canvasRef.current,
      project,
      activeFrameIndex,
      activeLayerId,
      activeStroke,
      zoom,
      panX: pan.x,
      panY: pan.y,
      showOnionSkin: project.settings.onionSkin.enabled,
    });
  }, [
    project,
    activeFrameIndex,
    activeLayerId,
    isDrawing,
    currentStrokePoints,
    toolSettings,
    zoom,
    pan,
  ]);

  // Handle Resize and DPR
  const updateCanvasBounds = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const targetAspect = (project.settings?.width || 1920) / (project.settings?.height || 1080);
    const containerAspect = rect.width / rect.height;

    let displayWidth = rect.width;
    let displayHeight = rect.height;

    if (containerAspect > targetAspect) {
      displayHeight = rect.height;
      displayWidth = rect.height * targetAspect;
    } else {
      displayWidth = rect.width;
      displayHeight = rect.width / targetAspect;
    }

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    renderPass();
  }, [project.settings?.width, project.settings?.height, renderPass]);

  useEffect(() => {
    updateCanvasBounds();
    window.addEventListener('resize', updateCanvasBounds);
    window.addEventListener('orientationchange', updateCanvasBounds);

    let ro: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateCanvasBounds();
      });
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateCanvasBounds);
      window.removeEventListener('orientationchange', updateCanvasBounds);
      if (ro) ro.disconnect();
    };
  }, [updateCanvasBounds]);

  useEffect(() => {
    renderPass();
  }, [renderPass]);

  // Animation Playback Engine
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    const intervalMs = 1000 / (project.settings.fps || 12);
    playbackTimerRef.current = window.setInterval(() => {
      setActiveFrameIndex((prev) => {
        const next = (prev + 1) % project.frames.length;
        syncService.sendSelectFrame(next);
        return next;
      });
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, project.settings.fps, project.frames.length]);

  // Pointer & Touch Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) setIsPlaying(false);
    if (!canvasRef.current) return;

    // Verify active layer is unlocked and visible
    const currentLayer = project.layers.find((l) => l.id === activeLayerId);
    if (currentLayer && (currentLayer.locked || !currentLayer.visible)) return;

    canvasRef.current.setPointerCapture(e.pointerId);

    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    const initialPoint: Point = { x: rawX, y: rawY, pressure };

    // Eyedropper tool execution
    if (toolSettings.activeTool === 'eyedropper') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        const px = Math.floor(rawX * canvas.width);
        const py = Math.floor(rawY * canvas.height);
        const pixelData = ctx.getImageData(px, py, 1, 1).data;
        if (pixelData[3] > 0) {
          const hex = `#${((1 << 24) + (pixelData[0] << 16) + (pixelData[1] << 8) + pixelData[2]).toString(16).slice(1)}`;
          handleColorChange(hex);
        }
      }
      setToolSettings((prev) => ({ ...prev, activeTool: 'pencil' }));
      return;
    }

    // Fill tool execution
    if (toolSettings.activeTool === 'fill') {
      pushUndo(project);
      const strokeId = 'st_' + Math.random().toString(36).substring(2, 9);
      const fillStroke: Stroke = {
        id: strokeId,
        tool: 'fill',
        color: toolSettings.color,
        size: toolSettings.size,
        opacity: toolSettings.opacity,
        points: [initialPoint],
        layerId: activeLayerId,
        frameId: project.frames[activeFrameIndex].id,
        timestamp: Date.now(),
      };
      const key = `${activeLayerId}:${project.frames[activeFrameIndex].id}`;
      const existingStrokes = project.layerFrames[key] || [];
      const updatedProject: Project = {
        ...project,
        updatedAt: Date.now(),
        layerFrames: {
          ...project.layerFrames,
          [key]: [...existingStrokes, fillStroke],
        },
      };
      setProject(updatedProject);
      syncService.sendStrokeEnd(fillStroke);
      triggerAutosave(updatedProject);
      return;
    }

    pushUndo(project);
    setIsDrawing(true);

    const strokeId = 'st_' + Math.random().toString(36).substring(2, 9);
    currentStrokeIdRef.current = strokeId;
    setCurrentStrokePoints([initialPoint]);

    // Broadcast stroke-start
    syncService.sendStrokeStart({
      strokeId,
      tool: toolSettings.activeTool,
      color: toolSettings.color,
      size: toolSettings.size,
      opacity: toolSettings.opacity,
      layerId: activeLayerId,
      frameId: project.frames[activeFrameIndex].id,
      points: [initialPoint],
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    const rawPoint: Point = { x: rawX, y: rawY, pressure };
    const smoothedPoint = stabilizePoint(rawPoint, currentStrokePoints, toolSettings.stabilizer);

    setCurrentStrokePoints((prev) => {
      const next = [...prev, smoothedPoint];
      // Send real-time points batch to socket
      syncService.sendStrokePoints(currentStrokeIdRef.current || '', [smoothedPoint]);
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }

    setIsDrawing(false);

    if (currentStrokePoints.length === 0) return;

    // Simplify completed stroke or lock shape points
    let finalPoints: Point[] = [];
    if (
      toolSettings.activeTool === 'line' ||
      toolSettings.activeTool === 'rectangle' ||
      toolSettings.activeTool === 'ellipse'
    ) {
      finalPoints = [
        currentStrokePoints[0],
        currentStrokePoints[currentStrokePoints.length - 1],
      ];
    } else {
      finalPoints = simplifyPoints(currentStrokePoints, 0.0003);
    }

    const newStroke: Stroke = {
      id: currentStrokeIdRef.current || 'st_' + Date.now(),
      tool: toolSettings.activeTool,
      color: toolSettings.color,
      size: toolSettings.size,
      opacity: toolSettings.opacity,
      points: finalPoints,
      layerId: activeLayerId,
      frameId: project.frames[activeFrameIndex]?.id || 'f1',
      timestamp: Date.now(),
    };

    const key = `${activeLayerId}:${project.frames[activeFrameIndex]?.id}`;
    
    commitMutation((prev) => {
      const existingStrokes = prev.layerFrames[key] || [];
      return {
        ...prev,
        layerFrames: {
          ...prev.layerFrames,
          [key]: [...existingStrokes, newStroke],
        },
      };
    });

    setCurrentStrokePoints([]);
    currentStrokeIdRef.current = null;

    // Sync stroke end event
    syncService.sendStrokeEnd(newStroke);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
    setCurrentStrokePoints([]);
    currentStrokeIdRef.current = null;
  };

  // Timeline Handlers
  const handleSelectFrame = (index: number) => {
    const safeIdx = Math.max(0, Math.min(index, project.frames.length - 1));
    setActiveFrameIndex(safeIdx);
    syncService.sendSelectFrame(safeIdx);
  };

  const handleAddFrame = () => {
    pushUndo(project);
    const newFrame = {
      id: 'frame_' + Math.random().toString(36).substring(2, 8),
      name: `Frame ${project.frames.length + 1}`,
      durationMultiplier: 1,
    };

    commitMutation((prev) => ({
      ...prev,
      frames: [...prev.frames, newFrame],
    }));

    setActiveFrameIndex(project.frames.length);
  };

  const handleDuplicateFrame = (index: number) => {
    pushUndo(project);
    const sourceFrame = project.frames[index];
    if (!sourceFrame) return;

    const newFrameId = 'frame_' + Math.random().toString(36).substring(2, 8);
    const newFrame = { ...sourceFrame, id: newFrameId, name: `${sourceFrame.name} Copy` };

    commitMutation((prev) => {
      const updatedFrames = [...prev.frames];
      updatedFrames.splice(index + 1, 0, newFrame);

      const updatedLayerFrames = { ...prev.layerFrames };
      prev.layers.forEach((layer) => {
        const sourceKey = `${layer.id}:${sourceFrame.id}`;
        const targetKey = `${layer.id}:${newFrameId}`;
        if (prev.layerFrames[sourceKey]) {
          // Deep clone strokes and assign new unique stroke IDs to prevent duplicate stroke filtering
          const sourceStrokes: Stroke[] = JSON.parse(JSON.stringify(prev.layerFrames[sourceKey]));
          updatedLayerFrames[targetKey] = sourceStrokes.map((st) => ({
            ...st,
            id: 'st_dup_' + Math.random().toString(36).substring(2, 9),
            frameId: newFrameId,
          }));
        }
      });

      return {
        ...prev,
        frames: updatedFrames,
        layerFrames: updatedLayerFrames,
      };
    });

    setActiveFrameIndex(index + 1);
  };

  const handleDeleteFrame = (index: number) => {
    if (project.frames.length <= 1) return;
    pushUndo(project);

    const targetFrame = project.frames[index];
    if (!targetFrame) return;

    commitMutation((prev) => {
      const updatedFrames = prev.frames.filter((_, i) => i !== index);
      const updatedLayerFrames = { ...prev.layerFrames };

      // Clean up layerFrames associated with deleted frame ID
      prev.layers.forEach((layer) => {
        delete updatedLayerFrames[`${layer.id}:${targetFrame.id}`];
      });

      return {
        ...prev,
        frames: updatedFrames,
        layerFrames: updatedLayerFrames,
      };
    });

    setActiveFrameIndex(Math.max(0, index - 1));
  };

  // Color selection & recent palette
  const handleColorChange = (newColor: string) => {
    setToolSettings((prev) => {
      const updatedRecents = [newColor, ...prev.recentColors.filter((c) => c !== newColor)].slice(0, 8);
      return { ...prev, color: newColor, recentColors: updatedRecents };
    });
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-11 sm:h-14 px-2.5 sm:px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-20">
        {/* Left: Home & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onReturnHome}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Return to Home"
          >
            <Home className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={project.name}
            onChange={(e) => {
              const updated = { ...project, name: e.target.value };
              setProject(updated);
              triggerAutosave(updated);
            }}
            className="bg-transparent text-sm font-semibold text-white hover:bg-slate-800/60 focus:bg-slate-800 px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[160px] sm:max-w-[240px] truncate"
          />
        </div>

        {/* Center: Pair Device Status CTA */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPairingOpen(true)}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 ${
              sessionState.hasDisplayDevice
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>
              {sessionState.hasDisplayDevice ? 'Display Connected' : 'Pair Second Screen'}
            </span>
          </button>
        </div>

        {/* Right: Undo/Redo & Export */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setIsExportOpen(true)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Export Animation"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
            className={`p-2 rounded-lg transition-colors ${
              isDiagnosticsOpen ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Diagnostics"
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Desktop Docked Left Toolbar */}
        <aside className="hidden md:flex absolute top-4 left-4 z-20 flex-col items-center gap-1.5 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md p-2 rounded-2xl shadow-2xl max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
          {[
            { id: 'pencil', label: 'Pencil (Fine Sketch)', icon: Pencil },
            { id: 'ink', label: 'Ink Pen (Clean Lines)', icon: PenTool },
            { id: 'brush', label: 'Paint Brush (Painterly)', icon: Paintbrush },
            { id: 'marker', label: 'Highlighter / Marker', icon: Highlighter },
            { id: 'spray', label: 'Airbrush / Spray', icon: Sparkles },
            { id: 'chalk', label: 'Chalk / Charcoal', icon: Flame },
            { id: 'calligraphy', label: 'Calligraphy Chisel', icon: Feather },
            { id: 'soft', label: 'Soft Airbrush / Blur', icon: Circle },
            { id: 'div-1', isDivider: true },
            { id: 'eraser', label: 'Eraser', icon: Eraser },
            { id: 'fill', label: 'Paint Bucket Fill', icon: PaintBucket },
            { id: 'eyedropper', label: 'Color Eyedropper', icon: Pipette },
            { id: 'div-2', isDivider: true },
            { id: 'line', label: 'Line Tool', icon: Minus },
            { id: 'rectangle', label: 'Rectangle', icon: Square },
            { id: 'ellipse', label: 'Circle', icon: Circle },
          ].map((item) => {
            if ('isDivider' in item) {
              return <div key={item.id} className="w-6 h-px bg-slate-800 my-0.5" />;
            }
            const Icon = item.icon;
            const isActive = toolSettings.activeTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setToolSettings({ ...toolSettings, activeTool: item.id as ToolType })}
                className={`p-2.5 rounded-xl transition-all relative group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-slate-100 text-[10px] font-medium rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                  {item.label}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Mobile Compact Tool Selector Pill */}
        <div className="flex md:hidden absolute top-3 left-3 z-20 items-center gap-1.5 bg-slate-900/95 border border-slate-800 backdrop-blur-md p-1.5 pl-2.5 rounded-xl shadow-xl">
          <button
            onClick={() => setIsMobileToolsOpen(true)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-200 active:scale-95 transition-transform"
          >
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow">
              {(() => {
                const tools: Record<string, React.FC<{ className?: string }>> = {
                  pencil: Pencil,
                  ink: PenTool,
                  brush: Paintbrush,
                  marker: Highlighter,
                  spray: Sparkles,
                  chalk: Flame,
                  calligraphy: Feather,
                  soft: Circle,
                  eraser: Eraser,
                  fill: PaintBucket,
                  eyedropper: Pipette,
                  line: Minus,
                  rectangle: Square,
                  ellipse: Circle,
                };
                const ActiveIcon = tools[toolSettings.activeTool] || Pencil;
                return <ActiveIcon className="w-4 h-4" />;
              })()}
            </span>
            <span className="capitalize font-medium text-slate-300">{toolSettings.activeTool}</span>
            <Wrench className="w-3.5 h-3.5 text-indigo-400 ml-0.5" />
          </button>
        </div>

        {/* Floating Tool Customizer (Color, Size, Opacity, Stabilizer) */}
        <aside className="absolute top-3 right-3 md:top-4 md:right-4 z-20 flex items-center gap-2.5 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md px-2.5 py-1.5 md:px-3 md:py-2 rounded-2xl shadow-2xl text-xs">
          {/* Color Palette Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsColorPickerOpen(true)}
              className="flex items-center gap-2 p-1 pr-2 sm:p-1.5 sm:pr-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 transition-all active:scale-95 group"
              title="Open Color Palette & Picker"
            >
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg border border-slate-600 shadow-inner flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ backgroundColor: toolSettings.color }}
              />
              <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
              <span className="hidden lg:inline text-[11px] font-mono text-slate-300 uppercase">{toolSettings.color}</span>
            </button>

            {/* Quick Palette Swatches */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
              {['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'].map((c) => (
                <button
                  key={c}
                  onClick={() => handleColorChange(c)}
                  className={`w-5 h-5 rounded-lg border transition-all ${
                    toolSettings.color.toLowerCase() === c.toLowerCase()
                      ? 'border-white scale-110 z-10 shadow'
                      : 'border-slate-800 hover:border-slate-600 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Size Slider */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Size</span>
            <input
              type="range"
              min={1}
              max={60}
              value={toolSettings.size}
              onChange={(e) => setToolSettings({ ...toolSettings, size: Number(e.target.value) })}
              className="w-12 sm:w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-mono text-slate-300 w-4 text-right">
              {toolSettings.size}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden md:block" />

          {/* Opacity Slider */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">Opacity</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={toolSettings.opacity}
              onChange={(e) => setToolSettings({ ...toolSettings, opacity: Number(e.target.value) })}
              className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-mono text-slate-300 w-7 text-right">
              {Math.round(toolSettings.opacity * 100)}%
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden lg:block" />

          {/* Stabilizer Level */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">Smooth</span>
            <input
              type="range"
              min={0}
              max={10}
              value={toolSettings.stabilizer}
              onChange={(e) => setToolSettings({ ...toolSettings, stabilizer: Number(e.target.value) })}
              className="w-14 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] font-mono text-slate-300 w-3 text-right">
              {toolSettings.stabilizer}
            </span>
          </div>
        </aside>

        {/* Dedicated Interactive Animation Canvas */}
        <div ref={containerRef} className="w-full h-full flex items-center justify-center p-1.5 sm:p-3 landscape:p-1">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full object-contain touch-none cursor-crosshair shadow-2xl rounded-lg"
          />
        </div>
      </div>

      {/* Bottom Timeline */}
      <Timeline
        project={project}
        activeFrameIndex={activeFrameIndex}
        isPlaying={isPlaying}
        onSelectFrame={handleSelectFrame}
        onAddFrame={handleAddFrame}
        onDuplicateFrame={handleDuplicateFrame}
        onDeleteFrame={handleDeleteFrame}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onChangeFps={(newFps) => {
          const updated = {
            ...project,
            settings: { ...project.settings, fps: newFps },
          };
          setProject(updated);
          syncService.sendPlaybackOp({ action: 'setFps', fps: newFps });
          triggerAutosave(updated);
        }}
        onToggleOnionSkin={() => {
          const updated = {
            ...project,
            settings: {
              ...project.settings,
              onionSkin: {
                ...project.settings.onionSkin,
                enabled: !project.settings.onionSkin.enabled,
              },
            },
          };
          setProject(updated);
          triggerAutosave(updated);
        }}
        onOpenOnionSettings={() => setIsOnionSettingsOpen(true)}
        onOpenLayers={() => setIsLayerPanelOpen(true)}
      />

      {/* Layer Management Drawer */}
      <LayerPanel
        isOpen={isLayerPanelOpen}
        onClose={() => setIsLayerPanelOpen(false)}
        project={project}
        activeLayerId={activeLayerId}
        onSelectLayer={(id) => setActiveLayerId(id)}
        onAddLayer={() => {
          pushUndo(project);
          const newLayer = {
            id: 'layer_' + Math.random().toString(36).substring(2, 8),
            name: `Layer ${project.layers.length + 1}`,
            visible: true,
            locked: false,
            opacity: 1,
          };
          commitMutation((prev) => ({
            ...prev,
            layers: [...prev.layers, newLayer],
          }));
          setActiveLayerId(newLayer.id);
        }}
        onToggleVisibility={(id) => {
          commitMutation((prev) => ({
            ...prev,
            layers: prev.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
          }));
        }}
        onToggleLock={(id) => {
          commitMutation((prev) => ({
            ...prev,
            layers: prev.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
          }));
        }}
        onChangeOpacity={(id, opacity) => {
          commitMutation((prev) => ({
            ...prev,
            layers: prev.layers.map((l) => (l.id === id ? { ...l, opacity } : l)),
          }));
        }}
        onReorderLayer={(id, direction) => {
          const index = project.layers.findIndex((l) => l.id === id);
          if (index === -1) return;
          const targetIndex = direction === 'up' ? index + 1 : index - 1;
          if (targetIndex < 0 || targetIndex >= project.layers.length) return;

          pushUndo(project);
          commitMutation((prev) => {
            const updatedLayers = [...prev.layers];
            const [moved] = updatedLayers.splice(index, 1);
            updatedLayers.splice(targetIndex, 0, moved);
            return {
              ...prev,
              layers: updatedLayers,
            };
          });
        }}
        onDeleteLayer={(id) => {
          if (project.layers.length <= 1) return;
          pushUndo(project);

          commitMutation((prev) => ({
            ...prev,
            layers: prev.layers.filter((l) => l.id !== id),
          }));

          if (activeLayerId === id) {
            const remaining = project.layers.filter((l) => l.id !== id);
            if (remaining.length > 0) setActiveLayerId(remaining[0].id);
          }
        }}
      />

      {/* Color Palette Modal */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        currentColor={toolSettings.color}
        onSelectColor={handleColorChange}
        savedPalette={savedPalette}
        onAddSavedColor={handleAddSavedColor}
        onPickFromCanvas={() => {
          setToolSettings((prev) => ({ ...prev, activeTool: 'eyedropper' }));
        }}
      />

      {/* Mobile Tool Selection Modal Drawer */}
      {isMobileToolsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-4 text-slate-100 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Select Drawing Tool</h3>
              </div>
              <button
                onClick={() => setIsMobileToolsOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'pencil', label: 'Pencil', desc: 'Fine Sketching', icon: Pencil },
                { id: 'ink', label: 'Ink Pen', desc: 'Clean Lines', icon: PenTool },
                { id: 'brush', label: 'Paint Brush', desc: 'Painterly Strokes', icon: Paintbrush },
                { id: 'marker', label: 'Highlighter', desc: 'Transparent Tint', icon: Highlighter },
                { id: 'spray', label: 'Airbrush', desc: 'Particle Spray', icon: Sparkles },
                { id: 'chalk', label: 'Chalk', desc: 'Textured Charcoal', icon: Flame },
                { id: 'calligraphy', label: 'Calligraphy', desc: 'Angled Nib', icon: Feather },
                { id: 'soft', label: 'Soft Airbrush', desc: 'Blur Edge', icon: Circle },
                { id: 'eraser', label: 'Eraser', desc: 'Remove Strokes', icon: Eraser },
                { id: 'fill', label: 'Paint Bucket', desc: 'Flood Fill', icon: PaintBucket },
                { id: 'eyedropper', label: 'Eyedropper', desc: 'Pick Color', icon: Pipette },
                { id: 'line', label: 'Line Tool', desc: 'Straight Lines', icon: Minus },
                { id: 'rectangle', label: 'Rectangle', desc: 'Box Shape', icon: Square },
                { id: 'ellipse', label: 'Circle', desc: 'Oval Shape', icon: Circle },
              ].map((tool) => {
                const Icon = tool.icon;
                const isActive = toolSettings.activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setToolSettings({ ...toolSettings, activeTool: tool.id as ToolType });
                      setIsMobileToolsOpen(false);
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all active:scale-95 ${
                      isActive
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className={`p-2 rounded-xl flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-900 text-indigo-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-xs text-white truncate">{tool.label}</div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>{tool.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pairing QR Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        code={sessionState.code}
        role="draw"
        isCreatingSession={sessionState.isCreatingSession}
        sessionError={sessionState.sessionError}
        onRetryCreateSession={() => syncService.createSession(project)}
        hasDisplayDevice={sessionState.hasDisplayDevice}
        onJoinSession={() => {}}
      />

      {/* Export Formats Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />

      {/* Diagnostics Panel */}
      <DiagnosticsPanel
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        sessionState={sessionState}
        frameCount={project.frames.length}
        strokeCount={
          (project.layerFrames[`${activeLayerId}:${project.frames[activeFrameIndex]?.id}`] || []).length
        }
      />
    </div>
  );
};
