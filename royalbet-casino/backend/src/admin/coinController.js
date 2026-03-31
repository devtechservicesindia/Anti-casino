/**
 * admin/coinController.js
 * Coin Management feature — search users, adjust balance, view history.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Search user by email or name ────────────────────────────────────────────
export async function searchUser(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q } },
          { name:  { contains: q } },
          { id:    q },
        ],
      },
      take: 10,
      select: {
        id: true, name: true, email: true, role: true, isBanned: true,
        wallet: { select: { balance: true } },
      },
    });

    return res.json({ users });
  } catch (err) {
    console.error('[Coin:searchUser]', err.message);
    return res.status(500).json({ error: 'Search failed' });
  }
}

// ── Adjust balance (add or deduct) ──────────────────────────────────────────
export async function adjustCoins(req, res) {
  try {
    const { userId, amount, type, note } = req.body;

    if (!userId || !amount || !['ADD', 'DEDUCT'].includes(type)) {
      return res.status(400).json({ error: 'userId, amount, and type (ADD|DEDUCT) are required' });
    }

    const coins = parseFloat(amount);
    if (isNaN(coins) || coins <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.wallet) return res.status(400).json({ error: 'User has no wallet' });

    const currentBalance = parseFloat(user.wallet.balance);
    if (type === 'DEDUCT' && coins > currentBalance) {
      return res.status(400).json({ error: 'Insufficient balance to deduct' });
    }

    const delta = type === 'ADD' ? coins : -coins;

    // Atomic: update wallet + create transaction record + log action
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: {
          balance:    { increment: delta },
          totalSpent: type === 'DEDUCT' ? { increment: coins } : undefined,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type:   type === 'ADD' ? 'BONUS' : 'SPEND',
          amount: coins,
          status: 'SUCCESS',
          note:   note || `Admin ${type === 'ADD' ? 'credit' : 'debit'} by ${req.user.email}`,
        },
      }),
      prisma.adminLog.create({
        data: {
          adminId:      req.user.id,
          action:       `COIN_${type}`,
          targetUserId: userId,
          note:         `${type} ${coins} coins. ${note || ''}`.trim(),
        },
      }),
    ]);

    const updated = await prisma.wallet.findUnique({ where: { userId } });
    return res.json({
      success: true,
      newBalance: parseFloat(updated.balance),
      message: `${type === 'ADD' ? 'Added' : 'Deducted'} ${coins} coins successfully`,
    });
  } catch (err) {
    console.error('[Coin:adjustCoins]', err.message);
    return res.status(500).json({ error: 'Adjustment failed' });
  }
}

// ── Get transaction history for a user ──────────────────────────────────────
export async function getUserCoinHistory(req, res) {
  try {
    const { userId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        select: {
          id: true, type: true, amount: true, status: true,
          note: true, createdAt: true,
        },
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);

    return res.json({ transactions, total, page, limit });
  } catch (err) {
    console.error('[Coin:getUserCoinHistory]', err.message);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
}
