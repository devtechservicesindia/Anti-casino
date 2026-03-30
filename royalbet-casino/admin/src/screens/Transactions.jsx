import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api.js';
import { Download } from 'lucide-react';

const TYPES = ['', 'PURCHASE', 'BONUS', 'SPEND', 'WITHDRAWAL'];

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['adminTxns', page, type, dateFrom, dateTo],
    queryFn:  () => {
      const params = new URLSearchParams({ page, limit: 25 });
      if (type)     params.set('type', type);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      return api.get(`/transactions?${params}`).then(r => r.data);
    },
    keepPreviousData: true,
  });

  const exportCSV = () => {
    const txns = data?.transactions || [];
    const header = 'ID,User,Email,Type,Amount,Status,Note,Date';
    const rows = txns.map(t =>
      `${t.id},${t.user?.name || ''},${t.user?.email || ''},${t.type},${t.amount},${t.status},"${t.note || ''}",${new Date(t.createdAt).toISOString()}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `transactions_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const txns = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Transactions</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} total</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 text-sm font-bold transition cursor-pointer border border-yellow-400/20">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 cursor-pointer">
          {TYPES.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400" />
        <button onClick={() => { setType(''); setDateFrom(''); setDateTo(''); setPage(1); }}
          className="px-3 py-2 rounded-xl bg-gray-800 text-xs text-gray-400 hover:bg-gray-700 transition cursor-pointer">Clear</button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['User', 'Type', 'Amount', 'Status', 'Note', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-bold uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-12 text-gray-600">Loading...</td></tr>}
            {txns.map(t => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{t.user?.name || '—'}</p>
                  <p className="text-xs text-gray-500">{t.user?.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    t.type === 'PURCHASE' ? 'bg-blue-500/10 text-blue-400' :
                    t.type === 'BONUS'    ? 'bg-green-500/10 text-green-400' :
                    t.type === 'SPEND'    ? 'bg-red-500/10 text-red-400' :
                    'bg-gray-500/10 text-gray-400'}`}>{t.type}</span>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-yellow-400">{Number(t.amount).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${t.status === 'SUCCESS' ? 'text-green-400' : t.status === 'FAILED' ? 'text-red-400' : 'text-yellow-400'}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{t.note}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">{total} records</p>
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
