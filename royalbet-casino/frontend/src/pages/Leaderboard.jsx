import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../store/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, TrendingUp, Calendar, Zap } from 'lucide-react';

// ─── Period + Game tabs ───────────────────────────────────────────────────────
const PERIODS = [
  { key: 'daily',   label: 'Daily',    icon: Zap },
  { key: 'weekly',  label: 'Weekly',   icon: Calendar },
  { key: 'alltime', label: 'All Time', icon: TrendingUp },
];

const GAMES = [
  { key: 'ALL',       label: 'All Games' },
  { key: 'SLOTS',     label: 'Slots' },
  { key: 'CRASH',     label: 'Crash' },
  { key: 'ROULETTE',  label: 'Roulette' },
  { key: 'BLACKJACK', label: 'Blackjack' },
  { key: 'POKER',     label: 'Poker' },
];

// ─── Podium medals ────────────────────────────────────────────────────────────
const MEDAL_STYLES = [
  { bg: 'from-yellow-400 to-yellow-600', text: 'text-yellow-300', border: 'border-yellow-500', size: 'w-20 h-20', label: '🥇' },
  { bg: 'from-gray-300 to-gray-500',     text: 'text-gray-300',   border: 'border-gray-400',   size: 'w-16 h-16', label: '🥈' },
  { bg: 'from-orange-400 to-orange-700', text: 'text-orange-400', border: 'border-orange-500', size: 'w-16 h-16', label: '🥉' },
];

