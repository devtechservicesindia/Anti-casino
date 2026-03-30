/**
 * backend/src/admin/adminController.js
 *
 * All admin API handlers — mounted at /api/v1/admin
 * Protected by authenticate + requireAdmin.
 */

import { PrismaClient } from '@prisma/client';
import Decimal          from 'decimal.js';
import { creditWinnings, deductTokens } from '../services/walletService.js';
import { getRedis }     from '../services/redisService.js';

const prisma = new PrismaClient();

function paginate(page = 1, limit = 20) {
  const p = Math.max(1, Number(page));
  const l = Math.min(100, Math.max(1, Number(limit)));
  return { skip: (p - 1) * l, take: l };
}
function handleError(res, err) {
  return res.status(err.status || 500).json({ error: err.message });
}

// ─── USERS ────────────────────────────────────────────────────────────────────

// GET /users?search=&page=&limit=
export const getUsers = async (req, res) => {
  try {
    const { search = '', page, limit } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = search
      ? {
          OR: [
            { name:  { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { wallet: { select: { balance: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      users: users.map(u => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        phone:     u.phone,
        role:      u.role,
        isBanned:  u.isBanned,
        balance:   Number(u.wallet?.balance || 0),
        createdAt: u.createdAt,
        avatarUrl: u.avatarUrl,
      })),
      total,
      page: Number(page) || 1,
    });
  } catch (err) { return handleError(res, err); }
};

// GET /users/:id — profile + wallet + last 20 game sessions
export const getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.params.id },
      include: {
        wallet:      true,
        gameSessions: { take: 20, orderBy: { createdAt: 'desc' } },
        transactions: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) { return handleError(res, err); }
};

// PUT /users/:id/ban — toggle isBanned
export const banUser = async (req, res) => {
  try {
    const { id }    = req.params;
    const adminId   = req.user.id;
    const existing  = await prisma.user.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const newState = !existing.isBanned;
    const [user]   = await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { isBanned: newState } }),
      prisma.adminLog.create({
        data: {
          adminId,
          action:       newState ? 'BAN_USER' : 'UNBAN_USER',
          targetUserId: id,
          note:         `Admin ${req.user.email} ${newState ? 'banned' : 'unbanned'} user ${existing.email}`,
        },
      }),
    ]);

    return res.json({ success: true, isBanned: newState });
  } catch (err) { return handleError(res, err); }
};

// PUT /users/:id/adjust-balance
export const adjustBalance = async (req, res) => {
  try {
    const { id }     = req.params;
    const adminId    = req.user.id;
    const { amount, reason } = req.body;

    if (!reason) return res.status(400).json({ error: 'reason is required' });
    const amt = Number(amount);
    if (!amt || Math.abs(amt) > 10_000) return res.status(400).json({ error: 'amount must be between -10000 and 10000' });

    const user = await prisma.user.findUnique({ where: { id }, include: { wallet: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentBalance = new Decimal(user.wallet?.balance || 0);
    if (amt < 0 && currentBalance.plus(amt).lt(0)) {
      return res.status(400).json({ error: 'Balance would go negative' });
    }

    const [, updatedWallet] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: id,
          type:   amt > 0 ? 'BONUS' : 'SPEND',
          amount: new Decimal(Math.abs(amt)).toDecimalPlaces(2).toString(),
          status: 'SUCCESS',
          note:   `Admin adjustment: ${reason}`,
        },
      }),
      prisma.wallet.update({
        where: { userId: id },
        data:  { balance: { increment: amt } },
      }),
      prisma.adminLog.create({
        data: {
          adminId,
          action:       'ADJUST_BALANCE',
          targetUserId: id,
          note:         `Amount: ${amt > 0 ? '+' : ''}${amt} | Reason: ${reason}`,
        },
      }),
    ]);

    return res.json({ success: true, newBalance: Number(updatedWallet.balance) });
  } catch (err) { return handleError(res, err); }
};

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────────

