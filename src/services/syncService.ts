import { io, Socket } from 'socket.io-client';
import { Project, Stroke, ActiveStrokeData, DeviceRole, SessionState } from '../types/animation';

type SyncEventCallback = (event: string, data: any) => void;

class SyncService {
  private socket: Socket | null = null;
  private listeners: Set<SyncEventCallback> = new Set();
  private pingInterval: any = null;

  private state: SessionState = {
    active: false,
    role: 'standalone',
    connectedDevices: 1,
    hasDisplayDevice: false,
    statusText: 'Disconnected',
  };

  public init() {
    if (this.socket) return;

    this.socket = io({
      autoConnect: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.updateState({ statusText: 'Connected' });
      this.startPingCheck();
      this.notifyListeners('connected', null);
    });

    this.socket.on('disconnect', () => {
      this.updateState({ active: false, statusText: 'Reconnecting...' });
      this.notifyListeners('disconnected', null);
    });

    this.socket.on('session-status', (data: { connectedDevices: number; hasDisplayDevice: boolean }) => {
      this.updateState({
        connectedDevices: data.connectedDevices,
        hasDisplayDevice: data.hasDisplayDevice,
      });
      this.notifyListeners('session-status', data);
    });

    this.socket.on('stroke-start', (data: ActiveStrokeData) => {
      this.notifyListeners('stroke-start', data);
    });

    this.socket.on('stroke-points', (data: { strokeId: string; points: any[] }) => {
      this.notifyListeners('stroke-points', data);
    });

    this.socket.on('stroke-end', (data: { stroke: Stroke }) => {
      this.notifyListeners('stroke-end', data);
    });

    this.socket.on('select-frame', (data: { frameIndex: number }) => {
      this.notifyListeners('select-frame', data);
    });

    this.socket.on('playback-op', (data: { action: 'play' | 'pause' | 'setFps' | 'setFrame'; fps?: number; frameIndex?: number }) => {
      this.notifyListeners('playback-op', data);
    });

    this.socket.on('project-update', (data: { project: Project }) => {
      this.notifyListeners('project-update', data);
    });

    this.socket.on('request-sync-snapshot', (data: { requestedBy: string }) => {
      this.notifyListeners('request-sync-snapshot', data);
    });

    this.socket.on('sync-snapshot', (data: { project: Project; activeFrameIndex?: number }) => {
      this.updateState({ lastSyncTime: Date.now() });
      this.notifyListeners('sync-snapshot', data);
    });
  }

  public subscribe(callback: SyncEventCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    this.listeners.forEach((fn) => fn(event, data));
  }

  private updateState(partial: Partial<SessionState>) {
    this.state = { ...this.state, ...partial };
    this.notifyListeners('state-changed', this.state);
  }

  public getState(): SessionState {
    return this.state;
  }

  public createSession(project: Project): Promise<{ success: boolean; sessionId?: string; code?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) this.init();
      this.socket?.emit('create-session', { project }, (res: any) => {
        if (res && res.success) {
          this.updateState({
            active: true,
            sessionId: res.sessionId,
            code: res.code,
            role: 'draw',
            connectedDevices: res.connectedDevices || 1,
            statusText: 'Session Active',
          });
          resolve({ success: true, sessionId: res.sessionId, code: res.code });
        } else {
          resolve({ success: false, error: res?.error || 'Failed to create session.' });
        }
      });
    });
  }

  public joinSession(codeOrId: string, role: DeviceRole = 'display'): Promise<{ success: boolean; project?: Project; sessionId?: string; code?: string; error?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) this.init();
      this.socket?.emit('join-session', { sessionKey: codeOrId, role }, (res: any) => {
        if (res && res.success) {
          this.updateState({
            active: true,
            sessionId: res.sessionId,
            code: res.code,
            role,
            connectedDevices: res.connectedDevices || 2,
            statusText: role === 'display' ? 'Display Mode Active' : 'Drawing Mode Active',
          });
          resolve({
            success: true,
            project: res.project,
            sessionId: res.sessionId,
            code: res.code,
          });
        } else {
          resolve({ success: false, error: res?.error || 'Invalid session code or room expired.' });
        }
      });
    });
  }

  // Realtime Drawing Emitters
  public sendStrokeStart(data: ActiveStrokeData) {
    if (this.state.active) {
      this.socket?.emit('stroke-start', data);
    }
  }

  public sendStrokePoints(strokeId: string, points: any[]) {
    if (this.state.active && points.length > 0) {
      this.socket?.emit('stroke-points', { strokeId, points });
    }
  }

  public sendStrokeEnd(stroke: Stroke) {
    if (this.state.active) {
      this.socket?.emit('stroke-end', { stroke });
    }
  }

  // Frame & Timeline Emitters
  public sendSelectFrame(frameIndex: number) {
    if (this.state.active) {
      this.socket?.emit('select-frame', { frameIndex });
    }
  }

  public sendPlaybackOp(data: { action: 'play' | 'pause' | 'setFps' | 'setFrame'; fps?: number; frameIndex?: number }) {
    if (this.state.active) {
      this.socket?.emit('playback-op', data);
    }
  }

  public sendProjectUpdate(project: Project) {
    if (this.state.active) {
      this.socket?.emit('project-update', { project });
    }
  }

  public sendSyncSnapshot(project: Project, activeFrameIndex: number, targetSocketId?: string) {
    if (this.state.active) {
      this.socket?.emit('sync-snapshot', { project, activeFrameIndex, targetSocketId });
    }
  }

  private startPingCheck() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (!this.socket || !this.socket.connected) return;
      const start = Date.now();
      this.socket.emit('ping-check', start, () => {
        const pingMs = Date.now() - start;
        this.updateState({ pingMs });
      });
    }, 5000);
  }

  public disconnectSession() {
    this.updateState({
      active: false,
      sessionId: undefined,
      code: undefined,
      role: 'standalone',
      statusText: 'Disconnected',
    });
  }
}

export const syncService = new SyncService();