function Avatar({ name, url, size = 'w-10 h-10', textSize = 'text-sm' }) {
  if (url) return <img src={url} className={`${size} rounded-full object-cover`} alt={name} />;
  return (
    <div className={`${size} rounded-full bg-gray-700 flex items-center justify-center font-bold ${textSize} text-gray-300`}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function Podium({ entries }) {
  // Podium order: 2nd, 1st, 3rd
  const order = [1, 0, 2];
  const podiumHeights = ['pt-8', 'pt-0', 'pt-12'];

  return (
    <div className="flex items-end justify-center gap-2 mb-6 px-4">
      {order.map((dataIdx, displayIdx) => {
        const entry = entries[dataIdx];
        if (!entry) return <div key={displayIdx} className="w-28" />;
        const style = MEDAL_STYLES[dataIdx];
        return (
          <div key={dataIdx} className={`flex flex-col items-center gap-1.5 w-28 ${podiumHeights[displayIdx]}`}>
            <span className="text-2xl">{style.label}</span>
            <Avatar name={entry.username} url={entry.avatar} size={style.size} textSize="text-lg" />
            <p className="text-xs font-bold text-white truncate max-w-full text-center">{entry.username}</p>
            <p className={`text-xs font-mono font-bold ${style.text}`}>{entry.winnings.toLocaleString()} 🪙</p>
            <div className={`w-full ${displayIdx === 1 ? 'h-20' : 'h-14'} rounded-t-xl bg-gradient-to-b ${style.bg} opacity-80 border-t-2 ${style.border}`} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { user }      = useAuth();
  const queryClient   = useQueryClient();

  const [tab, setTab]      = useState('leaderboard'); // 'leaderboard' | 'tournaments'
  const [period, setPeriod]  = useState('daily');
  const [game, setGame]     = useState('ALL');
  const [page, setPage]     = useState(1);

  // ─── Leaderboard query ─────────────────────────────────────────
  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ['leaderboard', period, game, page],
    queryFn: async () =>
      (await axios.get(`/api/v1/leaderboard/${period}/${game}?page=${page}`)).data,
    keepPreviousData: true,
  });

  // ─── My rank ──────────────────────────────────────────────────
  const { data: myRanks } = useQuery({
    queryKey: ['myRanks'],
    queryFn: async () => (await axios.get('/api/v1/leaderboard/me')).data,
    enabled: !!user,
  });

  // ─── Tournaments query ─────────────────────────────────────────
  const { data: tournaments, isLoading: tournLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => (await axios.get('/api/v1/tournaments')).data,
    enabled: tab === 'tournaments',
  });

  // ─── Join tournament ───────────────────────────────────────────
  const joinMutation = useMutation({
    mutationFn: async (id) => (await axios.post(`/api/v1/tournaments/${id}/join`)).data,
    onSuccess: () => queryClient.invalidateQueries(['tournaments']),
  });

  const entries   = lbData?.entries || [];
  const myRank    = lbData?.myRank;
  const myScore   = lbData?.myScore;
  const myEntry   = entries.find(e => e.userId === user?.id);
  const totalCount = lbData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 20);

  const podiumEntries = entries.slice(0, 3);
  const listEntries   = entries.slice(3);

  return (
    <div className="min-h-screen bg-[#0a0a14] text-gray-200 pb-10 font-sans">
      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <Link to="/lobby" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold">
            <ArrowLeft size={18} /> LOBBY
          </Link>
          <h1 className="text-2xl md:text-3xl font-black text-brand-accent tracking-wider flex items-center gap-2">
            <Trophy size={28} /> LEADERBOARD
          </h1>
          <div className="w-16" />
        </div>

        {/* Main Tab: Leaderboard / Tournaments */}
        <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800">
          {[{key:'leaderboard',label:'🏆 Rankings'},{key:'tournaments',label:'🎯 Tournaments'}].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition cursor-pointer
                ${tab === t.key ? 'bg-brand-accent text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── LEADERBOARD TAB ──────────────────────────────────────── */}
        {tab === 'leaderboard' && (
          <>
            {/* Period tabs */}
            <div className="flex gap-1 mb-3">
              {PERIODS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => { setPeriod(key); setPage(1); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer
                    ${period === key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* Game filter */}
            <div className="flex gap-1 mb-6 flex-wrap">
              {GAMES.map(g => (
                <button
                  key={g.key}
                  onClick={() => { setGame(g.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer
                    ${game === g.key
                      ? 'bg-brand-accent text-black'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {lbLoading ? (
              <div className="text-center text-gray-600 py-12">Loading...</div>
            ) : entries.length === 0 ? (
              <div className="text-center text-gray-600 py-12">No entries yet — be the first!</div>
            ) : (
              <>
                {/* Podium */}
                <Podium entries={podiumEntries} />

                {/* Ranked list (4th place onwards) */}
                <div className="space-y-1.5">
                  {listEntries.map(entry => {
                    const isMe = entry.userId === user?.id;
                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition
                          ${isMe
                            ? 'bg-yellow-900/20 border-yellow-600/30 shadow-[0_0_10px_rgba(255,215,0,0.1)]'
                            : 'bg-gray-900/50 border-gray-800'}`}
                      >
                        <span className={`w-7 text-center font-black text-sm ${isMe ? 'text-brand-accent' : 'text-gray-600'}`}>
                          #{entry.rank}
                        </span>
                        <Avatar name={entry.username} url={entry.avatar} />
                        <span className={`flex-1 font-bold truncate ${isMe ? 'text-brand-accent' : 'text-gray-300'}`}>
                          {isMe ? `${entry.username} (You)` : entry.username}
                        </span>
                        <span className="font-mono text-sm font-bold text-gray-400">
                          {entry.winnings.toLocaleString()} 🪙
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition cursor-pointer">←</button>
                    <span className="px-4 py-2 text-gray-500 text-sm">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition cursor-pointer">→</button>
                  </div>
                )}

                {/* My sticky rank (if not in view) */}
                {myRank && !myEntry && (
                  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-30">
                    <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl px-4 py-3 flex items-center gap-3 backdrop-blur-sm shadow-2xl">
                      <span className="text-brand-accent font-black">#{myRank}</span>
                      <Avatar name={user?.name} />
                      <span className="flex-1 font-bold text-brand-accent truncate">You</span>
                      <span className="font-mono text-sm text-brand-accent">{myScore?.toLocaleString()} 🪙</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─── TOURNAMENTS TAB ──────────────────────────────────────── */}
        {tab === 'tournaments' && (
          <div className="space-y-3">
            {tournLoading && <p className="text-center text-gray-600 py-12">Loading...</p>}
            {!tournLoading && (!tournaments || tournaments.length === 0) && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🎯</p>
                <p className="text-gray-500 font-bold">No tournaments running right now</p>
                <p className="text-gray-600 text-sm mt-1">Check back soon!</p>
              </div>
            )}
            {(tournaments || []).map(t => {
              const isLive = t.status === 'LIVE';
              const startDate = new Date(t.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isLive ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {isLive ? '🔴 LIVE' : '⏳ UPCOMING'}
                        </span>
                        <span className="text-xs text-gray-600">{t.gameType}</span>
                      </div>
                      <h3 className="text-white font-bold text-lg">{t.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Prize Pool</p>
                      <p className="text-xl font-black text-brand-accent">{Number(t.prizePool).toLocaleString()} 🪙</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span>👥 {t.playerCount}/{t.maxPlayers}</span>
                    <span>🎫 Entry: {Number(t.entryFee).toLocaleString()}</span>
                    <span>📅 {startDate}</span>
                  </div>

                  {/* Prize breakdown */}
                  <div className="flex gap-2 mb-4">
                    {[{p:'50%',label:'1st 🥇',col:'text-yellow-400'},{p:'30%',label:'2nd 🥈',col:'text-gray-400'},{p:'20%',label:'3rd 🥉',col:'text-orange-400'}].map(p => (
                      <div key={p.label} className="flex-1 bg-black/30 rounded-lg p-2 text-center">
                        <p className={`text-xs font-bold ${p.col}`}>{p.label}</p>
                        <p className="text-xs text-gray-500">{p.p}</p>
                      </div>
                    ))}
                  </div>

                  {t.status === 'UPCOMING' && (
                    <button
                      onClick={() => joinMutation.mutate(t.id)}
                      disabled={joinMutation.isPending}
                      className="w-full py-3 rounded-xl bg-gradient-to-b from-brand-accent to-yellow-600 text-black font-bold shadow-[0_4px_0_#b45309] hover:brightness-110 transition active:translate-y-0.5 cursor-pointer disabled:opacity-40"
                    >
                      {joinMutation.isPending ? 'JOINING...' : `JOIN — ${Number(t.entryFee).toLocaleString()} 🪙`}
                    </button>
                  )}
                  {t.status === 'LIVE' && (
                    <Link
                      to={`/game/${t.gameType.toLowerCase()}`}
                      className="block text-center w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition cursor-pointer"
                    >
                      PLAY NOW 🎮
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
