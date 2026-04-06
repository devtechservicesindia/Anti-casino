/**
 * pages/Lobby.jsx — Main game hub (no standalone sidebar/header, uses Layout)
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight, Coins } from 'lucide-react';
import { useAuth } from '../store/AuthContext';

// ─── Static Data ──────────────────────────────────────────────────────────────
const HERO_SLIDES = [
  { id: 1, text: '500 FREE coins on signup', color: 'from-purple-900 to-indigo-900', img: '🎰' },
  { id: 2, text: 'Log in every day for bigger rewards', color: 'from-yellow-900 to-red-900', img: '🎁' },
  { id: 3, text: 'Mega Poker Night — Tonight 8PM', color: 'from-blue-900 to-blue-950', img: '🃏' },
];

const GAMES = [
  // Casino Classics (Backend connected)
  { id: 'slots',     name: 'Royal Slots',  icon: '🎰', players: 1204, gradient: 'from-pink-600 to-purple-800',  glow: 'rgba(219,39,119,0.25)' },
  { id: 'roulette',  name: 'Roulette',     icon: '🎡', players: 843,  gradient: 'from-red-600 to-orange-800',  glow: 'rgba(220,38,38,0.25)' },
  { id: 'blackjack', name: 'Blackjack',    icon: '🃏', players: 301,  gradient: 'from-blue-600 to-indigo-800', glow: 'rgba(37,99,235,0.25)' },
  { id: 'crash',     name: 'Crash',        icon: '🚀', players: 2590, gradient: 'from-green-600 to-teal-800',  glow: 'rgba(22,163,74,0.25)' },
  { id: 'poker',     name: 'Poker',        icon: '♣️', players: 512,  gradient: 'from-purple-600 to-fuchsia-800', glow: 'rgba(147,51,234,0.25)' },
  
  // New USA Casino Games
  { id: 'video-poker', name: 'Video Poker', icon: '🏧', players: 780,  gradient: 'from-emerald-600 to-teal-800', glow: 'rgba(52,211,153,0.25)' },
  { id: 'baccarat',  name: 'Baccarat',     icon: '🎴', players: 410,  gradient: 'from-violet-600 to-purple-900', glow: 'rgba(139,92,246,0.25)' },
  { id: 'keno',      name: 'Keno',         icon: '🎱', players: 1540, gradient: 'from-sky-600 to-blue-900', glow: 'rgba(14,165,233,0.25)' },
  { id: 'three-card-poker', name: '3-Card', icon: '♠️', players: 320,  gradient: 'from-green-600 to-emerald-900', glow: 'rgba(34,197,94,0.25)' },
  { id: 'plinko',    name: 'Plinko',       icon: '🎯', players: 4300, gradient: 'from-fuchsia-600 to-pink-900', glow: 'rgba(217,70,239,0.25)' },

  // Casual & Social Games
  { id: 'ludo',      name: 'Ludo',         icon: '🎲', players: 8900, gradient: 'from-red-500 to-red-800', glow: 'rgba(239,68,68,0.25)' },
  { id: 'snakes',    name: 'Snake/Ladder', icon: '🐍', players: 5200, gradient: 'from-amber-500 to-orange-800', glow: 'rgba(245,158,11,0.25)' },
  { id: 'solitaire', name: 'Solitaire',    icon: '♥', players: 2100, gradient: 'from-green-700 to-green-950', glow: 'rgba(21,128,61,0.25)' },
];

// ─── API helpers ──────────────────────────────────────────────────────────────
const fetchBalance = () => axios.get('/wallet/balance').then(r => r.data);
const fetchRecentWins = async () => {
  try { return (await axios.get('/social/recent-wins')).data; }
  catch { return [
    { user: 'LuckyPro99',   amount: 5000,  game: 'Mega Slots' },
    { user: 'HighRoller2',  amount: 12000, game: 'Roulette' },
    { user: 'PokerKing',    amount: 3500,  game: 'Texas Hold\'em' },
    { user: 'SpinWinner',   amount: 8000,  game: 'Crash' },
  ]; }
};
const fetchLiveFeed = async () => {
  try { return (await axios.get('/social/live-feed')).data; }
  catch {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i, user: `Player${(i * 37 + 101) % 999}`,
      amount: [250, 1500, 3800, 750, 500, 12000, 90, 2000, 400, 6000][i],
      game:   ['Slots','Roulette','Blackjack','Crash','Poker'][i % 5],
      time:   i < 3 ? 'Just now' : `${i * 2}m ago`,
    }));
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Lobby() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [slide, setSlide] = useState(0);

  // Queries
  const { data: balanceData }  = useQuery({ queryKey: ['balance'],     queryFn: fetchBalance,     refetchInterval: 5000 });
  const { data: recentWins }   = useQuery({ queryKey: ['recentWins'],  queryFn: fetchRecentWins,  refetchInterval: 60000 });
  const { data: liveFeed }     = useQuery({ queryKey: ['liveFeed'],    queryFn: fetchLiveFeed,    refetchInterval: 30000 });

  // Hero auto-scroll
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const balance = balanceData?.balance ?? 0;

  return (
    <div className="p-4 md:p-8 space-y-8 text-gray-200 font-sans">

      {/* ── Hero Banner ────────────────────────────────────────────────── */}
      <section className="relative h-48 md:h-64 rounded-3xl overflow-hidden shadow-2xl cursor-pointer">
        {HERO_SLIDES.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 bg-gradient-to-r ${s.color} flex items-center justify-between p-8 md:p-12 transition-opacity duration-1000
              ${i === slide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <div className="max-w-md">
              <h2 className="font-display text-3xl md:text-5xl text-white mb-4 leading-tight">{s.text}</h2>
              <Link to="/coin-store" className="inline-block bg-brand-accent text-black font-bold px-6 py-2 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.5)] transition text-sm md:text-base">
                Explore Now
              </Link>
            </div>
            <div className="text-7xl hidden sm:block animate-float-medium drop-shadow-2xl">{s.img}</div>
          </div>
        ))}
        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === slide ? 'bg-brand-accent w-6' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </section>

      {/* ── Live Wins Ticker ───────────────────────────────────────────── */}
      <section className="bg-gray-900 border-y border-gray-800 py-3 overflow-hidden whitespace-nowrap relative -mx-4 md:-mx-8 px-0">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-gray-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-gray-900 to-transparent z-10 pointer-events-none" />
        <div className="inline-flex animate-marquee-left gap-12 pl-4">
          {recentWins?.map((w, i) => (
            <span key={i} className="text-gray-400 font-medium text-sm shrink-0">
              <span className="text-white font-bold">{w.user}</span> won{' '}
              <span className="text-green-400 font-bold">{w.amount.toLocaleString()} 🪙</span> on{' '}
              <span className="text-brand-accent">{w.game}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Wins",    value: '+1,450 🪙',            color: 'border-green-500',   text: 'text-green-400' },
          { label: 'Token Balance',   value: `${balance.toLocaleString()} 🪙`, color: 'border-brand-accent', text: 'text-brand-accent' },
          { label: 'Games Today',     value: '12',                    color: 'border-blue-500',    text: 'text-blue-400' },
          { label: 'My Rank',         value: '#4,208',                color: 'border-purple-500',  text: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className={`bg-gray-900 rounded-2xl p-4 md:p-6 border-t-4 ${s.color} shadow-lg`}>
            <p className="text-gray-400 text-sm mb-1">{s.label}</p>
            <p className={`font-mono text-xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* ── Game Grid ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-display text-3xl text-white">Featured Games</h2>
          <span className="text-brand-accent text-sm flex items-center gap-0.5">All Games <ChevronRight size={15}/></span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {GAMES.map(game => (
            <motion.div
              key={game.id}
              whileHover={{ scale: 1.04, y: -4 }}
              transition={{ duration: 0.15 }}
              className={`bg-gradient-to-br ${game.gradient} rounded-2xl aspect-[4/5] relative overflow-hidden group cursor-pointer shadow-xl`}
              style={{ boxShadow: `0 8px 24px ${game.glow}` }}
              onClick={() => navigate(`/game/${game.id}`)}
            >
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 z-10 flex items-center justify-center">
                <button className="opacity-0 group-hover:opacity-100 bg-brand-accent text-black text-sm font-black px-5 py-2 rounded-full translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-lg">
                  PLAY NOW
                </button>
              </div>

              {/* LIVE badge */}
              <div className="absolute top-3 right-3 z-0 flex items-center gap-1 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </div>

              {/* Icon + name */}
              <div className="h-full flex flex-col items-center justify-center text-center p-4 relative z-0">
                <div className="text-5xl md:text-6xl mb-3 drop-shadow-2xl">{game.icon}</div>
                <h3 className="font-display text-lg text-white mb-0.5">{game.name}</h3>
                <p className="text-xs text-white/70">{game.players.toLocaleString()} Playing</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Bottom: Leaderboard + Live Feed ────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">

        {/* Top 5 Leaderboard */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl text-brand-accent flex items-center gap-2">
              <Trophy size={22}/> Daily Top 5
            </h3>
            <Link to="/leaderboard" className="text-xs text-gray-500 hover:text-brand-accent transition flex items-center gap-1">
              Full Board <ChevronRight size={12}/>
            </Link>
          </div>
          <div className="space-y-2">
            {['LionKing','VegasPro','LuckyStrike','Dealer12','JackpotJoe'].map((name, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-gray-800">
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-sm w-5 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-600':'text-gray-600'}`}>#{i+1}</span>
                  <span className="text-gray-200 text-sm">{name}</span>
                </div>
                <span className="font-mono text-brand-accent text-sm font-bold">{(50000 - i * 8000).toLocaleString()}</span>
              </div>
            ))}
            {/* Player's rank */}
            <div className="flex justify-between items-center p-3 bg-brand-accent/10 rounded-xl border border-brand-accent/40 mt-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm w-5 text-center text-brand-accent">#4K</span>
                <span className="text-white font-bold text-sm">{user?.name || 'You'}</span>
              </div>
              <span className="font-mono text-brand-accent font-bold text-sm flex items-center gap-1"><Coins size={13}/> {balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="font-display text-2xl text-brand-accent mb-4">Live Activity</h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {liveFeed?.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm p-3 bg-black/20 rounded-xl hover:bg-black/40 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {(item.user||'?')[0]}
                  </div>
                  <div className="min-w-0">
                    <span className="text-white font-medium truncate">{item.user}</span>
                    <span className="text-gray-500 ml-1">won on</span>
                    <span className="text-brand-accent ml-1">{item.game}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-green-400 font-bold">+{item.amount.toLocaleString()}</span>
                  <p className="text-gray-600 text-xs">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>
    </div>
  );
}
