import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO with CORS enabled for any host
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10MB for project state snapshots
});

app.use(express.json());

// Session memory storage
interface SessionData {
  id: string;
  code: string;
  project: any;
  drawDeviceId?: string;
  displayDeviceIds: string[];
  createdAt: number;
}

const sessions = new Map<string, SessionData>();

// Helper to generate 6-character room codes
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  let currentSessionId: string | null = null;
  let deviceRole: 'draw' | 'display' | 'standalone' = 'draw';

  // Create new session from Device A
  socket.on('create-session', ({ project }: { project: any }, callback) => {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 9);
    const code = generateCode();

    const session: SessionData = {
      id: sessionId,
      code: code,
      project: project || null,
      drawDeviceId: socket.id,
      displayDeviceIds: [],
      createdAt: Date.now()
    };

    sessions.set(sessionId, session);
    sessions.set(code, session); // Map code to session as well

    socket.join(sessionId);
    currentSessionId = sessionId;
    deviceRole = 'draw';

    callback({
      success: true,
      sessionId,
      code,
      connectedDevices: 1
    });
  });

  // Join existing session by ID or 6-digit Code from Device B
  socket.on('join-session', ({ sessionKey, role }: { sessionKey: string; role?: 'draw' | 'display' }, callback) => {
    const key = (sessionKey || '').trim().toUpperCase();
    const session = sessions.get(key) || sessions.get(sessionKey);

    if (!session) {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Session not found or expired.' });
      }
      return;
    }

    const targetRole = role || 'display';
    socket.join(session.id);
    currentSessionId = session.id;
    deviceRole = targetRole;

    if (targetRole === 'display') {
      if (!session.displayDeviceIds.includes(socket.id)) {
        session.displayDeviceIds.push(socket.id);
      }
    } else if (targetRole === 'draw') {
      session.drawDeviceId = socket.id;
    }

    // Notify all devices in room about member count
    const roomSockets = io.sockets.adapter.rooms.get(session.id);
    const deviceCount = roomSockets ? roomSockets.size : 1;

    io.to(session.id).emit('session-status', {
      connectedDevices: deviceCount,
      hasDisplayDevice: session.displayDeviceIds.length > 0
    });

    // Send current project snapshot to the newly joined device
    if (typeof callback === 'function') {
      callback({
        success: true,
        sessionId: session.id,
        code: session.code,
        project: session.project,
        connectedDevices: deviceCount
      });
    }

    // Inform Draw device to send latest snapshot if available
    socket.to(session.id).emit('request-sync-snapshot', { requestedBy: socket.id });
  });

  // Relay stroke start
  socket.on('stroke-start', (data) => {
    if (!currentSessionId) return;
    socket.to(currentSessionId).emit('stroke-start', data);
  });

  // Relay real-time stroke point / batch
  socket.on('stroke-points', (data) => {
    if (!currentSessionId) return;
    socket.to(currentSessionId).emit('stroke-points', data);
  });

  // Relay stroke end / commit
  socket.on('stroke-end', (data) => {
    if (!currentSessionId) return;
    socket.to(currentSessionId).emit('stroke-end', data);
  });

  // Relay project structure updates (frame added, deleted, moved, layer changes, etc.)
  socket.on('project-update', (data) => {
    if (!currentSessionId) return;
    const session = sessions.get(currentSessionId);
    if (session && data.project) {
      session.project = data.project;
    }
    socket.to(currentSessionId).emit('project-update', data);
  });

  // Relay timeline frame selection
  socket.on('select-frame', (data) => {
    if (!currentSessionId) return;
    socket.to(currentSessionId).emit('select-frame', data);
  });

  // Relay playback controls (play, pause, set frame, change fps)
  socket.on('playback-op', (data) => {
    if (!currentSessionId) return;
    socket.to(currentSessionId).emit('playback-op', data);
  });

  // Relay full snapshot from Draw device to Display device
  socket.on('sync-snapshot', (data) => {
    if (!currentSessionId) return;
    const session = sessions.get(currentSessionId);
    if (session && data.project) {
      session.project = data.project;
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
        const roomSockets = io.sockets.adapter.rooms.get(session.id);
        const deviceCount = roomSockets ? roomSockets.size : 0;

        io.to(session.id).emit('session-status', {
          connectedDevices: deviceCount,
          hasDisplayDevice: session.displayDeviceIds.length > 0
        });

        // Clean up empty sessions older than 2 hours
        if (deviceCount === 0) {
          setTimeout(() => {
            const currentRoom = io.sockets.adapter.rooms.get(session.id);
            if (!currentRoom || currentRoom.size === 0) {
              sessions.delete(session.id);
              sessions.delete(session.code);
            }
          }, 7200000);
        }
      }
    }
  });
});

// Production mode serving
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');
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
