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
import adminRoutes       from './admin/admin.js';

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
// FIX #3: CORS strict-mode — NEVER use a hardcoded fallback in production.
// If FRONTEND_URL is not set, we deny all cross-origin requests.
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : (process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:5174'] : []);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin and non-browser requests (curl, Postman) in dev
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
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
app.use('/api/v1/admin',            adminRoutes);
// app.use('/api/v1/users',  userRoutes);   // coming soon
// app.use('/api/v1/admin',  adminRoutes);  // coming soon

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// FIX #4: Never expose stack traces. Log sanitized info only in non-production.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const statusCode = err.status || 500;
  if (process.env.NODE_ENV !== 'production') {
    // Development: log the stack for debugging
    console.error(`[${statusCode}] ${err.message}\n${err.stack}`);
  } else {
    // Production: log only generic info, never the stack
    console.error(`[${statusCode}] ${err.message}`);
  }
  res.status(statusCode).json({
    // CLIENT-FACING: never expose err.message for 5xx errors
    error: statusCode < 500 ? err.message : 'Internal server error',
  });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
const io = initSocket(server);
app.set('io', io); // Make io available in req.app.get('io')

// ── Background crons ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  try {
    startLeaderboardSync();
    startTournamentCron();
    seedAchievements().catch(err => console.error('[Achievement Seed Error]:', err.message));
  } catch (err) {
    console.error('[Cron/Seed Initialization Error]:', err.message);
  }
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
