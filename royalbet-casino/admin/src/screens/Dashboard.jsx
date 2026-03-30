import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api.js';
import { Users, DollarSign, Zap, TrendingUp, RefreshCw } from 'lucide-react';

function MetricCard({ label, value, icon: Icon, color, prefix = '', suffix = '' }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-black text-white">{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs">
        <p className="text-gray-400 mb-1">{label}</p>
        <p className="text-yellow-400 font-bold">{payload[0].value.toLocaleString()} tokens</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [recentTxns, setRecentTxns] = useState([]);
  const intervalRef = useRef(null);

  const { data: summary } = useQuery({
    queryKey: ['adminSummary'],
    queryFn:  () => api.get('/revenue/summary').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: dailyData } = useQuery({
    queryKey: ['adminRevDaily'],
    queryFn:  () => api.get('/revenue/daily').then(r => r.data),
  });

  const fetchTxns = async () => {
    try {
      const { data } = await api.get('/transactions?limit=8');
      setRecentTxns(data.transactions || []);
    } catch {}
  };

  useEffect(() => {
    fetchTxns();
    intervalRef.current = setInterval(fetchTxns, 30_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const chartData = (dailyData || []).map(d => ({
    date:    new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenue: d.revenue,
  }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back — here's what's happening today</p>
        </div>
        <span className="text-xs text-gray-500">{new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="New Users Today"    value={summary?.usersToday  ?? '—'} icon={Users}      color="bg-blue-500/20 border border-blue-500/30 rounded-xl" />
        <MetricCard label="Revenue Today"      value={summary?.today       ?? '—'} icon={DollarSign} color="bg-yellow-500/20 border border-yellow-500/30 rounded-xl"  prefix="🪙 " />
        <MetricCard label="Active Players"     value={summary?.recentActive ?? '—'} icon={Zap}        color="bg-green-500/20 border border-green-500/30 rounded-xl"  />
        <MetricCard label="Month Revenue"      value={summary?.month        ?? '—'} icon={TrendingUp}  color="bg-purple-500/20 border border-purple-500/30 rounded-xl" prefix="🪙 " />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue — Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="revenue" fill="#f5c842" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent transactions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Recent Transactions</h2>
            <button onClick={fetchTxns} className="text-gray-600 hover:text-gray-300 transition cursor-pointer"><RefreshCw size={13} /></button>
          </div>
          <div className="space-y-2">
            {recentTxns.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <p className="text-gray-300 truncate font-medium">{t.user?.name || '—'}</p>
                  <p className="text-gray-600 truncate">{t.note?.slice(0, 30)}</p>
                </div>
                <span className={`font-bold shrink-0 ml-2 ${t.type === 'PURCHASE' || t.type === 'BONUS' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.type === 'SPEND' ? '-' : '+'}{Number(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
            {recentTxns.length === 0 && <p className="text-gray-600 text-xs text-center py-4">No transactions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
