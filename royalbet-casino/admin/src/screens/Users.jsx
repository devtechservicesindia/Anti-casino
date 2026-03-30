import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api.js';
import toast from 'react-hot-toast';
import { Search, Ban, Wallet, X, AlertTriangle } from 'lucide-react';

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-yellow-400 shrink-0" />
          <p className="text-white font-bold text-sm">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 text-sm font-bold transition cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 text-sm font-bold transition cursor-pointer">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function UserModal({ user, onClose }) {
  const qc = useQueryClient();
  const [adjustAmt, setAdjustAmt] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [confirm, setConfirm] = useState(null); // { type, message, action }

  const banMutation = useMutation({
    mutationFn: () => api.put(`/users/${user.id}/ban`),
    onSuccess: () => { toast.success(user.isBanned ? 'User unbanned' : 'User banned'); qc.invalidateQueries(['adminUsers']); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });
  const adjustMutation = useMutation({
    mutationFn: () => api.put(`/users/${user.id}/adjust-balance`, { amount: Number(adjustAmt), reason: adjustReason }),
    onSuccess: d => { toast.success(`Balance adjusted. New balance: ${d.data.newBalance}`); qc.invalidateQueries(['adminUsers']); onClose(); },
    onError: e => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <>
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={() => { confirm.action(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center font-black text-yellow-400 text-lg">
                {(user.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{user.name}</h3>
                <p className="text-xs text-gray-500">{user.email}</p>
                <p className="text-xs text-gray-600">{user.phone || 'No phone'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition cursor-pointer"><X size={18} /></button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-black/40 rounded-xl p-3 text-center">
              <p className="text-base font-black text-yellow-400">{user.balance?.toLocaleString() || 0}</p>
              <p className="text-[10px] text-gray-500">Balance</p>
            </div>
            <div className="bg-black/40 rounded-xl p-3 text-center">
              <p className="text-base font-black text-white">{user.role}</p>
              <p className="text-[10px] text-gray-500">Role</p>
            </div>
            <div className="bg-black/40 rounded-xl p-3 text-center">
              <p className={`text-base font-black ${user.isBanned ? 'text-red-400' : 'text-green-400'}`}>{user.isBanned ? 'BANNED' : 'ACTIVE'}</p>
              <p className="text-[10px] text-gray-500">Status</p>
            </div>
          </div>

          {/* Game sessions */}
          {user.gameSessions?.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Last 20 Sessions</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {user.gameSessions.map(s => (
                  <div key={s.id} className="flex justify-between text-xs text-gray-400">
                    <span>{s.gameType}</span>
                    <span>Bet: {Number(s.betAmount).toLocaleString()}</span>
                    <span className={Number(s.winAmount) > 0 ? 'text-green-400' : 'text-gray-600'}>Win: {Number(s.winAmount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjust balance */}
          <div className="bg-black/30 rounded-xl p-4 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Adjust Balance</p>
            <div className="flex gap-2 mb-2">
              <input
                type="number" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)}
                placeholder="±amount (max ±10000)"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
              />
            </div>
            <input
              type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
              placeholder="Reason (required)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 mb-2"
            />
            <button
              onClick={() => setConfirm({
                message: `Adjust balance by ${adjustAmt} for "${adjustReason}"?`,
                action:  () => adjustMutation.mutate(),
              })}
              disabled={!adjustAmt || !adjustReason}
              className="w-full py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-bold transition cursor-pointer disabled:opacity-40"
            >
              <Wallet size={12} className="inline mr-1.5" />Apply Adjustment
            </button>
          </div>

          {/* Ban/Unban */}
          <button
            onClick={() => setConfirm({
              message: `${user.isBanned ? 'Unban' : 'Ban'} ${user.name}?`,
              action:  () => banMutation.mutate(),
            })}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition cursor-pointer
              ${user.isBanned ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'}`}
          >
            <Ban size={14} className="inline mr-1.5" />
            {user.isBanned ? 'Unban User' : 'Ban User'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Users() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailUser, setDetailUser] = useState(null);

  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(window._st);
    window._st = setTimeout(() => { setDebounced(val); setPage(1); }, 400);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', debouncedSearch, page],
    queryFn:  () => api.get(`/users?search=${debouncedSearch}&page=${page}&limit=20`).then(r => r.data),
    keepPreviousData: true,
  });

  const handleRowClick = async (user) => {
    try {
      const { data } = await api.get(`/users/${user.id}`);
      setDetailUser(data);
    } catch {
      setDetailUser(user);
    }
  };

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6">
      {detailUser && <UserModal user={detailUser} onClose={() => setDetailUser(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Users</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} total users</p>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search name / email / phone..."
            className="pl-9 pr-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm text-white outline-none focus:border-yellow-400 w-72"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-bold uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Balance</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-bold uppercase tracking-wider">Joined</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="text-center py-12 text-gray-600">Loading...</td></tr>
            )}
            {users.map(u => (
              <tr
                key={u.id}
                onClick={() => handleRowClick(u)}
                className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                      {(u.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-yellow-400 font-bold">{u.balance.toLocaleString()} 🪙</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.isBanned ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                    {u.isBanned ? 'Banned' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">{total} users</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 hover:bg-gray-700 disabled:opacity-30 cursor-pointer">←</button>
              <span className="px-3 py-1.5 text-xs text-gray-500">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 hover:bg-gray-700 disabled:opacity-30 cursor-pointer">→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
