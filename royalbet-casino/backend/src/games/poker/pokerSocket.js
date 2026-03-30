/**
 * backend/src/games/poker/pokerSocket.js
 *
 * Socket.IO event handlers for Texas Hold'em Poker.
 *
 * Events from client:
 *   'poker:join'   → { tableId, buyIn }
 *   'poker:leave'  → { tableId }
 *   'poker:action' → { tableId, action, amount? }
 *   'poker:tables'  → request table list
 *
 * Events from server:
 *   'poker:state'          → full (sanitised) table state
 *   'poker:deal'           → { userId, holeCards } (private)
 *   'poker:community'      → { phase, cards }
 *   'poker:showdown'       → { players, communityCards }
 *   'poker:winner'         → { winnerId, amount, handName }
 *   'poker:timer'          → { userId, duration, startedAt }
 *   'poker:timer-warning'  → { userId, secondsLeft }
 *   'poker:action'         → { userId, action, amount, pot }
 *   'poker:tables'         → table list
 *   'poker:error'          → { message }
 */

import * as wallet from '../../services/walletService.js';
import {
  getTable,
  joinTable,
  leaveTable,
  startHand,
  handleAction,
  listTables,
  sanitiseForAll,
} from './tableManager.js';

export function initPokerSocket(io) {
  io.on('connection', (socket) => {

    // ─── List tables ──────────────────────────────────────────────────
    socket.on('poker:tables', async () => {
      try {
        const tables = await listTables();
        socket.emit('poker:tables', tables);
      } catch (err) {
        socket.emit('poker:error', { message: err.message });
      }
    });

    // ─── Join table ───────────────────────────────────────────────────
    socket.on('poker:join', async (data) => {
      try {
        const { tableId, buyIn } = data;
        const userId   = socket.userId || socket.id;
        const username = socket.username || `Player_${socket.id.slice(0, 4)}`;

        // Deduct buy-in from wallet
        try {
          const balanceData = await wallet.getBalance(userId);
          if (Number(balanceData.balance) < buyIn) {
            socket.emit('poker:error', { message: 'Insufficient balance' });
            return;
          }
          await wallet.deductTokens(userId, buyIn, 'POKER');
        } catch (walletErr) {
          // In dev/fallback, proceed without wallet
          console.warn('[Poker] Wallet deduction failed, proceeding:', walletErr.message);
        }

        const { state, seat } = await joinTable(tableId, userId, username, buyIn);

        // Join socket room
        socket.join(tableId);
        socket.pokerTableId = tableId;
        socket.userId = userId;
        socket.username = username;

        // Emit updated state to all at table
        io.to(tableId).emit('poker:state', sanitiseForAll(state));

        // Notify all tables listeners
        const tables = await listTables();
        io.emit('poker:tables', tables);

        // If we have enough players and game is WAITING, start
        if (state.players.length >= 2 && state.phase === 'WAITING') {
          setTimeout(() => startHand(tableId, io), 2000);
        }
      } catch (err) {
        socket.emit('poker:error', { message: err.message });
      }
    });

    // ─── Leave table ──────────────────────────────────────────────────
    socket.on('poker:leave', async (data) => {
      try {
        const tableId = data?.tableId || socket.pokerTableId;
        const userId  = socket.userId || socket.id;

        if (!tableId) return;

        const { chips } = await leaveTable(tableId, userId);

        // Credit remaining chips back to wallet
        if (chips > 0) {
          try {
            await wallet.creditWinnings(userId, chips, 'POKER');
          } catch (walletErr) {
            console.warn('[Poker] Wallet credit failed:', walletErr.message);
          }
        }

        socket.leave(tableId);
        socket.pokerTableId = null;

        // Emit updated state
        const state = await getTable(tableId);
        if (state) {
          io.to(tableId).emit('poker:state', sanitiseForAll(state));
        }

        // Update tables list
        const tables = await listTables();
        io.emit('poker:tables', tables);
      } catch (err) {
        socket.emit('poker:error', { message: err.message });
      }
    });

    // ─── Player action ────────────────────────────────────────────────
    socket.on('poker:action', async (data) => {
      try {
        const tableId = data?.tableId || socket.pokerTableId;
        const userId  = socket.userId || socket.id;
        const action  = data.action;
        const amount  = data.amount || 0;

        if (!tableId) {
          socket.emit('poker:error', { message: 'Not at a table' });
          return;
        }

        await handleAction(tableId, userId, action, amount, io);
      } catch (err) {
        socket.emit('poker:error', { message: err.message });
      }
    });

    // ─── Disconnect — auto-leave ──────────────────────────────────────
    socket.on('disconnect', async () => {
      if (socket.pokerTableId) {
        try {
          const tableId = socket.pokerTableId;
          const userId  = socket.userId || socket.id;

          const { chips } = await leaveTable(tableId, userId);
          if (chips > 0) {
            try {
              await wallet.creditWinnings(userId, chips, 'POKER');
            } catch (e) {
              console.warn('[Poker] Wallet credit on disconnect failed:', e.message);
            }
          }

          const state = await getTable(tableId);
          if (state) {
            io.to(tableId).emit('poker:state', sanitiseForAll(state));
          }
        } catch (err) {
          console.error('[Poker] Disconnect cleanup error:', err.message);
        }
      }
    });
  });
}
