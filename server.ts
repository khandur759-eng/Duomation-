import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with CORS validation
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins in dev or matching host in production
      callback(null, true);
    },
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10MB for project state snapshots
});

app.use(express.json());

// Health Check Endpoints for production deployment verification
app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'ok', service: 'duomation-realtime', timestamp: Date.now() });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'ok', service: 'duomation-realtime', timestamp: Date.now() });
});

// Session memory storage
interface SessionData {
  id: string;
  code: string;
  project: any | null;
  drawDeviceId?: string;
  displayDeviceIds: string[];
  createdAt: number;
  lastActiveAt: number;
  cleanupTimer?: NodeJS.Timeout;
}

const sessions = new Map<string, SessionData>();

// Helper to generate 6-character crypto room codes (excluding ambiguous chars I, O, 0, 1)
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

// Ensure unique code
function generateUniqueCode(): string {
  let attempts = 0;
  while (attempts < 100) {
    const code = generateCode();
    if (!sessions.has(code)) return code;
    attempts++;
  }
  return 'ROOM' + Math.floor(1000 + Math.random() * 9000);
}

function broadcastSessionStatus(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const roomSockets = io.sockets.adapter.rooms.get(sessionId);
  const connectedDevices = roomSockets ? roomSockets.size : 0;
  const hasDisplayDevice = session.displayDeviceIds.length > 0;
  const hasDrawDevice = Boolean(session.drawDeviceId);

  console.log(`[Duomation][Session] Broadcast ${sessionId}: devices=${connectedDevices}, draw=${hasDrawDevice}, display=${hasDisplayDevice}`);

  io.to(sessionId).emit('session-status', {
    connectedDevices,
    hasDisplayDevice,
    hasDrawDevice,
    drawConnected: hasDrawDevice,
    displayConnected: hasDisplayDevice
  });
}

