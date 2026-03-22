import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
  Bell, Coins, Gift, Menu, X, Home, Gamepad2, Trophy, 
  CalendarDays, Tag, LifeBuoy, User, LogOut, ChevronRight
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';

// --- MOCK API CALLS (To be replaced with real backend eventually) ---
const fetchBalance = async () => (await axios.get('/wallet/balance')).data;
const fetchRecentWins = async () => {
  // Returns dummy data if the endpoint 404s
  try {
    return (await axios.get('/social/recent-wins')).data;
  } catch (err) {
    return [
      { user: 'LuckyPro99', amount: 5000, game: 'Mega Slots' },
      { user: 'HighRoller2', amount: 12000, game: 'Roulette' },
      { user: 'PokerKing', amount: 3500, game: 'Texas Holdem' },
      { user: 'SpinWinner', amount: 8000, game: 'Crash' }
    ];
  }
};
const fetchLiveFeed = async () => {
  try {
    return (await axios.get('/social/live-feed')).data;
  } catch (err) {
    return Array.from({length: 10}).map((_, i) => ({
      id: i, user: `Player${Math.floor(Math.random()*999)}`, amount: Math.floor(Math.random()*10000), game: ['Slots','Roulette','Blackjack'][i%3], time: 'Just now'
    }));
  }
};

// --- STATIC DATA ---
const HERO_SLIDES = [
  { id: 1, text: '500 FREE coins on signup', color: 'from-purple-900 to-indigo-900', img: '🎰' },
  { id: 2, text: 'Log in every day for bigger rewards', color: 'from-yellow-900 to-red-900', img: '🎁' },
  { id: 3, text: 'Mega Poker Night — Tonight 8PM', color: 'from-blue-900 to-blue-950', img: '🃏' }
];

const GAMES = [
  { id: 'slots', name: 'Royal Slots', icon: '🎰', players: 1204, gradient: 'from-pink-600 to-purple-800' },
  { id: 'roulette', name: 'Roulette', icon: '🎡', players: 843, gradient: 'from-red-600 to-orange-800' },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', players: 301, gradient: 'from-blue-600 to-indigo-800' },
  { id: 'crash', name: 'Crash', icon: '🚀', players: 2590, gradient: 'from-green-600 to-teal-800' },
  { id: 'poker', name: 'Poker', icon: '♠️', players: 512, gradient: 'from-purple-600 to-fuchsia-800' }
];

