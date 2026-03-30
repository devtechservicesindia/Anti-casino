/**
 * backend/src/games/roulette/roulette.js  — Express router
 */

import { Router }   from 'express';
import authenticate  from '../../middleware/authenticate.js';
import { handleSpin } from './rouletteController.js';

const router = Router();

// POST /api/v1/games/roulette/spin   (protected)
router.post('/spin', authenticate, handleSpin);

export default router;
