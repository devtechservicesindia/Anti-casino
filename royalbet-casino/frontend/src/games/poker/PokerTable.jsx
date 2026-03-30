import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../../store/AuthContext';

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

// ─── Card Display ─────────────────────────────────────────────────────────────
const SUIT_MAP   = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR = { s: '#e2e8f0', h: '#ef4444', d: '#ef4444', c: '#e2e8f0' };

function MiniCard({ card, faceDown = false, idx = 0 }) {
  if (faceDown || !card || !card.rank) {
    return (
      <div className="w-10 h-14 md:w-12 md:h-[68px] rounded-md bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600 flex items-center justify-center shadow-md" style={{ animation: `cardIn 0.3s ease-out ${idx * 0.1}s both` }}>
        <div className="w-6 h-8 border border-white/10 rounded-sm" />
      </div>
    );
  }
  return (
    <div
      className="w-10 h-14 md:w-12 md:h-[68px] rounded-md bg-gradient-to-br from-white to-gray-100 border border-gray-300 flex flex-col items-center justify-center shadow-md relative"
      style={{ color: SUIT_COLOR[card.suit] || '#333', animation: `cardIn 0.3s ease-out ${idx * 0.1}s both` }}
    >
      <span className="text-xs md:text-sm font-black leading-none">{card.rank}</span>
      <span className="text-sm md:text-base leading-none">{SUIT_MAP[card.suit] || card.suit}</span>
    </div>
  );
}

