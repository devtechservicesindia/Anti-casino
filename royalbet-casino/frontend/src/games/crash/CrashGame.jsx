import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../../../store/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Socket singleton ─────────────────────────────────────────────────────────
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

// ─── Constants ────────────────────────────────────────────────────────────────
const BET_PRESETS = [10, 25, 50, 100, 250, 500, 1000];

export default function CrashGame() {
  const { user }      = useAuth();
  const queryClient   = useQueryClient();

  // State
  const [balance, setBalance]       = useState(0);
  const [betAmount, setBetAmount]   = useState(100);
  const [phase, setPhase]           = useState('WAITING');
  const [roundId, setRoundId]       = useState(null);
  const [multiplier, setMultiplier] = useState(1.00);
  const [crashPoint, setCrashPoint] = useState(null);
  const [countdown, setCountdown]   = useState(0);
  const [hasBet, setHasBet]         = useState(false);
  const [cashedOut, setCashedOut]    = useState(false);
  const [cashoutMult, setCashoutMult] = useState(null);
  const [history, setHistory]       = useState([]);
  const [liveBets, setLiveBets]     = useState({});
  const [message, setMessage]       = useState('');

  // Canvas
  const canvasRef     = useRef(null);
  const multipliersRef = useRef([]);  // array of multiplier points for graph
  const animFrameRef  = useRef(null);

  // Countdown timer
  const countdownRef  = useRef(null);

  // Balance query
  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: async () => (await axios.get('/wallet/balance')).data,
  });
  useEffect(() => { if (balanceData) setBalance(balanceData.balance); }, [balanceData]);

  // Fetch initial state + history
  useEffect(() => {
    axios.get('/games/crash/state').then(res => {
      const d = res.data;
      if (d.phase) {
        setPhase(d.phase);
        setRoundId(d.roundId);
        if (d.phase === 'RUNNING' && d.multiplier) setMultiplier(d.multiplier);
        if (d.phase === 'CRASHED' && d.crashPoint) setCrashPoint(d.crashPoint);
        if (d.bets) setLiveBets(d.bets);
      }
    }).catch(() => {});

    axios.get('/games/crash/history').then(res => {
      if (res.data.history) setHistory(res.data.history.slice(0, 20));
    }).catch(() => {});
  }, []);

  // ─── Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket();

    s.on('crash:betting', (data) => {
      setPhase('BETTING');
      setRoundId(data.roundId);
      setMultiplier(1.00);
      setCrashPoint(null);
      setHasBet(false);
      setCashedOut(false);
      setCashoutMult(null);
      setMessage('');
      multipliersRef.current = [];
      setLiveBets({});

      // Countdown
      const endsAt = data.bettingEndsAt;
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining <= 0) clearInterval(countdownRef.current);
      }, 200);
    });

    s.on('crash:start', (data) => {
      setPhase('RUNNING');
      setRoundId(data.roundId);
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    });

    s.on('crash:tick', (data) => {
      setMultiplier(data.multiplier);
      multipliersRef.current.push(data.multiplier);
    });

    s.on('crash:end', (data) => {
      setPhase('CRASHED');
      setCrashPoint(data.crashPoint);
      setMultiplier(data.crashPoint);

      // Add to history
      setHistory(prev => [
        { roundId: data.roundId, crashPoint: data.crashPoint, serverSeed: data.serverSeed },
        ...prev
      ].slice(0, 20));

      // If player had a bet and didn't cash out
      if (hasBet && !cashedOut) {
        setMessage('CRASHED! 💥');
      }

      // Refresh balance
      queryClient.invalidateQueries(['balance']);
    });

    s.on('crash:cashout', (data) => {
      setLiveBets(prev => {
        const updated = { ...prev };
        if (updated[data.userId]) {
          updated[data.userId] = {
            ...updated[data.userId],
            cashedOut: true,
            cashoutMult: data.multiplier,
          };
        }
        return updated;
      });
    });

    return () => {
      s.off('crash:betting');
      s.off('crash:start');
      s.off('crash:tick');
      s.off('crash:end');
      s.off('crash:cashout');
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [hasBet, cashedOut, queryClient]);

  // ─── Canvas Drawing ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      const points = multipliersRef.current;
      if (points.length < 2) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      // Scale: X = time, Y = multiplier
      const maxMult = Math.max(2, ...points) * 1.2;
      const xStep = W / Math.max(points.length - 1, 1);

      // Draw curve
      const isCrashed = phase === 'CRASHED';
      const gradient = ctx.createLinearGradient(0, H, 0, 0);
      if (isCrashed) {
        gradient.addColorStop(0, 'rgba(239,68,68,0.0)');
        gradient.addColorStop(1, 'rgba(239,68,68,0.3)');
      } else {
        gradient.addColorStop(0, 'rgba(34,197,94,0.0)');
        gradient.addColorStop(1, 'rgba(34,197,94,0.3)');
      }

      // Fill area under curve
      ctx.beginPath();
      ctx.moveTo(0, H);
      points.forEach((m, i) => {
        const x = i * xStep;
        const y = H - ((m - 1) / (maxMult - 1)) * H;
        ctx.lineTo(x, Math.max(0, y));
      });
      ctx.lineTo((points.length - 1) * xStep, H);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Stroke line
      ctx.beginPath();
      points.forEach((m, i) => {
        const x = i * xStep;
        const y = H - ((m - 1) / (maxMult - 1)) * H;
        if (i === 0) ctx.moveTo(x, Math.max(0, y));
        else ctx.lineTo(x, Math.max(0, y));
      });
      ctx.strokeStyle = isCrashed ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 3;
      ctx.shadowColor = isCrashed ? '#ef4444' : '#22c55e';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dot at tip
      const lastX = (points.length - 1) * xStep;
      const lastY = H - ((points[points.length - 1] - 1) / (maxMult - 1)) * H;
      ctx.beginPath();
      ctx.arc(lastX, Math.max(4, lastY), 5, 0, Math.PI * 2);
      ctx.fillStyle = isCrashed ? '#ef4444' : '#22c55e';
      ctx.fill();

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [phase]);

  // ─── Actions ──────────────────────────────────────────────────────────────
  const placeBet = async () => {
    if (phase !== 'BETTING' || hasBet || betAmount > balance) return;
    try {
      const res = await axios.post('/games/crash/bet', { amount: betAmount });
      setHasBet(true);
      setBalance(res.data.newBalance);
      setLiveBets(prev => ({
        ...prev,
        [user?.id]: { amount: betAmount, cashedOut: false, cashoutMult: null, username: user?.name || 'You' },
      }));
    } catch (err) {
      setMessage(err.response?.data?.error || 'Bet failed');
    }
  };

  const doCashout = async () => {
    if (phase !== 'RUNNING' || !hasBet || cashedOut) return;
    try {
      const res = await axios.post('/games/crash/cashout');
      setCashedOut(true);
      setCashoutMult(res.data.multiplier);
      setBalance(res.data.newBalance);
      setMessage(`Cashed out at ${res.data.multiplier}x — +${res.data.profit.toLocaleString()} 🪙`);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Cashout failed');
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const isRunning  = phase === 'RUNNING';
  const isCrashed  = phase === 'CRASHED';
  const isBetting  = phase === 'BETTING';
  const multColor  = isCrashed ? '#ef4444' : isRunning ? '#22c55e' : '#9ca3af';

  const betsArray = Object.entries(liveBets).map(([uid, b]) => ({ uid, ...b }));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a14] text-gray-200 flex flex-col items-center p-4 md:p-6 font-sans">
      {/* Header */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4">
        <Link to="/lobby" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold">
          <ArrowLeft size={20} /> LOBBY
        </Link>
        <h1 className="font-display text-3xl md:text-4xl text-brand-accent tracking-wider">CRASH 🚀</h1>
        <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5 border border-gray-700">
          <span className="text-brand-accent">🪙</span>
          <span className="font-mono font-bold text-white">{balance.toLocaleString()}</span>
        </div>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* LEFT: Graph + Controls */}
        <div className="space-y-4">
          {/* Graph Container */}
          <div className="relative bg-[#0d0d1a] border border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: 340 }}>
            <canvas
              ref={canvasRef}
              width={700}
              height={320}
              className="w-full h-full"
              style={{ display: 'block' }}
            />

            {/* Multiplier Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                {isBetting && (
                  <div>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mb-1">Next round in</p>
                    <p className="text-6xl font-display font-black text-white">{countdown}s</p>
                  </div>
                )}
                {isRunning && (
                  <p className="font-mono font-black text-white" style={{
                    fontSize: multiplier >= 10 ? 72 : 84,
                    color: multColor,
                    textShadow: `0 0 30px ${multColor}`,
                    transition: 'font-size 0.3s',
                  }}>
                    {multiplier.toFixed(2)}x
                  </p>
                )}
                {isCrashed && (
                  <div>
                    <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-1">CRASHED</p>
                    <p className="font-mono font-black text-red-500" style={{
                      fontSize: 72,
                      textShadow: '0 0 30px rgba(239,68,68,0.6)',
                    }}>
                      {crashPoint?.toFixed(2)}x
                    </p>
                  </div>
                )}
                {phase === 'WAITING' && (
                  <p className="text-gray-600 text-lg font-bold">Connecting...</p>
                )}
              </div>
            </div>

            {/* Message bar */}
            {message && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-sm text-brand-accent font-bold px-4 py-2 rounded-lg backdrop-blur-sm border border-brand-accent/20">
                {message}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Bet amount input */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm font-bold">BET</span>
                <div className="flex items-center bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setBetAmount(Math.max(10, betAmount / 2))}
                    className="px-3 py-2 text-gray-400 hover:text-white transition font-bold cursor-pointer"
                  >½</button>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(10, Number(e.target.value)))}
                    className="w-20 text-center bg-transparent text-white font-mono font-bold outline-none py-2 border-x border-gray-700"
                  />
                  <button
                    onClick={() => setBetAmount(Math.min(5000, betAmount * 2))}
                    className="px-3 py-2 text-gray-400 hover:text-white transition font-bold cursor-pointer"
                  >2×</button>
                </div>
              </div>

              {/* Quick chips */}
              <div className="flex gap-1 flex-wrap">
                {BET_PRESETS.map(v => (
                  <button
                    key={v}
                    onClick={() => setBetAmount(v)}
                    className={`px-2.5 py-1.5 rounded text-xs font-bold transition cursor-pointer
                      ${betAmount === v
                        ? 'bg-brand-accent text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  >{v}</button>
                ))}
              </div>

              {/* Action button */}
              <div className="ml-auto">
                {isBetting && !hasBet && (
                  <button
                    onClick={placeBet}
                    disabled={betAmount > balance}
                    className="px-8 py-3 rounded-xl font-bold text-lg bg-gradient-to-b from-brand-accent to-yellow-600 text-black shadow-[0_4px_0_#b45309,0_8px_16px_rgba(255,215,0,0.3)] hover:brightness-110 transition active:translate-y-0.5 cursor-pointer disabled:opacity-40"
                  >
                    BET {betAmount} 🪙
                  </button>
                )}
                {isBetting && hasBet && (
                  <div className="px-6 py-3 rounded-xl bg-green-900/30 border border-green-600/40 text-green-400 font-bold">
                    ✓ BET PLACED — {betAmount} 🪙
                  </div>
                )}
                {isRunning && hasBet && !cashedOut && (
                  <button
                    onClick={doCashout}
                    className="px-8 py-4 rounded-xl font-black text-xl bg-gradient-to-b from-green-500 to-green-700 text-white shadow-[0_4px_0_#15803d,0_8px_16px_rgba(34,197,94,0.4)] hover:brightness-110 transition active:translate-y-0.5 cursor-pointer animate-pulse"
                  >
                    CASH OUT @ {multiplier.toFixed(2)}x
                  </button>
                )}
                {isRunning && cashedOut && (
                  <div className="px-6 py-3 rounded-xl bg-green-900/30 border border-green-600/40 text-green-400 font-bold">
                    ✓ CASHED OUT @ {cashoutMult}x
                  </div>
                )}
                {isRunning && !hasBet && (
                  <div className="px-6 py-3 rounded-xl bg-gray-800 text-gray-500 font-bold text-sm">
                    WAITING FOR NEXT ROUND...
                  </div>
                )}
                {isCrashed && (
                  <div className="px-6 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold text-sm">
                    NEXT ROUND STARTING...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: History + Live Bets */}
        <div className="space-y-4">
          {/* Round History */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-widest">History</p>
            {history.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-4">No rounds yet</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <span
                    key={h.roundId || i}
                    className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold"
                    style={{
                      background: h.crashPoint >= 2 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: h.crashPoint >= 2 ? '#22c55e' : '#ef4444',
                      border: `1px solid ${h.crashPoint >= 2 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}
                  >
                    {h.crashPoint?.toFixed(2)}x
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Live Bets */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 uppercase font-bold mb-3 tracking-widest">
              Live Bets ({betsArray.length})
            </p>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {betsArray.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">No bets yet</p>
              ) : (
                betsArray.map((b, i) => (
                  <div key={b.uid || i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-black/30">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold">
                        {(b.username || '?')[0]}
                      </div>
                      <span className="text-gray-300 truncate max-w-[80px]">{b.username || 'Player'}</span>
                    </div>
                    <span className="text-gray-400 font-mono">{b.amount} 🪙</span>
                    {b.cashedOut ? (
                      <span className="text-green-400 font-bold text-xs">{b.cashoutMult}x ✓</span>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
