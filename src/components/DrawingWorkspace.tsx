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
import { drawCursorOverlay, CursorPos } from '../engine/cursor';
import { syncService } from '../services/syncService';
import { saveProject } from '../utils/db';

import { Timeline } from './Timeline';
import { LayerPanel } from './LayerPanel';
import { PairingModal } from './PairingModal';
import { ExportModal } from './ExportModal';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ColorPickerModal } from './ColorPickerModal';
import { OnionSkinModal } from './OnionSkinModal';

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
  ChevronLeft,
  Highlighter,
  Sparkles,
  Feather,
  Pipette,
  Palette,
  Flame,
  X,
  ChevronRight,
  Wrench,
  RotateCw,
  Maximize2,
  Minimize2,
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
  const [isFullScreenCanvas, setIsFullScreenCanvas] = useState<boolean>(false);
  const [isLeftToolsMinimized, setIsLeftToolsMinimized] = useState<boolean>(false);
  const [isBrushAdjustMinimized, setIsBrushAdjustMinimized] = useState<boolean>(false);
  const [isZoomPanelMinimized, setIsZoomPanelMinimized] = useState<boolean>(false);
  const [isTimelineMinimized, setIsTimelineMinimized] = useState<boolean>(false);

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

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // First-time onboarding banner
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('duet_onboarding_dismissed');
    } catch (e) {
      return false;
    }
  });

  const handleDismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('duet_onboarding_dismissed', 'true');
    } catch (e) {}
  };

  // Canvas Rotation (0, 90, 180, 270 degrees)
  const [canvasRotation, setCanvasRotation] = useState<number>(0);

  // Pan & Spacebar State
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const lastPanPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch Gesture tracking for Pinch-to-Zoom & Pan
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  // Autosave Project throttled
  const saveTimeoutRef = useRef<number | null>(null);
  const triggerAutosave = useCallback((updatedProject: Project) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveProject(updatedProject);
      showToast('Project saved');
    }, 1200);
  }, [showToast]);

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

  // Record undo state before modification
  const pushUndo = useCallback((stateToSave: Project) => {
    setUndoStack((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(stateToSave))]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(project))]);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    const nextRev = (project.revision || 1) + 1;
    const restored = { ...previous, revision: nextRev, updatedAt: Date.now() };
    setProject(restored);
    syncService.sendProjectUpdate(restored);
    triggerAutosave(restored);
  }, [undoStack, project, triggerAutosave]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(project))]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    const nextRev = (project.revision || 1) + 1;
    const restored = { ...next, revision: nextRev, updatedAt: Date.now() };
    setProject(restored);
    syncService.sendProjectUpdate(restored);
    triggerAutosave(restored);
  }, [redoStack, project, triggerAutosave]);

  // High-performance real-time drawing refs & input pipeline
  const currentStrokePointsRef = useRef<Point[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const unsentPointsRef = useRef<Point[]>([]);
  const cursorPosRef = useRef<CursorPos>({ x: 0, y: 0, visible: false });
  const rafIdRef = useRef<number | null>(null);
  const lastNetworkSyncTimeRef = useRef<number>(0);

  // Wheel zoom and pan listener on container with focal-point cursor zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        // Zoom towards pointer focal point
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
        setZoom((prevZoom) => {
          const newZoom = Math.min(8, Math.max(0.2, prevZoom * zoomFactor));
          if (canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const offsetX = e.clientX - (rect.left + rect.width / 2);
            const offsetY = e.clientY - (rect.top + rect.height / 2);
            const scaleRatio = newZoom / prevZoom - 1;
            setPan((prevPan) => ({
              x: prevPan.x - offsetX * scaleRatio,
              y: prevPan.y - offsetY * scaleRatio,
            }));
          }
          return newZoom;
        });
      } else {
        // Pan
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
          showToast('Redo');
        } else {
          handleUndo();
          showToast('Undo');
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        showToast('Redo');
        return;
      }

      if (e.key === 'Escape') {
        setIsMobileToolsOpen(false);
        setIsColorPickerOpen(false);
        setIsLayerPanelOpen(false);
        setIsDiagnosticsOpen(false);
        setIsPairingOpen(false);
        setIsExportOpen(false);
        setIsOnionSettingsOpen(false);
        setIsFullScreenCanvas(false);
        return;
      }

      const key = e.key.toLowerCase();

      if ((e.shiftKey || e.altKey) && key === 'f') {
        e.preventDefault();
        setIsFullScreenCanvas((prev) => {
          const next = !prev;
          showToast(next ? 'Entered Full-Screen Canvas Mode' : 'Exited Full-Screen Canvas Mode');
          return next;
        });
        return;
      }
      const toolMap: Record<string, { tool: ToolType; label: string }> = {
        b: { tool: 'brush', label: 'Paint Brush' },
        p: { tool: 'pencil', label: 'Pencil' },
        e: { tool: 'eraser', label: 'Eraser' },
        i: { tool: 'eyedropper', label: 'Eyedropper' },
        f: { tool: 'fill', label: 'Paint Bucket Fill' },
        m: { tool: 'marker', label: 'Highlighter' },
        s: { tool: 'spray', label: 'Airbrush' },
        l: { tool: 'line', label: 'Line Tool' },
        r: { tool: 'rectangle', label: 'Rectangle' },
        c: { tool: 'ellipse', label: 'Circle' },
      };

      if ((e.shiftKey || e.altKey) && key === 'r') {
        e.preventDefault();
        setCanvasRotation((prev) => {
          const next = (prev + 90) % 360;
          showToast(next === 0 ? 'Canvas Orientation: Standard' : `Canvas Rotated: ${next}°`);
          return next;
        });
        return;
      }

      if (toolMap[key]) {
        e.preventDefault();
        setToolSettings((prev) => ({ ...prev, activeTool: toolMap[key].tool }));
        showToast(`${toolMap[key].label} Tool Selected`);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, showToast]);

  // Convert client pixel position into normalized [0..1] canvas point considering Pan, Zoom, and Rotation
  const getNormalizedPoint = useCallback((clientX: number, clientY: number, pressureVal: number = 0.5): Point => {
    if (!canvasRef.current) return { x: 0, y: 0, pressure: pressureVal };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Center of visual bounding box on screen
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Vector from center to pointer in client pixels
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    // Rotate (dx, dy) back by -canvasRotation
    const rad = (-canvasRotation * Math.PI) / 180;
    const localDx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localDy = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Unrotated display dimensions in CSS pixels
    const dpr = window.devicePixelRatio || 1;
    const unrotatedWidth = canvas.width / dpr;
    const unrotatedHeight = canvas.height / dpr;

    // Raw normalized point on unrotated canvas before pan & zoom
    const rawX = localDx / unrotatedWidth + 0.5;
    const rawY = localDy / unrotatedHeight + 0.5;

    // Apply Pan and Zoom reversal
    const normX = (rawX - 0.5 - pan.x / unrotatedWidth) / zoom + 0.5;
    const normY = (rawY - 0.5 - pan.y / unrotatedHeight) / zoom + 0.5;

    return {
      x: Math.max(0, Math.min(1, normX)),
      y: Math.max(0, Math.min(1, normY)),
      pressure: pressureVal,
    };
  }, [zoom, pan, canvasRotation]);

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

  // Synchronize canvas rendering with live cursor overlay
  const renderPass = useCallback(() => {
    if (!canvasRef.current) return;

    const drawingActive = isDrawingRef.current || isDrawing;
    const activePoints = isDrawingRef.current ? currentStrokePointsRef.current : currentStrokePoints;

    const activeStroke: Stroke | null =
      drawingActive && activePoints.length > 0
        ? {
            id: currentStrokeIdRef.current || 'active',
            tool: toolSettings.activeTool,
            color: toolSettings.color,
            size: toolSettings.size,
            opacity: toolSettings.opacity,
            points: activePoints,
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

    // Draw live brush/tool cursor overlay
    const ctx = canvasRef.current.getContext('2d');
    if (ctx && cursorPosRef.current.visible) {
      drawCursorOverlay(ctx, cursorPosRef.current, toolSettings, zoom, canvasRef.current, canvasRotation);
    }
  }, [
    project,
    activeFrameIndex,
    activeLayerId,
    isDrawing,
    currentStrokePoints,
    toolSettings,
    zoom,
    pan,
    canvasRotation,
  ]);

  // Handle Resize and DPR
  const updateCanvasBounds = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const targetAspect = (project.settings?.width || 1920) / (project.settings?.height || 1080);
    const isRotated90 = canvasRotation === 90 || canvasRotation === 270;
    const effTargetAspect = isRotated90 ? 1 / targetAspect : targetAspect;
    const containerAspect = rect.width / rect.height;

    let visualWidth = rect.width;
    let visualHeight = rect.height;

    if (containerAspect > effTargetAspect) {
      visualHeight = rect.height;
      visualWidth = rect.height * effTargetAspect;
    } else {
      visualWidth = rect.width;
      visualHeight = rect.width / effTargetAspect;
    }

    const displayWidth = isRotated90 ? visualHeight : visualWidth;
    const displayHeight = isRotated90 ? visualWidth : visualHeight;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    renderPass();
  }, [project.settings?.width, project.settings?.height, canvasRotation, renderPass]);

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

  // Start continuous rAF drawing loop for 120Hz smooth local rendering
  const startDrawingLoop = useCallback(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    const loop = () => {
      // Flush unsent stroke points to socket.io network at ~80Hz
      if (unsentPointsRef.current.length > 0 && currentStrokeIdRef.current) {
        const now = Date.now();
        if (now - lastNetworkSyncTimeRef.current >= 12) {
          const batch = [...unsentPointsRef.current];
          unsentPointsRef.current = [];
          syncService.sendStrokePoints(currentStrokeIdRef.current, batch);
          lastNetworkSyncTimeRef.current = now;
        }
      }

      renderPass();

      if (isDrawingRef.current) {
        rafIdRef.current = requestAnimationFrame(loop);
      }
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [renderPass]);

  // Pointer & Touch Handlers with Zero-Latency Ref Drawing, Coalesced Events, Zoom & Pan
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying) setIsPlaying(false);
    if (!canvasRef.current) return;

    cursorPosRef.current = { x: e.clientX, y: e.clientY, visible: true };

    // Track active pointer for pinch-zoom
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle spacebar pan or middle mouse button pan
    if (isSpacePressed || e.button === 1) {
      isPanningRef.current = true;
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      canvasRef.current.setPointerCapture(e.pointerId);
      return;
    }

    // Two-finger pinch gesture detected
    if (activePointersRef.current.size >= 2) {
      isDrawingRef.current = false;
      setIsDrawing(false);
      currentStrokePointsRef.current = [];
      setCurrentStrokePoints([]);
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchDistRef.current = dist;
      initialZoomRef.current = zoom;
      return;
    }

    // Verify active layer is unlocked and visible
    const currentLayer = project.layers.find((l) => l.id === activeLayerId);
    if (currentLayer && (currentLayer.locked || !currentLayer.visible)) return;

    canvasRef.current.setPointerCapture(e.pointerId);

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    const initialPoint = getNormalizedPoint(e.clientX, e.clientY, pressure);

    // Eyedropper tool execution
    if (toolSettings.activeTool === 'eyedropper') {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        const rect = canvas.getBoundingClientRect();
        const px = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
        const py = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
        try {
          const pixelData = ctx.getImageData(px, py, 1, 1).data;
          if (pixelData[3] > 0) {
            const hex = `#${((1 << 24) + (pixelData[0] << 16) + (pixelData[1] << 8) + pixelData[2]).toString(16).slice(1)}`;
            handleColorChange(hex);
            showToast(`Color sampled: ${hex.toUpperCase()}`);
          }
        } catch (err) {}
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

    const strokeId = 'st_' + Math.random().toString(36).substring(2, 9);
    currentStrokeIdRef.current = strokeId;
    currentStrokePointsRef.current = [initialPoint];
    unsentPointsRef.current = [initialPoint];
    isDrawingRef.current = true;
    setIsDrawing(true);

    // Start drawing loop
    startDrawingLoop();

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
    cursorPosRef.current = { x: e.clientX, y: e.clientY, visible: true };

    // Update active pointer position
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle spacebar / middle-mouse panning
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPosRef.current.x;
      const dy = e.clientY - lastPanPosRef.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      renderPass();
      return;
    }

    // Two-finger pinch zoom
    if (activePointersRef.current.size >= 2 && initialPinchDistRef.current) {
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = currentDist / initialPinchDistRef.current;
      const newZoom = Math.min(8, Math.max(0.2, initialZoomRef.current * scale));
      setZoom(newZoom);
      renderPass();
      return;
    }

    if (!isDrawingRef.current || !canvasRef.current) {
      renderPass();
      return;
    }

    // Extract sub-frame coalesced pointer events if supported
    const nativeEvt = e.nativeEvent as any;
    const coalescedEvents: PointerEvent[] =
      nativeEvt && typeof nativeEvt.getCoalescedEvents === 'function'
        ? nativeEvt.getCoalescedEvents()
        : [nativeEvt || e];

    for (const cev of coalescedEvents) {
      const pressure = cev.pressure && cev.pressure > 0 ? cev.pressure : 0.5;
      const rawPoint = getNormalizedPoint(cev.clientX, cev.clientY, pressure);
      const smoothedPoint = stabilizePoint(
        rawPoint,
        currentStrokePointsRef.current,
        toolSettings.stabilizer
      );
      currentStrokePointsRef.current.push(smoothedPoint);
      unsentPointsRef.current.push(smoothedPoint);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY, visible: false };
    activePointersRef.current.delete(e.pointerId);

    if (isPanningRef.current) {
      isPanningRef.current = false;
    }

    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }

    if (!isDrawingRef.current) {
      renderPass();
      return;
    }

    if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }

    isDrawingRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Flush remaining unsent points to socket
    if (unsentPointsRef.current.length > 0 && currentStrokeIdRef.current) {
      syncService.sendStrokePoints(currentStrokeIdRef.current, unsentPointsRef.current);
      unsentPointsRef.current = [];
    }

    const points = currentStrokePointsRef.current;
    if (points.length > 0) {
      // Simplify completed stroke or lock shape points
      let finalPoints: Point[] = [];
      if (
        toolSettings.activeTool === 'line' ||
        toolSettings.activeTool === 'rectangle' ||
        toolSettings.activeTool === 'ellipse'
      ) {
        finalPoints = [
          points[0],
          points[points.length - 1],
        ];
      } else {
        finalPoints = simplifyPoints(points, 0.0003);
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

      // Sync stroke end event
      syncService.sendStrokeEnd(newStroke);
    }

    currentStrokePointsRef.current = [];
    currentStrokeIdRef.current = null;
    setIsDrawing(false);
    setCurrentStrokePoints([]);
    renderPass();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY, visible: true };
    renderPass();
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cursorPosRef.current = { x: e.clientX, y: e.clientY, visible: false };
    if (!isDrawingRef.current) {
      renderPass();
    }
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
   <div className="relative w-screen h-screen bg-[#f6f7fb] text-slate-950 flex flex-col justify-between overflow-hidden select-none pl-safe pr-safe pt-safe pb-safe">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-2xl border border-indigo-400/30 animate-in fade-in zoom-in duration-200 flex items-center gap-2">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Onboarding Tip Banner */}
      {showOnboarding && (
        <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950/90 border-b border-indigo-500/30 px-3 py-1.5 text-xs text-indigo-200 flex items-center justify-between z-30">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="truncate">
              <strong>Tip:</strong> Draw here, or click <strong>Pair Second Screen</strong> to stream your live animation canvas to another device!
            </span>
          </div>
          <button
            onClick={handleDismissOnboarding}
            className="p-1 text-slate-400 hover:text-white rounded ml-2 flex-shrink-0"
            title="Dismiss tip"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      {!isFullScreenCanvas && (
       <header className="h-12 sm:h-14 px-3 sm:px-6 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between z-20 gap-4 shadow-sm">
          {/* Left: Home Icon + QR Code / Pair Screen Tool right next to it */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onReturnHome}
              className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex-shrink-0"
              title="Return to Home"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* QR Code / Pair Screen Tool next to Home */}
            <button
              onClick={() => setIsPairingOpen(true)}
              className={`flex items-center gap-2 py-1.5 px-3 sm:px-3.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                sessionState.hasDisplayDevice
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
              }`}
              title="Pair Screen / QR Code"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">
                {sessionState.hasDisplayDevice ? 'Display Live' : 'Pair Screen'}
              </span>
              <span className="sm:hidden font-medium">
                {sessionState.hasDisplayDevice ? 'Live' : 'Pair'}
              </span>
            </button>
          </div>

          {/* Right: Undo/Redo, Export, Canvas Rotation, Fullscreen & Diagnostics */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Undo / Redo Group */}
           <div className="flex items-center bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl p-0.5 shadow-sm">
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800 mx-0.5 sm:mx-1" />

            <button
              onClick={() => setIsExportOpen(true)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center gap-1.5 text-xs font-medium shadow-sm"
              title="Export Animation"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
            </button>

            <button
              onClick={() => {
                const nextRot = (canvasRotation + 90) % 360;
                setCanvasRotation(nextRot);
                showToast(nextRot === 0 ? 'Canvas Orientation: Standard' : `Canvas Rotated: ${nextRot}°`);
              }}
              className={`p-2 rounded-xl transition-colors flex items-center gap-1 ${
                canvasRotation !== 0
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 shadow-sm'
              }`}
              title="Rotate Canvas Orientation (Shift+R)"
            >
              <RotateCw className="w-4 h-4" />
              {canvasRotation !== 0 && (
                <span className="text-[10px] font-mono font-bold">{canvasRotation}°</span>
              )}
            </button>

            <button
              onClick={() => {
                setIsFullScreenCanvas(true);
                showToast('Full-Screen Canvas Active');
              }}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm"
              title="Full-Screen Canvas Mode (Shift+F)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
              className={`p-2 rounded-xl transition-colors ${
                isDiagnosticsOpen ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Diagnostics"
            >
              <Activity className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Main Workspace Area */}
      <div className="relative flex-1 w-full bg-[#f6f7fb] flex items-center justify-center overflow-hidden">
        {/* Floating Discreet Exit Fullscreen Button */}
        {isFullScreenCanvas && (
          <button
            onClick={() => {
              setIsFullScreenCanvas(false);
              showToast('Exited Full-Screen Canvas Mode');
            }}
            className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/60 shadow-2xl backdrop-blur-md opacity-40 hover:opacity-100 transition-all text-xs font-semibold group cursor-pointer"
            title="Exit Full-Screen Canvas (Esc or Shift+F)"
          >
            <Minimize2 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline font-medium">Exit Fullscreen</span>
          </button>
        )}

        {/* Desktop Docked Left Toolbar */}
        {!isFullScreenCanvas && (
          isLeftToolsMinimized ? (
            <aside className="hidden md:flex absolute top-4 left-3 z-20 flex-col items-center gap-2 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl w-10">
              <button
                onClick={() => setIsLeftToolsMinimized(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all group"
                title="Expand Tools Panel"
              >
                <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
              
              <div className="w-5 h-px bg-slate-800 my-0.5" />

              {/* Active Tool Icon */}
              {(() => {
                const toolsMap: Record<string, React.FC<{ className?: string }>> = {
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
                const ActiveIcon = toolsMap[toolSettings.activeTool] || Pencil;
                return (
                  <div
                    className="p-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    title={`Active Tool: ${toolSettings.activeTool}`}
                  >
                    <ActiveIcon className="w-4 h-4" />
                  </div>
                );
              })()}

              {/* Vertical Quick Tools */}
              <div className="flex flex-col items-center gap-1.5 pt-1">
                {[
                  { id: 'pencil', icon: Pencil, label: 'Pencil' },
                  { id: 'brush', icon: Paintbrush, label: 'Brush' },
                  { id: 'eraser', icon: Eraser, label: 'Eraser' },
                  { id: 'fill', icon: PaintBucket, label: 'Fill Bucket' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = toolSettings.activeTool === item.id;
                  if (isActive) return null;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setToolSettings({ ...toolSettings, activeTool: item.id as ToolType })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title={item.label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : (
            <aside className="hidden md:flex absolute top-4 left-4 z-20 flex-col items-center gap-1.5 bg-white/90
border-slate-200/80
shadow-xl
max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
              <div className="w-full flex items-center justify-between pb-1 border-b border-slate-200/80 mb-0.5 px-0.5">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">Tools</span>
                <button
                  onClick={() => setIsLeftToolsMinimized(true)}
                  className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Minimize Tools Panel"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
              {[
                { id: 'pencil', label: 'Pencil (Fine Sketch - Key: P)', icon: Pencil },
                { id: 'ink', label: 'Ink Pen (Clean Lines)', icon: PenTool },
                { id: 'brush', label: 'Paint Brush (Painterly - Key: B)', icon: Paintbrush },
                { id: 'marker', label: 'Highlighter / Marker (Key: M)', icon: Highlighter },
                { id: 'spray', label: 'Airbrush / Spray (Key: S)', icon: Sparkles },
                { id: 'chalk', label: 'Chalk / Charcoal', icon: Flame },
                { id: 'calligraphy', label: 'Calligraphy Chisel', icon: Feather },
                { id: 'soft', label: 'Soft Airbrush / Blur', icon: Circle },
                { id: 'div-1', isDivider: true },
                { id: 'eraser', label: 'Eraser (Key: E)', icon: Eraser },
                { id: 'fill', label: 'Paint Bucket Fill (Key: F)', icon: PaintBucket },
                { id: 'eyedropper', label: 'Color Eyedropper (Key: I)', icon: Pipette },
                { id: 'div-2', isDivider: true },
                { id: 'line', label: 'Line Tool (Key: L)', icon: Minus },
                { id: 'rectangle', label: 'Rectangle (Key: R)', icon: Square },
                { id: 'ellipse', label: 'Circle (Key: C)', icon: Circle },
              ].map((item) => {
                if ('isDivider' in item) {
                  return <div key={item.id} className="w-6 h-px bg-slate-200 my-0.5" />;
                }
                const Icon = item.icon;
                const isActive = toolSettings.activeTool === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setToolSettings({ ...toolSettings, activeTool: item.id as ToolType });
                      showToast(`${item.label.split(' ')[0]} selected`);
                    }}
                    className={`p-2.5 rounded-xl transition-all relative group ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                        : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="absolute left-full ml-3 px-2 py-1 bg-slate-950 text-white text-[10px] font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </aside>
          )
        )}

        {/* Mobile Compact Tool Selector Pill */}
        {!isFullScreenCanvas && (
         <div className="flex md:hidden absolute top-2 left-2 sm:top-3 sm:left-3 z-20 flex-col items-center gap-1.5 bg-white/95 border border-slate-200 backdrop-blur-md p-1.5 rounded-2xl shadow-xl">
            <button
              onClick={() => setIsMobileToolsOpen(true)}
              className="p-2 rounded-xl bg-indigo-600 text-white shadow active:scale-95 transition-transform"
              title="Change Tool"
            >
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
            </button>
          </div>
        )}

        {/* Floating Contextual Tool Customizer (Color, Size 0-200, Opacity, Stabilizer) */}
        {!isFullScreenCanvas && (
          isBrushAdjustMinimized ? (
            <button
              onClick={() => setIsBrushAdjustMinimized(false)}
              className="absolute top-3 right-3 z-20 p-2.5 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl text-indigo-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer active:scale-95 group"
              title="Expand Brush Adjustment Controls"
            >
              <Sliders className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          ) : (
          <aside className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 z-20 flex items-center gap-2 bg-white/90 border border-slate-200/80 backdrop-blur-md px-2 py-1 md:px-3 md:py-2 rounded-2xl shadow-xl text-xs">
              {/* Color Palette Button */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsColorPickerOpen(true)}
                  className="flex items-center gap-1.5 p-1 pr-1.5 sm:p-1.5 sm:pr-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 transition-all active:scale-95 group"
                  title="Open Color Palette & Picker"
                >
                  <div
                    className="w-4 h-4 sm:w-6 sm:h-6 rounded-lg border border-slate-600 shadow-inner flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ backgroundColor: toolSettings.color }}
                  />
                  <Palette className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  <span className="hidden lg:inline text-[11px] font-mono text-slate-300 uppercase">{toolSettings.color}</span>
                </button>

                {/* Quick Palette Swatches */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                  {['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'].map((c) => (
                    <button
                      key={c}
                      onClick={() => handleColorChange(c)}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-lg border transition-all ${
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

              {toolSettings.activeTool !== 'eyedropper' && <div className="h-4 w-px bg-slate-800" />}

              {/* Size Slider (0 to 200) */}
              {toolSettings.activeTool !== 'eyedropper' && toolSettings.activeTool !== 'fill' && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">Size</span>
                  <input
                    type="range"
                    min={1}
                    max={200}
                    value={toolSettings.size}
                    onChange={(e) => setToolSettings({ ...toolSettings, size: Number(e.target.value) })}
                    className="w-12 sm:w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] font-mono text-slate-300 w-5 sm:w-7 text-right">
                    {toolSettings.size}
                  </span>
                </div>
              )}

              {/* Opacity Slider */}
              {toolSettings.activeTool !== 'eyedropper' && (
                <>
                  <div className="h-4 w-px bg-slate-800 hidden md:block" />
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400">Opacity</span>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={toolSettings.opacity}
                      onChange={(e) => setToolSettings({ ...toolSettings, opacity: Number(e.target.value) })}
                      className="w-14 sm:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] font-mono text-slate-300 w-7 text-right">
                      {Math.round(toolSettings.opacity * 100)}%
                    </span>
                  </div>
                </>
              )}

              {/* Stabilizer Level */}
              {toolSettings.activeTool !== 'eyedropper' && toolSettings.activeTool !== 'fill' && (
                <>
                  <div className="h-4 w-px bg-slate-800 hidden lg:block" />
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
                </>
              )}

              {/* Eyedropper hint */}
              {toolSettings.activeTool === 'eyedropper' && (
                <span className="text-[11px] font-medium text-indigo-300 px-1">
                  Tap canvas to sample color
                </span>
              )}

              <button
                onClick={() => setIsBrushAdjustMinimized(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
                title="Minimize Brush Adjustments"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </aside>
          )
        )}

        {/* Zoom & Pan Overlay Controls */}
        {!isFullScreenCanvas && (
          isZoomPanelMinimized ? (
            <aside className="absolute bottom-4 left-3 z-20 flex flex-col items-center gap-1.5 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl w-10">
              <button
                onClick={() => setIsZoomPanelMinimized(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Expand View Adjustments"
              >
                <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              </button>
              <span className="font-mono text-[9px] font-bold text-slate-300">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => {
                  const nextRot = (canvasRotation + 90) % 360;
                  setCanvasRotation(nextRot);
                  showToast(nextRot === 0 ? 'Canvas: Standard' : `Rotated: ${nextRot}°`);
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Rotate Canvas"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </aside>
          ) : (
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-slate-900/90 border border-slate-800/90 backdrop-blur-md px-2 py-1 rounded-xl shadow-xl text-xs">
              <button
                onClick={() => setZoom((prev) => Math.max(0.5, prev * 0.85))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-slate-300 w-12 text-center font-semibold">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((prev) => Math.min(5, prev * 1.15))}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Zoom In"
              >
                <ChevronDown className="w-3.5 h-3.5 rotate-180" />
              </button>

              <div className="h-3.5 w-px bg-slate-800 mx-0.5" />

              {/* Rotate Canvas Button */}
              <button
                onClick={() => {
                  const nextRot = (canvasRotation + 90) % 360;
                  setCanvasRotation(nextRot);
                  showToast(nextRot === 0 ? 'Canvas Orientation: Standard' : `Canvas Rotated: ${nextRot}°`);
                }}
                className={`p-1 rounded transition-colors flex items-center gap-1 ${
                  canvasRotation !== 0
                    ? 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Rotate Canvas Orientation (Shift+R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {canvasRotation !== 0 && (
                  <span className="text-[10px] font-mono font-bold">{canvasRotation}°</span>
                )}
              </button>

              <button
                onClick={() => {
                  setIsFullScreenCanvas(true);
                  showToast('Full-Screen Canvas Active');
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Full-Screen Canvas Mode (Shift+F)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {(zoom !== 1 || pan.x !== 0 || pan.y !== 0 || canvasRotation !== 0) && (
                <button
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                    setCanvasRotation(0);
                    showToast('View Reset');
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white text-[10px] font-semibold transition-colors"
                  title="Reset Zoom, Pan, and Canvas Rotation"
                >
                  Reset
                </button>
              )}

              <button
                onClick={() => setIsZoomPanelMinimized(true)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors ml-0.5"
                title="Minimize View Adjustments"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        )}

        {/* Dedicated Interactive Animation Canvas */}
        <div ref={containerRef} className="w-full h-full flex items-center justify-center p-1 sm:p-2.5 landscape:p-0.5 overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            style={{ transform: `rotate(${canvasRotation}deg)` }}
            className="object-contain touch-none cursor-crosshair shadow-2xl rounded-lg transition-transform duration-300 ease-out"
          />
        </div>
      </div>


      {/* Bottom Timeline */}
      {!isFullScreenCanvas && (
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
          onChangeOnionSkinSettings={(partialSettings) => {
            const updated = {
              ...project,
              settings: {
                ...project.settings,
                onionSkin: {
                  ...project.settings.onionSkin,
                  ...partialSettings,
                  enabled: true, // Auto-enable when adjusting frame count
                },
              },
            };
            setProject(updated);
            triggerAutosave(updated);
          }}
          onOpenOnionSettings={() => setIsOnionSettingsOpen(true)}
          onOpenLayers={() => setIsLayerPanelOpen(true)}
          isMinimized={isTimelineMinimized}
          onToggleMinimize={() => setIsTimelineMinimized(!isTimelineMinimized)}
        />
      )}

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
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-4 text-slate-950 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
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
                        :
 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200'
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

            {/* Mobile Tool Size Adjustment (1 to 200) */}
            {toolSettings.activeTool !== 'eyedropper' && toolSettings.activeTool !== 'fill' && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Stroke Size</span>
                  <span className="font-mono text-indigo-400 font-bold">{toolSettings.size}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={toolSettings.size}
                  onChange={(e) => setToolSettings({ ...toolSettings, size: Number(e.target.value) })}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            )}
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

      {/* Onion Skin Settings Modal */}
      <OnionSkinModal
        isOpen={isOnionSettingsOpen}
        onClose={() => setIsOnionSettingsOpen(false)}
        settings={project.settings.onionSkin}
        onChangeSettings={(newSettings) => {
          const updated = {
            ...project,
            settings: {
              ...project.settings,
              onionSkin: newSettings,
            },
          };
          setProject(updated);
          triggerAutosave(updated);
        }}
      />
    </div>
  );
};
