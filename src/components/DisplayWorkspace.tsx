import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Project, Stroke, ActiveStrokeData, SessionState } from '../types/animation';
import { renderCanvasFrame } from '../engine/renderer';
import { syncService } from '../services/syncService';
import { Maximize2, Minimize2, Smartphone, Signal, ArrowLeft } from 'lucide-react';

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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const revisionRef = useRef<number>(initialProject.revision || 1);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);

  // Auto fade status overlay after 3.5 seconds
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

  // Handle Playback Op Sync
  useEffect(() => {
    if (!isPlaying) {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      return;
    }

    const intervalMs = 1000 / (project.settings.fps || 12);
    playbackTimerRef.current = window.setInterval(() => {
      setActiveFrameIndex((prev) => (prev + 1) % Math.max(1, project.frames.length));
    }, intervalMs);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, project.settings.fps, project.frames.length]);

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
        const { stroke }: { stroke: Stroke } = data;
        setActiveStroke(null);
        setProject((prev) => {
          const key = `${stroke.layerId}:${stroke.frameId}`;
          const existing = prev.layerFrames[key] || [];
          // Idempotent check: avoid adding duplicate stroke ID
          if (existing.some((s) => s.id === stroke.id)) {
            return prev;
          }
          return {
            ...prev,
            updatedAt: Date.now(),
            layerFrames: {
              ...prev.layerFrames,
              [key]: [...existing, stroke],
            },
          };
        });
      } else if (event === 'select-frame') {
        if (data.frameIndex !== undefined) {
          setActiveFrameIndex(data.frameIndex);
        }
      } else if (event === 'playback-op') {
        if (data.action === 'play') {
          setIsPlaying(true);
        } else if (data.action === 'pause') {
          setIsPlaying(false);
        } else if (data.action === 'setFrame' && data.frameIndex !== undefined) {
          setActiveFrameIndex(data.frameIndex);
        } else if (data.action === 'setFps' && data.fps) {
          setProject((prev) => ({
            ...prev,
            settings: { ...prev.settings, fps: data.fps },
          }));
        }
      } else if (event === 'project-update' || event === 'sync-snapshot') {
        if (data.project) {
          const incomingRev = data.project.revision || 1;
          if (incomingRev >= revisionRef.current) {
            revisionRef.current = incomingRev;
            setProject(data.project);
            setActiveStroke(null); // Clear active prediction on snapshot
          }
        }
        if (data.activeFrameIndex !== undefined) {
          setActiveFrameIndex(data.activeFrameIndex);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Canvas size and DPR recalculation
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

  const updateCanvasSize = useCallback(() => {
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
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', updateCanvasSize);

    let ro: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateCanvasSize();
      });
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('orientationchange', updateCanvasSize);
      if (ro) ro.disconnect();
    };
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

  const handleExit = () => {
    syncService.disconnectSession();
    onLeaveDisplayMode();
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
        <div className="flex items-center gap-3 bg-white/95 border border-slate-200/90 backdrop-blur-2xl px-4 py-2.5 rounded-2xl text-slate-800 text-xs shadow-[0_15px_40px_rgba(15,23,42,0.12)] pointer-events-auto">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-600">
            <Smartphone className="w-4 h-4" />
            <span>Display Monitor</span>
          </div>

          <div className="h-3 w-px bg-slate-200" />

          <div className="flex items-center gap-1.5 text-emerald-600 font-mono font-bold">
            <Signal className="w-3.5 h-3.5 animate-pulse" />
            <span>{sessionState.statusText}</span>
          </div>

          {sessionState.code && (
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
              Code: {sessionState.code}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-2xl bg-white/95 border border-slate-200/90 text-slate-600 hover:text-indigo-600 hover:bg-white backdrop-blur-2xl shadow-lg transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-2xl bg-white/95 border border-slate-200/90 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-bold backdrop-blur-2xl shadow-lg transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Display</span>
          </button>
        </div>
      </div>
    </div>
  );
};

