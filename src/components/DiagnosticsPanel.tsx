import React from 'react';
import { SessionState } from '../types/animation';
import { Activity, X, Signal, Cpu, Layers } from 'lucide-react';

interface DiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionState: SessionState;
  frameCount: number;
  strokeCount: number;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  isOpen,
  onClose,
  sessionState,
  frameCount,
  strokeCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 w-72 rounded-2xl bg-slate-950/90 border border-slate-800 backdrop-blur-md p-4 text-xs font-mono text-slate-300 shadow-2xl space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
          <Activity className="w-4 h-4" />
          <span>Workstation Diagnostics</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-500">Status:</span>
          <span className={`font-semibold ${sessionState.active ? 'text-emerald-400' : 'text-amber-400'}`}>
            {sessionState.statusText}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Device Role:</span>
          <span className="uppercase text-indigo-400 font-bold">{sessionState.role}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Sync Ping Latency:</span>
          <span className="text-white">{sessionState.pingMs !== undefined ? `${sessionState.pingMs} ms` : 'Local'}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Connected Devices:</span>
          <span className="text-white">{sessionState.connectedDevices}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Total Frames:</span>
          <span className="text-white">{frameCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Active Frame Strokes:</span>
          <span className="text-white">{strokeCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-500">Room Session ID:</span>
          <span className="text-slate-400 truncate max-w-[120px]">{sessionState.sessionId || 'None'}</span>
        </div>
      </div>
    </div>
  );
};
