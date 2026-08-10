import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Project, Stroke, ActiveStrokeData, SessionState } from '../types/animation';
import { renderCanvasFrame } from '../engine/renderer';
import { syncService } from '../services/syncService';
import { Maximize2, Minimize2, Smartphone, Signal, RefreshCw } from 'lucide-react';

interface DisplayWorkspaceProps {
  project: Project;
  activeFrameIndex: number;
  sessionState: SessionState;
  onLeaveDisplayMode: () => void;
}

export const DisplayWorkspace: React.FC<DisplayWorkspaceProps> = ({
  project: initialProject,
  activeFrameIndex: initialFrameIndex,
  sessionState,
  onLeaveDisplayMode,
}) => {
  const [project, setProject] = useState<Project>(initialProject);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(initialFrameIndex);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayTimerRef = useRef<number | null>(null);

  // Auto fade status overlay after 3 seconds
  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = window.setTimeout(() => {
      setShowOverlay(false);
    }, 3500);
  }, []);

  useEffect(() => {
    resetOverlayTimer();
  }, [resetOverlayTimer]);

  // Subscribe to real-time events from Device A
  useEffect(() => {
    const unsubscribe = syncService.subscribe((event, data) => {
      if (event === 'stroke-start') {
        const activeData: ActiveStrokeData = data;
        setActiveStroke({
          id: activeData.strokeId,
          tool: activeData.tool,
          color: activeData.color,
          size: activeData.size,
          opacity: activeData.opacity,
          points: activeData.points,
          layerId: activeData.layerId,
          frameId: activeData.frameId,
          timestamp: Date.now(),
        });
      } else if (event === 'stroke-points') {
        const { points } = data;
        setActiveStroke((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            points: [...prev.points, ...points],
          };
        });
      } else if (event === 'stroke-end') {
        const { stroke } = data;
        setActiveStroke(null);
        setProject((prev) => {
          const key = `${stroke.layerId}:${stroke.frameId}`;
          const existing = prev.layerFrames[key] || [];
          return {
            ...prev,
            layerFrames: {
              ...prev.layerFrames,
              [key]: [...existing, stroke],
            },
          };
        });
      } else if (event === 'select-frame') {
        setActiveFrameIndex(data.frameIndex);
      } else if (event === 'project-update' || event === 'sync-snapshot') {
        if (data.project) setProject(data.project);
        if (data.activeFrameIndex !== undefined) setActiveFrameIndex(data.activeFrameIndex);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Canvas size and DPR recalculation
  const updateCanvasSize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    renderPass();
  }, [project, activeFrameIndex, activeStroke]);

  const renderPass = useCallback(() => {
    if (!canvasRef.current) return;
    renderCanvasFrame({
      canvas: canvasRef.current,
      project,
      activeFrameIndex,
      activeStroke,
      showOnionSkin: project.settings.onionSkin.enabled,
    });
  }, [project, activeFrameIndex, activeStroke]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [updateCanvasSize]);

  useEffect(() => {
    renderPass();
  }, [renderPass]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={resetOverlayTimer}
      onMouseMove={resetOverlayTimer}
      className="relative w-screen h-screen bg-slate-950 overflow-hidden select-none cursor-default flex items-center justify-center"
    >
      <canvas ref={canvasRef} className="w-full h-full object-contain" />

      {/* Auto-fading Display Status Overlay */}
      <div
        className={`absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none transition-opacity duration-500 ${
          showOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3.5 py-2 rounded-xl text-slate-200 text-xs shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
            <Smartphone className="w-4 h-4" />
            <span>DISPLAY MONITOR</span>
          </div>

          <div className="h-3 w-px bg-slate-700" />

          <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium">
            <Signal className="w-3.5 h-3.5 animate-pulse" />
            <span>{sessionState.statusText}</span>
          </div>

          {sessionState.code && (
            <span className="font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              Code: {sessionState.code}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white backdrop-blur-md shadow-xl transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onLeaveDisplayMode}
            className="py-2 px-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-rose-400 text-xs font-medium backdrop-blur-md shadow-xl transition-all"
          >
            Exit Display
          </button>
        </div>
      </div>
    </div>
  );
};
