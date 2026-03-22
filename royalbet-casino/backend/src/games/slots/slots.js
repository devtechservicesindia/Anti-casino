/**
 * backend/src/games/slots/slots.js  — Express router
 */

import { Router }        from 'express';
import authenticate      from '../../middleware/authenticate.js';
import { handleSpin, getJackpot } from './slotsController.js';

const router = Router();

// GET /api/v1/games/slots/jackpot  (public — let players see the jackpot)
router.get('/jackpot', getJackpot);

// POST /api/v1/games/slots/spin   (protected)
router.post('/spin', authenticate, handleSpin);

export default router;
