import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient }   from '@tanstack/react-query';
import axios from 'axios';
import { io }  from 'socket.io-client';
import { useAuth } from '../../store/AuthContext';
import { Link }    from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, Trophy, Lock, Zap, Users, Star,
} from 'lucide-react';

// ─── Socket singleton ─────────────────────────────────────────────────────────
let socket = null;
function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
}

// ─── Achievement glow animation keyframes ─────────────────────────────────────
const TOAST_DURATION = 5000;

function AchievementToast({ achievement, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed top-6 right-6 z-50 pointer-events-none">
      <div className="flex items-center gap-3 bg-gray-900 border border-brand-accent/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(255,215,0,0.3)] max-w-xs"
           style={{ animation: 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div className="text-4xl" style={{ animation: 'pulse 0.8s ease-in-out 3' }}>{achievement.icon}</div>
        <div>
          <p className="text-xs text-brand-accent font-black uppercase tracking-widest">Achievement Unlocked!</p>
          <p className="text-white font-bold text-sm">{achievement.name.replace(/_/g,' ')}</p>
          <p className="text-gray-400 text-xs">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────
export default function Profile() {
  const { user }      = useAuth();
  const queryClient   = useQueryClient();
  const [copied, setCopied]       = useState(false);
  const [toasts, setToasts]       = useState([]);
  const toastIdRef = useRef(0);

  // ─── Queries ──────────────────────────────────────────────────────────
  const { data: achievementsData, isLoading: achLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn:  async () => (await axios.get('/api/v1/achievements/me')).data,
  });

  const { data: referralCode } = useQuery({
    queryKey: ['referralCode'],
    queryFn:  async () => (await axios.get('/api/v1/referral/my-code')).data,
  });

  const { data: referralStats } = useQuery({
    queryKey: ['referralStats'],
    queryFn:  async () => (await axios.get('/api/v1/referral/stats')).data,
  });

  const { data: myRanks } = useQuery({
    queryKey: ['myRanks'],
    queryFn:  async () => (await axios.get('/api/v1/leaderboard/me')).data,
    enabled:  !!user,
  });

  const { data: walletData } = useQuery({
    queryKey: ['balance'],
    queryFn:  async () => (await axios.get('/wallet/balance')).data,
  });

  // ─── Socket — achievement unlock toast ────────────────────────────────
  useEffect(() => {
    const s = getSocket();
    s.on('achievement:unlocked', (ach) => {
      const id = ++toastIdRef.current;
      setToasts(prev => [...prev, { id, ...ach }]);
      queryClient.invalidateQueries(['achievements']);
    });
    return () => { s.off('achievement:unlocked'); };
  }, [queryClient]);

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ─── Copy referral code ────────────────────────────────────────────────
  const handleCopy = () => {
    if (referralCode?.referralLink) {
      navigator.clipboard.writeText(referralCode.referralLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const earned = achievementsData?.earned || [];
  const locked = achievementsData?.locked || [];
  const allAchievements = [...earned, ...locked];

  const dailyRank   = myRanks?.daily?.ALL?.rank;
  const weeklyRank  = myRanks?.weekly?.ALL?.rank;
  const alltimeRank = myRanks?.alltime?.ALL?.rank;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-gray-200 pb-10 font-sans">
      {/* Achievement toasts */}
      {toasts.map(t => (
        <AchievementToast key={t.id} achievement={t} onClose={() => dismissToast(t.id)} />
      ))}

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/lobby" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold">
            <ArrowLeft size={18} /> LOBBY
          </Link>
          <h1 className="text-2xl font-black text-white">PROFILE</h1>
          <div className="w-16" />
        </div>

        {/* User card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-accent to-yellow-600 flex items-center justify-center text-2xl font-black text-black">
            {(user?.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{user?.name || 'Player'}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Balance</p>
            <p className="text-2xl font-black text-brand-accent">{Number(walletData?.balance || 0).toLocaleString()} 🪙</p>
          </div>
        </div>

        {/* Rank summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Daily Rank',   rank: dailyRank,   icon: Zap },
            { label: 'Weekly Rank',  rank: weeklyRank,  icon: Star },
            { label: 'All-Time',     rank: alltimeRank, icon: Trophy },
          ].map(({ label, rank, icon: Icon }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <Icon size={16} className="mx-auto mb-1 text-brand-accent" />
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-black text-white">{rank ? `#${rank}` : '—'}</p>
            </div>
          ))}
        </div>

        {/* ─── Referral Card ─────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-brand-accent" />
            <h3 className="text-base font-black text-white">Referral Program</h3>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-brand-accent">{referralStats?.totalReferred || 0}</p>
              <p className="text-xs text-gray-500">Friends Referred</p>
            </div>
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-green-400">{(referralStats?.tokensEarned || 0).toLocaleString()} 🪙</p>
              <p className="text-xs text-gray-500">Tokens Earned</p>
            </div>
          </div>

          {/* Code + link */}
          {referralCode && (
            <>
              <div className="flex items-center gap-3 bg-black/40 border border-gray-700 rounded-xl p-3 mb-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">Your Code</p>
                  <p className="font-mono font-black text-brand-accent text-xl tracking-widest">{referralCode.code}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-bold transition cursor-pointer"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <p className="text-xs text-gray-600 break-all">{referralCode.referralLink}</p>
              <p className="text-xs text-gray-500 mt-2">
                You get <span className="text-green-400 font-bold">+300 🪙</span> and your friend gets <span className="text-green-400 font-bold">+200 🪙</span> on their first purchase.
              </p>
            </>
          )}

          {/* Referred list */}
          {(referralStats?.referrals || []).length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Referred Friends</p>
              {referralStats.referrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-black/20 rounded-lg px-3 py-2">
                  <span className="text-gray-300">{r.username}</span>
                  <span className={`text-xs font-bold ${r.bonusGiven ? 'text-green-400' : 'text-gray-600'}`}>
                    {r.bonusGiven ? '✓ Bonus Given' : 'Pending Purchase'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Achievements Grid ─────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-brand-accent" />
              <h3 className="text-base font-black text-white">Achievements</h3>
            </div>
            <p className="text-sm text-gray-500">
              {earned.length} / {allAchievements.length} unlocked
            </p>
          </div>

          {achLoading && <p className="text-gray-600 text-sm text-center py-4">Loading...</p>}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Earned first (coloured) */}
            {earned.map(ach => (
              <div
                key={ach.id}
                className="relative bg-gradient-to-br from-gray-800 to-gray-900 border border-brand-accent/40 rounded-xl p-3 text-center"
                style={{ boxShadow: '0 0 12px rgba(255,215,0,0.08)' }}
              >
                <div className="text-3xl mb-1.5" style={{ animation: 'none' }}>{ach.icon}</div>
                <p className="text-xs font-bold text-brand-accent leading-tight">
                  {ach.name.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{ach.description}</p>
                {ach.earnedAt && (
                  <p className="text-[9px] text-gray-600 mt-1">
                    {new Date(ach.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                )}
                {/* Earned checkmark */}
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={10} className="text-white" />
                </div>
              </div>
            ))}

            {/* Locked (greyscale) */}
            {locked.map(ach => (
              <div
                key={ach.id}
                className="relative bg-gray-900/60 border border-gray-800 rounded-xl p-3 text-center opacity-50"
              >
                <div className="text-3xl mb-1.5 grayscale">{ach.icon}</div>
                <p className="text-xs font-bold text-gray-500 leading-tight">
                  {ach.name.replace(/_/g, ' ')}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{ach.description}</p>
                <div className="absolute top-1.5 right-1.5">
                  <Lock size={12} className="text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { transform: translateX(120%) scale(0.8); opacity: 0; }
          to   { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
