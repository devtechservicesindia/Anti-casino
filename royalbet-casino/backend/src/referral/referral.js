/**
 * backend/src/referral/referral.js  — Express router
 */

import { Router }    from 'express';
import authenticate   from '../middleware/authenticate.js';
import { handleMyCode, handleStats, handleApply } from './referralController.js';

const router = Router();

router.get('/my-code', authenticate, handleMyCode);
router.get('/stats',   authenticate, handleStats);
router.post('/apply',  authenticate, handleApply);

export default router;