const SIDEBAR_LINKS = [
  { name: 'Home', path: '/lobby', icon: Home },
  { name: 'Games', path: '/games', icon: Gamepad2 },
  { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  { name: 'Tournaments', path: '/tournaments', icon: CalendarDays },
  { name: 'Promotions', path: '/promotions', icon: Tag },
  { name: 'Support', path: '/support', icon: LifeBuoy }
];

export default function Lobby() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // --- QUERIES ---
  const { data: balanceData } = useQuery({ queryKey: ['balance'], queryFn: fetchBalance, refetchInterval: 5000 });
  const { data: recentWins } = useQuery({ queryKey: ['recentWins'], queryFn: fetchRecentWins, refetchInterval: 60000 });
  const { data: liveFeed } = useQuery({ queryKey: ['liveFeed'], queryFn: fetchLiveFeed, refetchInterval: 30000 });

  // Hero Banner Auto-Scroll
  useEffect(() => {
    const timer = setInterval(() => setCurrentSlide(s => (s + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-casino-bg flex flex-col md:flex-row overflow-x-hidden text-gray-200 font-sans">
      
      {/* 2. SIDEBAR - Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/80 z-40" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed md:sticky top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        <div className="p-6 flex justify-between items-center">
          <Link to="/lobby" className="font-display text-3xl text-brand-accent tracking-widest">ROYALBET 🎰</Link>
          <button className="md:hidden text-gray-400" onClick={() => setSidebarOpen(false)}><X/></button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {SIDEBAR_LINKS.map(link => {
            const isActive = link.name === 'Home'; // Naive active check for dummy
            const Icon = link.icon;
            return (
              <Link key={link.name} to={link.path} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors
                ${isActive ? 'bg-brand-accent/10 font-bold text-brand-accent border border-brand-accent/20' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                <Icon size={20} className={isActive ? 'text-brand-accent' : ''} />
                {link.name}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Wallet Card */}
        <div className="p-4 mt-auto">
          <div className="bg-gradient-to-tr from-gray-800 to-black border border-gray-700 rounded-2xl p-4 text-center">
            <p className="text-gray-400 text-xs uppercase mb-2">My Wallet</p>
            <div className="flex justify-center items-center gap-2 mb-3">
              <Coins className="text-brand-accent w-5 h-5"/>
              <span className="font-display text-2xl text-white">{balanceData?.balance?.toLocaleString() || '0'}</span>
            </div>
            <Link to="/coin-store" className="block w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 rounded-lg transition-colors">
              Manage Wallet
            </Link>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col w-full">
        
        {/* 1. STICKY TOPBAR */}
        <header className="sticky top-0 z-30 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 p-4 shrink-0 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-300 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <span className="md:hidden font-display text-xl text-brand-accent">ROYALBET</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/coin-store" className="hidden sm:flex items-center gap-2 bg-yellow-500/10 text-brand-accent border border-brand-accent/30 rounded-full px-4 py-1.5 hover:bg-brand-accent/20 transition-colors">
              <Gift size={16} /> <span className="text-sm font-bold">Claim Daily Bonus</span>
            </Link>
            
            <Link to="/coin-store" className="flex items-center gap-2 bg-gray-800 rounded-full pl-3 pr-4 py-1.5 border border-gray-700 hover:border-brand-accent/50 transition-colors cursor-pointer">
              <Coins className="text-brand-accent" size={18} />
              <span className="font-bold font-mono text-white">{balanceData?.balance?.toLocaleString() || '0'}</span>
            </Link>
            
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={22} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></span>
            </button>

            {/* Avatar Dropdown */}
            <div className="relative">
              <button 
                className="w-9 h-9 bg-gradient-to-tr from-brand-accent to-yellow-600 rounded-full p-0.5"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-800 mb-2">
                    <p className="text-sm text-white font-bold truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"><User size={16}/> Profile</Link>
                  <Link to="/coin-store" className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800"><Coins size={16}/> Wallet</Link>
                  <button onClick={() => { logout(); navigate('/'); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors mt-2 border-t border-gray-800">
                    <LogOut size={16}/> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-8 flex-1 overflow-y-auto">
          
          {/* 3. HERO BANNER */}
          <section className="relative h-48 md:h-64 rounded-3xl overflow-hidden shadow-2xl cursor-pointer">
            {HERO_SLIDES.map((slide, i) => (
              <div key={slide.id} 
                className={`absolute inset-0 bg-gradient-to-r ${slide.color} flex items-center justify-between p-8 md:p-12 transition-opacity duration-1000
                ${i === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                <div className="max-w-md">
                  <h2 className="font-display text-4xl md:text-5xl text-white mb-4 leading-tight">{slide.text}</h2>
                  <button className="bg-brand-accent text-casino-bg font-bold px-6 py-2 rounded-lg hover:shadow-[0_0_15px_rgba(255,215,0,0.5)] transition text-sm md:text-base">
                    Explore Now
                  </button>
                </div>
                <div className="text-8xl hidden sm:block animate-float-medium drop-shadow-2xl">{slide.img}</div>
              </div>
            ))}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {HERO_SLIDES.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? 'bg-brand-accent' : 'bg-white/30'}`}/>
              ))}
            </div>
          </section>

          {/* 4. LIVE WINS TICKER (CSS only marquee) */}
          <section className="bg-gray-900 border-y border-gray-800 py-3 overflow-hidden whitespace-nowrap relative -mx-4 md:-mx-8 px-4 md:px-8">
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-gray-900 to-transparent z-10"></div>
            <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-gray-900 to-transparent z-10"></div>
            <div className="inline-block animate-marquee-left space-x-12">
              {recentWins?.map((win, i) => (
                <span key={i} className="text-gray-400 font-medium">
                  <span className="text-white">{win.user}</span> won <span className="text-green-400">{win.amount.toLocaleString()} 🪙</span> on <span className="text-brand-accent">{win.game}</span>
                </span>
              ))}
            </div>
          </section>

          {/* 5. STATS ROW */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-2xl p-4 md:p-6 border-t-2 border-t-green-500 shadow-lg">
              <p className="text-gray-400 text-sm mb-1">Today's Winnings</p>
              <p className="font-mono text-2xl text-green-400">+1,450 🪙</p>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 md:p-6 border-t-2 border-t-brand-accent shadow-lg">
              <p className="text-gray-400 text-sm mb-1">Token Balance</p>
              <p className="font-mono text-2xl text-brand-accent">{balanceData?.balance?.toLocaleString() || '0'} 🪙</p>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 md:p-6 border-t-2 border-t-blue-500 shadow-lg">
              <p className="text-gray-400 text-sm mb-1">Games Played Today</p>
              <p className="font-mono text-2xl text-blue-400">12</p>
            </div>
            <div className="bg-gray-900 rounded-2xl p-4 md:p-6 border-t-2 border-t-purple-500 shadow-lg">
              <p className="text-gray-400 text-sm mb-1">My Rank</p>
              <p className="font-display text-2xl text-purple-400 tracking-wider">#4,208</p>
            </div>
          </section>

          {/* 6. GAME GRID */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <h2 className="font-display text-3xl text-white">Featured Games</h2>
              <Link to="/games" className="text-brand-accent text-sm hover:underline flex items-center">View All <ChevronRight size={16}/></Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {GAMES.map(game => (
                <motion.div 
                  key={game.id}
                  whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
                  className={`bg-gradient-to-br ${game.gradient} rounded-2xl p-6 aspect-[4/5] relative overflow-hidden group cursor-pointer shadow-lg`}
                  onClick={() => navigate(`/game/${game.id}`)}
                >
                  {/* Glass overlay */}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/60 transition-colors z-10 flex items-center justify-center">
                    <button className="opacity-0 group-hover:opacity-100 bg-brand-accent text-black font-bold px-6 py-2 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      PLAY NOW
                    </button>
                  </div>
                  
                  {/* Badge */}
                  <div className="absolute top-3 right-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm z-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-pulse"></span> LIVE
                  </div>
                  
                  {/* Content */}
                  <div className="h-full flex flex-col items-center justify-center text-center relative z-0">
                    <div className="text-6xl md:text-7xl mb-4 drop-shadow-2xl">{game.icon}</div>
                    <h3 className="font-display text-xl text-white mb-1">{game.name}</h3>
                    <p className="text-xs text-white/70 font-medium">{game.players.toLocaleString()} Playing</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* 7. BOTTOM ROW: Leaderboard & Feed */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
            
            {/* Leaderboard */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-display text-2xl text-brand-accent mb-4 flex items-center gap-2"><Trophy/> Daily Top 5</h3>
              <div className="space-y-2">
                {['LionKing', 'VegasPro', 'LuckyStrike', 'Dealer12', 'JackpotJoe'].map((name, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-4">
                      <span className={`font-bold w-6 text-center ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-600':'text-gray-600'}`}>#{i+1}</span>
                      <span className="text-gray-200">{name}</span>
                    </div>
                    <span className="font-mono text-brand-accent">{(50000 - i*8000).toLocaleString()}</span>
                  </div>
                ))}
                {/* Users Rank Highlighted */}
                <div className="flex justify-between items-center p-3 bg-brand-accent/10 rounded-xl border border-brand-accent/50 mt-4">
                  <div className="flex items-center gap-4">
                    <span className="font-bold w-6 text-center text-brand-accent">#4K</span>
                    <span className="text-white font-bold">{user?.name || 'You'}</span>
                  </div>
                  <span className="font-mono text-brand-accent font-bold">1,450</span>
                </div>
              </div>
            </div>

            {/* Live Feed */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-display text-2xl text-brand-accent mb-4">Live Activity</h3>
              <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {liveFeed?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm p-3 bg-black/20 rounded-xl">
                    <div>
                      <span className="text-gray-400">{item.time}</span> <span className="text-white font-medium ml-2">{item.user}</span> won on <span className="text-yellow-500">{item.game}</span>
                    </div>
                    <span className="text-green-400 font-bold">+{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>

          </section>

        </div>
      </main>
    </div>
  );
}
