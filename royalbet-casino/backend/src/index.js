import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import authRoutes   from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import slotsRoutes    from './games/slots/slots.js';
import rouletteRoutes from './games/roulette/roulette.js';
import blackjackRoutes from './games/blackjack/blackjack.js';
import crashRoutes     from './games/crash/crash.js';
import leaderboardRoutes from './leaderboard/leaderboard.js';
import tournamentRoutes  from './tournament/tournament.js';
import referralRoutes    from './referral/referral.js';
import achievementRoutes from './achievement/achievement.js';

// Socket.io initializer
import { initSocket } from './socket/index.js';

// Background crons
import { startLeaderboardSync } from './services/leaderboardService.js';
import { startTournamentCron }  from './tournament/tournamentController.js';
import { seedAchievements }     from './services/achievementService.js';

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'royalbet-backend', timestamp: new Date().toISOString() });
});

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',   authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/games/slots', slotsRoutes);
app.use('/api/v1/games/roulette', rouletteRoutes);
app.use('/api/v1/games/blackjack', blackjackRoutes);
app.use('/api/v1/games/crash',     crashRoutes);
app.use('/api/v1/leaderboard',      leaderboardRoutes);
app.use('/api/v1/tournaments',      tournamentRoutes);
app.use('/api/v1/referral',         referralRoutes);
app.use('/api/v1/achievements',     achievementRoutes);
// app.use('/api/v1/users',  userRoutes);   // coming soon
// app.use('/api/v1/admin',  adminRoutes);  // coming soon

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
initSocket(server);

// ── Background crons ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  startLeaderboardSync();
  startTournamentCron();
  seedAchievements().catch(console.error); // idempotent upsert on boot
}

// ── Start server ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`🎰 RoyalBet Backend running on http://localhost:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
