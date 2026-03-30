import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { io } from 'socket.io-client';
import { ArrowLeft, Users, Coins, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../store/AuthContext';

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

export default function PokerLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [balance, setBalance] = useState(0);
  const [buyIn, setBuyIn] = useState(500);
  const [selectedTable, setSelectedTable] = useState(null);
  const [joining, setJoining] = useState(false);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await axios.get('/wallet/balance')).data,
  });
  useEffect(() => { if (balanceData) setBalance(balanceData.balance); }, [balanceData]);

  // Fetch tables via socket
  useEffect(() => {
    const s = getSocket();
    s.emit('poker:tables');
    s.on('poker:tables', (data) => setTables(data));
    return () => { s.off('poker:tables'); };
  }, []);

  const handleJoin = (table) => {
    setSelectedTable(table);
    setBuyIn(table.minBuyIn);
  };

  const confirmJoin = () => {
    if (joining) return;
    setJoining(true);
    navigate(`/game/poker/table/${selectedTable.tableId}?buyIn=${buyIn}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-gray-200 p-6 font-sans">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/lobby" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold">
            <ArrowLeft size={20} /> LOBBY
          </Link>
          <h1 className="text-3xl font-black text-brand-accent tracking-wider">TEXAS HOLD'EM</h1>
          <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5 border border-gray-700">
            <span>🪙</span>
            <span className="font-mono font-bold">{balance.toLocaleString()}</span>
          </div>
        </div>

        {/* Table List */}
        <div className="space-y-3">
          {tables.length === 0 && (
            <p className="text-gray-600 text-center py-12">Loading tables...</p>
          )}
          {tables.map(t => (
            <div key={t.tableId} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between hover:border-gray-700 transition">
              <div>
                <h3 className="text-lg font-bold text-white">{t.name}</h3>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><Users size={14} /> {t.playerCount}/{t.maxPlayers}</span>
                  <span className="flex items-center gap-1"><Coins size={14} /> Buy-in: {t.minBuyIn}–{t.maxBuyIn}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    t.phase === 'WAITING' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                  }`}>
                    {t.phase === 'WAITING' ? 'OPEN' : 'IN PROGRESS'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleJoin(t)}
                disabled={t.playerCount >= t.maxPlayers}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-b from-brand-accent to-yellow-600 text-black font-bold shadow-[0_4px_0_#b45309] hover:brightness-110 transition active:translate-y-0.5 disabled:opacity-40 cursor-pointer"
              >
                <Play size={16} /> JOIN
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Buy-in Modal */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-1">{selectedTable.name}</h3>
            <p className="text-sm text-gray-500 mb-4">
              Buy-in: {selectedTable.minBuyIn}–{selectedTable.maxBuyIn} tokens
            </p>
            <label className="text-sm text-gray-400 font-bold mb-1 block">Your Buy-in</label>
            <input
              type="number"
              value={buyIn}
              min={selectedTable.minBuyIn}
              max={Math.min(selectedTable.maxBuyIn, balance)}
              onChange={e => setBuyIn(Math.max(selectedTable.minBuyIn, Math.min(selectedTable.maxBuyIn, Number(e.target.value))))}
              className="w-full bg-black/40 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono font-bold text-lg mb-4 outline-none focus:border-brand-accent"
            />
            <div className="flex gap-3">
              <button onClick={() => setSelectedTable(null)} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700 transition cursor-pointer">
                CANCEL
              </button>
              <button
                onClick={confirmJoin}
                disabled={buyIn > balance || joining}
                className="flex-1 py-3 rounded-xl bg-gradient-to-b from-green-500 to-green-700 text-white font-bold shadow-[0_4px_0_#15803d] hover:brightness-110 transition active:translate-y-0.5 disabled:opacity-40 cursor-pointer"
              >
                {joining ? 'JOINING...' : 'SIT DOWN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
