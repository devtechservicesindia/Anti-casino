// socket/index.js – Socket.io 4 server initialisation
import { Server } from 'socket.io';

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

  // ── Auth middleware ──────────────────────────────────────────────────────
  // io.use(socketAuthMiddleware);

  // ── Namespaces ───────────────────────────────────────────────────────────
  // const gameNamespace   = io.of('/game');
  // const walletNamespace = io.of('/wallet');
  // const chatNamespace   = io.of('/chat');

  // ── Default namespace ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} – ${reason}`);
    });

    // TODO: register game event listeners per namespace
  });

  return io;
}
