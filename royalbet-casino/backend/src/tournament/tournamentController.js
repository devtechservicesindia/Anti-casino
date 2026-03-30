/**
 * backend/src/tournament/tournamentController.js
 *
 * Tournament endpoints + prize cron.
 */

import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import * as wallet from '../services/walletService.js';

const prisma = new PrismaClient();

function handleError(res, err) {
  return res.status(err.status || 500).json({ error: err.message });
}

// ─── GET /api/v1/tournaments ─────────────────────────────────────────────────
export const handleList = async (_req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { status: { in: ['UPCOMING', 'LIVE'] } },
      include: {
        entries: { select: { userId: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return res.json(tournaments.map(t => ({
      id:          t.id,
      name:        t.name,
      gameType:    t.gameType,
      entryFee:    Number(t.entryFee),
      prizePool:   Number(t.prizePool),
      maxPlayers:  t.maxPlayers,
      startTime:   t.startTime,
      endTime:     t.endTime,
      status:      t.status,
      playerCount: t.entries.length,
    })));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /api/v1/tournaments/:id/join ───────────────────────────────────────
export const handleJoin = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tournament = await prisma.tournament.findUnique({ where: { id } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    if (tournament.status !== 'UPCOMING') {
      return res.status(400).json({ error: 'Tournament is not open for registration' });
    }
    if (new Date(tournament.startTime) <= new Date()) {
      return res.status(400).json({ error: 'Tournament has already started' });
    }

    // Check not already joined
    const existing = await prisma.tournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId: id, userId } },
    });
    if (existing) return res.status(409).json({ error: 'Already joined this tournament' });

    // Check max players
    const count = await prisma.tournamentEntry.count({ where: { tournamentId: id } });
    if (count >= tournament.maxPlayers) {
      return res.status(409).json({ error: 'Tournament is full' });
    }

    const entryFee = Number(tournament.entryFee);

    // Atomic: deduct entry fee + create entry
    const [, entry] = await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: entryFee }, totalSpent: { increment: entryFee } },
      }),
      prisma.tournamentEntry.create({
        data: { tournamentId: id, userId, score: 0 },
      }),
    ]);

    const bd = await wallet.getBalance(userId);

    return res.json({
      success: true,
      entryId:    entry.id,
      newBalance: Number(bd.balance),
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /api/v1/tournaments/:id/leaderboard ─────────────────────────────────
export const handleTournamentLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId: id },
      include: { user: { select: { name: true, avatarUrl: true } } },
      orderBy: { score: 'desc' },
    });

    return res.json(entries.map((e, idx) => ({
      rank:     idx + 1,
      userId:   e.userId,
      username: e.user.name,
      avatar:   e.user.avatarUrl,
      score:    Number(e.score),
      prizeWon: Number(e.prizeWon),
    })));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Prize distribution (called by cron) ─────────────────────────────────────
export async function distributePrizes(tournamentId) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      entries: {
        orderBy: { score: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!tournament || tournament.status === 'COMPLETED') return;

  const prizePool = Number(tournament.prizePool);
  const prizes = [
    { pct: 0.50, rank: 1 },
    { pct: 0.30, rank: 2 },
    { pct: 0.20, rank: 3 },
  ];

  const winners = tournament.entries.slice(0, 3);

  for (let i = 0; i < winners.length; i++) {
    if (!prizes[i]) break;
    const prize  = Math.floor(prizePool * prizes[i].pct);
    const entry  = winners[i];

    await wallet.creditWinnings(entry.userId, prize, 'TOURNAMENT');

    await prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: { rank: i + 1, prizeWon: prize },
    });

    console.log(`[Tournament] ${entry.user.name} wins ${prize} tokens (rank ${i + 1})`);
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { status: 'COMPLETED' },
  });

  console.log(`[Tournament] ${tournament.name} completed, prizes distributed.`);
}

// ─── Start tournament cron — checks every minute ──────────────────────────────
export function startTournamentCron() {
  const CHECK_INTERVAL = 60_000; // 1 minute

  setInterval(async () => {
    try {
      const now = new Date();

      // UPCOMING → LIVE when startTime reached
      await prisma.tournament.updateMany({
        where: { status: 'UPCOMING', startTime: { lte: now } },
        data:  { status: 'LIVE' },
      });

      // LIVE → COMPLETED when endTime reached, then distribute prizes
      const ended = await prisma.tournament.findMany({
        where: { status: 'LIVE', endTime: { lte: now } },
      });

      for (const t of ended) {
        await distributePrizes(t.id);
      }
    } catch (err) {
      console.error('[Tournament Cron]', err.message);
    }
  }, CHECK_INTERVAL);

  console.log('[Tournament] Prize distribution cron scheduled');
}
