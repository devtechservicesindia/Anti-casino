/**
 * backend/src/games/crash/crash.js  — Express router
 */

import { Router }   from 'express';
import authenticate  from '../../middleware/authenticate.js';
import {
  handleBet,
  handleCashout,
  handleHistory,
  handleState,
} from './crashController.js';

const router = Router();

// Protected routes
router.post('/bet',     authenticate, handleBet);
router.post('/cashout', authenticate, handleCashout);

// Public routes
router.get('/history',  handleHistory);
router.get('/state',    handleState);

export default router;
