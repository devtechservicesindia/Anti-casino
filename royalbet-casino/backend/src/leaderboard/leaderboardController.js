/**
 * backend/src/leaderboard/leaderboardController.js
 */

import { getLeaderboard, getMyRanks } from '../services/leaderboardService.js';

function handleError(res, err) {
  return res.status(err.status || 500).json({ error: err.message });
}

// GET /api/v1/leaderboard/:period/:gameType?page=1
export const handleGet = async (req, res) => {
  try {
    const { period, gameType = 'ALL' } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const myUserId = req.user?.id || null;

    const data = await getLeaderboard(period, gameType, page, myUserId);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/v1/leaderboard/me
export const handleMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await getMyRanks(userId);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};