// GET /transactions?page=&type=&dateFrom=&dateTo=
export const getTransactions = async (req, res) => {
  try {
    const { page, limit, type, dateFrom, dateTo, userId } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = {};
    if (type)     where.type     = type;
    if (userId)   where.userId   = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    const [txns, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    return res.json({ transactions: txns, total, page: Number(page) || 1 });
  } catch (err) { return handleError(res, err); }
};

// ─── GAME SESSIONS ────────────────────────────────────────────────────────────

// GET /games?page=&gameType=&userId=
export const getGameSessions = async (req, res) => {
  try {
    const { page, limit, gameType, userId } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = {};
    if (gameType) where.gameType = gameType;
    if (userId)   where.userId   = userId;

    const [sessions, total] = await Promise.all([
      prisma.gameSession.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.gameSession.count({ where }),
    ]);

    return res.json({ sessions, total, page: Number(page) || 1 });
  } catch (err) { return handleError(res, err); }
};

// ─── REVENUE ──────────────────────────────────────────────────────────────────

// GET /revenue/daily — last 30 days grouped by date
export const getRevenueDaily = async (_req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Sum of SPEND transactions (tokens spent by users = revenue)
    const raw = await prisma.$queryRaw`
      SELECT
        DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS date,
        SUM(amount) AS revenue
      FROM transactions
      WHERE type = 'SPEND'
        AND status = 'SUCCESS'
        AND created_at >= ${since}
      GROUP BY date
      ORDER BY date ASC
    `;

    return res.json(raw.map(r => ({
      date:    r.date,
      revenue: Number(r.revenue),
    })));
  } catch (err) { return handleError(res, err); }
};

// GET /revenue/summary — today, week, month totals
export const getRevenueSummary = async (_req, res) => {
  try {
    const now     = new Date();
    const todayStart  = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart   = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart  = new Date(now); monthStart.setDate(now.getDate() - 30);

    const sum = async (from) => {
      const result = await prisma.transaction.aggregate({
        where:   { type: 'SPEND', status: 'SUCCESS', createdAt: { gte: from } },
        _sum:    { amount: true },
      });
      return Number(result._sum.amount || 0);
    };

    const [today, week, month] = await Promise.all([sum(todayStart), sum(weekStart), sum(monthStart)]);

    // Active users — Redis scan (socket connections) or DB proxy
    const recentActive = await prisma.user.count({
      where: { gameSessions: { some: { createdAt: { gte: todayStart } } } },
    });
    const usersToday = await prisma.user.count({ where: { createdAt: { gte: todayStart } } });

    return res.json({ today, week, month, recentActive, usersToday });
  } catch (err) { return handleError(res, err); }
};

// ─── TOURNAMENTS ──────────────────────────────────────────────────────────────

// POST /tournaments
export const createTournament = async (req, res) => {
  try {
    const { name, gameType, entryFee, prizePool, maxPlayers, startTime, endTime } = req.body;
    if (!name || !gameType || !entryFee || !prizePool || !startTime || !endTime || !maxPlayers) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const t = await prisma.tournament.create({
      data: {
        name, gameType,
        entryFee:  Number(entryFee),
        prizePool: Number(prizePool),
        maxPlayers: Number(maxPlayers),
        startTime: new Date(startTime),
        endTime:   new Date(endTime),
        status:    'UPCOMING',
      },
    });
    await prisma.adminLog.create({
      data: { adminId: req.user.id, action: 'CREATE_TOURNAMENT', note: `Created tournament: ${name}` },
    });
    return res.status(201).json(t);
  } catch (err) { return handleError(res, err); }
};

// PUT /tournaments/:id
export const updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // partial fields
    const t = await prisma.tournament.update({
      where: { id },
      data:  updates,
    });
    await prisma.adminLog.create({
      data: { adminId: req.user.id, action: 'UPDATE_TOURNAMENT', note: `Updated tournament: ${id}` },
    });
    return res.json(t);
  } catch (err) { return handleError(res, err); }
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

// POST /notifications/send — { message, userId? }
export const sendNotification = async (req, res) => {
  try {
    const { message, userId } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Get io from app locals (set during server init)
    const io = req.app.get('io');
    if (!io) return res.status(500).json({ error: 'Socket.IO not initialised' });

    if (userId) {
      // Target single user
      io.to(`user:${userId}`).emit('notification', { message, at: new Date().toISOString() });
    } else {
      // Broadcast to all
      io.emit('notification', { message, at: new Date().toISOString() });
    }

    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action:  'SEND_NOTIFICATION',
        targetUserId: userId || null,
        note:    message.slice(0, 200),
      },
    });

    return res.json({ success: true, target: userId || 'ALL' });
  } catch (err) { return handleError(res, err); }
};

// ─── ADMIN LOGS ───────────────────────────────────────────────────────────────
export const getAdminLogs = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { skip, take }  = paginate(page, limit);
    const [logs, total]   = await Promise.all([
      prisma.adminLog.findMany({
        skip, take,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { name: true, email: true } } },
      }),
      prisma.adminLog.count(),
    ]);
    return res.json({ logs, total });
  } catch (err) { return handleError(res, err); }
};
