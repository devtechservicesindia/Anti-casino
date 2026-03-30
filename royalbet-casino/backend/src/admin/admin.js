/**
 * backend/src/admin/admin.js — Express router
 * All routes: authenticate + requireAdmin
 */

import { Router }      from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  getUsers, getUserById, banUser, adjustBalance,
  getTransactions, getGameSessions,
  getRevenueDaily, getRevenueSummary,
  createTournament, updateTournament,
  sendNotification, getAdminLogs,
} from './adminController.js';

const router = Router();
// Apply auth to all admin routes
router.use(authenticate, requireAdmin);

// ── Users ────────────────────────────────────────────────────────────────────
router.get('/users',                   getUsers);
router.get('/users/:id',               getUserById);
router.put('/users/:id/ban',           banUser);
router.put('/users/:id/adjust-balance', adjustBalance);

// ── Transactions & Games ─────────────────────────────────────────────────────
router.get('/transactions',            getTransactions);
router.get('/games',                   getGameSessions);

// ── Revenue ──────────────────────────────────────────────────────────────────
router.get('/revenue/daily',           getRevenueDaily);
router.get('/revenue/summary',         getRevenueSummary);

// ── Tournaments ──────────────────────────────────────────────────────────────
router.post('/tournaments',            createTournament);
router.put('/tournaments/:id',         updateTournament);

// ── Notifications ────────────────────────────────────────────────────────────
router.post('/notifications/send',     sendNotification);

// ── Admin logs ───────────────────────────────────────────────────────────────
router.get('/logs',                    getAdminLogs);

export default router;
