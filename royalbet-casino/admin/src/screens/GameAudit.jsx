import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api.js';

const GAME_TYPES = ['', 'SLOTS', 'ROULETTE', 'BLACKJACK', 'CRASH', 'POKER'];

export default function GameAudit() {
  const [page, setPage] = useState(1);
  const [gameType, setGameType] = useState('');
  const [userId, setUserId]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['adminGames', page, gameType, userId],
    queryFn:  () => {
      const p = new URLSearchParams({ page, limit: 25 });
      if (gameType) p.set('gameType', gameType);
      if (userId)   p.set('userId', userId);
      return api.get(`/games?${p}`).then(r => r.data);
    },
    keepPreviousData: true,
  });

  const sessions = data?.sessions || [];
  const total    = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-white">Game Audit</h1>
        <p className="text-sm text-gray-500">{total.toLocaleString()} sessions</p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={gameType} onChange={e => { setGameType(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 cursor-pointer">
          {GAME_TYPES.map(g => <option key={g} value={g}>{g || 'All Games'}</option>)}
        </select>
        <input value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }}
          placeholder="Filter by User ID"
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 w-52" />
        <button onClick={() => { setGameType(''); setUserId(''); setPage(1); }}
          className="px-3 py-2 rounded-xl bg-gray-800 text-xs text-gray-400 hover:bg-gray-700 transition cursor-pointer">Clear</button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['User', 'Game', 'Bet', 'Win', 'Outcome', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-12 text-gray-600">Loading...</td></tr>}
            {sessions.map(s => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{s.user?.name || '—'}</p>
                  <p className="text-xs text-gray-500">{s.user?.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">{s.gameType}</span>
                </td>
                <td className="px-4 py-3 font-mono text-gray-300">{Number(s.betAmount).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono font-bold text-green-400">{Number(s.winAmount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${
                    s.outcome === 'WIN' ? 'text-green-400' : s.outcome === 'LOSS' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {s.outcome}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">{total} sessions</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 disabled:opacity-30 cursor-pointer">←</button>
              <span className="text-xs text-gray-500 py-1.5">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 disabled:opacity-30 cursor-pointer">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
