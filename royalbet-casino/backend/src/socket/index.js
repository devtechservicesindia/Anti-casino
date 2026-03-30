// socket/index.js – Socket.io 4 server initialisation
import { Server } from 'socket.io';
import { initCrashManager } from '../games/crash/crashManager.js';
import { initPokerSocket } from '../games/poker/pokerSocket.js';

/**
 * Initialise the Socket.io server and attach all namespace handlers.
 * @param {import('http').Server} httpServer
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── Default namespace ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} – ${reason}`);
    });
  });

  // ── Init Crash game manager ──────────────────────────────────────────────
  initCrashManager(io);

  // ── Init Poker socket handlers ───────────────────────────────────────────
  initPokerSocket(io);

  return io;
}
