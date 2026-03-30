/**
 * backend/src/games/blackjack/blackjack.js  — Express router
 */

import { Router }   from 'express';
import authenticate  from '../../middleware/authenticate.js';
import {
  handleStart,
  handleHit,
  handleStand,
  handleDouble,
  handleSplit,
  handleGetState,
} from './blackjackController.js';

const router = Router();

// All routes are protected
router.post('/start',  authenticate, handleStart);
router.post('/hit',    authenticate, handleHit);
router.post('/stand',  authenticate, handleStand);
router.post('/double', authenticate, handleDouble);
router.post('/split',  authenticate, handleSplit);
router.get('/state',   authenticate, handleGetState);

export default router;
