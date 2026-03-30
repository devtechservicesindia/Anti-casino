/**
 * backend/src/tournament/tournament.js  — Express router
 */

import { Router }    from 'express';
import authenticate   from '../middleware/authenticate.js';
import {
  handleList,
  handleJoin,
  handleTournamentLeaderboard,
} from './tournamentController.js';

const router = Router();

router.get('/',                       handleList);
router.post('/:id/join',  authenticate, handleJoin);
router.get('/:id/leaderboard',        handleTournamentLeaderboard);

export default router;
