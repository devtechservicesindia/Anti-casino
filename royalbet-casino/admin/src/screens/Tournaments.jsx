import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api.js';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

const GAME_TYPES = ['SLOTS', 'ROULETTE', 'BLACKJACK', 'CRASH', 'POKER'];
const EMPTY_FORM = { name: '', gameType: 'SLOTS', entryFee: '', prizePool: '', maxPlayers: '', startTime: '', endTime: '' };

function TournamentForm({ initial = EMPTY_FORM, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 mb-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'name',       label: 'Name',        type: 'text',           colSpan: 'col-span-2' },
          { key: 'entryFee',   label: 'Entry Fee',   type: 'number' },
          { key: 'prizePool',  label: 'Prize Pool',  type: 'number' },
          { key: 'maxPlayers', label: 'Max Players', type: 'number' },
          { key: 'startTime',  label: 'Start Time',  type: 'datetime-local' },
          { key: 'endTime',    label: 'End Time',    type: 'datetime-local' },
        ].map(({ key, label, type, colSpan = '' }) => (
          <div key={key} className={colSpan}>
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">{label}</label>
            <input
              type={type} value={form[key]} onChange={e => set(key, e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-yellow-400"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">Game Type</label>
          <select value={form.gameType} onChange={e => set('gameType', e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 cursor-pointer">
            {GAME_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-400 text-sm font-bold hover:bg-gray-600 transition cursor-pointer">Cancel</button>
        <button onClick={() => onSubmit(form)} disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-sm font-bold hover:bg-yellow-400/20 transition cursor-pointer disabled:opacity-40">
          {loading ? 'Saving...' : 'Save Tournament'}
        </button>
      </div>
    </div>
  );
}

export default function Tournaments() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);

  const { data: tournaments } = useQuery({
    queryKey: ['adminTournaments'],
    queryFn:  () => api.get('/tournaments').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: form => api.post('/tournaments', {
      ...form, entryFee: Number(form.entryFee), prizePool: Number(form.prizePool), maxPlayers: Number(form.maxPlayers),
    }),
    onSuccess: () => { toast.success('Tournament created'); qc.invalidateQueries(['adminTournaments']); setShowForm(false); },
    onError:   e => toast.error(e.response?.data?.error || 'Error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, form }) => api.put(`/tournaments/${id}`, form),
    onSuccess: () => { toast.success('Tournament updated'); qc.invalidateQueries(['adminTournaments']); setEditing(null); },
    onError:   e => toast.error(e.response?.data?.error || 'Error'),
  });

  const cancelTournament = (id) => {
    if (!confirm('Cancel this tournament?')) return;
    updateMutation.mutate({ id, form: { status: 'CANCELLED' } });
  };

  const list = Array.isArray(tournaments) ? tournaments : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-white">Tournaments</h1>
          <p className="text-sm text-gray-500">{list.length} tournaments</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 text-sm font-bold hover:bg-yellow-400/20 transition cursor-pointer">
          <Plus size={14} /> New Tournament
        </button>
      </div>

      {showForm && (
        <TournamentForm
          onSubmit={f => createMutation.mutate(f)}
          onCancel={() => setShowForm(false)}
          loading={createMutation.isPending}
        />
      )}
      {editing && (
        <TournamentForm
          initial={editing}
          onSubmit={f => updateMutation.mutate({ id: editing.id, form: f })}
          onCancel={() => setEditing(null)}
          loading={updateMutation.isPending}
        />
      )}

      <div className="space-y-3">
        {list.map(t => (
          <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  t.status === 'LIVE'      ? 'bg-red-500/10 text-red-400' :
                  t.status === 'UPCOMING'  ? 'bg-blue-500/10 text-blue-400' :
                  t.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                  'bg-gray-500/10 text-gray-400'}`}>{t.status}</span>
                <span className="text-xs text-gray-500">{t.gameType}</span>
              </div>
              <h3 className="text-white font-bold">{t.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Entry: {Number(t.entryFee).toLocaleString()} 🪙 &nbsp;|&nbsp;
                Prize: {Number(t.prizePool).toLocaleString()} 🪙 &nbsp;|&nbsp;
                {t._count?.entries || t.entries?.length || 0}/{t.maxPlayers} players
              </p>
            </div>
            <div className="flex gap-2">
              {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                <>
                  <button onClick={() => setEditing(t)}
                    className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-400 hover:bg-gray-700 cursor-pointer">Edit</button>
                  <button onClick={() => cancelTournament(t.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 cursor-pointer">Cancel</button>
                </>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-gray-600 py-12">No tournaments yet</p>}
      </div>
    </div>
  );
}
