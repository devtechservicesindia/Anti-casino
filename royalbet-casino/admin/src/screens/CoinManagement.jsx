/**
 * admin/src/screens/CoinManagement.jsx
 * Search users → view balance → Add / Deduct coins → view history.
 * Uses the shared api.js axios instance (baseURL: /api/v1/admin).
 */

import { useState, useCallback } from 'react';
import { Search, PlusCircle, MinusCircle, RefreshCw, Coins, User, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function badge(type) {
  const map = {
    BONUS: 'bg-green-500/15 text-green-400 border-green-500/20',
    SPEND: 'bg-red-500/15 text-red-400 border-red-500/20',
    PURCHASE: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    REFUND: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  };
  return map[type] || 'bg-gray-700 text-gray-300 border-gray-600';
}

function fmt(n) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── main component ────────────────────────────────────────────────────────────
export default function CoinManagement() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState(null); // selected user

  const [adjType,   setAdjType]   = useState('ADD');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNote,   setAdjNote]   = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const [history,   setHistory]   = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage,  setHistPage]  = useState(1);
  const [loadingHist, setLoadingHist] = useState(false);

  // ── search ──────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get('/coins/search', { params: { q: query.trim() } });
      setResults(data.users || []);
      if (!data.users?.length) toast('No users found', { icon: '🔍' });
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [query]);

  // ── select user → load history ──────────────────────────────────────────────
  const selectUser = useCallback(async (user, page = 1) => {
    setSelected(user);
    setAdjAmount('');
    setAdjNote('');
    setHistPage(page);
    setLoadingHist(true);
    try {
      const { data } = await api.get(`/coins/history/${user.id}`, { params: { page, limit: 10 } });
      setHistory(data.transactions || []);
      setHistTotal(data.total || 0);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setLoadingHist(false);
    }
  }, []);

  // ── adjust coins ─────────────────────────────────────────────────────────────
  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const amt = parseFloat(adjAmount);
    if (!adjAmount || isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid positive amount');
      return;
    }
    setAdjusting(true);
    try {
      const { data } = await api.post('/coins/adjust', {
        userId: selected.id,
        amount: amt,
        type:   adjType,
        note:   adjNote.trim() || undefined,
      });
      toast.success(data.message || 'Success');
      // Refresh user balance in result list
      const updatedUser = { ...selected, wallet: { balance: data.newBalance } };
      setSelected(updatedUser);
      setResults(prev => prev.map(u => u.id === selected.id ? updatedUser : u));
      setAdjAmount('');
      setAdjNote('');
      // Reload history
      selectUser(updatedUser, 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Adjustment failed');
    } finally {
      setAdjusting(false);
    }
  };

  const totalPages = Math.ceil(histTotal / 10);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 min-h-screen text-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
          <Coins size={18} className="text-yellow-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Coin Management</h1>
          <p className="text-xs text-gray-500">Search users · adjust balances · view history</p>
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email or user ID…"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-4 py-2.5 bg-yellow-400 text-black text-sm font-bold rounded-xl hover:bg-yellow-300 disabled:opacity-60 transition flex items-center gap-2"
        >
          {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </form>

      {/* Results grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {results.map(user => (
            <button
              key={user.id}
              onClick={() => selectUser(user)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selected?.id === user.id
                  ? 'bg-yellow-400/10 border-yellow-400/30'
                  : 'bg-gray-900/70 border-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-black text-yellow-400">
                  {user.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                </div>
                {user.role === 'ADMIN' && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/20">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Balance</span>
                <span className="text-sm font-black text-yellow-400">
                  🪙 {fmt(user.wallet?.balance ?? 0)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected user panel */}
      {selected && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Adjust form */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <User size={15} className="text-yellow-400" />
              <h2 className="text-sm font-black text-white">
                Adjust Coins — {selected.name}
              </h2>
            </div>

            <div className="flex items-center justify-between mb-4 p-3 bg-gray-800/60 rounded-xl">
              <span className="text-xs text-gray-400">Current Balance</span>
              <span className="text-lg font-black text-yellow-400">🪙 {fmt(selected.wallet?.balance ?? 0)}</span>
            </div>

            <form onSubmit={handleAdjust} className="space-y-4">
              {/* ADD / DEDUCT toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-700">
                {['ADD', 'DEDUCT'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdjType(t)}
                    className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 transition ${
                      adjType === t
                        ? t === 'ADD'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                        : 'bg-gray-900 text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {t === 'ADD' ? <PlusCircle size={14} /> : <MinusCircle size={14} />}
                    {t === 'ADD' ? 'Add Coins' : 'Deduct Coins'}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={adjAmount}
                  onChange={e => setAdjAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Note <span className="text-gray-600">(optional)</span></label>
                <input
                  type="text"
                  value={adjNote}
                  onChange={e => setAdjNote(e.target.value)}
                  placeholder="Reason for adjustment…"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 transition"
                />
              </div>

              {/* Deduct warning */}
              {adjType === 'DEDUCT' && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-300">
                    This will permanently deduct coins from the user's wallet. The action is logged.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={adjusting}
                className={`w-full py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition ${
                  adjType === 'ADD'
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : 'bg-red-500 hover:bg-red-400 text-white'
                } disabled:opacity-60`}
              >
                {adjusting
                  ? <RefreshCw size={14} className="animate-spin" />
                  : adjType === 'ADD' ? <PlusCircle size={14} /> : <MinusCircle size={14} />}
                {adjusting ? 'Processing…' : adjType === 'ADD' ? 'Add Coins' : 'Deduct Coins'}
              </button>
            </form>
          </div>

          {/* Transaction history */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-yellow-400" />
                <h2 className="text-sm font-black text-white">Transaction History</h2>
              </div>
              <span className="text-xs text-gray-500">{histTotal} records</span>
            </div>

            {loadingHist ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw size={20} className="animate-spin text-yellow-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-gray-600 text-sm">No transactions yet</div>
            ) : (
              <>
                <div className="space-y-2">
                  {history.map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-start justify-between gap-3 p-3 bg-gray-800/50 rounded-xl"
                    >
                      <div className="min-w-0">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge(tx.type)}`}>
                          {tx.type}
                        </span>
                        {tx.note && (
                          <p className="text-xs text-gray-500 truncate mt-1">{tx.note}</p>
                        )}
                        <p className="text-[10px] text-gray-600 mt-0.5">{timeAgo(tx.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-black flex-shrink-0 ${
                        tx.type === 'SPEND' ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {tx.type === 'SPEND' ? '−' : '+'}{fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => { const p = histPage - 1; setHistPage(p); selectUser(selected, p); }}
                      disabled={histPage <= 1}
                      className="text-xs text-gray-400 hover:text-white disabled:opacity-40 transition"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-500">Page {histPage} / {totalPages}</span>
                    <button
                      onClick={() => { const p = histPage + 1; setHistPage(p); selectUser(selected, p); }}
                      disabled={histPage >= totalPages}
                      className="text-xs text-gray-400 hover:text-white disabled:opacity-40 transition"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
