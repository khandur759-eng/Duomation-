import React from 'react';
import { SessionState } from '../types/animation';
import { Activity, X } from 'lucide-react';
import { getPublicAppUrl, getSocketUrl } from '../utils/url';

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

  const appUrl = getPublicAppUrl();
  const socketUrl = getSocketUrl();

  return (
    <div className="fixed bottom-16 right-4 z-50 w-84 rounded-[2rem] bg-white/95 border border-slate-200/90 backdrop-blur-2xl p-5 text-xs font-mono text-slate-700 shadow-[0_20px_60px_rgba(15,23,42,0.15)] space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-950 font-sans text-sm">Workstation Diagnostics</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Close diagnostics"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Status:</span>
          <span className={`font-bold ${sessionState.active ? 'text-emerald-600' : 'text-amber-600'}`}>
            {sessionState.statusText}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Device Role:</span>
          <span className="uppercase text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">{sessionState.role}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">App URL:</span>
          <span className="text-slate-700 font-medium truncate max-w-[160px]" title={appUrl}>{appUrl}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Socket URL:</span>
          <span className="text-slate-700 font-medium truncate max-w-[160px]" title={socketUrl}>{socketUrl}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Pairing Code:</span>
          <span className="text-indigo-600 font-bold">{sessionState.code || 'None'}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Sync Ping:</span>
          <span className="text-slate-800 font-bold">{sessionState.pingMs !== undefined ? `${sessionState.pingMs} ms` : 'N/A'}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Display Device:</span>
          <span className={`font-bold ${sessionState.hasDisplayDevice ? 'text-emerald-600' : 'text-slate-400'}`}>
            {sessionState.hasDisplayDevice ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Connected Devices:</span>
          <span className="text-slate-800 font-bold">{sessionState.connectedDevices}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Total Frames:</span>
          <span className="text-slate-800 font-bold">{frameCount}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Active Strokes:</span>
          <span className="text-slate-800 font-bold">{strokeCount}</span>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400 font-medium">Room Session ID:</span>
          <span className="text-slate-500 truncate max-w-[140px]">{sessionState.sessionId || 'None'}</span>
        </div>
      </div>
    </div>
  );
};
