/**
 * backend/src/achievement/achievement.js  — Express router
 */

import { Router }    from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { handleMe }   from './achievementController.js';

const router = Router();

router.get('/me', authenticate, handleMe);

export default router;