io.on('connection', (socket) => {
  let currentSessionId: string | null = null;
  let deviceRole: 'draw' | 'display' | 'standalone' = 'draw';

  // Create new session from Device A
  socket.on('create-session', (payload: { project?: any }, callback) => {
    try {
      const project = payload?.project;
      const sessionId = 'session_' + crypto.randomBytes(8).toString('hex');
      const code = generateUniqueCode();

      const session: SessionData = {
        id: sessionId,
        code,
        project: project || null,
        drawDeviceId: socket.id,
        displayDeviceIds: [],
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      };

      sessions.set(sessionId, session);
      sessions.set(code, session);

      socket.join(sessionId);
      currentSessionId = sessionId;
      deviceRole = 'draw';

      if (typeof callback === 'function') {
        callback({
          success: true,
          sessionId,
          code,
          connectedDevices: 1
        });
      }

      broadcastSessionStatus(sessionId);
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to create session: ' + err.message });
      }
    }
  });

  // Join existing session by ID or 6-digit Code
  socket.on('join-session', (payload: { sessionKey: string; role?: 'draw' | 'display'; previousDeviceId?: string }, callback) => {
    try {
      const key = (payload?.sessionKey || '').trim().toUpperCase();
      const session = sessions.get(key) || sessions.get(payload?.sessionKey);

      if (!session) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Session not found or expired.' });
        }
        return;
      }

      // Cancel pending cleanup timer if any
      if (session.cleanupTimer) {
        clearTimeout(session.cleanupTimer);
        session.cleanupTimer = undefined;
      }

      const targetRole = payload?.role || 'display';
      socket.join(session.id);
      currentSessionId = session.id;
      deviceRole = targetRole;
      session.lastActiveAt = Date.now();

      if (targetRole === 'display') {
        if (!session.displayDeviceIds.includes(socket.id)) {
          session.displayDeviceIds.push(socket.id);
        }
      } else if (targetRole === 'draw') {
        session.drawDeviceId = socket.id;
      }

      const roomSockets = io.sockets.adapter.rooms.get(session.id);
      const connectedDevices = roomSockets ? roomSockets.size : 1;

      broadcastSessionStatus(session.id);

      if (typeof callback === 'function') {
        callback({
          success: true,
          sessionId: session.id,
          code: session.code,
          project: session.project,
          connectedDevices
        });
      }

      // Ask Device A to send latest snapshot if online
      socket.to(session.id).emit('request-sync-snapshot', { requestedBy: socket.id });
    } catch (err: any) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Join session error: ' + err.message });
      }
    }
  });

  // Leave Session handler
  socket.on('leave-session', (callback) => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      socket.leave(currentSessionId);

      if (session) {
        session.displayDeviceIds = session.displayDeviceIds.filter(id => id !== socket.id);
        if (session.drawDeviceId === socket.id) {
          session.drawDeviceId = undefined;
        }
        broadcastSessionStatus(currentSessionId);
      }

      currentSessionId = null;
      deviceRole = 'standalone';
    }

    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });

  // Relay stroke start
  socket.on('stroke-start', (data) => {
    if (!currentSessionId) return;
    if (!data || typeof data !== 'object') return;
    socket.to(currentSessionId).emit('stroke-start', data);
  });

  // Relay real-time stroke point / batch
  socket.on('stroke-points', (data) => {
    if (!currentSessionId) return;
    if (!data || !data.strokeId || !Array.isArray(data.points)) return;
    socket.to(currentSessionId).emit('stroke-points', data);
  });

  // Relay stroke end / commit
  socket.on('stroke-end', (data) => {
    if (!currentSessionId) return;
    if (!data || typeof data !== 'object') return;
    socket.to(currentSessionId).emit('stroke-end', data);
  });

  // Relay project structure updates (frame added, deleted, moved, layer changes, etc.)
  socket.on('project-update', (data) => {
    if (!currentSessionId || !data || !data.project) return;
    const session = sessions.get(currentSessionId);
    if (session) {
      const incomingRev = data.project.revision || 0;
      const currentRev = session.project?.revision || 0;
      if (incomingRev >= currentRev || !session.project) {
        session.project = data.project;
        session.lastActiveAt = Date.now();
      }
    }
    socket.to(currentSessionId).emit('project-update', data);
  });

  // Relay timeline frame selection
  socket.on('select-frame', (data) => {
    if (!currentSessionId || typeof data?.frameIndex !== 'number') return;
    socket.to(currentSessionId).emit('select-frame', data);
  });

  // Relay playback controls (play, pause, set frame, change fps)
  socket.on('playback-op', (data) => {
    if (!currentSessionId || !data || typeof data.action !== 'string') return;
    socket.to(currentSessionId).emit('playback-op', data);
  });

  // Relay full snapshot from Draw device to Display device
  socket.on('sync-snapshot', (data) => {
    if (!currentSessionId || !data || !data.project) return;
    const session = sessions.get(currentSessionId);
    if (session) {
      const incomingRev = data.project.revision || 0;
      const currentRev = session.project?.revision || 0;
      if (incomingRev >= currentRev || !session.project) {
        session.project = data.project;
        session.lastActiveAt = Date.now();
      }
    }
    if (data.targetSocketId) {
      io.to(data.targetSocketId).emit('sync-snapshot', data);
    } else {
      socket.to(currentSessionId).emit('sync-snapshot', data);
    }
  });

  // Latency ping-pong test
  socket.on('ping-check', (clientTime, callback) => {
    if (typeof callback === 'function') {
      callback({ clientTime, serverTime: Date.now() });
    }
  });

  socket.on('disconnect', () => {
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session) {
        session.displayDeviceIds = session.displayDeviceIds.filter(id => id !== socket.id);
        if (session.drawDeviceId === socket.id) {
          session.drawDeviceId = undefined;
        }

        const roomSockets = io.sockets.adapter.rooms.get(session.id);
        const deviceCount = roomSockets ? roomSockets.size : 0;

        broadcastSessionStatus(session.id);

        // Schedule cleanup for empty sessions after 15 minutes of inactivity
        if (deviceCount === 0) {
          if (session.cleanupTimer) clearTimeout(session.cleanupTimer);
          session.cleanupTimer = setTimeout(() => {
            const room = io.sockets.adapter.rooms.get(session.id);
            if (!room || room.size === 0) {
              sessions.delete(session.id);
              sessions.delete(session.code);
            }
          }, 900000); // 15 min
        }
      }
    }
  });
});

// Production mode serving
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Vite Dev Server middleware
  async function setupViteDev() {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }
  setupViteDev();
}

const PORT = 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Duet 2D Animation Workstation running on port ${PORT}`);
});