// ─── Seat positions around oval table ─────────────────────────────────────────
const SEAT_POSITIONS = [
  { top: '85%', left: '50%' },   // seat 0 — bottom center (player)
  { top: '70%', left: '10%' },   // seat 1 — left bottom
  { top: '25%', left: '5%'  },   // seat 2 — left top
  { top: '5%',  left: '30%' },   // seat 3 — top left
  { top: '5%',  left: '70%' },   // seat 4 — top right
  { top: '25%', left: '95%' },   // seat 5 — right top
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PokerTable() {
  const { tableId }     = useParams();
  const [searchParams]  = useSearchParams();
  const buyIn           = Number(searchParams.get('buyIn')) || 500;
  const { user }        = useAuth();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();

  const [gameState, setGameState] = useState(null);
  const [myCards, setMyCards]     = useState([]);
  const [message, setMessage]    = useState('');
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [timer, setTimer]        = useState(null);  // { userId, remaining, total }
  const [showdown, setShowdown]  = useState(null);
  const timerRef = useRef(null);

  const myUserId = user?.id || socket?.id;

  // ─── Socket setup ──────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket();

    // Join table
    s.emit('poker:join', { tableId, buyIn });

    // State updates
    s.on('poker:state', (data) => {
      setGameState(data);
      if (data.phase === 'SHOWDOWN') {
        // Keep showdown for visibility
      }
    });

    // Hole cards (private — match userId)
    s.on('poker:deal', (data) => {
      if (data.userId === myUserId) {
        setMyCards(data.holeCards);
      }
    });

    // Community cards
    s.on('poker:community', (data) => {
      setGameState(prev => prev ? { ...prev, communityCards: data.cards, phase: data.phase } : prev);
    });

    // Showdown reveal
    s.on('poker:showdown', (data) => {
      setShowdown(data);
    });

    // Winner
    s.on('poker:winner', (data) => {
      setMessage(`${data.username || 'Player'} wins ${data.amount} 🪙 — ${data.handName}`);
      setTimeout(() => { setMessage(''); setShowdown(null); setMyCards([]); }, 4000);
      queryClient.invalidateQueries(['balance']);
    });

    // Timer
    s.on('poker:timer', (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const endAt = data.startedAt + data.duration;
      timerRef.current = setInterval(() => {
        const rem = Math.max(0, endAt - Date.now());
        setTimer({ userId: data.userId, remaining: rem, total: data.duration });
        if (rem <= 0) clearInterval(timerRef.current);
      }, 200);
    });

    // Timer warning
    s.on('poker:timer-warning', () => {});

    // Errors
    s.on('poker:error', (data) => {
      setMessage(data.message);
      setTimeout(() => setMessage(''), 3000);
    });

    return () => {
      s.emit('poker:leave', { tableId });
      s.off('poker:state');
      s.off('poker:deal');
      s.off('poker:community');
      s.off('poker:showdown');
      s.off('poker:winner');
      s.off('poker:timer');
      s.off('poker:timer-warning');
      s.off('poker:error');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tableId, buyIn, myUserId, queryClient]);

  // ─── Derived state ─────────────────────────────────────────────────────
  const players        = gameState?.players || [];
  const communityCards = gameState?.communityCards || [];
  const pot            = gameState?.pot || 0;
  const phase          = gameState?.phase || 'WAITING';
  const currentIdx     = gameState?.currentPlayerIndex ?? -1;
  const dealerIdx      = gameState?.dealerIndex ?? -1;
  const bigBlind       = gameState?.bigBlind || 20;
  const currentBet     = gameState?.currentBet || 0;

  const myPlayer = players.find(p => p.userId === myUserId);
  const isMyTurn = currentIdx >= 0 && players[currentIdx]?.userId === myUserId;
  const toCall   = myPlayer ? currentBet - (myPlayer.currentBet || 0) : 0;

  // Reorder seats so current player is always seat 0 (bottom)
  const myIdx = players.findIndex(p => p.userId === myUserId);
  const orderedPlayers = [];
  if (myIdx >= 0) {
    for (let i = 0; i < players.length; i++) {
      orderedPlayers.push(players[(myIdx + i) % players.length]);
    }
  } else {
    orderedPlayers.push(...players);
  }

  // ─── Actions ───────────────────────────────────────────────────────────
  const doAction = (action, amount) => {
    getSocket().emit('poker:action', { tableId, action, amount });
  };

  const handleLeave = () => {
    getSocket().emit('poker:leave', { tableId });
    navigate('/game/poker');
  };

  // Timer progress for current player
  const timerPct = timer ? (timer.remaining / timer.total) * 100 : 100;
  const timerDanger = timer && timer.remaining < 10_000;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-gray-200 flex flex-col items-center p-4 font-sans">
      {/* Header */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-3">
        <Link to="/game/poker" className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm font-bold">
          <ArrowLeft size={18} /> TABLES
        </Link>
        <h1 className="text-xl md:text-2xl font-black text-brand-accent tracking-wider">{gameState?.name || 'POKER'}</h1>
        <button onClick={handleLeave} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition text-sm font-bold cursor-pointer">
          <LogOut size={18} /> LEAVE
        </button>
      </div>

      {/* Table */}
      <div className="w-full max-w-4xl relative" style={{ paddingBottom: '60%', minHeight: 400 }}>
        {/* Felt */}
        <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-[#1b5e20] via-[#145218] to-[#0d3b12] border-8 border-[#2d1810] shadow-[inset_0_0_80px_rgba(0,0,0,0.5),0_8px_32px_rgba(0,0,0,0.6)]" />

        {/* Pot */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
          <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">POT</span>
          <p className="text-2xl md:text-3xl font-black text-brand-accent">
            {pot > 0 ? `${pot.toLocaleString()} 🪙` : '—'}
          </p>
        </div>

        {/* Community Cards */}
        <div className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-10">
          {communityCards.map((c, i) => (
            <MiniCard key={i} card={c} idx={i} />
          ))}
          {/* Placeholder slots */}
          {Array.from({ length: Math.max(0, 5 - communityCards.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="w-10 h-14 md:w-12 md:h-[68px] rounded-md border border-dashed border-white/10" />
          ))}
        </div>

        {/* Message */}
        {message && (
          <div className="absolute top-[72%] left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg text-sm font-bold text-brand-accent z-20 backdrop-blur-sm whitespace-nowrap">
            {message}
          </div>
        )}

        {/* Phase */}
        {phase !== 'WAITING' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs text-gray-500 uppercase tracking-widest font-bold z-10">
            {phase}
          </div>
        )}

        {/* Seats */}
        {orderedPlayers.map((p, i) => {
          const pos = SEAT_POSITIONS[i] || SEAT_POSITIONS[0];
          const isActive = players[currentIdx]?.userId === p.userId;
          const isDealer = players[dealerIdx]?.userId === p.userId;
          const isMe   = p.userId === myUserId;
          const pCards = isMe ? myCards : (showdown?.players?.find(sp => sp.userId === p.userId)?.holeCards || []);
          const timerForSeat = (timer?.userId === p.userId && isActive);

          return (
            <div
              key={p.userId}
              className="absolute z-10"
              style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
            >
              {/* Timer bar */}
              {timerForSeat && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${timerPct}%`,
                      background: timerDanger ? '#ef4444' : '#22c55e',
                    }}
                  />
                </div>
              )}

              {/* Seat card */}
              <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all
                ${p.folded ? 'opacity-40 bg-gray-900/50 border-gray-800' :
                  isActive ? 'bg-gray-900/80 border-brand-accent shadow-[0_0_15px_rgba(255,215,0,0.3)]' :
                  'bg-gray-900/70 border-gray-700'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-bold
                  ${isMe ? 'bg-brand-accent text-black' : 'bg-gray-700 text-gray-300'}`}
                >
                  {(p.username || '?')[0].toUpperCase()}
                </div>

                {/* Name + chips */}
                <p className="text-[10px] md:text-xs font-bold truncate max-w-[70px]">
                  {isMe ? 'You' : (p.username || 'Player')}
                </p>
                <p className="text-[10px] md:text-xs font-mono text-gray-400">{p.chips} 🪙</p>

                {/* Dealer chip */}
                {isDealer && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center shadow">D</span>
                )}

                {/* Current bet */}
                {p.currentBet > 0 && (
                  <span className="text-[9px] text-brand-accent font-bold">{p.currentBet}</span>
                )}

                {/* All-in badge */}
                {p.allIn && <span className="text-[9px] text-red-400 font-bold">ALL IN</span>}
              </div>

              {/* Hole cards */}
              {pCards.length > 0 && !p.folded && (
                <div className="flex gap-0.5 mt-1 justify-center">
                  {pCards.map((c, ci) => <MiniCard key={ci} card={c} idx={ci} />)}
                </div>
              )}
              {p.hasCards && pCards.length === 0 && !p.folded && (
                <div className="flex gap-0.5 mt-1 justify-center">
                  <MiniCard faceDown idx={0} />
                  <MiniCard faceDown idx={1} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      {isMyTurn && phase !== 'WAITING' && phase !== 'SHOWDOWN' && (
        <div className="w-full max-w-4xl mt-4 bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            <button onClick={() => doAction('fold')} className="px-6 py-3 rounded-xl bg-gray-700 text-gray-300 font-bold hover:bg-gray-600 transition cursor-pointer">
              FOLD
            </button>
            {toCall <= 0 ? (
              <button onClick={() => doAction('check')} className="px-6 py-3 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 text-white font-bold shadow-[0_4px_0_#1d4ed8] hover:brightness-110 transition active:translate-y-0.5 cursor-pointer">
                CHECK
              </button>
            ) : (
              <button onClick={() => doAction('call')} className="px-6 py-3 rounded-xl bg-gradient-to-b from-green-500 to-green-700 text-white font-bold shadow-[0_4px_0_#15803d] hover:brightness-110 transition active:translate-y-0.5 cursor-pointer">
                CALL {toCall}
              </button>
            )}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={currentBet + bigBlind}
                max={myPlayer?.chips + (myPlayer?.currentBet || 0)}
                value={raiseAmount || currentBet + bigBlind}
                onChange={e => setRaiseAmount(Number(e.target.value))}
                className="w-24 md:w-40 accent-brand-accent cursor-pointer"
              />
              <span className="text-sm font-mono text-gray-400 w-12">{raiseAmount || currentBet + bigBlind}</span>
              <button
                onClick={() => doAction('raise', raiseAmount || currentBet + bigBlind)}
                className="px-6 py-3 rounded-xl bg-gradient-to-b from-brand-accent to-yellow-600 text-black font-bold shadow-[0_4px_0_#b45309] hover:brightness-110 transition active:translate-y-0.5 cursor-pointer"
              >
                RAISE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting message */}
      {phase === 'WAITING' && (
        <div className="mt-6 text-center text-gray-500 text-sm">
          Waiting for more players to join...
        </div>
      )}

      <style>{`
        @keyframes cardIn {
          from { transform: translateY(-10px) scale(0.8); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
