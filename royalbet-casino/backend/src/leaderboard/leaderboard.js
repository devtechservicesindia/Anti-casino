/**
 * backend/src/leaderboard/leaderboard.js  — Express router
 */

import { Router }    from 'express';
import authenticate   from '../middleware/authenticate.js';
import { handleGet, handleMe } from './leaderboardController.js';

const router = Router();

// Public — no auth required to view leaderboard
router.get('/me',              authenticate, handleMe);
router.get('/:period/:gameType', handleGet);
router.get('/:period',           handleGet);

export default router;
