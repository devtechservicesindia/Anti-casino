import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../store/AuthContext';
import { Volume2, VolumeX, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SYMBOLS = ['💎','⭐','7️⃣','👑','🍒','🔔','🍋','🍊'];
const SYMBOL_MAP = { 0:'💎',1:'⭐',2:'7️⃣',3:'👑',4:'🍒',5:'🔔',6:'🍋',7:'🍊' };
const BET_AMOUNTS = [10, 25, 50, 100, 500];

function randomSymbols(count = 20) {
  return Array.from({ length: count }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
}

export default function SlotsGame() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(25);
  const [isSpinning, setIsSpinning] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [message, setMessage] = useState({ text: 'Press SPIN to play! 🎰', win: false });
  const [muted, setMuted] = useState(true);
  const [pfData, setPfData] = useState(null);
  const [pfOpen, setPfOpen] = useState(false);
  const [bigWin, setBigWin] = useState(null);
  const [reelSymbols, setReelSymbols] = useState([
    randomSymbols(), randomSymbols(), randomSymbols()
  ]);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [winLines, setWinLines] = useState([]);
  const autoSpinRef = useRef(false);

  const { data: jackpotData } = useQuery({
    queryKey: ['slots-jackpot'],
    queryFn: async () => (await axios.get('/games/slots/jackpot')).data,
    refetchInterval: 3000,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await axios.get('/wallet/balance')).data,
    refetchInterval: 5000,
  });

  useEffect(() => { if (balanceData) setBalance(balanceData.balance ?? 0); }, [balanceData]);

  const spinMutation = useMutation({
    mutationFn: (amount) => axios.post('/games/slots/spin', { betAmount: amount }).then(r => r.data),
    onSuccess: handleSpinResponse,
    onError: (err) => {
      setMessage({ text: err.response?.data?.error || 'Spin failed!', win: false });
      setIsSpinning(false);
      setSpinning([false, false, false]);
      autoSpinRef.current = false;
      setAutoSpin(false);
    }
  });

  function handleSpinResponse(data) {
    const { grid, winAmount, winningLines, newBalance, serverSeed, clientSeed, nonce } = data;
    if (newBalance !== undefined) setBalance(newBalance);
    queryClient.invalidateQueries(['balance']);

    // Stop reels one by one with staggered delay
    [0, 1, 2].forEach(col => {
      setTimeout(() => {
        const colSyms = [...randomSymbols(17), SYMBOL_MAP[grid[0][col]], SYMBOL_MAP[grid[1][col]], SYMBOL_MAP[grid[2][col]]];
        setReelSymbols(prev => { const n = [...prev]; n[col] = colSyms; return n; });
        setSpinning(prev => { const n = [...prev]; n[col] = false; return n; });

        if (col === 2) {
          setIsSpinning(false);
          setPfData({ serverSeed, clientSeed, nonce });
          setWinLines(winningLines || []);
          if (winAmount > 0) {
            setMessage({ text: `🎉 +${winAmount.toLocaleString()} coins won!`, win: true });
            if (winAmount >= bet * 20) setBigWin({ amount: winAmount, type: 'JACKPOT' });
            else if (winAmount >= bet * 5) setBigWin({ amount: winAmount, type: 'BIG' });
          } else {
            setMessage({ text: 'No win — try again! 🎰', win: false });
          }
          if (autoSpinRef.current) {
            setTimeout(() => { if (autoSpinRef.current) doSpin(); }, 1200);
          }
        }
      }, 500 + col * 400);
    });
  }

  function doSpin() {
    if (balance < bet) { autoSpinRef.current = false; setAutoSpin(false); return; }
    setIsSpinning(true);
    setWinLines([]);
    setMessage({ text: 'Spinning... 🎰', win: false });
    setSpinning([true, true, true]);
    spinMutation.mutate(bet);
  }

  const handleSpinClick = useCallback(() => {
    if (isSpinning || balance < bet) return;
    doSpin();
  }, [isSpinning, balance, bet]);

  const toggleAuto = () => {
    const next = !autoSpin;
    setAutoSpin(next);
    autoSpinRef.current = next;
    if (next && !isSpinning) doSpin();
  };

  const winPaylines = winLines.map(wl => wl.payline);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d0018] to-[#1a0033] text-gray-100 flex flex-col items-center px-4 py-6">
      {/* Back */}
      <button onClick={() => navigate('/lobby')} className="self-start flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition">
        <ArrowLeft size={18}/> Lobby
      </button>

      <div className="w-full max-w-lg">
        {/* Header + Jackpot */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-black text-yellow-400 tracking-widest drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">
            ROYAL JEWELS 👑
          </h1>
          <div className="mt-2 inline-flex items-center gap-2 bg-black/50 border border-yellow-400/20 rounded-full px-6 py-1.5">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Progressive Jackpot</span>
            <span className="font-mono text-lg text-green-400 font-bold">
              🪙 {jackpotData?.jackpot ? Number(jackpotData.jackpot).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '1,000,000'}
            </span>
          </div>
        </div>

        {/* Machine */}
        <div className="bg-gradient-to-b from-purple-950 to-black rounded-3xl border-2 border-yellow-400/40 shadow-[0_0_60px_rgba(147,51,234,0.3)] overflow-hidden">
          
          {/* Mute */}
          <div className="flex justify-end px-4 pt-4">
            <button onClick={() => setMuted(!muted)} className="text-gray-500 hover:text-white transition">
              {muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
            </button>
          </div>

          {/* Reels */}
          <div className="flex justify-center px-6 pb-4">
            <div className="flex gap-3 bg-black/70 rounded-2xl p-4 border border-white/10 shadow-inner">
              {[0, 1, 2].map(col => (
                <div key={col} className="relative" style={{ width: 90, height: 270, overflow: 'hidden' }}>
                  {/* Shading overlays */}
                  <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none"/>
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none"/>
                  {/* Win line middle highlight */}
                  <div className={`absolute inset-x-0 z-0 transition-all duration-300 pointer-events-none ${
                    winPaylines.includes('centre') ? 'top-[90px] h-[90px] bg-yellow-400/20 border-y-2 border-yellow-400' : 'hidden'
                  }`}/>

                  {/* Spinning strip */}
                  <div
                    className={`flex flex-col items-center ${spinning[col] ? 'animate-reel-spin' : ''}`}
                    style={{ transition: spinning[col] ? 'none' : 'transform 0.3s ease-out' }}
                  >
                    {(reelSymbols[col] || randomSymbols()).slice(-6).map((sym, j) => (
                      <div key={j} className="w-full h-[90px] flex items-center justify-center text-5xl select-none">
                        {sym}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Win message */}
          <div className={`mx-6 mb-4 py-3 rounded-xl text-center font-bold text-lg border transition-all ${
            message.win ? 'bg-yellow-400/10 border-yellow-400/50 text-yellow-300' : 'bg-black/40 border-white/5 text-gray-300'
          }`}>
            {message.text}
          </div>

          {/* Controls */}
          <div className="bg-black/60 border-t border-white/10 px-6 py-5">
            {/* Balance + Bet */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400 text-sm">Balance: <span className="text-white font-mono font-bold">🪙 {balance.toLocaleString()}</span></span>
              <span className="text-gray-400 text-sm">Bet: <span className="text-yellow-400 font-mono font-bold">{bet}</span></span>
            </div>

            {/* Bet buttons */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {BET_AMOUNTS.map(amt => (
                <button key={amt} onClick={() => setBet(amt)} disabled={isSpinning || balance < amt}
                  className={`flex-1 min-w-[48px] py-1.5 rounded-lg text-sm font-bold transition ${
                    bet === amt ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(255,215,0,0.5)]'
                    : balance < amt ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-800 text-white hover:bg-gray-700'}`}>
                  {amt}
                </button>
              ))}
            </div>

            {/* Spin row */}
            <div className="flex gap-3">
              <button onClick={toggleAuto} disabled={false}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                  autoSpin ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(22,163,74,0.5)]' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {autoSpin ? '⏹ Stop Auto' : '▶ Auto'}
              </button>

              <button onClick={handleSpinClick} disabled={isSpinning || balance < bet}
                className={`flex-[2] py-3 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                  isSpinning ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : balance < bet ? 'bg-red-900/60 text-red-400 cursor-not-allowed'
                  : 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-black shadow-[0_4px_0_#92400e,0_8px_20px_rgba(255,215,0,0.4)] hover:brightness-110'
                }`}>
                {isSpinning ? '⏳ SPINNING' : '🎰 SPIN'}
              </button>

              <button onClick={() => setBet([...BET_AMOUNTS].reverse().find(a => balance >= a) || BET_AMOUNTS[0])}
                disabled={isSpinning}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700 transition">
                MAX
              </button>
            </div>
          </div>

          {/* Provably Fair */}
          {pfData && (
            <div className="border-t border-white/5">
              <button onClick={() => setPfOpen(!pfOpen)}
                className="w-full flex justify-between items-center px-6 py-3 text-xs text-gray-500 hover:text-gray-400 transition">
                <span>⚖️ Provably Fair</span>
                {pfOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
              </button>
              {pfOpen && (
                <div className="px-6 pb-4 font-mono text-[10px] text-gray-600 space-y-1 break-all">
                  <p><span className="text-gray-500">Server Seed:</span> {pfData.serverSeed}</p>
                  <p><span className="text-gray-500">Client Seed:</span> {pfData.clientSeed}</p>
                  <p><span className="text-gray-500">Nonce:</span> {pfData.nonce}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Big Win Modal */}
      {bigWin && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-yellow-900 to-black border-4 border-yellow-400 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(255,215,0,0.5)]">
            <div className="text-7xl mb-3 animate-bounce">{bigWin.type === 'JACKPOT' ? '👑' : '💎'}</div>
            <h2 className="font-black text-4xl text-white mb-2">{bigWin.type === 'JACKPOT' ? 'MEGA JACKPOT!' : 'BIG WIN!'}</h2>
            <p className="font-mono text-5xl text-yellow-400 font-bold mb-6">+{bigWin.amount.toLocaleString()} 🪙</p>
            <button onClick={() => setBigWin(null)} className="w-full bg-yellow-400 text-black font-black py-3 rounded-xl hover:bg-yellow-300 transition text-lg">
              COLLECT!
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes reelSpin {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-540px); }
        }
        .animate-reel-spin {
          animation: reelSpin 0.15s linear infinite;
        }
      `}</style>
    </div>
  );
}
