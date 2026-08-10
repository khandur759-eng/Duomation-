import { io, Socket } from 'socket.io-client';
import { Project, Stroke, ActiveStrokeData, DeviceRole, SessionState } from '../types/animation';
import { getSocketUrl } from '../utils/url';

type SyncEventCallback = (event: string, data: any) => void;

const SESSION_STORAGE_KEY = 'duomation_active_session_v2';
const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

interface StoredSessionInfo {
  sessionId: string;
  code: string;
  role: DeviceRole;
  createdAt: number;
}

class SyncService {
  private socket: Socket | null = null;
  private listeners: Set<SyncEventCallback> = new Set();
  private pingInterval: any = null;
  private isCreatingSession = false;

  private state: SessionState = {
    active: false,
    role: 'standalone',
    connectedDevices: 1,
    hasDisplayDevice: false,
    statusText: 'Disconnected',
  };

  public init() {
    if (this.socket) return;

    const socketUrl = getSocketUrl();
    const envName = (import.meta as any).env?.MODE || 'production';

    console.log(`[Duomation Sync] socket URL = ${socketUrl}`);
    console.log(`[Duomation Sync] environment = ${envName}`);
    console.log(`[Duomation Sync] transport = websocket/polling`);

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log(`[Duomation Sync] Connected to Socket.IO server: ${this.socket?.id}`);
      this.updateState({ statusText: 'Connected' });
      this.startPingCheck();

      // Attempt auto-rejoin if previous session is saved and fresh
      const saved = this.getStoredSession();
      if (saved && saved.sessionId && saved.code) {
        this.joinSession(saved.code, saved.role).then((res) => {
          if (res.success) {
            console.log(`[Duomation Sync] Auto-rejoined session: ${saved.code}`);
            this.notifyListeners('rejoined-session', res);
          } else {
            console.log(`[Duomation Sync] Failed to auto-rejoin session ${saved.code}: ${res.error}`);
            this.clearStoredSession();
          }
        });
      }

      this.notifyListeners('connected', null);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[Duomation Sync] Socket disconnected: ${reason}`);
      this.updateState({ statusText: 'Reconnecting...' });
      this.notifyListeners('disconnected', null);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Duomation Sync] Connection error:', err?.message || err);
      this.updateState({ statusText: 'Connection Error (retrying...)' });
      this.notifyListeners('connect_error', err);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      this.updateState({ statusText: `Reconnecting (attempt ${attempt})...` });
    });

    this.socket.on('reconnect_error', (err) => {
      this.updateState({ statusText: 'Reconnection Error' });
    });

    this.socket.on(
      'session-status',
      (data: { connectedDevices: number; hasDisplayDevice: boolean; hasDrawDevice?: boolean; drawConnected?: boolean; displayConnected?: boolean }) => {
        const hasDisplay = Boolean(data.hasDisplayDevice || data.displayConnected);
        const hasDraw = Boolean(data.hasDrawDevice || data.drawConnected);

        let statusText = this.state.statusText;
        if (this.state.role === 'draw') {
          statusText = hasDisplay ? 'Display Connected' : 'Waiting for Display Device...';
        } else if (this.state.role === 'display') {
          statusText = hasDraw ? 'Connected to Drawing Device' : 'Waiting for Drawing Device...';
        }

        this.updateState({
          connectedDevices: data.connectedDevices,
          hasDisplayDevice: hasDisplay,
          statusText,
        });
        this.notifyListeners('session-status', data);
      }
    );

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

    this.socket.on(
      'playback-op',
      (data: { action: 'play' | 'pause' | 'setFps' | 'setFrame'; fps?: number; frameIndex?: number; playing?: boolean; startedAt?: number }) => {
        this.notifyListeners('playback-op', data);
      }
    );

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

  private ensureConnected(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.socket) this.init();
      if (!this.socket) return resolve(false);

      if (this.socket.connected) {
        return resolve(true);
      }

      let done = false;
      const onConnect = () => {
        if (!done) {
          done = true;
          resolve(true);
        }
      };

      this.socket.once('connect', onConnect);

      setTimeout(() => {
        if (!done) {
          done = true;
          this.socket?.off('connect', onConnect);
          resolve(Boolean(this.socket?.connected));
        }
      }, 4000);
    });
  }

  public subscribe(callback: SyncEventCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    this.listeners.forEach((fn) => {
      try {
        fn(event, data);
      } catch (e) {
        console.error('Error in sync listener:', e);
      }
    });
  }

  private updateState(partial: Partial<SessionState>) {
    this.state = { ...this.state, ...partial };
    this.notifyListeners('state-changed', this.state);
  }

  public getState(): SessionState {
    return this.state;
  }

  private setStoredSession(sessionId: string, code: string, role: DeviceRole) {
    try {
      const data: StoredSessionInfo = {
        sessionId,
        code,
        role,
        createdAt: Date.now(),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  private getStoredSession(): StoredSessionInfo | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed: StoredSessionInfo = JSON.parse(raw);
      if (!parsed || !parsed.createdAt) return null;
      if (Date.now() - parsed.createdAt > MAX_SESSION_AGE_MS) {
        this.clearStoredSession();
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  private clearStoredSession() {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem('duomation_active_session');
    } catch (e) {}
  }

  public async createSession(project: Project): Promise<{ success: boolean; sessionId?: string; code?: string; error?: string }> {
    if (this.isCreatingSession && this.state.sessionId && this.state.code) {
      return { success: true, sessionId: this.state.sessionId, code: this.state.code };
    }

    this.isCreatingSession = true;
    try {
      await this.ensureConnected();
      if (!this.socket) {
        this.isCreatingSession = false;
        return { success: false, error: 'Socket not initialized' };
      }

      return await new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.isCreatingSession = false;
            console.warn('createSession timeout reached waiting for socket response.');
            resolve({ success: false, error: 'Session creation timeout' });
          }
        }, 5000);

        this.socket?.emit('create-session', { project }, (res: any) => {
          if (resolved) return;
          resolved = true;
          this.isCreatingSession = false;
          clearTimeout(timer);
          if (res && res.success) {
            this.setStoredSession(res.sessionId, res.code, 'draw');
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
    } catch (e: any) {
      this.isCreatingSession = false;
      return { success: false, error: e?.message || 'Socket error' };
    }
  }

  public async joinSession(codeOrId: string, role: DeviceRole = 'display'): Promise<{ success: boolean; project?: Project; sessionId?: string; code?: string; error?: string }> {
    try {
      await this.ensureConnected();
      if (!this.socket) {
        return { success: false, error: 'Socket not initialized' };
      }

      return await new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: 'Join session timed out. Please check connection and try again.' });
          }
        }, 6000);

        this.socket?.emit('join-session', { sessionKey: codeOrId, role }, (res: any) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          if (res && res.success) {
            this.setStoredSession(res.sessionId, res.code, role);
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
            this.clearStoredSession();
            resolve({ success: false, error: res?.error || 'Invalid session code or room expired.' });
          }
        });
      });
    } catch (e: any) {
      return { success: false, error: e?.message || 'Socket error' };
    }
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

  public sendPlaybackOp(data: { action: 'play' | 'pause' | 'setFps' | 'setFrame'; fps?: number; frameIndex?: number; playing?: boolean; startedAt?: number }) {
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
    if (this.socket && this.state.active) {
      this.socket.emit('leave-session');
    }
    this.clearStoredSession();
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

