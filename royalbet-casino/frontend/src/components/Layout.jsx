/**
 * components/Layout.jsx
 *
 * Shared shell for all protected pages: Sidebar + Topbar.
 * Imported by App.jsx as a wrapper around <Outlet />.
 */
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Gamepad2, Trophy, Coins, User, LogOut, Menu, X,
  Bell, Gift, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const NAV = [
  { name: 'Lobby',       path: '/lobby',       icon: Home },
  { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  { name: 'Coin Store',  path: '/coin-store',  icon: Coins },
  { name: 'Profile',     path: '/profile',     icon: User },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn:  () => axios.get('/wallet/balance').then(r => r.data),
    refetchInterval: 8000,
  });

  const balance = balanceData?.balance ?? 0;

  return (
    <div className="min-h-screen bg-casino-bg flex text-gray-200 font-sans overflow-x-hidden">

      {/* ── Mobile Overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between shrink-0 border-b border-gray-800">
          <Link to="/lobby" className="font-display text-2xl text-brand-accent tracking-widest" onClick={() => setSidebarOpen(false)}>
            🎰 ROYALBET
          </Link>
          <button className="md:hidden text-gray-500 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ name, path, icon: Icon }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <Link
                key={name}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all
                  ${active
                    ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Icon size={18} className={active ? 'text-brand-accent' : ''} />
                {name}
                {active && <ChevronRight size={14} className="ml-auto text-brand-accent/60" />}
              </Link>
            );
          })}

          {/* Games section */}
          <div className="pt-4 pb-1 px-4">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Games</p>
          </div>
          {[
            { name: 'Slots',     path: '/game/slots',     icon: '🎰' },
            { name: 'Crash',     path: '/game/crash',     icon: '🚀' },
            { name: 'Roulette',  path: '/game/roulette',  icon: '🎡' },
            { name: 'Blackjack', path: '/game/blackjack', icon: '🃏' },
            { name: 'Poker',     path: '/game/poker',     icon: '♠️' },
          ].map(({ name, path, icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={name}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all text-sm
                  ${active
                    ? 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20'
                    : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200'
                  }`}
              >
                <span className="text-base">{icon}</span> {name}
              </Link>
            );
          })}
        </nav>

        {/* Wallet mini-card */}
        <div className="p-4 shrink-0 border-t border-gray-800">
          <div className="bg-gradient-to-br from-gray-800 to-black border border-gray-700 rounded-2xl p-4 text-center">
            <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">Wallet</p>
            <div className="flex items-center justify-center gap-2">
              <Coins size={18} className="text-brand-accent" />
              <span className="font-display text-2xl text-white">{balance.toLocaleString()}</span>
            </div>
            <Link
              to="/coin-store"
              className="mt-3 block w-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              + Buy Tokens
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Sticky Topbar */}
        <header className="sticky top-0 z-30 bg-gray-900/90 backdrop-blur-md border-b border-gray-800 h-16 flex items-center px-4 gap-4 shrink-0">
          {/* Hamburger (mobile) */}
          <button
            className="md:hidden text-gray-400 hover:text-white transition"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>

          <span className="md:hidden font-display text-xl text-brand-accent">ROYALBET</span>

          <div className="flex-1" />

          {/* Daily bonus */}
          <Link
            to="/coin-store"
            className="hidden sm:flex items-center gap-2 bg-yellow-500/10 text-brand-accent border border-brand-accent/30 rounded-full px-4 py-1.5 text-sm font-bold hover:bg-brand-accent/20 transition-colors"
          >
            <Gift size={15} /> Daily Bonus
          </Link>

          {/* Balance pill */}
          <Link
            to="/coin-store"
            className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-4 py-1.5 hover:border-brand-accent/40 transition-colors"
          >
            <Coins size={16} className="text-brand-accent" />
            <span className="font-bold font-mono text-white text-sm">{balance.toLocaleString()}</span>
          </Link>

          {/* Notifications */}
          <button className="relative text-gray-400 hover:text-white transition-colors hidden sm:block">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-gray-900 animate-pulse" />
          </button>

          {/* Avatar Menu */}
          <div className="relative">
            <button
              className="w-9 h-9 bg-gradient-to-br from-brand-accent to-yellow-600 rounded-full p-0.5 cursor-pointer"
              onClick={() => setUserMenuOpen(v => !v)}
            >
              <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold text-white">
                {(user?.name || 'U')[0].toUpperCase()}
              </div>
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl py-2 z-50"
                >
                  <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-sm font-bold text-white truncate">{user?.name || 'Player'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <User size={15} /> Profile
                  </Link>
                  <Link
                    to="/coin-store"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <Coins size={15} /> Wallet
                  </Link>
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors border-t border-gray-800 mt-1"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
